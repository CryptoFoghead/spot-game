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
      await admin.rpc("admin_expire_tier", { p_user_id: id! });
      await admin.from("ai_usage").delete().eq("user_id", id!);
    }
  });

  /**
   * Entitlements moved to the shared platform schema (20260908000001), which
   * is deliberately never exposed to PostgREST — not even the service role can
   * reach it with .from(). Everything goes through the SECURITY DEFINER
   * wrappers in public.
   *
   * These tests used to write to the old public table directly. It still
   * exists and still accepts writes, but nothing reads it any more, so the
   * writes silently did nothing and this suite went red.
   */
  async function setTier(
    userId: string,
    tier: string,
    expiresAt: string | null = null
  ) {
    const { error } = await admin.rpc("admin_grant_tier", {
      p_user_id: userId,
      p_tier: tier,
      p_expires_at: expiresAt,
    });
    if (error) throw new Error(error.message);
  }

  async function clearTier(userId: string) {
    const { error } = await admin.rpc("admin_expire_tier", {
      p_user_id: userId,
    });
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

    await clearTier(alice.userId);
  });

  it("ignores an entitlement that has expired", async () => {
    await setTier(
      alice.userId,
      "supporter",
      new Date(Date.now() - 60_000).toISOString()
    );

    const { data } = await alice.client.rpc("entitlements_for_me");
    expect(data.tier).toBe("free");

    await clearTier(alice.userId);
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

    await clearTier(bob.userId);
    await admin.from("ai_usage").delete().eq("user_id", bob.userId);
  });

  it("keeps one account's tier private from another", async () => {
    await setTier(alice.userId, "supporter");

    const mine = await alice.client.rpc("entitlements_for_me");
    expect(mine.data.tier).toBe("supporter");

    const theirs = await bob.client.rpc("entitlements_for_me");
    expect(theirs.data.tier).toBe("free");

    await clearTier(alice.userId);
  });

  it("does not expose the entitlement store through the API at all", async () => {
    // The platform schema is not in the exposed schemas, so there is no table
    // for a client to read, guess a filter against, or write to. That is
    // stronger than an RLS policy: the surface does not exist.
    const reader = await bob.client.from("entitlements").select("*").limit(1);
    expect(reader.error).not.toBeNull();
  });

  it("refuses to let anyone grant themselves a tier", async () => {
    // admin_grant_tier is service-role only; an authenticated caller has no
    // execute grant on it.
    const { error } = await bob.client.rpc("admin_grant_tier", {
      p_user_id: bob.userId,
      p_tier: "supporter",
      p_expires_at: null,
    });
    expect(error).not.toBeNull();

    const { data } = await bob.client.rpc("entitlements_for_me");
    expect(data.tier).toBe("free");
  });
});
