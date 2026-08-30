import type { Metadata } from "next";
import Link from "next/link";

import { GameCard } from "@/components/game/game-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Explore Games" };

const SORTS = [
  { key: "popular", label: "Popular" },
  { key: "new", label: "New" },
  { key: "title", label: "A–Z" },
] as const;

type SortKey = (typeof SORTS)[number]["key"];

export default async function ExplorePage(props: PageProps<"/explore">) {
  const searchParams = await props.searchParams;
  const activeCategory =
    typeof searchParams.category === "string" ? searchParams.category : null;
  const query =
    typeof searchParams.q === "string" ? searchParams.q.trim().slice(0, 80) : "";
  const sort: SortKey =
    SORTS.find((s) => s.key === searchParams.sort)?.key ?? "popular";

  const supabase = await createClient();

  let builder = supabase
    .from("game_templates")
    .select("slug, title, description, category, content_rating, game_squares(count)")
    .eq("visibility", "public")
    .eq("status", "published");

  if (activeCategory) builder = builder.eq("category", activeCategory);

  if (query) {
    // Escape PostgREST's or() separators so a comma or paren can't alter
    // the filter expression.
    const safe = query.replace(/[,()]/g, " ");
    builder = builder.or(`title.ilike.%${safe}%,description.ilike.%${safe}%`);
  }

  builder =
    sort === "new"
      ? builder.order("published_at", { ascending: false, nullsFirst: false })
      : sort === "title"
        ? builder.order("title")
        : builder.order("play_count", { ascending: false }).order("title");

  const [{ data: games }, { data: categories }] = await Promise.all([
    builder.limit(60),
    supabase.from("categories").select("slug, name").order("sort_order"),
  ]);

  /** Preserves the other filters when changing one of them. */
  function hrefWith(changes: Record<string, string | null>) {
    const params = new URLSearchParams();
    const next = { category: activeCategory, q: query || null, sort, ...changes };
    for (const [key, value] of Object.entries(next)) {
      if (value && !(key === "sort" && value === "popular")) {
        params.set(key, value);
      }
    }
    const qs = params.toString();
    return qs ? `/explore?${qs}` : "/explore";
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Explore Games</h1>

      <form action="/explore" method="GET" className="mt-4 flex gap-2">
        {activeCategory ? (
          <input type="hidden" name="category" value={activeCategory} />
        ) : null}
        {sort !== "popular" ? (
          <input type="hidden" name="sort" value={sort} />
        ) : null}
        <Input
          name="q"
          defaultValue={query}
          placeholder="Search games…"
          aria-label="Search games"
          className="max-w-sm"
        />
        <Button type="submit" variant="secondary">
          Search
        </Button>
        {query ? (
          <Button
            variant="ghost"
            nativeButton={false}
            render={<Link href={hrefWith({ q: null })} />}
          >
            Clear
          </Button>
        ) : null}
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        {SORTS.map((option) => (
          <Link key={option.key} href={hrefWith({ sort: option.key })}>
            <Badge variant={sort === option.key ? "default" : "outline"}>
              {option.label}
            </Badge>
          </Link>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={hrefWith({ category: null })}>
          <Badge variant={activeCategory ? "outline" : "secondary"}>All</Badge>
        </Link>
        {(categories ?? []).map((category) => (
          <Link key={category.slug} href={hrefWith({ category: category.slug })}>
            <Badge
              variant={activeCategory === category.slug ? "default" : "outline"}
            >
              {category.name}
            </Badge>
          </Link>
        ))}
      </div>

      {games && games.length > 0 ? (
        <>
          <p className="mt-6 text-sm text-muted-foreground">
            {games.length} {games.length === 1 ? "game" : "games"}
            {query ? ` matching “${query}”` : ""}
          </p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {games.map((game) => (
              <GameCard
                key={game.slug ?? game.title}
                game={{ ...game, square_count: game.game_squares?.[0]?.count }}
              />
            ))}
          </div>
        </>
      ) : (
        <p className="mt-10 text-muted-foreground">
          {query
            ? `Nothing matches “${query}”.`
            : "No games in this category yet."}{" "}
          <Link href="/create" className="underline">
            Create one.
          </Link>
        </p>
      )}
    </div>
  );
}
