import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 } });

test("mobile homepage keeps the consultation and portal CTAs available", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.getByRole("link", { name: /Book a private consultation/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Access private office", exact: true })).toBeVisible();
});

test("mobile private office CTA uses the protected portal route", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByRole("link", { name: "Access private office", exact: true }).click();
  await expect(page).toHaveURL(/\/sign-in\?redirect_url=%2Fportal/);
});
