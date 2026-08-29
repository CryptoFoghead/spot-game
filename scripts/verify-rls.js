// Probes every exposed table with the anonymous (publishable) key — the exact
// access level a guest player's browser has — and reports what is readable,
// writable and deletable. Evidence for the release audit; asserts nothing that
// isn't observed.
const fs = require("fs");

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);

const base = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
};

const TABLES = [
  "profiles",
  "categories",
  "game_templates",
  "game_squares",
  "rooms",
  "room_players",
  "player_cards",
  "player_card_squares",
  "room_events",
];

/** Tables an anonymous visitor is *supposed* to be able to read. */
const READABLE_BY_DESIGN = new Set([
  "profiles",
  "categories",
  "game_templates",
  "game_squares",
]);

async function readCount(table) {
  const res = await fetch(`${base}/rest/v1/${table}?select=*`, {
    headers: { ...headers, Prefer: "count=exact", Range: "0-0" },
  });
  if (!res.ok) return `blocked (${res.status})`;
  const range = res.headers.get("content-range") ?? "?";
  return Number(range.split("/")[1] ?? 0);
}

async function tryWrite(table, row) {
  const res = await fetch(`${base}/rest/v1/${table}`, {
    method: "POST",
    headers,
    body: JSON.stringify(row),
  });
  return res.status;
}

/**
 * PostgREST answers 204 for a DELETE that matched nothing, and RLS filters
 * rows silently — so the status code alone proves nothing. The only honest
 * check is whether the row count actually changed.
 */
async function tryDelete(table) {
  const before = await readCount(table);
  const res = await fetch(`${base}/rest/v1/${table}?id=not.is.null`, {
    method: "DELETE",
    headers,
  });
  const after = await readCount(table);
  const removed =
    typeof before === "number" && typeof after === "number"
      ? before - after
      : 0;
  return { status: res.status, removed };
}

(async () => {
  let failures = 0;
  console.log("Anonymous-key access probe\n");
  console.log("table                  read            insert  delete");

  for (const table of TABLES) {
    const count = await readCount(table);
    const insert = await tryWrite(table, { id: "00000000-0000-4000-8000-000000000999" });
    const del = await tryDelete(table);

    const readable = typeof count === "number";
    const shouldRead = READABLE_BY_DESIGN.has(table);

    // Gameplay tables must expose nothing at all to a client.
    if (!shouldRead && readable && count > 0) {
      failures++;
      console.log(`  !! ${table} leaked ${count} rows to an anonymous client`);
    }
    // Writes must never succeed (2xx).
    if (insert < 300) {
      failures++;
      console.log(`  !! ${table} accepted an anonymous INSERT (${insert})`);
    }
    if (del.removed > 0) {
      failures++;
      console.log(`  !! ${table} lost ${del.removed} rows to an anonymous DELETE`);
    }

    const delNote = `${del.status} (removed ${del.removed})`;
    console.log(
      `${table.padEnd(22)} ${String(count).padEnd(15)} ${String(insert).padEnd(7)} ${delNote}`
    );
  }

  // Private/draft games must be invisible even though the table is readable.
  const drafts = await fetch(
    `${base}/rest/v1/game_templates?select=id&status=neq.published`,
    { headers, method: "GET" }
  );
  const draftRows = await drafts.json();
  if (Array.isArray(draftRows) && draftRows.length > 0) {
    failures++;
    console.log(`\n  !! ${draftRows.length} unpublished game(s) visible anonymously`);
  } else {
    console.log("\n  ok  unpublished games are invisible anonymously");
  }

  // Server-only helper functions must not be callable directly.
  for (const fn of ["generate_player_card", "hash_guest_token", "is_room_host", "card_has_bingo"]) {
    const res = await fetch(`${base}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers,
      body: JSON.stringify({}),
    });
    if (res.status < 300) {
      failures++;
      console.log(`  !! internal function ${fn} is callable anonymously`);
    } else {
      console.log(`  ok  internal function ${fn} not callable (${res.status})`);
    }
  }

  console.log(
    failures === 0
      ? "\nPASS: no anonymous read/write leaks found"
      : `\nFAILURES: ${failures}`
  );
  process.exit(failures === 0 ? 0 : 1);
})();
