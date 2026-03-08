import assert from "node:assert/strict";
import test from "node:test";
import type { AccountMethodSettingsDependencies } from "@/lib/auth-accounts";

function getAuthAccountsModule() {
  process.env.DATABASE_URL ??=
    "postgresql://postgres:postgres@localhost:5432/template1";

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("./auth-accounts") as typeof import("@/lib/auth-accounts");
}

test("loadAccountMethodSettings maps linked accounts and configured providers", async () => {
  const { loadAccountMethodSettings } = getAuthAccountsModule();
  const dependencies: AccountMethodSettingsDependencies = {
    getConfiguredProviderIds: () => ["google"],
    getRequestHeaders: async () => new Headers({ cookie: "session=1" }),
    listUserAccounts: async ({ headers }) => {
      assert.equal(headers.get("cookie"), "session=1");
      return [
        {
          accountId: "account-password",
          createdAt: new Date("2026-03-08T00:00:00.000Z"),
          id: "linked-password",
          providerId: "credential",
          scopes: undefined,
          updatedAt: new Date("2026-03-08T00:00:00.000Z"),
        },
        {
          accountId: "account-google",
          createdAt: new Date("2026-03-08T00:00:00.000Z"),
          id: "linked-google",
          providerId: "google",
          scopes: ["email"],
          updatedAt: new Date("2026-03-08T00:00:00.000Z"),
        },
      ];
    },
  };

  const result = await loadAccountMethodSettings(dependencies);

  assert.equal(result.hasPasswordAccount, true);
  assert.equal(result.linkedAccounts[0]?.label, "Password");
  assert.equal(result.linkedSocialAccounts[0]?.label, "Google");
  assert.equal(
    result.availableSocialProviders.find((provider) => provider.providerId === "google")?.isConfigured,
    true,
  );
  assert.equal(
    result.availableSocialProviders.find((provider) => provider.providerId === "google")?.isLinked,
    true,
  );
});

test("loadAccountMethodSettings falls back to empty linked state when auth lookup fails", async () => {
  const { loadAccountMethodSettings } = getAuthAccountsModule();
  const capturedErrors: unknown[] = [];
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    capturedErrors.push(args);
  };

  try {
    const dependencies: AccountMethodSettingsDependencies = {
      getConfiguredProviderIds: () => ["facebook"],
      getRequestHeaders: async () => new Headers(),
      listUserAccounts: async () => {
        throw new Error("Auth unavailable");
      },
    };

    const result = await loadAccountMethodSettings(dependencies);

    assert.deepEqual(result.linkedAccounts, []);
    assert.deepEqual(result.linkedSocialAccounts, []);
    assert.equal(result.hasPasswordAccount, false);
    assert.equal(
      result.availableSocialProviders.find((provider) => provider.providerId === "facebook")?.isConfigured,
      true,
    );
    assert.equal(capturedErrors.length, 1);
  } finally {
    console.error = originalConsoleError;
  }
});