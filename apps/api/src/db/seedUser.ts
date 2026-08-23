import type { Client } from "@libsql/client";
import * as usersRepo from "../repositories/users.js";

/**
 * Resolves `SEED_USER_EMAIL` to the account id every `seed:*` script attaches its decks to.
 *
 * @throws {@link Error} If `SEED_USER_EMAIL` is unset, or no account exists for it.
 */
export async function resolveSeedUserId(db: Client): Promise<string> {
  const email = process.env.SEED_USER_EMAIL;
  if (!email) {
    throw new Error("Set SEED_USER_EMAIL to the email of the account these decks should belong to (sign up first).");
  }
  const user = await usersRepo.getUserByEmail(db, email);
  if (!user) {
    throw new Error(`No account found for SEED_USER_EMAIL="${email}" — sign up first.`);
  }
  return user.id;
}
