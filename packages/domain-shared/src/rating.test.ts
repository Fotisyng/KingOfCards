import { describe, expect, it } from "vitest";
import { RatingSchema } from "./rating.js";

interface RatingCase {
  name: string;
  value: unknown;
  expected: { success: true; data: string } | { success: false };
}

const RATING_CASES: RatingCase[] = [
  { name: "accepts 'again'", value: "again", expected: { success: true, data: "again" } },
  { name: "accepts 'hard'", value: "hard", expected: { success: true, data: "hard" } },
  { name: "accepts 'good'", value: "good", expected: { success: true, data: "good" } },
  { name: "accepts 'easy'", value: "easy", expected: { success: true, data: "easy" } },
  {
    name: "rejects the original SM-2 numeric quality scale",
    value: 3,
    expected: { success: false },
  },
  { name: "rejects an unrecognized string", value: "perfect", expected: { success: false } },
];

describe("RatingSchema", () => {
  it.each(RATING_CASES)("$name", ({ value, expected }) => {
    const result = RatingSchema.safeParse(value);
    if (expected.success) {
      expect(result).toEqual({ success: true, data: expected.data });
    } else {
      expect(result.success).toBe(false);
    }
  });
});
