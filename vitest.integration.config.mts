import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: { environment: "node", include: ["tests/integration/**/*.test.ts"], testTimeout: 180_000, hookTimeout: 60_000, fileParallelism: false },
});
