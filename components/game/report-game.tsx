"use client";

import { Flag } from "lucide-react";
import { useActionState, useState } from "react";

import { reportGame, type SafetyFormState } from "@/app/actions/safety";
import { NativeSelect } from "@/components/creator/native-select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const REASONS = [
  { value: "harassment", label: "Harassment" },
  { value: "hateful", label: "Hateful content" },
  { value: "sexual", label: "Sexual content" },
  { value: "unsafe", label: "Encourages unsafe behaviour" },
  { value: "privacy", label: "Privacy concern" },
  { value: "spam", label: "Spam" },
  { value: "other", label: "Something else" },
] as const;

const initialState: SafetyFormState = {};

/** Report control on a public game (PRD §55). */
export function ReportGame({ gameId }: { gameId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(reportGame, initialState);

  if (state.done) {
    return (
      <p className="text-sm text-muted-foreground">
        Thanks — we&apos;ll take a look.
      </p>
    );
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <Flag data-icon="inline-start" aria-hidden />
        Report
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-3">
      <input type="hidden" name="game_id" value={gameId} />
      <div className="flex flex-col gap-1">
        <Label htmlFor="reason" className="text-xs">
          Why are you reporting this?
        </Label>
        <NativeSelect id="reason" name="reason" required defaultValue="">
          <option value="" disabled>
            Pick a reason…
          </option>
          {REASONS.map((reason) => (
            <option key={reason.value} value={reason.value}>
              {reason.label}
            </option>
          ))}
        </NativeSelect>
      </div>
      <Textarea
        name="details"
        rows={2}
        maxLength={1000}
        placeholder="Anything else we should know? (optional)"
        aria-label="Report details"
      />
      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Sending…" : "Send report"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
