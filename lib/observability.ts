/**
 * One place errors are reported from.
 *
 * Today this writes a single structured JSON line, which Vercel captures and
 * which log-drain alerting can match on (`"spot_error"`). It exists mainly as
 * the seam: wiring Sentry or similar means editing this file only, rather than
 * hunting down scattered console.error calls.
 *
 * Never pass secrets or full request bodies into `context` — these lines are
 * retained by the log provider.
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
}
