import { z } from "zod";

/**
 * The public-safe shape of a user, never the password hash. Routers map the internal user row
 * to this before it ever reaches a response.
 */
export const UserSchema = z.object({
  id: z.string(),
  email: z.string(),
  emailVerified: z.boolean(),
  createdAt: z.string(),
});
export type User = z.infer<typeof UserSchema>;

// 254 is RFC 5321's max email length; 128 bounds bcrypt's per-request cost on the password.
const EmailSchema = z.string().email().max(254);
const PasswordSchema = z.string().min(8).max(128);

export const SignupInputSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
});
export type SignupInput = z.infer<typeof SignupInputSchema>;

// Deliberately doesn't reuse PasswordSchema's min(8): an account created before that minimum was
// enforced still needs to be able to log in with its existing, shorter password.
export const LoginInputSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

export const RequestPasswordResetInputSchema = z.object({
  email: EmailSchema,
});
export type RequestPasswordResetInput = z.infer<typeof RequestPasswordResetInputSchema>;

export const ResetPasswordInputSchema = z.object({
  token: z.string().min(1),
  newPassword: PasswordSchema,
});
export type ResetPasswordInput = z.infer<typeof ResetPasswordInputSchema>;
