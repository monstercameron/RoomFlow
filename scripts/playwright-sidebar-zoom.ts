import assert from "node:assert/strict";
import { chromium } from "playwright";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3001";
const LOGIN_EMAIL = process.env.PLAYWRIGHT_LOGIN_EMAIL ?? "test@roomflow.local";
const LOGIN_PASSWORD = process.env.PLAYWRIGHT_LOGIN_PASSWORD ?? "Roomflow123!";

const zoomLevels = [0.8, 1, 1.25, 1.5] as const;

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

async function applyZoom(page: import("playwright").Page, zoomLevel: number) {
  await page.evaluate((nextZoomLevel) => {
    document.documentElement.style.zoom = String(nextZoomLevel);
  }, zoomLevel);
  await page.waitForTimeout(250);
}

async function getLayoutMetrics(page: import("playwright").Page) {
  return page.evaluate(() => {
    const documentElement = document.documentElement;
    const navigation = document.getElementById("app-sidebar-navigation");
    const scrollContainer = document.querySelector<HTMLElement>("[data-app-scroll-container]");

    return {
      clientWidth: documentElement.clientWidth,
      hasHorizontalOverflow: documentElement.scrollWidth > documentElement.clientWidth + 1,
      navigationChildCount: navigation?.children.length ?? 0,
      scrollContainerClientWidth: scrollContainer?.clientWidth ?? 0,
    };
  });
}

async function getSidebarScrollMetrics(page: import("playwright").Page) {
  return page.evaluate(() => {
    const sidebarNavigation = document.querySelector<HTMLElement>(
      "[data-sidebar-nav-scroll-container]",
    );

    if (!sidebarNavigation) {
      return null;
    }

    return {
      clientHeight: sidebarNavigation.clientHeight,
      scrollHeight: sidebarNavigation.scrollHeight,
      scrollTop: sidebarNavigation.scrollTop,
    };
  });
}

async function getSidebarWidth(page: import("playwright").Page) {
  return page.evaluate(() => {
    const sidebar = document.querySelector<HTMLElement>("[data-app-sidebar]");

    return sidebar?.offsetWidth ?? 0;
  });
}

async function scrollSidebarNavigation(page: import("playwright").Page, top: number) {
  await page.evaluate((nextTop) => {
    const sidebarNavigation = document.querySelector<HTMLElement>(
      "[data-sidebar-nav-scroll-container]",
    );

    if (sidebarNavigation) {
      sidebarNavigation.scrollTop = nextTop;
    }
  }, top);
  await page.waitForTimeout(100);
}

async function getElementLayoutWidth(locator: import("playwright").Locator) {
  return locator.evaluate((element) => {
    if (!(element instanceof HTMLElement)) {
      return 0;
    }

    return element.offsetWidth;
  });
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const failures: string[] = [];

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 960 },
    });
    const page = await context.newPage();

    page.on("pageerror", (error) => {
      failures.push(`pageerror: ${error.message}`);
    });

    page.on("console", (message) => {
      if (message.type() === "error") {
        failures.push(`console: ${message.text()}`);
      }
    });

    await login(page);
    await page.goto(`${BASE_URL}/app`, {
      timeout: 120_000,
      waitUntil: "domcontentloaded",
    });
    await page.getByRole("heading", { name: "Operational snapshot" }).waitFor({
      timeout: 45_000,
    });

    const sidebarToggle = page.getByRole("button", { name: "Collapse menu" });
    await sidebarToggle.waitFor({ timeout: 45_000 });

    for (const zoomLevel of zoomLevels) {
      await page.goto(`${BASE_URL}/app`, {
        timeout: 120_000,
        waitUntil: "domcontentloaded",
      });
      await page.getByRole("heading", { name: "Operational snapshot" }).waitFor({
        timeout: 45_000,
      });
      await applyZoom(page, zoomLevel);

      const expandedToggle = page.getByRole("button", { name: "Collapse menu" });
      await expandedToggle.waitFor({ timeout: 45_000 });
      await expectSidebarState({
        page,
        isCollapsed: false,
        zoomLevel,
      });

      await expandedToggle.click();
      await page.getByRole("button", { name: "Expand menu" }).waitFor({ timeout: 45_000 });
      await page.waitForTimeout(350);
      await expectSidebarState({
        page,
        isCollapsed: true,
        zoomLevel,
      });

      await page.getByRole("button", { name: "Expand menu" }).click();
      await page.getByRole("button", { name: "Collapse menu" }).waitFor({ timeout: 45_000 });
      await page.waitForTimeout(350);
      await expectSidebarState({
        page,
        isCollapsed: false,
        zoomLevel,
      });
    }

    await page.setViewportSize({ width: 1440, height: 560 });
    await page.goto(`${BASE_URL}/app`, {
      timeout: 120_000,
      waitUntil: "domcontentloaded",
    });
    await page.getByRole("heading", { name: "Operational snapshot" }).waitFor({
      timeout: 45_000,
    });
    await applyZoom(page, 1.5);
    await expectSidebarState({
      page,
      isCollapsed: false,
      zoomLevel: 1.5,
    });
    await expectSidebarCanScroll(page);

    await Promise.all([
      page.waitForURL((url) => url.pathname.startsWith("/login"), {
        timeout: 120_000,
        waitUntil: "domcontentloaded",
      }),
      page.getByRole("button", { name: "Sign out" }).click(),
    ]);
  } finally {
    await browser.close();
  }

  if (failures.length > 0) {
    throw new Error(failures.join("\n"));
  }
}

async function expectSidebarCanScroll(page: import("playwright").Page) {
  const sidebarScrollMetrics = await getSidebarScrollMetrics(page);

  assert.ok(sidebarScrollMetrics, "Sidebar scroll container was not found.");
  assert.ok(
    sidebarScrollMetrics.scrollHeight > sidebarScrollMetrics.clientHeight,
    `Sidebar nav should overflow vertically in the constrained viewport. clientHeight=${sidebarScrollMetrics.clientHeight}, scrollHeight=${sidebarScrollMetrics.scrollHeight}`,
  );

  const targetScrollTop = Math.max(48, Math.floor(sidebarScrollMetrics.clientHeight / 2));
  await scrollSidebarNavigation(page, targetScrollTop);

  const updatedSidebarScrollMetrics = await getSidebarScrollMetrics(page);
  assert.ok(updatedSidebarScrollMetrics, "Sidebar scroll metrics disappeared after scroll.");
  assert.ok(
    updatedSidebarScrollMetrics.scrollTop > 0,
    `Sidebar nav did not scroll. scrollTop=${updatedSidebarScrollMetrics.scrollTop}`,
  );
}

async function expectSidebarState(params: {
  page: import("playwright").Page;
  isCollapsed: boolean;
  zoomLevel: number;
}) {
  const { isCollapsed, page, zoomLevel } = params;
  const dashboardLink = page.getByRole("link", { name: /Dashboard: Operational snapshot/i });
  const layoutMetrics = await getLayoutMetrics(page);
  const sidebarWidth = await getSidebarWidth(page);

  assert.equal(
    layoutMetrics.navigationChildCount,
    11,
    `Expected 11 sidebar nav items at ${zoomLevel * 100}% zoom.`,
  );
  assert.equal(
    layoutMetrics.hasHorizontalOverflow,
    false,
    `Unexpected horizontal overflow at ${zoomLevel * 100}% zoom.`,
  );
  assert.ok(
    layoutMetrics.scrollContainerClientWidth > 0,
    `Main app scroll container lost width at ${zoomLevel * 100}% zoom.`,
  );

  if (isCollapsed) {
    await dashboardLink.waitFor({ timeout: 45_000 });
    assert.ok(
      sidebarWidth <= 88,
      `Collapsed sidebar stayed too wide at ${zoomLevel * 100}% zoom: ${sidebarWidth}px.`,
    );
    return;
  }

  await dashboardLink.getByText("Dashboard", { exact: true }).waitFor({ timeout: 45_000 });
  assert.ok(
    sidebarWidth >= 240,
    `Expanded sidebar collapsed unexpectedly at ${zoomLevel * 100}% zoom: ${sidebarWidth}px.`,
  );
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});