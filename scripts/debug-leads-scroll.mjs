import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3001";
const LOGIN_EMAIL = process.env.PLAYWRIGHT_LOGIN_EMAIL ?? "test@roomflow.local";
const LOGIN_PASSWORD = process.env.PLAYWRIGHT_LOGIN_PASSWORD ?? "Roomflow123!";
const outputDirectory = join(process.cwd(), "test-results", "leads-scroll-debug");

mkdirSync(outputDirectory, { recursive: true });

async function login(page) {
  await page.goto(`${BASE_URL}/login`, {
    timeout: 120000,
    waitUntil: "domcontentloaded",
  });
  await page.getByText("Operator access", { exact: false }).waitFor({ timeout: 45000 });
  await page.getByLabel("Email").fill(LOGIN_EMAIL);
  await page.getByLabel("Password").fill(LOGIN_PASSWORD);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith("/login"), {
      timeout: 120000,
      waitUntil: "domcontentloaded",
    }),
    page.getByRole("button", { name: "Log in" }).click(),
  ]);

  if (page.url().includes("/onboarding")) {
    await page.goto(`${BASE_URL}/app`, {
      timeout: 120000,
      waitUntil: "domcontentloaded",
    });
  }
}

async function captureState(page, label) {
  const metrics = await page.evaluate(() => {
    const workspaceHeader = document.querySelector("div.mb-6.flex.items-center.justify-between.rounded-3xl");
    const scrollContainer = document.querySelector("[data-app-scroll-container]");
    const headings = document.querySelectorAll("h1");
    let qualificationHeading = null;

    for (const heading of headings) {
      if (heading.textContent && heading.textContent.includes("Qualification queue")) {
        qualificationHeading = heading;
        break;
      }
    }

    const tableHeaders = document.querySelectorAll("th");
    let tableHeaderCell = null;

    for (const tableHeader of tableHeaders) {
      if (tableHeader.textContent && tableHeader.textContent.includes("Lead")) {
        tableHeaderCell = tableHeader;
        break;
      }
    }

    function rect(node) {
      if (!node) {
        return null;
      }

      const box = node.getBoundingClientRect();
      return {
        top: box.top,
        bottom: box.bottom,
        left: box.left,
        right: box.right,
        height: box.height,
      };
    }

    return {
      documentScrollTop: document.documentElement.scrollTop,
      location: window.location.href,
      qualificationHeading: rect(qualificationHeading),
      scrollContainer: scrollContainer
        ? {
            clientHeight: scrollContainer.clientHeight,
            scrollHeight: scrollContainer.scrollHeight,
            scrollTop: scrollContainer.scrollTop,
          }
        : null,
      tableHeaderCell: rect(tableHeaderCell),
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      workspaceHeader: rect(workspaceHeader),
    };
  });

  writeFileSync(join(outputDirectory, `${label}.json`), `${JSON.stringify(metrics, null, 2)}\n`);
  await page.screenshot({
    fullPage: false,
    path: join(outputDirectory, `${label}.png`),
  });
}

async function run() {
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      viewport: {
        width: 1600,
        height: 960,
      },
    });
    const page = await context.newPage();

    await login(page);
    await page.goto(`${BASE_URL}/app/leads?pageSize=25`, {
      timeout: 120000,
      waitUntil: "domcontentloaded",
    });
    await page.getByRole("heading", { name: "Qualification queue" }).waitFor({ timeout: 45000 });

    await captureState(page, "state-0-top");

    await page.evaluate(() => {
      const scrollContainer = document.querySelector("[data-app-scroll-container]");
      if (scrollContainer) {
        scrollContainer.scrollTo({ top: 220, behavior: "auto" });
      }
    });
    await page.waitForTimeout(300);
    await captureState(page, "state-1-after-small-scroll");

    await page.evaluate(() => {
      const scrollContainer = document.querySelector("[data-app-scroll-container]");
      if (scrollContainer) {
        scrollContainer.scrollTo({ top: 820, behavior: "auto" });
      }
    });
    await page.waitForTimeout(300);
    await captureState(page, "state-2-after-deep-scroll");

    await context.close();
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
