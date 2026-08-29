// Negative RLS checks with the anon (publishable) key:
// 1. a private published game must be invisible
// 2. anonymous updates to game_templates must not stick
// 3. anonymous inserts into game_squares must be rejected
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
const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
};

(async () => {
  const priv = await fetch(
    `${base}/rest/v1/game_templates?slug=eq.airport-bingo-copy&select=id,title`,
    { headers }
  );
  const privRows = await priv.json();
  console.log(
    "private game visible to anon:",
    Array.isArray(privRows) && privRows.length > 0 ? "YES (BAD)" : "no (good)"
  );

  const pub = await fetch(
    `${base}/rest/v1/game_templates?slug=eq.airport-bingo&select=id`,
    { headers }
  );
  const [game] = await pub.json();

  const upd = await fetch(`${base}/rest/v1/game_templates?id=eq.${game.id}`, {
    method: "PATCH",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify({ title: "HACKED" }),
  });
  const updRows = await upd.json();
  console.log(
    "anon update affected rows:",
    Array.isArray(updRows) ? updRows.length : `status ${upd.status}`,
    "(0 = good)"
  );

  const ins = await fetch(`${base}/rest/v1/game_squares`, {
    method: "POST",
    headers,
    body: JSON.stringify({ game_template_id: game.id, text: "injected square" }),
  });
  console.log("anon square insert status:", ins.status, "(401/403 = good)");
})();
