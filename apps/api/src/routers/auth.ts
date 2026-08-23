import {
  LoginInputSchema,
  RequestPasswordResetInputSchema,
  ResetPasswordInputSchema,
  SignupInputSchema,
  type User,
} from "@kingofcards/domain-shared";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  DEFAULT_WEB_BASE_URL,
  SESSION_COOKIE_NAME,
  generateToken,
  hashPassword,
  hashToken,
  verifyPassword,
} from "../auth.js";
import { HOUR_MS, RESET_PASSWORD_TTL_MS, SESSION_TTL_MS, VERIFY_EMAIL_TTL_MS } from "../constants.js";
import { sendMail } from "../email.js";
import { passwordResetEmailHtml, verificationEmailHtml } from "../emailTemplates.js";
import { captureError } from "../errorTracking.js";
import { checkRateLimit } from "../rateLimiter.js";
import { RATE_LIMIT } from "../rateLimits.js";
import * as authTokensRepo from "../repositories/authTokens.js";
import * as sessionsRepo from "../repositories/sessions.js";
import * as usersRepo from "../repositories/users.js";
import type { UserRow } from "../repositories/users.js";
import { type Context, protectedProcedure, publicProcedure, router } from "../trpc.js";

function toPublicUser(user: UserRow): User {
  return {
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerifiedAt !== null,
    createdAt: user.createdAt,
  };
}

// Defaults true regardless of NODE_ENV; docker-compose.yml's HTTP demo opts out via COOKIE_SECURE.
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.COOKIE_SECURE !== "false",
  path: "/",
};

/** Creates a session row and sets the session cookie on the response. */
async function issueSession(ctx: Context, userId: string): Promise<void> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await sessionsRepo.createSession(ctx.db, { tokenHash: hashToken(token), userId, expiresAt });
  ctx.res.setCookie(SESSION_COOKIE_NAME, token, {
    ...COOKIE_OPTIONS,
    expires: expiresAt,
  });
}

/** Issues a fresh verify-email token and emails the verification link. */
async function sendVerificationEmail(ctx: Context, user: UserRow): Promise<void> {
  const token = generateToken();
  await authTokensRepo.createToken(ctx.db, {
    tokenHash: hashToken(token),
    userId: user.id,
    purpose: "verify_email",
    expiresAt: new Date(Date.now() + VERIFY_EMAIL_TTL_MS),
  });
  await sendMail({
    to: user.email,
    subject: "Verify your KingOfCards email",
    html: verificationEmailHtml(verifyLink(token), VERIFY_EMAIL_TTL_MS / HOUR_MS),
  });
}

function verifyLink(token: string): string {
  const base = process.env.WEB_BASE_URL ?? DEFAULT_WEB_BASE_URL;
  return `${base}/verify-email?token=${token}`;
}

function resetLink(token: string): string {
  const base = process.env.WEB_BASE_URL ?? DEFAULT_WEB_BASE_URL;
  return `${base}/reset-password?token=${token}`;
}

// Computed once, compared against whenever the email doesn't match a real user, since otherwise
// skipping bcrypt entirely for an unknown email makes login measurably faster than a real
// wrong-password attempt, letting an attacker enumerate registered emails by response time alone.
const DUMMY_PASSWORD_HASH = hashPassword("not-a-real-account-constant-time-placeholder");

export const authRouter = router({
  /** Creates an account, logs it in immediately, and emails a verification link. */
  signup: publicProcedure.input(SignupInputSchema).mutation(async ({ ctx, input }) => {
    await checkRateLimit(ctx.db, RATE_LIMIT.signup(ctx.req.ip));

    const existing = await usersRepo.getUserByEmail(ctx.db, input.email);
    if (existing) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "An account with that email already exists.",
      });
    }

    const passwordHash = await hashPassword(input.password);
    const user = await usersRepo.createUser(ctx.db, { email: input.email, passwordHash });
    await issueSession(ctx, user.id);
    // The account is already created and usable (unverified) regardless of whether this succeeds:
    // a delivery failure shouldn't fail signup itself and leave the client thinking the account
    // was never created, when it's actually sitting there ready for a retried signup to collide
    // with as CONFLICT. The user can always hit resendVerification later.
    try {
      await sendVerificationEmail(ctx, user);
    } catch (err) {
      console.error("[auth.signup] failed to send verification email", err);
      captureError(err);
    }

    return toPublicUser(user);
  }),

  /**
   * Verifies credentials and logs in.
   *
   * Always runs `verifyPassword` against a real or dummy hash, even for an unknown email, so
   * response timing can't be used to enumerate registered emails.
   *
   * @throws {@link TRPCError} `UNAUTHORIZED` for either a wrong password or an unknown email.
   */
  login: publicProcedure.input(LoginInputSchema).mutation(async ({ ctx, input }) => {
    await checkRateLimit(ctx.db, RATE_LIMIT.loginByIp(ctx.req.ip));
    // Lowercased, since usersRepo normalizes case too, so the raw input would let case-varying bypass this.
    await checkRateLimit(ctx.db, RATE_LIMIT.loginByEmail(input.email.toLowerCase()));

    const user = await usersRepo.getUserByEmail(ctx.db, input.email);
    const passwordOk = await verifyPassword(input.password, user?.passwordHash ?? (await DUMMY_PASSWORD_HASH));
    if (!user || !passwordOk) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password." });
    }

    await issueSession(ctx, user.id);
    return toPublicUser(user);
  }),

  /** Deletes the current session row and clears the session cookie. */
  logout: protectedProcedure.mutation(async ({ ctx }) => {
    await sessionsRepo.deleteSession(ctx.db, ctx.sessionTokenHash);
    ctx.res.clearCookie(SESSION_COOKIE_NAME, COOKIE_OPTIONS);
    return { ok: true as const };
  }),

  /** The current session's user, or `null` if not logged in. */
  me: publicProcedure.query(async ({ ctx }): Promise<User | null> => {
    if (!ctx.userId) return null;
    const user = await usersRepo.getUserById(ctx.db, ctx.userId);
    return user ? toPublicUser(user) : null;
  }),

  /**
   * Consumes a verify-email token and marks the account verified.
   *
   * @throws {@link TRPCError} `BAD_REQUEST` if the token is invalid, already used, or expired.
   */
  verifyEmail: publicProcedure.input(z.object({ token: z.string().min(1) })).mutation(async ({ ctx, input }) => {
    const consumed = await authTokensRepo.consumeToken(ctx.db, hashToken(input.token), "verify_email");
    if (!consumed) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "That verification link is invalid or expired.",
      });
    }
    await usersRepo.setEmailVerified(ctx.db, consumed.userId);
    return { ok: true as const };
  }),

  /**
   * Re-sends the verification email, invalidating any previously-issued token. No-op if already
   * verified.
   *
   * Unlike `signup`/`requestPasswordReset`, a delivery failure here is allowed to propagate as a
   * real error: this endpoint's entire purpose is sending the email, the caller is already a
   * known logged-in account (no anti-enumeration concern), and silently returning `{ ok: true }`
   * on a failed send would just lie about whether anything was actually sent.
   */
  resendVerification: protectedProcedure.mutation(async ({ ctx }) => {
    if (ctx.emailVerifiedAt) return { ok: true as const };

    await checkRateLimit(ctx.db, RATE_LIMIT.resendVerify(ctx.userId));

    const user = await usersRepo.getUserById(ctx.db, ctx.userId);
    if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });

    await authTokensRepo.deleteTokensForUser(ctx.db, user.id, "verify_email");
    await sendVerificationEmail(ctx, user);
    return { ok: true as const };
  }),

  /**
   * Emails a password-reset link if the address has an account.
   *
   * Always returns the same response whether or not the email exists, to avoid leaking which
   * emails have accounts.
   */
  requestPasswordReset: publicProcedure.input(RequestPasswordResetInputSchema).mutation(async ({ ctx, input }) => {
    await checkRateLimit(ctx.db, RATE_LIMIT.resetRequest(ctx.req.ip));

    const user = await usersRepo.getUserByEmail(ctx.db, input.email);
    if (user) {
      const token = generateToken();
      await authTokensRepo.deleteTokensForUser(ctx.db, user.id, "reset_password");
      await authTokensRepo.createToken(ctx.db, {
        tokenHash: hashToken(token),
        userId: user.id,
        purpose: "reset_password",
        expiresAt: new Date(Date.now() + RESET_PASSWORD_TTL_MS),
      });
      // Must not let a delivery failure change this response: the anti-enumeration guarantee
      // above depends on requestPasswordReset always returning the same thing either way.
      try {
        await sendMail({
          to: user.email,
          subject: "Reset your KingOfCards password",
          html: passwordResetEmailHtml(resetLink(token), RESET_PASSWORD_TTL_MS / HOUR_MS),
        });
      } catch (err) {
        console.error("[auth.requestPasswordReset] failed to send reset email", err);
        captureError(err);
      }
    }

    return { ok: true as const };
  }),

  /**
   * Consumes a reset token, sets the new password, and revokes every existing session.
   *
   * @throws {@link TRPCError} `BAD_REQUEST` if the token is invalid, already used, or expired.
   */
  resetPassword: publicProcedure.input(ResetPasswordInputSchema).mutation(async ({ ctx, input }) => {
    const consumed = await authTokensRepo.consumeToken(ctx.db, hashToken(input.token), "reset_password");
    if (!consumed) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "That reset link is invalid or expired.",
      });
    }

    const passwordHash = await hashPassword(input.newPassword);
    await usersRepo.updatePasswordHash(ctx.db, consumed.userId, passwordHash);
    await sessionsRepo.deleteAllSessionsForUser(ctx.db, consumed.userId);
    ctx.res.clearCookie(SESSION_COOKIE_NAME, COOKIE_OPTIONS);

    return { ok: true as const };
  }),
});
