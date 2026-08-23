import { describe, expect, it } from "vitest";
import { checkRateLimit } from "./rateLimiter.js";
import { createTestDb } from "./testHelpers.js";

describe("checkRateLimit", () => {
  it("allows attempts up to the max and rejects the next one", async () => {
    const db = await createTestDb();
    const policy = { key: "sequential", max: 3, windowMs: 1000 * 60 };

    await checkRateLimit(db, policy);
    await checkRateLimit(db, policy);
    await checkRateLimit(db, policy);

    await expect(checkRateLimit(db, policy)).rejects.toThrow(/too many attempts/i);
  });

  it("caps a concurrent burst at exactly max, rather than letting the burst's concurrency exceed it", async () => {
    const db = await createTestDb();
    const policy = { key: "concurrent", max: 5, windowMs: 1000 * 60 };

    // A naive SELECT-COUNT(*)-then-INSERT would let every one of these read the same pre-insert
    // count before any of them commits, letting all 20 through instead of just `max`.
    const results = await Promise.allSettled(Array.from({ length: 20 }, () => checkRateLimit(db, policy)));

    const allowed = results.filter((result) => result.status === "fulfilled");
    const throttled = results.filter((result) => result.status === "rejected");
    expect(allowed).toHaveLength(5);
    expect(throttled).toHaveLength(15);
  });
});
