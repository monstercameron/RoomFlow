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

export type StartSocialSignInActionDependencies = {
  buildAbsoluteApplicationUrl: typeof buildAbsoluteApplicationUrl;
  buildAuthEntryPagePath: typeof buildAuthEntryPagePath;
  getConfiguredSocialAuthProviderIds: typeof getConfiguredSocialAuthProviderIds;
  getHeaders: typeof headers;
  isSocialAuthProviderId: typeof isSocialAuthProviderId;
  normalizeApplicationPath: typeof normalizeApplicationPath;
  redirect: typeof redirect;
  signInSocial: (params: {
    body: {
      callbackURL: string;
      disableRedirect: true;
      provider: string;
    };
    headers: Awaited<ReturnType<typeof headers>>;
  }) => Promise<{ url?: string }>;
};

const defaultStartSocialSignInActionDependencies: StartSocialSignInActionDependencies = {
  buildAbsoluteApplicationUrl,
  buildAuthEntryPagePath,
  getConfiguredSocialAuthProviderIds,
  getHeaders: headers,
  isSocialAuthProviderId,
  normalizeApplicationPath,
  redirect,
  signInSocial: (params) => auth.api.signInSocial(params) as Promise<{ url?: string }>,
};

function redirectToAuthEntryPageWithDependencies(
  params: {
    callbackPath: string;
    emailAddress?: string;
    entryPath: "/login" | "/signup";
    errorCode: string;
    providerId?: string;
  },
  dependencies: Pick<StartSocialSignInActionDependencies, "buildAuthEntryPagePath" | "redirect">,
): never {
  dependencies.redirect(
    dependencies.buildAuthEntryPagePath({
      callbackPath: params.callbackPath,
      emailAddress: params.emailAddress,
      entryPath: params.entryPath,
      errorCode: params.errorCode,
      providerId: params.providerId,
    }),
  );
}

export async function handleStartSocialSignInAction(
  formData: FormData,
  dependencies: StartSocialSignInActionDependencies = defaultStartSocialSignInActionDependencies,
) {
  const providerId = String(formData.get("providerId") ?? "").trim();
  const entryPathValue = String(formData.get("entryPath") ?? "").trim();
  const callbackPath = dependencies.normalizeApplicationPath(
    String(formData.get("callbackPath") ?? "/onboarding"),
  );
  const emailAddress = String(formData.get("emailAddress") ?? "").trim() || undefined;

  if (entryPathValue !== "/login" && entryPathValue !== "/signup") {
    dependencies.redirect(
      dependencies.buildAuthEntryPagePath({
        callbackPath,
        entryPath: "/login",
        errorCode: "invalid_entry",
      }),
    );
  }

  if (!dependencies.isSocialAuthProviderId(providerId)) {
    redirectToAuthEntryPageWithDependencies({
      callbackPath,
      emailAddress,
      entryPath: entryPathValue,
      errorCode: "provider_not_supported",
      providerId,
    }, dependencies);
  }

  if (!dependencies.getConfiguredSocialAuthProviderIds().includes(providerId)) {
    redirectToAuthEntryPageWithDependencies({
      callbackPath,
      emailAddress,
      entryPath: entryPathValue,
      errorCode: "provider_not_configured",
      providerId,
    }, dependencies);
  }

  let signInResult: { url?: string };

  try {
    signInResult = await dependencies.signInSocial({
      body: {
        callbackURL: dependencies.buildAbsoluteApplicationUrl(
          dependencies.buildAuthEntryPagePath({
            callbackPath,
            emailAddress,
            entryPath: entryPathValue,
            providerId,
          }),
        ),
        disableRedirect: true,
        provider: providerId,
      },
      headers: await dependencies.getHeaders(),
    });
  } catch {
    redirectToAuthEntryPageWithDependencies({
      callbackPath,
      emailAddress,
      entryPath: entryPathValue,
      errorCode: "social_sign_in_failed",
      providerId,
    }, dependencies);
  }

  if (!signInResult.url) {
    redirectToAuthEntryPageWithDependencies({
      callbackPath,
      emailAddress,
      entryPath: entryPathValue,
      errorCode: "social_sign_in_failed",
      providerId,
    }, dependencies);
  }

  dependencies.redirect(signInResult.url);
}

export async function startSocialSignInAction(formData: FormData) {
  return handleStartSocialSignInAction(formData);
}