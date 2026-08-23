import { mkdirSync } from "node:fs";
import path from "node:path";
import { type Client, createClient } from "@libsql/client";

/** Builds the libSQL client, creating the local file DB's parent directory first if needed. */
export function createDbClient(): Client {
  const url = process.env.TURSO_URL ?? "file:./data/dev.db";

  if (url.startsWith("file:")) {
    const filePath = url.slice("file:".length);
    if (filePath && filePath !== ":memory:") {
      mkdirSync(path.dirname(filePath), { recursive: true });
    }
  }

  return createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN || undefined,
  });
}
