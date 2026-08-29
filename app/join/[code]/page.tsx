import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { JoinForm } from "@/components/room/join-form";
import { Badge } from "@/components/ui/badge";
import { readGuestToken } from "@/lib/guest";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Join Game" };

export default async function JoinRoomPage(props: PageProps<"/join/[code]">) {
  const { code } = await props.params;

  const supabase = await createClient();
  const { data: info } = await supabase.rpc("get_join_info", {
    p_room_code: code,
  });

  if (!info?.roomId) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-16">
        <h1 className="text-xl font-bold">We couldn&apos;t find that room</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Double-check the code with your host — it may have ended.
        </p>
        <Link href="/join" className="mt-4 inline-block underline">
          Try another code →
        </Link>
      </div>
    );
  }

  if (info.expired) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-16">
        <h1 className="text-xl font-bold">This game has ended</h1>
        <Link href="/explore" className="mt-4 inline-block underline">
          Find another game →
        </Link>
      </div>
    );
  }

  // Already holding a seat in this room? Go straight to the board.
  if (await readGuestToken(code)) {
    const { data: snapshot } = await supabase.rpc("get_room_snapshot", {
      p_room_id: info.roomId,
      p_token: await readGuestToken(code),
    });
    if (snapshot?.me) redirect(`/room/${code}/play`);
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-12">
      <p className="text-sm text-muted-foreground">Room {info.roomCode}</p>
      <h1 className="mt-1 text-3xl font-extrabold tracking-tight">
        {info.gameTitle}
      </h1>
      <div className="mt-3 flex items-center gap-2">
        <Badge variant="outline" className="capitalize">
          {info.contentRating}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {info.playerCount} already in
        </span>
      </div>

      <JoinForm roomCode={info.roomCode} />

      <p className="mt-6 text-xs text-muted-foreground">
        Keep it fun. Observe — don&apos;t harass, follow, photograph, or
        interfere with strangers.
      </p>
    </div>
  );
}
