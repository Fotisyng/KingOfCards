import { randomUUID } from "node:crypto";
import type { CreateDeckInput, Deck } from "@kingofcards/domain-shared";
import type { Client, InStatement, Row } from "@libsql/client";
import { type Page, decodeCursor, encodeCursor } from "./pagination.js";

// batch() calls this large get chunked (cloneDeck), since there's no established precedent or documented
// guarantee in this codebase that a single multi-thousand-statement batch is safe to send as one
// request (some seeded decks, e.g. HSK 6, run to 2,500 cards).
const CLONE_BATCH_CHUNK_SIZE = 500;

// Community decks cross every account, not just the caller's: unlike listDecks (one account's own
// decks, small by construction), this needs a page size, not a full scan. Exported for tests.
export const PUBLIC_DECKS_PAGE_SIZE = 20;

function mapRow(row: Row): Deck {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string | null) ?? null,
    isPublic: row.is_public === 1,
    createdAt: row.created_at as string,
  };
}

/** Lists the caller's own decks with each one's card count. */
export async function listDecks(db: Client, userId: string): Promise<Array<Deck & { cardCount: number }>> {
  const rs = await db.execute({
    sql: `
      SELECT d.id, d.name, d.description, d.is_public, d.created_at, COUNT(c.id) AS card_count
      FROM deck d
      LEFT JOIN card c ON c.deck_id = d.id
      WHERE d.user_id = ?
      GROUP BY d.id
      ORDER BY d.created_at ASC
    `,
    args: [userId],
  });
  return rs.rows.map((row) => ({ ...mapRow(row), cardCount: Number(row.card_count) }));
}

/** Inserts a new, private deck owned by `userId`. */
export async function createDeck(db: Client, userId: string, input: CreateDeckInput): Promise<Deck> {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const description = input.description ?? null;

  await db.execute({
    sql: "INSERT INTO deck (id, user_id, name, description, is_public, created_at) VALUES (?, ?, ?, ?, 0, ?)",
    args: [id, userId, input.name, description, createdAt],
  });

  return { id, name: input.name, description, isPublic: false, createdAt };
}

/**
 * Checks whether `userId` owns `deckId`.
 *
 * Used to authorize a caller-supplied `deckId` before a write (`cards.create`, `reviews.submit`);
 * reads stay safe by scoping their own queries through a `deck.user_id` join instead.
 */
export async function isDeckOwner(db: Client, deckId: string, userId: string): Promise<boolean> {
  const rs = await db.execute({
    sql: "SELECT 1 FROM deck WHERE id = ? AND user_id = ?",
    args: [deckId, userId],
  });
  return rs.rows.length > 0;
}

/**
 * Toggles a deck's public/private flag.
 *
 * @returns `true` if a row was updated. The ownership check and the write are one atomic
 * statement, so `false` covers both "no such deck" and "not the caller's" in a single round trip.
 */
export async function setPublic(db: Client, deckId: string, userId: string, isPublic: boolean): Promise<boolean> {
  const rs = await db.execute({
    sql: "UPDATE deck SET is_public = ? WHERE id = ? AND user_id = ?",
    args: [isPublic ? 1 : 0, deckId, userId],
  });
  return rs.rowsAffected > 0;
}

/**
 * Deletes a deck owned by `userId`, along with its cards and their scheduler state.
 *
 * Never deletes `review_log` (append-only): cascaded cards just become unreachable, not gone.
 *
 * @returns `false` if `deckId` doesn't exist or isn't owned by `userId`.
 */
export async function deleteDeck(db: Client, deckId: string, userId: string): Promise<boolean> {
  const results = await db.batch(
    [
      {
        sql: `
          DELETE FROM card_scheduler_state
          WHERE card_id IN (
            SELECT c.id FROM card c JOIN deck d ON d.id = c.deck_id
            WHERE c.deck_id = ? AND d.user_id = ?
          )
        `,
        args: [deckId, userId],
      },
      {
        sql: `
          DELETE FROM card
          WHERE deck_id = ? AND deck_id IN (SELECT id FROM deck WHERE id = ? AND user_id = ?)
        `,
        args: [deckId, deckId, userId],
      },
      { sql: "DELETE FROM deck WHERE id = ? AND user_id = ?", args: [deckId, userId] },
    ],
    "write",
  );
  return (results[2]?.rowsAffected ?? 0) > 0;
}

/**
 * Lists one page of public decks across all accounts, for the Community browse page.
 *
 * Keyset-paginated on `(created_at, id)` DESC, newest first: a plain unpaged scan would grow with
 * every account's public decks, not just the caller's.
 *
 * @param callerId - Used only to compute `isOwn` server-side; the raw owner id is never returned,
 * so cloning stays anonymous across accounts.
 * @param cursor - Opaque cursor from a previous page's `nextCursor`; omit for the first page.
 */
export async function listPublicDecks(
  db: Client,
  callerId: string,
  cursor?: string | null,
): Promise<Page<Deck & { cardCount: number; isOwn: boolean }>> {
  const after = cursor ? decodeCursor(cursor) : null;
  const rs = await db.execute({
    sql: `
      SELECT d.id, d.name, d.description, d.is_public, d.created_at, d.user_id, COUNT(c.id) AS card_count
      FROM deck d
      LEFT JOIN card c ON c.deck_id = d.id
      WHERE d.is_public = 1
      ${after ? "AND (d.created_at < ? OR (d.created_at = ? AND d.id < ?))" : ""}
      GROUP BY d.id
      ORDER BY d.created_at DESC, d.id DESC
      LIMIT ?
    `,
    args: after
      ? [after.createdAt, after.createdAt, after.id, PUBLIC_DECKS_PAGE_SIZE + 1]
      : [PUBLIC_DECKS_PAGE_SIZE + 1],
  });

  // Fetching one extra row tells us whether there's a next page without a separate COUNT query.
  const hasMore = rs.rows.length > PUBLIC_DECKS_PAGE_SIZE;
  const pageRows = hasMore ? rs.rows.slice(0, PUBLIC_DECKS_PAGE_SIZE) : rs.rows;
  const items = pageRows.map((row) => ({
    ...mapRow(row),
    cardCount: Number(row.card_count),
    isOwn: row.user_id === callerId,
  }));

  const last = pageRows.at(-1);
  const nextCursor = hasMore && last ? encodeCursor(last.created_at as string, last.id as string) : null;
  return { items, nextCursor };
}

/**
 * Fetches a sample of a public deck's cards, for the Community page's preview-before-cloning.
 *
 * Public-scoped, not caller-scoped like `listCardsByDeck`: any signed-in account can preview any
 * public deck.
 */
export async function getPreviewCards(
  db: Client,
  deckId: string,
  limit: number,
): Promise<Array<{ frontMd: string; backMd: string }>> {
  const rs = await db.execute({
    sql: `
      SELECT c.front_md, c.back_md
      FROM card c
      JOIN deck d ON d.id = c.deck_id
      WHERE c.deck_id = ? AND d.is_public = 1
      ORDER BY c.created_at ASC, c.id ASC
      LIMIT ?
    `,
    args: [deckId, limit],
  });
  return rs.rows.map((row) => ({
    frontMd: row.front_md as string,
    backMd: row.back_md as string,
  }));
}

/**
 * Clones a public deck into the caller's own account.
 *
 * Clone-on-copy, not live sharing: a full, independent copy with new deck/card ids and no
 * reference back to the source. The clone starts private; `review_log`/`card_scheduler_state` are
 * left untouched, since the copy has no review history of its own yet.
 *
 * @param sourceDeckId - The public deck to copy from.
 * @param callerId - The account that will own the new deck.
 * @returns The new deck with its card count, or `null` if `sourceDeckId` doesn't exist or isn't public.
 */
export async function cloneDeck(
  db: Client,
  sourceDeckId: string,
  callerId: string,
): Promise<(Deck & { cardCount: number }) | null> {
  const deckRs = await db.execute({
    sql: "SELECT name, description FROM deck WHERE id = ? AND is_public = 1",
    args: [sourceDeckId],
  });
  const source = deckRs.rows[0];
  if (!source) return null;

  const cardsRs = await db.execute({
    sql: "SELECT front_md, back_md FROM card WHERE deck_id = ?",
    args: [sourceDeckId],
  });

  const newDeckId = randomUUID();
  const createdAt = new Date().toISOString();
  const name = source.name as string;
  const description = (source.description as string | null) ?? null;

  const deckInsert: InStatement = {
    sql: "INSERT INTO deck (id, user_id, name, description, is_public, created_at) VALUES (?, ?, ?, ?, 0, ?)",
    args: [newDeckId, callerId, name, description, createdAt],
  };
  const cardInserts: InStatement[] = cardsRs.rows.map((row) => ({
    sql: "INSERT INTO card (id, deck_id, front_md, back_md, created_at) VALUES (?, ?, ?, ?, ?)",
    args: [randomUUID(), newDeckId, row.front_md as string, row.back_md as string, createdAt],
  }));

  await db.batch([deckInsert], "write");
  for (let i = 0; i < cardInserts.length; i += CLONE_BATCH_CHUNK_SIZE) {
    const chunk = cardInserts.slice(i, i + CLONE_BATCH_CHUNK_SIZE);
    if (chunk.length > 0) await db.batch(chunk, "write");
  }

  return {
    id: newDeckId,
    name,
    description,
    isPublic: false,
    createdAt,
    cardCount: cardInserts.length,
  };
}
