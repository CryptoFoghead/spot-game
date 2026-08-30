import type { RoomSnapshot } from "@/lib/room";

/**
 * Scores and status only — never another player's card contents (PRD §32).
 * "One square away" is computed server-side from the card's lines, so it
 * reveals that someone is close without revealing what they hold.
 */
export function Leaderboard({
  players,
  meId,
}: {
  players: RoomSnapshot["players"];
  meId: string | null;
}) {
  return (
    <ol className="flex flex-col gap-1">
      {players.map((player, index) => {
        return (
          <li
            key={player.id}
            className={
              "flex items-center justify-between rounded-lg border px-3 py-2 text-sm" +
              (player.id === meId ? " border-foreground/40 bg-muted" : "")
            }
          >
            <span className="flex items-center gap-2">
              <span className="w-4 text-muted-foreground tabular-nums">
                {index + 1}
              </span>
              <span className="font-medium">{player.nickname}</span>
              {player.hasBingo ? (
                <span title="Bingo" aria-label="has bingo">
                  🏆
                </span>
              ) : null}
              {!player.hasBingo && player.isOneAway ? (
                <span title="One square away" aria-label="one square away">
                  🔥
                </span>
              ) : null}
            </span>
            <span className="tabular-nums">{player.score}</span>
          </li>
        );
      })}
    </ol>
  );
}
