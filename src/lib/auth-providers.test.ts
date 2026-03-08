import assert from "node:assert/strict";
import test from "node:test";
import {
  getConfiguredSocialAuthProviderIds,
  getConfiguredSocialAuthProviders,
  getSocialAuthProviderMetadata,
  isSocialAuthProviderId,
} from "@/lib/auth-providers";

test("getConfiguredSocialAuthProviderIds returns only fully configured providers", () => {
  const configuredSocialAuthProviderIds = getConfiguredSocialAuthProviderIds({
    APPLE_CLIENT_ID: "apple-client-id",
    APPLE_CLIENT_SECRET: "apple-client-secret",
    GOOGLE_CLIENT_ID: "google-client-id",
    GOOGLE_CLIENT_SECRET: "",
    MICROSOFT_CLIENT_ID: "microsoft-client-id",
  });

  assert.deepEqual(configuredSocialAuthProviderIds, ["apple"]);
});

test("getConfiguredSocialAuthProviders maps configured env vars to Better Auth provider config", () => {
  const configuredSocialAuthProviders = getConfiguredSocialAuthProviders({
    FACEBOOK_CLIENT_ID: "facebook-client-id",
    FACEBOOK_CLIENT_SECRET: "facebook-client-secret",
  });

  assert.deepEqual(configuredSocialAuthProviders, {
    facebook: {
      clientId: "facebook-client-id",
      clientSecret: "facebook-client-secret",
    },
  });
});

test("isSocialAuthProviderId accepts supported providers only", () => {
  assert.equal(isSocialAuthProviderId("google"), true);
  assert.equal(isSocialAuthProviderId("github"), false);
});

test("getSocialAuthProviderMetadata exposes label and env var names", () => {
  assert.deepEqual(getSocialAuthProviderMetadata("microsoft"), {
    clientIdEnvironmentVariableName: "MICROSOFT_CLIENT_ID",
    clientSecretEnvironmentVariableName: "MICROSOFT_CLIENT_SECRET",
    description: "Link a Microsoft identity for organization-managed workspaces.",
    label: "Microsoft",
  });
});