"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { reportError } from "@/lib/observability";
import { createClient } from "@/lib/supabase/server";

export type SafetyFormState = { error?: string; done?: boolean };

const reportSchema = z.object({
  game_id: z.uuid(),
  reason: z.enum([
    "harassment",
    "hateful",
    "sexual",
    "unsafe",
    "privacy",
    "spam",
    "other",
  ]),
  details: z.string().trim().max(1000).optional(),
});

/** Report a public game (PRD §55). Anonymous reporting is allowed by design. */
export async function reportGame(
  _prev: SafetyFormState,
  formData: FormData
): Promise<SafetyFormState> {
  const parsed = reportSchema.safeParse({
    game_id: formData.get("game_id"),
    reason: formData.get("reason"),
    details: formData.get("details") ?? undefined,
  });
  if (!parsed.success) {
    return { error: "Pick a reason for the report." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("report_game", {
    p_game_template_id: parsed.data.game_id,
    p_reason: parsed.data.reason,
    p_details: parsed.data.details ?? null,
  });

  if (error) {
    if (error.message.includes("already reported")) {
      return { error: "You've already reported this game." };
    }
    reportError("safety.report", error);
    return { error: "Could not send the report. Try again." };
  }

  return { done: true };
}

/** Deletes the signed-in user's account and everything they created (§57). */
export async function deleteAccount(
  _prev: SafetyFormState,
  formData: FormData
): Promise<SafetyFormState> {
  // Typing the phrase is the confirmation; a dialog alone is too easy to
  // dismiss for something irreversible.
  if (String(formData.get("confirm") ?? "").trim().toUpperCase() !== "DELETE") {
    return { error: 'Type DELETE to confirm.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You're not signed in." };

  const { error } = await supabase.rpc("delete_my_account");
  if (error) {
    reportError("safety.delete_account", error);
    return { error: "Could not delete your account. Try again." };
  }

  await supabase.auth.signOut();
  redirect("/?deleted=1");
}
