import type { Metadata } from "next";

export const metadata: Metadata = { title: "Explore Games" };

export default function ExplorePage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12">
      <h1 className="text-2xl font-bold tracking-tight">Explore Games</h1>
      <p className="mt-2 text-muted-foreground">
        The game library arrives in Phase 2. Starter games are already seeded
        and waiting in the database.
      </p>
    </div>
  );
}
