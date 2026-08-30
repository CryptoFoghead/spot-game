import { describe, expect, it } from "vitest";

import { withNetworkGuard } from "@/lib/forms";

type State = { error?: string; sent?: boolean };

/**
 * The distinction this guard exists to make (B-21):
 *
 *   network gone  -> an ordinary form error, so the page and what was typed
 *                    survive
 *   server threw  -> rethrown, so the error boundary still shows it and it
 *                    still gets reported
 *
 * Getting that backwards in either direction is worse than not guarding at
 * all: it would either blame the user's wifi for our bug, or lose the form to
 * a full-page error because a restaurant's network hiccuped.
 */
describe("withNetworkGuard", () => {
  it("passes a successful result straight through", async () => {
    const guarded = withNetworkGuard<State, FormData>(async () => ({ sent: true }) as State);
    await expect(guarded({}, new FormData())).resolves.toEqual({ sent: true });
  });

  it("passes a returned error through untouched", async () => {
    // An action that *returns* {error} is working correctly — it validated
    // something and said no. That message must not be replaced.
    const guarded = withNetworkGuard<State, FormData>(async () => ({
      error: "That nickname is taken.",
    }));
    await expect(guarded({}, new FormData())).resolves.toEqual({
      error: "That nickname is taken.",
    });
  });

  it("turns a network rejection into a form error", async () => {
    const guarded = withNetworkGuard<State, FormData>(async () => {
      throw new TypeError("Failed to fetch");
    });

    await expect(guarded({}, new FormData())).resolves.toEqual({
      error: "Couldn't reach the server. Check your connection and try again.",
    });
  });

  it("keeps the rest of the state when it fails", async () => {
    const guarded = withNetworkGuard<State, FormData>(async () => {
      throw new TypeError("Failed to fetch");
    });

    await expect(guarded({ sent: true }, new FormData())).resolves.toEqual({
      sent: true,
      error: "Couldn't reach the server. Check your connection and try again.",
    });
  });

  it("uses the caller's message", async () => {
    const guarded = withNetworkGuard<State, FormData>(async () => {
      throw new TypeError("Failed to fetch");
    }, "Couldn't reach the game. Check your connection and try again.");

    await expect(guarded({}, new FormData())).resolves.toEqual({
      error: "Couldn't reach the game. Check your connection and try again.",
    });
  });

  it("rethrows a server-side error so the boundary still sees it", async () => {
    // Next attaches a digest to errors thrown inside a server action. Verified
    // against a real action made to throw: it reached the error boundary and
    // was NOT reported as a connection problem.
    const serverError = Object.assign(new Error("boom"), { digest: "1234567" });
    const guarded = withNetworkGuard<State, FormData>(async () => {
      throw serverError;
    });

    await expect(guarded({}, new FormData())).rejects.toBe(serverError);
  });

  it("does not mistake a non-string digest for a server error", async () => {
    const odd = Object.assign(new TypeError("Failed to fetch"), { digest: 7 });
    const guarded = withNetworkGuard<State, FormData>(async () => {
      throw odd;
    });

    await expect(guarded({}, new FormData())).resolves.toEqual({
      error: "Couldn't reach the server. Check your connection and try again.",
    });
  });
});
