import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: { include: ["src", "worker"], exclude: ["src/index.ts", "worker/*.test.ts"], thresholds: { lines: 80, functions: 80, branches: 80 } },
  },
});
