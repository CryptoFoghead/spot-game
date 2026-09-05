import { afterAll, describe, expect, it } from "vitest";

import {
  AIRPORT_BINGO_ID,
  adminClient,
  anonClient,
  deleteRoom,
  hasLiveEnv,
  testToken,
} from "./helpers";

const describeLive = hasLiveEnv ? describe : describe.skip;

/**
 * A room had no ceiling at all: any 4-digit code, unlimited joins, 26 rows
 * each, and a mark that costs more the more people are connected.
 *
 * The cap is an operational guard rather than a product decision, so these
 * tests are about the properties that would be easy to break while wiring it
 * to pricing later — above all that being full must never lock out someone
 * already in the room.
 */
describeLive("room capacity", () => {
  const rooms: string[] = [];
  const supabase = anonClient();
  const admin = adminClient();

  afterAll(async () => {
    for (const id of rooms) await deleteRoom(id);
  });

  async function room(maxPlayers?: number) {
    const hostToken = testToken("host");
    const { data, error } = await supabase.rpc("create_room", {
      p_game_template_id: AIRPORT_BINGO_ID,
      p_host_token: hostToken,
      p_host_nickname: "Alex",
    });
    if (error) throw new Error(error.message);
    rooms.push(data.roomId);

    if (maxPlayers !== undefined) {
      const { error: capError } = await admin
        .from("rooms")
        .update({ max_players: maxPlayers })
        .eq("id", data.roomId);
      if (capError) throw new Error(capError.message);
    }
    return { ...data, hostToken };
  }

  function join(code: string, nickname: string, token: string) {
    return supabase.rpc("join_room", {
      p_room_code: code,
      p_nickname: nickname,
      p_guest_token: token,
    });
  }

  it("defaults to a generous ceiling rather than none", async () => {
    const game = await room();
    const { data } = await admin
      .from("rooms")
      .select("max_players")
      .eq("id", game.roomId)
      .single();
    expect(data!.max_players).toBe(100);
  });

  it("refuses a join once the room is full", async () => {
    // Cap 2: the host holds one seat, so exactly one guest fits.
    const game = await room(2);

    const first = await join(game.roomCode, "Sam", testToken("a"));
    expect(first.error).toBeNull();

    const second = await join(game.roomCode, "Jo", testToken("b"));
    expect(second.error?.message).toMatch(/room is full/);
  });

  it("counts the host as occupying a seat", async () => {
    // Cap 1 means the host alone fills it and nobody else can join.
    const game = await room(2);
    await admin.from("rooms").update({ max_players: 2 }).eq("id", game.roomId);

    const { data: players } = await admin
      .from("room_players")
      .select("id")
      .eq("room_id", game.roomId)
      .eq("status", "active");
    expect(players).toHaveLength(1); // the host

    await join(game.roomCode, "Sam", testToken("a"));
    const blocked = await join(game.roomCode, "Jo", testToken("b"));
    expect(blocked.error?.message).toMatch(/room is full/);
  });

  it("still lets someone already in a full room reconnect", async () => {
    // The property that matters most. A full room must not strand its own
    // players when a phone drops off and comes back.
    const game = await room(2);
    const sam = testToken("sam");

    const joined = await join(game.roomCode, "Sam", sam);
    expect(joined.error).toBeNull();

    const rejoined = await join(game.roomCode, "Sam", sam);
    expect(rejoined.error).toBeNull();
    expect(rejoined.data.rejoined).toBe(true);
    expect(rejoined.data.playerId).toBe(joined.data.playerId);
  });

  it("frees the seat when the host removes someone", async () => {
    const game = await room(2);
    const sam = testToken("sam");
    const joined = await join(game.roomCode, "Sam", sam);

    await supabase.rpc("remove_player", {
      p_room_id: game.roomId,
      p_player_id: joined.data.playerId,
      p_host_token: game.hostToken,
    });

    const replacement = await join(game.roomCode, "Jo", testToken("jo"));
    expect(replacement.error).toBeNull();
  });

  it("does not let a removed player take the freed seat back", async () => {
    const game = await room(2);
    const sam = testToken("sam");
    const joined = await join(game.roomCode, "Sam", sam);

    await supabase.rpc("remove_player", {
      p_room_id: game.roomId,
      p_player_id: joined.data.playerId,
      p_host_token: game.hostToken,
    });

    const back = await join(game.roomCode, "Sam", sam);
    expect(back.error?.message).toMatch(/removed from room/);
  });

  it("does not hand the last seat to two people at once", async () => {
    const game = await room(2);

    const results = await Promise.all([
      join(game.roomCode, "Sam", testToken("sam")),
      join(game.roomCode, "Jo", testToken("jo")),
    ]);

    expect(results.filter((r) => !r.error)).toHaveLength(1);
    expect(results.filter((r) => r.error)).toHaveLength(1);

    const { count } = await admin
      .from("room_players")
      .select("id", { count: "exact", head: true })
      .eq("room_id", game.roomId)
      .eq("status", "active");
    expect(count).toBe(2); // host + exactly one guest
  });

  it("leaves ordinary rooms completely unaffected", async () => {
    const game = await room();
    for (const name of ["A", "B", "C", "D", "E"]) {
      const { error } = await join(game.roomCode, name, testToken(name));
      expect(error).toBeNull();
    }
  });
});
