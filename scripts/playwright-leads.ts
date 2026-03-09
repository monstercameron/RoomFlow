import assert from "node:assert/strict";
import { chromium } from "playwright";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3001";
const LOGIN_EMAIL = process.env.PLAYWRIGHT_LOGIN_EMAIL ?? "test@roomflow.local";
const LOGIN_PASSWORD = process.env.PLAYWRIGHT_LOGIN_PASSWORD ?? "Roomflow123!";

const SEEDED_LEADS = {
  applicationSent: "Jordan Kim",
  archivedCandidate: "Playwright Lead",
  incomplete: "Casey Nguyen",
  mismatch: "Samira Ali",
  qualified: "Avery Mason",
  unassigned: "Morgan Lee",
} as const;

const INBOX_QUEUE_LINKS = {
  mismatch: "Mismatch",
  review: "Review queue",
  unassigned: "Unassigned",
} as const;

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

async function createLead(
  page: import("playwright").Page,
  index: number,
  propertyLabel = "Maple House",
) {
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
  if (propertyLabel.length > 0) {
    await page.selectOption('select[name="propertyId"]', { label: propertyLabel });
  }
  await page.getByRole("spinbutton", { name: "Monthly budget" }).fill(
    String(1200 + index),
  );
  await page.getByRole("textbox", { name: "Operator notes" }).fill(
    `Created by Playwright ${suffix}`,
  );
  await Promise.all([
    page.getByRole("button", { name: "Create lead" }).click(),
    page.waitForURL(
      (url) =>
        url.pathname.startsWith("/app/leads/") && url.pathname !== "/app/leads/new",
      {
        timeout: 120_000,
        waitUntil: "domcontentloaded",
      },
    ),
  ]);

  await page.getByText(fullName, { exact: false }).waitFor({ timeout: 45_000 });
  const leadIdMatch = page.url().match(/\/app\/leads\/([^/?#]+)/);
  assert.ok(leadIdMatch, `Expected lead detail URL after create, received ${page.url()}`);

  return { email, fullName, id: leadIdMatch[1] };
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
    const createdUnassignedLead = await createLead(desktopPage, 2, "");

    console.log("Checking leads list header and import deep-link...");

    await desktopPage.goto(`${BASE_URL}/app/leads`, {
      timeout: 120_000,
      waitUntil: "domcontentloaded",
    });
    await desktopPage.getByRole("heading", { name: "Qualification queue" }).waitFor({
      timeout: 45_000,
    });
    await desktopPage.getByRole("link", { name: "Import leads" }).click();
    await desktopPage.waitForURL(/\/app\/settings\/integrations#csv-import$/, {
      timeout: 45_000,
      waitUntil: "domcontentloaded",
    });
    await desktopPage.locator("#csv-import").waitFor({ timeout: 45_000 });

    console.log("Checking search, back-link preservation, sorting, and pagination...");

    await desktopPage.goto(`${BASE_URL}/app/leads`, {
      timeout: 120_000,
      waitUntil: "domcontentloaded",
    });
    await desktopPage.getByRole("heading", { name: "Qualification queue" }).waitFor({
      timeout: 45_000,
    });

    await desktopPage.getByRole("searchbox").fill(createdLead.fullName);
    await desktopPage.getByRole("button", { name: "Apply" }).click();
    await getVisibleLeadLink(desktopPage, createdLead.fullName).waitFor({
      timeout: 45_000,
    });
    await getVisibleLeadLink(desktopPage, createdLead.fullName).click();
    await desktopPage.waitForURL(
      (url) =>
        url.pathname === `/app/leads/${createdLead.id}` &&
        url.searchParams.get("q") === createdLead.fullName,
      {
        timeout: 45_000,
        waitUntil: "domcontentloaded",
      },
    );
    await desktopPage.getByRole("link", { name: "Back to leads" }).click();
    await desktopPage.waitForURL(
      (url) =>
        url.pathname === "/app/leads" && url.searchParams.get("q") === createdLead.fullName,
      {
        timeout: 45_000,
        waitUntil: "domcontentloaded",
      },
    );
    await assertSearchValue(desktopPage, createdLead.fullName);

    await desktopPage.selectOption('select[name="sort"]', "name-asc");
    await desktopPage.getByRole("button", { name: "Apply" }).click();
    await desktopPage.waitForURL(/sort=name-asc/, { timeout: 45_000 });

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

    const authenticatedStorageState = await desktopContext.storageState();

    console.log("Checking list filters across property, status, fit, and source...");

    await desktopPage.goto(`${BASE_URL}/app/leads`, {
      timeout: 120_000,
      waitUntil: "domcontentloaded",
    });
    await desktopPage.selectOption('select[name="property"]', { label: "Maple House" });
    await desktopPage.getByRole("button", { name: "Apply" }).click();
    await getVisibleLeadLink(desktopPage, createdLead.fullName).waitFor({
      timeout: 45_000,
    });
    await assertLeadAbsent(desktopPage, SEEDED_LEADS.mismatch);

    await desktopPage.goto(`${BASE_URL}/app/leads`, {
      timeout: 120_000,
      waitUntil: "domcontentloaded",
    });
    await desktopPage.selectOption('select[name="status"]', "INCOMPLETE");
    await desktopPage.getByRole("button", { name: "Apply" }).click();
    await getVisibleLeadLink(desktopPage, SEEDED_LEADS.incomplete).waitFor({
      timeout: 45_000,
    });
    await assertLeadAbsent(desktopPage, SEEDED_LEADS.qualified);

    await desktopPage.goto(`${BASE_URL}/app/leads`, {
      timeout: 120_000,
      waitUntil: "domcontentloaded",
    });
    await desktopPage.selectOption('select[name="fit"]', "MISMATCH");
    await desktopPage.getByRole("button", { name: "Apply" }).click();
    await getVisibleLeadLink(desktopPage, SEEDED_LEADS.mismatch).waitFor({
      timeout: 45_000,
    });
    await assertLeadAbsent(desktopPage, SEEDED_LEADS.qualified);

    await desktopPage.goto(`${BASE_URL}/app/leads`, {
      timeout: 120_000,
      waitUntil: "domcontentloaded",
    });
    await desktopPage.selectOption('select[name="source"]', { label: "Manual intake" });
    await desktopPage.getByRole("button", { name: "Apply" }).click();
    await getVisibleLeadLink(desktopPage, createdLead.fullName).waitFor({
      timeout: 45_000,
    });
    await assertLeadAbsent(desktopPage, SEEDED_LEADS.mismatch);

    await desktopPage.getByRole("link", { name: "Reset" }).click();
    await desktopPage.waitForURL(
      (url) => url.pathname === "/app/leads" && url.search.length === 0,
      {
        timeout: 45_000,
        waitUntil: "domcontentloaded",
      },
    );
    await assertSearchValue(desktopPage, "");

    console.log("Checking row-level Workflow 7 indicators...");

    await desktopPage.goto(`${BASE_URL}/app/leads?q=${encodeURIComponent(createdLead.fullName)}`, {
      timeout: 120_000,
      waitUntil: "domcontentloaded",
    });
    const createdLeadRow = desktopPage
      .locator("tr")
      .filter({ has: getVisibleLeadLink(desktopPage, createdLead.fullName) })
      .first();
    await createdLeadRow.getByText(/Ask missing questions/i).first().waitFor({
      timeout: 45_000,
    });
    await createdLeadRow.getByText(/required/i).first().waitFor({ timeout: 45_000 });

    await desktopPage.goto(`${BASE_URL}/app/leads?q=${encodeURIComponent(SEEDED_LEADS.mismatch)}`, {
      timeout: 120_000,
      waitUntil: "domcontentloaded",
    });
    const mismatchRow = desktopPage
      .locator("tr")
      .filter({ has: getVisibleLeadLink(desktopPage, SEEDED_LEADS.mismatch) })
      .first();
    await mismatchRow.getByText(/Review needed/i).waitFor({ timeout: 45_000 });

    console.log("Checking Workflow 7 missing-info compose flow...");

    await desktopPage.goto(
      `${BASE_URL}/app/leads?q=${encodeURIComponent(createdLead.fullName)}`,
      {
        timeout: 120_000,
        waitUntil: "domcontentloaded",
      },
    );
    await createdLeadRow.getByRole("link", { name: /Ask missing questions/i }).click();
    await desktopPage.waitForURL(
      (url) =>
        /\/app\/leads\/.+/.test(url.pathname) &&
        url.searchParams.get("compose") === "missing-info",
      {
        timeout: 45_000,
        waitUntil: "domcontentloaded",
      },
    );
    await desktopPage.getByText(
      "Review this missing-info draft before sending.",
      { exact: false },
    ).waitFor({ timeout: 45_000 });
    const missingInfoBody = await desktopPage
      .locator('#manual-outbound textarea[name="manualBody"]')
      .inputValue();
    assert.ok(
      missingInfoBody.trim().length > 20,
      "Expected missing-info draft body to be prefilled.",
    );
    await desktopPage.getByRole("button", { name: "Send manual message" }).click();
    await desktopPage.getByText(/Missing-info outreach was last sent/i).waitFor({
      timeout: 45_000,
    });
    await desktopPage.getByText(/Awaiting response/i).waitFor({ timeout: 45_000 });

    await desktopPage.goto(`${BASE_URL}/app/leads?q=${encodeURIComponent(createdLead.fullName)}`, {
      timeout: 120_000,
      waitUntil: "domcontentloaded",
    });
    const updatedCreatedLeadRow = desktopPage
      .locator("tr")
      .filter({ has: getVisibleLeadLink(desktopPage, createdLead.fullName) })
      .first();
    await updatedCreatedLeadRow.getByText(/Missing-info request sent/i).waitFor({
      timeout: 45_000,
    });

    console.log("Checking routing controls on a qualified lead...");

    await desktopPage.goto(
      `${BASE_URL}/app/leads?q=${encodeURIComponent(SEEDED_LEADS.qualified)}`,
      {
        timeout: 120_000,
        waitUntil: "domcontentloaded",
      },
    );
    await getVisibleLeadLink(desktopPage, SEEDED_LEADS.qualified).click();
    await desktopPage.getByText("Workflow chart", { exact: true }).waitFor({
      timeout: 45_000,
    });
    await desktopPage.getByRole("link", { name: "Open thread" }).click();
    await desktopPage.locator("#shared-thread").waitFor({ timeout: 45_000 });
    await desktopPage.getByRole("link", { name: "Qualify / Move status" }).click();
    await desktopPage.locator("#routing-controls").waitFor({ timeout: 45_000 });
    const routingForm = desktopPage
      .locator("form")
      .filter({ has: desktopPage.getByText("Manual routing update", { exact: true }) })
      .first();
    await routingForm.locator('select[name="overrideStatus"]').selectOption("UNDER_REVIEW");
    await routingForm.locator('select[name="overrideFit"]').selectOption("PASS");
    await routingForm.getByRole("textbox", { name: "Reason" }).fill(
      "Playwright routing coverage",
    );
    await routingForm.getByRole("button", { name: "Save routing update" }).click();
    await desktopPage.getByText("Current status", { exact: true }).locator("..").getByText(
      /Under review/i,
    ).waitFor({ timeout: 45_000 });
    await desktopPage.locator("#routing-controls").locator('select[name="overrideStatus"]').selectOption("QUALIFIED");
    await routingForm.getByRole("textbox", { name: "Reason" }).fill(
      "Playwright routing reset",
    );
    await desktopPage
      .locator("#routing-controls")
      .getByRole("button", { name: "Save routing update" })
      .click();
    await desktopPage.getByText("Current status", { exact: true }).locator("..").getByText(
      /Qualified/i,
    ).waitFor({ timeout: 45_000 });

    console.log("Checking lead detail header actions...");

    await desktopPage.goto(`${BASE_URL}/app/leads?q=${encodeURIComponent(createdLead.fullName)}`, {
      timeout: 120_000,
      waitUntil: "domcontentloaded",
    });
    await getVisibleLeadLink(desktopPage, createdLead.fullName).click();
    await desktopPage.getByRole("link", { name: "Message lead" }).click();
    await desktopPage.waitForURL(
      (url) => url.searchParams.get("compose") === "manual",
      {
        timeout: 45_000,
        waitUntil: "domcontentloaded",
      },
    );
    await desktopPage.locator("#manual-outbound").waitFor({ timeout: 45_000 });
    await desktopPage.getByRole("link", { name: "Reassign property" }).click();
    await desktopPage.locator("#assignment-panel").waitFor({ timeout: 45_000 });

    console.log("Checking property assignment and owner assignment...");

    await desktopPage.goto(
      `${BASE_URL}/app/leads?q=${encodeURIComponent(SEEDED_LEADS.unassigned)}`,
      {
        timeout: 120_000,
        waitUntil: "domcontentloaded",
      },
    );
    await getVisibleLeadLink(desktopPage, SEEDED_LEADS.unassigned).click();
    const assignmentPanel = desktopPage.locator("#assignment-panel");
    await assignmentPanel.waitFor({ timeout: 45_000 });
    await assignmentPanel.locator('select[name="propertyId"]').selectOption({
      label: "Maple House",
    });
    await assignmentPanel.getByRole("button", { name: /Assign property|Save property/i }).click();
    await assignmentPanel.getByRole("button", { name: "Save property" }).waitFor({
      timeout: 45_000,
    });
    const ownerForm = desktopPage
      .locator("form")
      .filter({ has: desktopPage.getByText("Assign lead owner", { exact: true }) })
      .first();
    await ownerForm.locator('select[name="assignedMembershipId"]').selectOption("unassigned");
    await ownerForm.getByRole("button", { name: "Save owner" }).click();
    await desktopPage.getByText("Current owner: Unassigned", { exact: false }).waitFor({
      timeout: 45_000,
    });

    console.log("Checking assignment filter after owner update...");

    await desktopPage.goto(`${BASE_URL}/app/leads`, {
      timeout: 120_000,
      waitUntil: "domcontentloaded",
    });
    const assignmentOptions = await desktopPage
      .locator('select[name="assignment"] option')
      .evaluateAll((options) =>
        options.map((option) => ({
          label: option.textContent?.trim() ?? "",
          value: (option as HTMLOptionElement).value,
        })),
      );
    const assignableOption = assignmentOptions.find((option) =>
      option.value.trim().length > 0,
    );
    assert.ok(assignableOption, "Expected at least one assignment filter option.");
    await desktopPage.selectOption('select[name="assignment"]', assignableOption.value);
    await desktopPage.getByRole("button", { name: "Apply" }).click();
    await desktopPage.waitForURL(
      (url) => url.searchParams.get("assignment") === assignableOption.value,
      {
        timeout: 45_000,
        waitUntil: "domcontentloaded",
      },
    );

    console.log("Checking archive and unarchive lifecycle controls...");

    await desktopPage.goto(`${BASE_URL}/app/leads?q=${encodeURIComponent(createdLead.fullName)}`, {
      timeout: 120_000,
      waitUntil: "domcontentloaded",
    });
    await getVisibleLeadLink(desktopPage, createdLead.fullName).click();
    await desktopPage.getByRole("button", { name: "Archive lead" }).click();
    await desktopPage.getByRole("button", { name: "Unarchive lead" }).waitFor({
      timeout: 45_000,
    });

    await desktopPage.goto(`${BASE_URL}/app/leads?q=${encodeURIComponent(createdLead.fullName)}`, {
      timeout: 120_000,
      waitUntil: "domcontentloaded",
    });
    await assertLeadAbsent(desktopPage, createdLead.fullName);
    await desktopPage.getByRole("link", { name: /Show archived/i }).click();
    await getVisibleLeadLink(desktopPage, createdLead.fullName).waitFor({
      timeout: 45_000,
    });
    await getVisibleLeadLink(desktopPage, createdLead.fullName).click();
    await desktopPage.getByRole("button", { name: "Unarchive lead" }).click();
    await desktopPage.getByRole("button", { name: "Archive lead" }).waitFor({
      timeout: 45_000,
    });

    console.log("Checking inbox triage lead workflows...");

    await desktopPage.goto(`${BASE_URL}/app/inbox?queue=review`, {
      timeout: 120_000,
      waitUntil: "domcontentloaded",
    });
    await desktopPage.getByRole("heading", { name: "Conversation triage" }).waitFor({
      timeout: 45_000,
    });
    await desktopPage.getByRole("link", { name: INBOX_QUEUE_LINKS.review }).waitFor({
      timeout: 45_000,
    });
    await getVisibleInboxLeadLink(desktopPage, SEEDED_LEADS.incomplete).waitFor({
      timeout: 45_000,
    });

    await desktopPage.goto(`${BASE_URL}/app/inbox?queue=mismatch`, {
      timeout: 120_000,
      waitUntil: "domcontentloaded",
    });
    await desktopPage.getByRole("link", { name: INBOX_QUEUE_LINKS.mismatch }).waitFor({
      timeout: 45_000,
    });
    await getVisibleInboxLeadLink(desktopPage, SEEDED_LEADS.mismatch).waitFor({
      timeout: 45_000,
    });
    await assertInboxLeadAbsent(desktopPage, SEEDED_LEADS.qualified);

    await desktopPage.goto(`${BASE_URL}/app/inbox?queue=unassigned`, {
      timeout: 120_000,
      waitUntil: "domcontentloaded",
    });
    await desktopPage.getByRole("link", { name: INBOX_QUEUE_LINKS.unassigned }).waitFor({
      timeout: 45_000,
    });
    await getVisibleInboxLeadLink(desktopPage, SEEDED_LEADS.unassigned).waitFor({
      timeout: 45_000,
    });

    await desktopPage.goto(`${BASE_URL}/app/inbox?queue=all`, {
      timeout: 120_000,
      waitUntil: "domcontentloaded",
    });
    const createdUnassignedInboxLink = getVisibleInboxLeadLink(
      desktopPage,
      createdUnassignedLead.fullName,
    );
    await createdUnassignedInboxLink.waitFor({
      timeout: 45_000,
    });
    const propertyAssignmentCard = createdUnassignedInboxLink.locator(
      'xpath=ancestor::div[contains(@class, "rounded-[2rem]")][1]',
    );
    await propertyAssignmentCard.locator('select[name="propertyId"]').selectOption({
      label: "Maple House",
    });
    await propertyAssignmentCard.getByRole("button", { name: "Save assignment" }).click();
    await desktopPage.waitForURL(
      (url) => url.pathname === "/app/inbox" && url.searchParams.get("queue") === "all",
      {
        timeout: 45_000,
        waitUntil: "domcontentloaded",
      },
    );

    await desktopPage.goto(`${BASE_URL}/app/inbox?queue=mismatch`, {
      timeout: 120_000,
      waitUntil: "domcontentloaded",
    });
    await getVisibleInboxLeadLink(desktopPage, SEEDED_LEADS.mismatch).click();
    await desktopPage.waitForURL(/\/app\/leads\/.+/, {
      timeout: 45_000,
      waitUntil: "domcontentloaded",
    });
    await desktopPage.getByText("Workflow chart", { exact: true }).waitFor({
      timeout: 45_000,
    });

    console.log("Checking mobile leads rendering for overflow regressions...");

    const mobileContext = await browser.newContext({
      storageState: authenticatedStorageState,
      viewport: {
        height: 844,
        width: 390,
      },
    });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto(`${BASE_URL}/app/leads?q=${encodeURIComponent(createdLead.fullName)}`, {
      timeout: 120_000,
      waitUntil: "domcontentloaded",
    });
    const mobileLeadCardLink = mobilePage
      .locator('a[href^="/app/leads/"]:visible')
      .filter({ hasText: createdLead.fullName })
      .first();
    await mobileLeadCardLink.waitFor({
      timeout: 45_000,
    });
    await mobilePage.getByText(/Missing-info request sent/i).waitFor({ timeout: 45_000 });

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

async function assertLeadAbsent(page: import("playwright").Page, leadName: string) {
  await page.waitForLoadState("domcontentloaded");
  assert.equal(
    await getVisibleLeadLink(page, leadName).count(),
    0,
    `Expected ${leadName} to be absent from the current lead list view.`,
  );
}

async function assertSearchValue(page: import("playwright").Page, expected: string) {
  assert.equal(await page.getByRole("searchbox").inputValue(), expected);
}

function getVisibleLeadLink(page: import("playwright").Page, leadName: string) {
  return page.locator('a[href^="/app/leads/"]:visible').filter({ hasText: leadName }).first();
}

async function assertInboxLeadAbsent(page: import("playwright").Page, leadName: string) {
  await page.waitForLoadState("domcontentloaded");
  assert.equal(
    await getVisibleInboxLeadLink(page, leadName).count(),
    0,
    `Expected ${leadName} to be absent from the current inbox queue view.`,
  );
}

function getVisibleInboxLeadLink(page: import("playwright").Page, leadName: string) {
  return page.locator('a[href^="/app/leads/"]:visible').filter({ hasText: leadName }).first();
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});