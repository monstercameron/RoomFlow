const fallbackApplicationBaseUrl = "http://127.0.0.1:3001";

function getApplicationBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL ?? fallbackApplicationBaseUrl;
}

export function buildAbsoluteApplicationUrl(candidatePath?: string | null) {
  const applicationBaseUrl = new URL(getApplicationBaseUrl());
  const normalizedCandidatePath = normalizeApplicationPath(candidatePath);

  return new URL(normalizedCandidatePath, applicationBaseUrl).toString();
}

export function normalizeApplicationPath(candidatePath?: string | null) {
  if (!candidatePath) {
    return "/";
  }

  try {
    const applicationBaseUrl = new URL(getApplicationBaseUrl());
    const resolvedCandidateUrl = new URL(candidatePath, applicationBaseUrl);

    if (resolvedCandidateUrl.origin !== applicationBaseUrl.origin) {
      return "/";
    }

    return `${resolvedCandidateUrl.pathname}${resolvedCandidateUrl.search}${resolvedCandidateUrl.hash}`;
  } catch {
    return "/";
  }
}

export function buildEmailVerificationCallbackPath(params: { nextPath?: string | null }) {
  const normalizedNextPath = normalizeApplicationPath(params.nextPath);
  const emailVerificationUrl = new URL("/verify-email", fallbackApplicationBaseUrl);

  emailVerificationUrl.searchParams.set("status", "verified");

  if (normalizedNextPath !== "/") {
    emailVerificationUrl.searchParams.set("next", normalizedNextPath);
  }

  return `${emailVerificationUrl.pathname}${emailVerificationUrl.search}`;
}

export function buildEmailVerificationPagePath(params: {
  emailAddress?: string | null;
  nextPath?: string | null;
  token?: string | null;
  verificationErrorCode?: string | null;
  verificationStatus?: "verified";
}) {
  const normalizedNextPath = normalizeApplicationPath(params.nextPath);
  const emailVerificationUrl = new URL("/verify-email", fallbackApplicationBaseUrl);

  if (params.emailAddress) {
    emailVerificationUrl.searchParams.set("email", params.emailAddress);
  }

  if (normalizedNextPath !== "/") {
    emailVerificationUrl.searchParams.set("next", normalizedNextPath);
  }

  if (params.token) {
    emailVerificationUrl.searchParams.set("token", params.token);
  }

  if (params.verificationErrorCode) {
    emailVerificationUrl.searchParams.set("error", params.verificationErrorCode);
  }

  if (params.verificationStatus) {
    emailVerificationUrl.searchParams.set("status", params.verificationStatus);
  }

  return `${emailVerificationUrl.pathname}${emailVerificationUrl.search}`;
}

export function buildMagicLinkPagePath(params: {
  emailAddress?: string | null;
  nextPath?: string | null;
  token?: string | null;
  errorCode?: string | null;
  status?: "sent";
}) {
  const normalizedNextPath = normalizeApplicationPath(params.nextPath);
  const magicLinkUrl = new URL("/magic-link", fallbackApplicationBaseUrl);

  if (params.emailAddress) {
    magicLinkUrl.searchParams.set("email", params.emailAddress);
  }

  if (normalizedNextPath !== "/") {
    magicLinkUrl.searchParams.set("next", normalizedNextPath);
  }

  if (params.token) {
    magicLinkUrl.searchParams.set("token", params.token);
  }

  if (params.errorCode) {
    magicLinkUrl.searchParams.set("error", params.errorCode);
  }

  if (params.status) {
    magicLinkUrl.searchParams.set("status", params.status);
  }

  return `${magicLinkUrl.pathname}${magicLinkUrl.search}`;
}

export function buildAuthEntryPagePath(params: {
  callbackPath?: string | null;
  emailAddress?: string | null;
  entryPath: "/login" | "/signup";
  errorCode?: string | null;
}) {
  const normalizedCallbackPath = normalizeApplicationPath(params.callbackPath ?? "/onboarding");
  const authEntryUrl = new URL(params.entryPath, fallbackApplicationBaseUrl);

  if (normalizedCallbackPath !== "/onboarding") {
    authEntryUrl.searchParams.set("callbackURL", normalizedCallbackPath);
  }

  if (params.emailAddress) {
    authEntryUrl.searchParams.set("email", params.emailAddress);
  }

  if (params.errorCode) {
    authEntryUrl.searchParams.set("error", params.errorCode);
  }

  return `${authEntryUrl.pathname}${authEntryUrl.search}`;
}

export function getSocialAuthErrorMessage(errorCode?: string | null) {
  switch (errorCode) {
    case "unable_to_link_account":
    case "account_not_linked":
      return "Google found an existing Roomflow account for this email. Sign in with email first, then link Google from Security settings.";
    case "email_doesn't_match":
      return "Google returned a different email address than the one already attached to this Roomflow account.";
    case "provider_not_configured":
      return "Google sign-in is not configured in this environment yet.";
    case "provider_not_supported":
    case "oauth_provider_not_found":
      return "Google sign-in is unavailable right now.";
    case "access_denied":
    case "user_cancelled_authorize":
      return "Google sign-in was cancelled before authorization completed.";
    case "social_sign_in_failed":
      return "Google sign-in could not be started. Try again or use email and password.";
    default:
      return null;
  }
}