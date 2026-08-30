import * as Sentry from "@sentry/nextjs";

/** Edge runtime (the proxy/middleware). Same errors-only posture. */
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),
  environment: process.env.VERCEL_ENV ?? "development",
  release: process.env.VERCEL_GIT_COMMIT_SHA,
  tracesSampleRate: 0,
  sendDefaultPii: false,
  ignoreErrors: ["NEXT_REDIRECT", "NEXT_NOT_FOUND"],
});
