import { z } from "zod";
import {
  ContactChannel,
  LeadSourceType,
  LeadStatus,
  MessageChannel,
  MessageDirection,
  type Prisma,
  QualificationFit,
} from "@/generated/prisma/client";
import { serializeDeliveryStatus } from "@/lib/delivery-status";
import { prisma } from "@/lib/prisma";

const normalizedLeadPayloadSchema = z.object({
  workspaceId: z.string().min(1),
  propertyId: z.string().min(1).nullable().optional(),
  leadSourceName: z.string().min(1),
  leadSourceType: z.nativeEnum(LeadSourceType),
  channel: z.nativeEnum(MessageChannel),
  fullName: z.string().min(1),
  email: z.string().email().nullable().optional(),
  phone: z.string().min(1).nullable().optional(),
  subject: z.string().nullable().optional(),
  body: z.string().min(1),
  externalMessageId: z.string().nullable().optional(),
  externalThreadId: z.string().nullable().optional(),
  receivedAt: z.date(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type NormalizedLeadPayload = z.infer<typeof normalizedLeadPayloadSchema>;

function slugFromName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function inferFullName(value: string | null | undefined) {
  const normalized = value?.trim();

  if (!normalized) {
    return "Unknown lead";
  }

  if (normalized.includes("@")) {
    return normalized.split("@")[0].replace(/[._-]+/g, " ");
  }

  return normalized;
}

function normalizePhone(value: string | null | undefined) {
  const normalized = value?.trim();

  if (!normalized) {
    return null;
  }

  return normalized.replace(/[^\d+]/g, "");
}

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? null;
}

function getPreferredContactChannel(channel: MessageChannel) {
  switch (channel) {
    case MessageChannel.SMS:
      return ContactChannel.SMS;
    case MessageChannel.EMAIL:
      return ContactChannel.EMAIL;
    default:
      return ContactChannel.PHONE;
  }
}

export function normalizeInboundEmailPayload(input: unknown) {
  const payload = z
    .object({
      workspaceId: z.string().min(1),
      propertyId: z.string().min(1).optional(),
      sourceName: z.string().min(1).optional(),
      fromEmail: z.string().email().optional(),
      fromName: z.string().optional(),
      subject: z.string().optional(),
      body: z.string().min(1),
      receivedAt: z.coerce.date().optional(),
      messageId: z.string().optional(),
      threadId: z.string().optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    })
    .parse(input);

  return normalizedLeadPayloadSchema.parse({
    workspaceId: payload.workspaceId,
    propertyId: payload.propertyId ?? null,
    leadSourceName: payload.sourceName ?? "Inbound email",
    leadSourceType: LeadSourceType.EMAIL,
    channel: MessageChannel.EMAIL,
    fullName: inferFullName(payload.fromName ?? payload.fromEmail),
    email: normalizeEmail(payload.fromEmail),
    phone: null,
    subject: payload.subject ?? null,
    body: payload.body,
    externalMessageId: payload.messageId ?? null,
    externalThreadId: payload.threadId ?? null,
    receivedAt: payload.receivedAt ?? new Date(),
    metadata: payload.metadata ?? {},
  });
}

export function normalizeInboundSmsPayload(input: unknown) {
  const payload = z
    .object({
      workspaceId: z.string().min(1),
      propertyId: z.string().min(1).optional(),
      sourceName: z.string().min(1).optional(),
      fromPhone: z.string().min(1),
      fromName: z.string().optional(),
      body: z.string().min(1),
      receivedAt: z.coerce.date().optional(),
      messageId: z.string().optional(),
      threadId: z.string().optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    })
    .parse(input);

  return normalizedLeadPayloadSchema.parse({
    workspaceId: payload.workspaceId,
    propertyId: payload.propertyId ?? null,
    leadSourceName: payload.sourceName ?? "Inbound SMS",
    leadSourceType: LeadSourceType.SMS,
    channel: MessageChannel.SMS,
    fullName: inferFullName(payload.fromName ?? payload.fromPhone),
    email: null,
    phone: normalizePhone(payload.fromPhone),
    subject: null,
    body: payload.body,
    externalMessageId: payload.messageId ?? null,
    externalThreadId: payload.threadId ?? null,
    receivedAt: payload.receivedAt ?? new Date(),
    metadata: payload.metadata ?? {},
  });
}

export async function processNormalizedInboundLead(payload: NormalizedLeadPayload) {
  const property =
    payload.propertyId
      ? await prisma.property.findFirst({
          where: {
            id: payload.propertyId,
            workspaceId: payload.workspaceId,
          },
        })
      : null;

  if (payload.propertyId && !property) {
    throw new Error("Property not found for inbound lead.");
  }

  const leadSource = await prisma.leadSource.upsert({
    where: {
      workspaceId_name: {
        workspaceId: payload.workspaceId,
        name: payload.leadSourceName,
      },
    },
    update: {
      active: true,
      type: payload.leadSourceType,
    },
    create: {
      workspaceId: payload.workspaceId,
      name: payload.leadSourceName,
      type: payload.leadSourceType,
      active: true,
    },
  });

  const leadLookupConditions: Prisma.LeadWhereInput[] = [];

  if (payload.email) {
    leadLookupConditions.push({
      email: payload.email,
    });
  }

  if (payload.phone) {
    leadLookupConditions.push({
      phone: payload.phone,
    });
  }

  const existingLead =
    leadLookupConditions.length > 0
      ? await prisma.lead.findFirst({
          where: {
            workspaceId: payload.workspaceId,
            OR: leadLookupConditions,
          },
          include: {
            contact: true,
            conversation: true,
          },
        })
      : null;

  const baseLead =
    existingLead ??
    (await prisma.lead.create({
      data: {
        workspaceId: payload.workspaceId,
        propertyId: property?.id ?? null,
        leadSourceId: leadSource.id,
        fullName: payload.fullName,
        email: payload.email ?? null,
        phone: payload.phone ?? null,
        preferredContactChannel: getPreferredContactChannel(payload.channel),
        status: LeadStatus.NEW,
        fitResult: QualificationFit.UNKNOWN,
        lastActivityAt: payload.receivedAt,
        notes: `Normalized inbound ${payload.channel.toLowerCase()} lead`,
      },
    }));

  await prisma.lead.update({
    where: {
      id: baseLead.id,
    },
    data: {
      propertyId: baseLead.propertyId ?? property?.id ?? null,
      leadSourceId: leadSource.id,
      fullName:
        baseLead.fullName === "Unknown lead" ? payload.fullName : baseLead.fullName,
      email: baseLead.email ?? payload.email ?? null,
      phone: baseLead.phone ?? payload.phone ?? null,
      preferredContactChannel: getPreferredContactChannel(payload.channel),
      lastActivityAt: payload.receivedAt,
    },
  });

  const lead = await prisma.lead.findUniqueOrThrow({
    where: {
      id: baseLead.id,
    },
    include: {
      contact: true,
      conversation: true,
    },
  });

  if (lead.contact) {
    await prisma.contact.update({
      where: {
        leadId: lead.id,
      },
      data: {
        email: lead.contact.email ?? payload.email ?? null,
        phone: lead.contact.phone ?? payload.phone ?? null,
        preferredChannel: getPreferredContactChannel(payload.channel),
      },
    });
  } else {
    await prisma.contact.create({
      data: {
        leadId: lead.id,
        email: payload.email ?? null,
        phone: payload.phone ?? null,
        preferredChannel: getPreferredContactChannel(payload.channel),
      },
    });
  }

  const conversation =
    lead.conversation ??
    (await prisma.conversation.create({
      data: {
        leadId: lead.id,
        subject: payload.subject ?? payload.externalThreadId ?? payload.leadSourceName,
      },
    }));

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: MessageDirection.INBOUND,
      channel: payload.channel,
      subject: payload.subject ?? null,
      body: payload.body,
      receivedAt: payload.receivedAt,
      deliveryStatus: serializeDeliveryStatus({
        state: "received",
        provider: payload.leadSourceName,
      }),
    },
  });

  await prisma.auditEvent.create({
    data: {
      workspaceId: payload.workspaceId,
      leadId: lead.id,
      propertyId: property?.id ?? lead.propertyId,
      eventType: `${payload.channel === MessageChannel.SMS ? "Inbound SMS" : "Inbound email"} normalized`,
      payload: {
        externalMessageId: payload.externalMessageId ?? null,
        externalThreadId: payload.externalThreadId ?? null,
        sourceName: payload.leadSourceName,
        sourceType: payload.leadSourceType,
        contactKey: payload.email ?? payload.phone ?? slugFromName(payload.fullName),
      },
    },
  });

  return {
    leadId: lead.id,
    messageId: message.id,
    conversationId: conversation.id,
  };
}
