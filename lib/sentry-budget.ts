/**
 * Server-side event budget for Sentry.
 *
 * Sentry's per-key rate limits require a Business plan, and this organisation's
 * quota is shared with another project. A retry storm or a hot loop in a route
 * handler could otherwise drain the pool and blind us on the other app.
 *
 * This is a sliding window per server instance. Like the AI limiter before it,
 * it is not distributed — several instances each get their own budget — but it
 * turns an unbounded flood into a bounded one, which is the point.
 */

const WINDOW_MS = 60_000;
const MAX_EVENTS_PER_WINDOW = 30;

let windowStart = 0;
let count = 0;
let suppressed = 0;

/** True when the event should be sent. Call once per outgoing event. */
export function withinSentryBudget(now = Date.now()): boolean {
  if (now - windowStart > WINDOW_MS) {
    // Report what the previous window swallowed, so truncation is visible.
    if (suppressed > 0) {
      console.warn(
        JSON.stringify({
          tag: "spot_warning",
          scope: "sentry.budget",
          message: `suppressed ${suppressed} Sentry events in the previous window`,
          at: new Date(now).toISOString(),
        })
      );
    }
    windowStart = now;
    count = 0;
    suppressed = 0;
  }

  count += 1;
  if (count > MAX_EVENTS_PER_WINDOW) {
    suppressed += 1;
    return false;
  }
  return true;
}

/** Test seam. */
export function resetSentryBudget() {
  windowStart = 0;
  count = 0;
  suppressed = 0;
}
