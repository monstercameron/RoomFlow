import assert from "node:assert/strict";
import test from "node:test";
import { validateInboundIntegrationConfiguration } from "./integration-config-validation";

test("validateInboundIntegrationConfiguration reports missing required provider config", () => {
  const issues = validateInboundIntegrationConfiguration({
    emailDeliveryProvider: "resend",
    emailFromAddress: undefined,
    googleClientId: undefined,
    googleClientSecret: undefined,
    microsoftClientId: undefined,
    microsoftClientSecret: undefined,
    resendApiKey: undefined,
    resendFromEmail: undefined,
    awsRegion: undefined,
    awsDefaultRegion: undefined,
    awsAccessKeyId: undefined,
    awsSecretAccessKey: undefined,
    sesFromEmail: undefined,
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

test("validateInboundIntegrationConfiguration reports mock mode as a testing warning", () => {
  const issues = validateInboundIntegrationConfiguration({
    emailDeliveryProvider: "mock",
    emailFromAddress: undefined,
    googleClientId: "google-client-id",
    googleClientSecret: "google-client-secret",
    microsoftClientId: "microsoft-client-id",
    microsoftClientSecret: "microsoft-client-secret",
    resendApiKey: undefined,
    resendFromEmail: undefined,
    awsRegion: undefined,
    awsDefaultRegion: undefined,
    awsAccessKeyId: undefined,
    awsSecretAccessKey: undefined,
    sesFromEmail: undefined,
    twilioAccountSid: "AC123",
    twilioAuthToken: "token123",
    twilioPhoneNumber: "+15550001111",
    inboundWebhookSigningSecret: "secret",
  });

  assert.equal(
    issues.some((issue) => issue.key === "EMAIL_DELIVERY_PROVIDER"),
    true,
  );
  assert.equal(
    issues.some((issue) => issue.key === "RESEND_API_KEY"),
    false,
  );
});

test("validateInboundIntegrationConfiguration returns no issues when all required values are set", () => {
  const issues = validateInboundIntegrationConfiguration({
    emailDeliveryProvider: "resend",
    emailFromAddress: "noreply@example.com",
    googleClientId: "google-client-id",
    googleClientSecret: "google-client-secret",
    microsoftClientId: "microsoft-client-id",
    microsoftClientSecret: "microsoft-client-secret",
    resendApiKey: "re_xxx",
    resendFromEmail: "noreply@example.com",
    awsRegion: undefined,
    awsDefaultRegion: undefined,
    awsAccessKeyId: undefined,
    awsSecretAccessKey: undefined,
    sesFromEmail: undefined,
    twilioAccountSid: "AC123",
    twilioAuthToken: "token123",
    twilioPhoneNumber: "+15550001111",
    inboundWebhookSigningSecret: "secret",
  });

  assert.deepEqual(issues, []);
});

test("validateInboundIntegrationConfiguration checks SES-specific prerequisites when SES is selected", () => {
  const issues = validateInboundIntegrationConfiguration({
    emailDeliveryProvider: "ses",
    emailFromAddress: undefined,
    googleClientId: "google-client-id",
    googleClientSecret: "google-client-secret",
    microsoftClientId: "microsoft-client-id",
    microsoftClientSecret: "microsoft-client-secret",
    resendApiKey: undefined,
    resendFromEmail: undefined,
    awsRegion: undefined,
    awsDefaultRegion: undefined,
    awsAccessKeyId: "AKIA123",
    awsSecretAccessKey: undefined,
    sesFromEmail: undefined,
    twilioAccountSid: "AC123",
    twilioAuthToken: "token123",
    twilioPhoneNumber: "+15550001111",
    inboundWebhookSigningSecret: "secret",
  });

  assert.equal(
    issues.some((issue) => issue.key === "AWS_REGION / AWS_DEFAULT_REGION"),
    true,
  );
  assert.equal(
    issues.some((issue) => issue.key === "AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY"),
    true,
  );
  assert.equal(
    issues.some((issue) => issue.key === "EMAIL_FROM_ADDRESS / SES_FROM_EMAIL"),
    true,
  );
});
