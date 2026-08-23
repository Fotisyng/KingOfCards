import type { Rating } from "@kingofcards/domain-shared";

export interface VirtualLearnerConfig {
  recallGrowthFactor: number;
  forgetDecayFactor: number;
  minTrueHalfLifeDays: number;
}

export interface VirtualLearnerState {
  trueHalfLifeDays: number;
}

export interface VirtualLearnerStep {
  recalled: boolean;
  recallProbability: number;
  nextState: VirtualLearnerState;
}

const EASY_RECALL_THRESHOLD = 0.95;
const GOOD_RECALL_THRESHOLD = 0.7;

/**
 * Maps how comfortably the learner recalled (or didn't) onto the 4-button rating scale.
 *
 * Gives both schedulers under test the same kind of signal a real reviewer would give.
 */
export function ratingFromRecall(recalled: boolean, recallProbability: number): Rating {
  if (!recalled) {
    return "again";
  }
  if (recallProbability > EASY_RECALL_THRESHOLD) {
    return "easy";
  }
  if (recallProbability > GOOD_RECALL_THRESHOLD) {
    return "good";
  }
  return "hard";
}

/**
 * Advances the simulated learner's true recall state by one review.
 *
 * The ground truth a scheduler is scored against, never something it can see directly. Forgetting
 * follows the same exponential-decay premise `HlrScheduler` models (`2^(-t/halfLife)`), but this
 * true half-life evolves independently of whichever scheduler is under test.
 */
export function stepVirtualLearner(
  state: VirtualLearnerState,
  elapsedDays: number,
  rng: () => number,
  config: VirtualLearnerConfig,
): VirtualLearnerStep {
  const recallProbability = 2 ** (-elapsedDays / state.trueHalfLifeDays);
  const recalled = rng() < recallProbability;
  const trueHalfLifeDays = Math.max(
    config.minTrueHalfLifeDays,
    state.trueHalfLifeDays * (recalled ? config.recallGrowthFactor : config.forgetDecayFactor),
  );
  return { recalled, recallProbability, nextState: { trueHalfLifeDays } };
}
