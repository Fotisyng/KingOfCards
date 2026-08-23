import type { Rating } from "@kingofcards/domain-shared";
import { describe, expect, it } from "vitest";
import { addDays } from "./date-math.js";
import { simulate } from "./simulate.js";
import { Sm2Scheduler } from "./sm2.js";

const START = new Date(2024, 0, 1);

interface ExpectedStep {
  dayOffset: number; // cumulative days from START, reads more directly than nested addDays().
  repetitions: number;
  easeFactor: number;
  intervalDays: number;
}

interface Sm2ScenarioCase {
  name: string;
  ratings: Rating[];
  expectedSteps: ExpectedStep[];
}

const SM2_SCENARIOS: Sm2ScenarioCase[] = [
  {
    name: "first review 'good' schedules 1 day out, ease factor unchanged",
    ratings: ["good"],
    expectedSteps: [{ dayOffset: 1, repetitions: 1, easeFactor: 2.5, intervalDays: 1 }],
  },
  {
    name: "first review 'easy' increases the ease factor",
    ratings: ["easy"],
    expectedSteps: [{ dayOffset: 1, repetitions: 1, easeFactor: 2.6, intervalDays: 1 }],
  },
  {
    name: "first review 'hard' decreases the ease factor",
    ratings: ["hard"],
    expectedSteps: [{ dayOffset: 1, repetitions: 1, easeFactor: 2.36, intervalDays: 1 }],
  },
  {
    name: "second consecutive 'good' graduates to a 6-day interval",
    ratings: ["good", "good"],
    expectedSteps: [
      { dayOffset: 1, repetitions: 1, easeFactor: 2.5, intervalDays: 1 },
      { dayOffset: 7, repetitions: 2, easeFactor: 2.5, intervalDays: 6 },
    ],
  },
  {
    name: "third consecutive 'good' grows the interval by the ease factor, rounded",
    ratings: ["good", "good", "good"],
    expectedSteps: [
      { dayOffset: 1, repetitions: 1, easeFactor: 2.5, intervalDays: 1 },
      { dayOffset: 7, repetitions: 2, easeFactor: 2.5, intervalDays: 6 },
      { dayOffset: 22, repetitions: 3, easeFactor: 2.5, intervalDays: 15 },
    ],
  },
  {
    name: "rounds a non-integer projected interval ('hard' then two 'good's)",
    ratings: ["hard", "good", "good"],
    expectedSteps: [
      { dayOffset: 1, repetitions: 1, easeFactor: 2.36, intervalDays: 1 },
      { dayOffset: 7, repetitions: 2, easeFactor: 2.36, intervalDays: 6 },
      { dayOffset: 21, repetitions: 3, easeFactor: 2.36, intervalDays: 14 },
    ],
  },
  {
    name: "a lapse resets repetitions/interval to 1 day but still updates the ease factor",
    ratings: ["good", "good", "again"],
    expectedSteps: [
      { dayOffset: 1, repetitions: 1, easeFactor: 2.5, intervalDays: 1 },
      { dayOffset: 7, repetitions: 2, easeFactor: 2.5, intervalDays: 6 },
      { dayOffset: 8, repetitions: 0, easeFactor: 1.7, intervalDays: 1 },
    ],
  },
  {
    name: "graduation restarts (1 day, then 6 days) after recovering from a lapse",
    ratings: ["good", "good", "again", "good", "good"],
    expectedSteps: [
      { dayOffset: 1, repetitions: 1, easeFactor: 2.5, intervalDays: 1 },
      { dayOffset: 7, repetitions: 2, easeFactor: 2.5, intervalDays: 6 },
      { dayOffset: 8, repetitions: 0, easeFactor: 1.7, intervalDays: 1 },
      { dayOffset: 9, repetitions: 1, easeFactor: 1.7, intervalDays: 1 },
      { dayOffset: 15, repetitions: 2, easeFactor: 1.7, intervalDays: 6 },
    ],
  },
];

describe("Sm2Scheduler", () => {
  it.each(SM2_SCENARIOS)("$name", ({ ratings, expectedSteps }) => {
    const steps = simulate(Sm2Scheduler, ratings, START);

    expect(steps.map((step) => step.state)).toEqual(
      expectedSteps.map(({ dayOffset, easeFactor, ...internal }) => ({
        internal: { ...internal, easeFactor: expect.closeTo(easeFactor, 5) },
        dueAt: addDays(START, dayOffset),
      })),
    );
  });

  it("floors the ease factor at 1.3 and never lets it go lower", () => {
    const steps = simulate(Sm2Scheduler, Array(10).fill("again"), START);

    expect(steps.at(-1)?.state).toEqual({
      internal: { repetitions: 0, easeFactor: expect.closeTo(1.3, 5), intervalDays: 1 },
      dueAt: addDays(START, 10),
    });
  });

  it("keeps growing the interval off the floored ease factor once passing ratings floor it", () => {
    const steps = simulate(Sm2Scheduler, Array(10).fill("hard"), START);

    expect(steps.at(-2)?.state).toEqual({
      internal: { repetitions: 9, easeFactor: expect.closeTo(1.3, 5), intervalDays: 185 },
      dueAt: addDays(START, 581),
    });
    expect(steps.at(-1)?.state).toEqual({
      internal: { repetitions: 10, easeFactor: expect.closeTo(1.3, 5), intervalDays: 241 },
      dueAt: addDays(START, 822),
    });
  });
});
