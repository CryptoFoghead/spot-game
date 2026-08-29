import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
    <Card className="h-full transition-colors hover:border-foreground/30">
      <CardHeader>
        <CardTitle className="text-base">{game.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {game.description ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {game.description}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{game.category}</Badge>
          <Badge variant="outline" className="capitalize">
            {game.content_rating}
          </Badge>
          {game.square_count !== undefined ? (
            <span className="text-xs text-muted-foreground">
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
