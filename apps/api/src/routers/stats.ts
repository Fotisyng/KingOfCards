import * as statsRepo from "../repositories/stats.js";
import { computeStreak } from "../stats.js";
import { router, verifiedProcedure } from "../trpc.js";
import { ALGORITHM } from "./due.js";

const REVIEW_TREND_DAYS = 14;

export const statsRouter = router({
  /** Aggregates the dashboard's stat tiles (due count, retention, streak, review trend) in parallel. */
  summary: verifiedProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    const [dueToday, retentionRate, reviewDays, reviewsByDay] = await Promise.all([
      statsRepo.countDueCards(ctx.db, ctx.userId, ALGORITHM, now),
      statsRepo.getRetentionRate(ctx.db, ctx.userId, ALGORITHM),
      statsRepo.getReviewDays(ctx.db, ctx.userId, ALGORITHM, today),
      statsRepo.getReviewCountsByDay(ctx.db, ctx.userId, ALGORITHM, REVIEW_TREND_DAYS, today),
    ]);

    return {
      dueToday,
      retentionRate,
      streak: computeStreak(reviewDays, today),
      reviewsByDay,
    };
  }),
});
