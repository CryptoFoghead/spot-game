import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ActivityFeed, type ActivityEntry } from "@/components/game/activity-feed";
import { Countdown } from "@/components/room/countdown";
import { RoomQRCode } from "@/components/room/room-qr-code";
import { SpectatorLive } from "@/components/room/spectator-live";
import { assignHues } from "@/lib/crowd";
import { clientEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Room screen" };

type Spectator = {
  roomId: string;
  code: string;
  status: string;
  gameMode: string;
  gameTitle: string;
  winnerPlayerId: string | null;
  endsAt: string | null;
  players: Array<{
    id: string;
    nickname: string;
    score: number;
    hasBingo: boolean;
    isOneAway: boolean;
  }>;
  activity: ActivityEntry[];
};

/**
 * The party screen (PRD §91): a laptop propped on the bar, or cast to a TV.
 *
 * No sign-in and no guest token — the whole point is that nobody has joined
 * from this device. It shows only what is already public to everyone standing
 * in the room: how to join, who is playing, and what has been spotted. Never
 * a card.
 */
export default async function RoomTvPage(props: PageProps<"/room/[code]/tv">) {
  const { code } = await props.params;

  const supabase = await createClient();
  const { data } = await supabase.rpc("get_room_spectator", {
    p_room_code: code,
  });
  if (!data) notFound();

  const room = data as Spectator;
  const joinUrl = `${clientEnv().NEXT_PUBLIC_SITE_URL}/join/${room.code}`;
  const leader = room.players[0];
  const hues = assignHues(room.players.map((p) => p.id));

  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-6xl flex-col gap-8 px-6 py-8">
      <SpectatorLive roomId={room.roomId} />

      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-sm font-semibold tracking-[0.2em] text-muted-foreground uppercase">
            {room.status === "active" ? "Now playing" : room.status}
          </p>
          <h1 className="font-display text-5xl leading-none font-extrabold sm:text-6xl">
            {room.gameTitle}
          </h1>
          {room.endsAt ? (
            <div className="mt-3">
              <Countdown
                endsAt={room.endsAt}
                roomId={room.roomId}
                active={room.status === "active"}
                size="lg"
              />
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-5">
          <div className="text-right">
            <p className="text-sm font-semibold tracking-[0.2em] text-muted-foreground uppercase">
              Join at
            </p>
            <p className="font-mono text-6xl leading-none font-extrabold tracking-[0.1em] text-primary tabular-nums">
              {room.code}
            </p>
          </div>
          <RoomQRCode joinUrl={joinUrl} size={140} />
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-8 lg:grid-cols-[1.1fr_1fr]">
        <section>
          <h2 className="text-sm font-semibold tracking-[0.2em] text-muted-foreground uppercase">
            Standings
          </h2>
          <ol className="mt-4 flex flex-col gap-2">
            {room.players.map((player, index) => (
              <li
                key={player.id}
                className={
                  "flex items-center gap-4 rounded-2xl border px-5 py-4 " +
                  (player.hasBingo
                    ? "border-primary bg-accent"
                    : "border-border bg-card")
                }
              >
                <span className="w-6 text-xl text-muted-foreground tabular-nums">
                  {index + 1}
                </span>
                <span
                  className="size-4 shrink-0 rounded-full"
                  style={{ backgroundColor: hues.get(player.id)?.fill }}
                  aria-hidden
                />
                <span className="font-display truncate text-2xl font-bold">
                  {player.nickname}
                </span>
                {player.hasBingo ? <span className="text-2xl">🏆</span> : null}
                {!player.hasBingo && player.isOneAway ? (
                  <span className="text-2xl" title="One square away">
                    🔥
                  </span>
                ) : null}
                <span className="font-display ml-auto text-3xl font-extrabold tabular-nums">
                  {player.score}
                </span>
              </li>
            ))}
          </ol>
          {room.players.length === 0 ? (
            <p className="mt-4 text-xl text-muted-foreground">
              Scan the code to get a card.
            </p>
          ) : null}
        </section>

        <section>
          <h2 className="text-sm font-semibold tracking-[0.2em] text-muted-foreground uppercase">
            Just spotted
          </h2>
          <div className="mt-4">
            <ActivityFeed entries={room.activity} limit={8} size="lg" />
          </div>
          {room.activity.length === 0 ? (
            <p className="text-xl text-muted-foreground">
              Nothing yet. Look around.
            </p>
          ) : null}
        </section>
      </div>

      {leader?.hasBingo ? (
        <p className="font-display text-center text-4xl font-extrabold">
          🎉 {leader.nickname} got bingo
        </p>
      ) : null}
    </div>
  );
}
