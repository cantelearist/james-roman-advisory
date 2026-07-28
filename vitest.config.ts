import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    css: true,
    exclude: ["node_modules/**", ".next/**", ".qa/**", "integration/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/components/ui/**",
        "src/app/layout.tsx",
        "src/app/**/loading.tsx",
        "src/app/**/error.tsx",
      ],
    },
  },
});
