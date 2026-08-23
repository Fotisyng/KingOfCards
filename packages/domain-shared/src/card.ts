import { z } from "zod";

export const CardSchema = z.object({
  id: z.string(),
  deckId: z.string(),
  frontMd: z.string(),
  backMd: z.string(),
  createdAt: z.string(),
});
export type Card = z.infer<typeof CardSchema>;

export const CreateCardInputSchema = z.object({
  deckId: z.string(),
  frontMd: z.string().min(1).max(10_000),
  backMd: z.string().min(1).max(20_000),
});
export type CreateCardInput = z.infer<typeof CreateCardInputSchema>;

export const UpdateCardInputSchema = z.object({
  cardId: z.string(),
  frontMd: z.string().min(1).max(10_000),
  backMd: z.string().min(1).max(20_000),
});
export type UpdateCardInput = z.infer<typeof UpdateCardInputSchema>;

export const DueCardSchema = CardSchema.extend({
  dueAt: z.string(),
});
export type DueCard = z.infer<typeof DueCardSchema>;
