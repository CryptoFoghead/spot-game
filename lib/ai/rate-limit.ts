import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * AI usage limits (PRD §65), enforced in Postgres so every serverless
 * instance shares one counter. An in-process limiter gave each instance its
 * own budget, making the real ceiling limit x instances.
 *
 * Two limits apply, both claimed in a single atomic call:
 *   - per user, per rolling hour: stops one creator hammering the endpoint
 *   - global, per rolling day: guards the API bill
 */

export type RateLimitResult = {
  allowed: boolean;
  reason: "ok" | "user_limit" | "global_limit" | "unauthenticated" | "error";
  remaining: number;
  retryAfterSeconds: number;
};

export const USER_HOURLY_LIMIT = 10;
export const GLOBAL_DAILY_LIMIT = 500;

/**
 * Claims one generation for the signed-in user, recording it if allowed.
 * Call this immediately before the model request.
 */
export async function claimAiGeneration(
  supabase: SupabaseClient,
  options: { userLimit?: number; globalDailyLimit?: number } = {}
): Promise<RateLimitResult> {
  const { data, error } = await supabase.rpc("claim_ai_generation", {
    p_user_limit: options.userLimit ?? USER_HOURLY_LIMIT,
    p_global_daily_limit: options.globalDailyLimit ?? GLOBAL_DAILY_LIMIT,
  });

  if (error || !data) {
    // Fail closed: a limiter that errors open is not a limiter.
    return {
      allowed: false,
      reason: "error",
      remaining: 0,
      retryAfterSeconds: 60,
    };
  }

  return data as RateLimitResult;
}
