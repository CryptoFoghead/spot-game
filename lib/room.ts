import "server-only";

import { readGuestToken } from "@/lib/guest";
import { createClient } from "@/lib/supabase/server";

export type RoomSnapshot = {
  room: {
    id: string;
    code: string;
    status: "lobby" | "active" | "paused" | "completed" | "expired";
    gameMode: string;
    continueAfterWin: boolean;
    winnerPlayerId: string | null;
  };
  isHost: boolean;
  me: {
    id: string;
    nickname: string;
    role: string;
    score: number;
    hasBingo: boolean;
  } | null;
  players: Array<{
    id: string;
    nickname: string;
    role: string;
    score: number;
    markedCount: number;
    hasBingo: boolean;
  }>;
  card: Array<{
    id: string;
    position: number;
    text: string;
    isFree: boolean;
    marked: boolean;
  }>;
  gameTitle: string;
};

/**
 * Authoritative room state for the current viewer, identified by their guest
 * cookie. Returns null when they hold no valid seat in the room.
 */
export async function loadRoomSnapshot(
  roomCode: string
): Promise<RoomSnapshot | null> {
  const token = await readGuestToken(roomCode);
  if (!token) return null;

  const supabase = await createClient();
  // Resolves in any status — a participant must still be able to see a room
  // that has ended, which get_join_info deliberately hides.
  const { data: roomId } = await supabase.rpc("resolve_room_id", {
    p_room_code: roomCode,
  });
  if (!roomId) return null;

  const { data, error } = await supabase.rpc("get_room_snapshot", {
    p_room_id: roomId,
    p_token: token,
  });
  if (error || !data) return null;
  return data as RoomSnapshot;
}
