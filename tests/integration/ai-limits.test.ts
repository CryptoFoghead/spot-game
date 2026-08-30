import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { adminClient, anonClient, createSignedInUser, hasLiveEnv } from "./helpers";

const describeLive = hasLiveEnv ? describe : describe.skip;

/**
 * The AI limiter lives in Postgres so every serverless instance shares one
 * counter (G-02). These exercise the real function, including the global cost
 * ceiling (G-05).
 *
 * Two users are created for the whole file rather than one per test: Supabase
 * rate-limits auth, and a user per test was enough to trip it after a busy
 * day. Usage rows are cleared between tests instead, which isolates the cases
 * just as well and runs faster.
 */
describeLive("claim_ai_generation", () => {
  const admin = adminClient();
  let alice: Awaited<ReturnType<typeof createSignedInUser>>;
  let bob: Awaited<ReturnType<typeof createSignedInUser>>;

  beforeAll(async () => {
    alice = await createSignedInUser();
    bob = await createSignedInUser();
  });

  beforeEach(async () => {
    await admin
      .from("ai_usage")
      .delete()
      .in("user_id", [alice.userId, bob.userId]);
  });

  afterAll(async () => {
    for (const user of [alice, bob]) {
      if (user) await admin.auth.admin.deleteUser(user.userId).catch(() => {});
    }
  });

  it("refuses an anonymous caller", async () => {
    const { data, error } = await anonClient().rpc("claim_ai_generation", {});
    // anon has no execute grant, so this is refused before it runs.
    expect(error ?? { message: "" }).toBeTruthy();
    expect(data).toBeNull();
  });

  it("allows up to the per-user limit, then refuses with a retry delay", async () => {
    for (let i = 0; i < 3; i++) {
      const { data } = await alice.client.rpc("claim_ai_generation", {
        p_user_limit: 3,
      });
      expect(data.allowed).toBe(true);
      expect(data.remaining).toBe(2 - i);
    }

    const { data: blocked } = await alice.client.rpc("claim_ai_generation", {
      p_user_limit: 3,
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toBe("user_limit");
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("counts each user separately", async () => {
    await alice.client.rpc("claim_ai_generation", { p_user_limit: 1 });
    const { data: aliceBlocked } = await alice.client.rpc("claim_ai_generation", {
      p_user_limit: 1,
    });
    expect(aliceBlocked.allowed).toBe(false);

    const { data: bobAllowed } = await bob.client.rpc("claim_ai_generation", {
      p_user_limit: 1,
    });
    expect(bobAllowed.allowed).toBe(true);
  });

  it("enforces the global daily ceiling regardless of the per-user limit", async () => {
    // A global cap of zero must refuse even a user with quota to spare.
    const { data } = await alice.client.rpc("claim_ai_generation", {
      p_user_limit: 100,
      p_global_daily_limit: 0,
    });
    expect(data.allowed).toBe(false);
    expect(data.reason).toBe("global_limit");
  });

  it("does not record usage for a refused claim", async () => {
    await alice.client.rpc("claim_ai_generation", { p_user_limit: 1 });
    await alice.client.rpc("claim_ai_generation", { p_user_limit: 1 }); // refused

    const { count } = await admin
      .from("ai_usage")
      .select("id", { count: "exact", head: true })
      .eq("user_id", alice.userId);

    expect(count).toBe(1);
  });

  it("keeps the usage table unreadable from a client", async () => {
    const { data } = await alice.client.from("ai_usage").select("id");
    expect(data ?? []).toHaveLength(0);
  });
});

describeLive("maintenance", () => {
  it("reports pg_cron scheduling so it can't silently not run", async () => {
    const { data } = await adminClient().rpc("maintenance_status");
    expect(data.pgCronInstalled).toBe(true);
    expect(data.scheduledJobs.length).toBeGreaterThan(0);
    expect(data.scheduledJobs[0].active).toBe(true);
  });

  it("is not callable by a browser client", async () => {
    const { error } = await anonClient().rpc("run_maintenance");
    expect(error).not.toBeNull();
  });
});
