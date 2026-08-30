import * as Sentry from "@sentry/nextjs";

/**
 * Browser-side Sentry.
 *
 * Errors only — no tracing, no session replay. Replay in particular has its
 * own quota and would be the fastest way to burn through a shared plan.
 *
 * The DSN is public by design (it is embedded in the client bundle and only
 * permits sending events), which is why it uses the NEXT_PUBLIC_ prefix.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",

  tracesSampleRate: 0,
  sendDefaultPii: false,

  ignoreErrors: [
    "NEXT_REDIRECT",
    "NEXT_NOT_FOUND",
    // Browser extensions and flaky mobile networks generate noise that says
    // nothing about this app; on a shared quota that noise is expensive.
    "ResizeObserver loop",
    "Non-Error promise rejection captured",
    /^Failed to fetch$/,
    /^NetworkError/,
    /^Load failed$/,
  ],

  beforeSend(event) {
    // Realtime WebSocket drops are expected on phones moving between
    // networks — the app resyncs on reconnect by design.
    const value = event.exception?.values?.[0]?.value ?? "";
    if (value.includes("WebSocket") || value.includes("_next/hmr")) {
      return null;
    }
    return event;
  },
});
