import { describe, expect, it } from "vitest";
import { ratingFromRecall, stepVirtualLearner } from "./virtual-learner.js";

const CONFIG = { recallGrowthFactor: 2, forgetDecayFactor: 0.5, minTrueHalfLifeDays: 0.1 };

function fixedRng(value: number) {
  return () => value;
}

interface StepCase {
  name: string;
  trueHalfLifeDays: number;
  elapsedDays: number;
  rngValue: number;
  expectedRecalled: boolean;
}

const STEP_CASES: StepCase[] = [
  {
    name: "zero elapsed time means certain recall, half-life grows",
    trueHalfLifeDays: 10,
    elapsedDays: 0,
    rngValue: 0.999,
    expectedRecalled: true,
  },
  {
    name: "a draw below the 50% mark at t=halfLife recalls",
    trueHalfLifeDays: 10,
    elapsedDays: 10,
    rngValue: 0.3,
    expectedRecalled: true,
  },
  {
    name: "a draw above the 50% mark at t=halfLife forgets, half-life decays",
    trueHalfLifeDays: 10,
    elapsedDays: 10,
    rngValue: 0.7,
    expectedRecalled: false,
  },
];

describe("stepVirtualLearner", () => {
  it.each(STEP_CASES)("$name", ({ trueHalfLifeDays, elapsedDays, rngValue, expectedRecalled }) => {
    const result = stepVirtualLearner({ trueHalfLifeDays }, elapsedDays, fixedRng(rngValue), CONFIG);

    // Computed via the same formula the implementation uses, so this is an exact (not
    // approximate) check: both sides run the identical floating-point expression.
    const recallProbability = 2 ** (-elapsedDays / trueHalfLifeDays);
    const growthFactor = expectedRecalled ? CONFIG.recallGrowthFactor : CONFIG.forgetDecayFactor;

    expect(result).toEqual({
      recalled: expectedRecalled,
      recallProbability,
      nextState: { trueHalfLifeDays: trueHalfLifeDays * growthFactor },
    });
  });

  it("floors the half-life instead of letting a forgotten review collapse it", () => {
    const result = stepVirtualLearner({ trueHalfLifeDays: 0.11 }, 1, fixedRng(0.999), CONFIG);
    expect(result.nextState).toEqual({ trueHalfLifeDays: CONFIG.minTrueHalfLifeDays });
  });
});

interface RatingCase {
  name: string;
  recalled: boolean;
  recallProbability: number;
  expected: string;
}

const RATING_CASES: RatingCase[] = [
  { name: "not recalled -> again", recalled: false, recallProbability: 0.01, expected: "again" },
  {
    name: "recalled comfortably (>0.95) -> easy",
    recalled: true,
    recallProbability: 0.99,
    expected: "easy",
  },
  {
    name: "recalled solidly (>0.7) -> good",
    recalled: true,
    recallProbability: 0.8,
    expected: "good",
  },
  {
    name: "recalled narrowly (<=0.7) -> hard",
    recalled: true,
    recallProbability: 0.5,
    expected: "hard",
  },
];

describe("ratingFromRecall", () => {
  it.each(RATING_CASES)("$name", ({ recalled, recallProbability, expected }) => {
    expect(ratingFromRecall(recalled, recallProbability)).toBe(expected);
  });
});
