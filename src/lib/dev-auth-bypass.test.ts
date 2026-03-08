import assert from "node:assert/strict";
import test from "node:test";
import { isDevelopmentModeVerificationBypassEnabled } from "./dev-auth-bypass";

test("isDevelopmentModeVerificationBypassEnabled only enables the seeded local account outside production", () => {
  const mutableEnvironment = process.env as Record<string, string | undefined>;
  const originalNodeEnvironment = process.env.NODE_ENV;

  mutableEnvironment.NODE_ENV = "development";
  assert.equal(
    isDevelopmentModeVerificationBypassEnabled("test@roomflow.local"),
    true,
  );
  assert.equal(
    isDevelopmentModeVerificationBypassEnabled("TEST@ROOMFLOW.LOCAL"),
    true,
  );
  assert.equal(
    isDevelopmentModeVerificationBypassEnabled("someone@example.com"),
    false,
  );

  mutableEnvironment.NODE_ENV = "production";
  assert.equal(
    isDevelopmentModeVerificationBypassEnabled("test@roomflow.local"),
    false,
  );

  if (originalNodeEnvironment === undefined) {
    delete mutableEnvironment.NODE_ENV;
  } else {
    mutableEnvironment.NODE_ENV = originalNodeEnvironment;
  }
});