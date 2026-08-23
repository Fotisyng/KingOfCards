import type { Client } from "@libsql/client";
import { TRPCError } from "@trpc/server";

// DB-backed, not in-memory: `api` runs as N horizontally-scaled replicas behind nginx round-robin
// (docker-compose.yml), so a per-process counter would only throttle whichever replica answers a
// given request.
export interface RateLimitPolicy {
  key: string;
  max: number;
  windowMs: number;
}

/**
 * Enforces a DB-backed rate-limit policy, correct across horizontally-scaled `api` replicas
 * (unlike an in-memory counter, which would only limit whichever replica answers a given request).
 *
 * The count check and the attempt insert happen in one `INSERT ... SELECT ... WHERE` statement,
 * not a separate `SELECT COUNT(*)` followed by an `INSERT`: two statements would let a concurrent
 * burst of requests all read the same pre-insert count and exceed `max`. Folding the count into
 * the insert's own `WHERE` clause keeps the check and the write atomic under SQLite's single-writer lock.
 *
 * @throws {@link TRPCError} `TOO_MANY_REQUESTS` once `policy.key` has hit `policy.max` attempts
 * within `policy.windowMs`.
 */
export async function checkRateLimit(db: Client, { key, max, windowMs }: RateLimitPolicy): Promise<void> {
  const now = Date.now();
  const cutoff = new Date(now - windowMs).toISOString();

  await db.execute({
    sql: "DELETE FROM rate_limit_attempt WHERE key = ? AND attempted_at < ?",
    args: [key, cutoff],
  });

  const rs = await db.execute({
    sql: `INSERT INTO rate_limit_attempt (key, attempted_at)
          SELECT ?, ? WHERE (SELECT COUNT(*) FROM rate_limit_attempt WHERE key = ?) < ?`,
    args: [key, new Date(now).toISOString(), key, max],
  });

  if (rs.rowsAffected === 0) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Too many attempts — try again later.",
    });
  }

  // Probabilistic global sweep: bounds rows for keys that are hit once and never re-checked, without a cron job.
  if (Math.random() < 0.01) {
    const globalCutoff = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    await db.execute({
      sql: "DELETE FROM rate_limit_attempt WHERE attempted_at < ?",
      args: [globalCutoff],
    });
  }
}
