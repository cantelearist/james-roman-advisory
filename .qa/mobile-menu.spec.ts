import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 } });

test("mobile navigation opens and closes", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });

  const menuButton = page.getByRole("button", { name: "Open navigation" });
  await expect(menuButton).toBeVisible();
  await menuButton.click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("link", { name: "The Process" })).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Malibu Story" })).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Certifications" })).toBeVisible();

  await dialog.getByRole("link", { name: "The Process" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator("#process")).toBeInViewport();
});

test("Private Office header CTA navigates to portal", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });

  // Private Office is always visible in the header (outside the Sheet)
  await page.getByRole("link", { name: /Private Office/i }).click();
  await expect(page).toHaveURL(/\/portal/);
});
