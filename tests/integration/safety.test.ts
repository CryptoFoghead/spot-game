import { afterAll, describe, expect, it } from "vitest";

import { adminClient, anonClient, hasLiveEnv } from "./helpers";

const describeLive = hasLiveEnv ? describe : describe.skip;

const AIRPORT = "00000000-0000-4000-8000-000000000001";

describeLive("report_game (PRD §55)", () => {
  const admin = adminClient();
  const reportIds: string[] = [];

  afterAll(async () => {
    if (reportIds.length) {
      await admin.from("reports").delete().in("id", reportIds);
    }
    // Remove anything else this suite filed against the seeded game.
    await admin.from("reports").delete().eq("game_template_id", AIRPORT);
  });

  it("accepts an anonymous report — requiring an account suppresses reports", async () => {
    const { data, error } = await anonClient().rpc("report_game", {
      p_game_template_id: AIRPORT,
      p_reason: "spam",
      p_details: "integration test",
    });
    expect(error).toBeNull();
    expect(data.reported).toBe(true);

    const { data: rows } = await admin
      .from("reports")
      .select("id, reason, status")
      .eq("game_template_id", AIRPORT);
    expect(rows!.length).toBeGreaterThan(0);
    expect(rows![0].status).toBe("open");
    reportIds.push(...rows!.map((r) => r.id));
  });

  it("rejects an invalid reason", async () => {
    const { error } = await anonClient().rpc("report_game", {
      p_game_template_id: AIRPORT,
      p_reason: "because",
    });
    expect(error?.message).toMatch(/invalid reason/);
  });

  it("rejects a report against a game that isn't published", async () => {
    const { error } = await anonClient().rpc("report_game", {
      p_game_template_id: "00000000-0000-4000-8000-00000000dead",
      p_reason: "spam",
    });
    expect(error?.message).toMatch(/game not found/);
  });

  it("keeps the reports table unreadable from a browser", async () => {
    const { data } = await anonClient().from("reports").select("id");
    expect(data ?? []).toHaveLength(0);
  });

  it("does not expose the moderation queue to anonymous callers", async () => {
    const { error } = await anonClient().rpc("open_reports");
    expect(error).not.toBeNull();
  });
});

describeLive("delete_my_account (PRD §57)", () => {
  const admin = adminClient();

  async function signedInUser() {
    const email = `delete-me-${crypto.randomUUID()}@example.com`;
    const { data: created } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
    });
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

  it("removes the user, their profile and their games", async () => {
    const { client, userId } = await signedInUser();

    const { data: game } = await client
      .from("game_templates")
      .insert({
        title: "Doomed Test Game",
        category: "custom",
        content_rating: "family",
        visibility: "private",
        creator_id: userId,
      })
      .select("id")
      .single();
    expect(game?.id).toBeTruthy();

    const { data, error } = await client.rpc("delete_my_account");
    expect(error).toBeNull();
    expect(data.deleted).toBe(true);
    expect(data.gamesRemoved).toBeGreaterThanOrEqual(1);

    const { data: users } = await admin.auth.admin.listUsers();
    expect(users.users.find((u) => u.id === userId)).toBeUndefined();

    const { count: games } = await admin
      .from("game_templates")
      .select("id", { count: "exact", head: true })
      .eq("id", game!.id);
    expect(games).toBe(0);

    const { count: profiles } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("id", userId);
    expect(profiles).toBe(0);
  });

  it("refuses an anonymous caller", async () => {
    const { error } = await anonClient().rpc("delete_my_account");
    expect(error).not.toBeNull();
  });
});

describeLive("product_metrics (PRD §58, §92)", () => {
  it("reports the north-star metric and funnel", async () => {
    const { data, error } = await adminClient().rpc("product_metrics", {
      p_days: 7,
    });
    expect(error).toBeNull();
    expect(data.northStar).toHaveProperty("completedMultiplayerRooms");
    expect(data.funnel).toHaveProperty("startRate");
    expect(data.activity).toHaveProperty("squaresMarked");
  });

  it("is not readable by a browser client", async () => {
    const { error } = await anonClient().rpc("product_metrics");
    expect(error).not.toBeNull();
  });
});
