import { z } from "zod";

export const DeckSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  isPublic: z.boolean(),
  createdAt: z.string(),
});
export type Deck = z.infer<typeof DeckSchema>;

export const CreateDeckInputSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2_000).optional(),
});
export type CreateDeckInput = z.infer<typeof CreateDeckInputSchema>;
