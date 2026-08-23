import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { hashPassword } from "../auth.js";
import { createTestDb } from "../testHelpers.js";
import * as sessionsRepo from "./sessions.js";
import * as usersRepo from "./users.js";

async function createUserWithAge(db: Awaited<ReturnType<typeof createTestDb>>, daysOld: number) {
  const passwordHash = await hashPassword("password123!");
  const user = await usersRepo.createUser(db, {
    email: `${randomUUID()}@example.com`,
    passwordHash,
  });
  const createdAt = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000).toISOString();
  await db.execute({
    sql: "UPDATE user SET created_at = ? WHERE id = ?",
    args: [createdAt, user.id],
  });
  return user;
}

describe("deleteUnverifiedUsersOlderThan", () => {
  it("removes an unverified account past the grace period, along with its sessions", async () => {
    const db = await createTestDb();
    const stale = await createUserWithAge(db, 8);
    await sessionsRepo.createSession(db, {
      tokenHash: "stale-session-hash",
      userId: stale.id,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    });

    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const deletedCount = await usersRepo.deleteUnverifiedUsersOlderThan(db, cutoff);

    expect(deletedCount).toBe(1);
    expect(await usersRepo.getUserById(db, stale.id)).toBeNull();
    expect(await sessionsRepo.getSessionWithUser(db, "stale-session-hash")).toBeNull();
  });

  it("leaves a recently-created unverified account alone", async () => {
    const db = await createTestDb();
    const fresh = await createUserWithAge(db, 1);

    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const deletedCount = await usersRepo.deleteUnverifiedUsersOlderThan(db, cutoff);

    expect(deletedCount).toBe(0);
    expect(await usersRepo.getUserById(db, fresh.id)).not.toBeNull();
  });

  it("leaves a verified account alone regardless of age", async () => {
    const db = await createTestDb();
    const old = await createUserWithAge(db, 30);
    await usersRepo.setEmailVerified(db, old.id);

    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const deletedCount = await usersRepo.deleteUnverifiedUsersOlderThan(db, cutoff);

    expect(deletedCount).toBe(0);
    expect(await usersRepo.getUserById(db, old.id)).not.toBeNull();
  });
});
