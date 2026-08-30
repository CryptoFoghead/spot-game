import { NextResponse } from "next/server";

/**
 * Identifies this app and deployment.
 *
 * Exists so tooling can prove *which* server is answering on a port before
 * trusting it — a stale server from another project once made the whole E2E
 * suite fail against code that wasn't this branch. Also a cheap uptime probe.
 *
 * Deliberately exposes nothing sensitive: no env values, no user data.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    app: "spot",
    ok: true,
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
    env: process.env.VERCEL_ENV ?? "development",
    at: new Date().toISOString(),
  });
}
