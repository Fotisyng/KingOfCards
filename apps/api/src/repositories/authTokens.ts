import type { Client } from "@libsql/client";

export type AuthTokenPurpose = "verify_email" | "reset_password";

export async function createToken(
  db: Client,
  params: { tokenHash: string; userId: string; purpose: AuthTokenPurpose; expiresAt: Date },
): Promise<void> {
  await db.execute({
    sql: "INSERT INTO auth_token (token_hash, user_id, purpose, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
    args: [params.tokenHash, params.userId, params.purpose, params.expiresAt.toISOString(), new Date().toISOString()],
  });
}

/**
 * Validates and deletes a token in one call.
 *
 * A token is single-use, so "consume" always removes it whether or not it was still valid. The
 * delete and the read of its prior value happen in one `DELETE ... RETURNING` statement rather than
 * a `SELECT` followed by a separate `DELETE`: two concurrent requests carrying the same token
 * (e.g. an email security scanner prefetching a verification link alongside the real click) would
 * otherwise both pass the existence check before either delete lands, consuming a single-use token
 * twice.
 *
 * @returns `null` if the token doesn't exist (for `purpose`), has already been consumed, or has
 * expired.
 */
export async function consumeToken(
  db: Client,
  tokenHash: string,
  purpose: AuthTokenPurpose,
): Promise<{ userId: string } | null> {
  const rs = await db.execute({
    sql: "DELETE FROM auth_token WHERE token_hash = ? AND purpose = ? RETURNING user_id, expires_at",
    args: [tokenHash, purpose],
  });
  const row = rs.rows[0];
  if (!row) return null;

  const expiresAt = row.expires_at as string;
  if (new Date(expiresAt) <= new Date()) return null;

  return { userId: row.user_id as string };
}

export async function deleteTokensForUser(db: Client, userId: string, purpose: AuthTokenPurpose): Promise<void> {
  await db.execute({
    sql: "DELETE FROM auth_token WHERE user_id = ? AND purpose = ?",
    args: [userId, purpose],
  });
}
