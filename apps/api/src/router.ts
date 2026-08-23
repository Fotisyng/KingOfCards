import { authRouter } from "./routers/auth.js";
import { cardsRouter } from "./routers/cards.js";
import { decksRouter } from "./routers/decks.js";
import { dueRouter } from "./routers/due.js";
import { levelsRouter } from "./routers/levels.js";
import { reviewsRouter } from "./routers/reviews.js";
import { statsRouter } from "./routers/stats.js";
import { publicProcedure, router } from "./trpc.js";

export const appRouter = router({
  health: publicProcedure.query(() => ({ status: "ok" as const })),

  auth: authRouter,
  decks: decksRouter,
  cards: cardsRouter,
  due: dueRouter,
  levels: levelsRouter,
  stats: statsRouter,
  reviews: reviewsRouter,
});

export type AppRouter = typeof appRouter;
