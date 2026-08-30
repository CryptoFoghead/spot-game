/**
 * What each tier of account is allowed to do.
 *
 * There is nothing to buy yet (G-22). This exists so that when there is, the
 * answer to "can this account do X" already lives in one place instead of
 * being threaded through every limit after the fact.
 *
 * The database is the authority — `ai_hourly_limit_for()` in migration 0027
 * decides the real ceiling, and a caller cannot raise its own. These values
 * mirror the SQL so the UI can say what someone gets without a round trip, and
 * `tests/integration/entitlements.test.ts` fails if the two ever disagree.
 */

export const TIERS = ["free", "supporter"] as const;

export type Tier = (typeof TIERS)[number];

export type Entitlements = {
  tier: Tier;
  /** AI square generations per rolling hour. */
  aiGenerationsPerHour: number;
  /** Reserved for when ads exist; nothing reads this yet. */
  adFree: boolean;
};

export const ENTITLEMENTS: Record<Tier, Entitlements> = {
  free: { tier: "free", aiGenerationsPerHour: 10, adFree: false },
  supporter: { tier: "supporter", aiGenerationsPerHour: 60, adFree: true },
};

/** Everyone who is not signed in, or has no entitlement row, is free. */
export const DEFAULT_TIER: Tier = "free";

export function isTier(value: unknown): value is Tier {
  return typeof value === "string" && (TIERS as readonly string[]).includes(value);
}

/**
 * Never throws on an unknown tier: a value the database grew that this build
 * has not heard of should degrade to free, not break the page.
 */
export function entitlementsFor(tier: unknown): Entitlements {
  return ENTITLEMENTS[isTier(tier) ? tier : DEFAULT_TIER];
}
