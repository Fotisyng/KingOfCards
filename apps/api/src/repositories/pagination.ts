import { TRPCError } from "@trpc/server";

/** A cursor-paginated page of results, shared shape for every paginated list procedure. */
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

/**
 * Encodes a keyset-pagination cursor from a row's tiebreak-ordering columns (`created_at`, `id`).
 *
 * Opaque by convention, not by encoding: `createdAt`/`id` are already visible in the page's own
 * rows, so there's nothing here worth hiding, just a value callers pass back unexamined.
 */
export function encodeCursor(createdAt: string, id: string): string {
  return `${createdAt}::${id}`;
}

/**
 * Decodes a cursor produced by {@link encodeCursor}.
 *
 * @throws {@link TRPCError} `BAD_REQUEST` if `cursor` wasn't produced by {@link encodeCursor}.
 */
export function decodeCursor(cursor: string): { createdAt: string; id: string } {
  const [createdAt, id] = cursor.split("::");
  if (!createdAt || !id) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid pagination cursor" });
  return { createdAt, id };
}
