// Pure so it's cheap to unit-test independent of the DB.
export const CARDS_PER_LEVEL = 5;

export type LevelStatusValue = "cleared" | "current" | "locked";

export interface LevelStatus {
  level: number;
  cardIds: string[];
  status: LevelStatusValue;
}

/**
 * Groups a deck's cards into levels and assigns each level's status.
 *
 * Levels are derived from card order (chunks of `CARDS_PER_LEVEL`), not stored: a level is
 * "cleared" once every card qualifies, the first incomplete one is "current", the rest are
 * "locked".
 */
export function computeLevelStatuses(
  orderedCardIds: readonly string[],
  qualifyingCardIds: ReadonlySet<string>,
): LevelStatus[] {
  const statuses: LevelStatus[] = [];
  let frontierReached = false;

  for (let i = 0; i < orderedCardIds.length; i += CARDS_PER_LEVEL) {
    const cardIds = orderedCardIds.slice(i, i + CARDS_PER_LEVEL);
    const level = statuses.length + 1;

    if (frontierReached) {
      statuses.push({ level, cardIds, status: "locked" });
      continue;
    }

    const cleared = cardIds.every((id) => qualifyingCardIds.has(id));
    if (cleared) {
      statuses.push({ level, cardIds, status: "cleared" });
    } else {
      statuses.push({ level, cardIds, status: "current" });
      frontierReached = true;
    }
  }

  return statuses;
}

/** Flattens every non-"locked" level's card ids into one set, for due-card filtering. */
export function unlockedCardIds(statuses: readonly LevelStatus[]): Set<string> {
  const ids = new Set<string>();
  for (const level of statuses) {
    if (level.status !== "locked") {
      for (const id of level.cardIds) {
        ids.add(id);
      }
    }
  }
  return ids;
}
