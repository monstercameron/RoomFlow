const localDevVerificationBypassEmailAddress = "test@roomflow.local";

export function isDevelopmentModeVerificationBypassEnabled(
  emailAddress: string | null | undefined,
) {
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  return emailAddress?.trim().toLowerCase() === localDevVerificationBypassEmailAddress;
}

export async function parseBypassCandidateEmailAddress(request: Request) {
  try {
    const requestBody = await request.clone().json();

    return typeof requestBody?.email === "string" ? requestBody.email : null;
  } catch {
    return null;
  }
}