import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAbsoluteApplicationUrl,
  buildAuthEntryPagePath,
  buildEmailVerificationCallbackPath,
  buildEmailVerificationPagePath,
  buildMagicLinkPagePath,
  normalizeApplicationPath,
} from "@/lib/auth-urls";

function withEnvironmentVariables<T>(
  variables: Partial<Record<"BETTER_AUTH_URL" | "NEXT_PUBLIC_APP_URL", string | undefined>>,
  callback: () => T,
) {
  const previousValues = {
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  };

  for (const [key, value] of Object.entries(variables)) {
    if (value === undefined) {
      delete process.env[key];
      continue;
    }

    process.env[key] = value;
  }

  try {
    return callback();
  } finally {
    for (const [key, value] of Object.entries(previousValues)) {
      if (value === undefined) {
        delete process.env[key];
        continue;
      }

      process.env[key] = value;
    }
  }
}

test("normalizeApplicationPath keeps same-origin paths and rejects cross-origin redirects", () => {
  const normalizedSameOriginPath = withEnvironmentVariables(
    { NEXT_PUBLIC_APP_URL: "https://roomflow.test" },
    () => normalizeApplicationPath("https://roomflow.test/app/leads?tab=activity#notes"),
  );

  const normalizedCrossOriginPath = withEnvironmentVariables(
    { NEXT_PUBLIC_APP_URL: "https://roomflow.test" },
    () => normalizeApplicationPath("https://attacker.test/phish"),
  );

  assert.equal(normalizedSameOriginPath, "/app/leads?tab=activity#notes");
  assert.equal(normalizedCrossOriginPath, "/");
});

test("buildAbsoluteApplicationUrl uses the configured application base URL", () => {
  const absoluteUrl = withEnvironmentVariables(
    { NEXT_PUBLIC_APP_URL: "https://app.roomflow.test", BETTER_AUTH_URL: undefined },
    () => buildAbsoluteApplicationUrl("/verify-email?status=verified"),
  );

  assert.equal(absoluteUrl, "https://app.roomflow.test/verify-email?status=verified");
});

test("buildEmailVerificationCallbackPath omits the default next path and sanitizes external paths", () => {
  const defaultCallbackPath = buildEmailVerificationCallbackPath({ nextPath: "/" });
  const sanitizedCallbackPath = withEnvironmentVariables(
    { NEXT_PUBLIC_APP_URL: "https://roomflow.test" },
    () => buildEmailVerificationCallbackPath({ nextPath: "https://attacker.test/phish" }),
  );

  assert.equal(defaultCallbackPath, "/verify-email?status=verified");
  assert.equal(sanitizedCallbackPath, "/verify-email?status=verified");
});

test("buildEmailVerificationPagePath and buildMagicLinkPagePath encode query parameters safely", () => {
  const verificationPath = buildEmailVerificationPagePath({
    emailAddress: "cam+ops@example.com",
    nextPath: "/app/settings/integrations?panel=slack",
    token: "token with spaces",
    verificationErrorCode: "expired_token",
    verificationStatus: "verified",
  });

  const magicLinkPath = buildMagicLinkPagePath({
    emailAddress: "cam+ops@example.com",
    nextPath: "/app/inbox?filter=unread",
    token: "magic token",
    errorCode: "invalid_token",
    status: "sent",
  });

  assert.equal(
    verificationPath,
    "/verify-email?email=cam%2Bops%40example.com&next=%2Fapp%2Fsettings%2Fintegrations%3Fpanel%3Dslack&token=token+with+spaces&error=expired_token&status=verified",
  );
  assert.equal(
    magicLinkPath,
    "/magic-link?email=cam%2Bops%40example.com&next=%2Fapp%2Finbox%3Ffilter%3Dunread&token=magic+token&error=invalid_token&status=sent",
  );
});

test("buildAuthEntryPagePath defaults onboarding callbacks and sanitizes custom callback paths", () => {
  const defaultLoginPath = buildAuthEntryPagePath({
    entryPath: "/login",
  });

  const sanitizedSignupPath = withEnvironmentVariables(
    { NEXT_PUBLIC_APP_URL: "https://roomflow.test" },
    () =>
      buildAuthEntryPagePath({
        callbackPath: "https://attacker.test/phish",
        emailAddress: "cam+ops@example.com",
        entryPath: "/signup",
        errorCode: "provider_not_configured",
        providerId: "google",
      }),
  );

  const customLoginPath = withEnvironmentVariables(
    { NEXT_PUBLIC_APP_URL: "https://roomflow.test" },
    () =>
      buildAuthEntryPagePath({
        callbackPath: "/app/leads?tab=activity",
        entryPath: "/login",
      }),
  );

  assert.equal(defaultLoginPath, "/login");
  assert.equal(
    sanitizedSignupPath,
    "/signup?callbackURL=%2F&email=cam%2Bops%40example.com&error=provider_not_configured&provider=google",
  );
  assert.equal(customLoginPath, "/login?callbackURL=%2Fapp%2Fleads%3Ftab%3Dactivity");
});