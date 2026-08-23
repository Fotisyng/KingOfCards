import { HlrScheduler } from "./hlr.js";
import { Sm2Scheduler } from "./sm2.js";

export { addDays, daysBetween } from "./date-math.js";
export type { ComparisonOptions, ComparisonResult } from "./comparison/run-comparison.js";
export { runComparison } from "./comparison/run-comparison.js";
export type {
  VirtualLearnerConfig,
  VirtualLearnerState,
} from "./comparison/virtual-learner.js";
export { ratingFromRecall } from "./comparison/virtual-learner.js";
export { type HlrInternal, HlrScheduler } from "./hlr.js";
export { simulate } from "./simulate.js";
export type { SimulationStep } from "./simulate.js";
export { type Sm2Internal, Sm2Scheduler } from "./sm2.js";
export type { Scheduler, SchedulerState } from "./types.js";

/**
 * All schedulers, for tooling that needs to iterate over every implementation (e.g. the Phase 7
 * comparison harness) without hardcoding a list at each call site.
 */
export const AllSchedulers = [Sm2Scheduler, HlrScheduler] as const;
