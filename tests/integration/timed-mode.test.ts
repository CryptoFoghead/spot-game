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

type Square = { id: string; position: number; isFree: boolean };

describeLive("timed mode (PRD §13)", () => {
  const rooms: string[] = [];
  const supabase = anonClient();
  const admin = adminClient();

  afterAll(async () => {
    for (const id of rooms) await deleteRoom(id);
  });

  async function timedRoom(durationSeconds = 600) {
    const hostToken = testToken("host");
    const { data: room, error } = await supabase.rpc("create_room", {
      p_game_template_id: AIRPORT_BINGO_ID,
      p_host_token: hostToken,
      p_host_nickname: "Host",
      p_game_mode: "timed",
      p_duration_seconds: durationSeconds,
    });
    if (error) throw new Error(error.message);
    rooms.push(room.roomId);
    return { room, hostToken };
  }

  it("rejects a duration outside the allowed range", async () => {
    const { error } = await supabase.rpc("create_room", {
      p_game_template_id: AIRPORT_BINGO_ID,
      p_host_token: testToken("host"),
      p_host_nickname: "Host",
      p_game_mode: "timed",
      p_duration_seconds: 5,
    });
    expect(error?.message).toMatch(/between 1 and 120 minutes/);
  });

  it("exposes a deadline once the game starts, not before", async () => {
    const { room, hostToken } = await timedRoom(600);

    const before = await supabase.rpc("get_room_snapshot", {
      p_room_id: room.roomId,
      p_token: hostToken,
    });
    expect(before.data.room.endsAt).toBeNull();

    await supabase.rpc("start_room", {
      p_room_id: room.roomId,
      p_host_token: hostToken,
    });

    const after = await supabase.rpc("get_room_snapshot", {
      p_room_id: room.roomId,
      p_token: hostToken,
    });
    expect(after.data.room.endsAt).toBeTruthy();
    expect(new Date(after.data.room.endsAt).getTime()).toBeGreaterThan(Date.now());
  });

  // The reason this mode was deferred and then designed deliberately: a line
  // win would end a ten-minute round in ninety seconds.
  it("does not end when a player completes a line", async () => {
    const { room, hostToken } = await timedRoom(600);
    await supabase.rpc("start_room", {
      p_room_id: room.roomId,
      p_host_token: hostToken,
    });

    const { data: snap } = await supabase.rpc("get_room_snapshot", {
      p_room_id: room.roomId,
      p_token: hostToken,
    });

    let last;
    for (const square of (snap.card as Square[]).filter((s) => s.position < 5)) {
      if (square.isFree) continue;
      last = await supabase.rpc("toggle_square", {
        p_card_square_id: square.id,
        p_guest_token: hostToken,
      });
    }

    expect(last!.data.hasBingo).toBe(false);
    expect(last!.data.isOneAway).toBe(false);
    expect(last!.data.roomCompleted).toBe(false);

    const { data: after } = await supabase.rpc("get_room_snapshot", {
      p_room_id: room.roomId,
      p_token: hostToken,
    });
    expect(after.room.status).toBe("active");
  });

  it("refuses to finish before the clock runs out", async () => {
    const { room, hostToken } = await timedRoom(600);
    await supabase.rpc("start_room", {
      p_room_id: room.roomId,
      p_host_token: hostToken,
    });

    const { data } = await supabase.rpc("finish_timed_room", {
      p_room_id: room.roomId,
    });
    expect(data.finished).toBe(false);
  });

  it("ends at the deadline and awards the highest score", async () => {
    const { room, hostToken } = await timedRoom(600);
    const guest = testToken("guest");
    await supabase.rpc("join_room", {
      p_room_code: room.roomCode,
      p_nickname: "Ryan",
      p_guest_token: guest,
    });
    await supabase.rpc("start_room", {
      p_room_id: room.roomId,
      p_host_token: hostToken,
    });

    // Guest spots three; host spots one.
    const { data: guestSnap } = await supabase.rpc("get_room_snapshot", {
      p_room_id: room.roomId,
      p_token: guest,
    });
    for (const square of (guestSnap.card as Square[]).filter((s) => !s.isFree).slice(0, 3)) {
      await supabase.rpc("toggle_square", {
        p_card_square_id: square.id,
        p_guest_token: guest,
      });
    }
    const { data: hostSnap } = await supabase.rpc("get_room_snapshot", {
      p_room_id: room.roomId,
      p_token: hostToken,
    });
    await supabase.rpc("toggle_square", {
      p_card_square_id: (hostSnap.card as Square[]).find((s) => !s.isFree)!.id,
      p_guest_token: hostToken,
    });

    // Wind the clock back so the deadline has passed.
    await admin
      .from("rooms")
      .update({ started_at: new Date(Date.now() - 700_000).toISOString() })
      .eq("id", room.roomId);

    const { data: finished } = await supabase.rpc("finish_timed_room", {
      p_room_id: room.roomId,
    });
    expect(finished.finished).toBe(true);

    const { data: final } = await supabase.rpc("get_room_snapshot", {
      p_room_id: room.roomId,
      p_token: guest,
    });
    expect(final.room.status).toBe("completed");
    // The guest spotted more, so the guest takes it.
    expect(final.room.winnerPlayerId).toBe(final.me.id);
  });

  it("settles only once when several clients ask at the same time", async () => {
    const { room, hostToken } = await timedRoom(600);
    await supabase.rpc("start_room", {
      p_room_id: room.roomId,
      p_host_token: hostToken,
    });
    await admin
      .from("rooms")
      .update({ started_at: new Date(Date.now() - 700_000).toISOString() })
      .eq("id", room.roomId);

    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        supabase.rpc("finish_timed_room", { p_room_id: room.roomId })
      )
    );
    const settled = results.filter((r) => r.data?.finished).length;
    expect(settled).toBe(1);

    const { count } = await admin
      .from("room_events")
      .select("id", { count: "exact", head: true })
      .eq("room_id", room.roomId)
      .eq("event_type", "game_completed");
    expect(count).toBe(1);
  });

  it("is settled by scheduled maintenance when everyone walks away", async () => {
    const { room, hostToken } = await timedRoom(600);
    await supabase.rpc("start_room", {
      p_room_id: room.roomId,
      p_host_token: hostToken,
    });
    await admin
      .from("rooms")
      .update({ started_at: new Date(Date.now() - 700_000).toISOString() })
      .eq("id", room.roomId);

    const { data: swept } = await admin.rpc("sweep_rooms");
    expect(swept.timedFinished).toBeGreaterThanOrEqual(1);

    const { data: rooms } = await admin
      .from("rooms")
      .select("status")
      .eq("id", room.roomId)
      .single();
    expect(rooms?.status).toBe("completed");
  });
});
