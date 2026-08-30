/**
 * Keeps a form usable when the network is not.
 *
 * A server action invoked from `useActionState` **rejects** when the request
 * cannot be made at all. React lets that reach the nearest error boundary,
 * which replaces the whole page — so someone joining a game at a restaurant
 * with bad wifi lost the nickname they had typed and got "Something went
 * wrong. That's on us", which blames us for their connection and promises
 * their card is safe when they do not have one yet (B-21).
 *
 * Wrapping the action turns that into an ordinary form error: they stay on the
 * page, keep what they typed, and are told what to do.
 *
 * A **server-side** exception must still reach the error boundary — it is a
 * real bug and hiding it behind "check your connection" would be a lie, and
 * would stop it being reported. Next attaches a `digest` to errors that came
 * from the server, so those are rethrown untouched. Verified both ways rather
 * than assumed: see tests/forms.test.ts.
 */
export function withNetworkGuard<S extends { error?: string }, P>(
  action: (state: S, payload: P) => Promise<S>,
  message = "Couldn't reach the server. Check your connection and try again."
): (state: S, payload: P) => Promise<S> {
  return async (state, payload) => {
    try {
      return await action(state, payload);
    } catch (error) {
      if (isServerError(error)) throw error;
      return { ...state, error: message };
    }
  };
}

/** Errors raised inside a server action arrive carrying a `digest`. */
function isServerError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string"
  );
}
