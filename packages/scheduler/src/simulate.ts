import type { Rating } from "@kingofcards/domain-shared";
import type { Scheduler, SchedulerState } from "./types.js";

export interface SimulationStep<TInternal> {
  reviewedAt: Date;
  rating: Rating;
  state: SchedulerState<TInternal>;
}

/**
 * Replays a rating sequence through a scheduler, advancing the simulated clock to each step's
 * computed due date.
 *
 * This models "reviewed exactly on schedule" behavior, an idealized clock. The virtual-learner
 * comparison (Phase 7) uses a less idealized clock; this is the simple, deterministic baseline.
 *
 * @param scheduler - The scheduler to replay ratings through.
 * @param ratings - The sequence of ratings to apply, one per review.
 * @param startAt - The simulated time of the first review.
 * @returns One step per rating, in order, each capturing the state after that review.
 */
export function simulate<TInternal>(
  scheduler: Scheduler<TInternal>,
  ratings: readonly Rating[],
  startAt: Date = new Date(),
): SimulationStep<TInternal>[] {
  const steps: SimulationStep<TInternal>[] = [];
  let state: SchedulerState<TInternal> | null = null;
  let now = startAt;

  for (const rating of ratings) {
    state = scheduler.next(state, rating, now);
    steps.push({ reviewedAt: now, rating, state });
    now = state.dueAt;
  }

  return steps;
}
