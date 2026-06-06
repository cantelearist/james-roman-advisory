import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".qa",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "line",
  use: {
    baseURL: "http://localhost:3031",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npm run dev -- --port 3031",
    url: "http://localhost:3031",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
