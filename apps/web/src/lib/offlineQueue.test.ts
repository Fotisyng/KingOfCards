import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearQueuedReviews,
  countQueuedReviews,
  enqueueReview,
  flushQueuedReviews,
  getQueuedReviews,
  removeQueuedReview,
} from "./offlineQueue.js";

beforeEach(async () => {
  await clearQueuedReviews();
});

describe("offlineQueue", () => {
  it("enqueues, lists, and removes a review", async () => {
    await enqueueReview({ cardId: "card-a", rating: "good", queuedAt: "2024-01-01T00:00:00.000Z" });
    expect(await countQueuedReviews()).toBe(1);

    const queuedReviews = await getQueuedReviews();
    expect(queuedReviews).toEqual([
      {
        id: expect.any(Number),
        entry: { cardId: "card-a", rating: "good", queuedAt: "2024-01-01T00:00:00.000Z" },
      },
    ]);

    await removeQueuedReview(queuedReviews[0]?.id as number);
    expect(await countQueuedReviews()).toBe(0);
  });

  it("clears every queued review", async () => {
    await enqueueReview({ cardId: "card-a", rating: "good", queuedAt: "2024-01-01T00:00:00.000Z" });
    await enqueueReview({ cardId: "card-b", rating: "hard", queuedAt: "2024-01-01T00:00:01.000Z" });

    await clearQueuedReviews();

    expect(await countQueuedReviews()).toBe(0);
  });

  it("reads keys and values from a single shared transaction, not two separate ones", async () => {
    await enqueueReview({ cardId: "card-a", rating: "good", queuedAt: "2024-01-01T00:00:00.000Z" });

    // The regression this guards against: db.getAllKeys() + db.getAll() each open their own
    // transaction, so a concurrent enqueueReview() landing between them could pair a key with the
    // wrong value. One shared transaction (asserted here as exactly one IDBDatabase.transaction
    // call) is what makes that impossible, regardless of what else is happening concurrently.
    const transactionSpy = vi.spyOn(IDBDatabase.prototype, "transaction");
    await getQueuedReviews();

    expect(transactionSpy).toHaveBeenCalledTimes(1);
    transactionSpy.mockRestore();
  });

  const alwaysTransient = () => "transient" as const;

  it("flushes queued reviews oldest-first and removes each on success", async () => {
    await enqueueReview({ cardId: "card-a", rating: "good", queuedAt: "2024-01-01T00:00:00.000Z" });
    await enqueueReview({ cardId: "card-b", rating: "hard", queuedAt: "2024-01-01T00:00:01.000Z" });

    const submitted: string[] = [];
    const result = await flushQueuedReviews(async (cardId) => {
      submitted.push(cardId);
    }, alwaysTransient);

    expect(result).toEqual({ flushed: 2, retriedTransient: 0, droppedPermanent: 0 });
    expect(submitted).toEqual(["card-a", "card-b"]);
    expect(await countQueuedReviews()).toBe(0);
  });

  it("skips a transiently-failing item rather than aborting the flush, leaving it queued for next time", async () => {
    await enqueueReview({
      cardId: "bad-card",
      rating: "good",
      queuedAt: "2024-01-01T00:00:00.000Z",
    });
    await enqueueReview({
      cardId: "good-card",
      rating: "good",
      queuedAt: "2024-01-01T00:00:01.000Z",
    });

    const submitted: string[] = [];
    const result = await flushQueuedReviews(async (cardId) => {
      submitted.push(cardId);
      if (cardId === "bad-card") throw new Error("simulated submit failure");
    }, alwaysTransient);

    expect(result).toEqual({ flushed: 1, retriedTransient: 1, droppedPermanent: 0 });
    expect(submitted).toEqual(["bad-card", "good-card"]);

    const remaining = await getQueuedReviews();
    expect(remaining).toEqual([{ id: expect.any(Number), entry: expect.objectContaining({ cardId: "bad-card" }) }]);
  });

  it("blocks a card's later entries after an earlier one for that card fails transiently, preserving order", async () => {
    await enqueueReview({ cardId: "card-a", rating: "again", queuedAt: "2024-01-01T00:00:00.000Z" });
    await enqueueReview({ cardId: "card-a", rating: "good", queuedAt: "2024-01-01T00:00:01.000Z" });
    await enqueueReview({ cardId: "card-b", rating: "hard", queuedAt: "2024-01-01T00:00:02.000Z" });

    const submitted: string[] = [];
    const result = await flushQueuedReviews(async (cardId) => {
      submitted.push(cardId);
      if (cardId === "card-a") throw new Error("simulated submit failure");
    }, alwaysTransient);

    // card-a's second entry is never attempted this flush: submitting it ahead of card-a's still-
    // queued first entry would apply the two ratings out of order once the first one is retried.
    // card-b, an unrelated card, is unaffected and still flushes normally.
    expect(submitted).toEqual(["card-a", "card-b"]);
    expect(result).toEqual({ flushed: 1, retriedTransient: 2, droppedPermanent: 0 });

    const remaining = await getQueuedReviews();
    expect(remaining).toEqual([
      { id: expect.any(Number), entry: { cardId: "card-a", rating: "again", queuedAt: "2024-01-01T00:00:00.000Z" } },
      { id: expect.any(Number), entry: { cardId: "card-a", rating: "good", queuedAt: "2024-01-01T00:00:01.000Z" } },
    ]);
  });

  it("drops a permanently-failing item instead of leaving it to retry forever", async () => {
    await enqueueReview({
      cardId: "revoked-session-card",
      rating: "good",
      queuedAt: "2024-01-01T00:00:00.000Z",
    });
    await enqueueReview({
      cardId: "good-card",
      rating: "good",
      queuedAt: "2024-01-01T00:00:01.000Z",
    });

    const result = await flushQueuedReviews(
      async (cardId) => {
        if (cardId === "revoked-session-card") throw new Error("simulated UNAUTHORIZED");
      },
      (err) => ((err as Error).message.includes("UNAUTHORIZED") ? "permanent" : "transient"),
    );

    expect(result).toEqual({ flushed: 1, retriedTransient: 0, droppedPermanent: 1 });
    // Gone for good, not left queued: retrying an expired-session failure would never succeed.
    expect(await getQueuedReviews()).toEqual([]);
  });
});
