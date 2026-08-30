import { defineConfig, devices } from "@playwright/test";

/**
 * This project owns port 3001 (see README "Port"). Another app on this machine
 * uses 3000, so nothing here should ever default to it.
 *
 * `globalSetup` verifies the server on the port really is SPOT before any test
 * runs — reuseExistingServer will otherwise adopt whatever is listening.
 *
 * Point at a deployment with E2E_BASE_URL; the local server is then skipped.
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3001";
const isLocal = baseURL.startsWith("http://localhost");

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
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
          // `npm run dev` pins 3001 itself.
          command: "npm run dev",
          url: baseURL,
          reuseExistingServer: true,
          timeout: 120_000,
        },
      }
    : {}),
});
