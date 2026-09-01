// Config for the Local Table behavioural suite.
//
// Separate from vitest.config.ts because these tests start real containers:
// they are slow, they need Docker, and they must never be swept into the unit
// run by a glob. Separate from vitest.integration.config.ts because those tests
// point at a real Supabase project and need credentials, whereas these create
// and destroy their own throwaway stack and need none.
//
//   npm run test:behavioral
//
// Not wired into CI. The suite skips itself cleanly when Docker is unavailable,
// so running it on a machine without Docker is a no-op rather than a failure.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: { alias: { "@": path.resolve(rootDir, "src") } },
  test: {
    environment: "node",
    include: ["tests/behavioral/**/*.test.ts"],
    // Pulling two images on a cold machine, then starting Postgres and
    // PostgREST, is well past a unit test's budget.
    testTimeout: 180_000,
    hookTimeout: 300_000,
    // The suite owns one container stack; parallel files would race over it.
    fileParallelism: false,
  },
});
