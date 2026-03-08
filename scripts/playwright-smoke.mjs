import { writeFileSync } from "node:fs";
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

  async function saveFormAndReload({ form, buttonName }) {
    await form.getByRole("button", { name: buttonName }).click();
    await page.waitForTimeout(1500);
    await page.reload({ waitUntil: "domcontentloaded", timeout: 120_000 });
  }

  try {
    await visitPath("/forgot-password", "Password recovery");
    await visitPath("/magic-link", "Magic link");
    await visitPath("/reset-password", "Choose a new password for this operator account.");
    await visitPath("/verify-email?email=test%40roomflow.local", "Confirm this operator email before entering the workspace.");
    await visitPath("/signup", "Create the first operator workspace");

    await visitPath("/login", "Operator access");

    await page.getByLabel("Email").fill(LOGIN_EMAIL);
    await page.getByLabel("Password").fill(LOGIN_PASSWORD);
    await Promise.all([
      page.waitForURL((url) => !url.pathname.startsWith("/login"), {
        timeout: 120_000,
        waitUntil: "domcontentloaded",
      }),
      page.getByRole("button", { name: "Log in" }).click(),
    ]);

    if (!page.url().includes("/app") && !page.url().includes("/onboarding")) {
      throw new Error(`Unexpected post-login URL: ${page.url()}`);
    }

    if (page.url().includes("/onboarding")) {
      await visitPath("/app", "Operational snapshot");
    }

    await page.getByRole("heading", { name: "Operational snapshot" }).waitFor({
      timeout: 60_000,
    });

    await visitPath("/app/leads", "Qualification queue");
    await visitPath("/app/inbox?queue=review", "Conversation triage");
    await visitPath("/app/properties", "Property operations");
    await visitPath("/app/calendar", "Tour scheduling");
    await visitPath("/app/templates", "Reusable messaging");
    await visitPath("/app/workflows", "Automation builder");
    await visitPath("/app/settings", "Operator and workspace settings");
    await visitPath("/app/settings/integrations", "Integrations");
    await visitPath("/app/settings/members", "Members and workspace access");
    await visitPath("/app/settings/security", "Security and sessions");

    await visitPath("/app/settings/integrations", "Workspace quiet hours");

    const quietHoursForm = page.locator("form").filter({
      has: page.getByRole("button", { name: "Save quiet hours" }),
    });
    await quietHoursForm.locator('input[name="quietHoursEnabled"]').check();
    await quietHoursForm.locator('input[name="quietHoursStartLocal"]').fill("22:15");
    await quietHoursForm.locator('input[name="quietHoursEndLocal"]').fill("07:45");
    await quietHoursForm
      .locator('input[name="quietHoursTimeZone"]')
      .fill("America/Chicago");
    await saveFormAndReload({ form: quietHoursForm, buttonName: "Save quiet hours" });
    await page
      .locator('input[name="quietHoursStartLocal"]')
      .first()
      .waitFor({ timeout: 30_000 });
    const quietHoursStartValue = await quietHoursForm
      .locator('input[name="quietHoursStartLocal"]')
      .inputValue();
    const quietHoursEndValue = await quietHoursForm
      .locator('input[name="quietHoursEndLocal"]')
      .inputValue();
    const quietHoursTimeZoneValue = await quietHoursForm
      .locator('input[name="quietHoursTimeZone"]')
      .inputValue();

    if (
      quietHoursStartValue !== "22:15" ||
      quietHoursEndValue !== "07:45" ||
      quietHoursTimeZoneValue !== "America/Chicago"
    ) {
      throw new Error("Workspace quiet hours settings did not persist after save.");
    }

    const throttleForm = page.locator("form").filter({
      has: page.getByRole("button", { name: "Save throttle settings" }),
    });
    await throttleForm.locator('input[name="dailyAutomatedSendCap"]').fill("77");
    await throttleForm
      .locator('input[name="missingInfoPromptThrottleMinutes"]')
      .fill("33");
    await saveFormAndReload({ form: throttleForm, buttonName: "Save throttle settings" });
    const dailyAutomatedSendCap = await throttleForm
      .locator('input[name="dailyAutomatedSendCap"]')
      .inputValue();
    const missingInfoThrottle = await throttleForm
      .locator('input[name="missingInfoPromptThrottleMinutes"]')
      .inputValue();

    if (dailyAutomatedSendCap !== "77" || missingInfoThrottle !== "33") {
      throw new Error("Automation throttle settings did not persist after save.");
    }

    const inboundWebhookForm = page.locator("form").filter({
      has: page.getByRole("button", { name: "Save inbound webhook config" }),
    });
    await inboundWebhookForm.locator('input[name="webhookEnabled"]').check();
    await inboundWebhookForm.locator('input[name="sourceLabel"]').fill("Playwright webhook");
    await inboundWebhookForm.locator('input[name="signingHeader"]').fill("x-playwright-signature");
    await saveFormAndReload({ form: inboundWebhookForm, buttonName: "Save inbound webhook config" });
    const sourceLabelValue = await inboundWebhookForm
      .locator('input[name="sourceLabel"]')
      .inputValue();
    const signingHeaderValue = await inboundWebhookForm
      .locator('input[name="signingHeader"]')
      .inputValue();

    if (
      sourceLabelValue !== "Playwright webhook" ||
      signingHeaderValue !== "x-playwright-signature"
    ) {
      throw new Error("Inbound webhook settings did not persist after save.");
    }

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
    await Promise.all([
      page.waitForURL(/\/app\/leads\/.+/, {
        timeout: 120_000,
      }),
      page.getByRole("link", { name: "Avery Mason" }).click(),
    ]);
    await page.getByText("Manual tour scheduling", { exact: false }).waitFor({
      timeout: 60_000,
    });
    const internalNoteForm = page.locator("form").filter({
      has: page.getByRole("button", { name: "Save note" }),
    });
    await internalNoteForm
      .locator('textarea[name="manualBody"]')
      .fill("Playwright smoke test internal note.");
    await Promise.all([
      page.waitForLoadState("domcontentloaded"),
      internalNoteForm.getByRole("button", { name: "Save note" }).click(),
    ]);

    if (page.url().includes("workflowError=")) {
      throw new Error(`Workflow error present after internal note action: ${page.url()}`);
    }

    await visitPath("/app/calendar", "Tour scheduling");

    await visitPath("/app/properties", "Property operations");
    const firstPropertyLink = page.locator('a[href^="/app/properties/"]').first();
    const firstPropertyHref = await firstPropertyLink.getAttribute("href");

    if (!firstPropertyHref) {
      throw new Error("Could not find a property detail link on /app/properties.");
    }

    await visitPath(firstPropertyHref, "Property summary");
    const propertyRulesHref = `${firstPropertyHref}/rules`;
    await visitPath(propertyRulesHref, "Scheduling handoff");

    await Promise.all([
      page.waitForURL((url) => url.pathname.startsWith("/login"), {
        timeout: 120_000,
        waitUntil: "domcontentloaded",
      }),
      page.getByRole("button", { name: "Sign out" }).click(),
    ]);
    await page.getByText("Operator access", { exact: false }).waitFor({
      timeout: 45_000,
    });
  } finally {
    await browser.close();
  }

  if (failures.length > 0) {
    writeFileSync("smoke-fails.json", JSON.stringify(failures, null, 2));
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
