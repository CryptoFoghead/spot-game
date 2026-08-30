"use client";

import { Bookmark } from "lucide-react";
import { useActionState } from "react";

import { toggleSave, type CommunityState } from "@/app/actions/community";
import { Button } from "@/components/ui/button";
import { withNetworkGuard } from "@/lib/forms";

const initialState: CommunityState = {};

const guardedToggleSave = withNetworkGuard(toggleSave, "Couldn't reach the server. Check your connection and try again.");

export function SaveGameButton({
  gameId,
  initiallySaved,
}: {
  gameId: string;
  initiallySaved: boolean;
}) {
  const [state, formAction, pending] = useActionState(guardedToggleSave, initialState);
  const saved = state.saved ?? initiallySaved;

  return (
    <form action={formAction}>
      <input type="hidden" name="game_id" value={gameId} />
      <Button type="submit" variant={saved ? "secondary" : "outline"} disabled={pending}>
        <Bookmark
          data-icon="inline-start"
          className={saved ? "fill-current" : undefined}
          aria-hidden
        />
        {pending ? "…" : saved ? "Saved" : "Save"}
      </Button>
      {state.error ? (
        <p className="mt-1 text-xs text-destructive">{state.error}</p>
      ) : null}
    </form>
  );
}
