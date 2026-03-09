import type { MembershipRole } from "@/generated/prisma/client";
import {
  buildEmailVerificationCallbackPath,
  buildEmailVerificationPagePath,
  buildMagicLinkPagePath,
  normalizeApplicationPath,
} from "@/lib/auth-urls";
import {
  getConfiguredEmailDeliveryClient,
  getConfiguredEmailDeliveryProvider,
  getConfiguredEmailDeliveryProviderLabel,
  getConfiguredSenderEmailAddress,
} from "@/lib/email-delivery";
import { storeEmailVerificationCode } from "@/lib/email-verification-codes";

function shouldUseRealEmailDelivery() {
  return process.env.NODE_ENV === "production";
}

function getApplicationBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL ?? "http://127.0.0.1:3001";
}

async function sendTransactionalEmailOrLog(params: {
  fallbackLabel: string;
  fallbackUrl: string;
  recipientEmailAddress: string;
  subject: string;
  text: string;
}) {
  const emailDeliveryClient = getConfiguredEmailDeliveryClient();
  const senderEmailAddress = getConfiguredSenderEmailAddress();
  const configuredProvider = getConfiguredEmailDeliveryProvider();

  if ((!shouldUseRealEmailDelivery() && configuredProvider !== "mock") || !emailDeliveryClient || !senderEmailAddress) {
    console.info(`[auth] ${params.fallbackLabel} for ${params.recipientEmailAddress}: ${params.fallbackUrl}`);
    return;
  }

  try {
    await emailDeliveryClient.sendTextEmail({
      from: senderEmailAddress,
      to: [params.recipientEmailAddress],
      subject: params.subject,
      text: params.text,
    });
  } catch (error) {
    console.error(
      `[auth] Failed to send ${params.subject} via ${getConfiguredEmailDeliveryProviderLabel()}:`,
      error,
    );
    throw error;
  }
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
  const recipientGreetingName = params.recipientName?.trim() || "there";

  await sendTransactionalEmailOrLog({
    fallbackLabel: "Password reset link",
    fallbackUrl: passwordResetUrl,
    recipientEmailAddress: params.recipientEmailAddress,
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
  const recipientGreetingName = params.recipientName?.trim() || "there";
  const verificationCallbackPath = buildEmailVerificationCallbackPath({ nextPath });
  const verificationCode = await storeEmailVerificationCode({
    callbackUrl: nextPath,
    recipientEmailAddress: params.recipientEmailAddress,
    token: params.token,
  });
  const verificationEntryUrl = new URL(
    buildEmailVerificationPagePath({
      emailAddress: params.recipientEmailAddress,
      nextPath,
    }),
    applicationBaseUrl,
  ).toString();

  await sendTransactionalEmailOrLog({
    fallbackLabel: "Email verification link",
    fallbackUrl: emailVerificationUrl,
    recipientEmailAddress: params.recipientEmailAddress,
    subject: "Verify your Roomflow email",
    text: [
      `Hi ${recipientGreetingName},`,
      "",
      "Use either option below to verify your Roomflow operator account:",
      "",
      "Verification link:",
      emailVerificationUrl,
      "",
      `Security code: ${verificationCode.formattedCode}`,
      `Paste that code at ${verificationEntryUrl}.`,
      "",
      `After verification, Roomflow will continue to ${new URL(verificationCallbackPath, applicationBaseUrl).toString()}.`,
    ].join("\n"),
  });
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

  await sendTransactionalEmailOrLog({
    fallbackLabel: "Magic link",
    fallbackUrl: magicLinkUrl,
    recipientEmailAddress: params.recipientEmailAddress,
    subject: "Your Roomflow sign-in link",
    text: [
      "Use the link below to sign in to Roomflow without a password:",
      magicLinkUrl,
      "",
      "This link is single-use and expires quickly for security.",
    ].join("\n"),
  });
}

function formatMembershipRoleLabel(membershipRole: MembershipRole) {
  return membershipRole.charAt(0) + membershipRole.slice(1).toLowerCase();
}

export async function sendWorkspaceInviteEmail(params: {
  inviteUrl: string;
  invitedByName?: string | null;
  recipientEmailAddress: string;
  role: MembershipRole;
  workspaceName: string;
}) {
  const roleLabel = formatMembershipRoleLabel(params.role);
  const inviterName = params.invitedByName?.trim() || "A Roomflow teammate";

  await sendTransactionalEmailOrLog({
    fallbackLabel: "Workspace invite",
    fallbackUrl: params.inviteUrl,
    recipientEmailAddress: params.recipientEmailAddress,
    subject: `Join ${params.workspaceName} on Roomflow`,
    text: [
      `${inviterName} invited you to join ${params.workspaceName} on Roomflow as a ${roleLabel}.`,
      "",
      "Open the invite below to join this workspace using an existing or new account:",
      params.inviteUrl,
      "",
      "If you did not expect this invitation, you can ignore this email.",
    ].join("\n"),
  });
}