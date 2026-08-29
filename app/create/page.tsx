import type { Metadata } from "next";

export const metadata: Metadata = { title: "Create a Game" };

export default function CreatePage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12">
      <h1 className="text-2xl font-bold tracking-tight">Create a Game</h1>
      <p className="mt-2 text-muted-foreground">
        The creator wizard arrives in Phase 2.
      </p>
    </div>
  );
}
