import type { RoomSnapshot } from "@/lib/room";

/**
 * Scores only — never another player's card contents (PRD §32).
 * The 🔥 "one square away" hint needs real line analysis, not a score
 * threshold, so it waits for server-side bingo detection.
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
              {player.hasBingo ? <span title="Bingo">🏆</span> : null}
            </span>
            <span className="tabular-nums">{player.score}</span>
          </li>
        );
      })}
    </ol>
  );
}
