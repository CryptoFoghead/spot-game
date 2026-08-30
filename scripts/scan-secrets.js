// Verifies no server-only secret reaches the client bundle or the repository.
// Reports counts and file names only — never the secret values themselves.
//
// Two scans, because neither alone is enough:
//
//   1. By value. The strongest check, but it can only run where the real
//      secrets are — locally, or in CI if you give CI credentials. We
//      deliberately don't (public repo), so this scan reports itself as
//      skipped there rather than printing a pass it did not earn.
//
//   2. By shape. Runs everywhere. Looks for credentials that cannot appear
//      innocently: an Anthropic key, a Supabase secret key, a service_role
//      JWT, a private key block. This is what makes the CI run mean anything.
//
// The value scan used to read the WHOLE environment when .env.local was
// absent, which in CI meant the runner's own variables. It flagged
// GITHUB_SERVER_URL ("https://github.com") inside package-lock.json and the
// branch name inside a docs file, while never once checking a real secret.
// See BUG_LIST B-19.
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

/** The app's own server-only variables. NEXT_PUBLIC_* are public by design. */
const PROJECT_SECRET_VARS = ["SUPABASE_SECRET_KEY", "AI_API_KEY"];

/** CI and examples set these deliberately; they are not secrets. */
const isPlaceholder = (value) =>
  /placeholder|example|changeme|your[-_]?key|dummy|^test$/i.test(value);

function readEnv() {
  if (!fs.existsSync(".env.local")) {
    // Only our own names — never the ambient environment.
    return Object.fromEntries(
      PROJECT_SECRET_VARS.filter((name) => process.env[name]).map((name) => [
        name,
        process.env[name],
      ])
    );
  }
  return Object.fromEntries(
    fs
      .readFileSync(".env.local", "utf8")
      .split("\n")
      .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
      .map((l) => [
        l.slice(0, l.indexOf("=")).trim(),
        l.slice(l.indexOf("=") + 1).trim(),
      ])
  );
}

const env = readEnv();

/**
 * A value that is ALSO exposed under a NEXT_PUBLIC_ name is public, whatever
 * the unprefixed variable is called. The Sentry DSN is the live example: it
 * is set both ways, it is embedded in the client bundle by design, and it is
 * send-only. Judging by name alone flagged it as a leak every local run.
 */
const publicValues = new Set(
  Object.entries(env)
    .filter(([name, value]) => name.startsWith("NEXT_PUBLIC_") && value)
    .map(([, value]) => value)
);

const secrets = Object.entries(env).filter(
  ([name, value]) =>
    !name.startsWith("NEXT_PUBLIC_") &&
    value &&
    value.length > 12 &&
    !isPlaceholder(value) &&
    !publicValues.has(value)
);

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
}

function read(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

let failures = 0;

const clientFiles = walk(".next/static");
const tracked = execSync("git ls-files", { encoding: "utf8" })
  .split("\n")
  .filter(Boolean);

// ---------------------------------------------------------------- by value

if (secrets.length === 0) {
  console.log(
    "Value scan SKIPPED — no real project secrets in this environment.\n" +
      "  (Expected in CI. Run locally with .env.local for the full check.)\n"
  );
} else {
  console.log(`Scanning ${clientFiles.length} client bundle files by value...`);
  for (const [name, value] of secrets) {
    const hits = clientFiles.filter((file) => read(file).includes(value));
    if (hits.length) {
      failures++;
      console.log(`  FAIL ${name} appears in: ${hits.join(", ")}`);
    } else {
      console.log(`  ok   ${name} absent from client bundle`);
    }
  }

  console.log(`\nScanning ${tracked.length} tracked files by value...`);
  for (const [name, value] of secrets) {
    const hits = tracked.filter((file) => read(file).includes(value));
    if (hits.length) {
      failures++;
      console.log(`  FAIL ${name} appears in: ${hits.join(", ")}`);
    } else {
      console.log(`  ok   ${name} absent from tracked files`);
    }
  }
  console.log("");
}

// ---------------------------------------------------------------- by shape

/**
 * A JWT is not itself a finding — the Supabase anon key is one, it is public,
 * and it belongs in the client bundle. Only a service_role token is a leak,
 * so decode the payload and look rather than guessing from the shape.
 */
function hasServiceRoleJwt(text) {
  for (const match of text.matchAll(
    /eyJ[A-Za-z0-9_-]{8,}\.(eyJ[A-Za-z0-9_-]{8,})\.[A-Za-z0-9_-]{8,}/g
  )) {
    try {
      const payload = Buffer.from(match[1], "base64url").toString("utf8");
      if (JSON.parse(payload).role === "service_role") return true;
    } catch {
      // Not a JWT we can read; shape alone proves nothing.
    }
  }
  return false;
}

const PATTERNS = [
  ["Anthropic API key", (t) => /sk-ant-[A-Za-z0-9_-]{20,}/.test(t)],
  ["Supabase secret key", (t) => /sb_secret_[A-Za-z0-9_-]{20,}/.test(t)],
  ["Supabase service_role JWT", hasServiceRoleJwt],
  ["Private key block", (t) => /-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(t)],
];

// This file contains the patterns themselves, so it would match itself.
const self = "scripts/scan-secrets.js";
const shapeTargets = [
  ...clientFiles,
  ...tracked.filter((f) => f !== self && f !== self.replace(/\//g, path.sep)),
];

console.log(`Scanning ${shapeTargets.length} files by shape...`);
for (const [label, matches] of PATTERNS) {
  const hits = shapeTargets.filter((file) => matches(read(file)));
  if (hits.length) {
    failures++;
    console.log(`  FAIL ${label} found in: ${hits.join(", ")}`);
  } else {
    console.log(`  ok   no ${label}`);
  }
}

// ------------------------------------------------------------- env hygiene

for (const file of [".env.local", ".env"]) {
  try {
    execSync(`git check-ignore ${file}`, { stdio: "ignore" });
    console.log(`\n  ok   ${file} is git-ignored`);
  } catch {
    if (fs.existsSync(file)) {
      failures++;
      console.log(`\n  FAIL ${file} exists and is NOT git-ignored`);
    }
  }
}

console.log(
  failures === 0 ? "\nPASS: no secret exposure found" : `\nFAILURES: ${failures}`
);
process.exit(failures === 0 ? 0 : 1);
