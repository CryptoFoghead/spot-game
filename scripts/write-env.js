// Reads `supabase projects api-keys -o json` output from stdin and writes
// .env.local without ever printing key material. Reports only key names.
const fs = require("fs");

const raw = fs.readFileSync(0, "utf8");
let keys;
try {
  keys = JSON.parse(raw);
} catch {
  console.error("Could not parse api-keys JSON. First 120 chars (redacted length):", raw.length);
  process.exit(1);
}
if (!Array.isArray(keys)) keys = keys.api_keys ?? keys.keys ?? [];

console.log("Key entries found:", keys.map((k) => `${k.name ?? k.id} (${k.type ?? "?"})`).join(", "));

const byName = Object.fromEntries(keys.map((k) => [k.name, k.api_key]));
const publishable =
  byName["publishable"] ?? keys.find((k) => k.type === "publishable")?.api_key ?? byName["anon"];
const secret =
  byName["secret"] ?? keys.find((k) => k.type === "secret")?.api_key ?? byName["service_role"];

if (!publishable || !secret) {
  console.error("Missing publishable or secret key in output; names were listed above.");
  process.exit(1);
}

const projectRef = process.argv[2];
const env = [
  "NEXT_PUBLIC_SITE_URL=http://localhost:3000",
  `NEXT_PUBLIC_SUPABASE_URL=https://${projectRef}.supabase.co`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${publishable}`,
  `SUPABASE_SECRET_KEY=${secret}`,
  "",
].join("\n");

fs.writeFileSync(".env.local", env, "utf8");
console.log(".env.local written with 4 variables (values not shown).");
