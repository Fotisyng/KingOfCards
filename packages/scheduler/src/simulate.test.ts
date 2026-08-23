import { describe, expect, it } from "vitest";
import { addDays } from "./date-math.js";
import { simulate } from "./simulate.js";
import type { Scheduler } from "./types.js";

const START = new Date(2024, 0, 1);

// A minimal, deterministic stand-in scheduler: isolates simulate()'s own contract (clock
// chaining, step ordering) from any real scheduler's math.
interface StubInternal {
  callCount: number;
}

const stubScheduler: Scheduler<StubInternal> = {
  id: "stub",
  next(state, rating, now) {
    const callCount = (state?.internal.callCount ?? 0) + 1;
    const intervalDays = rating === "again" ? 1 : callCount;
    return { internal: { callCount }, dueAt: addDays(now, intervalDays) };
  },
};

describe("simulate", () => {
  it("chains each review's clock to the previous step's due date and returns one step per rating", () => {
    const steps = simulate(stubScheduler, ["good", "good", "again"], START);

    expect(steps).toEqual([
      {
        reviewedAt: START,
        rating: "good",
        state: { internal: { callCount: 1 }, dueAt: addDays(START, 1) },
      },
      {
        reviewedAt: addDays(START, 1),
        rating: "good",
        state: { internal: { callCount: 2 }, dueAt: addDays(START, 3) },
      },
      {
        reviewedAt: addDays(START, 3),
        rating: "again",
        state: { internal: { callCount: 3 }, dueAt: addDays(START, 4) },
      },
    ]);
  });
});
