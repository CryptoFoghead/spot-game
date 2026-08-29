import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DuplicateButton } from "@/components/game/duplicate-button";
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
      "id, creator_id, title, slug, description, category, content_rating, free_center, card_size"
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
  const { data: squares, count } = await supabase
    .from("game_squares")
    .select("id, text", { count: "exact" })
    .eq("game_template_id", game.id)
    .eq("is_active", true)
    .order("sort_order")
    .limit(8);

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

      <div className="mt-6 flex flex-wrap gap-3">
        <Button size="lg" disabled title="Multiplayer rooms arrive in Phase 3">
          Start Game
        </Button>
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
      <p className="mt-2 text-xs text-muted-foreground">
        Starting live rooms is coming next — duplicate the game to make it your
        own in the meantime.
      </p>

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
