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
  inviteToken?: string;
  plan?: string;
  providerId?: string;
  source?: string;
  utmCampaign?: string;
}): never {
  redirect(
    buildAuthEntryPagePath({
      callbackPath: params.callbackPath,
      emailAddress: params.emailAddress,
      entryPath: params.entryPath,
      errorCode: params.errorCode,
      inviteToken: params.inviteToken,
      plan: params.plan,
      providerId: params.providerId,
      source: params.source,
      utmCampaign: params.utmCampaign,
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
    inviteToken?: string;
    plan?: string;
    providerId?: string;
    source?: string;
    utmCampaign?: string;
  },
  dependencies: Pick<StartSocialSignInActionDependencies, "buildAuthEntryPagePath" | "redirect">,
): never {
  dependencies.redirect(
    dependencies.buildAuthEntryPagePath({
      callbackPath: params.callbackPath,
      emailAddress: params.emailAddress,
      entryPath: params.entryPath,
      errorCode: params.errorCode,
      inviteToken: params.inviteToken,
      plan: params.plan,
      providerId: params.providerId,
      source: params.source,
      utmCampaign: params.utmCampaign,
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
  const inviteToken = String(formData.get("inviteToken") ?? "").trim() || undefined;
  const plan = String(formData.get("plan") ?? "").trim() || undefined;
  const source = String(formData.get("source") ?? "").trim() || undefined;
  const utmCampaign = String(formData.get("utmCampaign") ?? "").trim() || undefined;

  if (entryPathValue !== "/login" && entryPathValue !== "/signup") {
    dependencies.redirect(
      dependencies.buildAuthEntryPagePath({
        callbackPath,
        entryPath: "/login",
        errorCode: "invalid_entry",
        inviteToken,
        plan,
        source,
        utmCampaign,
      }),
    );
  }

  if (!dependencies.isSocialAuthProviderId(providerId)) {
    redirectToAuthEntryPageWithDependencies({
      callbackPath,
      emailAddress,
      entryPath: entryPathValue,
      errorCode: "provider_not_supported",
      inviteToken,
      plan,
      providerId,
      source,
      utmCampaign,
    }, dependencies);
  }

  if (!dependencies.getConfiguredSocialAuthProviderIds().includes(providerId)) {
    redirectToAuthEntryPageWithDependencies({
      callbackPath,
      emailAddress,
      entryPath: entryPathValue,
      errorCode: "provider_not_configured",
      inviteToken,
      plan,
      providerId,
      source,
      utmCampaign,
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
            inviteToken,
            plan,
            providerId,
            source,
            utmCampaign,
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
      inviteToken,
      plan,
      providerId,
      source,
      utmCampaign,
    }, dependencies);
  }

  if (!signInResult.url) {
    redirectToAuthEntryPageWithDependencies({
      callbackPath,
      emailAddress,
      entryPath: entryPathValue,
      errorCode: "social_sign_in_failed",
      inviteToken,
      plan,
      providerId,
      source,
      utmCampaign,
    }, dependencies);
  }

  dependencies.redirect(signInResult.url);
}

export async function startSocialSignInAction(formData: FormData) {
  return handleStartSocialSignInAction(formData);
}