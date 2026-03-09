import assert from "node:assert/strict";
import test from "node:test";

async function getExperimentalEmailVerificationCodeVerifyRouteModule() {
  process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";

  return import("./route");
}

test("verification code verify route redirects invalid verify-email codes back with an auth error code", async () => {
  const { handleExperimentalEmailVerificationCodeVerifyGet } =
    await getExperimentalEmailVerificationCodeVerifyRouteModule();

  const response = await handleExperimentalEmailVerificationCodeVerifyGet(
    new Request(
      "http://localhost/api/experimental/email-verification-codes/verify?code=ABCD-1234&surface=verify-email&returnTo=%2Fonboarding",
    ),
    {
      consumeCode: async () => ({ status: "invalid" }),
    },
  );

  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "http://localhost/verify-email?next=%2Fonboarding&error=INVALID_CODE");
});

test("verification code verify route redirects invalid profile codes back with a profile error", async () => {
  const { handleExperimentalEmailVerificationCodeVerifyGet } =
    await getExperimentalEmailVerificationCodeVerifyRouteModule();

  const response = await handleExperimentalEmailVerificationCodeVerifyGet(
    new Request(
      "http://localhost/api/experimental/email-verification-codes/verify?code=ABCD-1234&surface=profile&returnTo=%2Fapp%2Fsettings%2Fprofile%3FprofileStatus%3Demail-change-requested",
    ),
    {
      consumeCode: async () => ({ status: "expired" }),
    },
  );

  assert.equal(response.status, 307);
  assert.equal(
    response.headers.get("location"),
    "http://localhost/app/settings/profile?profileStatus=email-change-requested&profileError=That+security+code+expired.+Request+a+fresh+verification+email+and+try+again.",
  );
});

test("verification code verify route redirects successful codes into Better Auth verification", async () => {
  const { handleExperimentalEmailVerificationCodeVerifyGet } =
    await getExperimentalEmailVerificationCodeVerifyRouteModule();

  const response = await handleExperimentalEmailVerificationCodeVerifyGet(
    new Request(
      "http://localhost/api/experimental/email-verification-codes/verify?code=ABCD-1234&surface=profile&returnTo=%2Fapp%2Fsettings%2Fprofile",
    ),
    {
      consumeCode: async () => ({
        callbackPath: "/app/settings/profile?profileStatus=email-updated",
        code: "ABCD1234",
        emailAddress: "test@roomflow.local",
        expiresAt: new Date("2026-03-09T13:00:00.000Z"),
        formattedCode: "ABCD-1234",
        status: "verified",
        token: "verification-token-123",
      }),
    },
  );

  assert.equal(response.status, 307);
  assert.equal(
    response.headers.get("location"),
    "http://localhost/api/auth/verify-email?token=verification-token-123&callbackURL=%2Fapp%2Fsettings%2Fprofile%3FprofileStatus%3Demail-updated",
  );
});