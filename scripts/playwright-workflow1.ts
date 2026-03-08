import "dotenv/config";
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { SignJWT } from "jose";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import {
  MembershipRole,
  WorkspacePlanType,
  WorkspacePlanStatus,
} from "../src/generated/prisma/client";
import { auth } from "../src/lib/auth";
import { prisma } from "../src/lib/prisma";
import { getDefaultCapabilitiesForWorkspacePlan } from "../src/lib/workspace-plan";
import { ensureWorkspaceForUser } from "../src/lib/workspaces";
import { hashWorkspaceInviteToken } from "../src/lib/workspace-invites";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3001";
const TEST_PASSWORD = "Roomflow123!";
const OWNER_EMAIL = "test@roomflow.local";
const OWNER_NAME = "Roomflow Test Owner";
const ownerWorkspaceName = "Workflow 1 Invite Workspace";

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

async function createVerificationToken(email: string) {
  const secret = process.env.BETTER_AUTH_SECRET;

  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET must be configured before running Workflow 1 Playwright checks.");
  }

  return new SignJWT({ email: email.trim().toLowerCase() })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(secret));
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

  await prisma.workspaceInvite.deleteMany({ where: { email } });
  await prisma.verification.deleteMany({ where: { value: { contains: email } } });

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

async function ensureOwnerFixture() {
  let ownerUser = await prisma.user.findUnique({ where: { email: OWNER_EMAIL } });

  if (!ownerUser) {
    await auth.api.signUpEmail({
      body: {
        email: OWNER_EMAIL,
        name: OWNER_NAME,
        password: TEST_PASSWORD,
      },
    });

    ownerUser = await prisma.user.findUniqueOrThrow({ where: { email: OWNER_EMAIL } });
  }

  if (!ownerUser.emailVerified) {
    ownerUser = await prisma.user.update({
      where: { id: ownerUser.id },
      data: { emailVerified: true },
    });
  }

  const workspace = await ensureWorkspaceForUser(
    {
      email: ownerUser.email,
      id: ownerUser.id,
      name: ownerUser.name,
    },
    {
      planType: WorkspacePlanType.ORG,
    },
  );

  const updatedWorkspace = await prisma.workspace.update({
    where: { id: workspace.id },
    data: {
      enabledCapabilities: getDefaultCapabilitiesForWorkspacePlan(WorkspacePlanType.ORG),
      name: ownerWorkspaceName,
      onboardingCompletedAt: new Date(),
      planStatus: WorkspacePlanStatus.TRIAL,
      planType: WorkspacePlanType.ORG,
    },
  });

  return {
    user: ownerUser,
    workspace: updatedWorkspace,
  };
}

async function ensurePasswordUser(email: string, name: string) {
  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    await auth.api.signUpEmail({
      body: {
        email,
        name,
        password: TEST_PASSWORD,
      },
    });

    user = await prisma.user.findUniqueOrThrow({ where: { email } });
  }

  if (!user.emailVerified) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true },
    });
  }

  return user;
}

async function createInviteFixture(params: {
  email: string;
  role?: MembershipRole;
  status?: "accepted" | "expired" | "pending" | "revoked";
}) {
  const ownerFixture = await ensureOwnerFixture();
  const rawInviteToken = randomBytes(24).toString("hex");
  const inviteStatus = params.status ?? "pending";
  const now = new Date();

  await prisma.workspaceInvite.deleteMany({
    where: {
      email: params.email,
      workspaceId: ownerFixture.workspace.id,
    },
  });

  await prisma.workspaceInvite.create({
    data: {
      acceptedAt: inviteStatus === "accepted" ? now : null,
      email: params.email,
      expiresAt:
        inviteStatus === "expired"
          ? new Date(now.getTime() - 60_000)
          : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      invitedByUserId: ownerFixture.user.id,
      revokedAt: inviteStatus === "revoked" ? now : null,
      role: params.role ?? MembershipRole.MANAGER,
      tokenHash: hashWorkspaceInviteToken(rawInviteToken),
      workspaceId: ownerFixture.workspace.id,
    },
  });

  return {
    ownerFixture,
    rawInviteToken,
  };
}

async function login(page: Page, email: string) {
  await page.goto(buildUrl("/login"), { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
}

async function submitSignup(page: Page, params: { email: string; name: string; password?: string; confirmPassword?: string }) {
  const password = params.password ?? TEST_PASSWORD;

  await page.getByLabel("Name").fill(params.name);
  await page.getByLabel("Email").fill(params.email);
  await page.locator("#signup-password").fill(password);
  await page.locator("#signup-confirm-password").fill(params.confirmPassword ?? password);
  await page.getByRole("button", { name: "Create account" }).click();
}

async function finishEmailVerification(page: Page) {
  const currentUrl = new URL(page.url());
  const email = currentUrl.searchParams.get("email");
  const nextPath = currentUrl.searchParams.get("next") ?? "/onboarding";

  if (!email) {
    throw new Error(`Expected verify-email route to include an email query param, received ${page.url()}`);
  }

  const token = await createVerificationToken(email);
  await page.goto(buildUrl(`/verify-email?token=${encodeURIComponent(token)}&next=${encodeURIComponent(nextPath)}`), {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });

  await Promise.race([
    page.waitForURL(/\/onboarding/, { timeout: 30_000 }),
    page.waitForURL(/\/invite\//, { timeout: 30_000 }),
    page.waitForURL(/\/app/, { timeout: 30_000 }),
    page.waitForURL(/\/verify-email\?.*status=verified/, { timeout: 30_000 }),
  ]).catch(() => undefined);

  if (page.url().includes("/verify-email") && page.url().includes("status=verified")) {
    const continueLink = page.getByRole("link", { name: "Continue to workspace" });

    if (await continueLink.isVisible().catch(() => false)) {
      await continueLink.click();
      await Promise.race([
        page.waitForURL(/\/onboarding/, { timeout: 30_000 }),
        page.waitForURL(/\/invite\//, { timeout: 30_000 }),
        page.waitForURL(/\/app/, { timeout: 30_000 }),
      ]).catch(() => undefined);
    }
  }
}

async function getUserWorkspaceSnapshot(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      billingOwnedWorkspaces: {
        select: {
          id: true,
          planType: true,
        },
      },
      memberships: {
        select: {
          role: true,
          workspaceId: true,
          workspace: {
            select: {
              id: true,
              planType: true,
            },
          },
        },
      },
    },
  });

  return {
    billingOwnedWorkspaces: user?.billingOwnedWorkspaces ?? [],
    memberships: user?.memberships ?? [],
    user,
  };
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

async function assertInvitePageMobileLayout(page: Page) {
  const primaryButton = page.getByRole("link", { name: /log in to accept|open roomflow/i }).first();
  const box = await primaryButton.boundingBox();

  if (!box || box.width < 180) {
    throw new Error("Invite action did not render at a tappable mobile width.");
  }
}

async function run() {
  const failures: FailureRecord[] = [];

  await ensureOwnerFixture();

  const directPersonalEmail = randomEmail("workflow1-personal");
  const directOrgEmail = randomEmail("workflow1-org");
  const sourceEmail = randomEmail("workflow1-source");
  const utmEmail = randomEmail("workflow1-utm");
  const inviteSignupEmail = randomEmail("workflow1-invite");
  const duplicateEmail = randomEmail("workflow1-duplicate");
  const wrongAccountInviteEmail = randomEmail("workflow1-wrong-account");
  const matchingAccountInviteEmail = randomEmail("workflow1-matching-account");
  const magicLinkEmail = OWNER_EMAIL;

  await Promise.all([
    cleanupUserByEmail(directPersonalEmail),
    cleanupUserByEmail(directOrgEmail),
    cleanupUserByEmail(sourceEmail),
    cleanupUserByEmail(utmEmail),
    cleanupUserByEmail(inviteSignupEmail),
    cleanupUserByEmail(duplicateEmail),
    cleanupUserByEmail(wrongAccountInviteEmail),
    cleanupUserByEmail(matchingAccountInviteEmail),
  ]);

  await ensurePasswordUser(duplicateEmail, "Workflow 1 Duplicate User");
  await ensurePasswordUser(matchingAccountInviteEmail, "Workflow 1 Matching Invite User");
  await ensurePasswordUser(wrongAccountInviteEmail, "Workflow 1 Wrong Account User");

  const inviteSignupFixture = await createInviteFixture({ email: inviteSignupEmail });
  const signedOutInvite = await createInviteFixture({ email: randomEmail("workflow1-signed-out") });
  const wrongAccountInvite = await createInviteFixture({ email: wrongAccountInviteEmail });
  const matchingAccountInvite = await createInviteFixture({ email: matchingAccountInviteEmail });
  const acceptedInvite = await createInviteFixture({
    email: randomEmail("workflow1-accepted"),
    status: "accepted",
  });
  const expiredInvite = await createInviteFixture({
    email: randomEmail("workflow1-expired"),
    status: "expired",
  });
  const revokedInvite = await createInviteFixture({
    email: randomEmail("workflow1-revoked"),
    status: "revoked",
  });

  const browser = await chromium.launch({ headless: true });

  try {
    await withScenario(browser, failures, "base-signup-route", async (context) => {
      const page = await context.newPage();
      await page.goto(buildUrl("/signup"), { waitUntil: "domcontentloaded", timeout: 120_000 });
      await page.getByRole("heading", { name: "Create your Roomflow account" }).waitFor();
      await page.getByLabel("Name").waitFor();
      await page.getByLabel("Email").waitFor();
      await page.locator("#signup-password").waitFor();
      await page.locator("#signup-confirm-password").waitFor();
      await page.getByText("Password checkpoint", { exact: false }).waitFor();
      assert.equal(await page.getByRole("button", { name: "Create account" }).isVisible(), true);
    });

    await withScenario(browser, failures, "plan-personal-signup", async (context) => {
      const page = await context.newPage();
      await page.goto(buildUrl("/signup?plan=personal"), { waitUntil: "domcontentloaded", timeout: 120_000 });
      await page.getByText("Personal workspace", { exact: false }).waitFor();
      await submitSignup(page, {
        email: directPersonalEmail,
        name: "Workflow 1 Personal",
      });
      await page.waitForURL(/\/verify-email\?/);
      const nextPath = new URL(page.url()).searchParams.get("next") ?? "";
      assert.match(nextPath, /plan=personal/);
      await finishEmailVerification(page);
      await page.waitForURL(/\/onboarding/);
      const snapshot = await getUserWorkspaceSnapshot(directPersonalEmail);
      assert.equal(snapshot.billingOwnedWorkspaces.length, 1);
      assert.equal(snapshot.memberships.length, 1);
      assert.equal(snapshot.billingOwnedWorkspaces[0]?.planType, WorkspacePlanType.PERSONAL);
    });

    await withScenario(browser, failures, "plan-org-signup", async (context) => {
      const page = await context.newPage();
      await page.goto(buildUrl("/signup?plan=org"), { waitUntil: "domcontentloaded", timeout: 120_000 });
      await page.getByText("Org workspace", { exact: false }).waitFor();
      await submitSignup(page, {
        email: directOrgEmail,
        name: "Workflow 1 Org",
      });
      await page.waitForURL(/\/verify-email\?/);
      const nextPath = new URL(page.url()).searchParams.get("next") ?? "";
      assert.match(nextPath, /plan=org/);
      await finishEmailVerification(page);
      await page.waitForURL(/\/onboarding/);
      const snapshot = await getUserWorkspaceSnapshot(directOrgEmail);
      assert.equal(snapshot.billingOwnedWorkspaces.length, 1);
      assert.equal(snapshot.memberships.length, 1);
      assert.equal(snapshot.billingOwnedWorkspaces[0]?.planType, WorkspacePlanType.ORG);
    });

    await withScenario(browser, failures, "source-utm-handoff", async (context) => {
      const sourcePage = await context.newPage();
      await sourcePage.goto(buildUrl("/signup?source=ai-tool"), { waitUntil: "domcontentloaded", timeout: 120_000 });
      await sourcePage.getByText("Source: ai-tool", { exact: false }).waitFor();
      await submitSignup(sourcePage, {
        email: sourceEmail,
        name: "Workflow 1 Source",
      });
      await sourcePage.waitForURL(/\/verify-email\?/);
      assert.match(new URL(sourcePage.url()).searchParams.get("next") ?? "", /source=ai-tool/);

      const utmPage = await context.newPage();
      await utmPage.goto(buildUrl("/signup?utm_campaign=test"), { waitUntil: "domcontentloaded", timeout: 120_000 });
      await utmPage.getByText("Campaign: test", { exact: false }).waitFor();
      await submitSignup(utmPage, {
        email: utmEmail,
        name: "Workflow 1 Campaign",
      });
      await utmPage.waitForURL(/\/verify-email\?/);
      assert.match(new URL(utmPage.url()).searchParams.get("next") ?? "", /utm_campaign=test/);
    });

    await withScenario(browser, failures, "invite-signup-handoff-and-no-extra-workspace", async (context) => {
      const page = await context.newPage();
      await page.goto(buildUrl(`/signup?invite=${inviteSignupFixture.rawInviteToken}`), {
        waitUntil: "domcontentloaded",
        timeout: 120_000,
      });
      await page.getByText("Workspace invite", { exact: false }).waitFor();
      await submitSignup(page, {
        email: inviteSignupEmail,
        name: "Workflow 1 Invite",
      });
      await page.waitForURL(/\/verify-email\?/);
      const verifyNextPath = new URL(page.url()).searchParams.get("next") ?? "";
      assert.match(verifyNextPath, new RegExp(`/invite/${inviteSignupFixture.rawInviteToken}`));
      await finishEmailVerification(page);
      await page.waitForURL(new RegExp(`/invite/${inviteSignupFixture.rawInviteToken}`));
      await page.getByRole("button", { name: "Accept workspace invite" }).waitFor();

      const preAcceptSnapshot = await getUserWorkspaceSnapshot(inviteSignupEmail);
      assert.equal(preAcceptSnapshot.billingOwnedWorkspaces.length, 0);
      assert.equal(preAcceptSnapshot.memberships.length, 0);

      await page.getByRole("button", { name: "Accept workspace invite" }).click();
      await page.waitForURL(/\/(app|onboarding)/);

      const postAcceptSnapshot = await getUserWorkspaceSnapshot(inviteSignupEmail);
      assert.equal(postAcceptSnapshot.billingOwnedWorkspaces.length, 0);
      assert.equal(postAcceptSnapshot.memberships.length, 1);
      assert.equal(postAcceptSnapshot.memberships[0]?.workspaceId, inviteSignupFixture.ownerFixture.workspace.id);
    });

    await withScenario(browser, failures, "client-validation-errors", async (context) => {
      const page = await context.newPage();
      await page.goto(buildUrl("/signup"), { waitUntil: "domcontentloaded", timeout: 120_000 });
      await page.getByLabel("Name").fill("A");
      await page.getByLabel("Email").fill("bad-email");
      await page.locator("#signup-password").fill("short");
      await page.getByLabel("Confirm password").fill("different");
      await page.getByRole("button", { name: "Create account" }).click();
      await page.getByText("Enter a valid email address.", { exact: false }).waitFor();
      await page.getByText("Use at least 10 characters", { exact: false }).waitFor();
      await page.getByText("Passwords do not match yet.", { exact: false }).waitFor();
      assert.match(page.url(), /\/signup/);
    });

    await withScenario(browser, failures, "duplicate-signup-guidance", async (context) => {
      const page = await context.newPage();
      await page.goto(buildUrl("/signup"), { waitUntil: "domcontentloaded", timeout: 120_000 });
      await submitSignup(page, {
        email: duplicateEmail,
        name: "Workflow 1 Duplicate",
      });
      await page.getByText("This email already has a Roomflow account.", { exact: false }).waitFor();
      await page.getByRole("link", { name: "Log in" }).waitFor();
      await page.getByRole("link", { name: "Email a magic link" }).waitFor();
    });

    await withScenario(browser, failures, "magic-link-initiation-and-guidance", async (context) => {
      const page = await context.newPage();
      await page.goto(buildUrl("/magic-link?plan=org&source=ai-tool"), {
        waitUntil: "domcontentloaded",
        timeout: 120_000,
      });
      await page.getByLabel("Email").fill(magicLinkEmail);
      await page.getByRole("button", { name: "Email me a sign-in link" }).click();
      await page.waitForLoadState("networkidle");
      await page.getByText("Magic link issued.", { exact: false }).waitFor();

      const unknownPage = await context.newPage();
      await unknownPage.goto(buildUrl(`/magic-link?email=${encodeURIComponent(randomEmail("workflow1-no-user"))}&error=new_user_signup_disabled`), {
        waitUntil: "domcontentloaded",
        timeout: 120_000,
      });
      await unknownPage.getByText("No account exists for that email yet.", { exact: false }).waitFor();
    });

    await withScenario(browser, failures, "unverified-email-resend-and-verification", async (context) => {
      const email = randomEmail("workflow1-resend");
      await cleanupUserByEmail(email);
      const page = await context.newPage();
      await page.goto(buildUrl("/signup"), { waitUntil: "domcontentloaded", timeout: 120_000 });
      await submitSignup(page, {
        email,
        name: "Workflow 1 Resend",
      });
      await page.waitForURL(/\/verify-email\?/);
      await page.getByRole("button", { name: "Send verification email" }).click();
      await page.getByText("Verification email issued.", { exact: false }).waitFor();
      await finishEmailVerification(page);
      await page.waitForURL(/\/onboarding/);
    });

    await withScenario(browser, failures, "oauth-conflict-guidance", async (context) => {
      const page = await context.newPage();
      await page.goto(buildUrl("/signup?error=unable_to_link_account&provider=google"), {
        waitUntil: "domcontentloaded",
        timeout: 120_000,
      });
      await page.getByText("Google found an existing Roomflow account", { exact: false }).waitFor();
    });

    await withScenario(browser, failures, "invite-page-signed-out", async (context) => {
      const signedOutPage = await context.newPage();
      await signedOutPage.goto(buildUrl(`/invite/${signedOutInvite.rawInviteToken}`), {
        waitUntil: "domcontentloaded",
        timeout: 120_000,
      });
      await signedOutPage.getByRole("link", { name: "Log in to accept" }).waitFor();
      await signedOutPage.getByRole("link", { name: "Create account to accept" }).waitFor();
    });

    await withScenario(browser, failures, "invite-page-wrong-account", async (context) => {
      const wrongAccountPage = await context.newPage();
      await login(wrongAccountPage, OWNER_EMAIL);
      await wrongAccountPage.waitForURL(/\/(app|onboarding)/);
      await wrongAccountPage.goto(buildUrl(`/invite/${wrongAccountInvite.rawInviteToken}`), {
        waitUntil: "domcontentloaded",
        timeout: 120_000,
      });
      await wrongAccountPage.getByText(`You are signed in as ${OWNER_EMAIL}`, { exact: false }).waitFor();
      await wrongAccountPage.getByRole("link", { name: "Switch accounts" }).waitFor();
    });

    await withScenario(browser, failures, "invite-page-matching-account", async (context) => {
      const wrongAccountPage = await context.newPage();
      await login(wrongAccountPage, matchingAccountInviteEmail);
      await wrongAccountPage.waitForURL(/\/(app|onboarding)/);
      await wrongAccountPage.goto(buildUrl(`/invite/${matchingAccountInvite.rawInviteToken}`), {
        waitUntil: "domcontentloaded",
        timeout: 120_000,
      });
      await wrongAccountPage.getByRole("button", { name: "Accept workspace invite" }).waitFor();
    });

    await withScenario(browser, failures, "invite-page-accepted-expired-revoked", async (context) => {
      const acceptedPage = await context.newPage();
      await acceptedPage.goto(buildUrl(`/invite/${acceptedInvite.rawInviteToken}`), {
        waitUntil: "domcontentloaded",
        timeout: 120_000,
      });
      await acceptedPage.getByText("This invite has already been accepted.", { exact: false }).waitFor();

      const expiredPage = await context.newPage();
      await expiredPage.goto(buildUrl(`/invite/${expiredInvite.rawInviteToken}`), {
        waitUntil: "domcontentloaded",
        timeout: 120_000,
      });
      await expiredPage.getByText("This invite expired.", { exact: false }).waitFor();

      const revokedPage = await context.newPage();
      await revokedPage.goto(buildUrl(`/invite/${revokedInvite.rawInviteToken}`), {
        waitUntil: "domcontentloaded",
        timeout: 120_000,
      });
      await revokedPage.getByText("This invite has been revoked.", { exact: false }).waitFor();
    });

    await withScenario(browser, failures, "mobile-signup-layout", async (context) => {
      const page = await context.newPage();
      await page.goto(buildUrl("/signup"), { waitUntil: "domcontentloaded", timeout: 120_000 });
      await page.getByRole("heading", { name: "Create your Roomflow account" }).waitFor();
      const nameBox = await page.getByLabel("Name").boundingBox();

      if (!nameBox || nameBox.width < 250) {
        throw new Error("Mobile signup input did not render at a usable width.");
      }
    }, { isMobile: true });

    await withScenario(browser, failures, "mobile-invite-layout", async (context) => {
      const page = await context.newPage();
      await page.goto(buildUrl(`/invite/${signedOutInvite.rawInviteToken}`), {
        waitUntil: "domcontentloaded",
        timeout: 120_000,
      });
      await page.getByRole("heading", { name: /Join .* on Roomflow\./ }).waitFor();
      await assertInvitePageMobileLayout(page);
    }, { isMobile: true });

    await withScenario(browser, failures, "mobile-onboarding-destination", async (context) => {
      const email = randomEmail("workflow1-mobile-onboarding");
      await cleanupUserByEmail(email);
      const page = await context.newPage();
      await page.goto(buildUrl("/signup"), { waitUntil: "domcontentloaded", timeout: 120_000 });
      await submitSignup(page, {
        email,
        name: "Workflow 1 Mobile Onboarding",
      });
      await page.waitForURL(/\/verify-email\?/);
      await finishEmailVerification(page);
      await page.waitForURL(/\/onboarding/);
      await page.getByRole("heading", { name: "Get the first property live in three steps" }).waitFor();
    }, { isMobile: true });
  } finally {
    await browser.close();
  }

  if (failures.length > 0) {
    writeFileSync("workflow1-fails.json", JSON.stringify(failures, null, 2));
    throw new Error(`Workflow 1 Playwright checks hit ${failures.length} issue(s). See workflow1-fails.json.`);
  }
}

run()
  .then(() => {
    console.log("Workflow 1 Playwright checks passed.");
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })