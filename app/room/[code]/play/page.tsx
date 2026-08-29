import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Leaderboard } from "@/components/game/leaderboard";
import { PlayBoard } from "@/components/game/play-board";
import { WinnerOverlay } from "@/components/game/winner-overlay";
import { Badge } from "@/components/ui/badge";
import { loadRoomSnapshot } from "@/lib/room";

export const metadata: Metadata = { title: "Play" };

export default async function PlayRoomPage(
  props: PageProps<"/room/[code]/play">
) {
  const { code } = await props.params;
  const snapshot = await loadRoomSnapshot(code);
  if (!snapshot) notFound();

  const { room, me, players, card } = snapshot;

  if (!me) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-16">
        <h1 className="text-xl font-bold">You&apos;re not in this game</h1>
        <Link href={`/join/${code}`} className="mt-4 inline-block underline">
          Join room {code} →
        </Link>
      </div>
    );
  }

  const leader = players[0];
  const isLobby = room.status === "lobby";
  const winner = room.winnerPlayerId
    ? players.find((player) => player.id === room.winnerPlayerId)
    : null;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-3 py-4">
      <header className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">Room {room.code}</p>
          <p className="font-semibold">{me.nickname}</p>
        </div>
        <Badge variant={room.status === "active" ? "default" : "secondary"}>
          {room.status === "active" ? "● LIVE" : room.status}
        </Badge>
      </header>

      {isLobby ? (
        <div className="rounded-lg border bg-muted px-3 py-3 text-sm">
          <p className="font-medium">You&apos;re in!</p>
          <p className="text-muted-foreground">Waiting for the host to start…</p>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
          <span>
            You: <span className="font-bold tabular-nums">{me.score}</span>
          </span>
          {leader ? (
            <span className="text-muted-foreground">
              Leader: {leader.nickname}{" "}
              <span className="font-bold tabular-nums">{leader.score}</span>
            </span>
          ) : null}
        </div>
      )}

      {room.status === "paused" ? (
        <p className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
          The host paused the game — marking is off until they resume.
        </p>
      ) : null}

      {room.status === "completed" ? (
        <p className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
          This game has ended.
        </p>
      ) : null}

      <PlayBoard
        initialSquares={card}
        roomCode={room.code}
        interactive={room.status === "active"}
      />

      <section>
        <h2 className="mb-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Players
        </h2>
        <Leaderboard players={players} meId={me.id} />
      </section>

      {winner ? (
        <WinnerOverlay
          nickname={winner.nickname}
          score={winner.score}
          isMe={winner.id === me.id}
        />
      ) : null}
    </div>
  );
}
