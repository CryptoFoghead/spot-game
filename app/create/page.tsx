import type { Metadata } from "next";

import { GameSettingsForm } from "@/components/creator/game-settings-form";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Create a Game" };

export default async function CreatePage() {
  await requireUser();

  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("categories")
    .select("slug, name")
    .order("sort_order");

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">What are we watching?</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Name your game and pick where it happens. You&apos;ll add squares on the
        next screen. (AI suggestions arrive in Phase 6.)
      </p>
      <div className="mt-6">
        <GameSettingsForm categories={categories ?? []} />
      </div>
    </div>
  );
}
