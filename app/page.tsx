import { Sparkles } from "lucide-react";
import Link from "next/link";

import { GameCard } from "@/components/game/game-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { siteConfig } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();

  const [{ data: games }, { data: categories }] = await Promise.all([
    supabase
      .from("game_templates")
      .select("slug, title, description, category, content_rating, game_squares(count)")
      .eq("visibility", "public")
      .eq("status", "published")
      .order("play_count", { ascending: false })
      .order("title")
      .limit(8),
    supabase
      .from("categories")
      .select("slug, name")
      .order("sort_order")
      .limit(12),
  ]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:py-16">
      <section className="flex flex-col items-start gap-6">
        <h1 className="max-w-2xl text-4xl font-extrabold tracking-tight sm:text-5xl">
          {siteConfig.tagline}
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          {siteConfig.description}
        </p>
        <div className="flex flex-wrap gap-3">
          <Button size="lg" nativeButton={false} render={<Link href="/explore" />}>
            <Sparkles data-icon="inline-start" aria-hidden />
            Start Playing
          </Button>
          <Button size="lg" variant="outline" nativeButton={false} render={<Link href="/create" />}>
            Create a Game
          </Button>
        </div>
        <form action="/join" method="GET" className="flex w-full max-w-sm gap-2">
          <Input
            name="code"
            inputMode="numeric"
            placeholder="Have a room code?"
            aria-label="Room code"
          />
          <Button type="submit" variant="secondary">
            Join
          </Button>
        </form>
      </section>

      <section className="mt-14">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-bold tracking-tight">Popular Games</h2>
          <Link href="/explore" className="text-sm text-muted-foreground hover:underline">
            See all
          </Link>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(games ?? []).map((game) => (
            <GameCard
              key={game.slug ?? game.title}
              game={{ ...game, square_count: game.game_squares?.[0]?.count }}
            />
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Browse by category
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {(categories ?? []).map((category) => (
            <Link key={category.slug} href={`/explore?category=${category.slug}`}>
              <Badge variant="outline">{category.name}</Badge>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-14">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          How it works
        </h2>
        <ol className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          {["Pick a Game", "Invite your friends", "Spot it", "Get Bingo"].map(
            (step, index) => (
              <li key={step} className="rounded-lg border p-3">
                <span className="font-mono text-xs text-muted-foreground">
                  {index + 1}
                </span>
                <p className="mt-1 font-medium">{step}</p>
              </li>
            )
          )}
        </ol>
      </section>
    </div>
  );
}
