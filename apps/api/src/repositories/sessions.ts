import type { Client } from "@libsql/client";
import { type UserRow, mapUserRow } from "./users.js";

export interface SessionWithUser {
  user: UserRow;
  expiresAt: string;
}

export async function createSession(
  db: Client,
  params: { tokenHash: string; userId: string; expiresAt: Date },
): Promise<void> {
  await db.execute({
    sql: "INSERT INTO session (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
    args: [params.tokenHash, params.userId, params.expiresAt.toISOString(), new Date().toISOString()],
  });
}

/** @returns `null` if `tokenHash` doesn't match a session, or that session has expired. */
export async function getSessionWithUser(db: Client, tokenHash: string): Promise<SessionWithUser | null> {
  const rs = await db.execute({
    sql: `
      SELECT s.expires_at, u.id, u.email, u.password_hash, u.email_verified_at, u.created_at
      FROM session s
      JOIN user u ON u.id = s.user_id
      WHERE s.token_hash = ?
    `,
    args: [tokenHash],
  });
  const row = rs.rows[0];
  if (!row) return null;

  const expiresAt = row.expires_at as string;
  if (new Date(expiresAt) <= new Date()) return null;

  return { user: mapUserRow(row), expiresAt };
}

export async function deleteSession(db: Client, tokenHash: string): Promise<void> {
  await db.execute({ sql: "DELETE FROM session WHERE token_hash = ?", args: [tokenHash] });
}

export async function deleteAllSessionsForUser(db: Client, userId: string): Promise<void> {
  await db.execute({ sql: "DELETE FROM session WHERE user_id = ?", args: [userId] });
}
