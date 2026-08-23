import { CreateCardInputSchema, UpdateCardInputSchema } from "@kingofcards/domain-shared";
import { z } from "zod";
import { notFoundError } from "../errors.js";
import { checkRateLimit } from "../rateLimiter.js";
import { RATE_LIMIT } from "../rateLimits.js";
import * as cardsRepo from "../repositories/cards.js";
import * as decksRepo from "../repositories/decks.js";
import { router, verifiedProcedure } from "../trpc.js";

export const cardsRouter = router({
  /** Cursor-paginated, bounded to a fixed page size so a large deck doesn't come back in one response. */
  listByDeck: verifiedProcedure
    .input(z.object({ deckId: z.string(), cursor: z.string().optional() }))
    .query(({ ctx, input }) => cardsRepo.listCardsByDeckPage(ctx.db, ctx.userId, input.deckId, input.cursor)),

  /** Rate limit is higher than deck-create: manual card entry can legitimately run to hundreds/session. */
  create: verifiedProcedure.input(CreateCardInputSchema).mutation(async ({ ctx, input }) => {
    await checkRateLimit(ctx.db, RATE_LIMIT.cardCreate(ctx.userId));

    const owned = await decksRepo.isDeckOwner(ctx.db, input.deckId, ctx.userId);
    if (!owned) throw notFoundError("Deck", input.deckId);
    return cardsRepo.createCard(ctx.db, input);
  }),

  /** Updates a card's content; throws `NOT_FOUND` if it isn't the caller's. */
  update: verifiedProcedure.input(UpdateCardInputSchema).mutation(async ({ ctx, input }) => {
    await checkRateLimit(ctx.db, RATE_LIMIT.cardUpdate(ctx.userId));

    const updated = await cardsRepo.updateCard(ctx.db, input.cardId, ctx.userId, {
      frontMd: input.frontMd,
      backMd: input.backMd,
    });
    if (!updated) throw notFoundError("Card", input.cardId);
    return updated;
  }),

  /** Deletes a card; throws `NOT_FOUND` if it isn't the caller's. */
  delete: verifiedProcedure.input(z.object({ cardId: z.string() })).mutation(async ({ ctx, input }) => {
    await checkRateLimit(ctx.db, RATE_LIMIT.cardDelete(ctx.userId));

    const deleted = await cardsRepo.deleteCard(ctx.db, input.cardId, ctx.userId);
    if (!deleted) throw notFoundError("Card", input.cardId);
    return { ok: true as const };
  }),
});
