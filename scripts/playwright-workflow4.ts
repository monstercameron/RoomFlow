import "dotenv/config";
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { auth } from "../src/lib/auth";
import { prisma } from "../src/lib/prisma";
import { activeWorkspaceCookieName, ensureWorkspaceForUser } from "../src/lib/workspaces";

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

async function createWorkflow4Fixture(email: string, options?: { onboardingComplete?: boolean }) {
  await cleanupUserByEmail(email);

  await auth.api.signUpEmail({
    body: {
      email,
      name: "Workflow 4 Operator",
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
    email: user.email,
    id: user.id,
    name: user.name,
  });

  await prisma.workspace.update({
    where: { id: workspace.id },
    data: {
      onboardingCompletedAt: options?.onboardingComplete ? new Date() : null,
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
    page.locator("form").evaluate((form: HTMLFormElement) => {
      form.requestSubmit();
    }),
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
  const onboardingEmail = randomEmail("workflow4-onboarding");
  const mobileEmail = randomEmail("workflow4-mobile");
  const [onboardingFixture, mobileFixture] = await Promise.all([
    createWorkflow4Fixture(onboardingEmail),
    createWorkflow4Fixture(mobileEmail, { onboardingComplete: true }),
  ]);

  const browser = await chromium.launch({ headless: true });

  try {
    await withScenario(browser, failures, "workflow4-onboarding-builder", async (context) => {
      const page = await context.newPage();
      await login(page, onboardingEmail);
      await context.addCookies([
        {
          name: activeWorkspaceCookieName,
          value: onboardingFixture.workspaceId,
          url: BASE_URL,
        },
      ]);
      await page.goto(buildUrl("/onboarding/questions"), {
        waitUntil: "domcontentloaded",
        timeout: 120_000,
      });

      await page.getByRole("heading", { name: "Shape the qualification questions" }).waitFor();
      await page.getByText("Step 3 of 5", { exact: false }).waitFor();

      const offOptions = page.locator('input[name^="questionStatus-"][value="off"]');
      const offOptionCount = await offOptions.count();

      for (let index = 0; index < offOptionCount; index += 1) {
        await offOptions.nth(index).check({ force: true });
      }

      await submitCurrentForm(page);
      await page.waitForURL(/\/onboarding\/questions\?/);
      await page.getByText("Turn on at least one question before continuing.", { exact: false }).waitFor();

      await page.locator('input[name="questionStatus-0"][value="required"]').check({ force: true });
      await page.locator('input[name="questionStatus-1"][value="required"]').check({ force: true });
      await page.getByRole("button", { name: "Add question" }).click();
      await page.locator('input[name^="questionLabel-"]').last().fill("Which room setup do you prefer?");
      await page.locator('select[name^="questionType-"]').last().selectOption("SELECT");
      await page.locator('textarea[name^="questionOptions-"]').last().fill("Private room\nShared room");
      await page.locator('input[name^="questionStatus-"][value="optional"]').last().check({ force: true });
      await submitCurrentForm(page);

      await page.waitForURL(/\/onboarding\/channels/, { timeout: 120_000 });
      await page.getByText("Step 4 of 5", { exact: false }).waitFor();

      const activeQuestionSet = await prisma.qualificationQuestionSet.findFirst({
        where: {
          propertyId: onboardingFixture.propertyId,
          isDefault: true,
        },
        include: {
          questions: {
            orderBy: {
              sortOrder: "asc",
            },
          },
        },
      });

      assert(activeQuestionSet);
      assert.equal(activeQuestionSet.questions.length, 3);
      assert.equal(activeQuestionSet.questions[0]?.fieldKey, "moveInDate");
      assert.equal(activeQuestionSet.questions[2]?.type, "SELECT");
    });

    await withScenario(browser, failures, "workflow4-property-editor-mobile", async (context) => {
      const page = await context.newPage();
      await login(page, mobileEmail);
      await context.addCookies([
        {
          name: activeWorkspaceCookieName,
          value: mobileFixture.workspaceId,
          url: BASE_URL,
        },
      ]);
      await page.goto(buildUrl(`/app/properties/${mobileFixture.propertyId}/questions`), {
        waitUntil: "domcontentloaded",
        timeout: 120_000,
      });

      await page.getByText("Live intake", { exact: true }).waitFor();
      const offOptions = page.locator('input[name^="questionStatus-"][value="off"]');
      const offOptionCount = await offOptions.count();

      for (let index = 0; index < offOptionCount; index += 1) {
        await offOptions.nth(index).check({ force: true });
      }

      await page.getByRole("button", { name: "Add question" }).click();
      await page.locator('input[name^="questionLabel-"]').last().fill("Do you need extra storage?");
      await page.locator('input[name="questionStatus-0"][value="required"]').check({ force: true });
      await page.locator('input[name="questionStatus-1"][value="required"]').check({ force: true });
      await page.locator('input[name^="questionStatus-"][value="optional"]').last().check({ force: true });
      await Promise.all([
        page.waitForNavigation({ timeout: 120_000, waitUntil: "domcontentloaded" }),
        page.getByRole("button", { name: "Save question set" }).evaluate((button) => {
          (button as HTMLButtonElement).form?.requestSubmit();
        }),
      ]);
      await page.waitForLoadState("networkidle", { timeout: 120_000 });

      const activeQuestionSet = await prisma.qualificationQuestionSet.findFirst({
        where: {
          propertyId: mobileFixture.propertyId,
          isDefault: true,
        },
        include: {
          questions: true,
        },
      });

      const alertText = await page
        .getByRole("alert")
        .first()
        .textContent()
        .catch(() => null);

      assert(
        activeQuestionSet,
        `Expected an active question set after save. URL: ${page.url()}${alertText ? ` | alert: ${alertText}` : ""}`,
      );
      assert.equal(activeQuestionSet.questions.length, 3);
    }, { isMobile: true });
  } finally {
    await browser.close();
    await cleanupUserByEmail(onboardingEmail);
    await cleanupUserByEmail(mobileEmail);
  }

  if (failures.length > 0) {
    const output = failures
      .map((failure) => `[${failure.scenario}] ${failure.message}`)
      .join("\n\n");
    writeFileSync("workflow4-playwright-failures.txt", output);
    throw new Error(output);
  }

  writeFileSync(
    "workflow4-playwright-failures.txt",
    "Workflow 4 Playwright checks passed.\n",
  );
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});