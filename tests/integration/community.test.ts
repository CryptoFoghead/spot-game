import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { adminClient, anonClient, createSignedInUser, hasLiveEnv } from "./helpers";

const describeLive = hasLiveEnv ? describe : describe.skip;

const AIRPORT = "00000000-0000-4000-8000-000000000001";
const STATE_FAIR = "00000000-0000-4000-8000-000000000002";

/**
 * Two users for the whole file rather than one per test. Supabase rate-limits
 * auth, and a user per test tripped it after a busy day of runs; clearing rows
 * between tests isolates the cases just as well and runs faster.
 */
describeLive("ratings and saves", () => {
  const admin = adminClient();
  let alice: Awaited<ReturnType<typeof createSignedInUser>>;
  let bob: Awaited<ReturnType<typeof createSignedInUser>>;

  beforeAll(async () => {
    alice = await createSignedInUser();
    bob = await createSignedInUser();
  });

  beforeEach(async () => {
    const ids = [alice.userId, bob.userId];
    await admin.from("game_ratings").delete().in("user_id", ids);
    await admin.from("game_saves").delete().in("user_id", ids);
  });

  afterAll(async () => {
    for (const user of [alice, bob]) {
      if (user) await admin.auth.admin.deleteUser(user.userId).catch(() => {});
    }
  });

  it("records a rating and returns the aggregate", async () => {
    const { data, error } = await alice.client.rpc("rate_game", {
      p_game_template_id: AIRPORT,
      p_rating: 4,
    });
    expect(error).toBeNull();
    expect(data.yours).toBe(4);
    expect(Number(data.count)).toBeGreaterThan(0);
  });

  it("replaces a previous rating rather than adding another", async () => {
    await alice.client.rpc("rate_game", {
      p_game_template_id: STATE_FAIR,
      p_rating: 1,
    });
    await alice.client.rpc("rate_game", {
      p_game_template_id: STATE_FAIR,
      p_rating: 5,
    });

    const { count } = await admin
      .from("game_ratings")
      .select("id", { count: "exact", head: true })
      .eq("game_template_id", STATE_FAIR)
      .eq("user_id", alice.userId);

    expect(count).toBe(1);
  });

  it("rejects an out-of-range rating", async () => {
    const { error } = await alice.client.rpc("rate_game", {
      p_game_template_id: AIRPORT,
      p_rating: 9,
    });
    expect(error).not.toBeNull();
  });

  it("refuses to rate anonymously", async () => {
    const { error } = await anonClient().rpc("rate_game", {
      p_game_template_id: AIRPORT,
      p_rating: 5,
    });
    expect(error).not.toBeNull();
  });

  it("toggles a save on and off", async () => {
    const on = await alice.client.rpc("toggle_save", {
      p_game_template_id: AIRPORT,
    });
    expect(on.data.saved).toBe(true);

    const off = await alice.client.rpc("toggle_save", {
      p_game_template_id: AIRPORT,
    });
    expect(off.data.saved).toBe(false);

    const { count } = await admin
      .from("game_saves")
      .select("id", { count: "exact", head: true })
      .eq("user_id", alice.userId);
    expect(count).toBe(0);
  });

  it("keeps one user's saves private from another", async () => {
    await alice.client.rpc("toggle_save", { p_game_template_id: AIRPORT });

    const { data: bobSees } = await bob.client.from("game_saves").select("id");
    expect(bobSees ?? []).toHaveLength(0);

    const { data: aliceSees } = await alice.client.from("game_saves").select("id");
    expect(aliceSees).toHaveLength(1);
  });

  it("exposes the aggregate publicly but not who voted", async () => {
    const { data } = await anonClient().rpc("game_rating", {
      p_game_template_id: AIRPORT,
    });
    expect(data).toHaveProperty("average");
    expect(data).toHaveProperty("count");
    expect(data.yours).toBeNull();
  });

  it("returns trending games from real room activity", async () => {
    const { data, error } = await anonClient().rpc("trending_games", {
      p_days: 7,
      p_limit: 5,
    });
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });
});
