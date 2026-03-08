export type SocialAuthProviderId = "google" | "facebook" | "microsoft" | "apple";

type SocialAuthProviderMetadata = {
  clientIdEnvironmentVariableName: string;
  clientSecretEnvironmentVariableName: string;
  description: string;
  label: string;
};

type SocialAuthProviderConfig = {
  clientId: string;
  clientSecret: string;
};

const socialAuthProviderMetadata: Record<SocialAuthProviderId, SocialAuthProviderMetadata> = {
  google: {
    clientIdEnvironmentVariableName: "GOOGLE_CLIENT_ID",
    clientSecretEnvironmentVariableName: "GOOGLE_CLIENT_SECRET",
    description: "Use a Google Workspace or Gmail identity as another sign-in method.",
    label: "Google",
  },
  facebook: {
    clientIdEnvironmentVariableName: "FACEBOOK_CLIENT_ID",
    clientSecretEnvironmentVariableName: "FACEBOOK_CLIENT_SECRET",
    description: "Link a Meta identity for operators who primarily work Facebook lead channels.",
    label: "Facebook",
  },
  microsoft: {
    clientIdEnvironmentVariableName: "MICROSOFT_CLIENT_ID",
    clientSecretEnvironmentVariableName: "MICROSOFT_CLIENT_SECRET",
    description: "Link a Microsoft identity for organization-managed workspaces.",
    label: "Microsoft",
  },
  apple: {
    clientIdEnvironmentVariableName: "APPLE_CLIENT_ID",
    clientSecretEnvironmentVariableName: "APPLE_CLIENT_SECRET",
    description: "Link an Apple identity for operators who prefer Sign in with Apple.",
    label: "Apple",
  },
};

export const supportedSocialAuthProviderIds = Object.keys(
  socialAuthProviderMetadata,
) as SocialAuthProviderId[];

export function getSocialAuthProviderMetadata(providerId: SocialAuthProviderId) {
  return socialAuthProviderMetadata[providerId];
}

export function isSocialAuthProviderId(candidateValue: string): candidateValue is SocialAuthProviderId {
  return supportedSocialAuthProviderIds.includes(candidateValue as SocialAuthProviderId);
}

// Social provider configuration is derived from env vars so linking stays dormant
// until the operator has real OAuth credentials in place.
export function getConfiguredSocialAuthProviders(
  environmentVariables: Record<string, string | undefined> = process.env,
) {
  const configuredSocialAuthProviders: Partial<
    Record<SocialAuthProviderId, SocialAuthProviderConfig>
  > = {};

  for (const socialAuthProviderId of supportedSocialAuthProviderIds) {
    const providerMetadata = getSocialAuthProviderMetadata(socialAuthProviderId);
    const clientId = environmentVariables[providerMetadata.clientIdEnvironmentVariableName]?.trim();
    const clientSecret = environmentVariables[
      providerMetadata.clientSecretEnvironmentVariableName
    ]?.trim();

    if (!clientId || !clientSecret) {
      continue;
    }

    configuredSocialAuthProviders[socialAuthProviderId] = {
      clientId,
      clientSecret,
    };
  }

  return configuredSocialAuthProviders;
}

export function getConfiguredSocialAuthProviderIds(
  environmentVariables: Record<string, string | undefined> = process.env,
) {
  return supportedSocialAuthProviderIds.filter((socialAuthProviderId) => {
    const providerMetadata = getSocialAuthProviderMetadata(socialAuthProviderId);

    return Boolean(
      environmentVariables[providerMetadata.clientIdEnvironmentVariableName]?.trim() &&
        environmentVariables[providerMetadata.clientSecretEnvironmentVariableName]?.trim(),
    );
  });
}