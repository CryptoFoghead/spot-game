import { afterAll, describe, expect, it } from "vitest";

import {
  AIRPORT_BINGO_ID,
  anonClient,
  deleteRoom,
  hasLiveEnv,
  testToken,
} from "./helpers";

const describeLive = hasLiveEnv ? describe : describe.skip;

describeLive("room lifecycle RPCs", () => {
  const createdRooms: string[] = [];
  const supabase = anonClient();

  afterAll(async () => {
    for (const id of createdRooms) await deleteRoom(id);
  });

  async function createRoom(hostToken: string) {
    const { data, error } = await supabase.rpc("create_room", {
      p_game_template_id: AIRPORT_BINGO_ID,
      p_host_token: hostToken,
      p_host_nickname: "Host",
    });
    if (error) throw new Error(error.message);
    createdRooms.push(data.roomId);
    return data as { roomId: string; roomCode: string };
  }

  it("creates a room with a 4-digit code for an anonymous host", async () => {
    const room = await createRoom(testToken("host"));
    expect(room.roomCode).toMatch(/^\d{4}$/);
    expect(room.roomId).toMatch(/^[0-9a-f-]{36}$/);
  });

  // PRD §80: a visitor starts a room and one other person joins — BOTH get cards.
  it("gives the host their own card", async () => {
    const hostToken = testToken("host");
    const room = await createRoom(hostToken);
    const { data: snap } = await supabase.rpc("get_room_snapshot", {
      p_room_id: room.roomId,
      p_token: hostToken,
    });
    expect(snap.isHost).toBe(true);
    expect(snap.me.role).toBe("host");
    expect(snap.card).toHaveLength(25);
  });

  /**
   * A session token stays valid until it expires, so auth.uid() can name a
   * user row that no longer exists (account deletion, PRD §57). That used to
   * fail the room_players foreign key and block joining entirely.
   */
  it("lets a signed-in user whose account was deleted still join as a guest", async () => {
    const { adminClient } = await import("./helpers");
    const admin = adminClient();
    const email = `orphan-${crypto.randomUUID()}@example.com`;

    const { data: created } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    const userId = created.user!.id;

    const { data: link } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });

    const staleClient = anonClient();
    const { error: otpError } = await staleClient.auth.verifyOtp({
      token_hash: link.properties!.hashed_token,
      type: "email",
    });
    expect(otpError).toBeNull();

    // The session is now live; remove the underlying user.
    await admin.auth.admin.deleteUser(userId);

    const room = await createRoom(testToken("host"));
    const { data, error } = await staleClient.rpc("join_room", {
      p_room_code: room.roomCode,
      p_nickname: "Orphan",
      p_guest_token: testToken("orphan"),
    });

    expect(error).toBeNull();
    expect(data.playerId).toBeTruthy();

    await staleClient.auth.signOut();
  });

  it("rejects a weak host token", async () => {
    const { error } = await supabase.rpc("create_room", {
      p_game_template_id: AIRPORT_BINGO_ID,
      p_host_token: "short",
      p_host_nickname: "Host",
    });
    expect(error?.message).toMatch(/invalid host token/);
  });

  it("refuses to start a room from a private game the caller doesn't own", async () => {
    const { error } = await supabase.rpc("create_room", {
      p_game_template_id: "00000000-0000-4000-8000-00000000dead",
      p_host_token: testToken("host"),
      p_host_nickname: "Host",
    });
    expect(error?.message).toMatch(/not found|not available/);
  });

  it("exposes only public join info before joining", async () => {
    const room = await createRoom(testToken("host"));
    const { data } = await supabase.rpc("get_join_info", {
      p_room_code: room.roomCode,
    });
    expect(data.gameTitle).toBe("Airport Bingo");
    expect(data.contentRating).toBe("standard");
    expect(data.status).toBe("lobby");
    expect(data.expired).toBe(false);
    expect(data).not.toHaveProperty("card");
  });

  it("joins a guest and builds a 25-square card with a FREE center", async () => {
    const room = await createRoom(testToken("host"));
    const guest = testToken("guest");

    const { data: join, error } = await supabase.rpc("join_room", {
      p_room_code: room.roomCode,
      p_nickname: "Ryan",
      p_guest_token: guest,
    });
    expect(error).toBeNull();
    expect(join.rejoined).toBe(false);

    const { data: snap } = await supabase.rpc("get_room_snapshot", {
      p_room_id: room.roomId,
      p_token: guest,
    });

    expect(snap.card).toHaveLength(25);
    const free = snap.card.filter((s: { isFree: boolean }) => s.isFree);
    expect(free).toHaveLength(1);
    expect(free[0].position).toBe(12);
    expect(free[0].marked).toBe(true);
    expect(free[0].text).toBe("FREE");

    const texts = snap.card
      .filter((s: { isFree: boolean }) => !s.isFree)
      .map((s: { text: string }) => s.text);
    expect(new Set(texts).size).toBe(24);
  });

  it("gives two players different cards from the same pool", async () => {
    const room = await createRoom(testToken("host"));
    const [a, b] = [testToken("a"), testToken("b")];

    for (const [token, name] of [
      [a, "Ryan"],
      [b, "Mike"],
    ] as const) {
      await supabase.rpc("join_room", {
        p_room_code: room.roomCode,
        p_nickname: name,
        p_guest_token: token,
      });
    }

    const cards = await Promise.all(
      [a, b].map(async (token) => {
        const { data } = await supabase.rpc("get_room_snapshot", {
          p_room_id: room.roomId,
          p_token: token,
        });
        return data.card.map((s: { text: string }) => s.text).join("|");
      })
    );

    expect(cards[0]).not.toBe(cards[1]);
  });

  it("rejects an empty nickname", async () => {
    const room = await createRoom(testToken("host"));
    const { error } = await supabase.rpc("join_room", {
      p_room_code: room.roomCode,
      p_nickname: "   ",
      p_guest_token: testToken("guest"),
    });
    expect(error?.message).toMatch(/nickname required/);
  });

  it("returns the same player when the same token re-joins", async () => {
    const room = await createRoom(testToken("host"));
    const guest = testToken("guest");
    const first = await supabase.rpc("join_room", {
      p_room_code: room.roomCode,
      p_nickname: "Ryan",
      p_guest_token: guest,
    });
    const second = await supabase.rpc("join_room", {
      p_room_code: room.roomCode,
      p_nickname: "Ryan",
      p_guest_token: guest,
    });
    expect(second.data.playerId).toBe(first.data.playerId);
    expect(second.data.rejoined).toBe(true);
  });

  it("refuses a snapshot to a stranger's token", async () => {
    const room = await createRoom(testToken("host"));
    const { error } = await supabase.rpc("get_room_snapshot", {
      p_room_id: room.roomId,
      p_token: testToken("stranger"),
    });
    expect(error?.message).toMatch(/not a participant/);
  });

  it("only the host can start the room", async () => {
    const hostToken = testToken("host");
    const room = await createRoom(hostToken);
    const guest = testToken("guest");
    await supabase.rpc("join_room", {
      p_room_code: room.roomCode,
      p_nickname: "Ryan",
      p_guest_token: guest,
    });

    const asPlayer = await supabase.rpc("start_room", {
      p_room_id: room.roomId,
      p_host_token: guest,
    });
    expect(asPlayer.error?.message).toMatch(/not the host/);

    const asHost = await supabase.rpc("start_room", {
      p_room_id: room.roomId,
      p_host_token: hostToken,
    });
    expect(asHost.data.status).toBe("active");
  });

  it("enforces the lobby → active → paused → active → completed machine", async () => {
    const hostToken = testToken("host");
    const room = await createRoom(hostToken);
    const args = { p_room_id: room.roomId, p_host_token: hostToken };

    expect((await supabase.rpc("pause_room", args)).error?.message).toMatch(
      /cannot pause from lobby/
    );
    await supabase.rpc("start_room", args);
    expect((await supabase.rpc("start_room", args)).error?.message).toMatch(
      /cannot start from active/
    );
    expect((await supabase.rpc("pause_room", args)).data.status).toBe("paused");
    expect((await supabase.rpc("resume_room", args)).data.status).toBe("active");
    expect((await supabase.rpc("end_room", args)).data.status).toBe("completed");
    // COMPLETED is terminal — no path back to ACTIVE (PRD §22).
    expect((await supabase.rpc("start_room", args)).error?.message).toMatch(
      /cannot start from completed/
    );
  });

  it("lets the host remove a player but never the host", async () => {
    const hostToken = testToken("host");
    const room = await createRoom(hostToken);
    const guest = testToken("guest");
    const { data: join } = await supabase.rpc("join_room", {
      p_room_code: room.roomCode,
      p_nickname: "Ryan",
      p_guest_token: guest,
    });

    const { data: snapBefore } = await supabase.rpc("get_room_snapshot", {
      p_room_id: room.roomId,
      p_token: hostToken,
    });
    expect(snapBefore.players).toHaveLength(2);

    const { error } = await supabase.rpc("remove_player", {
      p_room_id: room.roomId,
      p_player_id: join.playerId,
      p_host_token: guest,
    });
    expect(error?.message).toMatch(/not the host/);

    await supabase.rpc("remove_player", {
      p_room_id: room.roomId,
      p_player_id: join.playerId,
      p_host_token: hostToken,
    });

    const { data: snapAfter } = await supabase.rpc("get_room_snapshot", {
      p_room_id: room.roomId,
      p_token: hostToken,
    });
    expect(snapAfter.players).toHaveLength(1);

    // A removed player cannot rejoin with the same token.
    const rejoin = await supabase.rpc("join_room", {
      p_room_code: room.roomCode,
      p_nickname: "Ryan",
      p_guest_token: guest,
    });
    expect(rejoin.error?.message).toMatch(/removed from room/);
  });

  it("keeps gameplay tables unreadable through the REST API", async () => {
    const room = await createRoom(testToken("host"));
    const guest = testToken("guest");
    await supabase.rpc("join_room", {
      p_room_code: room.roomCode,
      p_nickname: "Ryan",
      p_guest_token: guest,
    });

    const cards = await supabase.from("player_card_squares").select("id");
    expect(cards.data ?? []).toHaveLength(0);

    const players = await supabase.from("room_players").select("id");
    expect(players.data ?? []).toHaveLength(0);
  });
});
