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
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // Integration setup signs users in against the real project and backs off
    // when Supabase throttles concurrent auth; the default 10s hook budget cuts
    // that short.
    hookTimeout: 40_000,
    testTimeout: 30_000,
  },
});
