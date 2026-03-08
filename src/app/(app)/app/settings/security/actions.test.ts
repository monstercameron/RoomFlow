import assert from "node:assert/strict";
import test from "node:test";

import type {
  LinkSocialAccountActionDependencies,
  SetPasswordActionDependencies,
  UnlinkAccountActionDependencies,
} from "./actions";

function getSecurityActionsModule() {
  process.env.DATABASE_URL ??=
    "postgresql://postgres:postgres@localhost:5432/template1";

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("./actions") as typeof import("./actions");
}

function createRedirectCapture() {
  const redirects: string[] = [];
  const redirectError = new Error("NEXT_REDIRECT");

  return {
    redirect: (path: string) => {
      redirects.push(path);
      throw redirectError;
    },
    redirectError,
    redirects,
  };
}

function createLinkDependencies(
  overrides: Partial<LinkSocialAccountActionDependencies> = {},
): LinkSocialAccountActionDependencies {
  return {
    getConfiguredSocialAuthProviderIds: () => ["google"],
    getHeaders: async () => new Headers({ "x-test": "1" }),
    isSocialAuthProviderId: (providerId): providerId is "google" | "apple" =>
      providerId === "google" || providerId === "apple",
    linkSocialAccount: async () => ({ url: "https://accounts.example.test/oauth" }),
    redirect: () => undefined as never,
    ...overrides,
  };
}

function createUnlinkDependencies(
  overrides: Partial<UnlinkAccountActionDependencies> = {},
): UnlinkAccountActionDependencies {
  return {
    getHeaders: async () => new Headers({ "x-test": "1" }),
    redirect: () => undefined as never,
    revalidatePath: () => undefined,
    unlinkAccount: async () => undefined,
    ...overrides,
  };
}

function createSetPasswordDependencies(
  overrides: Partial<SetPasswordActionDependencies> = {},
): SetPasswordActionDependencies {
  return {
    getHeaders: async () => new Headers({ "x-test": "1" }),
    redirect: () => undefined as never,
    revalidatePath: () => undefined,
    setPassword: async () => undefined,
    ...overrides,
  };
}

test("handleLinkSocialAccountAction validates provider support and configuration", async () => {
  const { handleLinkSocialAccountAction } = getSecurityActionsModule();

  const unsupportedRedirectCapture = createRedirectCapture();
  const unsupportedFormData = new FormData();
  unsupportedFormData.set("providerId", "discord");

  await assert.rejects(
    handleLinkSocialAccountAction(
      unsupportedFormData,
      createLinkDependencies({
        redirect: unsupportedRedirectCapture.redirect as never,
      }),
    ),
    unsupportedRedirectCapture.redirectError,
  );
  assert.deepEqual(unsupportedRedirectCapture.redirects, [
    "/app/settings/security?accountError=Unsupported+account+provider.",
  ]);

  const unconfiguredRedirectCapture = createRedirectCapture();
  const unconfiguredFormData = new FormData();
  unconfiguredFormData.set("providerId", "apple");

  await assert.rejects(
    handleLinkSocialAccountAction(
      unconfiguredFormData,
      createLinkDependencies({
        getConfiguredSocialAuthProviderIds: () => ["google"],
        redirect: unconfiguredRedirectCapture.redirect as never,
      }),
    ),
    unconfiguredRedirectCapture.redirectError,
  );
  assert.deepEqual(unconfiguredRedirectCapture.redirects, [
    "/app/settings/security?accountError=apple+sign-in+is+not+configured+in+this+environment+yet.",
  ]);
});

test("handleLinkSocialAccountAction starts linking and redirects to the provider", async () => {
  const { handleLinkSocialAccountAction } = getSecurityActionsModule();
  const redirectCapture = createRedirectCapture();
  const linkCalls: Array<{
    body: {
      callbackURL: string;
      disableRedirect: true;
      provider: string;
    };
    headers: Headers;
  }> = [];
  const formData = new FormData();
  formData.set("providerId", "google");

  await assert.rejects(
    handleLinkSocialAccountAction(
      formData,
      createLinkDependencies({
        linkSocialAccount: async (input) => {
          linkCalls.push(input);
          return { url: "https://accounts.example.test/google/start" };
        },
        redirect: redirectCapture.redirect as never,
      }),
    ),
    redirectCapture.redirectError,
  );

  assert.equal(linkCalls.length, 1);
  assert.deepEqual(linkCalls[0]?.body, {
    callbackURL: "http://127.0.0.1:3001/app/settings/security?accountStatus=google-linked",
    disableRedirect: true,
    provider: "google",
  });
  assert.equal(linkCalls[0]?.headers.get("x-test"), "1");
  assert.deepEqual(redirectCapture.redirects, ["https://accounts.example.test/google/start"]);
});

test("handleLinkSocialAccountAction redirects to an error when linking cannot start", async () => {
  const { handleLinkSocialAccountAction } = getSecurityActionsModule();

  const missingUrlRedirectCapture = createRedirectCapture();
  const missingUrlFormData = new FormData();
  missingUrlFormData.set("providerId", "google");

  await assert.rejects(
    handleLinkSocialAccountAction(
      missingUrlFormData,
      createLinkDependencies({
        linkSocialAccount: async () => ({}),
        redirect: missingUrlRedirectCapture.redirect as never,
      }),
    ),
    missingUrlRedirectCapture.redirectError,
  );
  assert.deepEqual(missingUrlRedirectCapture.redirects, [
    "/app/settings/security?accountError=Unable+to+start+google+account+linking+right+now.",
  ]);

  const providerErrorRedirectCapture = createRedirectCapture();
  await assert.rejects(
    handleLinkSocialAccountAction(
      missingUrlFormData,
      createLinkDependencies({
        linkSocialAccount: async () => {
          throw {
            body: {
              message: "Provider temporarily unavailable.",
            },
          };
        },
        redirect: providerErrorRedirectCapture.redirect as never,
      }),
    ),
    providerErrorRedirectCapture.redirectError,
  );
  assert.deepEqual(providerErrorRedirectCapture.redirects, [
    "/app/settings/security?accountError=Provider+temporarily+unavailable.",
  ]);
});

test("handleUnlinkAccountAction validates account details and reports success or failure", async () => {
  const { handleUnlinkAccountAction } = getSecurityActionsModule();

  const missingDetailsRedirectCapture = createRedirectCapture();
  await assert.rejects(
    handleUnlinkAccountAction(
      new FormData(),
      createUnlinkDependencies({
        redirect: missingDetailsRedirectCapture.redirect as never,
      }),
    ),
    missingDetailsRedirectCapture.redirectError,
  );
  assert.deepEqual(missingDetailsRedirectCapture.redirects, [
    "/app/settings/security?accountError=Missing+linked+account+details.",
  ]);

  const unlinkCalls: unknown[] = [];
  const revalidatedPaths: string[] = [];
  const successRedirectCapture = createRedirectCapture();
  const successFormData = new FormData();
  successFormData.set("providerId", "google");
  successFormData.set("accountId", "account-1");

  await assert.rejects(
    handleUnlinkAccountAction(
      successFormData,
      createUnlinkDependencies({
        redirect: successRedirectCapture.redirect as never,
        revalidatePath: (path) => {
          revalidatedPaths.push(path);
        },
        unlinkAccount: async (input) => {
          unlinkCalls.push(input);
        },
      }),
    ),
    successRedirectCapture.redirectError,
  );
  assert.equal(unlinkCalls.length, 1);
  assert.deepEqual(revalidatedPaths, ["/app/settings/security"]);
  assert.deepEqual(successRedirectCapture.redirects, [
    "/app/settings/security?accountStatus=google-unlinked",
  ]);

  const unlinkErrorRedirectCapture = createRedirectCapture();
  await assert.rejects(
    handleUnlinkAccountAction(
      successFormData,
      createUnlinkDependencies({
        redirect: unlinkErrorRedirectCapture.redirect as never,
        unlinkAccount: async () => {
          throw new Error("Account unlink failed.");
        },
      }),
    ),
    unlinkErrorRedirectCapture.redirectError,
  );
  assert.deepEqual(unlinkErrorRedirectCapture.redirects, [
    "/app/settings/security?accountError=Account+unlink+failed.",
  ]);
});

test("handleSetPasswordAction validates passwords and reports success or failure", async () => {
  const { handleSetPasswordAction } = getSecurityActionsModule();

  const shortPasswordRedirectCapture = createRedirectCapture();
  const shortPasswordFormData = new FormData();
  shortPasswordFormData.set("newPassword", "short");
  shortPasswordFormData.set("confirmPassword", "short");

  await assert.rejects(
    handleSetPasswordAction(
      shortPasswordFormData,
      createSetPasswordDependencies({
        redirect: shortPasswordRedirectCapture.redirect as never,
      }),
    ),
    shortPasswordRedirectCapture.redirectError,
  );
  assert.deepEqual(shortPasswordRedirectCapture.redirects, [
    "/app/settings/security?accountError=Choose+a+password+with+at+least+8+characters.",
  ]);

  const mismatchRedirectCapture = createRedirectCapture();
  const mismatchFormData = new FormData();
  mismatchFormData.set("newPassword", "password-1");
  mismatchFormData.set("confirmPassword", "password-2");

  await assert.rejects(
    handleSetPasswordAction(
      mismatchFormData,
      createSetPasswordDependencies({
        redirect: mismatchRedirectCapture.redirect as never,
      }),
    ),
    mismatchRedirectCapture.redirectError,
  );
  assert.deepEqual(mismatchRedirectCapture.redirects, [
    "/app/settings/security?accountError=Password+confirmation+does+not+match.",
  ]);

  const setPasswordCalls: unknown[] = [];
  const revalidatedPaths: string[] = [];
  const successRedirectCapture = createRedirectCapture();
  const successFormData = new FormData();
  successFormData.set("newPassword", "password-123");
  successFormData.set("confirmPassword", "password-123");

  await assert.rejects(
    handleSetPasswordAction(
      successFormData,
      createSetPasswordDependencies({
        redirect: successRedirectCapture.redirect as never,
        revalidatePath: (path) => {
          revalidatedPaths.push(path);
        },
        setPassword: async (input) => {
          setPasswordCalls.push(input);
        },
      }),
    ),
    successRedirectCapture.redirectError,
  );
  assert.equal(setPasswordCalls.length, 1);
  assert.deepEqual(revalidatedPaths, ["/app/settings/security"]);
  assert.deepEqual(successRedirectCapture.redirects, [
    "/app/settings/security?accountStatus=password-set",
  ]);

  const setPasswordErrorRedirectCapture = createRedirectCapture();
  await assert.rejects(
    handleSetPasswordAction(
      successFormData,
      createSetPasswordDependencies({
        redirect: setPasswordErrorRedirectCapture.redirect as never,
        setPassword: async () => {
          throw {
            body: {
              message: "Password update blocked by policy.",
            },
          };
        },
      }),
    ),
    setPasswordErrorRedirectCapture.redirectError,
  );
  assert.deepEqual(setPasswordErrorRedirectCapture.redirects, [
    "/app/settings/security?accountError=Password+update+blocked+by+policy.",
  ]);
});