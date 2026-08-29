import type { Metadata } from "next";
import Link from "next/link";

import { GameCard } from "@/components/game/game-card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Explore Games" };

export default async function ExplorePage(props: PageProps<"/explore">) {
  const searchParams = await props.searchParams;
  const activeCategory =
    typeof searchParams.category === "string" ? searchParams.category : null;

  const supabase = await createClient();

  let query = supabase
    .from("game_templates")
    .select("slug, title, description, category, content_rating, game_squares(count)")
    .eq("visibility", "public")
    .eq("status", "published")
    .order("play_count", { ascending: false })
    .order("title");
  if (activeCategory) query = query.eq("category", activeCategory);

  const [{ data: games }, { data: categories }] = await Promise.all([
    query,
    supabase.from("categories").select("slug, name").order("sort_order"),
  ]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Explore Games</h1>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/explore">
          <Badge variant={activeCategory ? "outline" : "default"}>All</Badge>
        </Link>
        {(categories ?? []).map((category) => (
          <Link key={category.slug} href={`/explore?category=${category.slug}`}>
            <Badge variant={activeCategory === category.slug ? "default" : "outline"}>
              {category.name}
            </Badge>
          </Link>
        ))}
      </div>
      {games && games.length > 0 ? (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {games.map((game) => (
            <GameCard
              key={game.slug ?? game.title}
              game={{ ...game, square_count: game.game_squares?.[0]?.count }}
            />
          ))}
        </div>
      ) : (
        <p className="mt-10 text-muted-foreground">
          No games in this category yet.{" "}
          <Link href="/create" className="underline">
            Create the first one.
          </Link>
        </p>
      )}
    </div>
  );
}
