import { z } from "zod";

// Validation bounds from PRD §11, §35, §69. Zod on every input boundary.

export const CONTENT_RATINGS = ["family", "standard", "unfiltered"] as const;
export const VISIBILITIES = ["private", "unlisted", "public"] as const;
export const DIFFICULTIES = ["easy", "medium", "hard"] as const;

export const gameTitleSchema = z
  .string()
  .trim()
  .min(3, "Title must be at least 3 characters")
  .max(80, "Title must be at most 80 characters");

export const gameSettingsSchema = z.object({
  title: gameTitleSchema,
  description: z
    .string()
    .trim()
    .max(300, "Description must be at most 300 characters")
    .transform((value) => (value === "" ? null : value)),
  category: z.string().trim().min(1, "Pick a category"),
  content_rating: z.enum(CONTENT_RATINGS),
  visibility: z.enum(VISIBILITIES),
});

export const squareTextSchema = z
  .string()
  .trim()
  .min(2, "Square text must be at least 2 characters")
  .max(180, "Square text must be at most 180 characters");

export const squareSchema = z.object({
  text: squareTextSchema,
  difficulty: z
    .enum(DIFFICULTIES)
    .or(z.literal(""))
    .transform((value) => (value === "" ? null : value)),
});

export type GameSettingsInput = z.infer<typeof gameSettingsSchema>;
