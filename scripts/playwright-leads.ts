import assert from "node:assert/strict";
import { chromium } from "playwright";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3001";
const LOGIN_EMAIL = process.env.PLAYWRIGHT_LOGIN_EMAIL ?? "test@roomflow.local";
const LOGIN_PASSWORD = process.env.PLAYWRIGHT_LOGIN_PASSWORD ?? "Roomflow123!";

async function login(page: import("playwright").Page) {
  await page.goto(`${BASE_URL}/login`, {
    timeout: 120_000,
    waitUntil: "domcontentloaded",
  });
  await page.getByText("Operator access", { exact: false }).waitFor({
    timeout: 45_000,
  });
  await page.getByLabel("Email").fill(LOGIN_EMAIL);
  await page.getByLabel("Password").fill(LOGIN_PASSWORD);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith("/login"), {
      timeout: 120_000,
      waitUntil: "domcontentloaded",
    }),
    page.getByRole("button", { name: "Log in" }).click(),
  ]);

  if (page.url().includes("/onboarding")) {
    await page.goto(`${BASE_URL}/app`, {
      timeout: 120_000,
      waitUntil: "domcontentloaded",
    });
  }
}

async function createLead(page: import("playwright").Page, index: number) {
  const suffix = `${Date.now()}-${index}`;
  const fullName = `Playwright Lead ${suffix}`;
  const email = `playwright+${suffix}@example.com`;

  await page.goto(`${BASE_URL}/app/leads/new`, {
    timeout: 120_000,
    waitUntil: "domcontentloaded",
  });
  await page.getByRole("heading", { name: "Add a lead" }).waitFor({
    timeout: 45_000,
  });
  await page.getByRole("textbox", { name: "Lead name" }).fill(fullName);
  await page.getByRole("textbox", { name: /^Email$/ }).fill(email);
  await page.getByRole("spinbutton", { name: "Monthly budget" }).fill(
    String(1200 + index),
  );
  await page.getByRole("textbox", { name: "Operator notes" }).fill(
    `Created by Playwright ${suffix}`,
  );
  await Promise.all([
    page.waitForURL(/\/app\/leads\/.+/, {
      timeout: 120_000,
      waitUntil: "domcontentloaded",
    }),
    page.getByRole("button", { name: "Create lead" }).click(),
  ]);

  await page.getByText(fullName, { exact: false }).waitFor({ timeout: 45_000 });
  return { email, fullName };
}

async function run() {
  const browser = await chromium.launch({ headless: true });

  try {
    const desktopContext = await browser.newContext({
      viewport: {
        height: 960,
        width: 1440,
      },
    });
    const desktopPage = await desktopContext.newPage();
    await login(desktopPage);

    const createdLead = await createLead(desktopPage, 1);

    await desktopPage.goto(`${BASE_URL}/app/leads`, {
      timeout: 120_000,
      waitUntil: "domcontentloaded",
    });
    await desktopPage.getByRole("heading", { name: "Qualification queue" }).waitFor({
      timeout: 45_000,
    });

    await desktopPage.getByRole("searchbox").fill(createdLead.fullName);
    await desktopPage.getByRole("button", { name: "Apply" }).click();
    await desktopPage.getByRole("link", { name: createdLead.fullName }).waitFor({
      timeout: 45_000,
    });

    await desktopPage.selectOption('select[name="sort"]', "name");
    await desktopPage.getByRole("button", { name: "Apply" }).click();
    await desktopPage.waitForURL(/sort=name/, { timeout: 45_000 });

    for (let index = 2; index <= 11; index += 1) {
      await createLead(desktopPage, index);
    }

    await desktopPage.goto(`${BASE_URL}/app/leads?pageSize=5`, {
      timeout: 120_000,
      waitUntil: "domcontentloaded",
    });
    const nextButton = desktopPage.getByRole("button", {
      exact: true,
      name: "Next",
    });
    await nextButton.waitFor({ timeout: 45_000 });
    await expectEnabled(nextButton);

    const mobileContext = await browser.newContext({
      viewport: {
        height: 844,
        width: 390,
      },
    });
    const mobilePage = await mobileContext.newPage();
    await login(mobilePage);
    await mobilePage.goto(`${BASE_URL}/app/leads?q=${encodeURIComponent(createdLead.fullName)}`, {
      timeout: 120_000,
      waitUntil: "domcontentloaded",
    });
    await mobilePage
      .locator('a[href^="/app/leads/"]:visible')
      .filter({ hasText: createdLead.fullName })
      .first()
      .waitFor({
      timeout: 45_000,
    });

    const overflowMetrics = await mobilePage.evaluate(() => ({
      bodyClientWidth: document.body.clientWidth,
      bodyScrollWidth: document.body.scrollWidth,
      documentClientWidth: document.documentElement.clientWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
    }));

    assert.equal(
      overflowMetrics.bodyScrollWidth <= overflowMetrics.bodyClientWidth + 2,
      true,
      `Body overflow detected: ${JSON.stringify(overflowMetrics)}`,
    );
    assert.equal(
      overflowMetrics.documentScrollWidth <= overflowMetrics.documentClientWidth + 2,
      true,
      `Document overflow detected: ${JSON.stringify(overflowMetrics)}`,
    );

    await mobileContext.close();
    await desktopContext.close();
  } finally {
    await browser.close();
  }
}

async function expectEnabled(locator: import("playwright").Locator) {
  const ariaDisabled = await locator.getAttribute("aria-disabled");
  assert.notEqual(ariaDisabled, "true");
  assert.equal(await locator.isDisabled(), false);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});