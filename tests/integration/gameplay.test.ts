import { afterAll, describe, expect, it } from "vitest";

import { hasBingo } from "@/lib/game/bingo";

import {
  AIRPORT_BINGO_ID,
  anonClient,
  deleteRoom,
  hasLiveEnv,
  testToken,
} from "./helpers";

const describeLive = hasLiveEnv ? describe : describe.skip;

type Square = {
  id: string;
  position: number;
  text: string;
  isFree: boolean;
  marked: boolean;
};

describeLive("toggle_square — authoritative marking", () => {
  const createdRooms: string[] = [];
  const supabase = anonClient();

  afterAll(async () => {
    for (const id of createdRooms) await deleteRoom(id);
  });

  /** Room with the host plus `guests` extra players, started and active. */
  async function liveRoom(guests: string[], continueAfterWin = true) {
    const hostToken = testToken("host");
    const { data: room, error } = await supabase.rpc("create_room", {
      p_game_template_id: AIRPORT_BINGO_ID,
      p_host_token: hostToken,
      p_host_nickname: "Host",
      p_game_mode: "classic",
      p_continue_after_win: continueAfterWin,
    });
    if (error) throw new Error(error.message);
    createdRooms.push(room.roomId);

    const tokens: Record<string, string> = {};
    for (const name of guests) {
      const token = testToken(name);
      tokens[name] = token;
      await supabase.rpc("join_room", {
        p_room_code: room.roomCode,
        p_nickname: name,
        p_guest_token: token,
      });
    }

    await supabase.rpc("start_room", {
      p_room_id: room.roomId,
      p_host_token: hostToken,
    });

    return { room, hostToken, tokens };
  }

  async function cardOf(roomId: string, token: string): Promise<Square[]> {
    const { data } = await supabase.rpc("get_room_snapshot", {
      p_room_id: roomId,
      p_token: token,
    });
    return data.card as Square[];
  }

  it("marks and unmarks a square, keeping score authoritative", async () => {
    const { room, tokens } = await liveRoom(["Ryan"]);
    const card = await cardOf(room.roomId, tokens.Ryan);
    const target = card.find((s) => !s.isFree)!;

    const marked = await supabase.rpc("toggle_square", {
      p_card_square_id: target.id,
      p_guest_token: tokens.Ryan,
    });
    expect(marked.data.marked).toBe(true);
    expect(marked.data.score).toBe(1);

    const unmarked = await supabase.rpc("toggle_square", {
      p_card_square_id: target.id,
      p_guest_token: tokens.Ryan,
    });
    expect(unmarked.data.marked).toBe(false);
    expect(unmarked.data.score).toBe(0);
  });

  it("never counts the FREE square toward the score", async () => {
    const { room, tokens } = await liveRoom(["Ryan"]);
    const card = await cardOf(room.roomId, tokens.Ryan);
    const free = card.find((s) => s.isFree)!;

    expect(free.marked).toBe(true);
    const { error } = await supabase.rpc("toggle_square", {
      p_card_square_id: free.id,
      p_guest_token: tokens.Ryan,
    });
    expect(error?.message).toMatch(/free square cannot be changed/);
  });

  it("refuses to mark another player's card", async () => {
    const { room, tokens } = await liveRoom(["Ryan", "Mike"]);
    const ryanCard = await cardOf(room.roomId, tokens.Ryan);
    const target = ryanCard.find((s) => !s.isFree)!;

    const { error } = await supabase.rpc("toggle_square", {
      p_card_square_id: target.id,
      p_guest_token: tokens.Mike,
    });
    expect(error?.message).toMatch(/not your card/);
  });

  it("refuses to mark with an unknown token", async () => {
    const { room, tokens } = await liveRoom(["Ryan"]);
    const card = await cardOf(room.roomId, tokens.Ryan);
    const { error } = await supabase.rpc("toggle_square", {
      p_card_square_id: card.find((s) => !s.isFree)!.id,
      p_guest_token: testToken("stranger"),
    });
    expect(error?.message).toMatch(/not your card/);
  });

  it("refuses to mark while the room is in the lobby or paused", async () => {
    const hostToken = testToken("host");
    const { data: room } = await supabase.rpc("create_room", {
      p_game_template_id: AIRPORT_BINGO_ID,
      p_host_token: hostToken,
      p_host_nickname: "Host",
    });
    createdRooms.push(room.roomId);

    const guest = testToken("ryan");
    await supabase.rpc("join_room", {
      p_room_code: room.roomCode,
      p_nickname: "Ryan",
      p_guest_token: guest,
    });
    const card = await cardOf(room.roomId, guest);
    const target = card.find((s) => !s.isFree)!;

    const inLobby = await supabase.rpc("toggle_square", {
      p_card_square_id: target.id,
      p_guest_token: guest,
    });
    expect(inLobby.error?.message).toMatch(/room is not active/);

    await supabase.rpc("start_room", {
      p_room_id: room.roomId,
      p_host_token: hostToken,
    });
    await supabase.rpc("pause_room", {
      p_room_id: room.roomId,
      p_host_token: hostToken,
    });

    const whilePaused = await supabase.rpc("toggle_square", {
      p_card_square_id: target.id,
      p_guest_token: guest,
    });
    expect(whilePaused.error?.message).toMatch(/room is not active/);
  });

  it("refuses to mark after the host removed the player", async () => {
    const { room, hostToken, tokens } = await liveRoom(["Ryan"]);
    const card = await cardOf(room.roomId, tokens.Ryan);
    const { data: snap } = await supabase.rpc("get_room_snapshot", {
      p_room_id: room.roomId,
      p_token: tokens.Ryan,
    });

    await supabase.rpc("remove_player", {
      p_room_id: room.roomId,
      p_player_id: snap.me.id,
      p_host_token: hostToken,
    });

    const { error } = await supabase.rpc("toggle_square", {
      p_card_square_id: card.find((s) => !s.isFree)!.id,
      p_guest_token: tokens.Ryan,
    });
    expect(error?.message).toMatch(/not your card|not active/);
  });

  it("detects bingo on a completed row and records the first winner", async () => {
    const { room, tokens } = await liveRoom(["Ryan"]);
    const card = await cardOf(room.roomId, tokens.Ryan);

    // Top row: positions 0..4, none of which is the FREE centre.
    const topRow = card.filter((s) => s.position < 5);
    let result;
    for (const square of topRow) {
      result = await supabase.rpc("toggle_square", {
        p_card_square_id: square.id,
        p_guest_token: tokens.Ryan,
      });
    }

    expect(result!.data.hasBingo).toBe(true);
    expect(result!.data.isFirstWinner).toBe(true);
    expect(result!.data.score).toBe(5);
    // Room continues by default (§25 continue_after_win).
    expect(result!.data.roomCompleted).toBe(false);

    const { data: snap } = await supabase.rpc("get_room_snapshot", {
      p_room_id: room.roomId,
      p_token: tokens.Ryan,
    });
    expect(snap.room.winnerPlayerId).toBe(snap.me.id);
    expect(snap.me.hasBingo).toBe(true);
  });

  it("agrees with the client-side bingo rules", async () => {
    const { room, tokens } = await liveRoom(["Ryan"]);
    const card = await cardOf(room.roomId, tokens.Ryan);

    // Four of the top row: no bingo in either implementation.
    const partial = card.filter((s) => s.position < 4);
    let result;
    for (const square of partial) {
      result = await supabase.rpc("toggle_square", {
        p_card_square_id: square.id,
        p_guest_token: tokens.Ryan,
      });
    }
    const markedPositions = [
      ...partial.map((s) => s.position),
      12, // FREE centre is stored marked
    ];
    expect(result!.data.hasBingo).toBe(false);
    expect(hasBingo(markedPositions, 5)).toBe(false);

    // Completing the row wins in both.
    const fifth = card.find((s) => s.position === 4)!;
    result = await supabase.rpc("toggle_square", {
      p_card_square_id: fifth.id,
      p_guest_token: tokens.Ryan,
    });
    expect(result.data.hasBingo).toBe(true);
    expect(hasBingo([...markedPositions, 4], 5)).toBe(true);
  });

  it("keeps the first winner when a second player also gets bingo", async () => {
    const { room, tokens } = await liveRoom(["Ryan", "Mike"]);

    async function completeTopRow(token: string) {
      const card = await cardOf(room.roomId, token);
      let last;
      for (const square of card.filter((s) => s.position < 5)) {
        last = await supabase.rpc("toggle_square", {
          p_card_square_id: square.id,
          p_guest_token: token,
        });
      }
      return last!;
    }

    const first = await completeTopRow(tokens.Ryan);
    const second = await completeTopRow(tokens.Mike);

    expect(first.data.isFirstWinner).toBe(true);
    expect(second.data.hasBingo).toBe(true);
    expect(second.data.isFirstWinner).toBe(false);

    const { data: snap } = await supabase.rpc("get_room_snapshot", {
      p_room_id: room.roomId,
      p_token: tokens.Ryan,
    });
    expect(snap.room.winnerPlayerId).toBe(snap.me.id);
  });

  it("ends the room on bingo when continue_after_win is off", async () => {
    const { room, tokens } = await liveRoom(["Ryan"], false);
    const card = await cardOf(room.roomId, tokens.Ryan);

    let result;
    for (const square of card.filter((s) => s.position < 5)) {
      result = await supabase.rpc("toggle_square", {
        p_card_square_id: square.id,
        p_guest_token: tokens.Ryan,
      });
    }

    expect(result!.data.roomCompleted).toBe(true);
    const { data: snap } = await supabase.rpc("get_room_snapshot", {
      p_room_id: room.roomId,
      p_token: tokens.Ryan,
    });
    expect(snap.room.status).toBe("completed");
  });

  it("writes an auditable event for every mark", async () => {
    const { room, tokens } = await liveRoom(["Ryan"]);
    const card = await cardOf(room.roomId, tokens.Ryan);
    const target = card.find((s) => !s.isFree)!;

    await supabase.rpc("toggle_square", {
      p_card_square_id: target.id,
      p_guest_token: tokens.Ryan,
    });
    await supabase.rpc("toggle_square", {
      p_card_square_id: target.id,
      p_guest_token: tokens.Ryan,
    });

    // room_events is deny-all to clients; verified through the admin client.
    const { adminClient } = await import("./helpers");
    const { data: events } = await adminClient()
      .from("room_events")
      .select("event_type")
      .eq("room_id", room.roomId)
      .in("event_type", ["square_marked", "square_unmarked"]);

    expect(events?.map((e) => e.event_type).sort()).toEqual([
      "square_marked",
      "square_unmarked",
    ]);
  });
});
