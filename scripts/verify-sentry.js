// Proves an event actually reaches Sentry, rather than that the SDK loaded.
// Usage: node scripts/verify-sentry.js
const fs = require("fs");
const Sentry = require("@sentry/node");

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);

const dsn = env.SENTRY_DSN;
if (!dsn) {
  console.error("SENTRY_DSN not set in .env.local");
  process.exit(1);
}

// The DSN's project id is its last path segment — print it so we can confirm
// events land in the intended project and not another one in the same org.
const projectId = dsn.split("/").pop();
console.log(`DSN project id: ${projectId}`);

Sentry.init({ dsn, tracesSampleRate: 0, environment: "verification" });

const eventId = Sentry.captureException(
  new Error("SPOT wiring verification — safe to resolve")
);
console.log(`event id: ${eventId}`);

(async () => {
  const delivered = await Sentry.flush(15000);
  console.log(
    delivered
      ? "PASS: Sentry accepted the event"
      : "FAIL: event was not delivered before timeout"
  );
  process.exit(delivered ? 0 : 1);
})();
