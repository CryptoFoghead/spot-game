// Verifies no server-only secret reaches the client bundle or the repository.
// Reports counts and file names only — never the secret values themselves.
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Locally the secrets live in .env.local; in CI they come from the
// environment. Either way we only ever read them to search for leaks.
const env = fs.existsSync(".env.local")
  ? Object.fromEntries(
      fs
        .readFileSync(".env.local", "utf8")
        .split("\n")
        .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
        .map((l) => [
          l.slice(0, l.indexOf("=")).trim(),
          l.slice(l.indexOf("=") + 1).trim(),
        ])
    )
  : process.env;

// Values that must never appear anywhere the browser can read.
const secrets = Object.entries(env).filter(
  ([name, value]) => !name.startsWith("NEXT_PUBLIC_") && value && value.length > 12
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

let failures = 0;

// 1. Client bundle
const clientFiles = walk(".next/static");
console.log(`Scanning ${clientFiles.length} client bundle files...`);
for (const [name, value] of secrets) {
  const hits = clientFiles.filter((file) =>
    fs.readFileSync(file, "utf8").includes(value)
  );
  if (hits.length) {
    failures++;
    console.log(`  FAIL ${name} appears in: ${hits.join(", ")}`);
  } else {
    console.log(`  ok   ${name} absent from client bundle`);
  }
}

// 2. Tracked files in git
const tracked = execSync("git ls-files", { encoding: "utf8" })
  .split("\n")
  .filter(Boolean);
console.log(`\nScanning ${tracked.length} tracked files...`);
for (const [name, value] of secrets) {
  const hits = tracked.filter((file) => {
    try {
      return fs.readFileSync(file, "utf8").includes(value);
    } catch {
      return false;
    }
  });
  if (hits.length) {
    failures++;
    console.log(`  FAIL ${name} appears in: ${hits.join(", ")}`);
  } else {
    console.log(`  ok   ${name} absent from tracked files`);
  }
}

// 3. .env files must be ignored
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

console.log(failures === 0 ? "\nPASS: no secret exposure found" : `\nFAILURES: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
