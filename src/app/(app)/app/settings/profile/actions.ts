"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

const profileSettingsPath = "/app/settings/profile";
const settingsPath = "/app/settings";
const securitySettingsPath = "/app/settings/security";
const appFallbackBaseUrl = "http://127.0.0.1:3001";

function buildProfileSettingsUrl(searchParameters?: Record<string, string>) {
  const applicationBaseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL ?? appFallbackBaseUrl;
  const profileSettingsUrl = new URL(profileSettingsPath, applicationBaseUrl);

  for (const [searchParameterKey, searchParameterValue] of Object.entries(searchParameters ?? {})) {
    profileSettingsUrl.searchParams.set(searchParameterKey, searchParameterValue);
  }

  return profileSettingsUrl;
}

function redirectToProfileSettingsWithDependency(
  redirectDependency: typeof redirect,
  searchParameters?: Record<string, string>,
): never {
  const profileSettingsUrl = buildProfileSettingsUrl(searchParameters);

  redirectDependency(`${profileSettingsUrl.pathname}${profileSettingsUrl.search}`);
}

function getActionErrorMessage(error: unknown, fallbackMessage: string) {
  if (
    typeof error === "object" &&
    error !== null &&
    "body" in error &&
    typeof error.body === "object" &&
    error.body !== null &&
    "message" in error.body &&
    typeof error.body.message === "string"
  ) {
    return error.body.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallbackMessage;
}

export type UpdateProfileNameActionDependencies = {
  getHeaders: () => Promise<Headers>;
  redirect: typeof redirect;
  revalidatePath: typeof revalidatePath;
  updateUser: (input: {
    body: {
      name: string;
    };
    headers: Headers;
  }) => Promise<unknown>;
};

const defaultUpdateProfileNameActionDependencies: UpdateProfileNameActionDependencies = {
  getHeaders: async () => (await headers()) as unknown as Headers,
  redirect,
  revalidatePath,
  updateUser: (input) => auth.api.updateUser(input),
};

export async function handleUpdateProfileNameAction(
  formData: FormData,
  dependencies: UpdateProfileNameActionDependencies = defaultUpdateProfileNameActionDependencies,
) {
  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    redirectToProfileSettingsWithDependency(dependencies.redirect, {
      profileError: "Enter a display name before saving.",
    });
  }

  try {
    await dependencies.updateUser({
      body: {
        name,
      },
      headers: await dependencies.getHeaders(),
    });
  } catch (error) {
    redirectToProfileSettingsWithDependency(dependencies.redirect, {
      profileError: getActionErrorMessage(error, "Unable to update your profile name right now."),
    });
  }

  dependencies.revalidatePath(settingsPath);
  dependencies.revalidatePath(profileSettingsPath);
  dependencies.revalidatePath(securitySettingsPath);

  redirectToProfileSettingsWithDependency(dependencies.redirect, {
    profileStatus: "name-updated",
  });
}

export async function updateProfileNameAction(formData: FormData) {
  return handleUpdateProfileNameAction(formData);
}

export type ChangeProfileEmailActionDependencies = {
  changeEmail: (input: {
    body: {
      callbackURL: string;
      newEmail: string;
    };
    headers: Headers;
  }) => Promise<unknown>;
  getHeaders: () => Promise<Headers>;
  redirect: typeof redirect;
  revalidatePath: typeof revalidatePath;
};

const defaultChangeProfileEmailActionDependencies: ChangeProfileEmailActionDependencies = {
  changeEmail: (input) => auth.api.changeEmail(input),
  getHeaders: async () => (await headers()) as unknown as Headers,
  redirect,
  revalidatePath,
};

export async function handleChangeProfileEmailAction(
  formData: FormData,
  dependencies: ChangeProfileEmailActionDependencies = defaultChangeProfileEmailActionDependencies,
) {
  const newEmail = String(formData.get("newEmail") ?? "").trim().toLowerCase();

  if (!newEmail) {
    redirectToProfileSettingsWithDependency(dependencies.redirect, {
      profileError: "Enter a new email address before saving.",
    });
  }

  try {
    await dependencies.changeEmail({
      body: {
        callbackURL: `${profileSettingsPath}?profileStatus=email-updated`,
        newEmail,
      },
      headers: await dependencies.getHeaders(),
    });
  } catch (error) {
    redirectToProfileSettingsWithDependency(dependencies.redirect, {
      profileError: getActionErrorMessage(error, "Unable to start your email change right now."),
    });
  }

  dependencies.revalidatePath(profileSettingsPath);

  redirectToProfileSettingsWithDependency(dependencies.redirect, {
    profileStatus: "email-change-requested",
  });
}

export async function changeProfileEmailAction(formData: FormData) {
  return handleChangeProfileEmailAction(formData);
}