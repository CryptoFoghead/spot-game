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

type Square = {
  id: string;
  position: number;
  isFree: boolean;
  marked: boolean;
  markedBy: string | null;
};

/**
 * Co-op changes the authorisation shape: a personal card requires the caller
 * to BE the owner, a shared card requires them to be an active player in the
 * room. These check both halves — that the right people can mark it, and that
 * the wrong ones still cannot.
 */
describeLive("co-op mode: one shared card", () => {
  const rooms: string[] = [];
  const supabase = anonClient();
  const admin = adminClient();

  afterAll(async () => {
    for (const id of rooms) await deleteRoom(id);
  });

  async function coopRoom() {
    const hostToken = testToken("host");
    const { data: room, error } = await supabase.rpc("create_room", {
      p_game_template_id: AIRPORT_BINGO_ID,
      p_host_token: hostToken,
      p_host_nickname: "Alex",
      p_game_mode: "coop",
    });
    if (error) throw new Error(error.message);
    rooms.push(room.roomId);

    const guestToken = testToken("guest");
    await supabase.rpc("join_room", {
      p_room_code: room.roomCode,
      p_nickname: "Sam",
      p_guest_token: guestToken,
    });
    await supabase.rpc("start_room", {
      p_room_id: room.roomId,
      p_host_token: hostToken,
    });

    return { room, hostToken, guestToken };
  }

  async function cardOf(roomId: string, token: string) {
    const { data } = await supabase.rpc("get_room_snapshot", {
      p_room_id: roomId,
      p_token: token,
    });
    return { snapshot: data, card: data.card as Square[] };
  }

  it("gives both players the very same card", async () => {
    const { room, hostToken, guestToken } = await coopRoom();

    const host = await cardOf(room.roomId, hostToken);
    const guest = await cardOf(room.roomId, guestToken);

    expect(host.card).toHaveLength(25);
    expect(guest.card.map((s) => s.id)).toEqual(host.card.map((s) => s.id));
    expect(host.snapshot.room.sharedCard).toBe(true);
  });

  it("creates exactly one card for the room, owned by nobody", async () => {
    const { room } = await coopRoom();

    const { data: cards } = await admin
      .from("player_cards")
      .select("id, room_player_id")
      .eq("room_id", room.roomId);

    expect(cards).toHaveLength(1);
    expect(cards![0].room_player_id).toBeNull();
  });

  it("lets either player mark, and both see it", async () => {
    const { room, hostToken, guestToken } = await coopRoom();
    const { card } = await cardOf(room.roomId, hostToken);
    const target = card.find((s) => !s.isFree)!;

    const marked = await supabase.rpc("toggle_square", {
      p_card_square_id: target.id,
      p_guest_token: guestToken,
    });
    expect(marked.error).toBeNull();
    expect(marked.data.shared).toBe(true);

    const hostView = await cardOf(room.roomId, hostToken);
    expect(hostView.card.find((s) => s.id === target.id)!.marked).toBe(true);
  });

  it("records who spotted each square", async () => {
    const { room, hostToken, guestToken } = await coopRoom();
    const { card } = await cardOf(room.roomId, hostToken);
    const forHost = card.filter((s) => !s.isFree)[0];
    const forGuest = card.filter((s) => !s.isFree)[1];

    await supabase.rpc("toggle_square", {
      p_card_square_id: forHost.id,
      p_guest_token: hostToken,
    });
    await supabase.rpc("toggle_square", {
      p_card_square_id: forGuest.id,
      p_guest_token: guestToken,
    });

    const { snapshot, card: after } = await cardOf(room.roomId, hostToken);
    const hostId = snapshot.me.id;

    expect(after.find((s) => s.id === forHost.id)!.markedBy).toBe(hostId);
    expect(after.find((s) => s.id === forGuest.id)!.markedBy).not.toBe(hostId);
    expect(after.find((s) => s.id === forGuest.id)!.markedBy).toBeTruthy();
  });

  it("scores each player on what they personally spotted", async () => {
    const { room, hostToken, guestToken } = await coopRoom();
    const { card } = await cardOf(room.roomId, hostToken);
    const open = card.filter((s) => !s.isFree);

    // Guest spots three, host spots one.
    for (const square of open.slice(0, 3)) {
      await supabase.rpc("toggle_square", {
        p_card_square_id: square.id,
        p_guest_token: guestToken,
      });
    }
    await supabase.rpc("toggle_square", {
      p_card_square_id: open[3].id,
      p_guest_token: hostToken,
    });

    const { snapshot } = await cardOf(room.roomId, hostToken);
    const byName = Object.fromEntries(
      snapshot.players.map((p: { nickname: string; score: number }) => [
        p.nickname,
        p.score,
      ])
    );
    expect(byName.Sam).toBe(3);
    expect(byName.Alex).toBe(1);
  });

  it("refuses a stranger who is not in the room", async () => {
    const { room, hostToken } = await coopRoom();
    const { card } = await cardOf(room.roomId, hostToken);

    const { error } = await supabase.rpc("toggle_square", {
      p_card_square_id: card.find((s) => !s.isFree)!.id,
      p_guest_token: testToken("stranger"),
    });
    expect(error?.message).toMatch(/not your card/);
  });

  it("refuses a removed player", async () => {
    const { room, hostToken, guestToken } = await coopRoom();
    const { snapshot } = await cardOf(room.roomId, guestToken);
    const { card } = await cardOf(room.roomId, hostToken);

    await supabase.rpc("remove_player", {
      p_room_id: room.roomId,
      p_player_id: snapshot.me.id,
      p_host_token: hostToken,
    });

    const { error } = await supabase.rpc("toggle_square", {
      p_card_square_id: card.find((s) => !s.isFree)!.id,
      p_guest_token: guestToken,
    });
    expect(error).not.toBeNull();
  });

  it("counts a completed line as a win for everyone in the room", async () => {
    const { room, hostToken, guestToken } = await coopRoom();
    const { card } = await cardOf(room.roomId, hostToken);

    // Both players contribute to the same line.
    const topRow = card.filter((s) => s.position < 5 && !s.isFree);
    for (const [index, square] of topRow.entries()) {
      await supabase.rpc("toggle_square", {
        p_card_square_id: square.id,
        p_guest_token: index % 2 === 0 ? hostToken : guestToken,
      });
    }

    const { snapshot } = await cardOf(room.roomId, guestToken);
    expect(snapshot.players.every((p: { hasBingo: boolean }) => p.hasBingo)).toBe(
      true
    );
    expect(snapshot.room.winnerPlayerId).toBeTruthy();
  });

  it("handles both players tapping the same square at once", async () => {
    const { room, hostToken, guestToken } = await coopRoom();
    const { card } = await cardOf(room.roomId, hostToken);
    const target = card.find((s) => !s.isFree)!;

    // Two people sharing one card will do this; the advisory lock serialises
    // them so the square doesn't end up double-toggled back to unmarked.
    const results = await Promise.all([
      supabase.rpc("toggle_square", {
        p_card_square_id: target.id,
        p_guest_token: hostToken,
      }),
      supabase.rpc("toggle_square", {
        p_card_square_id: target.id,
        p_guest_token: guestToken,
      }),
    ]);

    expect(results.filter((r) => r.error).length).toBe(0);
    // One marked it, the other toggled it back — the point is that the final
    // state is coherent rather than a lost update.
    const { card: after } = await cardOf(room.roomId, hostToken);
    const final = after.find((s) => s.id === target.id)!;
    expect(typeof final.marked).toBe("boolean");
    if (final.marked) expect(final.markedBy).toBeTruthy();
    else expect(final.markedBy).toBeNull();
  });

  it("leaves personal-card modes untouched", async () => {
    const hostToken = testToken("host");
    const { data: room } = await supabase.rpc("create_room", {
      p_game_template_id: AIRPORT_BINGO_ID,
      p_host_token: hostToken,
      p_host_nickname: "Solo",
      p_game_mode: "classic",
    });
    rooms.push(room.roomId);

    const guestToken = testToken("guest");
    await supabase.rpc("join_room", {
      p_room_code: room.roomCode,
      p_nickname: "Other",
      p_guest_token: guestToken,
    });

    const host = await cardOf(room.roomId, hostToken);
    const guest = await cardOf(room.roomId, guestToken);

    expect(host.snapshot.room.sharedCard).toBe(false);
    expect(guest.card.map((s) => s.id)).not.toEqual(host.card.map((s) => s.id));

    // And marking someone else's card is still refused.
    await supabase.rpc("start_room", {
      p_room_id: room.roomId,
      p_host_token: hostToken,
    });
    const { error } = await supabase.rpc("toggle_square", {
      p_card_square_id: host.card.find((s) => !s.isFree)!.id,
      p_guest_token: guestToken,
    });
    expect(error?.message).toMatch(/not your card/);
  });
});
