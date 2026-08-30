import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DuplicateButton } from "@/components/game/duplicate-button";
import { RateGame } from "@/components/game/rate-game";
import { ReportGame } from "@/components/game/report-game";
import { SaveGameButton } from "@/components/game/save-game-button";
import { StartGameButton } from "@/components/game/start-game-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

async function loadGame(slug: string) {
  const supabase = await createClient();
  const { data: game } = await supabase
    .from("game_templates")
    .select(
      "id, creator_id, title, slug, description, category, content_rating, free_center, card_size, source_game_template_id"
    )
    .eq("slug", slug)
    .eq("status", "published")
    .single();
  return game;
}

export async function generateMetadata(
  props: PageProps<"/games/[slug]">
): Promise<Metadata> {
  const { slug } = await props.params;
  const game = await loadGame(slug);
  if (!game) return {};
  return {
    title: game.title,
    description:
      game.description ??
      `Play ${game.title} people-watching Bingo with friends. Start a multiplayer game and invite players instantly.`,
  };
}

export default async function GameDetailPage(props: PageProps<"/games/[slug]">) {
  const { slug } = await props.params;
  const [game, user] = await Promise.all([loadGame(slug), getUser()]);
  if (!game) notFound();

  const supabase = await createClient();
  const [{ data: squares, count }, { data: rating }, { data: saved }, { data: source }] =
    await Promise.all([
      supabase
        .from("game_squares")
        .select("id, text", { count: "exact" })
        .eq("game_template_id", game.id)
        .eq("is_active", true)
        .order("sort_order")
        .limit(8),
      supabase.rpc("game_rating", { p_game_template_id: game.id }),
      user
        ? supabase
            .from("game_saves")
            .select("id")
            .eq("game_template_id", game.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      // Remix lineage has been recorded since Phase 2; now it's shown (§53).
      game.source_game_template_id
        ? supabase
            .from("game_templates")
            .select("title, slug, status, visibility")
            .eq("id", game.source_game_template_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const isOwner = user !== null && user.id === game.creator_id;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{game.category}</Badge>
        <Badge variant="outline" className="capitalize">
          {game.content_rating}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {count ?? 0} possible squares
        </span>
      </div>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight">{game.title}</h1>
      {game.description ? (
        <p className="mt-2 max-w-xl text-muted-foreground">{game.description}</p>
      ) : null}

      <div className="mt-4">
        <RateGame
          gameId={game.id}
          average={Number(rating?.average ?? 0)}
          count={Number(rating?.count ?? 0)}
          yours={rating?.yours ?? null}
          canRate={user !== null}
        />
      </div>

      {source && (source.status === "published" || isOwner) ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Remixed from{" "}
          {source.slug && source.status === "published" ? (
            <Link href={`/games/${source.slug}`} className="underline">
              {source.title}
            </Link>
          ) : (
            source.title
          )}
        </p>
      ) : null}

      <div className="mt-6">
        <StartGameButton gameId={game.id} />
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        {user ? (
          <SaveGameButton gameId={game.id} initiallySaved={saved !== null} />
        ) : null}
        {user ? (
          <DuplicateButton gameId={game.id} />
        ) : (
          <Button variant="outline" nativeButton={false} render={<Link href="/login" />}>
            Sign in to duplicate
          </Button>
        )}
        {isOwner ? (
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={`/dashboard/games/${game.id}/edit`} />}
          >
            Edit
          </Button>
        ) : null}
      </div>

      <div className="mt-6">
        <ReportGame gameId={game.id} />
      </div>

      <section className="mt-10">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Square preview
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(squares ?? []).map((square) => (
            <Card key={square.id}>
              <CardContent className="py-3 text-sm">{square.text}</CardContent>
            </Card>
          ))}
        </div>
        {(count ?? 0) > 8 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            …and {(count ?? 0) - 8} more. Every player gets a different card.
          </p>
        ) : null}
      </section>
    </div>
  );
}
