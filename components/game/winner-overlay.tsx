"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * Winner celebration (PRD §34). Dismissible — players are never navigated away
 * from their own card.
 */
export function WinnerOverlay({
  nickname,
  score,
  isMe,
}: {
  nickname: string;
  score: number;
  isMe: boolean;
}) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Bingo"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 p-6 backdrop-blur"
    >
      <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-xl border bg-background p-6 text-center shadow-xl motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:duration-300">
        <p className="text-4xl motion-safe:animate-bounce" aria-hidden>
          🎉
        </p>
        <p className="font-display text-4xl font-extrabold">BINGO!</p>
        <p className="text-lg font-semibold uppercase">
          {isMe ? "You got bingo" : `${nickname} got bingo`}
        </p>
        <p className="text-sm text-muted-foreground">
          {score} {score === 1 ? "square" : "squares"} spotted
        </p>
        <Button className="mt-2 w-full" onClick={() => setDismissed(true)}>
          Keep Playing
        </Button>
      </div>
    </div>
  );
}
