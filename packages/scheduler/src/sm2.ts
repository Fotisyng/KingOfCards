import type { Rating } from "@kingofcards/domain-shared";
import { addDays } from "./date-math.js";
import type { Scheduler, SchedulerState } from "./types.js";

export interface Sm2Internal {
  /** Consecutive successful reviews since the last lapse (rating below "good"). */
  repetitions: number;
  /** SuperMemo's "E-Factor", multiplies the interval on each successful review; floored at {@link MIN_EASE_FACTOR}. */
  easeFactor: number;
  /** Days until the next review, as computed by the most recent call to `next()`. */
  intervalDays: number;
}

const DEFAULT_EASE_FACTOR = 2.5;
const MIN_EASE_FACTOR = 1.3;

// Standard mapping from a 4-button UI onto SuperMemo's original 0-5 quality scale.
const RATING_TO_QUALITY: Record<Rating, number> = {
  again: 0,
  hard: 3,
  good: 4,
  easy: 5,
};

/**
 * SM-2 (Wozniak, 1987).
 *
 * The ease-factor constants (0.1/0.08/0.02) are the published values, not tunable knobs: they're
 * what "SM-2" refers to.
 */
export const Sm2Scheduler: Scheduler<Sm2Internal> = {
  id: "sm2",
  next(state: SchedulerState<Sm2Internal> | null, rating: Rating, now: Date): SchedulerState<Sm2Internal> {
    const quality = RATING_TO_QUALITY[rating];
    const previous = state?.internal ?? {
      repetitions: 0,
      easeFactor: DEFAULT_EASE_FACTOR,
      intervalDays: 0,
    };

    const easeFactor = Math.max(
      MIN_EASE_FACTOR,
      previous.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)),
    );

    if (quality < 3) {
      const internal: Sm2Internal = { repetitions: 0, easeFactor, intervalDays: 1 };
      return { internal, dueAt: addDays(now, 1) };
    }

    const repetitions = previous.repetitions + 1;
    let intervalDays: number;
    if (repetitions === 1) {
      intervalDays = 1;
    } else if (repetitions === 2) {
      intervalDays = 6;
    } else {
      intervalDays = Math.round(previous.intervalDays * easeFactor);
    }

    const internal: Sm2Internal = { repetitions, easeFactor, intervalDays };
    return { internal, dueAt: addDays(now, intervalDays) };
  },
};
