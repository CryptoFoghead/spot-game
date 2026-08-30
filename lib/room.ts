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
    durationSeconds: number | null;
    endsAt: string | null;
    sharedCard: boolean;
  };
  isHost: boolean;
  me: {
    id: string;
    nickname: string;
    role: string;
    score: number;
    hasBingo: boolean;
    isOneAway: boolean;
  } | null;
  players: Array<{
    id: string;
    nickname: string;
    role: string;
    score: number;
    markedCount: number;
    hasBingo: boolean;
    isOneAway: boolean;
  }>;
  card: Array<{
    id: string;
    position: number;
    text: string;
    isFree: boolean;
    marked: boolean;
    markedBy: string | null;
  }>;
  gameTitle: string;
};

export type ActivityEntry = {
  id: string;
  type: string;
  nickname: string | null;
  playerId: string | null;
  text: string | null;
  at: string;
};

/** Recent room activity for a participant (PRD §51). */
export async function loadRoomActivity(
  roomCode: string,
  roomId: string
): Promise<ActivityEntry[]> {
  const token = await readGuestToken(roomCode);
  if (!token) return [];

  const supabase = await createClient();
  const { data } = await supabase.rpc("get_room_activity", {
    p_room_id: roomId,
    p_token: token,
    p_limit: 12,
  });
  return (data ?? []) as ActivityEntry[];
}

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
