import "dotenv/config";
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { auth } from "../src/lib/auth";
import { prisma } from "../src/lib/prisma";
import { activeWorkspaceCookieName } from "../src/lib/workspaces";
import { ensureWorkspaceForUser } from "../src/lib/workspaces";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3001";
const TEST_PASSWORD = "Roomflow123!";

type FailureRecord = {
  message: string;
  scenario: string;
};

function randomEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${randomBytes(3).toString("hex")}@roomflow.local`;
}

function buildUrl(pathname: string) {
  return new URL(pathname, BASE_URL).toString();
}

async function cleanupUserByEmail(email: string) {
  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      billingOwnedWorkspaces: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!existingUser) {
    return;
  }

  const ownedWorkspaceIds = existingUser.billingOwnedWorkspaces.map((workspace) => workspace.id);

  if (ownedWorkspaceIds.length > 0) {
    await prisma.workspace.deleteMany({
      where: {
        id: {
          in: ownedWorkspaceIds,
        },
      },
    });
  }

  await prisma.user.delete({ where: { email } });
}

async function createWorkflow3Fixture(email: string) {
  await cleanupUserByEmail(email);

  await auth.api.signUpEmail({
    body: {
      email,
      name: "Workflow 3 Operator",
      password: TEST_PASSWORD,
    },
  });

  const user = await prisma.user.update({
    where: { email },
    data: {
      emailVerified: true,
    },
  });

  const workspace = await ensureWorkspaceForUser({
    id: user.id,
    email: user.email,
    name: user.name,
  });

  await prisma.workspace.update({
    where: { id: workspace.id },
    data: {
      onboardingCompletedAt: null,
    },
  });

  await prisma.property.deleteMany({
    where: {
      workspaceId: workspace.id,
    },
  });

  const property = await prisma.property.create({
    data: {
      addressLine1: "18 Maple Ave",
      locality: "Providence, RI",
      name: "Maple House",
      parkingAvailable: false,
      petsAllowed: false,
      propertyType: "Owner-occupied shared home",
      rentableRoomCount: 4,
      sharedBathroomCount: 1,
      smokingAllowed: false,
      workspaceId: workspace.id,
    },
  });

  return {
    propertyId: property.id,
    workspaceId: workspace.id,
  };
}

async function login(page: Page, email: string) {
  await page.goto(buildUrl("/login"), { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(TEST_PASSWORD);
  await Promise.all([
    page.waitForURL(/\/(onboarding|app)/, { timeout: 120_000, waitUntil: "domcontentloaded" }),
    page.getByRole("button", { name: "Log in" }).click(),
  ]);
}

async function withScenario(
  browser: Browser,
  failures: FailureRecord[],
  scenario: string,
  callback: (context: BrowserContext) => Promise<void>,
  options?: {
    isMobile?: boolean;
  },
) {
  const context = await browser.newContext(
    options?.isMobile
      ? {
          viewport: { width: 390, height: 844 },
          userAgent:
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        }
      : {
          viewport: { width: 1440, height: 960 },
        },
  );

  context.on("page", (page) => {
    page.on("pageerror", (error) => {
      failures.push({ message: `pageerror: ${error.message}`, scenario });
    });
    page.on("response", (response) => {
      if (response.status() >= 500) {
        failures.push({ message: `HTTP ${response.status()} on ${response.url()}`, scenario });
      }
    });
  });

  try {
    await callback(context);
  } catch (error) {
    failures.push({
      message: error instanceof Error ? error.stack ?? error.message : String(error),
      scenario,
    });
  } finally {
    await context.close();
  }
}

async function submitCurrentForm(page: Page) {
  await page.locator("form").evaluate((form: HTMLFormElement) => {
    form.requestSubmit();
  });
}

async function run() {
  const failures: FailureRecord[] = [];
  const onboardingEmail = randomEmail("workflow3-onboarding");
  const mobileEmail = randomEmail("workflow3-mobile");

  const [onboardingFixture, mobileFixture] = await Promise.all([
    createWorkflow3Fixture(onboardingEmail),
    createWorkflow3Fixture(mobileEmail),
  ]);

  const browser = await chromium.launch({ headless: true });

  try {
    await withScenario(browser, failures, "workflow3-house-rules-to-questions", async (context) => {
      const page = await context.newPage();
      await login(page, onboardingEmail);
      await context.addCookies([
        {
          name: activeWorkspaceCookieName,
          value: onboardingFixture.workspaceId,
          url: BASE_URL,
        },
      ]);
      await page.goto(buildUrl("/onboarding/house-rules"), {
        waitUntil: "domcontentloaded",
        timeout: 120_000,
      });

      await page.getByRole("heading", { name: "Define the house rules" }).waitFor();
      await page.getByText("Step 2 of 5", { exact: false }).waitFor();
      await page.getByText("Qualification impact at a glance", { exact: false }).waitFor();

      const enabledCheckboxes = page.locator('input[type="checkbox"][name$="Enabled"]');
      const enabledCount = await enabledCheckboxes.count();
      for (let index = 0; index < enabledCount; index += 1) {
        if (await enabledCheckboxes.nth(index).isChecked()) {
          await enabledCheckboxes.nth(index).uncheck();
        }
      }

      await submitCurrentForm(page);
      await page.waitForURL(/\/onboarding\/house-rules\?/);
      await page.getByText(
        "Add at least one house rule or custom expectation before continuing.",
        { exact: false },
      ).waitFor();

      await page.getByRole("checkbox", { name: "Use this rule" }).first().check();
      await page.locator('input[name="smokingValue"][value="not_allowed"]').check({ force: true });
      await page.locator('input[name="smokingSeverity"][value="blocking"]').check({ force: true });
      await page.locator('input[name="guestsEnabled"]').check();
      await page.locator('input[name="guestsValue"][value="limited_overnight"]').check({ force: true });
      await page.locator('input[name="guestsSeverity"][value="warning"]').check({ force: true });
      await page.getByRole("button", { name: "Add custom rule" }).click();
      await page.locator('input[name="customTitle-0"]').fill("No parties after midnight");
      await page
        .locator('textarea[name="customDescription-0"]')
        .fill("Late-night parties create issues with neighbors in this house.");
      await page.locator('input[name="customSeverity-0"][value="warning"]').check({ force: true });
      await submitCurrentForm(page);

      await page.waitForURL(/\/onboarding\/questions/, { timeout: 120_000 });
      await page.getByRole("heading", { name: "Review the starter qualification questions" }).waitFor();
      await page.getByText("Maple House starter intake", { exact: false }).waitFor();
      await page.getByRole("button", { name: "Apply starter questions" }).click();
      await page.getByText("Active question set", { exact: false }).waitFor();
      await page.getByRole("link", { name: "Continue to channels" }).click();
      await page.waitForURL(/\/onboarding\/channels/, { timeout: 120_000 });
      await page.getByText("Step 4 of 5", { exact: false }).waitFor();

      const savedRules = await prisma.propertyRule.findMany({
        where: {
          propertyId: onboardingFixture.propertyId,
        },
      });
      const questionSets = await prisma.qualificationQuestionSet.findMany({
        where: {
          propertyId: onboardingFixture.propertyId,
        },
        include: {
          questions: true,
        },
      });

      assert.ok(savedRules.length >= 3);
      assert.ok(savedRules.some((rule) => rule.label === "No parties after midnight"));
      assert.ok(questionSets.length >= 1);
      assert.ok(questionSets[0]?.questions.length >= 3);
    });

    await withScenario(
      browser,
      failures,
      "workflow3-mobile-layout",
      async (context) => {
        const page = await context.newPage();
        await login(page, mobileEmail);
        await context.addCookies([
          {
            name: activeWorkspaceCookieName,
            value: mobileFixture.workspaceId,
            url: BASE_URL,
          },
        ]);
        await page.goto(buildUrl("/onboarding/house-rules"), {
          waitUntil: "domcontentloaded",
          timeout: 120_000,
        });

        const firstCardBox = await page
          .getByRole("heading", { name: "Smoking" })
          .locator("..").locator("..").boundingBox();
        const summaryBox = await page.getByText("Qualification impact at a glance", { exact: false }).boundingBox();

        if (!firstCardBox || firstCardBox.width < 250) {
          throw new Error("Mobile house-rule cards did not render at a usable width.");
        }

        if (!summaryBox || summaryBox.width < 200) {
          throw new Error("Mobile summary panel did not render at a usable width.");
        }
      },
      { isMobile: true },
    );
  } finally {
    await browser.close();
  }

  if (failures.length > 0) {
    writeFileSync("workflow3-fails.json", JSON.stringify(failures, null, 2));
    throw new Error(`Workflow 3 Playwright checks hit ${failures.length} issue(s). See workflow3-fails.json.`);
  }
}

run()
  .then(() => {
    console.log("Workflow 3 Playwright checks passed.");
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });