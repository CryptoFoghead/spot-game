"use client";

import { useActionState, useState } from "react";

import { joinRoom, type RoomFormState } from "@/app/actions/rooms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { withNetworkGuard } from "@/lib/forms";

const initialState: RoomFormState = {};

// Joining is where bad wifi hurts most: it is the first thing anyone does,
// often on a restaurant's network, and the page had been replaced wholesale.
const join = withNetworkGuard(
  joinRoom,
  "Couldn't reach the game. Check your connection and try again."
);

export function JoinForm({ roomCode }: { roomCode: string }) {
  const [state, formAction, pending] = useActionState(join, initialState);
  // Controlled, because React resets an uncontrolled form once the action
  // settles — so a failed join wiped the nickname and they had to type it
  // again on the network that just failed them.
  const [nickname, setNickname] = useState("");

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4">
      <input type="hidden" name="room_code" value={roomCode} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="nickname">Your nickname</Label>
        <Input
          id="nickname"
          name="nickname"
          required
          maxLength={24}
          autoComplete="nickname"
          placeholder="Ryan"
          autoFocus
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
        />
      </div>
      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Joining…" : "Join Game"}
      </Button>
    </form>
  );
}
