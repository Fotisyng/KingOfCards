import { TRPCError } from "@trpc/server";

export function notFoundError(entity: "Deck" | "Card", id: string): TRPCError {
  return new TRPCError({ code: "NOT_FOUND", message: `${entity} not found: ${id}` });
}
