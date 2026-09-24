import Link from "next/link";

import { GameCard } from "@/components/game/game-card";
import { HeroCard } from "@/components/marketing/hero-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { siteConfig } from "@/lib/config";
import { hueStyle } from "@/lib/crowd";
import { createClient } from "@/lib/supabase/server";
import { ResumeGames } from "@/components/room/resume-games";

const STEPS = [
  { title: "Pick a place", body: "Airport, fair, bar, wedding — or write your own." },
  { title: "Share the code", body: "They scan it. No app, no account, no waiting." },
  { title: "Look up", body: "Everyone gets a different card from the same pool." },
  { title: "Call it", body: "First full line wins, and everyone sees it happen." },
];

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
    supabase.from("categories").select("slug, name").order("sort_order").limit(12),
  ]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:py-16">
      <div className="mb-8 empty:mb-0">
        <ResumeGames />
      </div>
      <section className="flex flex-col gap-10 sm:flex-row sm:items-center sm:gap-12">
        <div className="flex flex-1 flex-col items-start gap-6">
          <h1 className="font-display max-w-xl text-5xl leading-[0.95] font-extrabold sm:text-6xl">
            {siteConfig.tagline}
          </h1>
          <p className="max-w-md text-lg text-muted-foreground">
            {siteConfig.description}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" nativeButton={false} render={<Link href="/explore" />}>
              Start playing
            </Button>
            <Button
              size="lg"
              variant="outline"
              nativeButton={false}
              render={<Link href="/create" />}
            >
              Make your own
            </Button>
          </div>
          <form action="/join" method="GET" className="flex w-full max-w-xs gap-2">
            <Input
              name="code"
              inputMode="numeric"
              maxLength={4}
              placeholder="1234"
              aria-label="Room code"
              className="font-mono"
            />
            <Button type="submit" variant="secondary">
              Join
            </Button>
          </form>
        </div>

        <div className="flex justify-center sm:justify-end">
          <HeroCard />
        </div>
      </section>

      <section className="mt-20">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-2xl font-bold">Ready to play</h2>
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

      <section className="mt-14">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Where people play
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {(categories ?? []).map((category) => (
            <Link key={category.slug} href={`/explore?category=${category.slug}`}>
              <span
                className="inline-flex rounded-full px-3 py-1 text-xs font-semibold"
                style={hueStyle(category.slug)}
              >
                {category.name}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-20">
        <h2 className="font-display text-2xl font-bold">How a game goes</h2>
        <ol className="mt-5 grid grid-cols-1 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step) => (
            <li key={step.title} className="flex flex-col gap-1 bg-card p-4">
              <h3 className="font-semibold">{step.title}</h3>
              <p className="text-sm text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <p className="mt-14 max-w-lg text-sm text-muted-foreground">
        Keep it kind. Watch the room, not a person — no photographing, following
        or bothering strangers.
      </p>

      <Badge variant="outline" className="mt-10">
        {siteConfig.name}
      </Badge>
    </div>
  );
}
