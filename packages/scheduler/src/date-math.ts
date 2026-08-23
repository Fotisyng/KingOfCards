const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Returns a new `Date`, `days` after `date` (does not mutate `date`). */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
}
