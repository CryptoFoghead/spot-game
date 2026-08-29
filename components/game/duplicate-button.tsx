"use client";

import { useActionState } from "react";

import { duplicateGame, type FormState } from "@/app/actions/games";
import { Button } from "@/components/ui/button";

const initialState: FormState = {};

export function DuplicateButton({ gameId }: { gameId: string }) {
  const [state, formAction, pending] = useActionState(duplicateGame, initialState);

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
