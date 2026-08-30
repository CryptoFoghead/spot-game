"use client";

import { useActionState } from "react";

import {
  endRoom,
  pauseRoom,
  removePlayer,
  resumeRoom,
  startRoom,
  type RoomFormState,
} from "@/app/actions/rooms";
import { Button } from "@/components/ui/button";
import { withNetworkGuard } from "@/lib/forms";

const initialState: RoomFormState = {};

// The host is holding the room together. Losing the whole page to an error
// boundary because one tap could not reach the server is the worst possible
// moment for it (B-21).
const OFFLINE = "Couldn't reach the game. Check your connection and try again.";
const guardedStart = withNetworkGuard(startRoom, OFFLINE);
const guardedPause = withNetworkGuard(pauseRoom, OFFLINE);
const guardedResume = withNetworkGuard(resumeRoom, OFFLINE);
const guardedEnd = withNetworkGuard(endRoom, OFFLINE);
const guardedRemove = withNetworkGuard(removePlayer, OFFLINE);

type Props = { roomId: string; roomCode: string; status: string };

export function HostControls({ roomId, roomCode, status }: Props) {
  const [startState, startAction, starting] = useActionState(
    guardedStart,
    initialState
  );
  const [pauseState, pauseAction, pausing] = useActionState(
    guardedPause,
    initialState
  );
  const [resumeState, resumeAction, resuming] = useActionState(
    guardedResume,
    initialState
  );
  const [endState, endAction, ending] = useActionState(guardedEnd, initialState);

  const error =
    startState.error ?? pauseState.error ?? resumeState.error ?? endState.error;

  const hidden = (
    <>
      <input type="hidden" name="room_id" value={roomId} />
      <input type="hidden" name="room_code" value={roomCode} />
    </>
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {status === "lobby" ? (
          <form action={startAction}>
            {hidden}
            <Button type="submit" size="lg" disabled={starting}>
              {starting ? "Starting…" : "Start Game"}
            </Button>
          </form>
        ) : null}

        {status === "active" ? (
          <form action={pauseAction}>
            {hidden}
            <Button type="submit" variant="outline" disabled={pausing}>
              {pausing ? "Pausing…" : "Pause"}
            </Button>
          </form>
        ) : null}

        {status === "paused" ? (
          <form action={resumeAction}>
            {hidden}
            <Button type="submit" disabled={resuming}>
              {resuming ? "Resuming…" : "Resume"}
            </Button>
          </form>
        ) : null}

        {status !== "completed" ? (
          <form
            action={endAction}
            onSubmit={(event) => {
              if (!confirm("End this game for everyone?")) event.preventDefault();
            }}
          >
            {hidden}
            <Button type="submit" variant="destructive" disabled={ending}>
              {ending ? "Ending…" : "End Game"}
            </Button>
          </form>
        ) : null}
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

export function RemovePlayerButton({
  roomId,
  roomCode,
  playerId,
}: {
  roomId: string;
  roomCode: string;
  playerId: string;
}) {
  const [state, formAction, pending] = useActionState(
    guardedRemove,
    initialState
  );

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!confirm("Remove this player from the game?")) event.preventDefault();
      }}
    >
      <input type="hidden" name="room_id" value={roomId} />
      <input type="hidden" name="room_code" value={roomCode} />
      <input type="hidden" name="player_id" value={playerId} />
      <Button type="submit" size="xs" variant="ghost" disabled={pending}>
        {pending ? "…" : "Remove"}
      </Button>
      {state.error ? (
        <span className="text-xs text-destructive">{state.error}</span>
      ) : null}
    </form>
  );
}
