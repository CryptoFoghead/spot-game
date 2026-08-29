"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";

/**
 * A single coalescing scheduler for server-state refreshes on a room page.
 *
 * Both the board (after a successful mark) and the realtime channel (on every
 * broadcast) want to refetch the authoritative render. Left independent, their
 * router.refresh() calls overlap and abort each other — on a deployment, with
 * real latency, the *last* refresh was the one getting cancelled, so a player's
 * own score stayed stale until they reloaded.
 *
 * Requests are debounced on the trailing edge and shared across components, so
 * a burst of activity produces exactly one refetch once it settles.
 */

const DEBOUNCE_MS = 350;

// Module scope: every component on the page shares one scheduler.
let timer: ReturnType<typeof setTimeout> | null = null;
let runRefresh: (() => void) | null = null;

export function useRoomRefresh() {
  const router = useRouter();

  useEffect(() => {
    runRefresh = () => router.refresh();
    return () => {
      // Only clear the hook that is still registered.
      if (runRefresh) runRefresh = null;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };
  }, [router]);

  return useCallback(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      runRefresh?.();
    }, DEBOUNCE_MS);
  }, []);
}
