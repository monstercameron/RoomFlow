import assert from "node:assert/strict";
import test from "node:test";

import type { StartSocialSignInActionDependencies } from "./social-auth-actions";

function getSocialAuthActionsModule() {
  process.env.DATABASE_URL ??=
    "postgresql://postgres:postgres@localhost:5432/template1";

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("./social-auth-actions") as typeof import("./social-auth-actions");
}

function createDependencies(
  overrides: Partial<StartSocialSignInActionDependencies> = {},
): StartSocialSignInActionDependencies {
  return {
    buildAbsoluteApplicationUrl: (path) => `https://roomflow.test${path}`,
    buildAuthEntryPagePath: ({ callbackPath, emailAddress, entryPath, errorCode, providerId }) => {
      const url = new URL(entryPath, "https://roomflow.test");

      if (callbackPath && callbackPath !== "/onboarding") {
        url.searchParams.set("callbackURL", callbackPath);
      }

      if (emailAddress) {
        url.searchParams.set("email", emailAddress);
      }

      if (errorCode) {
        url.searchParams.set("error", errorCode);
      }

      if (providerId) {
        url.searchParams.set("provider", providerId);
      }

      return `${url.pathname}${url.search}`;
    },
    getConfiguredSocialAuthProviderIds: () => ["google"],
    getHeaders: async () => new Headers({ cookie: "session=1" }),
    isSocialAuthProviderId: (value): value is "google" | "facebook" | "microsoft" | "apple" =>
      ["google", "facebook", "microsoft", "apple"].includes(value),
    normalizeApplicationPath: (value) => value ?? "/",
    redirect: () => undefined as never,
    signInSocial: async () => ({ url: "https://accounts.google.com/o/oauth2/auth" }),
    ...overrides,
  };
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

test("handleStartSocialSignInAction redirects invalid entry paths to login", async () => {
  const { handleStartSocialSignInAction } = getSocialAuthActionsModule();
  const redirectCapture = createRedirectCapture();
  const formData = new FormData();
  formData.set("entryPath", "/bad-entry");

  await assert.rejects(
    handleStartSocialSignInAction(
      formData,
      createDependencies({
        redirect: redirectCapture.redirect as never,
      }),
    ),
    redirectCapture.redirectError,
  );

  assert.deepEqual(redirectCapture.redirects, [
    "/login?error=invalid_entry",
  ]);
});

test("handleStartSocialSignInAction rejects unsupported and unconfigured providers", async () => {
  const { handleStartSocialSignInAction } = getSocialAuthActionsModule();

  const unsupportedRedirectCapture = createRedirectCapture();
  const unsupportedFormData = new FormData();
  unsupportedFormData.set("entryPath", "/login");
  unsupportedFormData.set("providerId", "github");

  await assert.rejects(
    handleStartSocialSignInAction(
      unsupportedFormData,
      createDependencies({
        redirect: unsupportedRedirectCapture.redirect as never,
      }),
    ),
    unsupportedRedirectCapture.redirectError,
  );

  const unconfiguredRedirectCapture = createRedirectCapture();
  const unconfiguredFormData = new FormData();
  unconfiguredFormData.set("entryPath", "/signup");
  unconfiguredFormData.set("providerId", "facebook");
  unconfiguredFormData.set("emailAddress", "cam@example.com");

  await assert.rejects(
    handleStartSocialSignInAction(
      unconfiguredFormData,
      createDependencies({
        redirect: unconfiguredRedirectCapture.redirect as never,
      }),
    ),
    unconfiguredRedirectCapture.redirectError,
  );

  assert.deepEqual(unsupportedRedirectCapture.redirects, [
    "/login?error=provider_not_supported&provider=github",
  ]);
  assert.deepEqual(unconfiguredRedirectCapture.redirects, [
    "/signup?email=cam%40example.com&error=provider_not_configured&provider=facebook",
  ]);
});

test("handleStartSocialSignInAction builds the provider callback URL and redirects to the provider", async () => {
  const { handleStartSocialSignInAction } = getSocialAuthActionsModule();
  const redirectCapture = createRedirectCapture();
  const signInCalls: Array<{
    body: { callbackURL: string; disableRedirect: true; provider: string };
    headers: Headers;
  }> = [];
  const formData = new FormData();
  formData.set("entryPath", "/login");
  formData.set("providerId", "google");
  formData.set("callbackPath", "/app/settings/security");
  formData.set("emailAddress", "cam@example.com");

  await assert.rejects(
    handleStartSocialSignInAction(
      formData,
      createDependencies({
        redirect: redirectCapture.redirect as never,
        signInSocial: async (params) => {
          signInCalls.push({
            body: params.body,
            headers: params.headers,
          });
          return { url: "https://accounts.google.com/o/oauth2/auth?client_id=abc" };
        },
      }),
    ),
    redirectCapture.redirectError,
  );

  assert.equal(signInCalls.length, 1);
  assert.equal(signInCalls[0]?.headers.get("cookie"), "session=1");
  assert.deepEqual(signInCalls[0]?.body, {
    callbackURL:
      "https://roomflow.test/login?callbackURL=%2Fapp%2Fsettings%2Fsecurity&email=cam%40example.com&provider=google",
    disableRedirect: true,
    provider: "google",
  });
  assert.deepEqual(redirectCapture.redirects, [
    "https://accounts.google.com/o/oauth2/auth?client_id=abc",
  ]);
});

test("handleStartSocialSignInAction falls back to an auth error redirect when provider start fails", async () => {
  const { handleStartSocialSignInAction } = getSocialAuthActionsModule();
  const redirectCapture = createRedirectCapture();
  const formData = new FormData();
  formData.set("entryPath", "/login");
  formData.set("providerId", "google");

  await assert.rejects(
    handleStartSocialSignInAction(
      formData,
      createDependencies({
        redirect: redirectCapture.redirect as never,
        signInSocial: async () => ({ url: undefined }),
      }),
    ),
    redirectCapture.redirectError,
  );

  assert.deepEqual(redirectCapture.redirects, [
    "/login?error=social_sign_in_failed&provider=google",
  ]);
});