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
/**
 * Puts a soft hyphen inside words too long for a tile.
 *
 * `hyphens: auto` is set and `lang` is "en", but Chrome did not hyphenate —
 * it broke "bachelorette" as "bachelorett/e", because `overflow-wrap` will
 * split anywhere and the hyphenation dictionary is not guaranteed to be
 * loaded. A soft hyphen is deterministic: the browser breaks THERE and draws
 * a hyphen, or does not break at all.
 *
 * Only long words are touched, and only the rendered text — `aria-label` keeps
 * the clean string, so a screen reader never hears the break.
 */
/** U+00AD. Named because a literal soft hyphen is invisible in source. */
const SOFT_HYPHEN = String.fromCharCode(0xad);

function softenLongWords(text: string): string {
  return text
    .split(/(\s+)/)
    .map((word) => {
      if (word.length <= 10) return word;
      // Break after a vowel near the middle, which reads better than a blind
      // midpoint split: "bachelo-rette" rather than "bachel-orette".
      const mid = Math.floor(word.length / 2);
      for (let offset = 0; offset <= 2; offset++) {
        for (const at of [mid + offset, mid - offset]) {
          if (at > 1 && at < word.length - 2 && /[aeiou]/i.test(word[at - 1])) {
            return word.slice(0, at) + SOFT_HYPHEN + word.slice(at);
          }
        }
      }
      return word.slice(0, mid) + SOFT_HYPHEN + word.slice(mid);
    })
    .join("");
}

function textSize(text: string): string {
  // Two things decide the size, and only one of them is obvious.
  //
  // Total length sets how many lines are needed. But a single long WORD sets a
  // hard floor: a tile is about 61px wide on a phone, so "Rhinestones" at 12px
  // simply does not fit, and `overflow-wrap` shatters it mid-word —
  // "Rhineston/es", "piggybac/k". That reads far worse than small text, which
  // is what the first pass at this produced.
  const longestWord = text
    .split(/s+/)
    .reduce((n, w) => Math.max(n, w.length), 0);

  // ~0.6em per character at this weight, inside ~61px of usable width.
  const wordCap = Math.floor(104 / Math.max(longestWord, 1));

  const byLength =
    text.length <= 16 ? 15 : text.length <= 28 ? 13 : text.length <= 44 ? 12 : 11;

  const size = Math.max(9, Math.min(byLength, wordCap));

  if (size >= 15) return "text-[15px] leading-[1.1] sm:text-sm";
  if (size >= 13) return "text-[13px] leading-[1.12] sm:text-[13px]";
  if (size >= 12) return "text-[12px] leading-[1.14] sm:text-xs";
  if (size >= 11) return "text-[11px] leading-[1.15] sm:text-[11px]";
  return "text-[10px] leading-[1.15] sm:text-[11px]";
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
        // Taller than wide on a phone. The board is width-constrained and has
        // vertical room to spare — square tiles left the longest squares at 9px
        // and clipped two of them outright. Square again from sm up, where
        // width is no longer the binding constraint.
        "relative flex aspect-[4/5] items-center justify-center overflow-hidden rounded-xl border-2 p-0.5 text-center font-medium hyphens-auto break-words transition-[background-color,border-color,transform] duration-150 sm:aspect-square sm:p-1.5",
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
      <span className="relative line-clamp-6">{softenLongWords(square.text)}</span>
    </button>
  );
}
