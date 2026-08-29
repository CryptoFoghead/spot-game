// Dev-only: removes the browser-test user and everything they created.
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)])
);

const email = process.argv[2] ?? "spot-test@example.com";
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

(async () => {
  const { data } = await admin.auth.admin.listUsers();
  const user = data.users.find((u) => u.email === email);
  if (!user) {
    console.log("no such user");
    return;
  }
  const { count } = await admin
    .from("game_templates")
    .delete({ count: "exact" })
    .eq("creator_id", user.id);
  await admin.auth.admin.deleteUser(user.id);
  console.log(`deleted user ${email} and ${count ?? 0} template(s)`);
})();
