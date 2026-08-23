import { describe, expect, it } from "vitest";
import { CARDS_PER_LEVEL } from "./levels.js";
import { CARDS_PAGE_SIZE } from "./repositories/cards.js";
import { PUBLIC_DECKS_PAGE_SIZE } from "./repositories/decks.js";
import { createTestDb, createVerifiedCaller } from "./testHelpers.js";

async function createTwoTestCallers() {
  const db = await createTestDb();
  const a = await createVerifiedCaller(db);
  const b = await createVerifiedCaller(db);
  return { callerA: a.caller, callerB: b.caller };
}

async function createTestCaller() {
  const db = await createTestDb();
  const { caller } = await createVerifiedCaller(db);
  return caller;
}

// stats.summary's 14-day trend is zero-filled relative to the real system clock: build the same
// shape here rather than hardcoding dates, with an optional count for "today" (index 13).
function expectedReviewsByDay(todayCount = 0): Array<{ day: string; count: number }> {
  const days: Array<{ day: string; count: number }> = [];
  const cursor = new Date();
  cursor.setUTCDate(cursor.getUTCDate() - 13);
  for (let i = 0; i < 14; i++) {
    days.push({ day: cursor.toISOString().slice(0, 10), count: i === 13 ? todayCount : 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

describe("appRouter", () => {
  it("walks a card through creation, due-listing, two reviews, and stats", async () => {
    const caller = await createTestCaller();

    const deck = await caller.decks.create({ name: "Spanish" });
    expect(deck).toEqual({
      id: expect.any(String),
      name: "Spanish",
      description: null,
      isPublic: false,
      createdAt: expect.any(String),
    });

    const card = await caller.cards.create({ deckId: deck.id, frontMd: "hola", backMd: "hello" });
    expect(card).toEqual({
      id: expect.any(String),
      deckId: deck.id,
      frontMd: "hola",
      backMd: "hello",
      createdAt: expect.any(String),
    });

    expect(await caller.due.list()).toEqual([{ ...card, dueAt: expect.any(String) }]);
    expect(await caller.stats.summary()).toEqual({
      dueToday: 1,
      retentionRate: null,
      streak: 0,
      reviewsByDay: expectedReviewsByDay(),
    });

    const firstReview = await caller.reviews.submit({ cardId: card.id, rating: "good" });
    expect(firstReview).toEqual({
      cardId: card.id,
      algorithm: "sm2",
      intervalDays: 1,
      dueAt: expect.any(String),
    });

    expect(await caller.due.list()).toEqual([]);
    expect(await caller.stats.summary()).toEqual({
      dueToday: 0,
      retentionRate: 100,
      streak: 1,
      reviewsByDay: expectedReviewsByDay(1),
    });

    // Second consecutive "good" graduates to the 6-day interval, proving the scheduler state
    // round-tripped through storage rather than starting from scratch.
    const secondReview = await caller.reviews.submit({ cardId: card.id, rating: "good" });
    expect(secondReview).toEqual({
      cardId: card.id,
      algorithm: "sm2",
      intervalDays: 6,
      dueAt: expect.any(String),
    });
  });

  it("rejects a review for a card that doesn't exist", async () => {
    const caller = await createTestCaller();
    await expect(caller.reviews.submit({ cardId: "missing", rating: "good" })).rejects.toThrow();
  });

  it("uses the given ratedAt for scheduling and stats, not the server's own clock", async () => {
    const caller = await createTestCaller();
    const deck = await caller.decks.create({ name: "Spanish" });
    const card = await caller.cards.create({ deckId: deck.id, frontMd: "hola", backMd: "hello" });

    const twoDaysAgo = new Date();
    twoDaysAgo.setUTCDate(twoDaysAgo.getUTCDate() - 2);

    const review = await caller.reviews.submit({ cardId: card.id, rating: "good", ratedAt: twoDaysAgo.toISOString() });
    expect(review).toEqual({
      cardId: card.id,
      algorithm: "sm2",
      intervalDays: 1,
      dueAt: expect.any(String),
    });

    // The 1-day interval measured from two days ago puts the card due yesterday, already due
    // today, and the review counts toward the trend two days back, not today, and doesn't extend
    // an unbroken streak through today since nothing was rated yesterday or today either.
    const expectedTrend = expectedReviewsByDay();
    expectedTrend[11] = { ...(expectedTrend[11] as { day: string; count: number }), count: 1 };
    expect(await caller.stats.summary()).toEqual({
      dueToday: 1,
      retentionRate: 100,
      streak: 0,
      reviewsByDay: expectedTrend,
    });
  });

  const OVERSIZED_DECK_CASES = [
    { field: "name", input: { name: "x".repeat(201) } },
    { field: "description", input: { name: "ok", description: "x".repeat(2_001) } },
  ];

  it.each(OVERSIZED_DECK_CASES)("rejects a deck with an oversized $field", async ({ input }) => {
    const caller = await createTestCaller();
    await expect(caller.decks.create(input)).rejects.toThrow();
  });

  const OVERSIZED_CARD_CASES = [
    { field: "frontMd", frontMd: "x".repeat(10_001), backMd: "ok" },
    { field: "backMd", frontMd: "ok", backMd: "x".repeat(20_001) },
  ];

  it.each(OVERSIZED_CARD_CASES)("rejects a card with an oversized $field", async ({ frontMd, backMd }) => {
    const caller = await createTestCaller();
    const deck = await caller.decks.create({ name: "Deck" });
    await expect(caller.cards.create({ deckId: deck.id, frontMd, backMd })).rejects.toThrow();
  });

  it("rate-limits rapid deck creation", async () => {
    const caller = await createTestCaller();
    for (let i = 0; i < 20; i++) {
      await caller.decks.create({ name: `Deck ${i}` });
    }
    await expect(caller.decks.create({ name: "One too many" })).rejects.toThrow(/too many attempts/i);
  });

  it("rate-limits rapid card creation", async () => {
    const caller = await createTestCaller();
    const deck = await caller.decks.create({ name: "Deck" });
    for (let i = 0; i < 300; i++) {
      await caller.cards.create({ deckId: deck.id, frontMd: `f${i}`, backMd: `b${i}` });
    }
    await expect(caller.cards.create({ deckId: deck.id, frontMd: "one too many", backMd: "x" })).rejects.toThrow(
      /too many attempts/i,
    );
  }, 30_000);

  const DECK_CARD_COUNT_CASES = [
    { name: "a deck with no cards", cardsToCreate: 0 },
    { name: "a deck with several cards", cardsToCreate: 3 },
  ];

  it.each(DECK_CARD_COUNT_CASES)("decks.list reports cardCount for $name", async ({ cardsToCreate }) => {
    const caller = await createTestCaller();
    const deck = await caller.decks.create({ name: "Deck" });
    for (let i = 0; i < cardsToCreate; i++) {
      await caller.cards.create({ deckId: deck.id, frontMd: `front ${i}`, backMd: `back ${i}` });
    }

    expect(await caller.decks.list()).toEqual([{ ...deck, cardCount: cardsToCreate }]);
  });

  it("gates level-2 cards behind clearing level 1", async () => {
    const caller = await createTestCaller();
    const deck = await caller.decks.create({ name: "Leveled" });

    for (let i = 0; i < CARDS_PER_LEVEL + 1; i++) {
      await caller.cards.create({ deckId: deck.id, frontMd: `f${i}`, backMd: `b${i}` });
    }
    // Read back through the same ordered query levels.ts uses (created_at ASC, id ASC) rather
    // than assuming JS call order matches DB order: rapid inserts can share a millisecond-
    // precision created_at, and the `id` tiebreaker (a random UUID) doesn't preserve call order.
    const orderedCards = (await caller.cards.listByDeck({ deckId: deck.id })).items;
    const level1Ids = orderedCards.slice(0, CARDS_PER_LEVEL).map((c) => c.id);
    const level2Id = orderedCards[CARDS_PER_LEVEL]?.id;

    const beforeClearing = await caller.due.list({ deckId: deck.id });
    expect(beforeClearing.map((c) => c.id).sort()).toEqual([...level1Ids].sort());

    for (const id of level1Ids) {
      await caller.reviews.submit({ cardId: id, rating: "good" });
    }

    const afterClearing = await caller.due.list({ deckId: deck.id });
    expect(afterClearing.map((c) => c.id)).toEqual([level2Id]);
  });

  it("updates a card's content", async () => {
    const caller = await createTestCaller();
    const deck = await caller.decks.create({ name: "Deck" });
    const card = await caller.cards.create({
      deckId: deck.id,
      frontMd: "old front",
      backMd: "old back",
    });

    const updated = await caller.cards.update({
      cardId: card.id,
      frontMd: "new front",
      backMd: "new back",
    });
    expect(updated).toEqual({ ...card, frontMd: "new front", backMd: "new back" });

    const {
      items: [refetched],
    } = await caller.cards.listByDeck({ deckId: deck.id });
    expect(refetched).toEqual(updated);
  });

  it("rejects updating or deleting a card that isn't yours", async () => {
    const { callerA, callerB } = await createTwoTestCallers();
    const deck = await callerA.decks.create({ name: "A's deck" });
    const card = await callerA.cards.create({ deckId: deck.id, frontMd: "front", backMd: "back" });

    await expect(callerB.cards.update({ cardId: card.id, frontMd: "hijacked", backMd: "hijacked" })).rejects.toThrow();
    await expect(callerB.cards.delete({ cardId: card.id })).rejects.toThrow();

    // Untouched: still callerA's, still the original content.
    expect(await callerA.cards.listByDeck({ deckId: deck.id })).toEqual({ items: [card], nextCursor: null });
  });

  it("deletes a card", async () => {
    const caller = await createTestCaller();
    const deck = await caller.decks.create({ name: "Deck" });
    const card = await caller.cards.create({ deckId: deck.id, frontMd: "front", backMd: "back" });

    expect(await caller.cards.delete({ cardId: card.id })).toEqual({ ok: true });
    expect(await caller.cards.listByDeck({ deckId: deck.id })).toEqual({ items: [], nextCursor: null });
    expect(await caller.due.list({ deckId: deck.id })).toEqual([]);
  });

  it("deletes a deck along with its cards, leaving past reviews out of stats", async () => {
    const caller = await createTestCaller();
    const deck = await caller.decks.create({ name: "Deck" });
    const card = await caller.cards.create({ deckId: deck.id, frontMd: "front", backMd: "back" });
    await caller.reviews.submit({ cardId: card.id, rating: "good" });

    expect(await caller.stats.summary()).toEqual({
      dueToday: 0,
      retentionRate: 100,
      streak: 1,
      reviewsByDay: expectedReviewsByDay(1),
    });

    expect(await caller.decks.delete({ deckId: deck.id })).toEqual({ ok: true });

    expect(await caller.decks.list()).toEqual([]);
    // review_log itself isn't deleted, just unreachable now that its card is gone.
    expect(await caller.stats.summary()).toEqual({
      dueToday: 0,
      retentionRate: null,
      streak: 0,
      reviewsByDay: expectedReviewsByDay(),
    });
  });

  it("rejects deleting a deck that isn't yours", async () => {
    const { callerA, callerB } = await createTwoTestCallers();
    const deck = await callerA.decks.create({ name: "Not yours" });

    await expect(callerB.decks.delete({ deckId: deck.id })).rejects.toThrow();
    expect(await callerA.decks.list()).toEqual([{ ...deck, cardCount: 0 }]);
  });

  it("clones a public deck's cards under the new owner, defaulting to private", async () => {
    const { callerA, callerB } = await createTwoTestCallers();

    const source = await callerA.decks.create({ name: "Shared Spanish", description: "hola" });
    await callerA.cards.create({ deckId: source.id, frontMd: "hola", backMd: "hello" });
    await callerA.cards.create({ deckId: source.id, frontMd: "gato", backMd: "cat" });
    await callerA.decks.setPublic({ deckId: source.id, isPublic: true });

    const cloned = await callerB.decks.clone({ deckId: source.id });
    expect(cloned).toEqual({
      id: expect.any(String),
      name: "Shared Spanish",
      description: "hola",
      isPublic: false,
      createdAt: expect.any(String),
      cardCount: 2,
    });
    expect(cloned.id).not.toBe(source.id);

    // Array.prototype.sort() with no comparator stringifies each element ("[object Object]") before
    // comparing, so it's a no-op for an array of objects: sort by a real field instead, on both
    // sides, since a bare SELECT gives no ordering guarantee to begin with.
    const byFrontMd = <T extends { frontMd: string }>(a: T, b: T) => a.frontMd.localeCompare(b.frontMd);
    const clonedCards = (await callerB.cards.listByDeck({ deckId: cloned.id })).items;
    expect(clonedCards.map((c) => ({ frontMd: c.frontMd, backMd: c.backMd })).sort(byFrontMd)).toEqual(
      [
        { frontMd: "hola", backMd: "hello" },
        { frontMd: "gato", backMd: "cat" },
      ].sort(byFrontMd),
    );
    const sourceCards = (await callerA.cards.listByDeck({ deckId: source.id })).items;
    expect(clonedCards.map((c) => c.id).sort()).not.toEqual(sourceCards.map((c) => c.id).sort());

    // The original is untouched: still public, same card count, still callerA's.
    expect(await callerA.decks.list()).toEqual([{ ...source, isPublic: true, cardCount: 2 }]);
  });

  it("rejects cloning a deck that isn't public", async () => {
    const { callerA, callerB } = await createTwoTestCallers();
    const privateDeck = await callerA.decks.create({ name: "Private" });

    await expect(callerB.decks.clone({ deckId: privateDeck.id })).rejects.toThrow();
  });

  it("rejects setPublic from a non-owner", async () => {
    const { callerA, callerB } = await createTwoTestCallers();
    const deck = await callerA.decks.create({ name: "Not yours" });

    await expect(callerB.decks.setPublic({ deckId: deck.id, isPublic: true })).rejects.toThrow();
  });

  it("lists public decks across accounts with correct isOwn", async () => {
    const { callerA, callerB } = await createTwoTestCallers();

    const deckA = await callerA.decks.create({ name: "A's deck" });
    await callerA.decks.setPublic({ deckId: deckA.id, isPublic: true });
    const deckB = await callerB.decks.create({ name: "B's deck" });
    await callerB.decks.setPublic({ deckId: deckB.id, isPublic: true });

    const fromA = (await callerA.decks.listPublic()).items;
    expect(fromA.find((d) => d.id === deckA.id)?.isOwn).toBe(true);
    expect(fromA.find((d) => d.id === deckB.id)?.isOwn).toBe(false);

    const fromB = (await callerB.decks.listPublic()).items;
    expect(fromB.find((d) => d.id === deckB.id)?.isOwn).toBe(true);
    expect(fromB.find((d) => d.id === deckA.id)?.isOwn).toBe(false);
  });

  it("pages through a deck's cards once it's larger than one page", async () => {
    const caller = await createTestCaller();
    const deck = await caller.decks.create({ name: "Big deck" });
    const total = CARDS_PAGE_SIZE + 3;
    for (let i = 0; i < total; i++) {
      await caller.cards.create({ deckId: deck.id, frontMd: `f${i}`, backMd: `b${i}` });
    }

    const firstPage = await caller.cards.listByDeck({ deckId: deck.id });
    expect(firstPage.items).toHaveLength(CARDS_PAGE_SIZE);
    expect(firstPage.nextCursor).not.toBeNull();

    const secondPage = await caller.cards.listByDeck({ deckId: deck.id, cursor: firstPage.nextCursor ?? undefined });
    expect(secondPage.items).toHaveLength(3);
    expect(secondPage.nextCursor).toBeNull();

    const firstIds = new Set(firstPage.items.map((c) => c.id));
    expect(secondPage.items.some((c) => firstIds.has(c.id))).toBe(false);
  });

  it("pages through public decks across accounts once there's more than one page", async () => {
    const db = await createTestDb();
    const total = PUBLIC_DECKS_PAGE_SIZE + 2;
    const perAccount = 10; // stays comfortably under the 20/hour deck-create rate limit

    for (let created = 0; created < total; ) {
      const { caller } = await createVerifiedCaller(db);
      const batchSize = Math.min(perAccount, total - created);
      for (let i = 0; i < batchSize; i++) {
        const deck = await caller.decks.create({ name: `Public ${created + i}` });
        await caller.decks.setPublic({ deckId: deck.id, isPublic: true });
      }
      created += batchSize;
    }

    const { caller: reader } = await createVerifiedCaller(db);
    const firstPage = await reader.decks.listPublic();
    expect(firstPage.items).toHaveLength(PUBLIC_DECKS_PAGE_SIZE);
    expect(firstPage.nextCursor).not.toBeNull();

    const secondPage = await reader.decks.listPublic({ cursor: firstPage.nextCursor ?? undefined });
    expect(secondPage.items).toHaveLength(2);
    expect(secondPage.nextCursor).toBeNull();

    const firstIds = new Set(firstPage.items.map((d) => d.id));
    expect(secondPage.items.some((d) => firstIds.has(d.id))).toBe(false);
  });
});
