import "server-only";

/**
 * Per-user rate limiting for the AI endpoint (PRD §65).
 *
 * In-memory and therefore per-instance: it stops one signed-in creator from
 * hammering the endpoint from a browser, which is the MVP requirement. It is
 * NOT a distributed limiter — on multiple serverless instances the effective
 * ceiling is (limit x instances). Move this to Postgres or Redis before the
 * endpoint is exposed to real traffic at scale.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export function checkRateLimit(
  key: string,
  limit = 10,
  windowMs = 60 * 60 * 1000
): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  if (bucket.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }

  bucket.count += 1;
  return {
    allowed: true,
    remaining: limit - bucket.count,
    retryAfterSeconds: 0,
  };
}

/** Test seam. */
export function resetRateLimits() {
  buckets.clear();
}
