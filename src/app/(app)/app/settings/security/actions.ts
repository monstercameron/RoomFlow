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

export async function linkSocialAccountAction(formData: FormData) {
  const providerId = String(formData.get("providerId") ?? "").trim();

  if (!isSocialAuthProviderId(providerId)) {
    redirectToSecuritySettings({ accountError: "Unsupported account provider." });
  }

  if (!getConfiguredSocialAuthProviderIds().includes(providerId)) {
    redirectToSecuritySettings({
      accountError: `${providerId} sign-in is not configured in this environment yet.`,
    });
  }

  try {
    const linkResult = (await auth.api.linkSocialAccount({
      body: {
        callbackURL: buildSecuritySettingsUrl({ accountStatus: `${providerId}-linked` }).toString(),
        disableRedirect: true,
        provider: providerId,
      },
      headers: await headers(),
    })) as {
      url?: string;
    };

    if (!linkResult.url) {
      redirectToSecuritySettings({
        accountError: `Unable to start ${providerId} account linking right now.`,
      });
    }

    redirect(linkResult.url);
  } catch (error) {
    redirectToSecuritySettings({
      accountError: getActionErrorMessage(error, `Unable to start ${providerId} account linking.`),
    });
  }
}

export async function unlinkAccountAction(formData: FormData) {
  const providerId = String(formData.get("providerId") ?? "").trim();
  const accountId = String(formData.get("accountId") ?? "").trim();

  if (!providerId || !accountId) {
    redirectToSecuritySettings({ accountError: "Missing linked account details." });
  }

  try {
    await auth.api.unlinkAccount({
      body: {
        accountId,
        providerId,
      },
      headers: await headers(),
    });

    revalidatePath(securitySettingsPath);
    redirectToSecuritySettings({ accountStatus: `${providerId}-unlinked` });
  } catch (error) {
    redirectToSecuritySettings({
      accountError: getActionErrorMessage(error, `Unable to unlink ${providerId}.`),
    });
  }
}

export async function setPasswordAction(formData: FormData) {
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (newPassword.length < 8) {
    redirectToSecuritySettings({
      accountError: "Choose a password with at least 8 characters.",
    });
  }

  if (newPassword !== confirmPassword) {
    redirectToSecuritySettings({ accountError: "Password confirmation does not match." });
  }

  try {
    await auth.api.setPassword({
      body: {
        newPassword,
      },
      headers: await headers(),
    });

    revalidatePath(securitySettingsPath);
    redirectToSecuritySettings({ accountStatus: "password-set" });
  } catch (error) {
    redirectToSecuritySettings({
      accountError: getActionErrorMessage(error, "Unable to add a password right now."),
    });
  }
}