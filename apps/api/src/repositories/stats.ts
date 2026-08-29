import type { Client } from "@libsql/client";

/** Counts cards currently due (or never reviewed) under one scheduler algorithm. */
export async function countDueCards(db: Client, userId: string, algorithm: string, now: Date): Promise<number> {
  const rs = await db.execute({
    sql: `
      SELECT COUNT(*) as count
      FROM card c
      JOIN deck d ON d.id = c.deck_id
      LEFT JOIN card_scheduler_state css ON css.card_id = c.id AND css.algorithm = ?
      WHERE d.user_id = ? AND (css.due_at IS NULL OR css.due_at <= ?)
    `,
    args: [algorithm, userId, now.toISOString()],
  });
  return Number(rs.rows[0]?.count ?? 0);
}

/**
 * Computes the percentage of reviews rated anything other than "again".
 *
 * @returns `null` if there have been no reviews yet, rather than a misleading 0%.
 */
export async function getRetentionRate(db: Client, userId: string, algorithm: string): Promise<number | null> {
  const rs = await db.execute({
    sql: `
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN rl.rating != 'again' THEN 1 ELSE 0 END) as successes
      FROM review_log rl
      JOIN card c ON c.id = rl.card_id
      JOIN deck d ON d.id = c.deck_id
      WHERE rl.algorithm = ? AND d.user_id = ?
    `,
    args: [algorithm, userId],
  });
  const row = rs.rows[0];
  const total = Number(row?.total ?? 0);
  if (total === 0) {
    return null;
  }
  const successes = Number(row?.successes ?? 0);
  return (successes / total) * 100;
}

/**
 * Review counts per calendar day (UTC) over the last `days` days, zero-filled for days with none.
 *
 * The raw material for StatsPage's activity trend. `today` is a parameter (like `computeStreak`'s)
 * rather than computed internally, for the same determinism/testability reason.
 *
 * @returns Oldest day first.
 */
export async function getReviewCountsByDay(
  db: Client,
  userId: string,
  algorithm: string,
  days: number,
  today: string,
): Promise<Array<{ day: string; count: number }>> {
  const cutoff = new Date(`${today}T00:00:00.000Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - (days - 1));
  const cutoffDay = cutoff.toISOString().slice(0, 10);

  const rs = await db.execute({
    sql: `
      SELECT substr(rl.rated_at, 1, 10) as day, COUNT(*) as count
      FROM review_log rl
      JOIN card c ON c.id = rl.card_id
      JOIN deck d ON d.id = c.deck_id
      WHERE rl.algorithm = ? AND d.user_id = ? AND rl.rated_at >= ?
      GROUP BY day
    `,
    args: [algorithm, userId, cutoffDay],
  });
  const counts = new Map(rs.rows.map((row) => [row.day as string, Number(row.count)]));

  const result: Array<{ day: string; count: number }> = [];
  const cursor = new Date(`${cutoffDay}T00:00:00.000Z`);
  for (let i = 0; i < days; i++) {
    const day = cursor.toISOString().slice(0, 10);
    result.push({ day, count: counts.get(day) ?? 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
}

/** How far back {@link getReviewDays} looks for streak days. Well beyond any realistic streak, so it never
 * truncates a real one, while keeping the query bounded for long-lived accounts. */
const STREAK_LOOKBACK_DAYS = 400;

/**
 * Distinct calendar days (UTC) with at least one review in the last {@link STREAK_LOOKBACK_DAYS} days, most
 * recent first.
 *
 * The raw material `computeStreak()` (`src/stats.ts`) turns into a consecutive-day count; that function only
 * ever walks backward from `today` until the first gap, so bounding the lookback window doesn't change the
 * result for any realistic streak.
 */
export async function getReviewDays(db: Client, userId: string, algorithm: string, today: string): Promise<string[]> {
  const cutoff = new Date(`${today}T00:00:00.000Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - (STREAK_LOOKBACK_DAYS - 1));
  const cutoffDay = cutoff.toISOString().slice(0, 10);

  const rs = await db.execute({
    sql: `
      SELECT DISTINCT substr(rl.rated_at, 1, 10) as day
      FROM review_log rl
      JOIN card c ON c.id = rl.card_id
      JOIN deck d ON d.id = c.deck_id
      WHERE rl.algorithm = ? AND d.user_id = ? AND rl.rated_at >= ?
      ORDER BY day DESC
    `,
    args: [algorithm, userId, cutoffDay],
  });
  return rs.rows.map((row) => row.day as string);
}
