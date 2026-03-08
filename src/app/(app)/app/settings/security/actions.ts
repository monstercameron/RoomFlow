"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getConfiguredSocialAuthProviderIds,
  isSocialAuthProviderId,
} from "@/lib/auth-providers";

const securitySettingsPath = "/app/settings/security";
const fallbackApplicationBaseUrl = "http://127.0.0.1:3001";

function buildSecuritySettingsUrl(searchParameters?: Record<string, string>) {
  const applicationBaseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL ?? fallbackApplicationBaseUrl;
  const securitySettingsUrl = new URL(securitySettingsPath, applicationBaseUrl);

  for (const [searchParameterKey, searchParameterValue] of Object.entries(searchParameters ?? {})) {
    securitySettingsUrl.searchParams.set(searchParameterKey, searchParameterValue);
  }

  return securitySettingsUrl;
}

function redirectToSecuritySettings(searchParameters?: Record<string, string>): never {
  const securitySettingsUrl = buildSecuritySettingsUrl(searchParameters);

  redirect(`${securitySettingsUrl.pathname}${securitySettingsUrl.search}`);
}

function redirectToSecuritySettingsWithDependency(
  redirectDependency: typeof redirect,
  searchParameters?: Record<string, string>,
): never {
  const securitySettingsUrl = buildSecuritySettingsUrl(searchParameters);

  redirectDependency(`${securitySettingsUrl.pathname}${securitySettingsUrl.search}`);
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

export type LinkSocialAccountActionDependencies = {
  getConfiguredSocialAuthProviderIds: typeof getConfiguredSocialAuthProviderIds;
  getHeaders: () => Promise<Headers>;
  isSocialAuthProviderId: typeof isSocialAuthProviderId;
  linkSocialAccount: (input: {
    body: {
      callbackURL: string;
      disableRedirect: true;
      provider: string;
    };
    headers: Headers;
  }) => Promise<{ url?: string }>;
  redirect: typeof redirect;
};

const defaultLinkSocialAccountActionDependencies: LinkSocialAccountActionDependencies = {
  getConfiguredSocialAuthProviderIds,
  getHeaders: async () => (await headers()) as unknown as Headers,
  isSocialAuthProviderId,
  linkSocialAccount: (input) =>
    auth.api.linkSocialAccount(input) as Promise<{
      url?: string;
    }>,
  redirect,
};

export async function handleLinkSocialAccountAction(
  formData: FormData,
  dependencies: LinkSocialAccountActionDependencies = defaultLinkSocialAccountActionDependencies,
) {
  const providerId = String(formData.get("providerId") ?? "").trim();

  if (!dependencies.isSocialAuthProviderId(providerId)) {
    redirectToSecuritySettingsWithDependency(dependencies.redirect, {
      accountError: "Unsupported account provider.",
    });
  }

  if (!dependencies.getConfiguredSocialAuthProviderIds().includes(providerId)) {
    redirectToSecuritySettingsWithDependency(dependencies.redirect, {
      accountError: `${providerId} sign-in is not configured in this environment yet.`,
    });
  }

  let linkResult: { url?: string };

  try {
    linkResult = await dependencies.linkSocialAccount({
      body: {
        callbackURL: buildSecuritySettingsUrl({ accountStatus: `${providerId}-linked` }).toString(),
        disableRedirect: true,
        provider: providerId,
      },
      headers: await dependencies.getHeaders(),
    });
  } catch (error) {
    redirectToSecuritySettingsWithDependency(dependencies.redirect, {
      accountError: getActionErrorMessage(error, `Unable to start ${providerId} account linking.`),
    });
  }

  if (!linkResult.url) {
    redirectToSecuritySettingsWithDependency(dependencies.redirect, {
      accountError: `Unable to start ${providerId} account linking right now.`,
    });
  }

  dependencies.redirect(linkResult.url);
}

export async function linkSocialAccountAction(formData: FormData) {
  return handleLinkSocialAccountAction(formData);
}

export type UnlinkAccountActionDependencies = {
  getHeaders: () => Promise<Headers>;
  redirect: typeof redirect;
  revalidatePath: typeof revalidatePath;
  unlinkAccount: (input: {
    body: {
      accountId: string;
      providerId: string;
    };
    headers: Headers;
  }) => Promise<unknown>;
};

const defaultUnlinkAccountActionDependencies: UnlinkAccountActionDependencies = {
  getHeaders: async () => (await headers()) as unknown as Headers,
  redirect,
  revalidatePath,
  unlinkAccount: (input) => auth.api.unlinkAccount(input),
};

export async function handleUnlinkAccountAction(
  formData: FormData,
  dependencies: UnlinkAccountActionDependencies = defaultUnlinkAccountActionDependencies,
) {
  const providerId = String(formData.get("providerId") ?? "").trim();
  const accountId = String(formData.get("accountId") ?? "").trim();

  if (!providerId || !accountId) {
    redirectToSecuritySettingsWithDependency(dependencies.redirect, {
      accountError: "Missing linked account details.",
    });
  }

  try {
    await dependencies.unlinkAccount({
      body: {
        accountId,
        providerId,
      },
      headers: await dependencies.getHeaders(),
    });
  } catch (error) {
    redirectToSecuritySettingsWithDependency(dependencies.redirect, {
      accountError: getActionErrorMessage(error, `Unable to unlink ${providerId}.`),
    });
  }

  dependencies.revalidatePath(securitySettingsPath);
  redirectToSecuritySettingsWithDependency(dependencies.redirect, {
    accountStatus: `${providerId}-unlinked`,
  });
}

export async function unlinkAccountAction(formData: FormData) {
  return handleUnlinkAccountAction(formData);
}

export type SetPasswordActionDependencies = {
  getHeaders: () => Promise<Headers>;
  redirect: typeof redirect;
  revalidatePath: typeof revalidatePath;
  setPassword: (input: {
    body: {
      newPassword: string;
    };
    headers: Headers;
  }) => Promise<unknown>;
};

const defaultSetPasswordActionDependencies: SetPasswordActionDependencies = {
  getHeaders: async () => (await headers()) as unknown as Headers,
  redirect,
  revalidatePath,
  setPassword: (input) => auth.api.setPassword(input),
};

export async function handleSetPasswordAction(
  formData: FormData,
  dependencies: SetPasswordActionDependencies = defaultSetPasswordActionDependencies,
) {
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (newPassword.length < 8) {
    redirectToSecuritySettingsWithDependency(dependencies.redirect, {
      accountError: "Choose a password with at least 8 characters.",
    });
  }

  if (newPassword !== confirmPassword) {
    redirectToSecuritySettingsWithDependency(dependencies.redirect, {
      accountError: "Password confirmation does not match.",
    });
  }

  try {
    await dependencies.setPassword({
      body: {
        newPassword,
      },
      headers: await dependencies.getHeaders(),
    });
  } catch (error) {
    redirectToSecuritySettingsWithDependency(dependencies.redirect, {
      accountError: getActionErrorMessage(error, "Unable to add a password right now."),
    });
  }

  dependencies.revalidatePath(securitySettingsPath);
  redirectToSecuritySettingsWithDependency(dependencies.redirect, {
    accountStatus: "password-set",
  });
}

export async function setPasswordAction(formData: FormData) {
  return handleSetPasswordAction(formData);
}