import assert from "node:assert/strict";
import test from "node:test";

function getMessageDeliveryModule() {
  process.env.DATABASE_URL ??=
    "postgresql://postgres:postgres@localhost:5432/template1";

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("./message-delivery");
}

test("isProviderConfigurationError detects missing provider configuration errors", () => {
  const { isProviderConfigurationError } = getMessageDeliveryModule();

  assert.equal(
    isProviderConfigurationError("RESEND_API_KEY is not configured."),
    true,
  );
  assert.equal(
    isProviderConfigurationError("TWILIO_PHONE_NUMBER is not configured."),
    true,
  );
  assert.equal(
    isProviderConfigurationError("TWILIO_AUTH_TOKEN is replace-me and must be updated."),
    true,
  );
  assert.equal(
    isProviderConfigurationError("EMAIL_FROM_ADDRESS or SES_FROM_EMAIL is not configured."),
    true,
  );
});

test("isProviderConfigurationError ignores runtime delivery failures", () => {
  const { isProviderConfigurationError } = getMessageDeliveryModule();

  assert.equal(
    isProviderConfigurationError("Lead is missing an email address."),
    false,
  );
  assert.equal(
    isProviderConfigurationError("503 upstream provider timeout."),
    false,
  );
});
