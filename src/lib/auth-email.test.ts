import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEmailVerificationApplicationUrl,
  buildMagicLinkApplicationUrl,
  buildPasswordResetApplicationUrl,
} from "@/lib/auth-email";
import {
  buildAuthEntryPagePath,
  buildAbsoluteApplicationUrl,
  buildEmailVerificationCallbackPath,
  buildEmailVerificationPagePath,
  buildMagicLinkPagePath,
  getSocialAuthErrorMessage,
  normalizeApplicationPath,
} from "@/lib/auth-urls";

test("buildPasswordResetApplicationUrl preserves token and callback destination", () => {
  const passwordResetUrl = buildPasswordResetApplicationUrl({
    callbackUrl: "/app",
    token: "reset-token-123",
  });
  const parsedResetUrl = new URL(passwordResetUrl);

  assert.equal(parsedResetUrl.pathname, "/reset-password");
  assert.equal(parsedResetUrl.searchParams.get("token"), "reset-token-123");
  assert.equal(parsedResetUrl.searchParams.get("callbackURL"), "/app");
});

test("buildEmailVerificationApplicationUrl preserves token and next destination", () => {
  const emailVerificationUrl = buildEmailVerificationApplicationUrl({
    callbackUrl: "/onboarding",
    token: "verification-token-123",
  });
  const parsedVerificationUrl = new URL(emailVerificationUrl);

  assert.equal(parsedVerificationUrl.pathname, "/verify-email");
  assert.equal(parsedVerificationUrl.searchParams.get("token"), "verification-token-123");
  assert.equal(parsedVerificationUrl.searchParams.get("next"), "/onboarding");
});

test("buildEmailVerificationCallbackPath returns a verified status route", () => {
  assert.equal(
    buildEmailVerificationCallbackPath({ nextPath: "/app" }),
    "/verify-email?status=verified&next=%2Fapp",
  );
});

test("buildEmailVerificationPagePath includes the email and verification state", () => {
  assert.equal(
    buildEmailVerificationPagePath({
      emailAddress: "test@roomflow.local",
      nextPath: "/onboarding",
      verificationErrorCode: "INVALID_TOKEN",
    }),
    "/verify-email?email=test%40roomflow.local&next=%2Fonboarding&error=INVALID_TOKEN",
  );
});

test("normalizeApplicationPath rejects external origins", () => {
  assert.equal(normalizeApplicationPath("https://evil.invalid/phish"), "/");
});

test("buildMagicLinkApplicationUrl preserves token, email, and next destination", () => {
  const magicLinkUrl = buildMagicLinkApplicationUrl({
    callbackUrl: "/app",
    recipientEmailAddress: "test@roomflow.local",
    token: "magic-token-123",
  });
  const parsedMagicLinkUrl = new URL(magicLinkUrl);

  assert.equal(parsedMagicLinkUrl.pathname, "/magic-link");
  assert.equal(parsedMagicLinkUrl.searchParams.get("token"), "magic-token-123");
  assert.equal(parsedMagicLinkUrl.searchParams.get("email"), "test@roomflow.local");
  assert.equal(parsedMagicLinkUrl.searchParams.get("next"), "/app");
});

test("buildMagicLinkPagePath includes recovery state", () => {
  assert.equal(
    buildMagicLinkPagePath({
      emailAddress: "test@roomflow.local",
      nextPath: "/app",
      status: "sent",
    }),
    "/magic-link?email=test%40roomflow.local&next=%2Fapp&status=sent",
  );
});

test("buildAuthEntryPagePath preserves callback, email, and error state", () => {
  assert.equal(
    buildAuthEntryPagePath({
      callbackPath: "/invite/test-token",
      emailAddress: "test@roomflow.local",
      entryPath: "/login",
      errorCode: "unable_to_link_account",
      providerId: "google",
    }),
    "/login?callbackURL=%2Finvite%2Ftest-token&email=test%40roomflow.local&error=unable_to_link_account&provider=google",
  );
});

test("buildAbsoluteApplicationUrl resolves normalized in-app paths", () => {
  assert.equal(buildAbsoluteApplicationUrl("/signup?callbackURL=%2Fapp"), "http://127.0.0.1:3001/signup?callbackURL=%2Fapp");
});

test("getSocialAuthErrorMessage explains explicit linking fallback", () => {
  assert.equal(
    getSocialAuthErrorMessage({ errorCode: "unable_to_link_account", providerId: "google" }),
    "Google found an existing Roomflow account for this email. Sign in with email first, then link Google from Security settings.",
  );
});

test("getSocialAuthErrorMessage explains Apple private relay fallback", () => {
  assert.equal(
    getSocialAuthErrorMessage({ errorCode: "email_doesn't_match", providerId: "apple" }),
    "Apple returned a private-relay email that does not match the email already attached to this Roomflow account. Sign in with your existing email first, then link Apple from Security settings.",
  );
});