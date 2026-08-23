/**
 * Counts the current consecutive-day review streak, ending at `today`.
 *
 * Pure so it's cheap to unit-test independent of the DB. No review yet today
 * shouldn't zero out an otherwise-unbroken streak through yesterday.
 */
export function computeStreak(reviewDays: readonly string[], today: string): number {
  const daySet = new Set(reviewDays);
  const cursor = new Date(`${today}T00:00:00.000Z`);

  if (!daySet.has(today)) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  let streak = 0;
  while (daySet.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}
