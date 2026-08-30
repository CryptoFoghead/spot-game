"use client";

import { useActionState } from "react";

import { duplicateGame, type FormState } from "@/app/actions/games";
import { Button } from "@/components/ui/button";
import { withNetworkGuard } from "@/lib/forms";

const initialState: FormState = {};

const guardedDuplicateGame = withNetworkGuard(duplicateGame, "Couldn't reach the server. Check your connection and try again.");

export function DuplicateButton({ gameId }: { gameId: string }) {
  const [state, formAction, pending] = useActionState(guardedDuplicateGame, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-1">
      <input type="hidden" name="game_id" value={gameId} />
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Duplicating…" : "Duplicate"}
      </Button>
      {state.error ? (
        <p className="text-xs text-destructive">{state.error}</p>
      ) : null}
    </form>
  );
}
