import assert from "node:assert/strict";
import test from "node:test";

async function getSignupPreflightRouteModule() {
  process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";

  return import("./route");
}

test("signup preflight requires an email address", async () => {
  const { handleSignupPreflightPost } = await getSignupPreflightRouteModule();
  const response = await handleSignupPreflightPost(
    new Request("http://localhost/api/auth/signup-preflight", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    }),
    {
      findUserByEmail: async () => null,
    },
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { message: "Email is required." });
});

test("signup preflight reports whether the email already exists", async () => {
  const { handleSignupPreflightPost } = await getSignupPreflightRouteModule();
  const existingResponse = await handleSignupPreflightPost(
    new Request("http://localhost/api/auth/signup-preflight", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "owner@roomflow.local" }),
    }),
    {
      findUserByEmail: async () => ({ id: "user_1" }),
    },
  );

  assert.equal(existingResponse.status, 200);
  assert.deepEqual(await existingResponse.json(), { exists: true });

  const missingResponse = await handleSignupPreflightPost(
    new Request("http://localhost/api/auth/signup-preflight", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "new@roomflow.local" }),
    }),
    {
      findUserByEmail: async () => null,
    },
  );

  assert.equal(missingResponse.status, 200);
  assert.deepEqual(await missingResponse.json(), { exists: false });
});