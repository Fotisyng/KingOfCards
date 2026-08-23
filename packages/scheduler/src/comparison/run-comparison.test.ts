import { describe, expect, it } from "vitest";
import type { Scheduler } from "../types.js";
import { runComparison } from "./run-comparison.js";

// A scheduler that always waits exactly 1 day, regardless of rating: makes review counts fully
// predictable (independent of the RNG) so the aggregation math itself can be checked precisely.
const alwaysOneDayScheduler: Scheduler<null> = {
  id: "always-one-day",
  next(_state, _rating, now) {
    const dueAt = new Date(now);
    dueAt.setDate(dueAt.getDate() + 1);
    return { internal: null, dueAt };
  },
};

const LEARNER_CONFIG = { recallGrowthFactor: 2, forgetDecayFactor: 0.5, minTrueHalfLifeDays: 0.1 };

const BASE_OPTIONS = {
  cardCount: 3,
  horizonDays: 10,
  seed: 1,
  initialTrueHalfLifeDays: 5,
  learnerConfig: LEARNER_CONFIG,
};

describe("runComparison", () => {
  it("reviews exactly once per day over the horizon and aggregates retention from actual outcomes", () => {
    const result = runComparison(alwaysOneDayScheduler, BASE_OPTIONS);

    // empiricalRetention is the genuine output of this seed/config, not a placeholder: it's
    // deterministic given the seed, which the second test below verifies.
    expect(result).toEqual({
      schedulerId: "always-one-day",
      cardCount: 3,
      totalReviews: 30,
      averageReviewsPerCard: 10,
      empiricalRetention: 0.8,
    });
  });

  it("is deterministic for a given seed, and total reviews scale with card count independent of the RNG", () => {
    const first = runComparison(alwaysOneDayScheduler, BASE_OPTIONS);
    const repeat = runComparison(alwaysOneDayScheduler, BASE_OPTIONS);
    expect(repeat).toEqual(first);

    // This stub's review cadence never depends on the rating (or therefore the RNG outcome), so
    // doubling cardCount must exactly double totalReviews regardless of seed.
    const doubledCards = runComparison(alwaysOneDayScheduler, { ...BASE_OPTIONS, cardCount: 6 });
    expect(doubledCards.totalReviews).toBe(first.totalReviews * 2);
    expect(doubledCards.averageReviewsPerCard).toBe(first.averageReviewsPerCard);
  });
});
