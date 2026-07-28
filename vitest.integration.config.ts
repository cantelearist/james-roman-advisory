import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["integration/**/*.integration.test.ts"],
    fileParallelism: false,
    maxWorkers: 1,
  },
});
