"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { minimumSquares } from "@/lib/game/rules";
import { slugify, slugSuffix } from "@/lib/slug";
import { createClient } from "@/lib/supabase/server";
import { gameSettingsSchema, squareSchema } from "@/lib/validation/game";

export type FormState = { error?: string };

const idSchema = z.uuid();

/**
 * Every mutation authenticates, then verifies the caller owns the target
 * template before touching it. RLS enforces the same rule at the database
 * layer; the explicit check exists to return friendly errors instead of
 * silent empty updates.
 */
async function requireOwnedGame(gameId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." as const };

  const parsedId = idSchema.safeParse(gameId);
  if (!parsedId.success) return { error: "Unknown game." as const };

  const { data: game } = await supabase
    .from("game_templates")
    .select("id, creator_id, status, card_size, free_center, slug, title")
    .eq("id", parsedId.data)
    .eq("creator_id", user.id)
    .single();

  if (!game) return { error: "Game not found, or you don't own it." as const };
  return { supabase, user, game };
}

export async function createGame(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parsed = gameSettingsSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    category: formData.get("category"),
    content_rating: formData.get("content_rating"),
    visibility: formData.get("visibility"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { data: created, error } = await supabase
    .from("game_templates")
    .insert({ ...parsed.data, creator_id: user.id })
    .select("id")
    .single();

  if (error || !created) return { error: "Could not create the game. Try again." };
  redirect(`/dashboard/games/${created.id}/edit`);
}

export async function updateGameSettings(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const owned = await requireOwnedGame(String(formData.get("game_id")));
  if ("error" in owned) return { error: owned.error };

  const parsed = gameSettingsSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    category: formData.get("category"),
    content_rating: formData.get("content_rating"),
    visibility: formData.get("visibility"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { error } = await owned.supabase
    .from("game_templates")
    .update(parsed.data)
    .eq("id", owned.game.id);

  if (error) return { error: "Could not save. Try again." };
  revalidatePath(`/dashboard/games/${owned.game.id}/edit`);
  revalidatePath("/dashboard/games");
  return {};
}

export async function publishGame(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const owned = await requireOwnedGame(String(formData.get("game_id")));
  if ("error" in owned) return { error: owned.error };
  const { supabase, game } = owned;

  const { count } = await supabase
    .from("game_squares")
    .select("id", { count: "exact", head: true })
    .eq("game_template_id", game.id)
    .eq("is_active", true);

  const needed = minimumSquares(game.card_size, game.free_center);
  if ((count ?? 0) < needed) {
    return {
      error: `You need at least ${needed} squares to publish (currently ${count ?? 0}).`,
    };
  }

  // Assign a slug on first publish; retry once on collision.
  let slug = game.slug;
  if (!slug) {
    slug = slugify(game.title);
    for (let attempt = 0; attempt < 2; attempt++) {
      const { error } = await supabase
        .from("game_templates")
        .update({ slug })
        .eq("id", game.id);
      if (!error) break;
      slug = `${slugify(game.title)}-${slugSuffix()}`;
      if (attempt === 1) return { error: "Could not assign a URL. Try again." };
    }
  }

  const { error } = await supabase
    .from("game_templates")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", game.id);

  if (error) return { error: "Could not publish. Try again." };
  revalidatePath(`/dashboard/games/${game.id}/edit`);
  revalidatePath("/dashboard/games");
  revalidatePath("/explore");
  return {};
}

export async function archiveGame(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const owned = await requireOwnedGame(String(formData.get("game_id")));
  if ("error" in owned) return { error: owned.error };

  const { error } = await owned.supabase
    .from("game_templates")
    .update({ status: "archived" })
    .eq("id", owned.game.id);

  if (error) return { error: "Could not archive. Try again." };
  revalidatePath("/dashboard/games");
  redirect("/dashboard/games");
}

export async function duplicateGame(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parsedId = idSchema.safeParse(formData.get("game_id"));
  if (!parsedId.success) return { error: "Unknown game." };

  const { data: newId, error } = await supabase.rpc("duplicate_game_template", {
    source_id: parsedId.data,
  });

  if (error || !newId) return { error: "Could not duplicate this game." };
  redirect(`/dashboard/games/${newId}/edit`);
}

export async function addSquare(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const owned = await requireOwnedGame(String(formData.get("game_id")));
  if ("error" in owned) return { error: owned.error };

  const parsed = squareSchema.safeParse({
    text: formData.get("text"),
    difficulty: formData.get("difficulty") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { count } = await owned.supabase
    .from("game_squares")
    .select("id", { count: "exact", head: true })
    .eq("game_template_id", owned.game.id);

  const { error } = await owned.supabase.from("game_squares").insert({
    game_template_id: owned.game.id,
    text: parsed.data.text,
    difficulty: parsed.data.difficulty,
    sort_order: (count ?? 0) + 1,
  });

  if (error) return { error: "Could not add the square. Try again." };
  revalidatePath(`/dashboard/games/${owned.game.id}/edit`);
  return {};
}

export async function updateSquare(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const owned = await requireOwnedGame(String(formData.get("game_id")));
  if ("error" in owned) return { error: owned.error };

  const squareId = idSchema.safeParse(formData.get("square_id"));
  if (!squareId.success) return { error: "Unknown square." };

  const parsed = squareSchema.safeParse({
    text: formData.get("text"),
    difficulty: formData.get("difficulty") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { error } = await owned.supabase
    .from("game_squares")
    .update({ text: parsed.data.text, difficulty: parsed.data.difficulty })
    .eq("id", squareId.data)
    .eq("game_template_id", owned.game.id);

  if (error) return { error: "Could not save the square. Try again." };
  revalidatePath(`/dashboard/games/${owned.game.id}/edit`);
  return {};
}

export async function deleteSquare(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const owned = await requireOwnedGame(String(formData.get("game_id")));
  if ("error" in owned) return { error: owned.error };

  const squareId = idSchema.safeParse(formData.get("square_id"));
  if (!squareId.success) return { error: "Unknown square." };

  const { error } = await owned.supabase
    .from("game_squares")
    .delete()
    .eq("id", squareId.data)
    .eq("game_template_id", owned.game.id);

  if (error) return { error: "Could not delete the square. Try again." };
  revalidatePath(`/dashboard/games/${owned.game.id}/edit`);
  return {};
}
