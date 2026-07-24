import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 } });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("jra_intro_seen", "1");
  });
});

test("mobile homepage exposes the current primary journeys", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page.locator("h1")).toContainText("On your side.");

  const inquiry = page.getByRole("link", { name: /Book a confidential inquiry/i });
  await inquiry.scrollIntoViewIfNeeded();
  await expect(inquiry).toBeVisible();

  const privateOffice = page.getByRole("link", { name: /Access private office/i });
  await privateOffice.scrollIntoViewIfNeeded();
  await expect(privateOffice).toHaveAttribute("href", "/portal");
});

test("mobile Private Office journey reaches a protected route", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const privateOffice = page.getByRole("link", { name: /Access private office/i });
  await privateOffice.scrollIntoViewIfNeeded();
  await privateOffice.click();

  await expect(page).toHaveURL(/\/(portal|sign-in)/);
});
