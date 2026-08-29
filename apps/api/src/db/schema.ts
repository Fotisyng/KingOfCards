// review_log is append-only; never UPDATE/DELETE it from application code. It's
// what makes replaying different schedulers over the same review history possible later.
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS user (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  email_verified_at TEXT,
  created_at TEXT NOT NULL
);

-- Cookie holds a random high-entropy token; only its SHA-256 hash is stored here, so reading this
-- table can't be replayed as a live session cookie. Fixed expiry, no sliding refresh.
CREATE TABLE IF NOT EXISTS session (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Shared by email-verification and password-reset links (purpose column) instead of two
-- near-identical tables. Consumed by deleting the row: nothing here replays history the way
-- review_log does, so there's no need to track used-but-not-deleted tokens.
CREATE TABLE IF NOT EXISTS auth_token (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id),
  purpose TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS deck (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id),
  name TEXT NOT NULL,
  description TEXT,
  is_public INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS card (
  id TEXT PRIMARY KEY,
  deck_id TEXT NOT NULL REFERENCES deck(id),
  front_md TEXT NOT NULL,
  back_md TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- card_id has no REFERENCES card(id) on purpose: FK enforcement is on in this stack, and this row
-- must be allowed to outlive its card once that card (or its whole deck) is deleted.
CREATE TABLE IF NOT EXISTS review_log (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL,
  rated_at TEXT NOT NULL,
  rating TEXT NOT NULL,
  algorithm TEXT NOT NULL,
  resulting_interval_days INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS card_scheduler_state (
  card_id TEXT NOT NULL REFERENCES card(id),
  algorithm TEXT NOT NULL,
  state_json TEXT NOT NULL,
  due_at TEXT NOT NULL,
  PRIMARY KEY (card_id, algorithm)
);

-- Backs the auth-endpoint rate limiter (signup/login/password-reset). Deliberately not in-memory:
-- api runs as N horizontally-scaled replicas behind nginx round-robin, so an in-process counter
-- only limits attempts against whichever replica happens to answer; an attacker distributing
-- requests across replicas would get N times the allowed attempts. One row per attempt, pruned
-- lazily by the limiter itself, not a background job.
CREATE TABLE IF NOT EXISTS rate_limit_attempt (
  key TEXT NOT NULL,
  attempted_at TEXT NOT NULL
);

-- idx_deck_user_id / idx_deck_is_public are deliberately not here: both columns are backfilled onto
-- a pre-existing deck table via a separate ALTER TABLE that runs after this executeMultiple() call,
-- so an index referencing them here would fail against any deck table that predates them ("no such
-- column"), before the ALTER ever gets a chance to run.
CREATE INDEX IF NOT EXISTS idx_rate_limit_attempt_key ON rate_limit_attempt(key, attempted_at);
CREATE INDEX IF NOT EXISTS idx_session_user_id ON session(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_token_user_id ON auth_token(user_id);
CREATE INDEX IF NOT EXISTS idx_card_deck_id ON card(deck_id);
CREATE INDEX IF NOT EXISTS idx_review_log_card_id ON review_log(card_id);
CREATE INDEX IF NOT EXISTS idx_review_log_algorithm_rated_at ON review_log(algorithm, rated_at);
CREATE INDEX IF NOT EXISTS idx_card_scheduler_state_due_at ON card_scheduler_state(due_at);
`;
