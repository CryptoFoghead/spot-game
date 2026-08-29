"use server";

import { z } from "zod";

import { readGuestToken } from "@/lib/guest";
import { reportError } from "@/lib/observability";
import { createClient } from "@/lib/supabase/server";
import { roomCodeSchema } from "@/lib/validation/room";

export type ToggleResult = {
  ok: boolean;
  error?: string;
  marked?: boolean;
  score?: number;
  hasBingo?: boolean;
  isFirstWinner?: boolean;
  roomCompleted?: boolean;
};

const idSchema = z.uuid();

/**
 * Marking is one authoritative round trip (PRD §23). The client shows the tile
 * immediately and reverts if this fails (§28).
 */
export async function toggleSquare(
  roomCode: string,
  cardSquareId: string
): Promise<ToggleResult> {
  const code = roomCodeSchema.safeParse(roomCode);
  const squareId = idSchema.safeParse(cardSquareId);
  if (!code.success || !squareId.success) {
    return { ok: false, error: "Could not update. Try again." };
  }

  const token = await readGuestToken(code.data);
  if (!token) return { ok: false, error: "You're not in this game." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("toggle_square", {
    p_card_square_id: squareId.data,
    p_guest_token: token,
  });

  if (error || !data) {
    const message = error?.message ?? "";
    if (message.includes("room is not active")) {
      return { ok: false, error: "The game isn't running right now." };
    }
    if (message.includes("not your card")) {
      return { ok: false, error: "That isn't your card." };
    }
    if (message.includes("free square")) {
      return { ok: false, error: "The FREE square is always yours." };
    }
    reportError("play.toggle", error ?? new Error(message), { roomCode: code.data });
    return { ok: false, error: "Could not update. Try again." };
  }

  return {
    ok: true,
    marked: data.marked,
    score: data.score,
    hasBingo: data.hasBingo,
    isFirstWinner: data.isFirstWinner,
    roomCompleted: data.roomCompleted,
  };
}
