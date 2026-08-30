"use client";

import { useActionState, useState } from "react";

import { deleteAccount, type SafetyFormState } from "@/app/actions/safety";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: SafetyFormState = {};

export function DeleteAccount() {
  const [armed, setArmed] = useState(false);
  const [state, formAction, pending] = useActionState(
    deleteAccount,
    initialState
  );

  if (!armed) {
    return (
      <Button type="button" variant="destructive" onClick={() => setArmed(true)}>
        Delete my account
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex max-w-sm flex-col gap-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor="confirm">
          Type <span className="font-mono font-bold">DELETE</span> to confirm
        </Label>
        <Input
          id="confirm"
          name="confirm"
          autoComplete="off"
          placeholder="DELETE"
          required
        />
      </div>
      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" variant="destructive" disabled={pending}>
          {pending ? "Deleting…" : "Permanently delete"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setArmed(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
