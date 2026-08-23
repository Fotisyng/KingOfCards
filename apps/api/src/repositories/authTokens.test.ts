import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { hashPassword } from "../auth.js";
import { createTestDb } from "../testHelpers.js";
import * as authTokensRepo from "./authTokens.js";
import * as usersRepo from "./users.js";

async function createTestUser(db: Awaited<ReturnType<typeof createTestDb>>) {
  const passwordHash = await hashPassword("password123!");
  return usersRepo.createUser(db, { email: `${randomUUID()}@example.com`, passwordHash });
}

describe("consumeToken", () => {
  it("returns the owning user for a fresh, unexpired token", async () => {
    const db = await createTestDb();
    const user = await createTestUser(db);
    await authTokensRepo.createToken(db, {
      tokenHash: "fresh-token-hash",
      userId: user.id,
      purpose: "verify_email",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    });

    expect(await authTokensRepo.consumeToken(db, "fresh-token-hash", "verify_email")).toEqual({ userId: user.id });
  });

  it("returns null for a token that doesn't exist", async () => {
    const db = await createTestDb();
    expect(await authTokensRepo.consumeToken(db, "no-such-token", "verify_email")).toBeNull();
  });

  it("returns null for an expired token", async () => {
    const db = await createTestDb();
    const user = await createTestUser(db);
    await authTokensRepo.createToken(db, {
      tokenHash: "expired-token-hash",
      userId: user.id,
      purpose: "reset_password",
      expiresAt: new Date(Date.now() - 1000),
    });

    expect(await authTokensRepo.consumeToken(db, "expired-token-hash", "reset_password")).toBeNull();
  });

  it("consumes a single-use token exactly once even when raced by concurrent callers", async () => {
    const db = await createTestDb();
    const user = await createTestUser(db);
    await authTokensRepo.createToken(db, {
      tokenHash: "raced-token-hash",
      userId: user.id,
      purpose: "verify_email",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    });

    // Simulates the real-world trigger (an email scanner prefetching a link alongside the real
    // click): the same token consumed by several concurrent requests. Exactly one may succeed.
    const results = await Promise.all(
      Array.from({ length: 10 }, () => authTokensRepo.consumeToken(db, "raced-token-hash", "verify_email")),
    );

    const successes = results.filter((result) => result !== null);
    expect(successes).toEqual([{ userId: user.id }]);
  });
});
