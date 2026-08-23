import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

export const SESSION_COOKIE_NAME = "koc_session";
export const DEFAULT_WEB_BASE_URL = "http://localhost:5173";

const BCRYPT_COST = 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Session/verification/reset tokens are high-entropy random values, not low-entropy secrets like
// passwords: a fast SHA-256 (not bcrypt) is the right tool for hashing them before storage, so a
// stolen DB row can't be replayed as the live cookie/link.
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
