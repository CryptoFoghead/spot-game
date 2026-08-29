import { afterAll, describe, expect, it } from "vitest";

import {
  AIRPORT_BINGO_ID,
  anonClient,
  deleteRoom,
  hasLiveEnv,
  testToken,
} from "./helpers";

const describeLive = hasLiveEnv ? describe : describe.skip;

type Broadcast = { event: string; payload: Record<string, unknown> };

describeLive("realtime broadcast from the database", () => {
  const createdRooms: string[] = [];
  const supabase = anonClient();

  afterAll(async () => {
    for (const id of createdRooms) await deleteRoom(id);
    await supabase.removeAllChannels();
  });

  /** Subscribes to a room topic and collects broadcasts. */
  async function listen(roomId: string) {
    const received: Broadcast[] = [];
    const channel = supabase.channel(`room:${roomId}`);

    channel.on("broadcast", { event: "*" }, (message) => {
      received.push({
        event: String(message.event),
        payload: (message.payload ?? {}) as Record<string, unknown>,
      });
    });

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("subscribe timed out")), 15000);
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          clearTimeout(timer);
          resolve();
        }
      });
    });

    // A message sent immediately after SUBSCRIBED can be missed: the topic
    // takes a moment to route. This is exactly why the app resyncs from the
    // database on every (re)connect instead of replaying events (PRD §29).
    await new Promise((r) => setTimeout(r, 1500));

    return {
      received,
      /** Waits until `predicate` is satisfied or the timeout elapses. */
      async waitFor(predicate: () => boolean, timeoutMs = 12000) {
        const started = Date.now();
        while (Date.now() - started < timeoutMs) {
          if (predicate()) return true;
          await new Promise((r) => setTimeout(r, 200));
        }
        return false;
      },
      async close() {
        await supabase.removeChannel(channel);
      },
    };
  }

  it("delivers join, start, mark and bingo events to a subscriber", async () => {
    const hostToken = testToken("host");
    const { data: room } = await supabase.rpc("create_room", {
      p_game_template_id: AIRPORT_BINGO_ID,
      p_host_token: hostToken,
      p_host_nickname: "Host",
    });
    createdRooms.push(room.roomId);

    const listener = await listen(room.roomId);

    const guest = testToken("ryan");
    await supabase.rpc("join_room", {
      p_room_code: room.roomCode,
      p_nickname: "Ryan",
      p_guest_token: guest,
    });

    expect(
      await listener.waitFor(() =>
        listener.received.some((m) => m.event === "PLAYER_JOINED")
      )
    ).toBe(true);

    await supabase.rpc("start_room", {
      p_room_id: room.roomId,
      p_host_token: hostToken,
    });

    expect(
      await listener.waitFor(() =>
        listener.received.some((m) => m.event === "GAME_STARTED")
      )
    ).toBe(true);

    const { data: snap } = await supabase.rpc("get_room_snapshot", {
      p_room_id: room.roomId,
      p_token: guest,
    });
    const card = snap.card as Array<{
      id: string;
      position: number;
      isFree: boolean;
      text: string;
    }>;

    // Complete the top row: marks, then a bingo.
    for (const square of card.filter((s) => s.position < 5)) {
      await supabase.rpc("toggle_square", {
        p_card_square_id: square.id,
        p_guest_token: guest,
      });
    }

    expect(
      await listener.waitFor(() =>
        listener.received.some((m) => m.event === "SQUARE_MARKED")
      )
    ).toBe(true);
    expect(
      await listener.waitFor(() =>
        listener.received.some((m) => m.event === "BINGO")
      )
    ).toBe(true);

    // Progress payloads carry the score so listeners can rank players.
    const marked = listener.received.find((m) => m.event === "SQUARE_MARKED")!;
    expect(marked.payload.nickname).toBe("Ryan");
    expect(typeof marked.payload.score).toBe("number");

    // ...but never the card itself (PRD §32).
    const serialized = JSON.stringify(listener.received);
    for (const square of card.filter((s) => !s.isFree)) {
      expect(serialized).not.toContain(square.text);
    }
    expect(serialized).not.toContain("position");

    await listener.close();
  }, 60000);

  it("broadcasts pause, resume and end to subscribers", async () => {
    const hostToken = testToken("host");
    const { data: room } = await supabase.rpc("create_room", {
      p_game_template_id: AIRPORT_BINGO_ID,
      p_host_token: hostToken,
      p_host_nickname: "Host",
    });
    createdRooms.push(room.roomId);

    const listener = await listen(room.roomId);
    const args = { p_room_id: room.roomId, p_host_token: hostToken };

    await supabase.rpc("start_room", args);
    await supabase.rpc("pause_room", args);
    await supabase.rpc("resume_room", args);
    await supabase.rpc("end_room", args);

    expect(
      await listener.waitFor(() =>
        ["GAME_PAUSED", "GAME_RESUMED", "GAME_COMPLETED"].every((event) =>
          listener.received.some((m) => m.event === event)
        )
      )
    ).toBe(true);

    await listener.close();
  }, 60000);
});
