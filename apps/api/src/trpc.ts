// Side-effect-only: brings @fastify/cookie's FastifyReply augmentation into scope. apps/web's
// `tsc -b` type-checks this file via its devDependency on AppRouter, but that import graph never
// touches index.ts (the only file that otherwise imports @fastify/cookie), so the augmentation
// has to be pulled in directly here, where Context.res: FastifyReply is declared.
import type {} from "@fastify/cookie";
import type { Client } from "@libsql/client";
import { initTRPC, TRPCError } from "@trpc/server";
import type { FastifyReply, FastifyRequest } from "fastify";

export interface Context {
  db: Client;
  req: FastifyRequest;
  res: FastifyReply;
  userId: string | null;
  emailVerifiedAt: string | null;
  // Hash of the session cookie's token, resolved alongside userId: logout needs it to delete the
  // exact session row without re-reading/re-hashing the cookie in the resolver.
  sessionTokenHash: string | null;
}

// Computed explicitly, not tRPC's own default: a missing NODE_ENV=production stays a visible bug, not a silent leak.
const isProduction = process.env.NODE_ENV === "production";
const t = initTRPC.context<Context>().create({
  isDev: !isProduction,
  errorFormatter({ shape }) {
    if (isProduction) {
      return { ...shape, data: { ...shape.data, stack: undefined } };
    }
    return shape;
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

// Requires a valid session; narrows ctx.userId/sessionTokenHash to non-null for the resolver.
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.userId || !ctx.sessionTokenHash) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { ...ctx, userId: ctx.userId, sessionTokenHash: ctx.sessionTokenHash } });
});

// Requires a valid session AND a verified email; every deck/card/review/stats procedure uses
// this, per the confirmed "blocking verification" scope: an unverified account can log in and see
// `auth.me`, but can't touch any actual app data yet.
export const verifiedProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.emailVerifiedAt) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Email not verified" });
  }
  return next({ ctx });
});
