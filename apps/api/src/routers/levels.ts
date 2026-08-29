import { z } from "zod";
import { router, verifiedProcedure } from "../trpc.js";
import { getDeckLevelStatuses, getLevelStatusesForDecks } from "./due.js";

export const levelsRouter = router({
  get: verifiedProcedure
    .input(z.object({ deckId: z.string() }))
    .query(({ ctx, input }) => getDeckLevelStatuses(ctx.db, ctx.userId, input.deckId)),

  /** Batched form of `get`, one `review_log` join total instead of one per deck. Used by StatsPage. */
  getForDecks: verifiedProcedure
    .input(z.object({ deckIds: z.array(z.string()) }))
    .query(({ ctx, input }) => getLevelStatusesForDecks(ctx.db, ctx.userId, input.deckIds)),
});
