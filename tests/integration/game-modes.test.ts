import { afterAll, describe, expect, it } from "vitest";

import { cornerPositions, hasBingo, type BingoMode } from "@/lib/game/bingo";

import {
  AIRPORT_BINGO_ID,
  anonClient,
  deleteRoom,
  hasLiveEnv,
  testToken,
} from "./helpers";

const describeLive = hasLiveEnv ? describe : describe.skip;

type Square = { id: string; position: number; isFree: boolean; marked: boolean };

/**
 * The win conditions exist twice: authoritative in SQL, mirrored in TypeScript
 * for the client. These tests drive the real database and assert the two agree
 * for every mode — a divergence would mean the board shows one thing while the
 * server believes another.
 */
describeLive("game modes agree between SQL and TypeScript", () => {
  const rooms: string[] = [];
  const supabase = anonClient();

  afterAll(async () => {
    for (const id of rooms) await deleteRoom(id);
  });

  async function activeRoom(mode: BingoMode) {
    const token = testToken(`host-${mode}`);
    const { data: room, error } = await supabase.rpc("create_room", {
      p_game_template_id: AIRPORT_BINGO_ID,
      p_host_token: token,
      p_host_nickname: "Modes",
      p_game_mode: mode,
    });
    if (error) throw new Error(`${mode}: ${error.message}`);
    rooms.push(room.roomId);

    await supabase.rpc("start_room", {
      p_room_id: room.roomId,
      p_host_token: token,
    });

    const { data: snap } = await supabase.rpc("get_room_snapshot", {
      p_room_id: room.roomId,
      p_token: token,
    });
    return { room, token, card: snap.card as Square[] };
  }

  /** Marks the given positions and returns the final server response. */
  async function mark(card: Square[], token: string, positions: number[]) {
    let last;
    for (const position of positions) {
      const square = card.find((s) => s.position === position)!;
      if (square.isFree) continue;
      last = await supabase.rpc("toggle_square", {
        p_card_square_id: square.id,
        p_guest_token: token,
      });
      if (last.error) throw new Error(last.error.message);
    }
    return last!.data;
  }

  /** Positions the server considers marked, including the FREE centre. */
  function markedWith(positions: number[]) {
    return [...new Set([...positions, 12])];
  }

  it("four_corners: wins on the corners, not on a row", async () => {
    const corners = cornerPositions(5);

    const a = await activeRoom("four_corners");
    const rowResult = await mark(a.card, a.token, [0, 1, 2, 3, 4]);
    expect(rowResult.hasBingo).toBe(false);
    expect(hasBingo(markedWith([0, 1, 2, 3, 4]), 5, "four_corners")).toBe(false);

    const b = await activeRoom("four_corners");
    const cornerResult = await mark(b.card, b.token, corners);
    expect(cornerResult.hasBingo).toBe(true);
    expect(hasBingo(markedWith(corners), 5, "four_corners")).toBe(true);
  });

  it("double: needs two lines, not one", async () => {
    const topRow = [0, 1, 2, 3, 4];
    const leftCol = [0, 5, 10, 15, 20];

    const a = await activeRoom("double");
    const oneLine = await mark(a.card, a.token, topRow);
    expect(oneLine.hasBingo).toBe(false);
    expect(hasBingo(markedWith(topRow), 5, "double")).toBe(false);

    const twoLines = await mark(a.card, a.token, leftCol.slice(1));
    expect(twoLines.hasBingo).toBe(true);
    expect(hasBingo(markedWith([...topRow, ...leftCol]), 5, "double")).toBe(true);
  });

  it("points: scores by square value, still wins on a line", async () => {
    const { card, token } = await activeRoom("points");
    const result = await mark(card, token, [0, 1, 2, 3, 4]);

    expect(result.hasBingo).toBe(true);
    // Seeded squares are worth 1 point each, so score equals marked count
    // here — the meaningful assertion is that both are reported separately.
    expect(result.markedCount).toBe(5);
    expect(result.score).toBe(5);
  });

  it("classic and blackout still behave as before", async () => {
    const classic = await activeRoom("classic");
    const line = await mark(classic.card, classic.token, [0, 1, 2, 3, 4]);
    expect(line.hasBingo).toBe(true);

    const blackout = await activeRoom("blackout");
    const partial = await mark(blackout.card, blackout.token, [0, 1, 2, 3, 4]);
    expect(partial.hasBingo).toBe(false);
  });

  it("rejects a mode the server does not implement", async () => {
    const { error } = await supabase.rpc("create_room", {
      p_game_template_id: AIRPORT_BINGO_ID,
      p_host_token: testToken("host"),
      p_host_nickname: "Modes",
      p_game_mode: "timed",
    });
    expect(error?.message).toMatch(/unsupported game mode/);
  });

  it("reports one-away correctly for four_corners", async () => {
    const { card, token } = await activeRoom("four_corners");
    const corners = cornerPositions(5);
    const result = await mark(card, token, corners.slice(0, 3));
    expect(result.hasBingo).toBe(false);
    expect(result.isOneAway).toBe(true);
  });
});
