import { addDays } from "./date-math.js";
import type { Scheduler } from "./types.js";

export interface HlrInternal {
  /** Estimated days until predicted recall probability decays to 50%. */
  halfLifeDays: number;
  /** Total number of reviews this card has had, across all half-life adjustments. */
  totalReviews: number;
}

const TARGET_RETENTION = 0.9;
const MIN_INTERVAL_DAYS = 1;
const MIN_HALF_LIFE_DAYS = 0.1;
const LAPSE_HALF_LIFE_DECAY = 0.5;

// Multiplies the half-life on a successful review, chosen to avoid landing exactly on a
// rounding boundary in the resulting interval rather than for any deeper significance.
const GROWTH_FACTOR: Record<"hard" | "good" | "easy", number> = {
  hard: 1.6,
  good: 2.8,
  easy: 4.4,
};

function intervalDaysForHalfLife(halfLifeDays: number): number {
  return halfLifeDays * Math.log2(1 / TARGET_RETENTION);
}

function halfLifeDaysForInterval(intervalDays: number): number {
  return intervalDays / Math.log2(1 / TARGET_RETENTION);
}

/**
 * HLR: a Half-Life Regression scheduler.
 *
 * Forgetting is modeled as exponential decay, p(t) = 2^(-t / halfLife); this is Duolingo's
 * Half-Life Regression premise. The interval is whichever elapsed time keeps predicted recall at
 * {@link TARGET_RETENTION}, rather than SM-2's ease-factor heuristic.
 */
export const HlrScheduler: Scheduler<HlrInternal> = {
  id: "hlr",
  next(state, rating, now) {
    const previousHalfLife = state?.internal.halfLifeDays ?? halfLifeDaysForInterval(MIN_INTERVAL_DAYS);
    const totalReviews = (state?.internal.totalReviews ?? 0) + 1;

    if (rating === "again") {
      const halfLifeDays = Math.max(MIN_HALF_LIFE_DAYS, previousHalfLife * LAPSE_HALF_LIFE_DECAY);
      return { internal: { halfLifeDays, totalReviews }, dueAt: addDays(now, MIN_INTERVAL_DAYS) };
    }

    const halfLifeDays = previousHalfLife * GROWTH_FACTOR[rating];
    const intervalDays = Math.max(MIN_INTERVAL_DAYS, Math.round(intervalDaysForHalfLife(halfLifeDays)));
    return { internal: { halfLifeDays, totalReviews }, dueAt: addDays(now, intervalDays) };
  },
};
