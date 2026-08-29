"use client";

import { useActionState } from "react";

import { startRoomFromGame, type RoomFormState } from "@/app/actions/rooms";
import { NativeSelect } from "@/components/creator/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: RoomFormState = {};

export function StartGameButton({ gameId }: { gameId: string }) {
  const [state, formAction, pending] = useActionState(
    startRoomFromGame,
    initialState
  );

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-3">
      <input type="hidden" name="game_id" value={gameId} />
      <div className="flex flex-wrap gap-3">
        <div className="flex min-w-32 flex-1 flex-col gap-1">
          <Label htmlFor="nickname" className="text-xs">
            Your nickname
          </Label>
          <Input id="nickname" name="nickname" maxLength={24} placeholder="Host" />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="game_mode" className="text-xs">
            Mode
          </Label>
          <NativeSelect id="game_mode" name="game_mode" className="w-32">
            <option value="classic">Classic</option>
            <option value="blackout">Blackout</option>
          </NativeSelect>
        </div>
      </div>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Creating room…" : "Start Game"}
      </Button>
      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
    </form>
  );
}
