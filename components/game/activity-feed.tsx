import { hueFill } from "@/lib/crowd";

export type ActivityEntry = {
  id: string;
  type: string;
  nickname: string | null;
  playerId?: string | null;
  text: string | null;
  at: string;
};

/**
 * What just happened in the room (PRD §51).
 *
 * Kept short on purpose — the PRD's own warning is "do not flood screen".
 * The feed exists to make other people's play visible, which is the whole
 * reason to be in a room together rather than playing alone.
 */
export function ActivityFeed({
  entries,
  limit = 6,
  size = "sm",
}: {
  entries: ActivityEntry[];
  limit?: number;
  size?: "sm" | "lg";
}) {
  const shown = entries.slice(0, limit);
  if (shown.length === 0) return null;

  return (
    <ul
      className={
        "flex flex-col gap-1.5 " + (size === "lg" ? "text-lg" : "text-sm")
      }
    >
      {shown.map((entry) => (
        <li key={entry.id} className="flex items-start gap-2">
          <span
            className={
              "mt-1.5 shrink-0 rounded-full " +
              (size === "lg" ? "size-2.5" : "size-2")
            }
            style={hueFill(entry.playerId ?? entry.nickname ?? entry.id)}
            aria-hidden
          />
          <span className="min-w-0">{describe(entry)}</span>
        </li>
      ))}
    </ul>
  );
}

function describe(entry: ActivityEntry) {
  const who = entry.nickname ?? "Someone";

  switch (entry.type) {
    case "player_joined":
      return (
        <>
          <strong className="font-semibold">{who}</strong> joined
        </>
      );
    case "square_marked":
      return entry.text ? (
        <>
          <strong className="font-semibold">{who}</strong> spotted{" "}
          <span className="text-muted-foreground">“{entry.text}”</span>
        </>
      ) : (
        <>
          <strong className="font-semibold">{who}</strong> spotted something
        </>
      );
    case "bingo":
      return (
        <>
          <strong className="font-semibold">{who}</strong> got BINGO 🏆
        </>
      );
    case "game_started":
      return <span className="text-muted-foreground">The game started</span>;
    case "game_completed":
      return <span className="text-muted-foreground">The game ended</span>;
    case "player_removed":
      return (
        <span className="text-muted-foreground">{who} left the game</span>
      );
    default:
      return null;
  }
}
