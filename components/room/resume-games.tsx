import Link from "next/link";

import { loadResumableRooms } from "@/lib/room";

/**
 * "You're still in this game" — the way back.
 *
 * Swiping away from the tab used to be the end of it: nothing on any page
 * mentioned that you were in a game, so the only route back was remembering a
 * URL or a 4-digit code. The cookie was almost always still valid.
 *
 * The host gets both links, because the host has two screens and losing the
 * controls is worse than losing the card — nobody else can start, pause or end
 * the game.
 */
export async function ResumeGames() {
  const rooms = await loadResumableRooms();
  if (rooms.length === 0) return null;

  return (
    <section
      aria-label="Games you are in"
      className="flex flex-col gap-2 rounded-xl border-2 border-primary/30 bg-primary/5 p-3"
    >
      <p className="font-display text-sm font-bold tracking-tight">
        {rooms.length === 1 ? "You're still in a game" : "You're still in these games"}
      </p>
      <ul className="flex flex-col gap-2">
        {rooms.map((room) => (
          <li
            key={room.code}
            className="flex flex-wrap items-center justify-between gap-2"
          >
            <span className="min-w-0 text-sm">
              <span className="font-medium">{room.gameTitle}</span>
              <span className="text-muted-foreground">
                {" "}
                · Room {room.code} · {room.nickname}
                {room.status === "paused" ? " · paused" : ""}
              </span>
            </span>
            <span className="flex shrink-0 gap-2">
              <Link
                href={`/room/${room.code}/play`}
                className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
              >
                My card
              </Link>
              {room.isHost ? (
                <Link
                  href={`/room/${room.code}/host`}
                  className="rounded-lg border px-3 py-1.5 text-sm font-medium"
                >
                  Host
                </Link>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
