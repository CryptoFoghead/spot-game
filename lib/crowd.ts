/**
 * The crowd palette.
 *
 * Colour here is information, not decoration: a category keeps the same hue
 * everywhere it appears, and a player keeps the same hue for the length of a
 * game, so "which one is mine" is answerable at a glance on a small screen.
 *
 * Assignment is derived from the id, so it is stable across renders, across
 * devices, and across server and client — no state, no randomness.
 *
 * Every hue below is a FILL. None is dark enough to use as small text on
 * paper; each carries either ink or white on top, given per entry.
 */

export type CrowdHue = {
  /** CSS custom property holding the fill. */
  fill: string;
  /** Text colour that meets contrast on that fill. */
  on: "ink" | "white";
};

/**
 * Text pairing is measured, not guessed. White reaches only 3.08:1 on the
 * green and 3.37:1 on the pink — both below the 4.5:1 minimum for the small
 * text these chips use. Ink clears it on every hue except the violet, which is
 * dark enough that ink would fail instead.
 */
const CROWD: CrowdHue[] = [
  { fill: "var(--spot)", on: "white" },
  { fill: "var(--marigold)", on: "ink" },
  { fill: "var(--kelp)", on: "ink" },
  { fill: "var(--flare)", on: "ink" },
  { fill: "var(--sky)", on: "ink" },
];

/** Small, stable string hash. Not security-relevant. */
function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function hueFor(key: string): CrowdHue {
  return CROWD[hash(key) % CROWD.length];
}

/** Inline style for a filled chip or dot in the crowd palette. */
export function hueStyle(key: string): React.CSSProperties {
  const hue = hueFor(key);
  return {
    backgroundColor: hue.fill,
    color: hue.on === "white" ? "#ffffff" : "var(--ink)",
  };
}

/** Just the fill, for dots and rules where no text sits on top. */
export function hueFill(key: string): React.CSSProperties {
  return { backgroundColor: hueFor(key).fill };
}
