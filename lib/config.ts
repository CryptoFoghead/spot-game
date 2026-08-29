/**
 * Product identity is configurable (PRD §79) — do not hardcode the working
 * name anywhere else. Rebranding is a one-line change here.
 */
export const siteConfig = {
  name: "SPOT",
  tagline: "The game happening all around you.",
  description:
    "Turn airports, fairs, games, bars, vacations and everyday people-watching into live multiplayer Bingo.",
} as const;
