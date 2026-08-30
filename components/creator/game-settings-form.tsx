"use client";

import { useActionState } from "react";

import { createGame, updateGameSettings, type FormState } from "@/app/actions/games";
import { NativeSelect } from "@/components/creator/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { withNetworkGuard } from "@/lib/forms";
import { CONTENT_RATINGS, VISIBILITIES } from "@/lib/validation/game";

type CategoryOption = { slug: string; name: string };

type Props = {
  categories: CategoryOption[];
  /** When set, the form edits an existing game; otherwise it creates one. */
  gameId?: string;
  defaults?: {
    title?: string;
    description?: string | null;
    category?: string;
    content_rating?: string;
    visibility?: string;
  };
};

const initialState: FormState = {};

const guardedUpdate = withNetworkGuard(updateGameSettings);
const guardedCreate = withNetworkGuard(createGame);

export function GameSettingsForm({ categories, gameId, defaults }: Props) {
  const action = gameId ? guardedUpdate : guardedCreate;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {gameId ? <input type="hidden" name="game_id" value={gameId} /> : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          required
          minLength={3}
          maxLength={80}
          defaultValue={defaults?.title ?? ""}
          placeholder="Iowa State Fair Bingo"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea
          id="description"
          name="description"
          maxLength={300}
          rows={2}
          defaultValue={defaults?.description ?? ""}
          placeholder="Great for fairs and festivals."
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="category">Category</Label>
          <NativeSelect
            id="category"
            name="category"
            required
            defaultValue={defaults?.category ?? ""}
          >
            <option value="" disabled>
              Pick one…
            </option>
            {categories.map((category) => (
              <option key={category.slug} value={category.slug}>
                {category.name}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="content_rating">Content level</Label>
          <NativeSelect
            id="content_rating"
            name="content_rating"
            defaultValue={defaults?.content_rating ?? "family"}
          >
            {CONTENT_RATINGS.map((rating) => (
              <option key={rating} value={rating} className="capitalize">
                {rating[0].toUpperCase() + rating.slice(1)}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="visibility">Visibility</Label>
          <NativeSelect
            id="visibility"
            name="visibility"
            defaultValue={defaults?.visibility ?? "private"}
          >
            {VISIBILITIES.map((visibility) => (
              <option key={visibility} value={visibility}>
                {visibility[0].toUpperCase() + visibility.slice(1)}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : gameId ? "Save settings" : "Create game"}
        </Button>
      </div>
    </form>
  );
}
