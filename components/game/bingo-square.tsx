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
 * Tile text is sized to its own length rather than one size for all.
 *
 * A fixed 10px meant short squares looked lost in white space while the
 * longest ones clipped mid-word (B-11). Scaling by length lets "Airport beer"
 * read comfortably at arm's length and gives "Someone eating a full meal at
 * the gate" the room it needs.
 */
function textSize(text: string): string {
  if (text.length <= 16) return "text-[13px] leading-[1.1] sm:text-sm";
  if (text.length <= 28) return "text-[11.5px] leading-[1.12] sm:text-[13px]";
  if (text.length <= 44) return "text-[10px] leading-[1.14] sm:text-xs";
  return "text-[9px] leading-[1.12] sm:text-[11px]";
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
  spotterFill,
  spotterName,
}: {
  square: CardSquare;
  roomCode?: string;
  interactive: boolean;
  pending?: boolean;
  onToggle?: (square: CardSquare) => void;
  /** Shared cards only: the hue of whoever spotted this square. */
  spotterFill?: string;
  spotterName?: string;
}) {
  const disabled = !interactive || square.isFree;

  return (
    <button
      type="button"
      aria-pressed={square.marked}
      aria-label={`${square.text}${square.marked ? (spotterName ? ` (spotted by ${spotterName})` : " (spotted)") : ""}`}
      disabled={disabled}
      onClick={onToggle ? () => onToggle(square) : undefined}
      className={cn(
        "relative flex aspect-square items-center justify-center overflow-hidden rounded-xl border-2 p-1 text-center font-medium break-words transition-[background-color,border-color,transform] duration-150 sm:p-1.5",
        textSize(square.text),
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
      {/* Shared card: a corner flag in the spotter's colour, so you can see
          at a glance who found what without reading anything. */}
      {spotterFill && square.marked && !square.isFree ? (
        <span
          className="pointer-events-none absolute bottom-0 left-0 size-2.5 rounded-tr-md"
          style={{ backgroundColor: spotterFill }}
          aria-hidden
        />
      ) : null}
      <span className="relative line-clamp-5">{square.text}</span>
    </button>
  );
}
