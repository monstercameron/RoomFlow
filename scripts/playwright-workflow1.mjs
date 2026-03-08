import { writeFileSync } from "node:fs";
import { chromium } from "playwright";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3001";

async function withTrackedPage(context, callback) {
  const page = await context.newPage();
  const failures = [];

  page.on("pageerror", (error) => {
    failures.push({ type: "pageerror", message: error.message });
  });

  page.on("console", (message) => {
    if (message.type() === "error") {
      failures.push({ type: "console", message: message.text() });
    }
  });

  page.on("response", (response) => {
    if (response.status() >= 500) {
      failures.push({ type: "response", status: response.status(), url: response.url() });
    }
  });

  try {
    await callback(page);
  } finally {
    await page.close();
  }

  return failures;
}

async function visit(page, pathname) {
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
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const failures = [];

  try {
    const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 960 } });

    failures.push(
      ...(await withTrackedPage(desktopContext, async (page) => {
        await visit(page, "/signup");
        await page.getByRole("heading", { name: "Create your Roomflow account" }).waitFor();
        await page.getByLabel("Name").waitFor();
        await page.getByLabel("Email").waitFor();
        await page.getByLabel("Password").waitFor();
        await page.getByLabel("Confirm password").waitFor();
        await page.getByText("Password checkpoint", { exact: false }).waitFor();
      })),
    );

    failures.push(
      ...(await withTrackedPage(desktopContext, async (page) => {
        await visit(page, "/signup?plan=org&source=ai-tool&utm_campaign=launch-week");
        await page.getByText("Org workspace", { exact: false }).waitFor();
        await page.getByText("Source: ai-tool", { exact: false }).waitFor();
        await page.getByText("Campaign: launch-week", { exact: false }).waitFor();
      })),
    );

    failures.push(
      ...(await withTrackedPage(desktopContext, async (page) => {
        await visit(page, "/signup?invite=invite-token-123");
        await page.getByText("Workspace invite", { exact: false }).waitFor();
        await page.getByText("Create the account tied to your invite.", { exact: false }).waitFor();
      })),
    );

    failures.push(
      ...(await withTrackedPage(desktopContext, async (page) => {
        await visit(page, "/signup");
        await page.getByLabel("Name").fill("Alex Rivera");
        await page.getByLabel("Email").fill("alex@roomflow.app");
        await page.getByLabel("Password").fill("short");
        await page.getByLabel("Confirm password").fill("different");
        await page.getByRole("button", { name: "Create account" }).click();
        await page.getByText("Use at least 10 characters", { exact: false }).waitFor();
        await page.getByText("Passwords do not match yet.", { exact: false }).waitFor();
      })),
    );

    await desktopContext.close();

    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    });

    failures.push(
      ...(await withTrackedPage(mobileContext, async (page) => {
        await visit(page, "/signup");
        await page.getByRole("heading", { name: "Create your Roomflow account" }).waitFor();
        const nameBox = page.getByLabel("Name");
        const box = await nameBox.boundingBox();

        if (!box || box.width < 250) {
          throw new Error("Mobile signup input did not render at a usable width.");
        }
      })),
    );

    await mobileContext.close();
  } finally {
    await browser.close();
  }

  if (failures.length > 0) {
    writeFileSync("workflow1-fails.json", JSON.stringify(failures, null, 2));
    throw new Error(
      `Workflow 1 Playwright checks hit ${failures.length} runtime issue(s):\n${JSON.stringify(failures, null, 2)}`,
    );
  }
}

run()
  .then(() => {
    console.log("Workflow 1 Playwright checks passed.");
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });