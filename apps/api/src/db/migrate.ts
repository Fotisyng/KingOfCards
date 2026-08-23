import type { Client } from "@libsql/client";
import { SCHEMA_SQL } from "./schema.js";

/**
 * Adds a column if it doesn't already exist, idempotently under concurrently-booting replicas.
 *
 * Unconditional `ALTER` + swallow "duplicate column", not check-then-act: SQLite has no
 * `ADD COLUMN IF NOT EXISTS`, and a check has a TOCTOU gap across replicas racing to migrate on
 * boot: two could both see the column missing and both attempt the `ALTER`, and the loser would
 * get a real error instead of a no-op.
 */
async function addColumnIfMissing(db: Client, alterStatement: string): Promise<void> {
  try {
    await db.execute(alterStatement);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!message.includes("duplicate column name")) {
      throw err;
    }
  }
}

/** Applies the base schema and any post-launch column/index additions. Safe to run on every boot. */
export async function migrate(db: Client): Promise<void> {
  await db.executeMultiple(SCHEMA_SQL);
  await addColumnIfMissing(db, "ALTER TABLE deck ADD COLUMN user_id TEXT REFERENCES user(id)");
  await addColumnIfMissing(db, "ALTER TABLE deck ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0");
  // Only safe to create once the two columns above are guaranteed to exist on the table.
  await db.execute("CREATE INDEX IF NOT EXISTS idx_deck_user_id ON deck(user_id)");
  await db.execute("CREATE INDEX IF NOT EXISTS idx_deck_is_public ON deck(is_public)");
}
