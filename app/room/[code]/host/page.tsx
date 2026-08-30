import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CopyLinkButton } from "@/components/room/copy-link-button";
import { HostControls, RemovePlayerButton } from "@/components/room/host-controls";
import { RoomLive } from "@/components/room/room-live";
import { RoomQRCode } from "@/components/room/room-qr-code";
import { ShareButton } from "@/components/room/share-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { clientEnv } from "@/lib/env";
import { loadRoomSnapshot } from "@/lib/room";

export const metadata: Metadata = { title: "Host" };

export default async function HostRoomPage(
  props: PageProps<"/room/[code]/host">
) {
  const { code } = await props.params;
  const snapshot = await loadRoomSnapshot(code);
  if (!snapshot) notFound();

  if (!snapshot.isHost) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-16">
        <h1 className="text-xl font-bold">You&apos;re not the host</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Only the person who started this room can control it.
        </p>
        <Link href={`/room/${code}/play`} className="mt-4 inline-block underline">
          Go to your board →
        </Link>
      </div>
    );
  }

  const { room, players, gameTitle } = snapshot;
  const joinUrl = `${clientEnv().NEXT_PUBLIC_SITE_URL}/join/${room.code}`;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={room.status === "active" ? "default" : "secondary"}>
          {room.status}
        </Badge>
        <span className="text-sm text-muted-foreground capitalize">
          {room.gameMode}
        </span>
        <RoomLive
          roomId={room.id}
          playerId={snapshot.me?.id ?? null}
          nickname={snapshot.me?.nickname ?? "Host"}
          role="host"
        />
      </div>

      <h1 className="font-display mt-3 text-3xl font-extrabold">{gameTitle}</h1>

      <p className="mt-4 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        Scan to join
      </p>
      <p className="font-mono text-6xl leading-none font-extrabold tracking-[0.15em] text-primary tabular-nums">
        {room.code}
      </p>

      <div className="mt-6 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <RoomQRCode joinUrl={joinUrl} />
        <div className="flex flex-col gap-2">
          <p className="text-sm break-all text-muted-foreground">{joinUrl}</p>
          <div className="flex flex-wrap gap-2">
            <ShareButton gameTitle={gameTitle} joinUrl={joinUrl} />
            <CopyLinkButton value={joinUrl} />
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={`/room/${room.code}/tv`} />}
            >
              Open room screen
            </Button>
          </div>
        </div>
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-bold tracking-tight">
          Players{" "}
          <span className="text-sm font-normal text-muted-foreground">
            ({players.length})
          </span>
        </h2>
        <ul className="mt-3 flex flex-col gap-1">
          {players.map((player) => (
            <li
              key={player.id}
              className="flex items-center justify-between rounded-lg border px-3 py-2"
            >
              <span className="flex items-center gap-2 text-sm">
                <span className="font-medium">{player.nickname}</span>
                {player.role === "host" ? (
                  <Badge variant="outline">host</Badge>
                ) : null}
                {player.hasBingo ? <span aria-label="Bingo">🏆</span> : null}
              </span>
              <span className="flex items-center gap-3">
                <span className="text-sm tabular-nums">{player.score}</span>
                {player.role !== "host" && room.status !== "completed" ? (
                  <RemovePlayerButton
                    roomId={room.id}
                    roomCode={room.code}
                    playerId={player.id}
                  />
                ) : null}
              </span>
            </li>
          ))}
        </ul>
        {players.length === 1 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Waiting for players to scan in…
          </p>
        ) : null}
      </section>

      <section className="mt-8">
        <HostControls
          roomId={room.id}
          roomCode={room.code}
          status={room.status}
        />
      </section>

      {snapshot.card.length > 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          You have a card too —{" "}
          <Link href={`/room/${room.code}/play`} className="underline">
            open your board
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}
