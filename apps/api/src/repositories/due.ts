import type { DueCard } from "@kingofcards/domain-shared";
import type { Client } from "@libsql/client";

// isNew (never reviewed, i.e. due_at was NULL before this synthesized a placeholder dueAt below)
// is dropped before DueCard reaches the client: the router only uses it to apply level gating
// to brand-new cards, never to already-introduced ones.
export interface DueCardCandidate extends DueCard {
  isNew: boolean;
}

/**
 * Lists cards due for review (or never reviewed) under one scheduler algorithm.
 *
 * Joined through `deck` so this only ever scans the caller's own cards: a foreign `deckId` just
 * comes back empty rather than leaking another user's due queue.
 */
export async function listDueCards(
  db: Client,
  userId: string,
  algorithm: string,
  now: Date,
  deckId?: string,
): Promise<DueCardCandidate[]> {
  const rs = await db.execute({
    sql: `
      SELECT c.id, c.deck_id, c.front_md, c.back_md, c.created_at, css.due_at
      FROM card c
      JOIN deck d ON d.id = c.deck_id
      LEFT JOIN card_scheduler_state css ON css.card_id = c.id AND css.algorithm = ?
      WHERE d.user_id = ?
        AND (css.due_at IS NULL OR css.due_at <= ?)
        AND (? IS NULL OR c.deck_id = ?)
      ORDER BY css.due_at IS NOT NULL, css.due_at ASC
    `,
    args: [algorithm, userId, now.toISOString(), deckId ?? null, deckId ?? null],
  });

  return rs.rows.map((row) => ({
    id: row.id as string,
    deckId: row.deck_id as string,
    frontMd: row.front_md as string,
    backMd: row.back_md as string,
    createdAt: row.created_at as string,
    dueAt: (row.due_at as string | null) ?? now.toISOString(),
    isNew: row.due_at === null,
  }));
}
