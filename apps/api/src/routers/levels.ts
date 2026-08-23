import { z } from "zod";
import { router, verifiedProcedure } from "../trpc.js";
import { getDeckLevelStatuses } from "./due.js";

export const levelsRouter = router({
  get: verifiedProcedure
    .input(z.object({ deckId: z.string() }))
    .query(({ ctx, input }) => getDeckLevelStatuses(ctx.db, ctx.userId, input.deckId)),
});
