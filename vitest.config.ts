import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: {
    // Ensure React loads its development build (which exports `act`) in tests.
    // Vitest 4 + @vitejs/plugin-react 6 can statically replace this with
    // 'production', causing react/index.js to load react.production.js which
    // does not export `act`, breaking @testing-library/react.
    "process.env.NODE_ENV": JSON.stringify("test"),
  },
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
    exclude: ["node_modules/**", ".next/**", ".qa/**"],
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
