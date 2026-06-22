import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths({ root: "./" })],
  test: {
    globals: true,
    environment: "node",
    setupFiles: "./scripts/test-setup.ts",
    pool: "forks", // Isolate tests to prevent DB state pollution
    testTimeout: 30000, // 30s for DB operations
    hookTimeout: 30000,
  },
});