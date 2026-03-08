import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEmailVerificationApplicationUrl,
  buildMagicLinkApplicationUrl,
  buildPasswordResetApplicationUrl,
} from "@/lib/auth-email";
import {
  buildEmailVerificationCallbackPath,
  buildEmailVerificationPagePath,
  buildMagicLinkPagePath,
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