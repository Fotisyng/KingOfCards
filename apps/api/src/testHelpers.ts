import { randomUUID } from "node:crypto";
import { type Client, createClient } from "@libsql/client";
import type { FastifyReply, FastifyRequest } from "fastify";
import { hashPassword } from "./auth.js";
import { migrate } from "./db/migrate.js";
import * as usersRepo from "./repositories/users.js";
import { appRouter } from "./router.js";
import type { Context } from "./trpc.js";

/** Creates a fresh in-memory, fully-migrated DB for one test file. */
export async function createTestDb(): Promise<Client> {
  const db = createClient({ url: ":memory:" });
  await migrate(db);
  return db;
}

function fakeReq(): FastifyRequest {
  return { ip: "127.0.0.1", cookies: {} } as unknown as FastifyRequest;
}

function fakeRes(cookies: Record<string, string>): FastifyReply {
  return {
    setCookie: (name: string, value: string) => {
      cookies[name] = value;
    },
    clearCookie: (name: string) => {
      delete cookies[name];
    },
  } as unknown as FastifyReply;
}

export function createContext(db: Client, overrides: Partial<Context> = {}): Context {
  return {
    db,
    req: fakeReq(),
    res: fakeRes({}),
    userId: null,
    emailVerifiedAt: null,
    sessionTokenHash: null,
    ...overrides,
  };
}

/**
 * Like {@link createContext}, but exposes the cookie jar `res.setCookie`/`clearCookie` write to.
 *
 * Needed to test signup/login (which issue a session cookie) and logout/resetPassword (which clear
 * one).
 */
export function createCapturingContext(
  db: Client,
  overrides: Partial<Context> = {},
): { ctx: Context; cookies: Record<string, string> } {
  const cookies: Record<string, string> = {};
  const ctx: Context = {
    db,
    req: fakeReq(),
    res: fakeRes(cookies),
    userId: null,
    emailVerifiedAt: null,
    sessionTokenHash: null,
    ...overrides,
  };
  return { ctx, cookies };
}

/**
 * Simulates a fresh request reflecting the user's current DB state.
 *
 * A long-lived test `ctx` won't update on its own the way `index.ts`'s real `createContext` does
 * per-request.
 */
export async function refreshContext(db: Client, userId: string): Promise<Context> {
  const user = await usersRepo.getUserById(db, userId);
  return createContext(db, {
    userId,
    emailVerifiedAt: user?.emailVerifiedAt ?? null,
    sessionTokenHash: "test-session-token-hash",
  });
}

/**
 * Creates a fresh verified account and a tRPC caller authenticated as it.
 *
 * Convenience for non-auth-focused tests that just need a logged-in, verified caller and don't
 * care about the signup/login mechanics themselves.
 */
export async function createVerifiedCaller(
  db: Client,
): Promise<{ caller: ReturnType<typeof appRouter.createCaller>; userId: string }> {
  const passwordHash = await hashPassword("password123!");
  const user = await usersRepo.createUser(db, {
    email: `${randomUUID()}@example.com`,
    passwordHash,
  });
  await usersRepo.setEmailVerified(db, user.id);

  const ctx = createContext(db, {
    userId: user.id,
    emailVerifiedAt: new Date().toISOString(),
    sessionTokenHash: "test-session-token-hash",
  });
  return { caller: appRouter.createCaller(ctx), userId: user.id };
}
