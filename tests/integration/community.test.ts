import { afterAll, describe, expect, it } from "vitest";

import { adminClient, anonClient, hasLiveEnv } from "./helpers";

const describeLive = hasLiveEnv ? describe : describe.skip;

const AIRPORT = "00000000-0000-4000-8000-000000000001";
const STATE_FAIR = "00000000-0000-4000-8000-000000000002";

describeLive("ratings and saves", () => {
  const admin = adminClient();
  const createdUsers: string[] = [];

  afterAll(async () => {
    for (const id of createdUsers) {
      await admin.auth.admin.deleteUser(id).catch(() => {});
    }
  });

  async function signedInUser() {
    const email = `community-${crypto.randomUUID()}@example.com`;
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

  it("records a rating and returns the aggregate", async () => {
    const { client } = await signedInUser();
    const { data, error } = await client.rpc("rate_game", {
      p_game_template_id: AIRPORT,
      p_rating: 4,
    });
    expect(error).toBeNull();
    expect(data.yours).toBe(4);
    expect(Number(data.count)).toBeGreaterThan(0);
  });

  it("replaces a previous rating rather than adding another", async () => {
    const { client, userId } = await signedInUser();

    await client.rpc("rate_game", { p_game_template_id: STATE_FAIR, p_rating: 1 });
    await client.rpc("rate_game", { p_game_template_id: STATE_FAIR, p_rating: 5 });

    const { count } = await admin
      .from("game_ratings")
      .select("id", { count: "exact", head: true })
      .eq("game_template_id", STATE_FAIR)
      .eq("user_id", userId);

    expect(count).toBe(1);
  });

  it("rejects an out-of-range rating", async () => {
    const { client } = await signedInUser();
    const { error } = await client.rpc("rate_game", {
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
    const { client, userId } = await signedInUser();

    const on = await client.rpc("toggle_save", { p_game_template_id: AIRPORT });
    expect(on.data.saved).toBe(true);

    const off = await client.rpc("toggle_save", { p_game_template_id: AIRPORT });
    expect(off.data.saved).toBe(false);

    const { count } = await admin
      .from("game_saves")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    expect(count).toBe(0);
  });

  it("keeps one user's saves private from another", async () => {
    const a = await signedInUser();
    const b = await signedInUser();

    await a.client.rpc("toggle_save", { p_game_template_id: AIRPORT });

    const { data: bSees } = await b.client.from("game_saves").select("id");
    expect(bSees ?? []).toHaveLength(0);

    const { data: aSees } = await a.client.from("game_saves").select("id");
    expect(aSees).toHaveLength(1);
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
