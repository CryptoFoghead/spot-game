// Dev-only: creates/reuses a test user and prints a one-time /auth/callback
// URL so the local browser can sign in without email delivery.
// Usage: node scripts/dev-login-link.js [email]
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
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error) {
    console.error("generateLink failed:", error.message);
    process.exit(1);
  }
  const tokenHash = data.properties.hashed_token;
  console.log(
    `${env.NEXT_PUBLIC_SITE_URL}/auth/callback?token_hash=${tokenHash}&type=magiclink`
  );
})();
