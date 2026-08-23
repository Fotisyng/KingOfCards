import type { Rating } from "@kingofcards/domain-shared";
import { describe, expect, it } from "vitest";
import { addDays } from "./date-math.js";
import { HlrScheduler } from "./hlr.js";
import { simulate } from "./simulate.js";

const START = new Date(2024, 0, 1);

interface ExpectedStep {
  dayOffset: number; // cumulative days from START
  halfLifeDays: number;
  totalReviews: number;
}

interface HlrScenarioCase {
  name: string;
  ratings: Rating[];
  expectedSteps: ExpectedStep[];
}

const HLR_SCENARIOS: HlrScenarioCase[] = [
  {
    name: "first review 'again' floors the interval at 1 day and shrinks the half-life",
    ratings: ["again"],
    expectedSteps: [{ dayOffset: 1, halfLifeDays: 3.2894067394802904, totalReviews: 1 }],
  },
  {
    name: "first review 'hard' schedules 2 days out",
    ratings: ["hard"],
    expectedSteps: [{ dayOffset: 2, halfLifeDays: 10.52610156633693, totalReviews: 1 }],
  },
  {
    name: "first review 'good' schedules 3 days out",
    ratings: ["good"],
    expectedSteps: [{ dayOffset: 3, halfLifeDays: 18.420677741089627, totalReviews: 1 }],
  },
  {
    name: "first review 'easy' schedules 4 days out",
    ratings: ["easy"],
    expectedSteps: [{ dayOffset: 4, halfLifeDays: 28.946779307426556, totalReviews: 1 }],
  },
  {
    name: "consecutive 'good's compound the half-life, growing the interval each time",
    ratings: ["good", "good", "good"],
    expectedSteps: [
      { dayOffset: 3, halfLifeDays: 18.420677741089627, totalReviews: 1 },
      { dayOffset: 11, halfLifeDays: 51.57789767505095, totalReviews: 2 },
      { dayOffset: 33, halfLifeDays: 144.41811349014264, totalReviews: 3 },
    ],
  },
  {
    name: "a lapse floors the interval at 1 day and halves the half-life, but keeps counting reviews",
    ratings: ["good", "good", "again"],
    expectedSteps: [
      { dayOffset: 3, halfLifeDays: 18.420677741089627, totalReviews: 1 },
      { dayOffset: 11, halfLifeDays: 51.57789767505095, totalReviews: 2 },
      { dayOffset: 12, halfLifeDays: 25.788948837525474, totalReviews: 3 },
    ],
  },
  {
    name: "half-life growth resumes (compounding from the post-lapse value) after recovering",
    ratings: ["good", "good", "again", "good", "good"],
    expectedSteps: [
      { dayOffset: 3, halfLifeDays: 18.420677741089627, totalReviews: 1 },
      { dayOffset: 11, halfLifeDays: 51.57789767505095, totalReviews: 2 },
      { dayOffset: 12, halfLifeDays: 25.788948837525474, totalReviews: 3 },
      { dayOffset: 23, halfLifeDays: 72.20905674507132, totalReviews: 4 },
      { dayOffset: 54, halfLifeDays: 202.18535888619968, totalReviews: 5 },
    ],
  },
];

describe("HlrScheduler", () => {
  it.each(HLR_SCENARIOS)("$name", ({ ratings, expectedSteps }) => {
    const steps = simulate(HlrScheduler, ratings, START);

    expect(steps.map((step) => step.state)).toEqual(
      expectedSteps.map(({ dayOffset, halfLifeDays, totalReviews }) => ({
        internal: { halfLifeDays: expect.closeTo(halfLifeDays, 5), totalReviews },
        dueAt: addDays(START, dayOffset),
      })),
    );
  });

  it("floors the half-life at 0.1 days and never lets it go lower, even after many lapses", () => {
    const steps = simulate(HlrScheduler, Array(20).fill("again"), START);

    expect(steps.at(-1)?.state).toEqual({
      internal: { halfLifeDays: 0.1, totalReviews: 20 },
      dueAt: addDays(START, 20),
    });
  });

  it("floors the interval at 1 day for a passing rating too, once many lapses shrank the half-life", () => {
    const steps = simulate(HlrScheduler, [...Array(20).fill("again"), "hard"], START);

    expect(steps.at(-1)?.state).toEqual({
      internal: { halfLifeDays: expect.closeTo(0.16, 5), totalReviews: 21 },
      dueAt: addDays(START, 21),
    });
  });
});
