"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { reportError } from "@/lib/observability";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError("app.boundary", error, { digest: error.digest ?? null });
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-start gap-4 px-4 py-20">
      <h1 className="text-2xl font-bold tracking-tight">
        Something went wrong
      </h1>
      <p className="text-muted-foreground">
        That&apos;s on us. Try again — your game and card are safe.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
