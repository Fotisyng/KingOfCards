import type { FastifyRequest } from "fastify";
import { describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE_NAME, hashToken } from "../auth.js";
import * as emailModule from "../email.js";
import * as sessionsRepo from "../repositories/sessions.js";
import { appRouter } from "../router.js";
import { createCapturingContext, createContext, createTestDb, refreshContext } from "../testHelpers.js";

// Wraps the real implementation by default (so every other test's console-logged-link extraction
// keeps working unchanged); individual tests override just their own call via mockRejectedValueOnce.
vi.mock("../email.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../email.js")>();
  return { ...actual, sendMail: vi.fn(actual.sendMail) };
});

function extractToken(logSpy: ReturnType<typeof vi.spyOn>, path: "verify-email" | "reset-password"): string {
  const call = (logSpy.mock.calls as unknown[][]).find(
    (call) => typeof call[0] === "string" && call[0].includes(`${path}?token=`),
  );
  if (!call) throw new Error(`no ${path} link was logged`);
  const match = (call[0] as string).match(new RegExp(`${path}\\?token=([^"&\\s]+)`));
  if (!match?.[1]) throw new Error(`couldn't parse token from logged ${path} link`);
  return match[1];
}

describe("authRouter", () => {
  it("walks signup through verification, login, and logout", async () => {
    const db = await createTestDb();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const { ctx: signupCtx, cookies: signupCookies } = createCapturingContext(db);
    const signupCaller = appRouter.createCaller(signupCtx);

    const user = await signupCaller.auth.signup({
      email: "reader@example.com",
      password: "password123",
    });
    expect(user).toEqual({
      id: expect.any(String),
      email: "reader@example.com",
      emailVerified: false,
      createdAt: expect.any(String),
    });
    expect(signupCookies[SESSION_COOKIE_NAME]).toEqual(expect.any(String));

    // Logged in, but blocking verification means data procedures are still off-limits.
    await expect(signupCaller.decks.list()).rejects.toThrow();

    const verifyToken = extractToken(logSpy, "verify-email");
    const anonCaller = appRouter.createCaller(createCapturingContext(db).ctx);
    await anonCaller.auth.verifyEmail({ token: verifyToken });

    const verifiedCaller = appRouter.createCaller(await refreshContext(db, user.id));
    expect(await verifiedCaller.auth.me()).toEqual({ ...user, emailVerified: true });
    expect(await verifiedCaller.decks.list()).toEqual([]);

    // A fresh login from a brand-new (logged-out) context issues its own session cookie.
    const { ctx: loginCtx, cookies: loginCookies } = createCapturingContext(db);
    await appRouter.createCaller(loginCtx).auth.login({ email: "reader@example.com", password: "password123" });
    const sessionToken = loginCookies[SESSION_COOKIE_NAME];
    expect(sessionToken).toEqual(expect.any(String));

    // Logout revokes that specific session.
    const sessionHash = hashToken(sessionToken as string);
    const loggedInCtx = await refreshContext(db, user.id);
    await appRouter.createCaller({ ...loggedInCtx, sessionTokenHash: sessionHash }).auth.logout();
    expect(await sessionsRepo.getSessionWithUser(db, sessionHash)).toBeNull();

    logSpy.mockRestore();
  });

  it("rejects signup with an email that's already registered", async () => {
    const db = await createTestDb();
    const caller = appRouter.createCaller(createCapturingContext(db).ctx);
    await caller.auth.signup({ email: "dupe@example.com", password: "password123" });
    await expect(caller.auth.signup({ email: "dupe@example.com", password: "password123" })).rejects.toThrow();
  });

  it("rejects login with a wrong password", async () => {
    const db = await createTestDb();
    const caller = appRouter.createCaller(createCapturingContext(db).ctx);
    await caller.auth.signup({ email: "wrongpw@example.com", password: "password123" });

    const anonCaller = appRouter.createCaller(createCapturingContext(db).ctx);
    await expect(anonCaller.auth.login({ email: "wrongpw@example.com", password: "not-it" })).rejects.toThrow();
  });

  it("rejects an unknown verification token", async () => {
    const db = await createTestDb();
    const caller = appRouter.createCaller(createCapturingContext(db).ctx);
    await expect(caller.auth.verifyEmail({ token: "not-a-real-token" })).rejects.toThrow();
  });

  it("resetting a password revokes the old password and lets the new one log in", async () => {
    const db = await createTestDb();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const signupCaller = appRouter.createCaller(createCapturingContext(db).ctx);
    await signupCaller.auth.signup({ email: "reset@example.com", password: "old-password" });

    const anonCaller = appRouter.createCaller(createCapturingContext(db).ctx);
    await anonCaller.auth.requestPasswordReset({ email: "reset@example.com" });
    const resetToken = extractToken(logSpy, "reset-password");

    await anonCaller.auth.resetPassword({ token: resetToken, newPassword: "new-password" });

    await expect(
      appRouter
        .createCaller(createCapturingContext(db).ctx)
        .auth.login({ email: "reset@example.com", password: "old-password" }),
    ).rejects.toThrow();

    const newLoginUser = await appRouter
      .createCaller(createCapturingContext(db).ctx)
      .auth.login({ email: "reset@example.com", password: "new-password" });
    expect(newLoginUser.email).toBe("reset@example.com");

    logSpy.mockRestore();
  });

  it("throttles repeated login attempts against one account across different source IPs and email casing", async () => {
    const db = await createTestDb();
    const signupCaller = appRouter.createCaller(createCapturingContext(db).ctx);
    await signupCaller.auth.signup({
      email: "bruteforced@example.com",
      password: "correct-password",
    });

    const emailCasings = ["bruteforced@example.com", "Bruteforced@Example.com", "BRUTEFORCED@EXAMPLE.COM"];

    // Distinct IP and email casing per attempt: neither should let the limiter be bypassed.
    for (let i = 0; i < 10; i++) {
      const ctx = createContext(db, {
        req: { ip: `10.0.0.${i}`, cookies: {} } as unknown as FastifyRequest,
      });
      await expect(
        appRouter.createCaller(ctx).auth.login({
          email: emailCasings[i % emailCasings.length] as string,
          password: "wrong-password",
        }),
      ).rejects.toThrow();
    }

    const eleventhCtx = createContext(db, {
      req: { ip: "10.0.0.99", cookies: {} } as unknown as FastifyRequest,
    });
    await expect(
      appRouter.createCaller(eleventhCtx).auth.login({
        email: "bruteforced@example.com",
        password: "wrong-password",
      }),
    ).rejects.toThrow(/too many attempts/i);
  });

  it("always returns ok for requestPasswordReset, even for an unregistered email", async () => {
    const db = await createTestDb();
    const caller = appRouter.createCaller(createCapturingContext(db).ctx);
    await expect(caller.auth.requestPasswordReset({ email: "nobody@example.com" })).resolves.toEqual({ ok: true });
  });

  it("still creates the account even if the verification email fails to send", async () => {
    const db = await createTestDb();
    // Cleared first, since earlier tests in this file already called through the wrapped real sendMail.
    const sendMailMock = vi
      .mocked(emailModule.sendMail)
      .mockClear()
      .mockRejectedValueOnce(new Error("simulated SMTP failure"));

    const caller = appRouter.createCaller(createCapturingContext(db).ctx);
    const user = await caller.auth.signup({ email: "emailfails@example.com", password: "password123" });

    expect(user.email).toBe("emailfails@example.com");
    expect(sendMailMock).toHaveBeenCalledTimes(1);

    // The account really was created and committed, not rolled back: a second signup attempt
    // with the same email now collides with it instead of succeeding.
    await expect(
      appRouter
        .createCaller(createCapturingContext(db).ctx)
        .auth.signup({ email: "emailfails@example.com", password: "password123" }),
    ).rejects.toThrow();
  });

  it("still returns ok for requestPasswordReset even if the reset email fails to send", async () => {
    const db = await createTestDb();
    const signupCaller = appRouter.createCaller(createCapturingContext(db).ctx);
    await signupCaller.auth.signup({ email: "resetfails@example.com", password: "password123" });

    const sendMailMock = vi
      .mocked(emailModule.sendMail)
      .mockClear()
      .mockRejectedValueOnce(new Error("simulated SMTP failure"));

    const caller = appRouter.createCaller(createCapturingContext(db).ctx);
    await expect(caller.auth.requestPasswordReset({ email: "resetfails@example.com" })).resolves.toEqual({
      ok: true,
    });
    expect(sendMailMock).toHaveBeenCalledTimes(1);
  });
});
