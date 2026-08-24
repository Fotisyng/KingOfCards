import { randomUUID } from "node:crypto";
import type { Card, CreateCardInput } from "@kingofcards/domain-shared";
import type { Client, Row } from "@libsql/client";
import { decodeCursor, encodeCursor, type Page } from "./pagination.js";

// The deck-detail page's card list, unlike listCardsByDeck's internal callers (levels.ts/due.ts,
// which need a deck's complete ordered card list to chunk into levels): large decks (HSK 6) run
// to 2,500 cards, too many to render unpaged. Exported for tests.
export const CARDS_PAGE_SIZE = 50;

function mapRow(row: Row): Card {
  return {
    id: row.id as string,
    deckId: row.deck_id as string,
    frontMd: row.front_md as string,
    backMd: row.back_md as string,
    createdAt: row.created_at as string,
  };
}

/**
 * Lists ALL of a deck's cards in creation order, for the caller's own account only.
 *
 * Joined through `deck` so a foreign `deckId` comes back empty rather than leaking another user's
 * cards; `id` tiebreaks `created_at` since two cards can share the same timestamp and level chunking
 * needs a stable order. Stays unpaged deliberately: level-chunking needs a deck's complete ordered
 * card list in one read, not a page of it. The deck-detail page's own card list is paginated separately, via
 * {@link listCardsByDeckPage}.
 */
export async function listCardsByDeck(db: Client, userId: string, deckId: string): Promise<Card[]> {
  const rs = await db.execute({
    sql: `
      SELECT c.id, c.deck_id, c.front_md, c.back_md, c.created_at
      FROM card c
      JOIN deck d ON d.id = c.deck_id
      WHERE c.deck_id = ? AND d.user_id = ?
      ORDER BY c.created_at ASC, c.id ASC
    `,
    args: [deckId, userId],
  });
  return rs.rows.map(mapRow);
}

/**
 * Lists one page of a deck's cards in creation order, for the deck-detail page's card list.
 *
 * Keyset-paginated on `(created_at, id)` ASC, same ordering as {@link listCardsByDeck}, just
 * bounded to `CARDS_PAGE_SIZE` per call so a 2,500-card deck doesn't come back in one response.
 *
 * @param cursor - Opaque cursor from a previous page's `nextCursor`; omit for the first page.
 */
export async function listCardsByDeckPage(
  db: Client,
  userId: string,
  deckId: string,
  cursor?: string | null,
): Promise<Page<Card>> {
  const after = cursor ? decodeCursor(cursor) : null;
  const rs = await db.execute({
    sql: `
      SELECT c.id, c.deck_id, c.front_md, c.back_md, c.created_at
      FROM card c
      JOIN deck d ON d.id = c.deck_id
      WHERE c.deck_id = ? AND d.user_id = ?
      ${after ? "AND (c.created_at > ? OR (c.created_at = ? AND c.id > ?))" : ""}
      ORDER BY c.created_at ASC, c.id ASC
      LIMIT ?
    `,
    args: after
      ? [deckId, userId, after.createdAt, after.createdAt, after.id, CARDS_PAGE_SIZE + 1]
      : [deckId, userId, CARDS_PAGE_SIZE + 1],
  });

  // Fetching one extra row tells us whether there's a next page without a separate COUNT query.
  const hasMore = rs.rows.length > CARDS_PAGE_SIZE;
  const pageRows = hasMore ? rs.rows.slice(0, CARDS_PAGE_SIZE) : rs.rows;
  const items = pageRows.map(mapRow);

  const last = pageRows.at(-1);
  const nextCursor = hasMore && last ? encodeCursor(last.created_at as string, last.id as string) : null;
  return { items, nextCursor };
}

/** Inserts a new card under an already-verified-owned deck. */
export async function createCard(db: Client, input: CreateCardInput): Promise<Card> {
  const id = randomUUID();
  const createdAt = new Date().toISOString();

  await db.execute({
    sql: "INSERT INTO card (id, deck_id, front_md, back_md, created_at) VALUES (?, ?, ?, ?, ?)",
    args: [id, input.deckId, input.frontMd, input.backMd, createdAt],
  });

  return { id, deckId: input.deckId, frontMd: input.frontMd, backMd: input.backMd, createdAt };
}

/** Fetches one card by id, with no ownership check: callers must verify ownership themselves. */
export async function getCard(db: Client, cardId: string): Promise<Card | null> {
  const rs = await db.execute({
    sql: "SELECT id, deck_id, front_md, back_md, created_at FROM card WHERE id = ?",
    args: [cardId],
  });
  const row = rs.rows[0];
  return row ? mapRow(row) : null;
}

/**
 * Updates a card's content.
 *
 * Ownership check and write are one atomic statement, same pattern as `decksRepo.setPublic`.
 *
 * @returns The updated card, or `null` if `cardId` doesn't exist or isn't owned by `userId`.
 */
export async function updateCard(
  db: Client,
  cardId: string,
  userId: string,
  input: { frontMd: string; backMd: string },
): Promise<Card | null> {
  const rs = await db.execute({
    sql: `
      UPDATE card SET front_md = ?, back_md = ?
      WHERE id = ? AND deck_id IN (SELECT id FROM deck WHERE user_id = ?)
    `,
    args: [input.frontMd, input.backMd, cardId, userId],
  });
  if (rs.rowsAffected === 0) return null;
  return getCard(db, cardId);
}

/**
 * Deletes a card owned by `userId`, along with its scheduler state.
 *
 * Never touches `review_log`, since it's append-only and a deleted card's reviews should stay intact.
 *
 * @returns `false` if `cardId` doesn't exist or isn't owned by `userId`.
 */
export async function deleteCard(db: Client, cardId: string, userId: string): Promise<boolean> {
  const rs = await db.execute({
    sql: "DELETE FROM card WHERE id = ? AND deck_id IN (SELECT id FROM deck WHERE user_id = ?)",
    args: [cardId, userId],
  });
  if (rs.rowsAffected === 0) return false;

  await db.execute({
    sql: "DELETE FROM card_scheduler_state WHERE card_id = ?",
    args: [cardId],
  });
  return true;
}
