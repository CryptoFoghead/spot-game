// Pushes environment variables from .env.local to Vercel without printing
// their values. Skips Vercel's own injected vars.
const fs = require("fs");
const { spawnSync } = require("child_process");

const SKIP = new Set(["VERCEL_OIDC_TOKEN"]);
const targets = process.argv.slice(2);
if (targets.length === 0) {
  console.error("usage: node scripts/push-vercel-env.js production [preview ...]");
  process.exit(1);
}

const env = fs
  .readFileSync(".env.local", "utf8")
  .split("\n")
  .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
  .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
  .filter(([name, value]) => value && !SKIP.has(name));

for (const [name, value] of env) {
  for (const target of targets) {
    // Remove first so re-runs update rather than fail on duplicates.
    spawnSync("npx", ["--yes", "vercel", "env", "rm", name, target, "--yes"], {
      stdio: "ignore",
      shell: true,
    });
    const result = spawnSync(
      "npx",
      ["--yes", "vercel", "env", "add", name, target],
      { input: value, encoding: "utf8", shell: true }
    );
    const ok = result.status === 0;
    console.log(`${ok ? "ok  " : "FAIL"} ${name} -> ${target}`);
    if (!ok && result.stderr) {
      console.log(`     ${result.stderr.split("\n").slice(-3).join(" ").trim()}`);
    }
  }
}
