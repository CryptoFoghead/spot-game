import * as Sentry from "@sentry/nextjs";

import { withinSentryBudget } from "@/lib/sentry-budget";

/**
 * Server-side Sentry.
 *
 * Deliberately errors only. Tracing (`tracesSampleRate`) and session replay
 * bill against *separate* quotas from errors, and this app shares one
 * organisation quota with another project — so turning them on would consume
 * budget that error reporting needs. Raise them later if a performance
 * question actually needs answering.
 *
 * Inert when SENTRY_DSN is unset, so the app runs unchanged without it.
 */
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),
  environment: process.env.VERCEL_ENV ?? "development",
  release: process.env.VERCEL_GIT_COMMIT_SHA,

  tracesSampleRate: 0,
  // Errors only: no performance data, no profiling.
  sendDefaultPii: false,

  // Bounded so a hot loop cannot drain a quota shared with another project.
  beforeSend: (event) => (withinSentryBudget() ? event : null),

  ignoreErrors: [
    // Next's redirect() and notFound() throw by design; they are control
    // flow, not failures, and would otherwise flood the quota.
    "NEXT_REDIRECT",
    "NEXT_NOT_FOUND",
  ],
});
