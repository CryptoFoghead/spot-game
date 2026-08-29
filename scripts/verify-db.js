// Smoke test: reads .env.local, queries the live project via PostgREST with
// the publishable key (anon role) to prove schema + RLS + seeds behave.
const fs = require("fs");

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)])
);

const base = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const headers = { apikey: key, Authorization: `Bearer ${key}` };

async function count(table, filter = "") {
  const res = await fetch(`${base}/rest/v1/${table}?select=id${filter}`, {
    headers: { ...headers, Prefer: "count=exact", Range: "0-0" },
  });
  const range = res.headers.get("content-range") ?? "?";
  return `${res.status} count=${range.split("/")[1] ?? "?"}`;
}

(async () => {
  console.log("categories (anon):          ", await count("categories"));
  console.log("game_templates (anon):      ", await count("game_templates"));
  console.log("game_squares (anon):        ", await count("game_squares"));
  console.log("player_cards (anon, deny):  ", await count("player_cards"));
  console.log("room_events (anon, deny):   ", await count("room_events"));

  const res = await fetch(
    `${base}/rest/v1/game_templates?select=title,slug,category,content_rating&order=title`,
    { headers }
  );
  const games = await res.json();
  console.log("\nVisible games:");
  for (const g of games) console.log(` - ${g.title} [${g.category}, ${g.content_rating}]`);
})();
