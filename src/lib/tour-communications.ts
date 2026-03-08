import {
  MessageChannel,
  MessageDirection,
  MessageOrigin,
  TemplateType,
} from "@/generated/prisma/client";
import {
  isProviderConfigurationError,
  markMessageDeliveryFailure,
  markMessageProviderUnresolved,
  sendQueuedMessage,
} from "@/lib/message-delivery";
import { prisma } from "@/lib/prisma";
import { serializeDeliveryStatus } from "@/lib/delivery-status";

function formatTourDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export function resolveLeadProspectChannel(lead: {
  contact: {
    email: string | null;
    phone: string | null;
    preferredChannel: "EMAIL" | "PHONE" | "SMS" | null;
  } | null;
  email: string | null;
  phone: string | null;
}) {
  const preferredChannel = lead.contact?.preferredChannel;

  if (preferredChannel === "EMAIL" && (lead.contact?.email ?? lead.email)) {
    return MessageChannel.EMAIL;
  }

  if (preferredChannel === "SMS" && (lead.contact?.phone ?? lead.phone)) {
    return MessageChannel.SMS;
  }

  if (lead.contact?.email ?? lead.email) {
    return MessageChannel.EMAIL;
  }

  if (lead.contact?.phone ?? lead.phone) {
    return MessageChannel.SMS;
  }

  return null;
}

type TourLeadRecord = {
  contact: {
    email: string | null;
    phone: string | null;
    preferredChannel: "EMAIL" | "PHONE" | "SMS" | null;
  } | null;
  conversation: {
    id: string;
  } | null;
  email: string | null;
  id: string;
  phone: string | null;
};

export type TourCommunicationDependencies = {
  createConversation: (input: { leadId: string; subject: string }) => Promise<{ id: string }>;
  createMessage: (input: {
    body: string;
    channel: MessageChannel;
    conversationId: string;
    deliveryStatus: string;
    direction: MessageDirection;
    origin: MessageOrigin;
    renderedSnapshot: {
      body: string;
      subject: string;
      templateType: TemplateType;
    };
    subject: string | null;
  }) => Promise<{ id: string }>;
  findLead: (leadId: string) => Promise<TourLeadRecord | null>;
  isProviderConfigurationError: (errorMessage: string) => boolean;
  markMessageDeliveryFailure: typeof markMessageDeliveryFailure;
  markMessageProviderUnresolved: typeof markMessageProviderUnresolved;
  sendQueuedMessage: typeof sendQueuedMessage;
};

const defaultTourCommunicationDependencies: TourCommunicationDependencies = {
  createConversation: (input) =>
    prisma.conversation.create({
      data: {
        leadId: input.leadId,
        subject: input.subject,
      },
    }),
  createMessage: (input) =>
    prisma.message.create({
      data: input,
    }),
  findLead: (leadId) =>
    prisma.lead.findUnique({
      where: {
        id: leadId,
      },
      include: {
        contact: true,
        conversation: true,
      },
    }),
  isProviderConfigurationError,
  markMessageDeliveryFailure,
  markMessageProviderUnresolved,
  sendQueuedMessage,
};

export async function createAndDeliverTourMessage(params: {
  body: string;
  leadId: string;
  subject: string;
  templateType: TemplateType;
}, dependencies: TourCommunicationDependencies = defaultTourCommunicationDependencies) {
  const lead = await dependencies.findLead(params.leadId);

  if (!lead) {
    throw new Error("Lead not found.");
  }

  const channel = resolveLeadProspectChannel(lead);

  if (!channel) {
    return false;
  }

  const conversation =
    lead.conversation ??
    (await dependencies.createConversation({
      leadId: lead.id,
      subject: params.subject,
    }));

  const message = await dependencies.createMessage({
    body: params.body,
    channel,
    conversationId: conversation.id,
    deliveryStatus: serializeDeliveryStatus({
      state: "queued",
      provider: channel,
    }),
    direction: MessageDirection.OUTBOUND,
    origin: MessageOrigin.SYSTEM_NOTICE,
    renderedSnapshot: {
      subject: params.subject,
      body: params.body,
      templateType: params.templateType,
    },
    subject: channel === MessageChannel.EMAIL ? params.subject : null,
  });

  try {
    await dependencies.sendQueuedMessage(message.id, 0);
  } catch (error) {
    const deliveryErrorMessage =
      error instanceof Error ? error.message : "Tour communication delivery failed.";

    if (dependencies.isProviderConfigurationError(deliveryErrorMessage)) {
      await dependencies.markMessageProviderUnresolved({
        messageId: message.id,
        error: deliveryErrorMessage,
      });
      return false;
    }

    await dependencies.markMessageDeliveryFailure({
      messageId: message.id,
      retryCount: 0,
      error: deliveryErrorMessage,
    });

    return false;
  }

  return true;
}

export async function sendTourScheduledConfirmation(params: {
  leadId: string;
  propertyName: string;
  scheduledAt: Date;
}, dependencies?: TourCommunicationDependencies) {
  return createAndDeliverTourMessage({
    body: `Your tour for ${params.propertyName} is confirmed for ${formatTourDateTime(params.scheduledAt)}. Reply if you need to make any changes.`,
    leadId: params.leadId,
    subject: `Tour confirmed for ${formatTourDateTime(params.scheduledAt)}`,
    templateType: TemplateType.TOUR_CONFIRMATION,
  }, dependencies);
}

export async function sendTourRescheduledNotification(params: {
  leadId: string;
  propertyName: string;
  prospectMessage: string | null;
  scheduledAt: Date;
}, dependencies?: TourCommunicationDependencies) {
  return createAndDeliverTourMessage({
    body:
      params.prospectMessage?.trim() ||
      `Your tour for ${params.propertyName} has been moved to ${formatTourDateTime(params.scheduledAt)}. Reply if you have any questions.`,
    leadId: params.leadId,
    subject: `Tour rescheduled to ${formatTourDateTime(params.scheduledAt)}`,
    templateType: TemplateType.REMINDER,
  }, dependencies);
}

export async function sendTourCanceledNotification(params: {
  leadId: string;
  propertyName: string;
  prospectMessage: string | null;
}, dependencies?: TourCommunicationDependencies) {
  return createAndDeliverTourMessage({
    body:
      params.prospectMessage?.trim() ||
      `Your tour for ${params.propertyName} has been canceled. Reply if you would like to choose another time.`,
    leadId: params.leadId,
    subject: `Tour canceled for ${params.propertyName}`,
    templateType: TemplateType.REMINDER,
  }, dependencies);
}

export async function sendTourReminderNotification(params: {
  leadId: string;
  propertyName: string;
  reminderLabel: string;
  scheduledAt: Date;
}, dependencies?: TourCommunicationDependencies) {
  return createAndDeliverTourMessage({
    body: `Reminder: your ${params.propertyName} tour is scheduled for ${formatTourDateTime(params.scheduledAt)}. This message was sent ${params.reminderLabel.toLowerCase()}.`,
    leadId: params.leadId,
    subject: `Reminder: tour at ${formatTourDateTime(params.scheduledAt)}`,
    templateType: TemplateType.REMINDER,
  }, dependencies);
}