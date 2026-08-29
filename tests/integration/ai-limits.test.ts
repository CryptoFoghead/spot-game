import { afterAll, describe, expect, it } from "vitest";

import { adminClient, anonClient, hasLiveEnv } from "./helpers";

const describeLive = hasLiveEnv ? describe : describe.skip;

/**
 * The AI limiter lives in Postgres so every serverless instance shares one
 * counter (G-02). These tests exercise the real function, including the
 * global cost ceiling (G-05).
 */
describeLive("claim_ai_generation", () => {
  const createdUsers: string[] = [];
  const admin = adminClient();

  afterAll(async () => {
    for (const id of createdUsers) {
      await admin.auth.admin.deleteUser(id).catch(() => {});
    }
  });

  /** A signed-in client for a throwaway user. */
  async function signedInUser() {
    const email = `ai-limit-${crypto.randomUUID()}@example.com`;
    const { data: created } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    createdUsers.push(created.user!.id);

    const { data: link } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    const client = anonClient();
    await client.auth.verifyOtp({
      token_hash: link.properties!.hashed_token,
      type: "email",
    });
    return { client, userId: created.user!.id };
  }

  it("refuses an anonymous caller", async () => {
    const { data } = await anonClient().rpc("claim_ai_generation", {});
    // anon has no execute grant, so this is refused before it runs.
    expect(data ?? { allowed: false }).toMatchObject({ allowed: false });
  });

  it("allows up to the per-user limit, then refuses with a retry delay", async () => {
    const { client } = await signedInUser();

    for (let i = 0; i < 3; i++) {
      const { data } = await client.rpc("claim_ai_generation", {
        p_user_limit: 3,
      });
      expect(data.allowed).toBe(true);
      expect(data.remaining).toBe(2 - i);
    }

    const { data: blocked } = await client.rpc("claim_ai_generation", {
      p_user_limit: 3,
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toBe("user_limit");
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("counts each user separately", async () => {
    const a = await signedInUser();
    const b = await signedInUser();

    await a.client.rpc("claim_ai_generation", { p_user_limit: 1 });
    const { data: aBlocked } = await a.client.rpc("claim_ai_generation", {
      p_user_limit: 1,
    });
    expect(aBlocked.allowed).toBe(false);

    const { data: bAllowed } = await b.client.rpc("claim_ai_generation", {
      p_user_limit: 1,
    });
    expect(bAllowed.allowed).toBe(true);
  });

  it("enforces the global daily ceiling regardless of the per-user limit", async () => {
    const { client } = await signedInUser();

    // A global cap of zero must refuse even a user with quota to spare.
    const { data } = await client.rpc("claim_ai_generation", {
      p_user_limit: 100,
      p_global_daily_limit: 0,
    });
    expect(data.allowed).toBe(false);
    expect(data.reason).toBe("global_limit");
  });

  it("does not record usage for a refused claim", async () => {
    const { client, userId } = await signedInUser();

    await client.rpc("claim_ai_generation", { p_user_limit: 1 });
    await client.rpc("claim_ai_generation", { p_user_limit: 1 }); // refused

    const { count } = await admin
      .from("ai_usage")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    expect(count).toBe(1);
  });

  it("keeps the usage table unreadable from a client", async () => {
    const { client } = await signedInUser();
    const { data } = await client.from("ai_usage").select("id");
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
