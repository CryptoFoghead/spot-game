import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // The real package throws outside a server component; the guard still
      // applies to the actual build.
      "server-only": fileURLToPath(
        new URL("./tests/stubs/server-only.ts", import.meta.url)
      ),
      "@": import.meta.dirname,
    },
  },
  // Component tests are .tsx. Vitest 4 transforms JSX through oxc without
  // configuration; per-file `@vitest-environment jsdom` keeps everything else
  // on node, which is faster and closer to how the rest of this suite runs.
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
    environment: "node",
    // Integration setup signs users in against the real project and backs off
    // when Supabase throttles concurrent auth; the default 10s hook budget cuts
    // that short.
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
});
