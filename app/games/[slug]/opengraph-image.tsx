import { ImageResponse } from "next/og";

import { siteConfig } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

export const alt = "Game on SPOT";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Per-game share card, so a shared game link shows what it is (PRD §76). */
export default async function GameOpengraphImage(
  props: PageProps<"/games/[slug]">
) {
  const { slug } = await props.params;

  const supabase = await createClient();
  const { data: game } = await supabase
    .from("game_templates")
    .select("title, description, category, content_rating, game_squares(count)")
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  const title = game?.title ?? "Play on SPOT";
  const squares = game?.game_squares?.[0]?.count;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background: "#000",
          color: "#fff",
        }}
      >
        <div style={{ fontSize: 32, letterSpacing: 8, opacity: 0.7 }}>
          {siteConfig.name.toUpperCase()}
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 78, fontWeight: 800, lineHeight: 1.05, maxWidth: 1000 }}>
            {title}
          </div>
          {game?.description ? (
            <div style={{ fontSize: 30, opacity: 0.65, marginTop: 24, maxWidth: 940 }}>
              {game.description}
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", gap: 24, fontSize: 26, opacity: 0.75 }}>
          {game?.category ? <span>{game.category}</span> : null}
          {game?.content_rating ? <span>· {game.content_rating}</span> : null}
          {squares ? <span>· {squares} squares</span> : null}
        </div>
      </div>
    ),
    size
  );
}
