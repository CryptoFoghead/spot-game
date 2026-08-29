"use client";

import { useActionState } from "react";

import { joinRoom, type RoomFormState } from "@/app/actions/rooms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: RoomFormState = {};

export function JoinForm({ roomCode }: { roomCode: string }) {
  const [state, formAction, pending] = useActionState(joinRoom, initialState);

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
