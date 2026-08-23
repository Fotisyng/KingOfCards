import { HOUR_MS } from "./constants.js";

export const RATE_LIMIT = {
  deckCreate: (userId: string) => ({ key: `deck-create:${userId}`, max: 20, windowMs: HOUR_MS }),
  deckDelete: (userId: string) => ({ key: `deck-delete:${userId}`, max: 20, windowMs: HOUR_MS }),
  deckClone: (userId: string) => ({ key: `clone:${userId}`, max: 20, windowMs: HOUR_MS }),
  cardCreate: (userId: string) => ({ key: `card-create:${userId}`, max: 300, windowMs: HOUR_MS }),
  cardUpdate: (userId: string) => ({ key: `card-update:${userId}`, max: 300, windowMs: HOUR_MS }),
  cardDelete: (userId: string) => ({ key: `card-delete:${userId}`, max: 300, windowMs: HOUR_MS }),
  signup: (ip: string) => ({ key: `signup:${ip}`, max: 10, windowMs: HOUR_MS }),
  loginByIp: (ip: string) => ({ key: `login:${ip}`, max: 20, windowMs: 15 * 60 * 1000 }),
  loginByEmail: (email: string) => ({ key: `login:email:${email}`, max: 10, windowMs: HOUR_MS }),
  resendVerify: (userId: string) => ({
    key: `resend-verify:${userId}`,
    max: 3,
    windowMs: 10 * 60 * 1000,
  }),
  resetRequest: (ip: string) => ({ key: `reset-request:${ip}`, max: 5, windowMs: HOUR_MS }),
} as const;
