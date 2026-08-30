import * as Sentry from "@sentry/nextjs";

/**
 * One place errors are reported from.
 *
 * Writes a structured JSON line (Vercel captures it; log-drain alerts can
 * match on `"tag":"spot_error"`) *and* forwards to Sentry when a DSN is
 * configured. Both paths are cheap and independent: logs survive if Sentry is
 * unreachable or out of quota, Sentry gives grouping and alerting.
 *
 * Never pass secrets or full request bodies into `context` — these lines are
 * retained by the log provider and sent to Sentry.
 */

export type ErrorContext = Record<string, string | number | boolean | null>;

function serialize(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { name: "NonError", message: String(error) };
}

export function reportError(
  scope: string,
  error: unknown,
  context: ErrorContext = {}
) {
  const payload = {
    tag: "spot_error",
    scope,
    ...serialize(error),
    ...context,
    at: new Date().toISOString(),
  };

  // Single line so log search and alert rules can match reliably.
  console.error(JSON.stringify(payload));

  Sentry.captureException(error, {
    tags: { scope },
    extra: context,
  });
}

/** For handled failures worth seeing but which aren't exceptions. */
export function reportWarning(
  scope: string,
  message: string,
  context: ErrorContext = {}
) {
  console.warn(
    JSON.stringify({
      tag: "spot_warning",
      scope,
      message,
      ...context,
      at: new Date().toISOString(),
    })
  );

  Sentry.captureMessage(message, {
    level: "warning",
    tags: { scope },
    extra: context,
  });
}
