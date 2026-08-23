import compress from "@fastify/compress";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import type { CreateFastifyContextOptions, FastifyHandlerOptions } from "@trpc/server/adapters/fastify";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import Fastify from "fastify";
import type { FastifyReply, FastifyRequest } from "fastify";
import { DEFAULT_WEB_BASE_URL, SESSION_COOKIE_NAME, hashToken } from "./auth.js";
import { UNVERIFIED_ACCOUNT_GRACE_MS, UNVERIFIED_SWEEP_INTERVAL_MS } from "./constants.js";
import { createDbClient } from "./db/client.js";
import { migrate } from "./db/migrate.js";
import { assertEmailConfig } from "./email.js";
import { captureError, initErrorTracking } from "./errorTracking.js";
import * as sessionsRepo from "./repositories/sessions.js";
import * as usersRepo from "./repositories/users.js";
import { appRouter } from "./router.js";
import type { Context } from "./trpc.js";

const PORT = Number(process.env.PORT ?? 3001);

initErrorTracking();
assertEmailConfig();

// Without these, an unhandled rejection or a truly uncaught exception (outside any Fastify request,
// e.g. during boot or in the cleanup sweep's own timer callback) would otherwise crash silently;
// nothing else in this file observes the process-level events.
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
  captureError(err);
});
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
  captureError(reason);
});

const db = createDbClient();
await migrate(db);
// No more boot-time seedIfEmpty: decks are now owned (deck.user_id NOT NULL), and a fresh DB has
// zero accounts to own anything. Seed sample/reference decks manually, per account, after signing
// up, with `SEED_USER_EMAIL=you@example.com pnpm run seed:samples`.

/**
 * Deletes accounts that have sat unverified past the grace period.
 *
 * Run via `setInterval` below, not a cron container: each `api` replica's sweep is a harmless
 * no-op once another replica already caught the same rows, same tradeoff as `migrate()` on every
 * boot.
 */
async function sweepUnverifiedAccounts(): Promise<void> {
  const cutoff = new Date(Date.now() - UNVERIFIED_ACCOUNT_GRACE_MS);
  const deleted = await usersRepo.deleteUnverifiedUsersOlderThan(db, cutoff);
  if (deleted > 0) console.log(`[cleanup] deleted ${deleted} unverified account(s) past the 7-day grace period`);
}
function runSweep(): void {
  sweepUnverifiedAccounts().catch((err) => {
    console.error("[cleanup] sweep failed", err);
    captureError(err);
  });
}
runSweep();
setInterval(runSweep, UNVERIFIED_SWEEP_INTERVAL_MS);

// trustProxy: 1 (one hop, nginx), not true; avoids a caller spoofing rate-limit identity via X-Forwarded-For.
const app = Fastify({ logger: true, trustProxy: 1 });

// Explicit allow-list, not `origin: true`; avoids leaking cross-origin responses via credentialed cookies.
// DEFAULT_WEB_BASE_URL (localhost:5173) is dev-only: including it in production would let any local
// process on a victim's machine pass CORS with a spoofed Origin header and read session-cookie responses.
const allowedOrigins = [
  ...new Set([process.env.WEB_BASE_URL, process.env.NODE_ENV === "production" ? null : DEFAULT_WEB_BASE_URL]),
].filter((origin): origin is string => Boolean(origin));
await app.register(cors, { origin: allowedOrigins, credentials: true });
await app.register(cookie);
await app.register(compress);
await app.register(rateLimit, { max: 300, timeWindow: "1 minute" });

/** Resolves the current request's session (if any) into a tRPC `Context`. */
async function createContext({ req, res }: CreateFastifyContextOptions): Promise<Context> {
  const token = req.cookies[SESSION_COOKIE_NAME];
  const session = token ? await sessionsRepo.getSessionWithUser(db, hashToken(token)) : null;

  return {
    db,
    req,
    res,
    userId: session?.user.id ?? null,
    emailVerifiedAt: session?.user.emailVerifiedAt ?? null,
    sessionTokenHash: token && session ? hashToken(token) : null,
  };
}

// Typed explicitly (rather than inline in the register() call below) so `onError`'s destructured
// params get real types; fastifyTRPCPlugin's generic doesn't get inferred through register().
const trpcOptions: FastifyHandlerOptions<typeof appRouter, FastifyRequest, FastifyReply> = {
  router: appRouter,
  createContext,
  // Only INTERNAL_SERVER_ERROR is a bug worth off-process visibility on; every other TRPCError
  // code (UNAUTHORIZED, TOO_MANY_REQUESTS, FORBIDDEN, ...) is expected control flow, not a crash.
  onError({ error, path }) {
    if (error.code === "INTERNAL_SERVER_ERROR") {
      app.log.error({ path, err: error }, "unhandled tRPC error");
      captureError(error.cause ?? error);
    }
  },
};

await app.register(fastifyTRPCPlugin, { prefix: "/trpc", trpcOptions });

app.get("/healthz", () => ({ status: "ok" }));

app.listen({ port: PORT, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  captureError(err);
  process.exit(1);
});
