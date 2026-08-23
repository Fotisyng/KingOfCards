import { Sm2Scheduler } from "@kingofcards/scheduler";
import type { Client } from "@libsql/client";
import { z } from "zod";
import { type LevelStatus, computeLevelStatuses, unlockedCardIds } from "../levels.js";
import * as cardsRepo from "../repositories/cards.js";
import * as dueRepo from "../repositories/due.js";
import * as reviewLogRepo from "../repositories/reviewLog.js";
import { router, verifiedProcedure } from "../trpc.js";

export const ALGORITHM = Sm2Scheduler.id;

/** Computes one deck's level statuses for the caller, shared by `due.list` and `levels.get`. */
export async function getDeckLevelStatuses(db: Client, userId: string, deckId: string): Promise<LevelStatus[]> {
  const orderedCards = await cardsRepo.listCardsByDeck(db, userId, deckId);
  const cardIds = orderedCards.map((card) => card.id);
  const qualifying = await reviewLogRepo.getQualifyingCardIds(db, userId, cardIds);
  return computeLevelStatuses(cardIds, qualifying);
}

export const dueRouter = router({
  /**
   * Lists due cards, with brand-new cards additionally gated by level progression.
   *
   * Level gating only ever hides brand-new cards, never already-introduced ones;
   * each deck's unlocked set is computed once, then used to filter without disturbing the query's
   * own new-cards-first ordering.
   */
  list: verifiedProcedure
    .input(z.object({ deckId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const candidates = await dueRepo.listDueCards(ctx.db, ctx.userId, ALGORITHM, new Date(), input?.deckId);

      const newCardDeckIds = [...new Set(candidates.filter((c) => c.isNew).map((c) => c.deckId))];
      const unlockedByDeck = new Map<string, Set<string>>();
      for (const deckId of newCardDeckIds) {
        unlockedByDeck.set(deckId, unlockedCardIds(await getDeckLevelStatuses(ctx.db, ctx.userId, deckId)));
      }

      return candidates
        .filter((c) => !c.isNew || unlockedByDeck.get(c.deckId)?.has(c.id))
        .map(({ isNew, ...card }) => card);
    }),
});
