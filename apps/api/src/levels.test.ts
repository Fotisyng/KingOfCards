import { describe, expect, it } from "vitest";
import { CARDS_PER_LEVEL, computeLevelStatuses, unlockedCardIds } from "./levels.js";

function ids(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `c${i + 1}`);
}

describe("computeLevelStatuses", () => {
  const CASES = [
    {
      name: "an empty deck has no levels",
      cardIds: [] as string[],
      qualifying: new Set<string>(),
      expected: [],
    },
    {
      name: "a partial first level with nothing qualifying yet is current",
      cardIds: ids(3),
      qualifying: new Set<string>(),
      expected: [{ level: 1, cardIds: ids(3), status: "current" }],
    },
    {
      name: "a full first level fully cleared unlocks a partial second level",
      cardIds: ids(CARDS_PER_LEVEL + 1),
      qualifying: new Set(ids(CARDS_PER_LEVEL)),
      expected: [
        { level: 1, cardIds: ids(CARDS_PER_LEVEL), status: "cleared" },
        { level: 2, cardIds: ids(CARDS_PER_LEVEL + 1).slice(CARDS_PER_LEVEL), status: "current" },
      ],
    },
    {
      name: "a third level stays locked behind an untouched second level",
      cardIds: ids(CARDS_PER_LEVEL * 3),
      qualifying: new Set(ids(CARDS_PER_LEVEL)),
      expected: [
        { level: 1, cardIds: ids(CARDS_PER_LEVEL), status: "cleared" },
        {
          level: 2,
          cardIds: ids(CARDS_PER_LEVEL * 2).slice(CARDS_PER_LEVEL),
          status: "current",
        },
        {
          level: 3,
          cardIds: ids(CARDS_PER_LEVEL * 3).slice(CARDS_PER_LEVEL * 2),
          status: "locked",
        },
      ],
    },
    {
      name: "every level cleared leaves nothing current or locked",
      cardIds: ids(CARDS_PER_LEVEL * 2),
      qualifying: new Set(ids(CARDS_PER_LEVEL * 2)),
      expected: [
        { level: 1, cardIds: ids(CARDS_PER_LEVEL), status: "cleared" },
        { level: 2, cardIds: ids(CARDS_PER_LEVEL * 2).slice(CARDS_PER_LEVEL), status: "cleared" },
      ],
    },
  ];

  it.each(CASES)("$name", ({ cardIds, qualifying, expected }) => {
    expect(computeLevelStatuses(cardIds, qualifying)).toEqual(expected);
  });
});

describe("unlockedCardIds", () => {
  it("includes cleared and current levels' cards, excludes locked levels'", () => {
    const statuses = computeLevelStatuses(ids(CARDS_PER_LEVEL * 3), new Set(ids(CARDS_PER_LEVEL)));
    expect(unlockedCardIds(statuses)).toEqual(new Set(ids(CARDS_PER_LEVEL * 2)));
  });
});
