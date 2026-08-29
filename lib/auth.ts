import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/** Current authenticated user, or null. */
export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Current authenticated user, redirecting to /login when absent. */
export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}
