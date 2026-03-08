import { chromium } from "playwright";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3001";
const LOGIN_EMAIL = process.env.PLAYWRIGHT_LOGIN_EMAIL ?? "test@roomflow.local";
const LOGIN_PASSWORD = process.env.PLAYWRIGHT_LOGIN_PASSWORD ?? "Roomflow123!";

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const failures = [];

  page.on("pageerror", (error) => {
    failures.push({
      type: "pageerror",
      message: error.message,
    });
  });

  page.on("console", (message) => {
    if (message.type() === "error") {
      failures.push({
        type: "console",
        message: message.text(),
      });
    }
  });

  page.on("response", (response) => {
    if (response.status() >= 500) {
      failures.push({
        type: "response",
        status: response.status(),
        url: response.url(),
      });
    }
  });

  async function visitPath(pathname, expectedText) {
    const response = await page.goto(`${BASE_URL}${pathname}`, {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });

    if (!response) {
      throw new Error(`No response while loading ${pathname}`);
    }

    if (response.status() >= 500) {
      throw new Error(`Route ${pathname} returned ${response.status()}`);
    }

    if (expectedText) {
      await page.getByText(expectedText, { exact: false }).first().waitFor({
        timeout: 45_000,
      });
    }
  }

  try {
    await visitPath("/login", "Operator access");

    await page.getByLabel("Email").fill(LOGIN_EMAIL);
    await page.getByLabel("Password").fill(LOGIN_PASSWORD);
    await Promise.all([
      page.waitForURL("**/app", {
        timeout: 120_000,
      }),
      page.getByRole("button", { name: "Log in" }).click(),
    ]);

    await page.getByRole("heading", { name: "Operational snapshot" }).waitFor({
      timeout: 60_000,
    });

    await visitPath("/app/leads", "Qualification queue");
    await visitPath("/app/inbox?queue=review", "Conversation triage");
    await visitPath("/app/properties", "Property operations");
    await visitPath("/app/calendar", "Scheduling handoff queue");
    await visitPath("/app/templates", "Reusable messaging");
    await visitPath("/app/workflows", "Automation builder");
    await visitPath("/app/settings", "Operator and workspace settings");
    await visitPath("/app/settings/integrations", "Integrations");

    await visitPath("/app/workflows", "Automation builder");
    await page.getByPlaceholder("New workflow name").fill("Playwright workflow smoke");
    await page.getByRole("button", { name: "Create workflow" }).click();
    await page.waitForURL(/\/app\/workflows\/.+/, {
      timeout: 120_000,
    });
    await page.getByText("Builder canvas", { exact: false }).waitFor({
      timeout: 60_000,
    });
    await page.getByRole("button", { name: "Create new version" }).waitFor({
      timeout: 30_000,
    });

    await visitPath("/app/leads", "Qualification queue");
    const firstLeadLink = page.locator('a[href^="/app/leads/"]').first();
    const firstLeadHref = await firstLeadLink.getAttribute("href");

    if (!firstLeadHref) {
      throw new Error("Could not find a lead detail link on /app/leads.");
    }

    await visitPath(firstLeadHref, "Summary");
    await page.getByRole("textbox", { name: "Message" }).fill(
      "Playwright smoke test manual outbound note.",
    );
    await Promise.all([
      page.waitForLoadState("domcontentloaded"),
      page.getByRole("button", { name: "Send manual message" }).click(),
    ]);

    if (page.url().includes("workflowError=")) {
      throw new Error(`Workflow error present after manual outbound action: ${page.url()}`);
    }

    await visitPath("/app/properties", "Property operations");
    const firstPropertyLink = page.locator('a[href^="/app/properties/"]').first();
    const firstPropertyHref = await firstPropertyLink.getAttribute("href");

    if (!firstPropertyHref) {
      throw new Error("Could not find a property detail link on /app/properties.");
    }

    await visitPath(firstPropertyHref, "Property summary");
    const propertyRulesHref = `${firstPropertyHref}/rules`;
    await visitPath(propertyRulesHref, "Scheduling handoff");
  } finally {
    await browser.close();
  }

  if (failures.length > 0) {
    require('node:fs').writeFileSync('smoke-fails.json', JSON.stringify(failures, null, 2));
    throw new Error(
      `Smoke checks hit ${failures.length} runtime issue(s):\n${JSON.stringify(
        failures,
        null,
        2,
      )}`,
    );
  }
}

run()
  .then(() => {
    console.log("Playwright smoke checks passed.");
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
