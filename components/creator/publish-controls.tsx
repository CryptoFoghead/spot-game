"use client";

import { useActionState } from "react";

import { archiveGame, publishGame, type FormState } from "@/app/actions/games";
import { Button } from "@/components/ui/button";
import { withNetworkGuard } from "@/lib/forms";

const initialState: FormState = {};

const OFFLINE = "Couldn't reach the server. Check your connection and try again.";
const guardedPublish = withNetworkGuard(publishGame, OFFLINE);
const guardedArchive = withNetworkGuard(archiveGame, OFFLINE);

export function PublishControls({
  gameId,
  status,
}: {
  gameId: string;
  status: string;
}) {
  const [publishState, publishAction, publishing] = useActionState(
    guardedPublish,
    initialState
  );
  const [archiveState, archiveAction, archiving] = useActionState(
    guardedArchive,
    initialState
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {status !== "published" ? (
          <form action={publishAction}>
            <input type="hidden" name="game_id" value={gameId} />
            <Button type="submit" disabled={publishing}>
              {publishing ? "Publishing…" : "Publish"}
            </Button>
          </form>
        ) : null}
        <form
          action={archiveAction}
          onSubmit={(event) => {
            if (!confirm("Archive this game? It will leave your library and Explore.")) {
              event.preventDefault();
            }
          }}
        >
          <input type="hidden" name="game_id" value={gameId} />
          <Button type="submit" variant="destructive" disabled={archiving}>
            {archiving ? "Archiving…" : "Archive"}
          </Button>
        </form>
      </div>
      {publishState.error ? (
        <p className="text-sm text-destructive">{publishState.error}</p>
      ) : null}
      {archiveState.error ? (
        <p className="text-sm text-destructive">{archiveState.error}</p>
      ) : null}
    </div>
  );
}
