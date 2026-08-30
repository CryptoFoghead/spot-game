"use client";

import { useActionState, useState } from "react";

import { startRoomFromGame, type RoomFormState } from "@/app/actions/rooms";
import { NativeSelect } from "@/components/creator/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { withNetworkGuard } from "@/lib/forms";
import { GAME_MODES } from "@/lib/validation/room";

const initialState: RoomFormState = {};

// Starting the room is step one of every game (B-21).
const startGame = withNetworkGuard(
  startRoomFromGame,
  "Couldn't start the game. Check your connection and try again."
);

const DURATIONS = [
  { value: 300, label: "5 minutes" },
  { value: 600, label: "10 minutes" },
  { value: 900, label: "15 minutes" },
  { value: 1800, label: "30 minutes" },
  { value: 3600, label: "1 hour" },
] as const;

export function StartGameButton({ gameId }: { gameId: string }) {
  const [state, formAction, pending] = useActionState(startGame, initialState);
  const [mode, setMode] = useState<string>("classic");

  return (
    <form action={formAction} className="flex w-full max-w-md flex-col gap-3">
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
          <NativeSelect
            id="game_mode"
            name="game_mode"
            className="w-44"
            value={mode}
            onChange={(event) => setMode(event.target.value)}
          >
            {GAME_MODES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} — {option.hint}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      {/* Only timed rooms have a clock, so the control only exists for them. */}
      {mode === "timed" ? (
        <div className="flex flex-col gap-1">
          <Label htmlFor="duration_seconds" className="text-xs">
            How long?
          </Label>
          <NativeSelect
            id="duration_seconds"
            name="duration_seconds"
            className="w-44"
            defaultValue={600}
          >
            {DURATIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
        </div>
      ) : null}

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Creating room…" : "Start Game"}
      </Button>
      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
    </form>
  );
}
