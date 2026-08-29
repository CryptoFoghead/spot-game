"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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
  const router = useRouter();
  const [state, setState] = useState<ConnectionState>("connecting");
  const [onlineCount, setOnlineCount] = useState(0);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`room:${roomId}`, {
      config: { presence: { key: playerId ?? `viewer-${nickname}` } },
    });

    // Bursts of marks shouldn't trigger a refetch each; coalesce them.
    const scheduleRefresh = () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => router.refresh(), 250);
    };

    channel
      .on("broadcast", { event: "*" }, scheduleRefresh)
      .on("presence", { event: "sync" }, () => {
        setOnlineCount(Object.keys(channel.presenceState()).length);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          setState("live");
          // Authoritative resync on every (re)connect.
          router.refresh();
          await channel.track({ playerId, nickname, role });
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setState("offline");
        } else if (status === "CLOSED") {
          setState("connecting");
        }
      });

    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      supabase.removeChannel(channel);
    };
  }, [roomId, playerId, nickname, role, router]);

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
