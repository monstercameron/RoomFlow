import { Resend } from "resend";
import {
  buildEmailVerificationCallbackPath,
  buildEmailVerificationPagePath,
  buildMagicLinkPagePath,
  normalizeApplicationPath,
} from "@/lib/auth-urls";

function shouldUseRealEmailDelivery() {
  return process.env.NODE_ENV === "production";
}

function getApplicationBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL ?? "http://127.0.0.1:3001";
}

function getAuthResendClient() {
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey || resendApiKey === "replace-me") {
    return null;
  }

  return new Resend(resendApiKey);
}

export function buildPasswordResetApplicationUrl(params: {
  callbackUrl?: string;
  token: string;
}) {
  const applicationBaseUrl = getApplicationBaseUrl();
  const passwordResetUrl = new URL("/reset-password", applicationBaseUrl);

  passwordResetUrl.searchParams.set("token", params.token);

  if (params.callbackUrl) {
    passwordResetUrl.searchParams.set("callbackURL", params.callbackUrl);
  }

  return passwordResetUrl.toString();
}

export function buildEmailVerificationApplicationUrl(params: {
  callbackUrl?: string;
  token: string;
}) {
  const applicationBaseUrl = getApplicationBaseUrl();
  const nextPath = normalizeApplicationPath(params.callbackUrl);

  return new URL(
    buildEmailVerificationPagePath({
      nextPath,
      token: params.token,
    }),
    applicationBaseUrl,
  ).toString();
}

export function buildMagicLinkApplicationUrl(params: {
  callbackUrl?: string;
  recipientEmailAddress: string;
  token: string;
}) {
  const applicationBaseUrl = getApplicationBaseUrl();
  const nextPath = normalizeApplicationPath(params.callbackUrl);

  return new URL(
    buildMagicLinkPagePath({
      emailAddress: params.recipientEmailAddress,
      nextPath,
      token: params.token,
    }),
    applicationBaseUrl,
  ).toString();
}

export async function sendPasswordResetEmail(params: {
  callbackUrl?: string;
  recipientEmailAddress: string;
  recipientName?: string | null;
  token: string;
}) {
  const passwordResetUrl = buildPasswordResetApplicationUrl({
    callbackUrl: params.callbackUrl,
    token: params.token,
  });
  const resendClient = getAuthResendClient();
  const senderEmailAddress = process.env.RESEND_FROM_EMAIL;

  // Non-production environments should stay self-contained, so they expose the
  // reset link in logs instead of depending on outbound email delivery.
  if (!shouldUseRealEmailDelivery() || !resendClient || !senderEmailAddress) {
    console.info(
      `[auth] Password reset link for ${params.recipientEmailAddress}: ${passwordResetUrl}`,
    );
    return;
  }

  const recipientGreetingName = params.recipientName?.trim() || "there";

  try {
    await resendClient.emails.send({
      from: senderEmailAddress,
      to: params.recipientEmailAddress,
      subject: "Reset your Roomflow password",
      text: [
        `Hi ${recipientGreetingName},`,
        "",
        "Use the link below to choose a new Roomflow password:",
        passwordResetUrl,
        "",
        "If you did not request this change, you can ignore this message.",
      ].join("\n"),
    });
  } catch (error) {
    if (shouldUseRealEmailDelivery()) {
      throw error;
    }

    console.error("[auth] Failed to send password reset email via Resend:", error);
    console.info(
      `[auth] Password reset fallback link for ${params.recipientEmailAddress}: ${passwordResetUrl}`,
    );
  }
}

export async function sendEmailVerificationEmail(params: {
  callbackUrl?: string;
  recipientEmailAddress: string;
  recipientName?: string | null;
  token: string;
}) {
  const applicationBaseUrl = getApplicationBaseUrl();
  const nextPath = normalizeApplicationPath(params.callbackUrl);
  const emailVerificationUrl = buildEmailVerificationApplicationUrl({
    callbackUrl: nextPath,
    token: params.token,
  });
  const resendClient = getAuthResendClient();
  const senderEmailAddress = process.env.RESEND_FROM_EMAIL;

  // Non-production environments should stay self-contained, so they expose the
  // verification link in logs instead of depending on outbound email delivery.
  if (!shouldUseRealEmailDelivery() || !resendClient || !senderEmailAddress) {
    console.info(
      `[auth] Email verification link for ${params.recipientEmailAddress}: ${emailVerificationUrl}`,
    );
    return;
  }

  const recipientGreetingName = params.recipientName?.trim() || "there";
  const verificationCallbackPath = buildEmailVerificationCallbackPath({ nextPath });

  try {
    await resendClient.emails.send({
      from: senderEmailAddress,
      to: params.recipientEmailAddress,
      subject: "Verify your Roomflow email",
      text: [
        `Hi ${recipientGreetingName},`,
        "",
        "Use the link below to verify your Roomflow operator account:",
        emailVerificationUrl,
        "",
        `After verification, Roomflow will continue to ${new URL(verificationCallbackPath, applicationBaseUrl).toString()}.`,
      ].join("\n"),
    });
  } catch (error) {
    if (shouldUseRealEmailDelivery()) {
      throw error;
    }

    console.error("[auth] Failed to send verification email via Resend:", error);
    console.info(
      `[auth] Email verification fallback link for ${params.recipientEmailAddress}: ${emailVerificationUrl}`,
    );
  }
}

export async function sendMagicLinkEmail(params: {
  callbackUrl?: string;
  recipientEmailAddress: string;
  token: string;
}) {
  const magicLinkUrl = buildMagicLinkApplicationUrl({
    callbackUrl: params.callbackUrl,
    recipientEmailAddress: params.recipientEmailAddress,
    token: params.token,
  });
  const resendClient = getAuthResendClient();
  const senderEmailAddress = process.env.RESEND_FROM_EMAIL;

  // Non-production environments should stay self-contained, so they expose the
  // magic link in logs instead of depending on outbound email delivery.
  if (!shouldUseRealEmailDelivery() || !resendClient || !senderEmailAddress) {
    console.info(`[auth] Magic link for ${params.recipientEmailAddress}: ${magicLinkUrl}`);
    return;
  }

  try {
    await resendClient.emails.send({
      from: senderEmailAddress,
      to: params.recipientEmailAddress,
      subject: "Your Roomflow sign-in link",
      text: [
        "Use the link below to sign in to Roomflow without a password:",
        magicLinkUrl,
        "",
        "This link is single-use and expires quickly for security.",
      ].join("\n"),
    });
  } catch (error) {
    if (shouldUseRealEmailDelivery()) {
      throw error;
    }

    console.error("[auth] Failed to send magic link via Resend:", error);
    console.info(`[auth] Magic link fallback for ${params.recipientEmailAddress}: ${magicLinkUrl}`);
  }
}