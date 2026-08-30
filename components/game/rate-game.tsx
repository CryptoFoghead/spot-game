"use client";

import { Star } from "lucide-react";
import { useActionState } from "react";

import { rateGame, type CommunityState } from "@/app/actions/community";
import { withNetworkGuard } from "@/lib/forms";

const initialState: CommunityState = {};

const guardedRateGame = withNetworkGuard(rateGame, "Couldn't reach the server. Check your connection and try again.");

/** 1–5 stars (PRD §54). Each star is its own submit button so it works
 *  without client-side state juggling and stays keyboard accessible. */
export function RateGame({
  gameId,
  average,
  count,
  yours,
  canRate,
}: {
  gameId: string;
  average: number;
  count: number;
  yours: number | null;
  canRate: boolean;
}) {
  const [state, formAction, pending] = useActionState(guardedRateGame, initialState);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        {canRate ? (
          <form action={formAction} className="flex items-center gap-0.5">
            <input type="hidden" name="game_id" value={gameId} />
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="submit"
                name="rating"
                value={value}
                disabled={pending}
                aria-label={`Rate ${value} star${value === 1 ? "" : "s"}`}
                className="rounded p-0.5 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <Star
                  className={
                    "size-5 " +
                    (yours !== null && value <= yours
                      ? "fill-foreground text-foreground"
                      : "text-muted-foreground")
                  }
                  aria-hidden
                />
              </button>
            ))}
          </form>
        ) : (
          <span className="flex items-center gap-0.5" aria-hidden>
            {[1, 2, 3, 4, 5].map((value) => (
              <Star
                key={value}
                className={
                  "size-5 " +
                  (value <= Math.round(average)
                    ? "fill-foreground text-foreground"
                    : "text-muted-foreground")
                }
              />
            ))}
          </span>
        )}

        <span className="text-sm text-muted-foreground">
          {count > 0
            ? `${average.toFixed(1)} · ${count} ${count === 1 ? "rating" : "ratings"}`
            : "No ratings yet"}
        </span>
      </div>
      {state.error ? (
        <p className="text-xs text-destructive">{state.error}</p>
      ) : null}
    </div>
  );
}
