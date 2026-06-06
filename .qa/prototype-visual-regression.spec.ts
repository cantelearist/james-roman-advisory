import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const artifactDir = "/tmp/jra-visual-qa";

const routes = [
  { path: "/", name: "home", hasFounderImage: true },
  { path: "/prototype", name: "prototype", hasFounderImage: true },
  { path: "/prototype2", name: "prototype2", hasFounderImage: true },
  { path: "/prototype2/contact", name: "prototype2-contact", hasFounderImage: false },
];

const viewports = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
];

function attachErrorCapture(page: Page) {
  const errors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });

  page.on("pageerror", (error) => {
    errors.push(`pageerror: ${error.message}`);
  });

  return errors;
}

async function waitForPrototypeIntro(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2600);
}

async function expectNoHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    html: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));

  expect(Math.max(metrics.body, metrics.html)).toBeLessThanOrEqual(metrics.viewport + 2);
}

async function expectFounderImageStable(page: Page) {
  const founderImage = page.locator('img[src*="founders-malibu-beach"]').first();
  await expect(founderImage).toBeVisible();
  await founderImage.scrollIntoViewIfNeeded();
  await page.waitForTimeout(350);

  const before = await founderImage.boundingBox();
  expect(before?.width ?? 0).toBeGreaterThan(120);
  expect(before?.height ?? 0).toBeGreaterThan(120);

  await page.mouse.wheel(0, 420);
  await page.waitForTimeout(500);

  const after = await founderImage.boundingBox();
  expect(after?.width ?? 0).toBeGreaterThan(120);
  expect(after?.height ?? 0).toBeGreaterThan(120);
  expect(Math.abs((after?.width ?? 0) - (before?.width ?? 0))).toBeLessThan(3);
  expect(Math.abs((after?.height ?? 0) - (before?.height ?? 0))).toBeLessThan(3);
}

test.beforeAll(() => {
  mkdirSync(artifactDir, { recursive: true });
});

for (const viewport of viewports) {
  test.describe(`prototype visual gate ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const route of routes) {
      test(`${route.name} renders without visual regressions`, async ({ page }) => {
        const errors = attachErrorCapture(page);

        await page.goto(route.path);
        await waitForPrototypeIntro(page);

        await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
        await expectNoHorizontalOverflow(page);

        if (route.hasFounderImage) {
          await expectFounderImageStable(page);
        }

        await page.screenshot({
          path: join(artifactDir, `${route.name}-${viewport.name}.png`),
          fullPage: true,
        });

        expect(errors).toEqual([]);
      });
    }
  });
}

test("reduced-motion mode keeps prototype content visible", async ({ browser }) => {
  const context = await browser.newContext({
    reducedMotion: "reduce",
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  const errors = attachErrorCapture(page);

  await page.goto("/prototype2");
  await waitForPrototypeIntro(page);

  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  const practiceSection = page.locator("#the-process");
  await practiceSection.scrollIntoViewIfNeeded();
  await expect(practiceSection.getByText("The Practice")).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.screenshot({
    path: join(artifactDir, "prototype2-reduced-motion-mobile.png"),
    fullPage: true,
  });

  expect(errors).toEqual([]);
  await context.close();
});
