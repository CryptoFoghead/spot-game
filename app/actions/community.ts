"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { reportError } from "@/lib/observability";
import { createClient } from "@/lib/supabase/server";

export type CommunityState = { error?: string; saved?: boolean; average?: number };

const idSchema = z.uuid();
const ratingSchema = z.coerce.number().int().min(1).max(5);

/** Rate a game 1–5 (PRD §54). Re-rating replaces the previous vote. */
export async function rateGame(
  _prev: CommunityState,
  formData: FormData
): Promise<CommunityState> {
  const gameId = idSchema.safeParse(formData.get("game_id"));
  const rating = ratingSchema.safeParse(formData.get("rating"));
  if (!gameId.success || !rating.success) return { error: "Pick 1 to 5 stars." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("rate_game", {
    p_game_template_id: gameId.data,
    p_rating: rating.data,
  });

  if (error) {
    if (error.message.includes("sign in")) return { error: "Sign in to rate." };
    reportError("community.rate", error);
    return { error: "Could not save your rating." };
  }

  revalidatePath("/games", "layout");
  return { average: data.average };
}

/** Add or remove a game from the caller's Saved tab (PRD §42). */
export async function toggleSave(
  _prev: CommunityState,
  formData: FormData
): Promise<CommunityState> {
  const gameId = idSchema.safeParse(formData.get("game_id"));
  if (!gameId.success) return { error: "Unknown game." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("toggle_save", {
    p_game_template_id: gameId.data,
  });

  if (error) {
    if (error.message.includes("sign in")) return { error: "Sign in to save." };
    reportError("community.save", error);
    return { error: "Could not update your saves." };
  }

  revalidatePath("/dashboard/games");
  return { saved: data.saved };
}
