import { SubmitReviewInputSchema } from "@kingofcards/domain-shared";
import { Sm2Scheduler, daysBetween } from "@kingofcards/scheduler";
import { notFoundError } from "../errors.js";
import * as cardsRepo from "../repositories/cards.js";
import * as decksRepo from "../repositories/decks.js";
import * as schedulerRepo from "../repositories/scheduler-state.js";
import { router, verifiedProcedure } from "../trpc.js";
import { ALGORITHM } from "./due.js";

export const reviewsRouter = router({
  /**
   * Records a rating and advances the card's scheduler state; throws `NOT_FOUND` if not the caller's card.
   *
   * `input.ratedAt`, when present, is when the offline queue captured the rating rather than when
   * this request happened to reach the server; used for both scheduling and `review_log.rated_at`
   * so a flush replaying a backlog doesn't corrupt due dates, streaks, or activity-trend stats for
   * the day the review actually happened.
   */
  submit: verifiedProcedure.input(SubmitReviewInputSchema).mutation(async ({ ctx, input }) => {
    const card = await cardsRepo.getCard(ctx.db, input.cardId);
    if (!card || !(await decksRepo.isDeckOwner(ctx.db, card.deckId, ctx.userId))) {
      throw notFoundError("Card", input.cardId);
    }

    const now = input.ratedAt ? new Date(input.ratedAt) : new Date();
    const currentState = await schedulerRepo.getSchedulerState(ctx.db, input.cardId, Sm2Scheduler);
    const nextState = Sm2Scheduler.next(currentState, input.rating, now);

    await schedulerRepo.saveReview(ctx.db, {
      cardId: input.cardId,
      scheduler: Sm2Scheduler,
      rating: input.rating,
      ratedAt: now,
      nextState,
    });

    return {
      cardId: input.cardId,
      algorithm: ALGORITHM,
      intervalDays: daysBetween(now, nextState.dueAt),
      dueAt: nextState.dueAt.toISOString(),
    };
  }),
});
