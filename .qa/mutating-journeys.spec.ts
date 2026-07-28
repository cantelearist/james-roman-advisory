import { expect, test } from "@playwright/test";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const hostname = new URL(baseUrl).hostname;
const productionHosts = new Set(["jamesroman.la", "www.jamesroman.la"]);

test.beforeAll(() => {
  if (productionHosts.has(hostname)) {
    throw new Error("Mutating E2E tests are forbidden against production.");
  }
  if (process.env.ALLOW_MUTATING_E2E !== "true") {
    throw new Error("Set ALLOW_MUTATING_E2E=true to run mutating E2E tests.");
  }
});

test("consultation form submits valid data", async ({ page }) => {
  await page.goto("/#consultation", { waitUntil: "networkidle" });
  await page.getByLabel("Name").fill("Alexandra Reed");
  await page.getByLabel("Email").fill(`alex.reed+${Date.now()}@example.com`);
  await page.getByLabel("Primary market").fill("Malibu");
  await page.getByLabel("Matter type").fill("Remediation oversight");
  await page.getByLabel("Brief context").fill(
    "We need owner-side advisory for a post-fire remediation review on a private coastal property.",
  );
  await page.getByRole("button", { name: /Submit request/i }).click();
  await expect(page.locator('p[role="status"]')).toContainText("Request Submitted");
});
