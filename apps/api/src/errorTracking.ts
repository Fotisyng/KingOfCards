import * as Sentry from "@sentry/node";

/**
 * Initializes Sentry if `SENTRY_DSN` is set; a no-op otherwise (e.g. local dev).
 *
 * Follows the same optional-config pattern as email delivery: an unconfigured DSN doesn't throw, it just means
 * errors go nowhere but stdout. Call once, before anything else that could throw.
 */
export function initErrorTracking(): void {
  if (!process.env.SENTRY_DSN) return;

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? "development",
  });
}

/**
 * Reports an error to Sentry, if configured; a no-op otherwise.
 *
 * Callers still log the error themselves (`console.error`/`app.log.error`); this only adds
 * off-process visibility on top of that log line, it doesn't replace it.
 */
export function captureError(err: unknown): void {
  if (process.env.SENTRY_DSN) Sentry.captureException(err);
}
