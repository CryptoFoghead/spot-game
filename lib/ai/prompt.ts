import { z } from "zod";

import { squareTextSchema } from "@/lib/validation/game";

/** Safe-generation system prompt (PRD §37). */
export const SQUARE_SYSTEM_PROMPT = `You create funny, observable, respectful squares for a social people-watching bingo game.

Every square must describe something a player can reasonably observe in a public or social environment.

Rules:

- Keep each square concise.
- Do not require interacting with strangers.
- Do not require photographing strangers.
- Do not identify a specific private individual.
- Do not target protected characteristics.
- Avoid cruelty, humiliation, or harassment.
- Avoid dangerous behavior.
- Avoid sexually explicit descriptions.
- Avoid duplicates and near-duplicates.
- Make the observations specific enough to be entertaining.
- Vary difficulty.
- Match the requested content rating.`;

/** Content-rating guidance (PRD §38). */
export const RATING_GUIDANCE: Record<string, string> = {
  family:
    "FAMILY rating: suitable for children. No alcohol jokes, no profanity, no sexual references, no crude observations.",
  standard:
    "STANDARD rating: general adult social humor. May reference beer, mild awkward behavior, funny clothing, and social situations. Still avoid explicit material.",
  unfiltered:
    "UNFILTERED rating: edgier humor is welcome, but still prohibit hate, harassment, targeting protected classes, explicit sexual content, encouraging crime, and photographing unsuspecting people. Unfiltered does not mean unlimited.",
};

export const generatedSquareSchema = z.object({
  text: squareTextSchema,
  difficulty: z.enum(["easy", "medium", "hard"]),
});

export const generationResultSchema = z.object({
  title: z.string().min(3).max(80),
  description: z.string().max(300),
  squares: z.array(generatedSquareSchema).min(1),
});

export type GenerationResult = z.infer<typeof generationResultSchema>;

export function buildUserPrompt(input: {
  location: string;
  category: string;
  rating: string;
  count: number;
  existingSquares: string[];
}): string {
  const guidance = RATING_GUIDANCE[input.rating] ?? RATING_GUIDANCE.standard;
  const existing = input.existingSquares.length
    ? `\n\nThe game already contains these squares. Do NOT repeat them or produce near-duplicates:\n${input.existingSquares
        .map((text) => `- ${text}`)
        .join("\n")}`
    : "";

  return `Generate ${input.count} bingo squares for a people-watching game.

Location or theme: ${input.location}
Category: ${input.category}
${guidance}

Also suggest a short game title and a one-sentence description.${existing}`;
}

/**
 * Case- and punctuation-insensitive key used to drop duplicates and
 * near-duplicates, both within a batch and against existing squares (PRD §36).
 */
export function dedupeKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\b(a|an|the|someone|somebody|is|are|of|in|on|at|with)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Removes duplicates within `squares` and anything matching `existing`. */
export function filterDuplicates<T extends { text: string }>(
  squares: T[],
  existing: string[] = []
): T[] {
  const seen = new Set(existing.map(dedupeKey));
  const kept: T[] = [];
  for (const square of squares) {
    const key = dedupeKey(square.text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    kept.push(square);
  }
  return kept;
}
