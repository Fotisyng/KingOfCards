import { addDays, daysBetween } from "../date-math.js";
import type { Scheduler, SchedulerState } from "../types.js";
import { createRng } from "./prng.js";
import { ratingFromRecall, stepVirtualLearner, type VirtualLearnerConfig } from "./virtual-learner.js";

export interface ComparisonOptions {
  cardCount: number;
  horizonDays: number;
  seed: number;
  initialTrueHalfLifeDays: number;
  learnerConfig: VirtualLearnerConfig;
}

export interface ComparisonResult {
  schedulerId: string;
  cardCount: number;
  totalReviews: number;
  averageReviewsPerCard: number;
  empiricalRetention: number;
}

const START_AT = new Date(2024, 0, 1);

/** Simulates one virtual learner's cards under `scheduler` until `options.horizonDays` elapses. */
function runOneCard(
  scheduler: Scheduler<unknown>,
  rng: () => number,
  options: Pick<ComparisonOptions, "horizonDays" | "initialTrueHalfLifeDays" | "learnerConfig">,
): { reviews: number; successes: number } {
  const horizonEnd = addDays(START_AT, options.horizonDays);

  let schedulerState: SchedulerState<unknown> | null = null;
  let learner = { trueHalfLifeDays: options.initialTrueHalfLifeDays };
  let now = START_AT;
  let lastReviewedAt: Date | null = null;
  let reviews = 0;
  let successes = 0;

  while (now.getTime() < horizonEnd.getTime()) {
    // A brand-new card hasn't decayed from a prior review; model first exposure as elapsed time
    // equal to one initial half-life, i.e. a coin-flip (p=0.5) rather than the certain recall
    // elapsedDays=0 would produce.
    const elapsedDays = lastReviewedAt ? daysBetween(lastReviewedAt, now) : options.initialTrueHalfLifeDays;
    const learnerStep = stepVirtualLearner(learner, elapsedDays, rng, options.learnerConfig);

    reviews += 1;
    if (learnerStep.recalled) {
      successes += 1;
    }
    learner = learnerStep.nextState;

    const rating = ratingFromRecall(learnerStep.recalled, learnerStep.recallProbability);
    schedulerState = scheduler.next(schedulerState, rating, now);
    lastReviewedAt = now;
    now = schedulerState.dueAt;
  }

  return { reviews, successes };
}

/**
 * Simulates `options.cardCount` virtual learners under `scheduler` and aggregates the results.
 *
 * Each card gets its own rng stream (seeded from `options.seed + cardIndex`) so two schedulers
 * reviewing the same card a different number of times can't desync every card after it.
 */
export function runComparison(scheduler: Scheduler<unknown>, options: ComparisonOptions): ComparisonResult {
  let totalReviews = 0;
  let totalSuccesses = 0;

  for (let cardIndex = 0; cardIndex < options.cardCount; cardIndex++) {
    const rng = createRng(options.seed + cardIndex);
    const { reviews, successes } = runOneCard(scheduler, rng, options);
    totalReviews += reviews;
    totalSuccesses += successes;
  }

  return {
    schedulerId: scheduler.id,
    cardCount: options.cardCount,
    totalReviews,
    averageReviewsPerCard: totalReviews / options.cardCount,
    empiricalRetention: totalReviews === 0 ? 0 : totalSuccesses / totalReviews,
  };
}
