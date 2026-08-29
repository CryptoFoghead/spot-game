import fs from "node:fs";
import path from "node:path";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const envPath = path.resolve(process.cwd(), ".env.local");

/** Integration tests need a real project; they skip when it isn't configured. */
export const hasLiveEnv = fs.existsSync(envPath);

function readEnv(): Record<string, string> {
  if (!hasLiveEnv) return {};
  return Object.fromEntries(
    fs
      .readFileSync(envPath, "utf8")
      .split("\n")
      .filter((line) => line.includes("="))
      .map((line) => [
        line.slice(0, line.indexOf("=")).trim(),
        line.slice(line.indexOf("=") + 1).trim(),
      ])
  );
}

const env = readEnv();

/** Anonymous client — the same access level a guest player's browser has. */
export function anonClient(): SupabaseClient {
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

/** Service-role client — test setup/teardown only, never app code. */
export function adminClient(): SupabaseClient {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function testToken(label: string): string {
  return `test-${label}-${crypto.randomUUID()}${crypto.randomUUID()}`;
}

export const AIRPORT_BINGO_ID = "00000000-0000-4000-8000-000000000001";

/** Deletes rooms created by a test run (cascades to players/cards/events). */
export async function deleteRoom(roomId: string) {
  await adminClient().from("rooms").delete().eq("id", roomId);
}
