const fallbackApplicationBaseUrl = "http://127.0.0.1:3001";

function getApplicationBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL ?? fallbackApplicationBaseUrl;
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