import { assignHues } from "@/lib/crowd";
import type { RoomSnapshot } from "@/lib/room";

/**
 * Scores and status only — never another player's card contents (PRD §32).
 *
 * Each player carries a hue from the crowd palette for the length of the game,
 * so "which one am I" is answerable without reading. "One square away" is
 * computed server-side from the card's lines, revealing that someone is close
 * without revealing what they hold.
 */
export function Leaderboard({
  players,
  meId,
}: {
  players: RoomSnapshot["players"];
  meId: string | null;
}) {
  const hues = assignHues(players.map((p) => p.id));

  return (
    <ol className="flex flex-col gap-1.5">
      {players.map((player, index) => {
        const isMe = player.id === meId;
        return (
          <li
            key={player.id}
            className={
              "flex items-center gap-3 rounded-xl border px-3 py-2 text-sm transition-colors " +
              (isMe ? "border-primary/50 bg-accent" : "border-border bg-card")
            }
          >
            <span className="w-4 text-xs text-muted-foreground tabular-nums">
              {index + 1}
            </span>
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: hues.get(player.id)?.fill }}
              aria-hidden
            />
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate font-semibold">{player.nickname}</span>
              {isMe ? (
                <span className="text-xs text-muted-foreground">(you)</span>
              ) : null}
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
            <span className="font-display ml-auto text-base font-bold tabular-nums">
              {player.score}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
