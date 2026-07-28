import { expect, test } from "@playwright/test";

const productionOrigin = new URL(
  process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
).origin;
const safeProductionPaths = [
  /^\/$/,
  /^\/portal$/,
  /^\/sign-in$/,
  /^\/sign-up$/,
  /^\/forgot-password$/,
  /^\/reset-password$/,
  /^\/mfa$/,
  /^\/_next\//,
  /\.(?:css|js|jpe?g|webp|png|gif|svg|ico|woff2?)$/,
];

test.beforeEach(async ({ page }) => {
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const safeMethod = request.method() === "GET" || request.method() === "HEAD";
    const safePath =
      url.origin !== productionOrigin ||
      safeProductionPaths.some((pattern) => pattern.test(url.pathname));

    if (!safeMethod || !safePath) {
      await route.abort("blockedbyclient");
      throw new Error(
        `Production smoke test blocked ${request.method()} ${url.pathname}`,
      );
    }
    await route.continue();
  });
});

test("homepage exposes the current advisory message and consultation CTA", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { level: 1 })).toContainText("On your side.");
  await page.getByRole("link", { name: /Book a confidential inquiry/i }).click();
  await expect(page.locator("#consultation")).toBeInViewport();
  await expect(page.getByRole("heading", { name: /consultation/i }).last()).toBeVisible();
});

test("desktop navigation reaches the current sections", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/", { waitUntil: "networkidle" });

  for (const [label, hash] of [
    ["The Practice", "#the-practice"],
    ["Origin", "#origin"],
    ["The Cornerstone", "#the-cornerstone"],
    ["Private Office", "#private-office"],
  ] as const) {
    await page.getByRole("navigation").getByRole("link", { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${hash.replace("#", "\\#")}$`));
  }
});

test("consultation form shows validation errors on bad input", async ({ page }) => {
  await page.goto("/#consultation", { waitUntil: "networkidle" });
  await page.getByLabel("Name").fill("J");
  await page.getByLabel("Email").fill("not-an-email");
  await page.getByLabel("Primary market").fill("M");
  await page.getByLabel("Matter type").fill("R");
  await page.getByLabel("Brief context").fill("short");
  await page.getByRole("button", { name: /Submit request/i }).click();
  await expect(page.getByRole("alert")).toBeVisible();
});

test("private office entry points to the protected portal", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByRole("link", { name: "Access private office", exact: true }).click();
  await expect(page).toHaveURL(/\/sign-in\?redirect_url=%2Fportal/);
});

test("footer links match the current site map", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  const footer = page.locator("footer");
  await expect(footer.getByRole("link", { name: "The Practice" })).toHaveAttribute("href", "#the-practice");
  await expect(footer.getByRole("link", { name: "Consultation" })).toHaveAttribute("href", "#consultation");
  await expect(footer.getByRole("link", { name: "Client portal" })).toHaveAttribute("href", "/portal");
});

test("portal route requires authentication", async ({ page }) => {
  await page.goto("/portal", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/sign-in\?redirect_url=%2Fportal/);
});
