type IntegrationValidationIssue = {
  key: string;
  level: "error" | "warning";
  detail: string;
};

function readConfiguredValue(...candidateValues: Array<string | undefined>) {
  for (const candidateValue of candidateValues) {
    if (!candidateValue) {
      continue;
    }

    const trimmedValue = candidateValue.trim();

    if (trimmedValue.length > 0 && trimmedValue !== "replace-me") {
      return trimmedValue;
    }
  }

  return null;
}

export function validateInboundIntegrationConfiguration(params: {
  emailDeliveryProvider: string | undefined;
  emailFromAddress: string | undefined;
  googleClientId: string | undefined;
  googleClientSecret: string | undefined;
  microsoftClientId: string | undefined;
  microsoftClientSecret: string | undefined;
  resendApiKey: string | undefined;
  resendFromEmail: string | undefined;
  awsRegion: string | undefined;
  awsDefaultRegion: string | undefined;
  awsAccessKeyId: string | undefined;
  awsSecretAccessKey: string | undefined;
  sesFromEmail: string | undefined;
  twilioAccountSid: string | undefined;
  twilioAuthToken: string | undefined;
  twilioPhoneNumber: string | undefined;
  inboundWebhookSigningSecret: string | undefined;
}) {
  const issues: IntegrationValidationIssue[] = [];
  const normalizedEmailDeliveryProvider = params.emailDeliveryProvider?.trim().toLowerCase();
  const usesSesDelivery = normalizedEmailDeliveryProvider === "ses";
  const usesMockDelivery = normalizedEmailDeliveryProvider === "mock";
  const usesSupportedEmailProvider =
    normalizedEmailDeliveryProvider === undefined ||
    normalizedEmailDeliveryProvider.length === 0 ||
    normalizedEmailDeliveryProvider === "resend" ||
    usesSesDelivery ||
    usesMockDelivery;

  if (!usesSupportedEmailProvider) {
    issues.push({
      key: "EMAIL_DELIVERY_PROVIDER",
      level: "warning",
      detail: "Email delivery provider must be `mock`, `resend`, or `ses`; unsupported values fall back to Resend.",
    });
  }

  if (usesMockDelivery) {
    issues.push({
      key: "EMAIL_DELIVERY_PROVIDER",
      level: "warning",
      detail: "Local mock email delivery is active. Messages are captured for testing and never leave the workspace.",
    });
  }

  const configuredEmailFromAddress = usesSesDelivery
    ? readConfiguredValue(params.emailFromAddress, params.sesFromEmail)
    : usesMockDelivery
      ? readConfiguredValue(params.emailFromAddress)
    : readConfiguredValue(params.emailFromAddress, params.resendFromEmail);

  if (!configuredEmailFromAddress && !usesMockDelivery) {
    issues.push({
      key: usesSesDelivery ? "EMAIL_FROM_ADDRESS / SES_FROM_EMAIL" : "EMAIL_FROM_ADDRESS / RESEND_FROM_EMAIL",
      level: "warning",
      detail: usesSesDelivery
        ? "Amazon SES needs a verified sender address. Set EMAIL_FROM_ADDRESS or SES_FROM_EMAIL."
        : "Outbound email needs a sender address. Set EMAIL_FROM_ADDRESS or RESEND_FROM_EMAIL.",
    });
  }

  if (usesSesDelivery) {
    if (!readConfiguredValue(params.awsRegion, params.awsDefaultRegion)) {
      issues.push({
        key: "AWS_REGION / AWS_DEFAULT_REGION",
        level: "warning",
        detail: "Amazon SES needs an AWS region before delivery can be enabled.",
      });
    }

    const hasAwsAccessKeyId = Boolean(readConfiguredValue(params.awsAccessKeyId));
    const hasAwsSecretAccessKey = Boolean(readConfiguredValue(params.awsSecretAccessKey));

    if (hasAwsAccessKeyId !== hasAwsSecretAccessKey) {
      issues.push({
        key: "AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY",
        level: "warning",
        detail: "Amazon SES static credentials must include both AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY when env-based credentials are used.",
      });
    }
  } else if (!usesMockDelivery && (!params.resendApiKey || params.resendApiKey === "replace-me")) {
    issues.push({
      key: "RESEND_API_KEY",
      level: "warning",
      detail: "Resend API key is not configured for production email delivery.",
    });
  }

  if (!params.twilioAccountSid || params.twilioAccountSid === "replace-me") {
    issues.push({
      key: "TWILIO_ACCOUNT_SID",
      level: "warning",
      detail: "Twilio account SID is not configured.",
    });
  }

  if (!params.twilioAuthToken || params.twilioAuthToken === "replace-me") {
    issues.push({
      key: "TWILIO_AUTH_TOKEN",
      level: "warning",
      detail: "Twilio auth token is not configured.",
    });
  }

  if (!params.twilioPhoneNumber || params.twilioPhoneNumber === "replace-me") {
    issues.push({
      key: "TWILIO_PHONE_NUMBER",
      level: "warning",
      detail: "Twilio outbound phone number is not configured.",
    });
  }

  if (!params.inboundWebhookSigningSecret) {
    issues.push({
      key: "INBOUND_WEBHOOK_SIGNING_SECRET",
      level: "error",
      detail:
        "Inbound webhook signing secret is missing; provider webhook signature verification is effectively disabled.",
    });
  }

  if (!params.googleClientId || params.googleClientId === "replace-me") {
    issues.push({
      key: "GOOGLE_CLIENT_ID",
      level: "warning",
      detail: "Google Calendar sync is not fully configured because the Google client ID is missing.",
    });
  }

  if (!params.googleClientSecret || params.googleClientSecret === "replace-me") {
    issues.push({
      key: "GOOGLE_CLIENT_SECRET",
      level: "warning",
      detail: "Google Calendar sync is not fully configured because the Google client secret is missing.",
    });
  }

  if (!params.microsoftClientId || params.microsoftClientId === "replace-me") {
    issues.push({
      key: "MICROSOFT_CLIENT_ID",
      level: "warning",
      detail: "Outlook calendar sync is not fully configured because the Microsoft client ID is missing.",
    });
  }

  if (!params.microsoftClientSecret || params.microsoftClientSecret === "replace-me") {
    issues.push({
      key: "MICROSOFT_CLIENT_SECRET",
      level: "warning",
      detail: "Outlook calendar sync is not fully configured because the Microsoft client secret is missing.",
    });
  }

  return issues;
}
