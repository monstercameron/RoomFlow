import { headers } from "next/headers";
import { cache } from "react";
import { auth } from "@/lib/auth";
import {
  getConfiguredSocialAuthProviderIds,
  getSocialAuthProviderMetadata,
  isSocialAuthProviderId,
  supportedSocialAuthProviderIds,
  type SocialAuthProviderId,
} from "@/lib/auth-providers";

type RawUserAccountRecord = {
  accountId: string;
  createdAt: Date;
  id: string;
  providerId: string;
  scopes?: string[];
  updatedAt: Date;
};

export type LinkedAccountRecord = {
  accountId: string;
  createdAt: Date;
  id: string;
  label: string;
  providerId: string;
  scopes: string[];
  updatedAt: Date;
};

export type AvailableSocialAuthProvider = {
  description: string;
  environmentVariableNames: string[];
  isConfigured: boolean;
  isLinked: boolean;
  label: string;
  providerId: SocialAuthProviderId;
};

export const getAccountMethodSettings = cache(async () => {
  let rawUserAccounts: RawUserAccountRecord[] = [];

  try {
    rawUserAccounts = (await auth.api.listUserAccounts({
      headers: await headers(),
    })) as RawUserAccountRecord[];
  } catch (error) {
    console.error("Failed to load linked auth accounts:", error);
  }

  const linkedAccounts = rawUserAccounts.map((rawUserAccount) => ({
    accountId: rawUserAccount.accountId,
    createdAt: rawUserAccount.createdAt,
    id: rawUserAccount.id,
    label:
      rawUserAccount.providerId === "credential"
        ? "Password"
        : isSocialAuthProviderId(rawUserAccount.providerId)
          ? getSocialAuthProviderMetadata(rawUserAccount.providerId).label
          : rawUserAccount.providerId,
    providerId: rawUserAccount.providerId,
    scopes: rawUserAccount.scopes ?? [],
    updatedAt: rawUserAccount.updatedAt,
  }));

  const linkedSocialProviderIds = new Set(
    linkedAccounts
      .map((linkedAccount) => linkedAccount.providerId)
      .filter((providerId): providerId is SocialAuthProviderId => isSocialAuthProviderId(providerId)),
  );
  const configuredSocialProviderIds = new Set(getConfiguredSocialAuthProviderIds());
  const linkedSocialAccounts = linkedAccounts.filter((linkedAccount) =>
    isSocialAuthProviderId(linkedAccount.providerId),
  );

  const availableSocialProviders: AvailableSocialAuthProvider[] = supportedSocialAuthProviderIds.map(
    (socialAuthProviderId) => {
      const providerMetadata = getSocialAuthProviderMetadata(socialAuthProviderId);

      return {
        description: providerMetadata.description,
        environmentVariableNames: [
          providerMetadata.clientIdEnvironmentVariableName,
          providerMetadata.clientSecretEnvironmentVariableName,
        ],
        isConfigured: configuredSocialProviderIds.has(socialAuthProviderId),
        isLinked: linkedSocialProviderIds.has(socialAuthProviderId),
        label: providerMetadata.label,
        providerId: socialAuthProviderId,
      };
    },
  );

  return {
    availableSocialProviders,
    hasPasswordAccount: linkedAccounts.some(
      (linkedAccount) => linkedAccount.providerId === "credential",
    ),
    linkedAccounts,
    linkedSocialAccounts,
  };
});