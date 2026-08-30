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
        // Presence is keyed per connection, so one player with two tabs
        // appears twice. Count distinct players, not sockets (G-15).
        const state = channel.presenceState<{ playerId?: string | null }>();
        const people = new Set<string>();
        for (const [key, entries] of Object.entries(state)) {
          for (const entry of entries) {
            people.add(entry.playerId ?? key);
          }
        }
        setOnlineCount(people.size);
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

    // A phone that spent the main course in a pocket is the normal case, not
    // the edge case. The socket dies while backgrounded and does not always
    // report it, so the indicator can still say "live" over a board that
    // stopped updating ten minutes ago. Coming back to the tab, or getting the
    // network back, therefore forces a resync from the database — which is the
    // authority anyway, so an extra refetch costs nothing and the scheduler
    // debounces bursts.
    function resync() {
      if (document.visibilityState === "visible") scheduleRefresh();
    }

    document.addEventListener("visibilitychange", resync);
    window.addEventListener("online", resync);

    return () => {
      document.removeEventListener("visibilitychange", resync);
      window.removeEventListener("online", resync);
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
