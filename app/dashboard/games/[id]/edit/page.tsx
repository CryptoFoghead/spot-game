import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AIGenerator } from "@/components/creator/ai-generator";
import { GameSettingsForm } from "@/components/creator/game-settings-form";
import { PublishControls } from "@/components/creator/publish-controls";
import { SquareEditor } from "@/components/creator/square-editor";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth";
import { minimumSquares, RECOMMENDED_SQUARES } from "@/lib/game/rules";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Edit Game" };

export default async function EditGamePage(
  props: PageProps<"/dashboard/games/[id]/edit">
) {
  const user = await requireUser();
  const { id } = await props.params;

  const supabase = await createClient();
  const { data: game } = await supabase
    .from("game_templates")
    .select(
      "id, title, slug, description, category, content_rating, visibility, status, card_size, free_center"
    )
    .eq("id", id)
    .eq("creator_id", user.id)
    .single();
  if (!game) notFound();

  const { data: squares } = await supabase
    .from("game_squares")
    .select("id, text, difficulty")
    .eq("game_template_id", game.id)
    .eq("is_active", true)
    .order("sort_order");

  const { data: categories } = await supabase
    .from("categories")
    .select("slug, name")
    .order("sort_order");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-10">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={game.status === "published" ? "default" : "secondary"}>
            {game.status}
          </Badge>
          {game.status === "published" && game.slug ? (
            <Link
              href={`/games/${game.slug}`}
              className="text-sm text-muted-foreground hover:underline"
            >
              View public page →
            </Link>
          ) : null}
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{game.title}</h1>
      </div>

      <section>
        <h2 className="mb-4 text-lg font-bold tracking-tight">Settings</h2>
        <GameSettingsForm
          categories={categories ?? []}
          gameId={game.id}
          defaults={game}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold tracking-tight">Idea generator</h2>
        <AIGenerator
          gameId={game.id}
          category={game.category}
          rating={game.content_rating}
          existingSquares={(squares ?? []).map((square) => square.text)}
          defaultLocation={game.title}
        />
      </section>

      <SquareEditor
        gameId={game.id}
        squares={squares ?? []}
        minimum={minimumSquares(game.card_size, game.free_center)}
        recommended={RECOMMENDED_SQUARES}
      />

      <section>
        <h2 className="mb-3 text-lg font-bold tracking-tight">
          {game.status === "published" ? "Danger zone" : "Publish"}
        </h2>
        <PublishControls gameId={game.id} status={game.status} />
      </section>
    </div>
  );
}
