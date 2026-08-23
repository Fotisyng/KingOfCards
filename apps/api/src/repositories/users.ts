import { randomUUID } from "node:crypto";
import type { Client, Row } from "@libsql/client";

// Internal shape only, includes the password hash, so this never crosses into domain-shared or a
// tRPC response. Routers map this to the public-safe `User` type (domain-shared) before returning.
export interface UserRow {
  id: string;
  email: string;
  passwordHash: string;
  emailVerifiedAt: string | null;
  createdAt: string;
}

export function mapUserRow(row: Row): UserRow {
  return {
    id: row.id as string,
    email: row.email as string,
    passwordHash: row.password_hash as string,
    emailVerifiedAt: (row.email_verified_at as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

/** Inserts a new, unverified user account; `email` is lowercased for case-insensitive lookup. */
export async function createUser(db: Client, input: { email: string; passwordHash: string }): Promise<UserRow> {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const email = input.email.toLowerCase();

  await db.execute({
    sql: "INSERT INTO user (id, email, password_hash, email_verified_at, created_at) VALUES (?, ?, ?, NULL, ?)",
    args: [id, email, input.passwordHash, createdAt],
  });

  return { id, email, passwordHash: input.passwordHash, emailVerifiedAt: null, createdAt };
}

/** Looks up an account by email (case-insensitively). */
export async function getUserByEmail(db: Client, email: string): Promise<UserRow | null> {
  const rs = await db.execute({
    sql: "SELECT id, email, password_hash, email_verified_at, created_at FROM user WHERE email = ?",
    args: [email.toLowerCase()],
  });
  const row = rs.rows[0];
  return row ? mapUserRow(row) : null;
}

/** Looks up an account by id. */
export async function getUserById(db: Client, id: string): Promise<UserRow | null> {
  const rs = await db.execute({
    sql: "SELECT id, email, password_hash, email_verified_at, created_at FROM user WHERE id = ?",
    args: [id],
  });
  const row = rs.rows[0];
  return row ? mapUserRow(row) : null;
}

export async function setEmailVerified(db: Client, userId: string): Promise<void> {
  await db.execute({
    sql: "UPDATE user SET email_verified_at = ? WHERE id = ?",
    args: [new Date().toISOString(), userId],
  });
}

export async function updatePasswordHash(db: Client, userId: string, passwordHash: string): Promise<void> {
  await db.execute({
    sql: "UPDATE user SET password_hash = ? WHERE id = ?",
    args: [passwordHash, userId],
  });
}

/**
 * Permanently removes accounts still unverified as of `cutoff`, not just their sessions.
 *
 * Deletes `session`/`auth_token` rows before `user`, since the FK on `user_id` is enforced (unlike
 * `review_log`'s, which has no such FK) and deleting `user` first would fail outright.
 *
 * @returns The number of accounts deleted.
 */
export async function deleteUnverifiedUsersOlderThan(db: Client, cutoff: Date): Promise<number> {
  const cutoffIso = cutoff.toISOString();
  const staleUserIds = "SELECT id FROM user WHERE email_verified_at IS NULL AND created_at < ?";

  const results = await db.batch(
    [
      { sql: `DELETE FROM session WHERE user_id IN (${staleUserIds})`, args: [cutoffIso] },
      { sql: `DELETE FROM auth_token WHERE user_id IN (${staleUserIds})`, args: [cutoffIso] },
      {
        sql: "DELETE FROM user WHERE email_verified_at IS NULL AND created_at < ?",
        args: [cutoffIso],
      },
    ],
    "write",
  );

  return results[2]?.rowsAffected ?? 0;
}
