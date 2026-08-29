import { defineConfig, devices } from "@playwright/test";

/**
 * Defaults to port 3100, not 3000, so the suite never silently reuses a dev
 * server started by something else — a stale server on 3000 once made every
 * test fail against code that wasn't this branch.
 *
 * Point at a deployment with E2E_BASE_URL; the local server is then skipped.
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3100";
const isLocal = baseURL.startsWith("http://localhost");
const port = isLocal ? new URL(baseURL).port || "3000" : undefined;

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  // Realtime updates cross the internet and each one triggers a server
  // re-render, so assertions need room to settle when run against a
  // deployment rather than localhost.
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? "line" : [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    // Deployments are slower than localhost: cold starts, real network,
    // and realtime messages crossing the internet.
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  ...(isLocal
    ? {
        webServer: {
          command: `npm run dev -- --port ${port}`,
          url: baseURL,
          reuseExistingServer: true,
          timeout: 120_000,
        },
      }
    : {}),
});
