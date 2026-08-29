import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "My Games" };

const TABS = [
  { key: "created", label: "Created", statuses: ["published"] },
  { key: "drafts", label: "Drafts", statuses: ["draft"] },
] as const;

export default async function MyGamesPage(props: PageProps<"/dashboard/games">) {
  const user = await requireUser();
  const searchParams = await props.searchParams;
  const activeTab =
    TABS.find((tab) => tab.key === searchParams.tab) ?? TABS[0];

  const supabase = await createClient();
  const { data: games } = await supabase
    .from("game_templates")
    .select("id, title, slug, visibility, status, updated_at, game_squares(count)")
    .eq("creator_id", user.id)
    .in("status", [...activeTab.statuses])
    .order("updated_at", { ascending: false });

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">My Games</h1>
        <Button nativeButton={false} render={<Link href="/create" />}>
          + New Game
        </Button>
      </div>

      <div className="mt-4 flex gap-2" role="tablist" aria-label="Game status">
        {TABS.map((tab) => (
          <Link key={tab.key} href={`/dashboard/games?tab=${tab.key}`}>
            <Badge variant={tab.key === activeTab.key ? "default" : "outline"}>
              {tab.label}
            </Badge>
          </Link>
        ))}
      </div>

      {games && games.length > 0 ? (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {games.map((game) => (
            <Card key={game.id}>
              <CardHeader>
                <CardTitle className="text-base">{game.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="capitalize">
                    {game.visibility}
                  </Badge>
                  <span>{game.game_squares?.[0]?.count ?? 0} squares</span>
                  <span>
                    updated {new Date(game.updated_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    nativeButton={false}
                    render={<Link href={`/dashboard/games/${game.id}/edit`} />}
                  >
                    Edit
                  </Button>
                  {game.status === "published" && game.slug ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      nativeButton={false}
                      render={<Link href={`/games/${game.slug}`} />}
                    >
                      View
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="mt-10 text-muted-foreground">
          Nothing here yet.{" "}
          <Link href="/create" className="underline">
            Create your first game.
          </Link>
        </p>
      )}
    </div>
  );
}
