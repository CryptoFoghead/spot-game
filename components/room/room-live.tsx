"use client";

import { useEffect, useState } from "react";

import { useRoomRefresh } from "@/lib/room-refresh";
import { createClient } from "@/lib/supabase/client";

type ConnectionState = "connecting" | "live" | "offline";

/**
 * Subscribes to the room's realtime channel (PRD §26, §27, §29).
 *
 * Broadcast messages are treated as "something changed" hints, never as state:
 * every one triggers a refetch of the authoritative server render. On
 * (re)subscribe we always resync, so a player who missed messages while their
 * phone was asleep or off-network recovers correct state rather than trying to
 * replay events (§29).
 */
export function RoomLive({
  roomId,
  playerId,
  nickname,
  role,
}: {
  roomId: string;
  playerId: string | null;
  nickname: string;
  role: string;
}) {
  const scheduleRefresh = useRoomRefresh();
  const [state, setState] = useState<ConnectionState>("connecting");
  const [onlineCount, setOnlineCount] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`room:${roomId}`, {
      config: { presence: { key: playerId ?? `viewer-${nickname}` } },
    });

    channel
      .on("broadcast", { event: "*" }, scheduleRefresh)
      .on("presence", { event: "sync" }, () => {
        setOnlineCount(Object.keys(channel.presenceState()).length);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          setState("live");
          // Authoritative resync on every (re)connect.
          scheduleRefresh();
          await channel.track({ playerId, nickname, role });
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setState("offline");
        } else if (status === "CLOSED") {
          setState("connecting");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, playerId, nickname, role, scheduleRefresh]);

  return (
    <p
      className="flex items-center gap-1.5 text-xs text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      <span
        aria-hidden
        className={
          "inline-block size-2 rounded-full " +
          (state === "live"
            ? "bg-emerald-500"
            : state === "connecting"
              ? "bg-amber-500"
              : "bg-destructive")
        }
      />
      {state === "live"
        ? `${onlineCount} online`
        : state === "connecting"
          ? "Connecting…"
          : "Connection lost. Reconnecting…"}
    </p>
  );
}
