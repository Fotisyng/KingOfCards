// Manually-run entry point for the 5 sample decks (Spanish/Capitals/JS/Periodic-table/Music-theory),
// no longer auto-run at boot since a fresh DB has zero users to own them. Run once per account
// with `SEED_USER_EMAIL=you@example.com pnpm --filter @kingofcards/api run seed:samples`.
import { createDbClient } from "./client.js";
import { seedIfEmpty } from "./seed.js";
import { resolveSeedUserId } from "./seedUser.js";

/** Entry point for `pnpm --filter @kingofcards/api run seed:samples`. */
async function main() {
  const db = createDbClient();
  const userId = await resolveSeedUserId(db);
  await seedIfEmpty(db, userId);
}

main();
