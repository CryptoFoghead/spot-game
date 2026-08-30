"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { newGuestToken, readGuestToken, writeGuestToken } from "@/lib/guest";
import { reportError } from "@/lib/observability";
import { createClient } from "@/lib/supabase/server";
import {
  gameModeSchema,
  nicknameSchema,
  roomCodeSchema,
} from "@/lib/validation/room";

export type RoomFormState = { error?: string };

const idSchema = z.uuid();

/** Postgres RAISE messages are user-facing here, so keep them friendly. */
function friendly(message: string | undefined): string {
  if (!message) return "Something went wrong. Try again.";
  if (message.includes("not found")) return "We couldn't find that room.";
  if (message.includes("expired")) return "This game has ended.";
  if (message.includes("removed from room"))
    return "The host removed you from this game.";
  if (message.includes("not the host"))
    return "Only the host can do that.";
  if (message.includes("nickname required")) return "Enter a nickname.";
  if (message.includes("squares to start"))
    return "This game doesn't have enough squares to start yet.";
  // Unmapped failures still reach the user as a generic message, but the
  // cause must not vanish.
  reportError("rooms.rpc", new Error(message));
  return "Something went wrong. Try again.";
}

export async function startRoomFromGame(
  _prev: RoomFormState,
  formData: FormData
): Promise<RoomFormState> {
  const gameId = idSchema.safeParse(formData.get("game_id"));
  if (!gameId.success) return { error: "Unknown game." };

  const mode = gameModeSchema.safeParse(formData.get("game_mode") ?? "classic");
  if (!mode.success) return { error: "Pick a valid game mode." };

  const nickname = nicknameSchema.safeParse(formData.get("nickname") ?? "Host");
  if (!nickname.success) return { error: nickname.error.issues[0].message };

  const token = newGuestToken();
  const supabase = await createClient();
  const durationRaw = Number(formData.get("duration_seconds"));
  const duration =
    mode.data === "timed" && Number.isFinite(durationRaw) && durationRaw > 0
      ? durationRaw
      : null;

  const { data, error } = await supabase.rpc("create_room", {
    p_game_template_id: gameId.data,
    p_host_token: token,
    p_host_nickname: nickname.data,
    p_game_mode: mode.data,
    p_continue_after_win: formData.get("continue_after_win") !== "off",
    p_duration_seconds: duration,
  });

  if (error || !data) return { error: friendly(error?.message) };

  await writeGuestToken(data.roomCode, token);
  redirect(`/room/${data.roomCode}/host`);
}

export async function joinRoom(
  _prev: RoomFormState,
  formData: FormData
): Promise<RoomFormState> {
  const code = roomCodeSchema.safeParse(formData.get("room_code"));
  if (!code.success) return { error: code.error.issues[0].message };

  const nickname = nicknameSchema.safeParse(formData.get("nickname") ?? "");
  if (!nickname.success) return { error: nickname.error.issues[0].message };

  // Reuse an existing token so a refresh rejoins as the same player.
  const token = (await readGuestToken(code.data)) ?? newGuestToken();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("join_room", {
    p_room_code: code.data,
    p_nickname: nickname.data,
    p_guest_token: token,
  });

  if (error || !data) return { error: friendly(error?.message) };

  await writeGuestToken(code.data, token);
  redirect(`/room/${code.data}/play`);
}

async function hostAction(
  rpc: "start_room" | "pause_room" | "resume_room" | "end_room",
  formData: FormData
): Promise<RoomFormState> {
  const roomId = idSchema.safeParse(formData.get("room_id"));
  const code = roomCodeSchema.safeParse(formData.get("room_code"));
  if (!roomId.success || !code.success) return { error: "Unknown room." };

  const token = await readGuestToken(code.data);
  if (!token) return { error: "Only the host can do that." };

  const supabase = await createClient();
  const { error } = await supabase.rpc(rpc, {
    p_room_id: roomId.data,
    p_host_token: token,
  });
  if (error) return { error: friendly(error.message) };

  revalidatePath(`/room/${code.data}/host`);
  revalidatePath(`/room/${code.data}/play`);
  return {};
}

export async function startRoom(_p: RoomFormState, f: FormData) {
  return hostAction("start_room", f);
}
export async function pauseRoom(_p: RoomFormState, f: FormData) {
  return hostAction("pause_room", f);
}
export async function resumeRoom(_p: RoomFormState, f: FormData) {
  return hostAction("resume_room", f);
}
export async function endRoom(_p: RoomFormState, f: FormData) {
  return hostAction("end_room", f);
}

/** Settles a timed room whose clock has run out. Idempotent server-side. */
export async function finishTimedRoom(roomId: string): Promise<RoomFormState> {
  const id = idSchema.safeParse(roomId);
  if (!id.success) return { error: "Unknown room." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("finish_timed_room", {
    p_room_id: id.data,
  });
  if (error) return { error: friendly(error.message) };
  return {};
}

export async function removePlayer(
  _prev: RoomFormState,
  formData: FormData
): Promise<RoomFormState> {
  const roomId = idSchema.safeParse(formData.get("room_id"));
  const playerId = idSchema.safeParse(formData.get("player_id"));
  const code = roomCodeSchema.safeParse(formData.get("room_code"));
  if (!roomId.success || !playerId.success || !code.success)
    return { error: "Unknown room." };

  const token = await readGuestToken(code.data);
  if (!token) return { error: "Only the host can do that." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_player", {
    p_room_id: roomId.data,
    p_player_id: playerId.data,
    p_host_token: token,
  });
  if (error) return { error: friendly(error.message) };

  revalidatePath(`/room/${code.data}/host`);
  return {};
}
