import { z } from "zod";
import { RatingSchema } from "./rating.js";

export const SubmitReviewInputSchema = z.object({
  cardId: z.string(),
  rating: RatingSchema,
  // Set only by the offline queue flush, to the time the card was actually rated rather than the
  // time it happened to sync; omitted (and defaulted to the server's own "now") for a live,
  // online-at-rating-time submission, where the two are already the same instant.
  ratedAt: z.string().datetime().optional(),
});
export type SubmitReviewInput = z.infer<typeof SubmitReviewInputSchema>;

export const ReviewResultSchema = z.object({
  cardId: z.string(),
  algorithm: z.string(),
  intervalDays: z.number(),
  dueAt: z.string(),
});
export type ReviewResult = z.infer<typeof ReviewResultSchema>;
