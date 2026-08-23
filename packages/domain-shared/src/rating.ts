import { z } from "zod";

export const RatingSchema = z.enum(["again", "hard", "good", "easy"]);
export type Rating = z.infer<typeof RatingSchema>;
