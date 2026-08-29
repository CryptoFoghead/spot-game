"use client";

import { useEffect, useState } from "react";

import { toggleSquare } from "@/app/actions/play";
import type { CardSquare } from "@/components/game/bingo-board";
import { BingoSquare } from "@/components/game/bingo-square";
import { useRoomRefresh } from "@/lib/room-refresh";

/**
 * Optimistic marking (PRD §28): the tile flips immediately, then reverts with
 * a message if the server rejects it. The server remains the source of truth.
 */
export function PlayBoard({
  initialSquares,
  roomCode,
  interactive,
}: {
  initialSquares: CardSquare[];
  roomCode: string;
  interactive: boolean;
}) {
  const scheduleRefresh = useRoomRefresh();
  const [squares, setSquares] = useState(initialSquares);
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);

  // Server-rendered state wins whenever the page revalidates. Adjusting during
  // render (rather than in an effect) avoids a frame of stale marks.
  const [renderedFrom, setRenderedFrom] = useState(initialSquares);
  if (renderedFrom !== initialSquares) {
    setRenderedFrom(initialSquares);
    setSquares(initialSquares);
  }

  function setMarked(id: string, marked: boolean) {
    setSquares((current) =>
      current.map((square) =>
        square.id === id ? { ...square, marked } : square
      )
    );
  }

  async function onToggle(square: CardSquare) {
    if (!interactive || square.isFree || pendingIds.has(square.id)) return;

    const optimistic = !square.marked;
    setMarked(square.id, optimistic);
    setPendingIds((current) => new Set(current).add(square.id));

    const result = await toggleSquare(roomCode, square.id);

    setPendingIds((current) => {
      const next = new Set(current);
      next.delete(square.id);
      return next;
    });

    if (!result.ok) {
      setMarked(square.id, !optimistic);
      setMessage(result.error ?? "Could not update. Try again.");
      return;
    }

    // Keep the authoritative value even if it disagrees with the guess.
    setMarked(square.id, result.marked ?? optimistic);
    // Score, leaderboard and winner state live in the server render.
    scheduleRefresh();
  }

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [message]);

  return (
    <>
      <div
        className="grid w-full grid-cols-5 gap-1.5 sm:gap-2"
        role="group"
        aria-label="Your bingo card"
      >
        {squares.map((square) => (
          <BingoSquare
            key={square.id}
            square={square}
            interactive={interactive}
            pending={pendingIds.has(square.id)}
            onToggle={onToggle}
          />
        ))}
      </div>

      {message ? (
        <p
          role="status"
          className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-sm rounded-lg border border-destructive/40 bg-background px-3 py-2 text-center text-sm text-destructive shadow-lg"
        >
          {message}
        </p>
      ) : null}
    </>
  );
}
