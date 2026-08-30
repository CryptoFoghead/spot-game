"use client";

import { useActionState } from "react";

import {
  addSquare,
  deleteSquare,
  updateSquare,
  type FormState,
} from "@/app/actions/games";
import { NativeSelect } from "@/components/creator/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { withNetworkGuard } from "@/lib/forms";
import { DIFFICULTIES } from "@/lib/validation/game";

const OFFLINE = "Couldn't reach the server. Check your connection and try again.";
const guardedUpdate = withNetworkGuard(updateSquare, OFFLINE);
const guardedDelete = withNetworkGuard(deleteSquare, OFFLINE);
const guardedAdd = withNetworkGuard(addSquare, OFFLINE);

export type SquareItem = {
  id: string;
  text: string;
  difficulty: string | null;
};

const initialState: FormState = {};

function DifficultySelect({
  name,
  defaultValue,
}: {
  name: string;
  defaultValue: string | null;
}) {
  return (
    <NativeSelect name={name} defaultValue={defaultValue ?? ""} className="w-28 shrink-0">
      <option value="">any</option>
      {DIFFICULTIES.map((difficulty) => (
        <option key={difficulty} value={difficulty}>
          {difficulty}
        </option>
      ))}
    </NativeSelect>
  );
}

function SquareRow({ gameId, square }: { gameId: string; square: SquareItem }) {
  const [saveState, saveAction, saving] = useActionState(guardedUpdate, initialState);
  const [deleteState, deleteAction, deleting] = useActionState(
    guardedDelete,
    initialState
  );

  return (
    <li className="rounded-lg border p-2">
      <form action={saveAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="game_id" value={gameId} />
        <input type="hidden" name="square_id" value={square.id} />
        <Input
          name="text"
          defaultValue={square.text}
          required
          minLength={2}
          maxLength={180}
          className="min-w-40 flex-1"
          aria-label="Square text"
        />
        <DifficultySelect name="difficulty" defaultValue={square.difficulty} />
        <div className="flex gap-1">
          <Button type="submit" size="sm" variant="outline" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button
            type="submit"
            size="sm"
            variant="destructive"
            formAction={deleteAction}
            disabled={deleting}
          >
            {deleting ? "…" : "Delete"}
          </Button>
        </div>
      </form>
      {saveState.error ? (
        <p className="mt-1 text-xs text-destructive">{saveState.error}</p>
      ) : null}
      {deleteState.error ? (
        <p className="mt-1 text-xs text-destructive">{deleteState.error}</p>
      ) : null}
    </li>
  );
}

function AddSquareForm({ gameId }: { gameId: string }) {
  const [state, formAction, pending] = useActionState(guardedAdd, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="game_id" value={gameId} />
      <Input
        name="text"
        required
        minLength={2}
        maxLength={180}
        placeholder="Someone carrying a giant turkey leg"
        className="min-w-40 flex-1"
        aria-label="New square text"
      />
      <DifficultySelect name="difficulty" defaultValue={null} />
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "+ Add Square"}
      </Button>
      {state.error ? (
        <p className="w-full text-xs text-destructive">{state.error}</p>
      ) : null}
    </form>
  );
}

export function SquareEditor({
  gameId,
  squares,
  minimum,
  recommended,
}: {
  gameId: string;
  squares: SquareItem[];
  minimum: number;
  recommended: number;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-bold tracking-tight">Squares</h2>
        <p className="text-sm text-muted-foreground">
          {squares.length} squares · minimum {minimum} · recommended {recommended}+
        </p>
      </div>
      <AddSquareForm gameId={gameId} />
      <ul className="flex flex-col gap-2">
        {squares.map((square) => (
          <SquareRow key={square.id} gameId={gameId} square={square} />
        ))}
      </ul>
      {squares.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No squares yet. Add observations people can spot around them.
        </p>
      ) : null}
    </section>
  );
}
