import { afterAll, describe, expect, it } from "vitest";

import {
  AIRPORT_BINGO_ID,
  anonClient,
  deleteRoom,
  hasLiveEnv,
  testToken,
} from "./helpers";

const describeLive = hasLiveEnv ? describe : describe.skip;

type Square = { id: string; isFree: boolean; marked: boolean };

/**
 * The things that actually happen at a table, as opposed to the things a
 * happy-path test does: someone turns up late, two people pick the same
 * nickname, the host ends the game while a phone is still in someone's hand.
 */
describeLive("real-world room situations", () => {
  const rooms: string[] = [];
  const supabase = anonClient();

  afterAll(async () => {
    for (const id of rooms) await deleteRoom(id);
  });

  async function room(mode = "classic") {
    const hostToken = testToken("host");
    const { data, error } = await supabase.rpc("create_room", {
      p_game_template_id: AIRPORT_BINGO_ID,
      p_host_token: hostToken,
      p_host_nickname: "Alex",
      p_game_mode: mode,
    });
    if (error) throw new Error(error.message);
    rooms.push(data.roomId);
    return { ...data, hostToken };
  }

  async function snapshot(roomId: string, token: string) {
    const { data } = await supabase.rpc("get_room_snapshot", {
      p_room_id: roomId,
      p_token: token,
    });
    return data;
  }

  it("lets someone join after the game has already started", async () => {
    const game = await room();
    await supabase.rpc("start_room", {
      p_room_id: game.roomId,
      p_host_token: game.hostToken,
    });

    const lateToken = testToken("late");
    const { error } = await supabase.rpc("join_room", {
      p_room_code: game.roomCode,
      p_nickname: "Late Sam",
      p_guest_token: lateToken,
    });
    expect(error).toBeNull();

    // They need a playable card, not an empty screen.
    const view = await snapshot(game.roomId, lateToken);
    const card = view.card as Square[];
    expect(card).toHaveLength(25);

    const target = card.find((s) => !s.isFree)!;
    const marked = await supabase.rpc("toggle_square", {
      p_card_square_id: target.id,
      p_guest_token: lateToken,
    });
    expect(marked.error).toBeNull();
  });

  it("gives a late joiner the team's card, marks and all (co-op)", async () => {
    const game = await room("coop");
    await supabase.rpc("start_room", {
      p_room_id: game.roomId,
      p_host_token: game.hostToken,
    });

    // The host spots two things before the other person arrives.
    const hostView = await snapshot(game.roomId, game.hostToken);
    const open = (hostView.card as Square[]).filter((s) => !s.isFree);
    for (const square of open.slice(0, 2)) {
      await supabase.rpc("toggle_square", {
        p_card_square_id: square.id,
        p_guest_token: game.hostToken,
      });
    }

    const lateToken = testToken("late");
    await supabase.rpc("join_room", {
      p_room_code: game.roomCode,
      p_nickname: "Late Sam",
      p_guest_token: lateToken,
    });

    // Arriving late must not mean arriving to a blank card: it is one shared
    // card, so they should see the two already found.
    const lateView = await snapshot(game.roomId, lateToken);
    const lateCard = lateView.card as Square[];
    expect(lateCard.map((s) => s.id)).toEqual(
      (hostView.card as Square[]).map((s) => s.id)
    );
    expect(lateCard.filter((s) => s.marked)).toHaveLength(3); // two + FREE
  });

  it("keeps two players with the same nickname distinct", async () => {
    const game = await room();
    const a = testToken("same-a");
    const b = testToken("same-b");

    await supabase.rpc("join_room", {
      p_room_code: game.roomCode,
      p_nickname: "Sam",
      p_guest_token: a,
    });
    const second = await supabase.rpc("join_room", {
      p_room_code: game.roomCode,
      p_nickname: "Sam",
      p_guest_token: b,
    });

    // Refusing the duplicate would be worse than allowing it — two people
    // called Sam is a real table, and they can tell themselves apart.
    expect(second.error).toBeNull();

    const viewA = await snapshot(game.roomId, a);
    const viewB = await snapshot(game.roomId, b);
    expect(viewA.me.id).not.toBe(viewB.me.id);
    expect((viewA.card as Square[]).map((s) => s.id)).not.toEqual(
      (viewB.card as Square[]).map((s) => s.id)
    );
  });

  it("refuses to mark once the host has ended the game", async () => {
    const game = await room();
    const token = testToken("guest");
    await supabase.rpc("join_room", {
      p_room_code: game.roomCode,
      p_nickname: "Sam",
      p_guest_token: token,
    });
    await supabase.rpc("start_room", {
      p_room_id: game.roomId,
      p_host_token: game.hostToken,
    });

    const before = await snapshot(game.roomId, token);
    const target = (before.card as Square[]).find((s) => !s.isFree)!;

    await supabase.rpc("end_room", {
      p_room_id: game.roomId,
      p_host_token: game.hostToken,
    });

    const { error } = await supabase.rpc("toggle_square", {
      p_card_square_id: target.id,
      p_guest_token: token,
    });
    expect(error?.message).toMatch(/not active/i);
  });

  it("still shows a finished game to the people who were in it", async () => {
    // B-06: ending the game must not make the room unreachable to players.
    const game = await room();
    const token = testToken("guest");
    await supabase.rpc("join_room", {
      p_room_code: game.roomCode,
      p_nickname: "Sam",
      p_guest_token: token,
    });
    await supabase.rpc("start_room", {
      p_room_id: game.roomId,
      p_host_token: game.hostToken,
    });
    await supabase.rpc("end_room", {
      p_room_id: game.roomId,
      p_host_token: game.hostToken,
    });

    const after = await snapshot(game.roomId, token);
    expect(after.room.status).toBe("completed");
    expect(after.card).toHaveLength(25);
  });

  it("refuses to let anyone new join a finished game", async () => {
    const game = await room();
    await supabase.rpc("start_room", {
      p_room_id: game.roomId,
      p_host_token: game.hostToken,
    });
    await supabase.rpc("end_room", {
      p_room_id: game.roomId,
      p_host_token: game.hostToken,
    });

    const { error } = await supabase.rpc("join_room", {
      p_room_code: game.roomCode,
      p_nickname: "Too Late",
      p_guest_token: testToken("toolate"),
    });
    expect(error).not.toBeNull();
  });
});
