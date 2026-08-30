import type { FullConfig } from "@playwright/test";

/**
 * Refuses to run against a server that isn't this app.
 *
 * `reuseExistingServer` will happily adopt whatever is already listening on
 * the port. That once meant the entire suite ran against another project's
 * dev server and failed in confusing ways. Checking identity up front turns
 * that into one clear error instead of a dozen misleading ones.
 */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL;
  if (!baseURL) return;

  const url = new URL("/api/health", baseURL).toString();

  let body: { app?: string; env?: string; commit?: string };
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`health check returned ${response.status}`);
    }
    body = await response.json();
  } catch (error) {
    throw new Error(
      `Could not reach ${url}.\n` +
        `Is the server running? Expected this project on ${baseURL}.\n` +
        `Cause: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (body.app !== "spot") {
    throw new Error(
      `Refusing to run: ${baseURL} is serving "${body.app ?? "an unknown app"}", not SPOT.\n` +
        `Something else is using that port. Stop it, or set E2E_BASE_URL to the right target.`
    );
  }

  console.log(`E2E target: ${baseURL} (${body.env}, commit ${body.commit})`);
}
