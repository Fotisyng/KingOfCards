export const HOUR_MS = 60 * 60 * 1000;

export const SESSION_TTL_MS = 30 * 24 * HOUR_MS; // 30 days, fixed; no sliding refresh.
export const VERIFY_EMAIL_TTL_MS = 24 * HOUR_MS; // 24 hours
export const RESET_PASSWORD_TTL_MS = HOUR_MS; // 1 hour
export const UNVERIFIED_ACCOUNT_GRACE_MS = 7 * 24 * HOUR_MS; // 7 days
export const UNVERIFIED_SWEEP_INTERVAL_MS = 6 * HOUR_MS; // 6 hours
