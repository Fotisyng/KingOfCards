import { CreateDeckInputSchema } from "@kingofcards/domain-shared";
import { z } from "zod";
import { notFoundError } from "../errors.js";
import { checkRateLimit } from "../rateLimiter.js";
import { RATE_LIMIT } from "../rateLimits.js";
import * as decksRepo from "../repositories/decks.js";
import { router, verifiedProcedure } from "../trpc.js";

const PREVIEW_CARD_LIMIT = 3;

export const decksRouter = router({
  list: verifiedProcedure.query(({ ctx }) => decksRepo.listDecks(ctx.db, ctx.userId)),

  /** Rate-limited as runaway-script insurance (same reasoning as `clone` below), not brute-force protection. */
  create: verifiedProcedure.input(CreateDeckInputSchema).mutation(async ({ ctx, input }) => {
    await checkRateLimit(ctx.db, RATE_LIMIT.deckCreate(ctx.userId));
    return decksRepo.createDeck(ctx.db, ctx.userId, input);
  }),

  /** Cursor-paginated, bounded to a fixed page size since community decks span every account. */
  listPublic: verifiedProcedure
    .input(z.object({ cursor: z.string().optional() }).optional())
    .query(({ ctx, input }) => decksRepo.listPublicDecks(ctx.db, ctx.userId, input?.cursor)),

  previewCards: verifiedProcedure
    .input(z.object({ deckId: z.string() }))
    .query(({ ctx, input }) => decksRepo.getPreviewCards(ctx.db, input.deckId, PREVIEW_CARD_LIMIT)),

  /** Toggles a deck's public/private flag; throws `NOT_FOUND` if it isn't the caller's. */
  setPublic: verifiedProcedure
    .input(z.object({ deckId: z.string(), isPublic: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const updated = await decksRepo.setPublic(ctx.db, input.deckId, ctx.userId, input.isPublic);
      if (!updated) throw notFoundError("Deck", input.deckId);
      return { ok: true as const };
    }),

  /**
   * Clones a public deck into the caller's own account.
   *
   * Not brute-forceable like the pre-auth signup/login endpoints, but a large public deck (HSK 6
   * is 2,500 cards) is still an expensive copy per request: the rate limit is cheap insurance
   * against a runaway script rather than a real abuse concern.
   */
  clone: verifiedProcedure.input(z.object({ deckId: z.string() })).mutation(async ({ ctx, input }) => {
    await checkRateLimit(ctx.db, RATE_LIMIT.deckClone(ctx.userId));

    const cloned = await decksRepo.cloneDeck(ctx.db, input.deckId, ctx.userId);
    if (!cloned) throw notFoundError("Deck", input.deckId);
    return cloned;
  }),

  /** Deletes a deck (and its cards); throws `NOT_FOUND` if it isn't the caller's. */
  delete: verifiedProcedure.input(z.object({ deckId: z.string() })).mutation(async ({ ctx, input }) => {
    await checkRateLimit(ctx.db, RATE_LIMIT.deckDelete(ctx.userId));

    const deleted = await decksRepo.deleteDeck(ctx.db, input.deckId, ctx.userId);
    if (!deleted) throw notFoundError("Deck", input.deckId);
    return { ok: true as const };
  }),
});
