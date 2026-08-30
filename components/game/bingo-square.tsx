"use client";

import type { CardSquare } from "@/components/game/bingo-board";
import { cn } from "@/lib/utils";

/**
 * The stamp: a perforated ring with a tick, set off-axis in the corner.
 *
 * It started centred over the tile and made the text unreadable at 10px — the
 * signature cannot cost legibility on the one screen players stare at. Sitting
 * it in the corner keeps the "I saw this" mark while the words stay clean.
 */
function Stamp() {
  return (
    <svg
      viewBox="0 0 48 48"
      className="spot-stamp pointer-events-none absolute top-0.5 right-0.5 size-[32%]"
      aria-hidden
      fill="none"
    >
      {/* Perforated ring keeps the stamp character; the solid disc means any
          overlap with a long first line reads as a seal placed on top rather
          than as two things fighting for the same pixels. */}
      <circle
        cx="24"
        cy="24"
        r="22"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeDasharray="0.5 7"
        strokeLinecap="round"
        opacity="0.75"
      />
      <circle cx="24" cy="24" r="17" fill="currentColor" />
      <path
        d="M15.5 24.5 L21 30 L32.5 18"
        stroke="var(--primary)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * One tile. Marked state is carried by fill, the stamp, and border weight —
 * never by colour alone (PRD §63).
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
      aria-label={`${square.text}${square.marked ? " (spotted)" : ""}`}
      disabled={disabled}
      onClick={onToggle ? () => onToggle(square) : undefined}
      className={cn(
        "relative flex aspect-square items-center justify-center overflow-hidden rounded-xl border-2 p-1 text-center text-[10px] leading-[1.15] font-medium break-words transition-[background-color,border-color,transform] duration-150 sm:p-2 sm:text-xs",
        "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        // FREE is neither spotted nor spottable, so it reads as a third
        // state: inked rather than stamped.
        square.isFree
          ? "border-foreground bg-foreground font-display tracking-widest text-background"
          : square.marked
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-accent",
        !disabled && "cursor-pointer active:scale-[0.97]",
        pending && "opacity-70"
      )}
    >
      {square.marked && !square.isFree ? <Stamp /> : null}
      <span className="relative line-clamp-4">{square.text}</span>
    </button>
  );
}
