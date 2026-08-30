"use client";

import { useEffect, useState } from "react";

import { finishTimedRoom } from "@/app/actions/rooms";
import { useRoomRefresh } from "@/lib/room-refresh";

/**
 * Countdown for timed rooms.
 *
 * Counts from a server-supplied deadline rather than a remaining-seconds
 * number, so a backgrounded tab, a refresh, or a phone waking from sleep all
 * land on the correct time instead of resuming a stale clock.
 *
 * When it reaches zero the client asks the server to settle the room. Several
 * clients will ask at once; the RPC is idempotent, and scheduled maintenance
 * settles rooms where everyone has closed their phone.
 */
export function Countdown({
  endsAt,
  roomId,
  active,
  size = "sm",
}: {
  endsAt: string;
  roomId: string;
  active: boolean;
  size?: "sm" | "lg";
}) {
  const scheduleRefresh = useRoomRefresh();
  const [remaining, setRemaining] = useState(() => msRemaining(endsAt));

  useEffect(() => {
    const tick = setInterval(() => setRemaining(msRemaining(endsAt)), 500);
    return () => clearInterval(tick);
  }, [endsAt]);

  useEffect(() => {
    if (!active || remaining > 0) return;
    let cancelled = false;
    void finishTimedRoom(roomId).then(() => {
      if (!cancelled) scheduleRefresh();
    });
    return () => {
      cancelled = true;
    };
  }, [active, remaining, roomId, scheduleRefresh]);

  const done = remaining <= 0;
  // Under a minute is the part that changes behaviour, so it gets the colour.
  const urgent = !done && remaining < 60_000;

  return (
    <span
      role="timer"
      aria-live={urgent ? "polite" : "off"}
      className={
        "font-mono font-bold tabular-nums " +
        (size === "lg" ? "text-4xl " : "text-sm ") +
        (done
          ? "text-muted-foreground"
          : urgent
            ? "text-destructive"
            : "text-foreground")
      }
    >
      {done ? "time" : format(remaining)}
    </span>
  );
}

function msRemaining(endsAt: string) {
  return Math.max(0, new Date(endsAt).getTime() - Date.now());
}

function format(ms: number) {
  const total = Math.ceil(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
