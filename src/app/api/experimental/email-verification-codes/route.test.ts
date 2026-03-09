import assert from "node:assert/strict";
import test from "node:test";

async function getExperimentalEmailVerificationCodeRouteModule() {
  process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";

  return import("./route");
}

test("experimental verification code route requires the feature flag and an email address", async () => {
  const { handleExperimentalEmailVerificationCodesGet } = await getExperimentalEmailVerificationCodeRouteModule();

  const disabledResponse = await handleExperimentalEmailVerificationCodesGet(
    new Request("http://localhost/api/experimental/email-verification-codes?email=test@roomflow.local"),
    {
      fetch,
      isEnabled: () => false,
      peekLatestCode: async () => null,
    },
  );

  assert.equal(disabledResponse.status, 403);
  assert.deepEqual(await disabledResponse.json(), {
    message: "Experimental verification codes are unavailable.",
  });

  const missingEmailResponse = await handleExperimentalEmailVerificationCodesGet(
    new Request("http://localhost/api/experimental/email-verification-codes"),
    {
      fetch,
      isEnabled: () => true,
      peekLatestCode: async () => null,
    },
  );

  assert.equal(missingEmailResponse.status, 400);
  assert.deepEqual(await missingEmailResponse.json(), { message: "Email is required." });
});

test("experimental verification code route returns the latest captured code", async () => {
  const { handleExperimentalEmailVerificationCodesGet } = await getExperimentalEmailVerificationCodeRouteModule();

  const response = await handleExperimentalEmailVerificationCodesGet(
    new Request("http://localhost/api/experimental/email-verification-codes?email=test@roomflow.local"),
    {
      fetch,
      isEnabled: () => true,
      peekLatestCode: async () => ({
        callbackPath: "/verify-email?status=verified",
        code: "ABCD1234",
        emailAddress: "test@roomflow.local",
        expiresAt: new Date("2026-03-09T13:00:00.000Z"),
        formattedCode: "ABCD-1234",
        token: "verification-token-123",
      }),
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    callbackPath: "/verify-email?status=verified",
    code: "ABCD-1234",
    email: "test@roomflow.local",
    expiresAt: "2026-03-09T13:00:00.000Z",
  });
});

test("experimental verification code route can generate a fresh code by reissuing verification email", async () => {
  const { handleExperimentalEmailVerificationCodesPost } = await getExperimentalEmailVerificationCodeRouteModule();
  const fetchCalls: Array<{ input: string; init?: RequestInit }> = [];

  const response = await handleExperimentalEmailVerificationCodesPost(
    new Request("http://localhost/api/experimental/email-verification-codes", {
      body: JSON.stringify({
        callbackURL: "/verify-email?status=verified",
        email: "test@roomflow.local",
      }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    }),
    {
      fetch: async (input, init) => {
        fetchCalls.push({ input: String(input), init });
        return new Response(JSON.stringify({ status: true }), {
          headers: {
            "content-type": "application/json",
          },
          status: 200,
        });
      },
      isEnabled: () => true,
      peekLatestCode: async () => ({
        callbackPath: "/verify-email?status=verified",
        code: "ABCD1234",
        emailAddress: "test@roomflow.local",
        expiresAt: new Date("2026-03-09T13:00:00.000Z"),
        formattedCode: "ABCD-1234",
        token: "verification-token-123",
      }),
    },
  );

  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0]?.input, "http://localhost/api/auth/send-verification-email");
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    callbackPath: "/verify-email?status=verified",
    code: "ABCD-1234",
    email: "test@roomflow.local",
    expiresAt: "2026-03-09T13:00:00.000Z",
    status: true,
  });
});