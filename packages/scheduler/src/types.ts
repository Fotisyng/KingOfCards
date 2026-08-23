import type { Rating } from "@kingofcards/domain-shared";

/**
 * The output of any scheduler's `next()` call.
 *
 * `dueAt` is the one thing every scheduler must produce: the API/DB layer needs it for the
 * due-card query. `internal` is opaque, algorithm-specific bookkeeping the API layer never
 * inspects; it only `JSON.stringify`s it into storage and reads `dueAt` back out.
 */
export interface SchedulerState<TInternal = unknown> {
  readonly dueAt: Date;
  readonly internal: TInternal;
}

/** A spaced-repetition scheduling algorithm, keyed by a stable `id` and driven by `next()`. */
export interface Scheduler<TInternal = unknown> {
  readonly id: string;

  /**
   * Computes the next scheduling state for a card given a review rating.
   *
   * @param state - The card's current state, or `null` if it has never been reviewed.
   * @param rating - The rating given in this review.
   * @param now - The time of this review.
   * @returns The card's updated state, including its next due date.
   */
  next(state: SchedulerState<TInternal> | null, rating: Rating, now: Date): SchedulerState<TInternal>;
}
