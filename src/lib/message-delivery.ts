import { Resend } from "resend";
import twilio from "twilio";
import { IntegrationProvider, MessageChannel } from "@/generated/prisma/client";
import { serializeDeliveryStatus } from "@/lib/delivery-status";
import { parseMessagingChannelIntegrationConfig } from "@/lib/integrations";
import { prisma } from "@/lib/prisma";

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey || apiKey === "replace-me") {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  return new Resend(apiKey);
}

function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (
    !accountSid ||
    !authToken ||
    accountSid === "replace-me" ||
    authToken === "replace-me"
  ) {
    throw new Error("Twilio credentials are not configured.");
  }

  return twilio(accountSid, authToken);
}

export function isProviderConfigurationError(deliveryErrorMessage: string) {
  const normalizedDeliveryErrorMessage = deliveryErrorMessage.toLowerCase();

  return (
    normalizedDeliveryErrorMessage.includes("not configured") ||
    normalizedDeliveryErrorMessage.includes("replace-me")
  );
}

function normalizeWhatsAppAddress(value: string) {
  return value.startsWith("whatsapp:") ? value : `whatsapp:${value}`;
}

export async function sendQueuedMessage(messageId: string, retryCount = 0) {
  const message = await prisma.message.findUnique({
    where: {
      id: messageId,
    },
    include: {
      conversation: {
        include: {
          lead: {
            include: {
              contact: true,
            },
          },
        },
      },
    },
  });

  if (!message) {
    throw new Error("Message not found.");
  }

  const lead = message.conversation.lead;
  const recipientEmail = lead.contact?.email ?? lead.email;
  const recipientPhone = lead.contact?.phone ?? lead.phone;

  if (message.channel === MessageChannel.INTERNAL_NOTE) {
    await prisma.message.update({
      where: {
        id: message.id,
      },
      data: {
        sentAt: new Date(),
        deliveryStatus: serializeDeliveryStatus({
          state: "sent",
          provider: "internal",
          retryCount,
        }),
      },
    });

    return;
  }

  if (message.channel === MessageChannel.EMAIL) {
    if (!recipientEmail) {
      throw new Error("Lead is missing an email address.");
    }

    const resend = getResendClient();

    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? "onboarding@roomflow.local",
      to: recipientEmail,
      subject: message.subject ?? "Roomflow follow-up",
      text: message.body,
    });

    await prisma.message.update({
      where: {
        id: message.id,
      },
      data: {
        sentAt: new Date(),
        deliveryStatus: serializeDeliveryStatus({
          state: "sent",
          provider: "resend",
          retryCount,
        }),
      },
    });

    return;
  }

  if (message.channel === MessageChannel.SMS) {
    if (!recipientPhone) {
      throw new Error("Lead is missing a phone number.");
    }

    const client = getTwilioClient();
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!fromNumber || fromNumber === "replace-me") {
      throw new Error("TWILIO_PHONE_NUMBER is not configured.");
    }

    await client.messages.create({
      from: fromNumber,
      to: recipientPhone,
      body: message.body,
    });

    await prisma.message.update({
      where: {
        id: message.id,
      },
      data: {
        sentAt: new Date(),
        deliveryStatus: serializeDeliveryStatus({
          state: "sent",
          provider: "twilio",
          retryCount,
        }),
      },
    });

    return;
  }

  if (message.channel === MessageChannel.WHATSAPP) {
    if (!recipientPhone) {
      throw new Error("Lead is missing a phone number.");
    }

    const integrationConnection = await prisma.integrationConnection.findUnique({
      where: {
        workspaceId_provider: {
          workspaceId: lead.workspaceId,
          provider: IntegrationProvider.WHATSAPP,
        },
      },
      select: {
        config: true,
        enabled: true,
      },
    });

    if (!integrationConnection?.enabled) {
      throw new Error("WhatsApp delivery is not configured.");
    }

    const messagingConfig = parseMessagingChannelIntegrationConfig(integrationConnection.config);

    if (!messagingConfig.allowOutboundSend || !messagingConfig.senderIdentifier) {
      throw new Error("WhatsApp delivery sender is not configured.");
    }

    const client = getTwilioClient();

    await client.messages.create({
      from: normalizeWhatsAppAddress(messagingConfig.senderIdentifier),
      to: normalizeWhatsAppAddress(recipientPhone),
      body: message.body,
    });

    await prisma.message.update({
      where: {
        id: message.id,
      },
      data: {
        sentAt: new Date(),
        deliveryStatus: serializeDeliveryStatus({
          state: "sent",
          provider: "twilio-whatsapp",
          retryCount,
        }),
      },
    });

    return;
  }

  if (message.channel === MessageChannel.INSTAGRAM) {
    throw new Error("Instagram delivery is not configured.");
  }
}

export async function markMessageDeliveryFailure(params: {
  messageId: string;
  retryCount: number;
  error: string;
}) {
  await prisma.message.update({
    where: {
      id: params.messageId,
    },
    data: {
      deliveryStatus: serializeDeliveryStatus({
        state: params.retryCount > 0 ? "retrying" : "failed",
        provider: null,
        retryCount: params.retryCount,
        error: params.error,
      }),
    },
  });
}

export async function markMessageProviderUnresolved(params: {
  messageId: string;
  error: string;
}) {
  const existingMessageRecord = await prisma.message.findUnique({
    where: {
      id: params.messageId,
    },
    select: {
      channel: true,
    },
  });

  const unresolvedProviderLabel =
    existingMessageRecord?.channel === MessageChannel.EMAIL
      ? "resend"
      : existingMessageRecord?.channel === MessageChannel.SMS
        ? "twilio"
        : existingMessageRecord?.channel === MessageChannel.WHATSAPP
          ? "whatsapp"
          : existingMessageRecord?.channel === MessageChannel.INSTAGRAM
            ? "instagram"
        : "unknown";

  await prisma.message.update({
    where: {
      id: params.messageId,
    },
    data: {
      deliveryStatus: serializeDeliveryStatus({
        state: "provider_unresolved",
        provider: unresolvedProviderLabel,
        retryCount: 0,
        error: params.error,
      }),
    },
  });
}
