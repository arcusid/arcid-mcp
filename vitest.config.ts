import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: { include: ["src"], exclude: ["src/index.ts"], thresholds: { lines: 80, functions: 80, branches: 80 } },
  },
});
