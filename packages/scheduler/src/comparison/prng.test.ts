import { describe, expect, it } from "vitest";
import { createRng } from "./prng.js";

function draw(seed: number, count: number): number[] {
  const rng = createRng(seed);
  return Array.from({ length: count }, () => rng());
}

describe("createRng", () => {
  it("produces the same sequence for the same seed", () => {
    expect(draw(42, 5)).toEqual(draw(42, 5));
  });

  it("produces a different sequence for a different seed", () => {
    expect(draw(1, 5)).not.toEqual(draw(2, 5));
  });

  it("always returns values in [0, 1)", () => {
    const values = draw(7, 1000);
    expect(values.every((value) => value >= 0 && value < 1)).toBe(true);
  });
});
