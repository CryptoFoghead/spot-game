import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ENTITLEMENTS, TIERS } from "@/lib/entitlements";

import {
  adminClient,
  anonClient,
  createSignedInUser,
  hasLiveEnv,
} from "./helpers";

const describeLive = hasLiveEnv ? describe : describe.skip;

describeLive("entitlements", () => {
  const admin = adminClient();
  let alice: Awaited<ReturnType<typeof createSignedInUser>>;
  let bob: Awaited<ReturnType<typeof createSignedInUser>>;

  beforeAll(async () => {
    alice = await createSignedInUser();
    bob = await createSignedInUser();
  });

  afterAll(async () => {
    for (const id of [alice?.userId, bob?.userId].filter(Boolean)) {
      await admin.from("user_entitlements").delete().eq("user_id", id!);
      await admin.from("ai_usage").delete().eq("user_id", id!);
    }
  });

  async function setTier(userId: string, tier: string) {
    const { error } = await admin
      .from("user_entitlements")
      .upsert({ user_id: userId, tier, source: "manual" });
    if (error) throw new Error(error.message);
  }

  /**
   * The limits exist twice — in SQL, which enforces them, and in TypeScript,
   * which describes them to the UI. Two copies of a number drift, so this is
   * the test that stops it, the same way the bingo rules are kept honest.
   */
  it("agrees with the database about every tier's allowance", async () => {
    for (const tier of TIERS) {
      const { data, error } = await admin.rpc("ai_hourly_limit_for", {
        p_tier: tier,
      });
      expect(error).toBeNull();
      expect(data).toBe(ENTITLEMENTS[tier].aiGenerationsPerHour);
    }
  });

  it("treats an account with no entitlement row as free", async () => {
    const { data, error } = await alice.client.rpc("entitlements_for_me");
    expect(error).toBeNull();
    expect(data.tier).toBe("free");
    expect(data.aiGenerationsPerHour).toBe(
      ENTITLEMENTS.free.aiGenerationsPerHour
    );
    expect(data.adFree).toBe(false);
  });

  it("reports the granted tier once one exists", async () => {
    await setTier(alice.userId, "supporter");

    const { data } = await alice.client.rpc("entitlements_for_me");
    expect(data.tier).toBe("supporter");
    expect(data.aiGenerationsPerHour).toBe(
      ENTITLEMENTS.supporter.aiGenerationsPerHour
    );
    expect(data.adFree).toBe(true);

    await setTier(alice.userId, "free");
  });

  it("ignores an entitlement that has expired", async () => {
    await admin.from("user_entitlements").upsert({
      user_id: alice.userId,
      tier: "supporter",
      source: "manual",
      expires_at: new Date(Date.now() - 60_000).toISOString(),
    });

    const { data } = await alice.client.rpc("entitlements_for_me");
    expect(data.tier).toBe("free");

    await admin.from("user_entitlements").delete().eq("user_id", alice.userId);
  });

  it("refuses to tell an anonymous caller anything", async () => {
    const { data, error } = await anonClient().rpc("entitlements_for_me");
    expect(error ?? { message: "" }).toBeTruthy();
    expect(data).toBeNull();
  });

  /**
   * The security property. Before this, the per-user ceiling was whatever the
   * caller sent — our route sent the right number, but nothing made it.
   */
  it("will not let a caller raise its own limit", async () => {
    await admin.from("ai_usage").delete().eq("user_id", bob.userId);
    // Bob is free: 10 an hour. Ask for 1000 and the tier still decides.
    for (let i = 0; i < ENTITLEMENTS.free.aiGenerationsPerHour; i++) {
      const { data } = await bob.client.rpc("claim_ai_generation", {
        p_user_limit: 1000,
      });
      expect(data.allowed).toBe(true);
    }

    const { data: blocked } = await bob.client.rpc("claim_ai_generation", {
      p_user_limit: 1000,
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toBe("user_limit");

    await admin.from("ai_usage").delete().eq("user_id", bob.userId);
  });

  it("applies the tier when the limit arrives as an explicit null", async () => {
    // This is the exact shape lib/ai/rate-limit.ts sends. PostgREST can treat
    // an explicit null differently from an omitted argument, and if it read as
    // zero here every generation would be refused, so the production call
    // shape gets its own test rather than relying on the `{}` one above.
    await admin.from("ai_usage").delete().eq("user_id", bob.userId);

    const { data, error } = await bob.client.rpc("claim_ai_generation", {
      p_user_limit: null,
      p_global_daily_limit: 500,
    });

    expect(error).toBeNull();
    expect(data.allowed).toBe(true);
    expect(data.remaining).toBe(ENTITLEMENTS.free.aiGenerationsPerHour - 1);

    await admin.from("ai_usage").delete().eq("user_id", bob.userId);
  });

  it("still lets a caller ask for something stricter", async () => {
    await admin.from("ai_usage").delete().eq("user_id", bob.userId);

    const { data: first } = await bob.client.rpc("claim_ai_generation", {
      p_user_limit: 1,
    });
    expect(first.allowed).toBe(true);

    const { data: second } = await bob.client.rpc("claim_ai_generation", {
      p_user_limit: 1,
    });
    expect(second.allowed).toBe(false);

    await admin.from("ai_usage").delete().eq("user_id", bob.userId);
  });

  it("gives a supporter the larger allowance", async () => {
    await admin.from("ai_usage").delete().eq("user_id", bob.userId);
    await setTier(bob.userId, "supporter");

    // One past what a free account would get.
    for (let i = 0; i <= ENTITLEMENTS.free.aiGenerationsPerHour; i++) {
      const { data } = await bob.client.rpc("claim_ai_generation", {});
      expect(data.allowed).toBe(true);
    }

    await setTier(bob.userId, "free");
    await admin.from("ai_usage").delete().eq("user_id", bob.userId);
  });

  it("keeps one account's tier private from another", async () => {
    await setTier(alice.userId, "supporter");

    const { data } = await bob.client
      .from("user_entitlements")
      .select("*")
      .eq("user_id", alice.userId);
    expect(data).toEqual([]);

    // And you can read your own.
    const mine = await alice.client
      .from("user_entitlements")
      .select("tier")
      .eq("user_id", alice.userId);
    expect(mine.data).toEqual([{ tier: "supporter" }]);

    await admin.from("user_entitlements").delete().eq("user_id", alice.userId);
  });

  it("refuses to let anyone grant themselves a tier", async () => {
    const { error } = await bob.client
      .from("user_entitlements")
      .insert({ user_id: bob.userId, tier: "supporter" });
    expect(error).not.toBeNull();

    const { data } = await bob.client.rpc("entitlements_for_me");
    expect(data.tier).toBe("free");
  });
});
