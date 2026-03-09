import { z } from "zod";
import {
  AuditActorType,
  ContactChannel,
  LeadStatus,
  MembershipRole,
  NotificationType,
  QualificationFit,
  type Prisma,
} from "@/generated/prisma/client";
import { getCurrentWorkspaceMembership, getLeadCreateViewData } from "@/lib/app-data";
import { canMembershipRolePerformLeadAction } from "@/lib/membership-role-permissions";
import { parseNullableInt, parseNullableString } from "@/lib/onboarding";
import { prisma } from "@/lib/prisma";
import { queueOutboundWorkflowWebhook } from "@/lib/lead-workflow";
import { workflowEventTypes } from "@/lib/workflow-events";

const createManualLeadSchema = z
  .object({
    email: z.string().email().nullable(),
    fullName: z.string().min(1, "Lead name is required."),
    leadSourceId: z.string().min(1).nullable(),
    monthlyBudget: z
      .number()
      .int()
      .positive("Monthly budget must be a positive whole number.")
      .nullable(),
    moveInDate: z.date().nullable(),
    notes: z.string().nullable(),
    phone: z.string().min(1).nullable(),
    preferredContactChannel: z.nativeEnum(ContactChannel).nullable(),
    propertyId: z.string().min(1).nullable(),
  })
  .superRefine((value, context) => {
    if (!value.email && !value.phone) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Add at least one contact method.",
        path: ["email"],
      });
    }

    if (value.preferredContactChannel === ContactChannel.EMAIL && !value.email) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Email is required when email is the preferred contact channel.",
        path: ["preferredContactChannel"],
      });
    }

    if (
      (value.preferredContactChannel === ContactChannel.PHONE ||
        value.preferredContactChannel === ContactChannel.SMS) &&
      !value.phone
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Phone is required when phone or SMS is the preferred contact channel.",
        path: ["preferredContactChannel"],
      });
    }
  });

type ManualLeadDraft = z.infer<typeof createManualLeadSchema>;

type CurrentMembership = Awaited<ReturnType<typeof getCurrentWorkspaceMembership>>;
type LeadCreateViewData = Awaited<ReturnType<typeof getLeadCreateViewData>>;

export class CreateManualLeadActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CreateManualLeadActionError";
  }
}

export type CreateManualLeadDependencies = {
  canMembershipRolePerformLeadAction: typeof canMembershipRolePerformLeadAction;
  createAuditEvent: (input: {
    actorType: AuditActorType;
    actorUserId: string;
    eventType: string;
    leadId: string;
    payload: Prisma.InputJsonValue;
    propertyId: string | null;
    workspaceId: string;
  }) => Promise<unknown>;
  createContact: (input: {
    email: string | null;
    leadId: string;
    phone: string | null;
    preferredChannel: ContactChannel | null;
  }) => Promise<unknown>;
  createLead: (input: {
    assignedMembershipId: string;
    email: string | null;
    fitResult: QualificationFit;
    fullName: string;
    lastActivityAt: Date;
    leadSourceId: string;
    monthlyBudget: number | null;
    moveInDate: Date | null;
    notes: string | null;
    phone: string | null;
    preferredContactChannel: ContactChannel | null;
    propertyId: string | null;
    status: LeadStatus;
    workspaceId: string;
  }) => Promise<{ id: string }>;
  createNotificationEvent: (input: {
    body: string;
    leadId: string;
    title: string;
    type: NotificationType;
    workspaceId: string;
  }) => Promise<unknown>;
  getCurrentWorkspaceMembership: typeof getCurrentWorkspaceMembership;
  getLeadCreateViewData: typeof getLeadCreateViewData;
  queueOutboundWorkflowWebhook: typeof queueOutboundWorkflowWebhook;
};

const defaultCreateManualLeadDependencies: CreateManualLeadDependencies = {
  canMembershipRolePerformLeadAction,
  createAuditEvent: (input) =>
    prisma.auditEvent.create({
      data: {
        actorType: input.actorType,
        actorUserId: input.actorUserId,
        eventType: input.eventType,
        leadId: input.leadId,
        payload: input.payload,
        propertyId: input.propertyId,
        workspaceId: input.workspaceId,
      },
    }),
  createContact: (input) =>
    prisma.contact.create({
      data: {
        email: input.email,
        leadId: input.leadId,
        phone: input.phone,
        preferredChannel: input.preferredChannel,
      },
    }),
  createLead: (input) =>
    prisma.lead.create({
      data: {
        assignedMembershipId: input.assignedMembershipId,
        email: input.email,
        fitResult: input.fitResult,
        fullName: input.fullName,
        lastActivityAt: input.lastActivityAt,
        leadSourceId: input.leadSourceId,
        monthlyBudget: input.monthlyBudget,
        moveInDate: input.moveInDate,
        notes: input.notes,
        phone: input.phone,
        preferredContactChannel: input.preferredContactChannel,
        propertyId: input.propertyId,
        status: input.status,
        workspaceId: input.workspaceId,
      },
      select: {
        id: true,
      },
    }),
  createNotificationEvent: (input) =>
    prisma.notificationEvent.create({
      data: {
        body: input.body,
        leadId: input.leadId,
        title: input.title,
        type: input.type,
        workspaceId: input.workspaceId,
      },
    }),
  getCurrentWorkspaceMembership,
  getLeadCreateViewData,
  queueOutboundWorkflowWebhook,
};

export async function handleCreateManualLeadAction(
  formData: FormData,
  dependencies: CreateManualLeadDependencies = defaultCreateManualLeadDependencies,
) {
  const membership = await dependencies.getCurrentWorkspaceMembership();

  if (
    !dependencies.canMembershipRolePerformLeadAction(membership.role, "assignProperty")
  ) {
    throw new CreateManualLeadActionError(
      "Your role cannot add manual leads in this workspace.",
    );
  }

  const viewData = await dependencies.getLeadCreateViewData();
  const parsedDraft = parseCreateManualLeadDraft(formData);
  const normalizedDraft = resolveCreateManualLeadDraft({
    draft: parsedDraft,
    membership,
    viewData,
  });
  const createdLead = await dependencies.createLead({
    assignedMembershipId: membership.id,
    email: normalizedDraft.email,
    fitResult: QualificationFit.UNKNOWN,
    fullName: normalizedDraft.fullName,
    lastActivityAt: new Date(),
    leadSourceId: normalizedDraft.leadSourceId,
    monthlyBudget: normalizedDraft.monthlyBudget,
    moveInDate: normalizedDraft.moveInDate,
    notes: normalizedDraft.notes,
    phone: normalizedDraft.phone,
    preferredContactChannel: normalizedDraft.preferredContactChannel,
    propertyId: normalizedDraft.propertyId,
    status: LeadStatus.NEW,
    workspaceId: membership.workspaceId,
  });

  await dependencies.createContact({
    email: normalizedDraft.email,
    leadId: createdLead.id,
    phone: normalizedDraft.phone,
    preferredChannel: normalizedDraft.preferredContactChannel,
  });

  const selectedSource = viewData.sources.find(
    (source) => source.id === normalizedDraft.leadSourceId,
  );

  await dependencies.createAuditEvent({
    actorType: AuditActorType.USER,
    actorUserId: membership.userId,
    eventType: workflowEventTypes.leadCreated,
    leadId: createdLead.id,
    payload: {
      createdManually: true,
      sourceName: selectedSource?.name ?? "Manual intake",
      sourceType: selectedSource?.type ?? "MANUAL",
    },
    propertyId: normalizedDraft.propertyId,
    workspaceId: membership.workspaceId,
  });

  await dependencies.createNotificationEvent({
    body: `${normalizedDraft.fullName} was added from ${selectedSource?.name ?? "Manual intake"}.`,
    leadId: createdLead.id,
    title: "New lead created",
    type: NotificationType.NEW_LEAD,
    workspaceId: membership.workspaceId,
  });

  await dependencies.queueOutboundWorkflowWebhook({
    eventType: "lead.created",
    leadId: createdLead.id,
    payload: {
      leadId: createdLead.id,
      sourceType: selectedSource?.type ?? "MANUAL",
      workspaceId: membership.workspaceId,
    },
    workspaceId: membership.workspaceId,
  });

  return createdLead;
}

export function buildCreateLeadRetryPath(
  basePath: string,
  formData: FormData,
  errorMessage: string,
) {
  const searchParameters = new URLSearchParams();

  appendRetryField(searchParameters, formData, "fullName");
  appendRetryField(searchParameters, formData, "email");
  appendRetryField(searchParameters, formData, "phone");
  appendRetryField(searchParameters, formData, "propertyId");
  appendRetryField(searchParameters, formData, "leadSourceId");
  appendRetryField(searchParameters, formData, "preferredContactChannel");
  appendRetryField(searchParameters, formData, "moveInDate");
  appendRetryField(searchParameters, formData, "monthlyBudget");
  appendRetryField(searchParameters, formData, "notes");
  searchParameters.set("error", errorMessage);

  return `${basePath}?${searchParameters.toString()}`;
}

export function resolveCreateManualLeadDraft(params: {
  draft: ManualLeadDraft;
  membership: Pick<CurrentMembership, "role">;
  viewData: Pick<LeadCreateViewData, "defaultLeadSourceId" | "properties" | "sources">;
}) {
  if (!canRoleCreateManualLead(params.membership.role)) {
    throw new CreateManualLeadActionError(
      "Your role cannot add manual leads in this workspace.",
    );
  }

  const resolvedLeadSourceId =
    params.draft.leadSourceId ?? params.viewData.defaultLeadSourceId;

  if (!resolvedLeadSourceId) {
    throw new CreateManualLeadActionError(
      "No lead source is available for manual intake yet.",
    );
  }

  if (
    params.draft.propertyId &&
    !params.viewData.properties.some((property) => property.id === params.draft.propertyId)
  ) {
    throw new CreateManualLeadActionError("Choose a property you can access.");
  }

  if (!params.viewData.sources.some((source) => source.id === resolvedLeadSourceId)) {
    throw new CreateManualLeadActionError("Choose a lead source that belongs to this workspace.");
  }

  return {
    ...params.draft,
    leadSourceId: resolvedLeadSourceId,
  };
}

function canRoleCreateManualLead(membershipRole: MembershipRole) {
  return canMembershipRolePerformLeadAction(membershipRole, "assignProperty");
}

function parseCreateManualLeadDraft(formData: FormData) {
  const moveInDate = parseNullableString(formData, "moveInDate");
  const parsedDraft = createManualLeadSchema.safeParse({
    email: normalizeEmail(parseNullableString(formData, "email")),
    fullName: parseNullableString(formData, "fullName") ?? "",
    leadSourceId: parseNullableString(formData, "leadSourceId"),
    monthlyBudget: parseNullableInt(formData, "monthlyBudget"),
    moveInDate: moveInDate ? new Date(`${moveInDate}T00:00:00.000Z`) : null,
    notes: parseNullableString(formData, "notes"),
    phone: normalizePhone(parseNullableString(formData, "phone")),
    preferredContactChannel: parsePreferredContactChannel(formData),
    propertyId: parseNullableString(formData, "propertyId"),
  });

  if (!parsedDraft.success) {
    throw new CreateManualLeadActionError(parsedDraft.error.issues[0]?.message ?? "Could not create lead.");
  }

  return parsedDraft.data;
}

function appendRetryField(
  searchParameters: URLSearchParams,
  formData: FormData,
  key: string,
) {
  const value = formData.get(key);

  if (typeof value === "string" && value.trim().length > 0) {
    searchParameters.set(key, value);
  }
}

function normalizeEmail(value: string | null) {
  return value?.toLowerCase() ?? null;
}

function normalizePhone(value: string | null) {
  if (!value) {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function parsePreferredContactChannel(formData: FormData) {
  const value = parseNullableString(formData, "preferredContactChannel");

  switch (value) {
    case ContactChannel.EMAIL:
      return ContactChannel.EMAIL;
    case ContactChannel.SMS:
      return ContactChannel.SMS;
    case ContactChannel.PHONE:
      return ContactChannel.PHONE;
    default:
      return null;
  }
}