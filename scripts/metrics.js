// Product metrics and the moderation queue (G-09, G-10).
// Usage: node scripts/metrics.js [days]
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);

const days = Number(process.argv[2] ?? 7);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

(async () => {
  const { data: m, error } = await admin.rpc("product_metrics", { p_days: days });
  if (error) {
    console.error("metrics failed:", error.message);
    process.exit(1);
  }

  console.log(`\nSPOT — last ${m.windowDays} days\n${"=".repeat(32)}`);
  console.log("\nNORTH STAR (PRD §92)");
  console.log(`  Completed multiplayer rooms : ${m.northStar.completedMultiplayerRooms}`);
  console.log(`  Avg players per such room   : ${m.northStar.averagePlayersPerCompletedRoom}`);

  console.log("\nFUNNEL");
  console.log(`  Rooms created               : ${m.funnel.roomsCreated}`);
  console.log(`  Rooms started               : ${m.funnel.roomsStarted}  (${Math.round(m.funnel.startRate * 100)}%)`);
  console.log(`  Rooms reaching bingo        : ${m.funnel.roomsReachingBingo}  (${Math.round(m.funnel.bingoRate * 100)}% of started)`);
  console.log(`  Rooms completed             : ${m.funnel.roomsCompleted}`);

  console.log("\nACTIVITY");
  console.log(`  Players joined              : ${m.activity.playersJoined}`);
  console.log(`  Squares marked              : ${m.activity.squaresMarked}`);
  console.log(`  Games created by users      : ${m.activity.gamesCreated}`);
  console.log(`  AI generations              : ${m.activity.aiGenerations}`);

  const { data: reports } = await admin.rpc("open_reports", { p_limit: 20 });
  console.log(`\nMODERATION QUEUE: ${reports.length} open`);
  for (const r of reports) {
    console.log(`  [${r.reason}] ${r.gameTitle} — ${r.details ?? "no details"}`);
  }

  const { data: status } = await admin.rpc("maintenance_status");
  console.log(
    `\nHOUSEKEEPING: ${status.rooms} rooms, ${status.roomsAwaitingExpiry} awaiting expiry, cron ${
      status.scheduledJobs.length ? "scheduled" : "NOT SCHEDULED"
    }\n`
  );
})();
