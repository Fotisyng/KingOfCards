import { describe, expect, it } from "vitest";
import { computeStreak } from "./stats.js";

interface StreakCase {
  name: string;
  reviewDays: string[];
  today: string;
  expected: number;
}

const STREAK_CASES: StreakCase[] = [
  {
    name: "counts consecutive days ending today",
    reviewDays: ["2024-01-03", "2024-01-02", "2024-01-01"],
    today: "2024-01-03",
    expected: 3,
  },
  {
    name: "still counts yesterday's streak if today has no review yet",
    reviewDays: ["2024-01-02", "2024-01-01"],
    today: "2024-01-03",
    expected: 2,
  },
  {
    name: "resets to 0 once there's a gap before today",
    reviewDays: ["2024-01-01"],
    today: "2024-01-03",
    expected: 0,
  },
  { name: "returns 0 for no review history", reviewDays: [], today: "2024-01-03", expected: 0 },
];

describe("computeStreak", () => {
  it.each(STREAK_CASES)("$name", ({ reviewDays, today, expected }) => {
    expect(computeStreak(reviewDays, today)).toBe(expected);
  });
});
