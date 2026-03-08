"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getConfiguredSocialAuthProviderIds,
  isSocialAuthProviderId,
} from "@/lib/auth-providers";
import {
  buildAbsoluteApplicationUrl,
  buildAuthEntryPagePath,
  normalizeApplicationPath,
} from "@/lib/auth-urls";

function redirectToAuthEntryPage(params: {
  callbackPath: string;
  emailAddress?: string;
  entryPath: "/login" | "/signup";
  errorCode: string;
  providerId?: string;
}): never {
  redirect(
    buildAuthEntryPagePath({
      callbackPath: params.callbackPath,
      emailAddress: params.emailAddress,
      entryPath: params.entryPath,
      errorCode: params.errorCode,
      providerId: params.providerId,
    }),
  );
}

export async function startSocialSignInAction(formData: FormData) {
  const providerId = String(formData.get("providerId") ?? "").trim();
  const entryPathValue = String(formData.get("entryPath") ?? "").trim();
  const callbackPath = normalizeApplicationPath(String(formData.get("callbackPath") ?? "/onboarding"));
  const emailAddress = String(formData.get("emailAddress") ?? "").trim() || undefined;

  if (entryPathValue !== "/login" && entryPathValue !== "/signup") {
    redirect(buildAuthEntryPagePath({ callbackPath, entryPath: "/login", errorCode: "invalid_entry" }));
  }

  if (!isSocialAuthProviderId(providerId)) {
    redirectToAuthEntryPage({
      callbackPath,
      emailAddress,
      entryPath: entryPathValue,
      errorCode: "provider_not_supported",
      providerId,
    });
  }

  if (!getConfiguredSocialAuthProviderIds().includes(providerId)) {
    redirectToAuthEntryPage({
      callbackPath,
      emailAddress,
      entryPath: entryPathValue,
      errorCode: "provider_not_configured",
      providerId,
    });
  }

  try {
    const signInResult = (await auth.api.signInSocial({
      body: {
        callbackURL: buildAbsoluteApplicationUrl(
          buildAuthEntryPagePath({
            callbackPath,
            emailAddress,
            entryPath: entryPathValue,
            providerId,
          }),
        ),
        disableRedirect: true,
        provider: providerId,
      },
      headers: await headers(),
    })) as {
      url?: string;
    };

    if (!signInResult.url) {
      redirectToAuthEntryPage({
        callbackPath,
        emailAddress,
        entryPath: entryPathValue,
        errorCode: "social_sign_in_failed",
        providerId,
      });
    }

    redirect(signInResult.url);
  } catch {
    redirectToAuthEntryPage({
      callbackPath,
      emailAddress,
      entryPath: entryPathValue,
      errorCode: "social_sign_in_failed",
      providerId,
    });
  }
}