import { z } from "zod";
import {
  ContactChannel,
  LeadSourceType,
  LeadStatus,
  MessageChannel,
  MessageDirection,
  MessageOrigin,
  NotificationType,
  type Prisma,
  QualificationFit,
} from "@/generated/prisma/client";
import { serializeDeliveryStatus } from "@/lib/delivery-status";
import {
  classifyDuplicateHandlingOutcome,
  chooseBestDuplicateCandidate,
} from "@/lib/lead-duplicate-matching";
import { shouldRecomputeFitForTrigger } from "@/lib/lead-rule-engine";
import { buildLeadNormalizationDiff } from "@/lib/lead-normalization-diff";
import {
  buildNormalizedLeadFieldMetadata,
  extractConflictedNormalizedLeadFieldKeys,
} from "@/lib/lead-field-metadata";
import {
  buildLeadChannelOptOutUpdate,
  formatMessageChannelLabel,
} from "@/lib/lead-channel-opt-outs";
import { queueOutboundWorkflowWebhook } from "@/lib/lead-workflow";
import { prisma } from "@/lib/prisma";
import { workflowEventTypes } from "@/lib/workflow-events";

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

function buildFieldEvidenceFromPayload(
  payload: NormalizedLeadPayload,
  fieldValues: Partial<Record<string, string | number | boolean | null>>,
) {
  const sourceMessageReference =
    payload.externalMessageId ??
    payload.externalThreadId ??
    `${payload.channel.toLowerCase()}-${payload.receivedAt.toISOString()}`;
  const normalizedSnippet = payload.body.replace(/\s+/g, " ").trim();
  const evidenceSnippet =
    normalizedSnippet.length > 160
      ? `${normalizedSnippet.slice(0, 157).trimEnd()}...`
      : normalizedSnippet || null;

  return Object.fromEntries(
    Object.entries(fieldValues)
      .filter(([, value]) => value !== null && value !== undefined && value !== "")
      .map(([fieldKey]) => [
        fieldKey,
        {
          evidenceSnippet,
          sourceMessageReference,
        },
      ]),
  );
}

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
  const trimmedPhoneNumber = value?.trim();

  if (!trimmedPhoneNumber) {
    return null;
  }

  const hasExplicitInternationalPrefix = trimmedPhoneNumber.startsWith("+");
  const digitsOnlyPhoneNumber = trimmedPhoneNumber.replace(/\D/g, "");

  if (!digitsOnlyPhoneNumber) {
    return null;
  }

  if (hasExplicitInternationalPrefix) {
    return `+${digitsOnlyPhoneNumber}`;
  }

  // v1 default: treat 10-digit local numbers as US/Canada and convert to +1.
  if (digitsOnlyPhoneNumber.length === 10) {
    return `+1${digitsOnlyPhoneNumber}`;
  }

  if (
    digitsOnlyPhoneNumber.length === 11 &&
    digitsOnlyPhoneNumber.startsWith("1")
  ) {
    return `+${digitsOnlyPhoneNumber}`;
  }

  return `+${digitsOnlyPhoneNumber}`;
}

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? null;
}

function extractMetadataFieldValue(
  metadata: unknown,
  fieldKey: string,
): string | number | boolean | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const metadataRecord = metadata as Record<string, unknown>;
  const metadataEntry = metadataRecord[fieldKey];

  if (!metadataEntry || typeof metadataEntry !== "object" || Array.isArray(metadataEntry)) {
    return null;
  }

  const value = (metadataEntry as Record<string, unknown>).value;

  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  return null;
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

function resolveInboundMessageChannel(params: {
  explicitChannel?: MessageChannel | null;
  emailAddress: string | null;
  phoneNumber: string | null;
}) {
  if (params.explicitChannel) {
    return params.explicitChannel;
  }

  if (params.emailAddress) {
    return MessageChannel.EMAIL;
  }

  if (params.phoneNumber) {
    return MessageChannel.SMS;
  }

  return MessageChannel.INTERNAL_NOTE;
}

function getNormalizationEventLabel(params: {
  leadSourceType: LeadSourceType;
  channel: MessageChannel;
}) {
  if (params.leadSourceType === LeadSourceType.SMS) {
    return "Inbound SMS normalized";
  }

  if (params.leadSourceType === LeadSourceType.EMAIL) {
    return "Inbound email normalized";
  }

  if (params.leadSourceType === LeadSourceType.WEB_FORM) {
    return "Inbound web form normalized";
  }

  if (params.leadSourceType === LeadSourceType.CSV_IMPORT) {
    return "Inbound CSV import normalized";
  }

  if (params.channel === MessageChannel.SMS) {
    return "Inbound SMS normalized";
  }

  if (params.channel === MessageChannel.EMAIL) {
    return "Inbound email normalized";
  }

  return "Inbound lead normalized";
}

export function resolveInboundOptOutDirective(messageBody: string) {
  const normalizedMessageBody = messageBody.trim().toLowerCase();

  if (["stop", "unsubscribe", "opt out", "cancel"].includes(normalizedMessageBody)) {
    return "opt_out";
  }

  if (["start", "unstop", "subscribe"].includes(normalizedMessageBody)) {
    return "opt_in";
  }

  return null;
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

export function normalizeInboundWebFormPayload(input: unknown) {
  const payload = z
    .object({
      workspaceId: z.string().min(1),
      propertyId: z.string().min(1).optional(),
      sourceName: z.string().min(1).optional(),
      fullName: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      subject: z.string().optional(),
      message: z.string().optional(),
      body: z.string().optional(),
      submittedAt: z.coerce.date().optional(),
      submissionId: z.string().optional(),
      threadId: z.string().optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    })
    .parse(input);

  const normalizedEmailAddress = normalizeEmail(payload.email);
  const normalizedPhoneNumber = normalizePhone(payload.phone);
  const resolvedBodyText =
    payload.message?.trim() || payload.body?.trim() || "Web form lead imported";

  return normalizedLeadPayloadSchema.parse({
    workspaceId: payload.workspaceId,
    propertyId: payload.propertyId ?? null,
    leadSourceName: payload.sourceName ?? "Web form",
    leadSourceType: LeadSourceType.WEB_FORM,
    channel: resolveInboundMessageChannel({
      explicitChannel: null,
      emailAddress: normalizedEmailAddress,
      phoneNumber: normalizedPhoneNumber,
    }),
    fullName: inferFullName(payload.fullName ?? normalizedEmailAddress ?? normalizedPhoneNumber),
    email: normalizedEmailAddress,
    phone: normalizedPhoneNumber,
    subject: payload.subject ?? null,
    body: resolvedBodyText,
    externalMessageId: payload.submissionId ?? null,
    externalThreadId: payload.threadId ?? null,
    receivedAt: payload.submittedAt ?? new Date(),
    metadata: payload.metadata ?? {},
  });
}

export function normalizeInboundCsvImportPayload(input: unknown) {
  const payload = z
    .object({
      workspaceId: z.string().min(1),
      propertyId: z.string().min(1).optional(),
      sourceName: z.string().min(1).optional(),
      fullName: z.string().min(1),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      notes: z.string().optional(),
      body: z.string().optional(),
      importedAt: z.coerce.date().optional(),
      rowId: z.string().optional(),
      threadId: z.string().optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    })
    .parse(input);

  const normalizedEmailAddress = normalizeEmail(payload.email);
  const normalizedPhoneNumber = normalizePhone(payload.phone);
  const resolvedBodyText =
    payload.notes?.trim() || payload.body?.trim() || "CSV lead imported";

  return normalizedLeadPayloadSchema.parse({
    workspaceId: payload.workspaceId,
    propertyId: payload.propertyId ?? null,
    leadSourceName: payload.sourceName ?? "CSV import",
    leadSourceType: LeadSourceType.CSV_IMPORT,
    channel: resolveInboundMessageChannel({
      explicitChannel: MessageChannel.INTERNAL_NOTE,
      emailAddress: normalizedEmailAddress,
      phoneNumber: normalizedPhoneNumber,
    }),
    fullName: inferFullName(payload.fullName),
    email: normalizedEmailAddress,
    phone: normalizedPhoneNumber,
    subject: null,
    body: resolvedBodyText,
    externalMessageId: payload.rowId ?? null,
    externalThreadId: payload.threadId ?? null,
    receivedAt: payload.importedAt ?? new Date(),
    metadata: payload.metadata ?? {},
  });
}

export function normalizeInboundMetaLeadPayload(input: unknown) {
  const payload = z
    .object({
      workspaceId: z.string().min(1),
      propertyId: z.string().min(1).optional(),
      sourceName: z.string().min(1).optional(),
      fullName: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      subject: z.string().optional(),
      body: z.string().optional(),
      notes: z.string().optional(),
      submittedAt: z.coerce.date().optional(),
      submissionId: z.string().optional(),
      threadId: z.string().optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    })
    .parse(input);

  const normalizedEmailAddress = normalizeEmail(payload.email);
  const normalizedPhoneNumber = normalizePhone(payload.phone);
  const resolvedBodyText =
    payload.body?.trim() || payload.notes?.trim() || "Meta lead captured";

  return normalizedLeadPayloadSchema.parse({
    workspaceId: payload.workspaceId,
    propertyId: payload.propertyId ?? null,
    leadSourceName: payload.sourceName ?? "Meta Lead Ads",
    leadSourceType: LeadSourceType.FACEBOOK,
    channel: resolveInboundMessageChannel({
      explicitChannel: null,
      emailAddress: normalizedEmailAddress,
      phoneNumber: normalizedPhoneNumber,
    }),
    fullName: inferFullName(payload.fullName ?? normalizedEmailAddress ?? normalizedPhoneNumber),
    email: normalizedEmailAddress,
    phone: normalizedPhoneNumber,
    subject: payload.subject ?? null,
    body: resolvedBodyText,
    externalMessageId: payload.submissionId ?? null,
    externalThreadId: payload.threadId ?? null,
    receivedAt: payload.submittedAt ?? new Date(),
    metadata: payload.metadata ?? {},
  });
}

export function normalizeInboundDirectMessagePayload(input: unknown) {
  const payload = z
    .object({
      workspaceId: z.string().min(1),
      propertyId: z.string().min(1).optional(),
      sourceName: z.string().min(1).optional(),
      leadSourceType: z.nativeEnum(LeadSourceType).optional(),
      channel: z.nativeEnum(MessageChannel),
      fromIdentifier: z.string().min(1),
      fromName: z.string().optional(),
      body: z.string().min(1),
      subject: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      receivedAt: z.coerce.date().optional(),
      messageId: z.string().optional(),
      threadId: z.string().optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    })
    .parse(input);

  const inferredEmailAddress = payload.channel === MessageChannel.INSTAGRAM
    ? normalizeEmail(payload.email)
    : normalizeEmail(payload.email ?? (payload.fromIdentifier.includes("@") ? payload.fromIdentifier : undefined));
  const inferredPhoneNumber = payload.channel === MessageChannel.WHATSAPP
    ? normalizePhone(payload.phone ?? payload.fromIdentifier)
    : normalizePhone(payload.phone);

  return normalizedLeadPayloadSchema.parse({
    workspaceId: payload.workspaceId,
    propertyId: payload.propertyId ?? null,
    leadSourceName: payload.sourceName ?? formatMessageChannelLabel(payload.channel),
    leadSourceType: payload.leadSourceType ?? LeadSourceType.OTHER,
    channel: payload.channel,
    fullName: inferFullName(
      payload.fromName ?? inferredEmailAddress ?? inferredPhoneNumber ?? payload.fromIdentifier,
    ),
    email: inferredEmailAddress,
    phone: inferredPhoneNumber,
    subject: payload.subject ?? null,
    body: payload.body,
    externalMessageId: payload.messageId ?? null,
    externalThreadId: payload.threadId ?? null,
    receivedAt: payload.receivedAt ?? new Date(),
    metadata: payload.metadata ?? {},
  });
}

export async function processNormalizedInboundLead(payload: NormalizedLeadPayload) {
  const existingInboundMessage =
    payload.externalMessageId
      ? await prisma.message.findFirst({
          where: {
            direction: MessageDirection.INBOUND,
            channel: payload.channel,
            externalMessageId: payload.externalMessageId,
            conversation: {
              lead: {
                workspaceId: payload.workspaceId,
              },
            },
          },
          select: {
            id: true,
            conversationId: true,
            conversation: {
              select: {
                leadId: true,
              },
            },
          },
        })
      : null;

  if (existingInboundMessage) {
    return {
      leadId: existingInboundMessage.conversation.leadId,
      messageId: existingInboundMessage.id,
      conversationId: existingInboundMessage.conversationId,
      idempotentReplay: true,
    };
  }

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

  if (payload.externalThreadId) {
    leadLookupConditions.push({
      conversation: {
        is: {
          OR: [
            {
              externalThreadId: payload.externalThreadId,
            },
            {
              subject: payload.externalThreadId,
            },
          ],
        },
      },
    });
  }

  const duplicateCandidateLeads =
    leadLookupConditions.length > 0
      ? await prisma.lead.findMany({
          where: {
            workspaceId: payload.workspaceId,
            OR: leadLookupConditions,
          },
          include: {
            contact: true,
            conversation: {
              select: {
                id: true,
                subject: true,
                externalThreadId: true,
              },
            },
          },
          orderBy: {
            lastActivityAt: "desc",
          },
        })
      : [];

  const bestDuplicateCandidate = chooseBestDuplicateCandidate({
    incomingEmailAddress: payload.email ?? null,
    incomingPhoneNumber: payload.phone ?? null,
    incomingExternalThreadId: payload.externalThreadId ?? null,
    duplicateCandidates: duplicateCandidateLeads.map((duplicateCandidateLead) => ({
      id: duplicateCandidateLead.id,
      email: duplicateCandidateLead.email,
      phone: duplicateCandidateLead.phone,
      lastActivityAt: duplicateCandidateLead.lastActivityAt,
      conversationSubject:
        duplicateCandidateLead.conversation?.externalThreadId ??
        duplicateCandidateLead.conversation?.subject ??
        null,
    })),
  });

  const duplicateHandlingOutcome = classifyDuplicateHandlingOutcome(
    bestDuplicateCandidate,
  );

  const existingLead =
    duplicateHandlingOutcome === "attach_existing" && bestDuplicateCandidate
      ? duplicateCandidateLeads.find(
          (duplicateCandidateLead) =>
            duplicateCandidateLead.id === bestDuplicateCandidate.candidateLeadId,
        ) ?? null
      : null;

  const shouldFlagPossibleDuplicate =
    duplicateHandlingOutcome === "flag_possible_duplicate";

  await prisma.auditEvent.create({
    data: {
      workspaceId: payload.workspaceId,
      eventType: "duplicate_confidence_evaluated",
      payload: {
        candidateCount: duplicateCandidateLeads.length,
        handlingOutcome: duplicateHandlingOutcome,
        bestCandidateLeadId: bestDuplicateCandidate?.candidateLeadId ?? null,
        bestConfidenceScore: bestDuplicateCandidate?.confidenceScore ?? null,
        bestConfidenceBand: bestDuplicateCandidate?.confidenceBand ?? null,
        matchedSignals: bestDuplicateCandidate?.matchedSignals ?? [],
      },
    },
  });

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
        fieldMetadata: buildNormalizedLeadFieldMetadata({
          existingFieldMetadata: null,
          normalizedAt: payload.receivedAt,
          sourceLabel: payload.leadSourceName,
          fieldValues: {
            fullName: payload.fullName,
            email: payload.email ?? null,
            phone: payload.phone ?? null,
            moveInDate: null,
            monthlyBudget: null,
            stayLengthMonths: null,
            smokingStatus: null,
            petStatus: null,
            parkingNeed: null,
            guestExpectations: null,
            bathroomSharingAcceptance: null,
            workStatus: null,
          },
          fieldConfidences: {
            fullName: 0.75,
            email: payload.email ? 0.99 : 0,
            phone: payload.phone ? 0.99 : 0,
          },
          fieldEvidence: buildFieldEvidenceFromPayload(payload, {
            fullName: payload.fullName,
            email: payload.email ?? null,
            phone: payload.phone ?? null,
          }),
        }),
      },
    }));
  const createdNewLeadRecord = !existingLead;

  const resolvedLeadFullName =
    baseLead.fullName === "Unknown lead" ? payload.fullName : baseLead.fullName;
  const resolvedLeadEmailAddress = baseLead.email ?? payload.email ?? null;
  const resolvedLeadPhoneNumber = baseLead.phone ?? payload.phone ?? null;
  const resolvedLeadPropertyId = baseLead.propertyId ?? property?.id ?? null;
  const resolvedPreferredContactChannel = getPreferredContactChannel(payload.channel);
  const extractedFieldValues = {
    fullName: resolvedLeadFullName,
    email: resolvedLeadEmailAddress,
    phone: resolvedLeadPhoneNumber,
    moveInDate: baseLead.moveInDate ? baseLead.moveInDate.toISOString() : null,
    monthlyBudget: baseLead.monthlyBudget ?? null,
    stayLengthMonths: baseLead.stayLengthMonths ?? null,
    workStatus: baseLead.workStatus ?? null,
  };
  const mergedLeadFieldMetadata = buildNormalizedLeadFieldMetadata({
    existingFieldMetadata: baseLead.fieldMetadata,
    normalizedAt: payload.receivedAt,
    sourceLabel: payload.leadSourceName,
    fieldValues: extractedFieldValues,
    fieldConfidences: {
      fullName: resolvedLeadFullName === payload.fullName ? 0.75 : 0.9,
      email: resolvedLeadEmailAddress ? 0.99 : 0,
      phone: resolvedLeadPhoneNumber ? 0.99 : 0,
      moveInDate: baseLead.moveInDate ? 0.9 : 0,
      monthlyBudget: baseLead.monthlyBudget !== null ? 0.9 : 0,
      stayLengthMonths: baseLead.stayLengthMonths !== null ? 0.9 : 0,
      workStatus: baseLead.workStatus ? 0.9 : 0,
    },
    fieldEvidence: buildFieldEvidenceFromPayload(payload, extractedFieldValues),
  });
  const optOutDirective = resolveInboundOptOutDirective(payload.body);
  const shouldApplyOptOutDirective =
    Boolean(optOutDirective) && payload.channel !== MessageChannel.INTERNAL_NOTE;
  const optOutUpdateData = shouldApplyOptOutDirective
    ? buildLeadChannelOptOutUpdate({
        lead: baseLead,
        channel: payload.channel,
        isOptedOut: optOutDirective === "opt_out",
        changedAt: payload.receivedAt,
        reason:
          optOutDirective === "opt_out"
            ? `Inbound ${formatMessageChannelLabel(payload.channel)} STOP/UNSUBSCRIBE signal`
            : null,
      })
    : null;
  const conflictedFieldKeys = extractConflictedNormalizedLeadFieldKeys(
    mergedLeadFieldMetadata,
  );
  const conflictHistoryEntries = conflictedFieldKeys.map((conflictedFieldKey) => ({
    fieldKey: conflictedFieldKey,
    previousValue: extractMetadataFieldValue(baseLead.fieldMetadata, conflictedFieldKey),
    incomingValue: extractMetadataFieldValue(
      mergedLeadFieldMetadata,
      conflictedFieldKey,
    ),
  }));

  await prisma.lead.update({
    where: {
      id: baseLead.id,
    },
    data: {
      propertyId: resolvedLeadPropertyId,
      leadSourceId: leadSource.id,
      fullName: resolvedLeadFullName,
      email: resolvedLeadEmailAddress,
      phone: resolvedLeadPhoneNumber,
      preferredContactChannel: resolvedPreferredContactChannel,
      lastActivityAt: payload.receivedAt,
      ...(optOutUpdateData ?? {}),
      fieldMetadata: mergedLeadFieldMetadata,
    },
  });

  if (conflictedFieldKeys.length > 0) {
    const leadForConflictTransition = await prisma.lead.findUnique({
      where: {
        id: baseLead.id,
      },
      select: {
        status: true,
      },
    });

    if (
      leadForConflictTransition &&
      leadForConflictTransition.status !== LeadStatus.UNDER_REVIEW
    ) {
      await prisma.lead.update({
        where: {
          id: baseLead.id,
        },
        data: {
          status: LeadStatus.UNDER_REVIEW,
          fitResult: QualificationFit.UNKNOWN,
        },
      });

      await prisma.leadStatusHistory.create({
        data: {
          leadId: baseLead.id,
          fromStatus: leadForConflictTransition.status,
          toStatus: LeadStatus.UNDER_REVIEW,
          reason: "Conflicting answer values detected during normalization.",
        },
      });
    }
  }

  const normalizationDiffEntries = buildLeadNormalizationDiff({
    beforeLead: {
      propertyId: baseLead.propertyId,
      leadSourceId: baseLead.leadSourceId,
      fullName: baseLead.fullName,
      email: baseLead.email,
      phone: baseLead.phone,
      preferredContactChannel: baseLead.preferredContactChannel,
    },
    afterLead: {
      propertyId: resolvedLeadPropertyId,
      leadSourceId: leadSource.id,
      fullName: resolvedLeadFullName,
      email: resolvedLeadEmailAddress,
      phone: resolvedLeadPhoneNumber,
      preferredContactChannel: resolvedPreferredContactChannel,
    },
    beforeFieldMetadata: baseLead.fieldMetadata,
    afterFieldMetadata: mergedLeadFieldMetadata,
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

  if (
    normalizationDiffEntries.length > 0 &&
    conflictedFieldKeys.length === 0 &&
    shouldRecomputeFitForTrigger("answer_changed")
  ) {
    try {
      const { applyLeadEvaluation } = await import("./lead-workflow");
      await applyLeadEvaluation({
        workspaceId: payload.workspaceId,
        leadId: lead.id,
        actorUserId: "system-normalization",
      });
    } catch {
      await prisma.auditEvent.create({
        data: {
          workspaceId: payload.workspaceId,
          leadId: lead.id,
          propertyId: property?.id ?? lead.propertyId,
          eventType: "fit_recompute_failed_after_normalization",
          payload: {
            triggerType: "answer_changed",
          },
        },
      });
    }
  }

  if (createdNewLeadRecord) {
    await prisma.auditEvent.create({
      data: {
        workspaceId: payload.workspaceId,
        leadId: lead.id,
        propertyId: property?.id ?? lead.propertyId,
        eventType: workflowEventTypes.leadCreated,
        payload: {
          sourceType: payload.leadSourceType,
          sourceName: payload.leadSourceName,
        },
      },
    });

    await prisma.notificationEvent.create({
      data: {
        workspaceId: payload.workspaceId,
        leadId: lead.id,
        type: NotificationType.NEW_LEAD,
        title: "New lead created",
        body: `${lead.fullName} was added from ${payload.leadSourceName}.`,
      },
    });

    await queueOutboundWorkflowWebhook({
      workspaceId: payload.workspaceId,
      leadId: lead.id,
      eventType: "lead.created",
      payload: {
        leadId: lead.id,
        workspaceId: payload.workspaceId,
        sourceType: payload.leadSourceType,
      },
    });
  }

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
        externalThreadId: payload.externalThreadId ?? null,
      },
    }));

  if (
    lead.conversation &&
    payload.externalThreadId &&
    !lead.conversation.externalThreadId
  ) {
    await prisma.conversation.update({
      where: {
        id: lead.conversation.id,
      },
      data: {
        externalThreadId: payload.externalThreadId,
      },
    });
  }

  const inboundMessageDeliveryStatus = serializeDeliveryStatus({
    state: "received",
    provider: payload.leadSourceName,
  });

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: MessageDirection.INBOUND,
      origin: MessageOrigin.INBOUND,
      channel: payload.channel,
      subject: payload.subject ?? null,
      body: payload.body,
      externalMessageId: payload.externalMessageId ?? null,
      externalThreadId: payload.externalThreadId ?? null,
      receivedAt: payload.receivedAt,
      deliveryStatus: inboundMessageDeliveryStatus,
    },
  });

  await prisma.auditEvent.create({
    data: {
      workspaceId: payload.workspaceId,
      leadId: lead.id,
      propertyId: property?.id ?? lead.propertyId,
      eventType: "inbound_message_recorded",
      payload: {
        messageId: message.id,
        channel: payload.channel,
        externalMessageId: payload.externalMessageId ?? null,
        externalThreadId: payload.externalThreadId ?? null,
        deliveryStatus: inboundMessageDeliveryStatus,
      },
    },
  });

  if (bestDuplicateCandidate && existingLead) {
    await prisma.auditEvent.create({
      data: {
        workspaceId: payload.workspaceId,
        leadId: existingLead.id,
        propertyId: property?.id ?? existingLead.propertyId,
        eventType: "inquiry_attached",
        payload: {
          confidenceScore: bestDuplicateCandidate.confidenceScore,
          confidenceBand: bestDuplicateCandidate.confidenceBand,
          matchedSignals: bestDuplicateCandidate.matchedSignals,
          externalMessageId: payload.externalMessageId ?? null,
          externalThreadId: payload.externalThreadId ?? null,
        },
      },
    });
  }

  if (bestDuplicateCandidate && shouldFlagPossibleDuplicate) {
    await prisma.auditEvent.create({
      data: {
        workspaceId: payload.workspaceId,
        leadId: lead.id,
        propertyId: property?.id ?? lead.propertyId,
        eventType: "possible_duplicate_flagged",
        payload: {
          candidateLeadId: bestDuplicateCandidate.candidateLeadId,
          confidenceScore: bestDuplicateCandidate.confidenceScore,
          confidenceBand: bestDuplicateCandidate.confidenceBand,
          matchedSignals: bestDuplicateCandidate.matchedSignals,
        },
      },
    });
  }

  if (conflictedFieldKeys.length > 0) {
    await prisma.auditEvent.create({
      data: {
        workspaceId: payload.workspaceId,
        leadId: lead.id,
        propertyId: property?.id ?? lead.propertyId,
        eventType: "lead_conflict_detected",
        payload: {
          conflictedFieldKeys,
          conflictHistoryEntries,
          fitRecomputeTriggered: true,
        },
      },
    });
  }

  await prisma.auditEvent.create({
    data: {
      workspaceId: payload.workspaceId,
      leadId: lead.id,
      propertyId: property?.id ?? lead.propertyId,
      eventType: "lead.normalized",
      payload: {
        sourceName: payload.leadSourceName,
        sourceType: payload.leadSourceType,
        externalMessageId: payload.externalMessageId ?? null,
        externalThreadId: payload.externalThreadId ?? null,
        changedFieldCount: normalizationDiffEntries.length,
        changedFields: normalizationDiffEntries,
      },
    },
  });

  await prisma.auditEvent.create({
    data: {
      workspaceId: payload.workspaceId,
      leadId: lead.id,
      propertyId: property?.id ?? lead.propertyId,
      eventType: getNormalizationEventLabel({
        leadSourceType: payload.leadSourceType,
        channel: payload.channel,
      }),
      payload: {
        externalMessageId: payload.externalMessageId ?? null,
        externalThreadId: payload.externalThreadId ?? null,
        sourceName: payload.leadSourceName,
        sourceType: payload.leadSourceType,
        contactKey: payload.email ?? payload.phone ?? slugFromName(payload.fullName),
      },
    },
  });

  if (shouldApplyOptOutDirective && optOutDirective === "opt_out") {
    await prisma.auditEvent.create({
      data: {
        workspaceId: payload.workspaceId,
        leadId: lead.id,
        propertyId: property?.id ?? lead.propertyId,
        eventType: "lead_opted_out",
        payload: {
          channel: payload.channel,
          messageId: message.id,
        },
      },
    });
  }

  if (shouldApplyOptOutDirective && optOutDirective === "opt_in") {
    await prisma.auditEvent.create({
      data: {
        workspaceId: payload.workspaceId,
        leadId: lead.id,
        propertyId: property?.id ?? lead.propertyId,
        eventType: "lead_opted_in",
        payload: {
          channel: payload.channel,
          messageId: message.id,
        },
      },
    });
  }

  return {
    leadId: lead.id,
    messageId: message.id,
    conversationId: conversation.id,
    idempotentReplay: false,
  };
}
