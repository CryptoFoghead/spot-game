"use client";

import { Check } from "lucide-react";

import type { CardSquare } from "@/components/game/bingo-board";
import { cn } from "@/lib/utils";

/**
 * One tile. Marked state is conveyed by a check icon and border weight as well
 * as fill, so it never depends on color alone (PRD §63).
 */
export function BingoSquare({
  square,
  interactive,
  pending,
  onToggle,
}: {
  square: CardSquare;
  roomCode?: string;
  interactive: boolean;
  pending?: boolean;
  onToggle?: (square: CardSquare) => void;
}) {
  const disabled = !interactive || square.isFree;

  return (
    <button
      type="button"
      aria-pressed={square.marked}
      aria-label={`${square.text}${square.marked ? " (marked)" : ""}`}
      disabled={disabled}
      onClick={onToggle ? () => onToggle(square) : undefined}
      className={cn(
        "relative flex aspect-square items-center justify-center rounded-lg border-2 p-1 text-center text-[10px] leading-tight break-words transition-colors sm:p-2 sm:text-xs",
        "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        square.marked
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background hover:bg-muted",
        square.isFree && "font-bold tracking-wide",
        !disabled && "cursor-pointer active:translate-y-px",
        pending && "opacity-70"
      )}
    >
      {square.marked && !square.isFree ? (
        <Check
          className="absolute top-0.5 right-0.5 size-3 opacity-80"
          aria-hidden
        />
      ) : null}
      <span className="line-clamp-4">{square.text}</span>
    </button>
  );
}
