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

/**
 * `describe.skip` still RUNS the suite body — it only skips the tests inside.
 * Every integration file builds its clients there, so without this the files
 * threw "supabaseUrl is required" during collection on any machine with no
 * `.env.local`, which is exactly what CI is (BUG_LIST B-18).
 *
 * A stub that throws on use is better than a placeholder URL: skipped suites
 * never touch it, and a test accidentally written outside `describeLive` fails
 * saying why instead of timing out against a hostname that does not exist.
 */
function unconfiguredClient(): SupabaseClient {
  return new Proxy({} as SupabaseClient, {
    get(_target, property) {
      throw new Error(
        `Integration tests need .env.local (tried to use .${String(property)}). ` +
          "Wrap the suite in describeLive so it skips instead."
      );
    },
  });
}

/** Anonymous client — the same access level a guest player's browser has. */
export function anonClient(): SupabaseClient {
  if (!hasLiveEnv) return unconfiguredClient();
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

/** Service-role client — test setup/teardown only, never app code. */
export function adminClient(): SupabaseClient {
  if (!hasLiveEnv) return unconfiguredClient();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function testToken(label: string): string {
  return `test-${label}-${crypto.randomUUID()}${crypto.randomUUID()}`;
}

/**
 * Creates a throwaway user and returns a client holding their session.
 *
 * Verifies the session actually established. Supabase rate-limits auth
 * operations, and a suite that creates a user per test can quietly exceed it —
 * the client then stays anonymous, RPCs granted to `authenticated` return
 * null, and the failure looks like broken application logic rather than a
 * throttled test. Failing loudly here keeps that distinction visible.
 *
 * Prefer reusing one of these across a file over creating one per test.
 */
const RATE_LIMITED = /rate limit/i;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Vitest runs test files in parallel, so several sign-ins fire at once and
 * Supabase's auth throttle rejects some of them. Each file passes alone but
 * the suite fails together — a scheduling artefact, not a defect, so a bounded
 * backoff is the honest response rather than serialising the whole suite.
 */
export async function createSignedInUser(
  attempt = 1
): Promise<{
  client: SupabaseClient;
  userId: string;
  email: string;
}> {
  try {
    return await signIn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (attempt < 4 && RATE_LIMITED.test(message)) {
      await sleep(attempt * 2500);
      return createSignedInUser(attempt + 1);
    }
    throw error;
  }
}

async function signIn(): Promise<{
  client: SupabaseClient;
  userId: string;
  email: string;
}> {
  const admin = adminClient();
  const email = `test-${crypto.randomUUID()}@example.com`;

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (createError || !created.user) {
    throw new Error(
      `could not create a test user (${createError?.message ?? "no user returned"}) — ` +
        "this is usually Supabase auth rate limiting, not an application failure"
    );
  }

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkError || !link.properties?.hashed_token) {
    throw new Error(`could not generate a sign-in link: ${linkError?.message}`);
  }

  const client = anonClient();
  const { error: otpError } = await client.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: "email",
  });
  if (otpError) {
    throw new Error(
      `sign-in failed for the test user (${otpError.message}) — ` +
        "likely auth rate limiting; re-run in a minute"
    );
  }

  const { data: session } = await client.auth.getUser();
  if (!session.user) {
    throw new Error("test user session did not establish; refusing to run as anonymous");
  }

  return { client, userId: created.user.id, email };
}

export const AIRPORT_BINGO_ID = "00000000-0000-4000-8000-000000000001";

/** Deletes rooms created by a test run (cascades to players/cards/events). */
export async function deleteRoom(roomId: string) {
  await adminClient().from("rooms").delete().eq("id", roomId);
}
