import { z } from "zod";

// Room + player input rules (PRD §14 nicknames, §20 room codes, §69).

const CONTROL_CHARS = new RegExp("[\\u0000-\\u001F\\u007F]", "g");

/** Strips control characters; collapses runs of whitespace. */
export function sanitizeNickname(raw: string): string {
  return raw.replace(CONTROL_CHARS, "").replace(/\s+/g, " ").trim();
}

export const nicknameSchema = z
  .string()
  .transform(sanitizeNickname)
  .pipe(
    z
      .string()
      .min(1, "Enter a nickname")
      .max(24, "Nicknames are 24 characters or fewer")
  );

/** MVP codes are 4 digits — no ambiguous letters to mistype (PRD §20). */
export const roomCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{4}$/, "Room codes are 4 digits");

/** Win conditions the server implements (PRD §13). */
export const gameModeSchema = z.enum([
  "classic",
  "blackout",
  "double",
  "four_corners",
  "points",
]);

export const GAME_MODES = [
  { value: "classic", label: "Classic", hint: "Any line wins" },
  { value: "double", label: "Double", hint: "Two lines win" },
  { value: "four_corners", label: "Four Corners", hint: "All four corners" },
  { value: "blackout", label: "Blackout", hint: "Every square" },
  { value: "points", label: "Points", hint: "Any line; ranked by points" },
] as const;
