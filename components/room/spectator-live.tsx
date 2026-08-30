"use client";

import { useEffect } from "react";

import { useRoomRefresh } from "@/lib/room-refresh";
import { createClient } from "@/lib/supabase/client";

/**
 * Keeps the party screen current.
 *
 * Subscribes to the same room broadcast as players do, but takes no part in
 * presence — a TV in the corner is not a person in the room, and counting it
 * as one would inflate the online count everyone else sees.
 */
export function SpectatorLive({ roomId }: { roomId: string }) {
  const scheduleRefresh = useRoomRefresh();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`room:${roomId}`);

    channel.on("broadcast", { event: "*" }, scheduleRefresh).subscribe((status) => {
      if (status === "SUBSCRIBED") scheduleRefresh();
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, scheduleRefresh]);

  return null;
}
