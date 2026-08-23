import type { Client } from "@libsql/client";

/**
 * Finds which of `cardIds` have been recalled successfully at least once.
 *
 * A card "qualifies" once rated `good`/`easy` at least once, used to gate level progression
 * without inspecting any scheduler-specific internal state.
 *
 * Joined through `card`/`deck` so this only ever scans the caller's own cards: unlike every other
 * repository query, `review_log` itself carries no `user_id` to filter on directly, so ownership has
 * to be enforced here rather than relying on callers to pre-scope `cardIds`.
 */
export async function getQualifyingCardIds(db: Client, userId: string, cardIds: string[]): Promise<Set<string>> {
  if (cardIds.length === 0) {
    return new Set();
  }

  const placeholders = cardIds.map(() => "?").join(", ");
  const rs = await db.execute({
    sql: `
      SELECT DISTINCT rl.card_id
      FROM review_log rl
      JOIN card c ON c.id = rl.card_id
      JOIN deck d ON d.id = c.deck_id
      WHERE rl.card_id IN (${placeholders}) AND rl.rating IN ('good', 'easy') AND d.user_id = ?
    `,
    args: [...cardIds, userId],
  });
  return new Set(rs.rows.map((row) => row.card_id as string));
}
