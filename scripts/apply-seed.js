/**
 * Applies one seed file's square list directly.
 *
 * `supabase db push --include-seed` tracks seed files by hash and, when a file
 * it has already seen changes, can record the new hash without re-running it —
 * which silently leaves the old rows in place. The SQL file stays the source
 * of truth; this parses its VALUES block and writes it through the API.
 */
require("dotenv").config({ path: ".env.local" });
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

const [file, gameId] = process.argv.slice(2);
if (!file || !gameId) {
  console.error("usage: node apply-seed.js <seed.sql> <game_template_id>");
  process.exit(1);
}

const sql = fs.readFileSync(file, "utf8");
const rows = [];
for (const line of sql.split(/\r?\n/)) {
  const m = line.match(/^\s*\((\d+),\s*'((?:[^']|'')*)'\s*,\s*'(easy|medium|hard)'\)/);
  if (m) {
    rows.push({
      game_template_id: gameId,
      sort_order: Number(m[1]),
      text: m[2].replace(/''/g, "'"),
      difficulty: m[3],
    });
  }
}

if (rows.length !== 40) {
  console.error(`parsed ${rows.length} squares, expected 40 — refusing to write`);
  process.exit(1);
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } }
);

(async () => {
  const del = await admin.from("game_squares").delete().eq("game_template_id", gameId);
  if (del.error) { console.error("delete failed:", del.error.message); process.exit(1); }

  const ins = await admin.from("game_squares").insert(rows);
  if (ins.error) { console.error("insert failed:", ins.error.message); process.exit(1); }

  const check = await admin
    .from("game_squares")
    .select("text,difficulty")
    .eq("game_template_id", gameId)
    .order("sort_order");
  const mix = check.data.reduce((m, x) => ((m[x.difficulty] = (m[x.difficulty] || 0) + 1), m), {});
  console.log(`wrote ${check.data.length} squares`, JSON.stringify(mix));
  console.log("first:", check.data[0].text);
  console.log("last: ", check.data[check.data.length - 1].text);
})();
