type IntegrationValidationIssue = {
  key: string;
  level: "error" | "warning";
  detail: string;
};

export function validateInboundIntegrationConfiguration(params: {
  googleClientId: string | undefined;
  googleClientSecret: string | undefined;
  microsoftClientId: string | undefined;
  microsoftClientSecret: string | undefined;
  resendApiKey: string | undefined;
  resendFromEmail: string | undefined;
  twilioAccountSid: string | undefined;
  twilioAuthToken: string | undefined;
  twilioPhoneNumber: string | undefined;
  inboundWebhookSigningSecret: string | undefined;
}) {
  const issues: IntegrationValidationIssue[] = [];

  if (!params.resendApiKey || params.resendApiKey === "replace-me") {
    issues.push({
      key: "RESEND_API_KEY",
      level: "warning",
      detail: "Resend API key is not configured for production email delivery.",
    });
  }

  if (!params.resendFromEmail || params.resendFromEmail === "replace-me") {
    issues.push({
      key: "RESEND_FROM_EMAIL",
      level: "warning",
      detail: "Resend from-address is missing.",
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
