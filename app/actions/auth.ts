"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { clientEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export type AuthFormState = { error?: string; sent?: boolean };

const emailSchema = z.email("Enter a valid email address");

export async function sendMagicLink(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: {
      emailRedirectTo: `${clientEnv().NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  });

  if (error) {
    return { error: "Could not send the sign-in link. Try again." };
  }
  return { sent: true };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
