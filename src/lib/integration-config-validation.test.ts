import assert from "node:assert/strict";
import test from "node:test";
import { validateInboundIntegrationConfiguration } from "./integration-config-validation";

test("validateInboundIntegrationConfiguration reports missing required provider config", () => {
  const issues = validateInboundIntegrationConfiguration({
    googleClientId: undefined,
    googleClientSecret: undefined,
    microsoftClientId: undefined,
    microsoftClientSecret: undefined,
    resendApiKey: undefined,
    resendFromEmail: undefined,
    twilioAccountSid: "replace-me",
    twilioAuthToken: "replace-me",
    twilioPhoneNumber: "",
    inboundWebhookSigningSecret: undefined,
  });

  assert.equal(issues.length > 0, true);
  assert.equal(
    issues.some((issue) => issue.key === "INBOUND_WEBHOOK_SIGNING_SECRET"),
    true,
  );
});

test("validateInboundIntegrationConfiguration returns no issues when all required values are set", () => {
  const issues = validateInboundIntegrationConfiguration({
    googleClientId: "google-client-id",
    googleClientSecret: "google-client-secret",
    microsoftClientId: "microsoft-client-id",
    microsoftClientSecret: "microsoft-client-secret",
    resendApiKey: "re_xxx",
    resendFromEmail: "noreply@example.com",
    twilioAccountSid: "AC123",
    twilioAuthToken: "token123",
    twilioPhoneNumber: "+15550001111",
    inboundWebhookSigningSecret: "secret",
  });

  assert.deepEqual(issues, []);
});
