import assert from "node:assert/strict";
import test from "node:test";

async function getMessageDeliveryModule() {
  process.env.DATABASE_URL ??=
    "postgresql://postgres:postgres@localhost:5432/template1";

  return import("./message-delivery");
}

test("isProviderConfigurationError detects missing provider configuration errors", async () => {
  const { isProviderConfigurationError } = await getMessageDeliveryModule();

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
});

test("isProviderConfigurationError ignores runtime delivery failures", async () => {
  const { isProviderConfigurationError } = await getMessageDeliveryModule();

  assert.equal(
    isProviderConfigurationError("Lead is missing an email address."),
    false,
  );
  assert.equal(
    isProviderConfigurationError("503 upstream provider timeout."),
    false,
  );
});
