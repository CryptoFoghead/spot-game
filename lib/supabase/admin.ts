import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { serverEnv } from "@/lib/env";

/**
 * Admin Supabase client using the secret key. BYPASSES RLS.
 * Server-only ("server-only" import makes client bundling a build error).
 * Use exclusively inside trusted server code paths that perform their own
 * authorization — never as a convenience around RLS.
 */
export function createAdminClient() {
  const env = serverEnv();
  return createSupabaseClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SECRET_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
