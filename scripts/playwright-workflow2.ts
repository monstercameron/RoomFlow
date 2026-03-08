import "dotenv/config";
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { auth } from "../src/lib/auth";
import { prisma } from "../src/lib/prisma";
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

async function createWorkflow2Fixture(
  email: string,
  options?: {
    onboardingCompleted?: boolean;
  },
) {
  await cleanupUserByEmail(email);

  await auth.api.signUpEmail({
    body: {
      email,
      name: "Workflow 2 Operator",
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
      onboardingCompletedAt: options?.onboardingCompleted ? new Date() : null,
    },
  });

  await prisma.property.deleteMany({
    where: {
      workspaceId: workspace.id,
    },
  });

  await prisma.leadSource.deleteMany({
    where: {
      workspaceId: workspace.id,
    },
  });

  return {
    userId: user.id,
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

async function submitPropertyForm(page: Page) {
  await page.locator("form").evaluate((form: HTMLFormElement) => {
    form.requestSubmit();
  });
}

async function run() {
  const failures: FailureRecord[] = [];
  const dashboardEmail = randomEmail("workflow2-dashboard");
  const validationEmail = randomEmail("workflow2-validation");

  const [, validationFixture] = await Promise.all([
    createWorkflow2Fixture(dashboardEmail, { onboardingCompleted: true }),
    createWorkflow2Fixture(validationEmail),
  ]);

  const browser = await chromium.launch({ headless: true });

  try {
    await withScenario(browser, failures, "dashboard-no-property-recovery", async (context) => {
      const page = await context.newPage();
      await login(page, dashboardEmail);
      await page.goto(buildUrl("/app"), { waitUntil: "domcontentloaded", timeout: 120_000 });
      await page.getByRole("heading", { name: "Create your first property" }).waitFor();
      await page.getByRole("link", { name: "Create property" }).waitFor();
      await page.goto(buildUrl("/app/properties"), { waitUntil: "domcontentloaded", timeout: 120_000 });
      await page.getByText("Create your first property to start qualifying leads.", { exact: false }).waitFor();
    });

    await withScenario(browser, failures, "property-onboarding-validation-and-persistence", async (context) => {
      const page = await context.newPage();
      await login(page, validationEmail);
      await page.goto(buildUrl("/onboarding/property"), { waitUntil: "domcontentloaded", timeout: 120_000 });
      await page.getByRole("heading", { name: "Set up your first property" }).waitFor();
      await page.getByText("Step 1 of 5", { exact: false }).waitFor();
      await page.getByText("This gives Roomflow the context it needs to qualify leads", { exact: false }).waitFor();

      const focusedName = await page.evaluate(
        () => (document.activeElement as HTMLInputElement | null)?.getAttribute("name"),
      );
      assert.equal(focusedName, "name");

      const propertyTypeRadioCount = await page.locator('input[name="propertyType"]').count();
      assert.equal(propertyTypeRadioCount, 4);
      assert.equal(await page.getByLabel("Property name").inputValue(), "My First Property");
      assert.equal(
        await page.locator('input[name="propertyType"]:checked').inputValue(),
        "Owner-occupied shared home",
      );

      await page.getByLabel("Property name").fill("");
      await page.getByLabel("City, neighborhood, or address").fill("Providence, RI");
      await page.getByLabel("Rentable rooms").fill("0");
      await submitPropertyForm(page);
      await page.waitForURL(/\/onboarding\/property\?/);
      await page.getByText("Please add a property name.", { exact: false }).waitFor();
      assert.equal(await page.getByLabel("City, neighborhood, or address").inputValue(), "Providence, RI");
      assert.equal(await page.getByLabel("Rentable rooms").inputValue(), "0");

      await page.getByLabel("Property name").fill("Maple House");
      await page.locator('input[name="propertyType"]').evaluateAll((elements) => {
        for (const element of elements as HTMLInputElement[]) {
          element.checked = false;
        }
      });
      await submitPropertyForm(page);
      await page.waitForURL(/\/onboarding\/property\?/);
      await page.getByText("Please choose a property type.", { exact: false }).waitFor();

      await page.locator('input[name="propertyType"][value="Small co-living property"]').check({ force: true });
      await page.getByLabel("City, neighborhood, or address").fill("");
      await submitPropertyForm(page);
      await page.waitForURL(/\/onboarding\/property\?/);
      await page.getByText("Please add a city, area, or address.", { exact: false }).waitFor();

      await page.getByLabel("City, neighborhood, or address").fill("Providence, RI");
      await page.getByLabel("Rentable rooms").fill("0");
      await submitPropertyForm(page);
      await page.waitForURL(/\/onboarding\/property\?/);
      await page.getByText("Please enter at least 1 rentable room.", { exact: false }).waitFor();

      await page.getByText("Street address", { exact: false }).waitFor();
      await page.getByText("Shared bathroom count", { exact: false }).waitFor();
      assert.equal(await page.getByText("Rent amount", { exact: false }).count(), 0);
      assert.equal(await page.getByText("Utilities", { exact: false }).count(), 0);
      assert.equal(await page.getByText("Photos", { exact: false }).count(), 0);
      assert.equal(await page.getByText("Compliance", { exact: false }).count(), 0);

      await page.setViewportSize({ width: 390, height: 844 });
      const nameBox = await page.getByLabel("Property name").boundingBox();
      if (!nameBox || nameBox.width < 250) {
        throw new Error("Mobile property name input did not render at a usable width.");
      }

      const propertyTypeCard = page.getByText("Owner-occupied shared home", { exact: false }).first();
      const propertyTypeCardBox = await propertyTypeCard.boundingBox();
      if (!propertyTypeCardBox || propertyTypeCardBox.width < 200) {
        throw new Error("Mobile property type control did not render at a usable width.");
      }

      await page.setViewportSize({ width: 1440, height: 960 });

      await page.getByLabel("Property name").fill("Maple House");
      await page.locator('input[name="propertyType"][value="Non-owner-occupied shared home"]').check({ force: true });
      await page.getByLabel("Street address").fill("18 Maple Ave");
      await page.getByLabel("City, neighborhood, or address").fill("Providence, RI");
      await page.getByLabel("Rentable rooms").fill("4");
      await page.getByLabel("Shared bathroom count").fill("2");
      await page.getByLabel("Scheduling link").fill("https://calendar.example.com/tour");
      await page.getByRole("checkbox", { name: "Parking available" }).check();
      await submitPropertyForm(page);
      await page.waitForURL(/\/onboarding\/house-rules/, { timeout: 120_000 });
      await page.getByRole("heading", { name: "Define the rule set" }).waitFor();

      const createdProperty = await prisma.property.findFirst({
        where: {
          workspaceId: validationFixture.workspaceId,
        },
        include: {
          settings: true,
        },
      });

      assert.equal(createdProperty?.name, "Maple House");
      assert.equal(createdProperty?.propertyType, "Non-owner-occupied shared home");
      assert.equal(createdProperty?.locality, "Providence, RI");
      assert.equal(createdProperty?.addressLine1, "18 Maple Ave");
      assert.equal(createdProperty?.schedulingUrl, "https://calendar.example.com/tour");
      assert.equal(createdProperty?.settings?.qualificationEnabled, true);
      assert.equal(createdProperty?.settings?.defaultChannelPreference, "EMAIL");

      const workflow2Artifacts = await prisma.auditEvent.findMany({
        where: {
          workspaceId: validationFixture.workspaceId,
          propertyId: createdProperty?.id,
          eventType: "ai_artifact_generated",
        },
      });
      assert.equal(workflow2Artifacts.length, 2);

      await prisma.workspace.update({
        where: {
          id: validationFixture.workspaceId,
        },
        data: {
          onboardingCompletedAt: new Date(),
        },
      });

      await page.goto(buildUrl("/app/properties"), { waitUntil: "domcontentloaded", timeout: 120_000 });
      await page.getByText("Maple House", { exact: false }).waitFor();
      await page.getByText("Non-owner-occupied shared home • Providence, RI • 18 Maple Ave", { exact: false }).waitFor();
      await page.getByText("Scheduling link configured and enabled", { exact: false }).waitFor();
      await page.getByText("Available", { exact: false }).waitFor();
    });
  } finally {
    await browser.close();
  }

  if (failures.length > 0) {
    writeFileSync("workflow2-fails.json", JSON.stringify(failures, null, 2));
    throw new Error(`Workflow 2 Playwright checks hit ${failures.length} issue(s). See workflow2-fails.json.`);
  }
}

run()
  .then(() => {
    console.log("Workflow 2 Playwright checks passed.");
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });