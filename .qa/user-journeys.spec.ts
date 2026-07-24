import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("jra_intro_seen", "1");
  });
});

test("hero inquiry CTA reaches the consultation form", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page.locator("h1")).toContainText("On your side.");

  await page.getByRole("link", { name: "Inquire" }).click();
  await expect(page.locator("#consultation")).toBeInViewport();
  await expect(page.locator("#consultation h2")).toContainText(
    "Requestaconfidentialconsultation.",
  );
});

test("desktop navigation reaches the current sections", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const journeys = [
    ["The Practice", "#the-practice"],
    ["Origin", "#origin"],
    ["The Cornerstone", "#the-cornerstone"],
    ["Private Office", "#private-office"],
  ] as const;

  for (const [name, selector] of journeys) {
    // The production header intentionally hides while scrolling down, so each
    // journey starts at the top just as an actual navigation visit would.
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByRole("link", { name, exact: true }).first().click();
    await expect(page.locator(selector)).toBeInViewport();
  }
});

test("consultation form shows validation errors on bad input", async ({ page }) => {
  await page.goto("/#consultation", { waitUntil: "domcontentloaded" });
  await page.locator("#consultation").scrollIntoViewIfNeeded();

  await page.getByLabel("Name").fill("J");
  await page.getByLabel("Email").fill("not-an-email");
  await page.getByLabel("Primary market").fill("M");
  await page.getByLabel("Matter type").fill("R");
  await page.getByLabel("Brief context").fill("short");
  await page.getByRole("button", { name: /Submit request/i }).click();

  await expect(page.getByRole("alert")).toBeVisible();
});

test("consultation success flow does not write test data to production", async ({ page }) => {
  await page.route("**/api/consultations", async (route) => {
    expect(route.request().method()).toBe("POST");
    expect(route.request().postDataJSON()).toMatchObject({
      name: "Alexandra Reed",
      email: "alex.reed@example.com",
      market: "Malibu",
    });

    await route.fulfill({
      status: 202,
      contentType: "application/json",
      body: JSON.stringify({
        referenceId: "JRA-E2E-SAFE",
        message:
          "Request received. A private review record has been created for advisor screening.",
      }),
    });
  });

  await page.goto("/#consultation", { waitUntil: "domcontentloaded" });
  await page.locator("#consultation").scrollIntoViewIfNeeded();

  await page.getByLabel("Name").fill("Alexandra Reed");
  await page.getByLabel("Email").fill("alex.reed@example.com");
  await page.getByLabel("Primary market").fill("Malibu");
  await page.getByLabel("Matter type").fill("Remediation oversight");
  await page.getByLabel("Brief context").fill(
    "We are dealing with post-fire remediation and need owner-side advisory.",
  );
  await page.getByRole("button", { name: /Submit request/i }).click();

  await expect(page.getByRole("status")).toContainText(/Request received/i);
});

test("Private Office link reaches a protected route", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const privateOffice = page.getByRole("link", { name: /Access private office/i });
  await privateOffice.scrollIntoViewIfNeeded();
  await privateOffice.click();

  await expect(page).toHaveURL(/\/(portal|sign-in)/);
});

test("footer links target the current sections", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const footer = page.locator("footer");
  await expect(footer.getByRole("link", { name: "The Practice" })).toHaveAttribute(
    "href",
    "#the-practice",
  );
  await expect(footer.getByRole("link", { name: "Consultation" })).toHaveAttribute(
    "href",
    "#consultation",
  );
  await expect(footer.getByRole("link", { name: "Client portal" })).toHaveAttribute(
    "href",
    "/portal",
  );
});

test("portal response fails closed for unauthenticated users", async ({ request }) => {
  const response = await request.get("/portal", { maxRedirects: 0 });

  expect([307, 503]).toContain(response.status());
  if (response.status() === 307) {
    expect(response.headers().location).toContain("/sign-in");
  }
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(response.headers()["x-robots-tag"]).toContain("noindex");
});
