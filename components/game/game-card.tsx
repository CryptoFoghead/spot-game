import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { hueFill, hueStyle } from "@/lib/crowd";

export type GameListItem = {
  slug: string | null;
  title: string;
  description: string | null;
  category: string;
  content_rating: string;
  square_count?: number;
};

export function GameCard({ game }: { game: GameListItem }) {
  const inner = (
    <Card className="group h-full overflow-hidden transition-colors hover:border-primary/50">
      {/* A hairline in the category's hue: colour identifies the world the
          game belongs to, the same hue everywhere that category appears. */}
      <div className="h-1 w-full" style={hueFill(game.category)} />
      <CardContent className="flex flex-col gap-2 pt-4">
        <h3 className="font-display text-base leading-tight font-bold">
          {game.title}
        </h3>
        {game.description ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {game.description}
          </p>
        ) : null}
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span
            className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold"
            style={hueStyle(game.category)}
          >
            {game.category}
          </span>
          <span className="text-xs text-muted-foreground capitalize">
            {game.content_rating}
          </span>
          {game.square_count !== undefined ? (
            <span className="ml-auto text-xs text-muted-foreground tabular-nums">
              {game.square_count} squares
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );

  return game.slug ? (
    <Link href={`/games/${game.slug}`} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}
