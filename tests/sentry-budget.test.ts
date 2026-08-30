import { beforeEach, describe, expect, it } from "vitest";

import { resetSentryBudget, withinSentryBudget } from "@/lib/sentry-budget";

/**
 * Substitutes for Sentry's per-key rate limit, which requires a Business plan.
 * The organisation's quota is shared with another project, so an unbounded
 * error loop here would blind us there.
 */
describe("withinSentryBudget", () => {
  beforeEach(() => resetSentryBudget());

  const T0 = 1_000_000;

  it("allows events up to the window limit", () => {
    for (let i = 0; i < 30; i++) {
      expect(withinSentryBudget(T0)).toBe(true);
    }
  });

  it("suppresses events past the limit within the same window", () => {
    for (let i = 0; i < 30; i++) withinSentryBudget(T0);
    expect(withinSentryBudget(T0)).toBe(false);
    expect(withinSentryBudget(T0)).toBe(false);
  });

  it("allows events again once the window rolls over", () => {
    for (let i = 0; i < 40; i++) withinSentryBudget(T0);
    expect(withinSentryBudget(T0)).toBe(false);

    // A minute later the window resets.
    expect(withinSentryBudget(T0 + 61_000)).toBe(true);
  });

  it("bounds a sustained flood rather than passing it through", () => {
    let allowed = 0;
    // 1,000 errors in one window — the loop case this exists for.
    for (let i = 0; i < 1000; i++) {
      if (withinSentryBudget(T0)) allowed += 1;
    }
    expect(allowed).toBe(30);
  });

  it("does not carry suppression into the next window", () => {
    for (let i = 0; i < 100; i++) withinSentryBudget(T0);

    let allowed = 0;
    for (let i = 0; i < 30; i++) {
      if (withinSentryBudget(T0 + 61_000)) allowed += 1;
    }
    expect(allowed).toBe(30);
  });
});
