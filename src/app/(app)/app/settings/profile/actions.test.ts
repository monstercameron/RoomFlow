import assert from "node:assert/strict";
import test from "node:test";

import type {
  ChangeProfileEmailActionDependencies,
  UpdateProfileNameActionDependencies,
} from "./actions";

function getProfileActionsModule() {
  process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/template1";

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("./actions") as typeof import("./actions");
}

function createRedirectCapture() {
  const redirects: string[] = [];
  const redirectError = new Error("NEXT_REDIRECT");

  return {
    redirect: (path: string) => {
      redirects.push(path);
      throw redirectError;
    },
    redirectError,
    redirects,
  };
}

function createUpdateProfileNameDependencies(
  overrides: Partial<UpdateProfileNameActionDependencies> = {},
): UpdateProfileNameActionDependencies {
  return {
    getHeaders: async () => new Headers({ "x-test": "1" }),
    redirect: () => undefined as never,
    revalidatePath: () => undefined,
    updateUser: async () => undefined,
    ...overrides,
  };
}

function createChangeProfileEmailDependencies(
  overrides: Partial<ChangeProfileEmailActionDependencies> = {},
): ChangeProfileEmailActionDependencies {
  return {
    changeEmail: async () => undefined,
    getHeaders: async () => new Headers({ "x-test": "1" }),
    redirect: () => undefined as never,
    revalidatePath: () => undefined,
    ...overrides,
  };
}

test("handleUpdateProfileNameAction validates input and updates the current user name", async () => {
  const { handleUpdateProfileNameAction } = getProfileActionsModule();

  const missingNameRedirectCapture = createRedirectCapture();
  await assert.rejects(
    handleUpdateProfileNameAction(
      new FormData(),
      createUpdateProfileNameDependencies({
        redirect: missingNameRedirectCapture.redirect as never,
      }),
    ),
    missingNameRedirectCapture.redirectError,
  );

  assert.deepEqual(missingNameRedirectCapture.redirects, [
    "/app/settings/profile?profileError=Enter+a+display+name+before+saving.",
  ]);

  const updateUserCalls: Array<{ body: { name: string }; headers: Headers }> = [];
  const revalidatedPaths: string[] = [];
  const successRedirectCapture = createRedirectCapture();
  const formData = new FormData();
  formData.set("name", "  Cam Operator  ");

  await assert.rejects(
    handleUpdateProfileNameAction(
      formData,
      createUpdateProfileNameDependencies({
        redirect: successRedirectCapture.redirect as never,
        revalidatePath: (path) => {
          revalidatedPaths.push(path);
        },
        updateUser: async (input) => {
          updateUserCalls.push(input);
        },
      }),
    ),
    successRedirectCapture.redirectError,
  );

  assert.equal(updateUserCalls.length, 1);
  assert.deepEqual(updateUserCalls[0]?.body, {
    name: "Cam Operator",
  });
  assert.deepEqual(revalidatedPaths, [
    "/app/settings",
    "/app/settings/profile",
    "/app/settings/security",
  ]);
  assert.deepEqual(successRedirectCapture.redirects, [
    "/app/settings/profile?profileStatus=name-updated",
  ]);
});

test("handleChangeProfileEmailAction validates input and starts a verified email change", async () => {
  const { handleChangeProfileEmailAction } = getProfileActionsModule();

  const missingEmailRedirectCapture = createRedirectCapture();
  await assert.rejects(
    handleChangeProfileEmailAction(
      new FormData(),
      createChangeProfileEmailDependencies({
        redirect: missingEmailRedirectCapture.redirect as never,
      }),
    ),
    missingEmailRedirectCapture.redirectError,
  );

  assert.deepEqual(missingEmailRedirectCapture.redirects, [
    "/app/settings/profile?profileError=Enter+a+new+email+address+before+saving.",
  ]);

  const changeEmailCalls: Array<{
    body: {
      callbackURL: string;
      newEmail: string;
    };
    headers: Headers;
  }> = [];
  const successRedirectCapture = createRedirectCapture();
  const revalidatedPaths: string[] = [];
  const formData = new FormData();
  formData.set("newEmail", "  CAM@EXAMPLE.COM ");

  await assert.rejects(
    handleChangeProfileEmailAction(
      formData,
      createChangeProfileEmailDependencies({
        changeEmail: async (input) => {
          changeEmailCalls.push(input);
        },
        redirect: successRedirectCapture.redirect as never,
        revalidatePath: (path) => {
          revalidatedPaths.push(path);
        },
      }),
    ),
    successRedirectCapture.redirectError,
  );

  assert.equal(changeEmailCalls.length, 1);
  assert.deepEqual(changeEmailCalls[0]?.body, {
    callbackURL: "/app/settings/profile?profileStatus=email-updated",
    newEmail: "cam@example.com",
  });
  assert.deepEqual(revalidatedPaths, ["/app/settings/profile"]);
  assert.deepEqual(successRedirectCapture.redirects, [
    "/app/settings/profile?profileStatus=email-change-requested",
  ]);
});

test("profile actions surface auth errors through the profile page", async () => {
  const { handleChangeProfileEmailAction, handleUpdateProfileNameAction } = getProfileActionsModule();

  const nameErrorRedirectCapture = createRedirectCapture();
  const nameFormData = new FormData();
  nameFormData.set("name", "Cam");

  await assert.rejects(
    handleUpdateProfileNameAction(
      nameFormData,
      createUpdateProfileNameDependencies({
        redirect: nameErrorRedirectCapture.redirect as never,
        updateUser: async () => {
          throw {
            body: {
              message: "Name cannot be updated right now.",
            },
          };
        },
      }),
    ),
    nameErrorRedirectCapture.redirectError,
  );

  assert.deepEqual(nameErrorRedirectCapture.redirects, [
    "/app/settings/profile?profileError=Name+cannot+be+updated+right+now.",
  ]);

  const emailErrorRedirectCapture = createRedirectCapture();
  const emailFormData = new FormData();
  emailFormData.set("newEmail", "cam@example.com");

  await assert.rejects(
    handleChangeProfileEmailAction(
      emailFormData,
      createChangeProfileEmailDependencies({
        changeEmail: async () => {
          throw new Error("Change email is disabled");
        },
        redirect: emailErrorRedirectCapture.redirect as never,
      }),
    ),
    emailErrorRedirectCapture.redirectError,
  );

  assert.deepEqual(emailErrorRedirectCapture.redirects, [
    "/app/settings/profile?profileError=Change+email+is+disabled",
  ]);
});