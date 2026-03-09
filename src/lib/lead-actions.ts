"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  AuditActorType,
  CalendarSyncProvider,
  DeclineReason,
  LeadStatus,
  MembershipRole,
  MessageChannel,
  MessageDirection,
  MessageOrigin,
  NotificationType,
  PropertyLifecycleStatus,
  QualificationFit,
  ScreeningChargeMode,
  ScreeningConnectionAuthState,
  ScreeningProvider,
  ScreeningRequestStatus,
  TourSchedulingMode,
  TourEventStatus,
  WorkspaceCapability,
} from "@/generated/prisma/client";
import {
  getCurrentWorkspaceMembership,
  getCurrentWorkspaceState,
} from "@/lib/app-data";
import {
  isDateTimeWithinAvailabilityWindow,
  parseAvailabilityWindowConfig,
} from "@/lib/availability-windows";
import { serializeDeliveryStatus } from "@/lib/delivery-status";
import {
  buildLeadChannelOptOutUpdate,
  formatMessageChannelLabel,
  isLeadChannelOptedOut,
} from "@/lib/lead-channel-opt-outs";
import {
  isProviderConfigurationError,
  markMessageDeliveryFailure,
  markMessageProviderUnresolved,
  sendQueuedMessage,
} from "@/lib/message-delivery";
import { scheduleReminderSend } from "@/lib/jobs";
import {
  isLeadWorkflowError,
  LeadWorkflowError,
} from "@/lib/lead-workflow-errors";
import {
  applyLeadEvaluation,
  appendNotificationEvent,
  evaluateLeadQualification,
  getLeadWorkflowContext,
  performLeadWorkflowAction,
  queueOutboundWorkflowWebhook,
} from "@/lib/lead-workflow";
import { shouldRecomputeFitForTrigger } from "@/lib/lead-rule-engine";
import {
  canMembershipRolePerformLeadAction,
  type LeadActionPermissionKey,
} from "@/lib/membership-role-permissions";
import { resolveInternalNoteMentions } from "@/lib/internal-note-mentions";
import { propertyAcceptsNewLeads } from "@/lib/property-lifecycle";
import { prisma } from "@/lib/prisma";
import { assertLeadStatusTransitionIsAllowed } from "@/lib/lead-status-machine";
import {
  sendTourCanceledNotification,
  sendTourRescheduledNotification,
  sendTourScheduledConfirmation,
} from "@/lib/tour-communications";
import {
  buildCalendarSyncState,
  buildInitialTourReminderState,
  parseCalendarConnectionsConfig,
  parseTourReminderSequence,
  resolveAssignedTourMembershipId,
  resolveTourReminderDelays,
} from "@/lib/tour-scheduling";
import {
  buildScreeningStatusTimestampUpdate,
  resolveScreeningStatusTransitionGuard,
  resolveScreeningWebhookEventType,
  resolveScreeningWorkflowEventType,
} from "@/lib/screening";
import { workspaceHasCapability } from "@/lib/workspace-plan";
import { workflowEventTypes } from "@/lib/workflow-events";
import { appendWorkflowErrorCodeToPath } from "@/lib/workflow-error-routing";

type LeadActionContext = {
  actorUserId: string;
  leadId: string;
  membershipRole: MembershipRole;
  workspaceId: string;
};

export type LeadActionPermissionDependencies = {
  canMembershipRolePerformLeadAction: typeof canMembershipRolePerformLeadAction;
  createAuditEvent: (input: {
    workspaceId: string;
    leadId: string;
    actorUserId: string;
    actorType: AuditActorType;
    eventType: string;
    payload: unknown;
  }) => Promise<unknown>;
};

const defaultLeadActionPermissionDependencies: LeadActionPermissionDependencies = {
  canMembershipRolePerformLeadAction,
  createAuditEvent: (input) =>
    prisma.auditEvent.create({
      data: {
        workspaceId: input.workspaceId,
        leadId: input.leadId,
        actorUserId: input.actorUserId,
        actorType: input.actorType,
        eventType: input.eventType,
        payload: input.payload as never,
      },
    }),
};

export type WorkflowActionRedirectDependencies = {
  appendWorkflowErrorCodeToPath: typeof appendWorkflowErrorCodeToPath;
  isLeadWorkflowError: typeof isLeadWorkflowError;
  redirect: typeof redirect;
  refreshLeadWorkflow: (leadId: string) => void;
};

const defaultWorkflowActionRedirectDependencies: WorkflowActionRedirectDependencies = {
  appendWorkflowErrorCodeToPath,
  isLeadWorkflowError,
  redirect,
  refreshLeadWorkflow,
};

export type EvaluateLeadActionDependencies = {
  applyLeadEvaluation: (params: LeadActionContext) => Promise<unknown>;
  assertLeadActionPermission: (params: {
    workspaceId: string;
    leadId: string;
    actorUserId: string;
    membershipRole: MembershipRole;
    leadActionPermissionKey: LeadActionPermissionKey;
  }) => Promise<void>;
  executeWorkflowActionWithErrorRedirect: (params: {
    leadId: string;
    redirectPath?: string;
    executeAction: () => Promise<void>;
  }) => Promise<void>;
  getActionContext: (leadId: string) => Promise<LeadActionContext>;
};

const defaultEvaluateLeadActionDependencies: EvaluateLeadActionDependencies = {
  applyLeadEvaluation,
  assertLeadActionPermission: (params) => handleAssertLeadActionPermission(params),
  executeWorkflowActionWithErrorRedirect: (params) => handleExecuteWorkflowActionWithErrorRedirect(params),
  getActionContext,
};

export type AssignLeadPropertyActionDependencies = {
  applyLeadEvaluation: (params: LeadActionContext) => Promise<unknown>;
  assertLeadActionPermission: (params: {
    workspaceId: string;
    leadId: string;
    actorUserId: string;
    membershipRole: MembershipRole;
    leadActionPermissionKey: LeadActionPermissionKey;
  }) => Promise<void>;
  executeWorkflowActionWithErrorRedirect: (params: {
    leadId: string;
    redirectPath?: string;
    executeAction: () => Promise<void>;
  }) => Promise<void>;
  findAssignableProperty: (input: { propertyId: string; workspaceId: string }) => Promise<{
    id: string;
    name: string;
  } | null>;
  findExistingProperty: (input: { propertyId: string; workspaceId: string }) => Promise<{
    lifecycleStatus: PropertyLifecycleStatus;
  } | null>;
  getActionContext: (leadId: string) => Promise<LeadActionContext>;
  propertyAcceptsNewLeads: (propertyLifecycleStatus: PropertyLifecycleStatus) => boolean;
  shouldRecomputeFitForTrigger: typeof shouldRecomputeFitForTrigger;
  updateLead: (input: { leadId: string; propertyId: string; lastActivityAt: Date }) => Promise<unknown>;
  createAuditEvent: (input: {
    workspaceId: string;
    leadId: string;
    propertyId: string;
    actorUserId: string;
    actorType: AuditActorType;
    eventType: string;
    payload: unknown;
  }) => Promise<unknown>;
};

const defaultAssignLeadPropertyActionDependencies: AssignLeadPropertyActionDependencies = {
  applyLeadEvaluation,
  assertLeadActionPermission: (params) => handleAssertLeadActionPermission(params),
  executeWorkflowActionWithErrorRedirect: (params) => handleExecuteWorkflowActionWithErrorRedirect(params),
  findAssignableProperty: ({ propertyId, workspaceId }) =>
    prisma.property.findFirst({
      where: {
        id: propertyId,
        workspaceId,
        lifecycleStatus: PropertyLifecycleStatus.ACTIVE,
      },
    }),
  findExistingProperty: ({ propertyId, workspaceId }) =>
    prisma.property.findFirst({
      where: {
        id: propertyId,
        workspaceId,
      },
      select: {
        lifecycleStatus: true,
      },
    }),
  getActionContext,
  propertyAcceptsNewLeads,
  shouldRecomputeFitForTrigger,
  updateLead: ({ leadId, propertyId, lastActivityAt }) =>
    prisma.lead.update({
      where: {
        id: leadId,
      },
      data: {
        propertyId,
        lastActivityAt,
      },
    }),
  createAuditEvent: (input) =>
    prisma.auditEvent.create({
      data: {
        workspaceId: input.workspaceId,
        leadId: input.leadId,
        propertyId: input.propertyId,
        actorUserId: input.actorUserId,
        actorType: input.actorType,
        eventType: input.eventType,
        payload: input.payload as never,
      },
    }),
};

export type CompleteTourActionDependencies = {
  assertLeadActionPermission: (params: {
    workspaceId: string;
    leadId: string;
    actorUserId: string;
    membershipRole: MembershipRole;
    leadActionPermissionKey: LeadActionPermissionKey;
  }) => Promise<void>;
  completeTour: (input: {
    actionContext: LeadActionContext;
    activeTour: { id: string };
    lead: { id: string; propertyId: string | null };
  }) => Promise<void>;
  executeWorkflowActionWithErrorRedirect: (params: {
    leadId: string;
    redirectPath?: string;
    executeAction: () => Promise<void>;
  }) => Promise<void>;
  findLeadWithActiveScheduledTour: (input: { leadId: string; workspaceId: string }) => Promise<{
    id: string;
    propertyId: string | null;
    tours: Array<{ id: string }>;
  } | null>;
  getActionContext: (leadId: string) => Promise<LeadActionContext>;
};

const defaultCompleteTourActionDependencies: CompleteTourActionDependencies = {
  assertLeadActionPermission: (params) => handleAssertLeadActionPermission(params),
  completeTour: async ({ actionContext, activeTour, lead }) => {
    await prisma.$transaction(async (transactionClient) => {
      await transactionClient.tourEvent.update({
        where: {
          id: activeTour.id,
        },
        data: {
          completedAt: new Date(),
          status: TourEventStatus.COMPLETED,
        },
      });

      await transactionClient.lead.update({
        where: {
          id: lead.id,
        },
        data: {
          lastActivityAt: new Date(),
          status: LeadStatus.QUALIFIED,
        },
      });

      await transactionClient.auditEvent.create({
        data: {
          actorType: AuditActorType.USER,
          actorUserId: actionContext.actorUserId,
          eventType: "tour_completed",
          leadId: lead.id,
          payload: {
            leadId: lead.id,
            tourEventId: activeTour.id,
          },
          propertyId: lead.propertyId,
          workspaceId: actionContext.workspaceId,
        },
      });
    });
  },
  executeWorkflowActionWithErrorRedirect: (params) => handleExecuteWorkflowActionWithErrorRedirect(params),
  findLeadWithActiveScheduledTour: ({ leadId, workspaceId }) =>
    prisma.lead.findFirst({
      where: {
        id: leadId,
        workspaceId,
      },
      include: {
        tours: {
          where: {
            status: TourEventStatus.SCHEDULED,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
    }),
  getActionContext,
};

export type MarkTourNoShowActionDependencies = {
  assertLeadActionPermission: (params: {
    workspaceId: string;
    leadId: string;
    actorUserId: string;
    membershipRole: MembershipRole;
    leadActionPermissionKey: LeadActionPermissionKey;
  }) => Promise<void>;
  executeWorkflowActionWithErrorRedirect: (params: {
    leadId: string;
    redirectPath?: string;
    executeAction: () => Promise<void>;
  }) => Promise<void>;
  findLeadWithActiveScheduledTour: (input: { leadId: string; workspaceId: string }) => Promise<{
    id: string;
    propertyId: string | null;
    tours: Array<{ id: string }>;
  } | null>;
  getActionContext: (leadId: string) => Promise<LeadActionContext>;
  markTourNoShow: (input: {
    actionContext: LeadActionContext;
    activeTour: { id: string };
    lead: { id: string; propertyId: string | null };
    operatorNoShowReason: string;
  }) => Promise<void>;
};

const defaultMarkTourNoShowActionDependencies: MarkTourNoShowActionDependencies = {
  assertLeadActionPermission: (params) => handleAssertLeadActionPermission(params),
  executeWorkflowActionWithErrorRedirect: (params) => handleExecuteWorkflowActionWithErrorRedirect(params),
  findLeadWithActiveScheduledTour: ({ leadId, workspaceId }) =>
    prisma.lead.findFirst({
      where: {
        id: leadId,
        workspaceId,
      },
      include: {
        tours: {
          where: {
            status: TourEventStatus.SCHEDULED,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
    }),
  getActionContext,
  markTourNoShow: async ({ actionContext, activeTour, lead, operatorNoShowReason }) => {
    await prisma.$transaction(async (transactionClient) => {
      await transactionClient.tourEvent.update({
        where: {
          id: activeTour.id,
        },
        data: {
          completedAt: new Date(),
          operatorNoShowReason,
          status: TourEventStatus.NO_SHOW,
        },
      });

      await transactionClient.lead.update({
        where: {
          id: lead.id,
        },
        data: {
          lastActivityAt: new Date(),
          status: LeadStatus.UNDER_REVIEW,
        },
      });

      await transactionClient.auditEvent.create({
        data: {
          actorType: AuditActorType.USER,
          actorUserId: actionContext.actorUserId,
          eventType: "tour_no_show_recorded",
          leadId: lead.id,
          payload: {
            leadId: lead.id,
            operatorNoShowReason,
            tourEventId: activeTour.id,
          },
          propertyId: lead.propertyId,
          workspaceId: actionContext.workspaceId,
        },
      });
    });
  },
};

type ManualOutboundWorkspaceMember = {
  userId: string;
  name: string;
  emailAddress: string;
  membershipRole: MembershipRole;
};

type ManualOutboundLead = {
  contact: {
    email: string | null;
    phone: string | null;
  } | null;
  conversation: {
    id: string;
  } | null;
  email: string | null;
  fullName: string;
  id: string;
  propertyId: string | null;
  phone: string | null;
  optOutAt?: Date | null;
  optOutReason?: string | null;
  emailOptOutAt?: Date | null;
  emailOptOutReason?: string | null;
  smsOptOutAt?: Date | null;
  smsOptOutReason?: string | null;
  whatsappOptOutAt?: Date | null;
  whatsappOptOutReason?: string | null;
  instagramOptOutAt?: Date | null;
  instagramOptOutReason?: string | null;
};

export type SendManualOutboundMessageActionDependencies = {
  assertLeadActionPermission: (params: {
    workspaceId: string;
    leadId: string;
    actorUserId: string;
    membershipRole: MembershipRole;
    leadActionPermissionKey: LeadActionPermissionKey;
  }) => Promise<void>;
  createConversation: (input: {
    leadId: string;
    subject: string | null;
  }) => Promise<{ id: string }>;
  createMessage: (input: {
    body: string;
    channel: MessageChannel;
    conversationId: string;
    deliveryStatus: string;
    direction: MessageDirection;
    origin: MessageOrigin;
    sentAt: Date | null;
    subject: string | null;
  }) => Promise<{ id: string }>;
  executeWorkflowActionWithErrorRedirect: (params: {
    leadId: string;
    redirectPath?: string;
    executeAction: () => Promise<void>;
  }) => Promise<void>;
  findLeadForManualOutbound: (input: { leadId: string; workspaceId: string }) => Promise<ManualOutboundLead | null>;
  findWorkspaceMembersForInternalNotes: (input: {
    workspaceId: string;
    actorUserId: string;
  }) => Promise<ManualOutboundWorkspaceMember[]>;
  getActionContext: (leadId: string) => Promise<LeadActionContext>;
  isLeadChannelOptedOut: typeof isLeadChannelOptedOut;
  isProviderConfigurationError: typeof isProviderConfigurationError;
  markMessageDeliveryFailure: typeof markMessageDeliveryFailure;
  markMessageProviderUnresolved: typeof markMessageProviderUnresolved;
  persistManualOutboundActivity: (input: {
    actionContext: LeadActionContext;
    lead: { id: string; propertyId: string | null; optOutAt?: Date | null };
    messageId: string;
    outboundMessageChannel: MessageChannel;
  }) => Promise<void>;
  resolveInternalNoteMentions: typeof resolveInternalNoteMentions;
  sendQueuedMessage: typeof sendQueuedMessage;
};

const defaultSendManualOutboundMessageActionDependencies: SendManualOutboundMessageActionDependencies = {
  assertLeadActionPermission: (params) => handleAssertLeadActionPermission(params),
  createConversation: ({ leadId, subject }) =>
    prisma.conversation.create({
      data: {
        leadId,
        subject,
      },
    }),
  createMessage: (input) =>
    prisma.message.create({
      data: {
        body: input.body,
        channel: input.channel,
        conversationId: input.conversationId,
        deliveryStatus: input.deliveryStatus,
        direction: input.direction,
        origin: input.origin,
        sentAt: input.sentAt,
        subject: input.subject,
      },
    }),
  executeWorkflowActionWithErrorRedirect: (params) => handleExecuteWorkflowActionWithErrorRedirect(params),
  findLeadForManualOutbound: ({ leadId, workspaceId }) =>
    prisma.lead.findFirst({
      where: {
        id: leadId,
        workspaceId,
      },
      include: {
        contact: true,
        conversation: true,
      },
    }),
  findWorkspaceMembersForInternalNotes: async ({ workspaceId, actorUserId }) => {
    const workspaceMembers = await prisma.membership.findMany({
      where: {
        workspaceId,
        userId: {
          not: actorUserId,
        },
      },
      include: {
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return workspaceMembers.map((workspaceMember) => ({
      userId: workspaceMember.userId,
      name: workspaceMember.user.name ?? workspaceMember.user.email ?? "Teammate",
      emailAddress:
        workspaceMember.user.email ?? `${workspaceMember.userId}@roomflow.local`,
      membershipRole: workspaceMember.role,
    }));
  },
  getActionContext,
  isLeadChannelOptedOut,
  isProviderConfigurationError,
  markMessageDeliveryFailure,
  markMessageProviderUnresolved,
  persistManualOutboundActivity: async ({
    actionContext,
    lead,
    messageId,
    outboundMessageChannel,
  }) => {
    await prisma.$transaction(async (transactionClient) => {
      await transactionClient.lead.update({
        where: {
          id: lead.id,
        },
        data: {
          lastActivityAt: new Date(),
        },
      });

      await transactionClient.auditEvent.create({
        data: {
          workspaceId: actionContext.workspaceId,
          leadId: lead.id,
          propertyId: lead.propertyId,
          actorUserId: actionContext.actorUserId,
          actorType: AuditActorType.USER,
          eventType: "manual_outbound_sent",
          payload: {
            messageId,
            channel: outboundMessageChannel,
            optOutAt: lead.optOutAt?.toISOString() ?? null,
          },
        },
      });
    });
  },
  resolveInternalNoteMentions,
  sendQueuedMessage,
};

type LeadChannelOptOutRecord = {
  id: string;
  propertyId: string | null;
  optOutAt: Date | null;
  optOutReason: string | null;
  emailOptOutAt: Date | null;
  emailOptOutReason: string | null;
  smsOptOutAt: Date | null;
  smsOptOutReason: string | null;
  whatsappOptOutAt: Date | null;
  whatsappOptOutReason: string | null;
  instagramOptOutAt: Date | null;
  instagramOptOutReason: string | null;
};

export type UpdateLeadChannelOptOutActionDependencies = {
  assertLeadActionPermission: (params: {
    workspaceId: string;
    leadId: string;
    actorUserId: string;
    membershipRole: MembershipRole;
    leadActionPermissionKey: LeadActionPermissionKey;
  }) => Promise<void>;
  buildLeadChannelOptOutUpdate: typeof buildLeadChannelOptOutUpdate;
  executeWorkflowActionWithErrorRedirect: (params: {
    leadId: string;
    redirectPath?: string;
    executeAction: () => Promise<void>;
  }) => Promise<void>;
  findLeadForChannelOptOut: (input: { leadId: string; workspaceId: string }) => Promise<LeadChannelOptOutRecord | null>;
  getActionContext: (leadId: string) => Promise<LeadActionContext>;
  persistLeadChannelOptOutUpdate: (input: {
    actionContext: LeadActionContext;
    channel: MessageChannel;
    isOptedOut: boolean;
    lead: { id: string; propertyId: string | null };
    reason: string | null;
    updateData: ReturnType<typeof buildLeadChannelOptOutUpdate>;
  }) => Promise<void>;
};

const defaultUpdateLeadChannelOptOutActionDependencies: UpdateLeadChannelOptOutActionDependencies = {
  assertLeadActionPermission: (params) => handleAssertLeadActionPermission(params),
  buildLeadChannelOptOutUpdate,
  executeWorkflowActionWithErrorRedirect: (params) => handleExecuteWorkflowActionWithErrorRedirect(params),
  findLeadForChannelOptOut: ({ leadId, workspaceId }) =>
    prisma.lead.findFirst({
      where: {
        id: leadId,
        workspaceId,
      },
      select: {
        id: true,
        propertyId: true,
        optOutAt: true,
        optOutReason: true,
        emailOptOutAt: true,
        emailOptOutReason: true,
        smsOptOutAt: true,
        smsOptOutReason: true,
        whatsappOptOutAt: true,
        whatsappOptOutReason: true,
        instagramOptOutAt: true,
        instagramOptOutReason: true,
      },
    }),
  getActionContext,
  persistLeadChannelOptOutUpdate: async ({
    actionContext,
    channel,
    isOptedOut,
    lead,
    reason,
    updateData,
  }) => {
    await prisma.$transaction(async (transactionClient) => {
      await transactionClient.lead.update({
        where: {
          id: lead.id,
        },
        data: {
          ...updateData,
          lastActivityAt: new Date(),
        },
      });

      await transactionClient.auditEvent.create({
        data: {
          workspaceId: actionContext.workspaceId,
          leadId: lead.id,
          propertyId: lead.propertyId,
          actorUserId: actionContext.actorUserId,
          actorType: AuditActorType.USER,
          eventType: isOptedOut ? "lead_opted_out" : "lead_opted_in",
          payload: {
            channel,
            reason,
            source: "operator_control",
          },
        },
      });
    });
  },
};

  export type DeclineLeadActionDependencies = {
    assertLeadActionPermission: (params: {
      workspaceId: string;
      leadId: string;
      actorUserId: string;
      membershipRole: MembershipRole;
      leadActionPermissionKey: LeadActionPermissionKey;
    }) => Promise<void>;
    assertLeadStatusTransitionIsAllowed: typeof assertLeadStatusTransitionIsAllowed;
    declineLead: (input: {
      actionContext: LeadActionContext;
      declineNote: string | null;
      declineReason: DeclineReason;
      lead: {
        id: string;
        status: LeadStatus;
        propertyId: string | null;
        conversation: {
          messages: Array<{ id: string }>;
        } | null;
      };
    }) => Promise<void>;
    executeWorkflowActionWithErrorRedirect: (params: {
      leadId: string;
      redirectPath?: string;
      executeAction: () => Promise<void>;
    }) => Promise<void>;
    findLeadForDecline: (input: { leadId: string; workspaceId: string }) => Promise<{
      id: string;
      status: LeadStatus;
      propertyId: string | null;
      conversation: {
        messages: Array<{ id: string }>;
      } | null;
    } | null>;
    getActionContext: (leadId: string) => Promise<LeadActionContext>;
  };

  const defaultDeclineLeadActionDependencies: DeclineLeadActionDependencies = {
    assertLeadActionPermission: (params) => handleAssertLeadActionPermission(params),
    assertLeadStatusTransitionIsAllowed,
    declineLead: async ({ actionContext, declineNote, declineReason, lead }) => {
      await prisma.$transaction(async (transactionClient) => {
        await transactionClient.lead.update({
          where: {
            id: lead.id,
          },
          data: {
            status: LeadStatus.DECLINED,
            declineReason,
            declinedAt: new Date(),
            isSoftDeclined: true,
            lastActivityAt: new Date(),
          },
        });

        await transactionClient.leadStatusHistory.create({
          data: {
            leadId: lead.id,
            fromStatus: lead.status,
            toStatus: LeadStatus.DECLINED,
            reason: `Declined (${declineReason})`,
          },
        });

        await transactionClient.auditEvent.create({
          data: {
            workspaceId: actionContext.workspaceId,
            leadId: lead.id,
            propertyId: lead.propertyId,
            actorUserId: actionContext.actorUserId,
            actorType: AuditActorType.USER,
            eventType: workflowEventTypes.declineRecorded,
            payload: {
              reason: declineReason,
              note: declineNote,
              previousStatus: lead.status,
              nextStatus: LeadStatus.DECLINED,
            },
          },
        });

        if (lead.conversation?.messages.length) {
          for (const queuedOutboundMessage of lead.conversation.messages) {
            await transactionClient.message.update({
              where: {
                id: queuedOutboundMessage.id,
              },
              data: {
                deliveryStatus: serializeDeliveryStatus({
                  state: "failed",
                  provider: null,
                  retryCount: 0,
                  error: "Lead declined; automation stopped.",
                }),
              },
            });
          }
        }
      });
    },
    executeWorkflowActionWithErrorRedirect: (params) => handleExecuteWorkflowActionWithErrorRedirect(params),
    findLeadForDecline: ({ leadId, workspaceId }) =>
      prisma.lead.findFirst({
        where: {
          id: leadId,
          workspaceId,
        },
        include: {
          conversation: {
            include: {
              messages: {
                where: {
                  direction: MessageDirection.OUTBOUND,
                  sentAt: null,
                },
              },
            },
          },
        },
      }),
    getActionContext,
  };

  export type ConfirmDuplicateLeadActionDependencies = {
    assertLeadActionPermission: (params: {
      workspaceId: string;
      leadId: string;
      actorUserId: string;
      membershipRole: MembershipRole;
      leadActionPermissionKey: LeadActionPermissionKey;
    }) => Promise<void>;
    confirmDuplicateLead: (input: {
      actionContext: LeadActionContext;
      canonicalLead: {
        id: string;
        fullName: string;
        propertyId: string | null;
      };
      duplicateLead: {
        id: string;
        fullName: string;
        propertyId: string | null;
        status: LeadStatus;
      };
    }) => Promise<void>;
    findCanonicalLead: (input: { leadId: string; workspaceId: string }) => Promise<{
      id: string;
      fullName: string;
      propertyId: string | null;
    } | null>;
    findDuplicateLead: (input: { leadId: string; workspaceId: string }) => Promise<{
      id: string;
      fullName: string;
      propertyId: string | null;
      status: LeadStatus;
    } | null>;
    getActionContext: (leadId: string) => Promise<LeadActionContext>;
    redirect: typeof redirect;
    redirectToWorkflowErrorPath: typeof redirectToWorkflowErrorPath;
    refreshLeadWorkflow: (leadId: string) => void;
  };

  const defaultConfirmDuplicateLeadActionDependencies: ConfirmDuplicateLeadActionDependencies = {
    assertLeadActionPermission: (params) => handleAssertLeadActionPermission(params),
    confirmDuplicateLead: async ({ actionContext, canonicalLead, duplicateLead }) => {
      const duplicateConfirmationReason = `Confirmed duplicate of ${canonicalLead.fullName}.`;
      const statusAfterConfirmation = LeadStatus.ARCHIVED;

      await prisma.$transaction(async (transactionClient) => {
        await transactionClient.lead.update({
          where: {
            id: duplicateLead.id,
          },
          data: {
            status: statusAfterConfirmation,
            lastActivityAt: new Date(),
          },
        });

        if (duplicateLead.status !== statusAfterConfirmation) {
          await transactionClient.leadStatusHistory.create({
            data: {
              leadId: duplicateLead.id,
              fromStatus: duplicateLead.status,
              toStatus: statusAfterConfirmation,
              reason: duplicateConfirmationReason,
            },
          });
        }

        await transactionClient.auditEvent.create({
          data: {
            workspaceId: actionContext.workspaceId,
            leadId: duplicateLead.id,
            propertyId: duplicateLead.propertyId,
            actorUserId: actionContext.actorUserId,
            actorType: AuditActorType.USER,
            eventType: "duplicate_confirmed",
            payload: {
              canonicalLeadId: canonicalLead.id,
              canonicalLeadName: canonicalLead.fullName,
              reason: duplicateConfirmationReason,
            },
          },
        });

        await transactionClient.auditEvent.create({
          data: {
            workspaceId: actionContext.workspaceId,
            leadId: canonicalLead.id,
            propertyId: canonicalLead.propertyId,
            actorUserId: actionContext.actorUserId,
            actorType: AuditActorType.USER,
            eventType: "duplicate_linked",
            payload: {
              duplicateLeadId: duplicateLead.id,
              duplicateLeadName: duplicateLead.fullName,
            },
          },
        });
      });
    },
    findCanonicalLead: ({ leadId, workspaceId }) =>
      prisma.lead.findFirst({
        where: {
          id: leadId,
          workspaceId,
        },
        select: {
          id: true,
          fullName: true,
          propertyId: true,
        },
      }),
    findDuplicateLead: ({ leadId, workspaceId }) =>
      prisma.lead.findFirst({
        where: {
          id: leadId,
          workspaceId,
        },
        select: {
          id: true,
          fullName: true,
          propertyId: true,
          status: true,
        },
      }),
    getActionContext,
    redirect,
    redirectToWorkflowErrorPath,
    refreshLeadWorkflow,
  };

  export type LaunchScreeningActionDependencies = {
    appendNotificationEvent: typeof appendNotificationEvent;
    assertLeadActionPermission: (params: {
      workspaceId: string;
      leadId: string;
      actorUserId: string;
      membershipRole: MembershipRole;
      leadActionPermissionKey: LeadActionPermissionKey;
    }) => Promise<void>;
    createScreeningRequest: (input: {
      actionContext: LeadActionContext;
      lead: {
        fullName: string;
        id: string;
        property: {
          name: string;
        } | null;
        propertyId: string | null;
        workspace: {
          webhookSigningSecret: string | null;
        } | null;
      };
      packageKey: string;
      packageLabel: string;
      providerReference: string | null;
      screeningConnection: {
        authState: ScreeningConnectionAuthState;
        chargeMode: ScreeningChargeMode;
        id: string;
        provider: ScreeningProvider;
      };
    }) => Promise<{ id: string }>;
    findLeadForScreeningLaunch: (input: { leadId: string; workspaceId: string }) => Promise<{
      fullName: string;
      id: string;
      property: {
        name: string;
      } | null;
      propertyId: string | null;
      screeningRequests: Array<unknown>;
      status: LeadStatus;
      workspace: {
        webhookSigningSecret: string | null;
      } | null;
    } | null>;
    findScreeningConnection: (input: { screeningConnectionId: string; workspaceId: string }) => Promise<{
      authState: ScreeningConnectionAuthState;
      chargeMode: ScreeningChargeMode;
      id: string;
      provider: ScreeningProvider;
    } | null>;
    getActionContext: (leadId: string) => Promise<LeadActionContext>;
    getCurrentWorkspaceMembership: typeof getCurrentWorkspaceMembership;
    queueOutboundWorkflowWebhook: typeof queueOutboundWorkflowWebhook;
    redirect: typeof redirect;
    redirectToWorkflowErrorPath: typeof redirectToWorkflowErrorPath;
    refreshLeadWorkflow: (leadId: string) => void;
    workspaceHasCapability: typeof workspaceHasCapability;
  };

  const defaultLaunchScreeningActionDependencies: LaunchScreeningActionDependencies = {
    appendNotificationEvent,
    assertLeadActionPermission: (params) => handleAssertLeadActionPermission(params),
    createScreeningRequest: async ({ actionContext, lead, packageKey, packageLabel, providerReference, screeningConnection }) =>
      prisma.$transaction(async (transactionClient) => {
        const screeningRequest = await transactionClient.screeningRequest.create({
          data: {
            chargeMode: screeningConnection.chargeMode,
            inviteSentAt: new Date(),
            leadId: lead.id,
            packageKey,
            packageLabel,
            propertyId: lead.propertyId,
            providerReference,
            requestedAt: new Date(),
            screeningProviderConnectionId: screeningConnection.id,
            status: ScreeningRequestStatus.INVITE_SENT,
            workspaceId: actionContext.workspaceId,
          },
        });

        await transactionClient.screeningStatusEvent.createMany({
          data: [
            {
              screeningRequestId: screeningRequest.id,
              status: ScreeningRequestStatus.REQUESTED,
              detail: `Screening requested for ${packageLabel}.`,
            },
            {
              screeningRequestId: screeningRequest.id,
              status: ScreeningRequestStatus.INVITE_SENT,
              detail: `Provider-hosted invite launched with ${packageLabel}.`,
            },
          ],
        });

        await transactionClient.auditEvent.create({
          data: {
            workspaceId: actionContext.workspaceId,
            leadId: lead.id,
            propertyId: lead.propertyId,
            actorUserId: actionContext.actorUserId,
            actorType: AuditActorType.USER,
            eventType: workflowEventTypes.screeningRequested,
            payload: {
              packageKey,
              packageLabel,
              provider: screeningConnection.provider,
              screeningRequestId: screeningRequest.id,
            },
          },
        });

        return screeningRequest;
      }),
    findLeadForScreeningLaunch: ({ leadId, workspaceId }) =>
      prisma.lead.findFirst({
        where: {
          id: leadId,
          workspaceId,
        },
        include: {
          property: {
            select: {
              name: true,
            },
          },
          workspace: {
            select: {
              webhookSigningSecret: true,
            },
          },
          screeningRequests: {
            where: {
              status: {
                notIn: [
                  ScreeningRequestStatus.REVIEWED,
                  ScreeningRequestStatus.ADVERSE_ACTION_RECORDED,
                ],
              },
            },
            take: 1,
          },
        },
      }),
    findScreeningConnection: ({ screeningConnectionId, workspaceId }) =>
      prisma.screeningProviderConnection.findFirst({
        where: {
          id: screeningConnectionId,
          workspaceId,
        },
      }),
    getActionContext,
    getCurrentWorkspaceMembership,
    queueOutboundWorkflowWebhook,
    redirect,
    redirectToWorkflowErrorPath,
    refreshLeadWorkflow,
    workspaceHasCapability,
  };

  export type UpdateScreeningRequestStatusActionDependencies = {
    appendNotificationEvent: typeof appendNotificationEvent;
    assertLeadActionPermission: (params: {
      workspaceId: string;
      leadId: string;
      actorUserId: string;
      membershipRole: MembershipRole;
      leadActionPermissionKey: LeadActionPermissionKey;
    }) => Promise<void>;
    findScreeningRequestForStatusUpdate: (input: {
      leadId: string;
      screeningRequestId: string;
      workspaceId: string;
    }) => Promise<{
      adverseActionNotes: string | null;
      chargeAmountCents: number | null;
      chargeCurrency: string | null;
      chargeReference: string | null;
      completedAt: Date | null;
      consentCompletedAt: Date | null;
      consentRecords: Array<{
        id: string;
      }>;
      id: string;
      lead: {
        fullName: string;
        workspace: {
          webhookSigningSecret: string | null;
        } | null;
      };
      leadId: string;
      propertyId: string | null;
      providerReference: string | null;
      providerReportId: string | null;
      providerReportUrl: string | null;
      reviewNotes: string | null;
      reviewedAt: Date | null;
      screeningProviderConnection: {
        provider: ScreeningProvider;
      };
      status: ScreeningRequestStatus;
    } | null>;
    getActionContext: (leadId: string) => Promise<LeadActionContext>;
    queueOutboundWorkflowWebhook: typeof queueOutboundWorkflowWebhook;
    redirect: typeof redirect;
    redirectToWorkflowErrorPath: typeof redirectToWorkflowErrorPath;
    refreshLeadWorkflow: (leadId: string) => void;
    resolveScreeningStatusTransitionGuard: typeof resolveScreeningStatusTransitionGuard;
    resolveScreeningWebhookEventType: typeof resolveScreeningWebhookEventType;
    updateScreeningRequestStatus: (input: {
      actionContext: LeadActionContext;
      adverseActionNotes: string | null;
      attachmentContentType: string | null;
      attachmentExternalId: string | null;
      attachmentLabel: string | null;
      attachmentUrl: string | null;
      chargeAmountCents: number | null;
      chargeCurrency: string | null;
      chargeReference: string | null;
      consentSource: string | null;
      detail: string | null;
      disclosureVersion: string | null;
      effectiveProviderTimestamp: Date;
      nextStatus: ScreeningRequestStatus;
      providerReference: string | null;
      providerReportId: string | null;
      providerReportUrl: string | null;
      reviewNotes: string | null;
      screeningRequest: {
        adverseActionNotes: string | null;
        chargeAmountCents: number | null;
        chargeCurrency: string | null;
        chargeReference: string | null;
        consentRecords: Array<{
          id: string;
        }>;
        id: string;
        leadId: string;
        propertyId: string | null;
        providerReference: string | null;
        providerReportId: string | null;
        providerReportUrl: string | null;
        reviewNotes: string | null;
      };
    }) => Promise<void>;
  };

  const defaultUpdateScreeningRequestStatusActionDependencies: UpdateScreeningRequestStatusActionDependencies = {
    appendNotificationEvent,
    assertLeadActionPermission: (params) => handleAssertLeadActionPermission(params),
    findScreeningRequestForStatusUpdate: ({ leadId, screeningRequestId, workspaceId }) =>
      prisma.screeningRequest.findFirst({
        where: {
          id: screeningRequestId,
          leadId,
          workspaceId,
        },
        include: {
          lead: {
            include: {
              workspace: {
                select: {
                  webhookSigningSecret: true,
                },
              },
            },
          },
          consentRecords: {
            select: {
              id: true,
            },
          },
          screeningProviderConnection: true,
        },
      }),
    getActionContext,
    queueOutboundWorkflowWebhook,
    redirect,
    redirectToWorkflowErrorPath,
    refreshLeadWorkflow,
    resolveScreeningStatusTransitionGuard,
    resolveScreeningWebhookEventType,
    updateScreeningRequestStatus: async ({
      actionContext,
      adverseActionNotes,
      attachmentContentType,
      attachmentExternalId,
      attachmentLabel,
      attachmentUrl,
      chargeAmountCents,
      chargeCurrency,
      chargeReference,
      consentSource,
      detail,
      disclosureVersion,
      effectiveProviderTimestamp,
      nextStatus,
      providerReference,
      providerReportId,
      providerReportUrl,
      reviewNotes,
      screeningRequest,
    }) => {
      await prisma.$transaction(async (transactionClient) => {
        await transactionClient.screeningRequest.update({
          where: {
            id: screeningRequest.id,
          },
          data: {
            ...buildScreeningStatusTimestampUpdate(nextStatus, effectiveProviderTimestamp),
            adverseActionNotes: adverseActionNotes ?? screeningRequest.adverseActionNotes,
            chargeAmountCents: chargeAmountCents ?? screeningRequest.chargeAmountCents,
            chargeCurrency:
              chargeCurrency ??
              screeningRequest.chargeCurrency ??
              (chargeAmountCents !== null ? "USD" : null),
            chargeReference: chargeReference ?? screeningRequest.chargeReference,
            providerReference: providerReference ?? screeningRequest.providerReference,
            providerReportId: providerReportId ?? screeningRequest.providerReportId,
            providerReportUrl: providerReportUrl ?? screeningRequest.providerReportUrl,
            providerUpdatedAt: effectiveProviderTimestamp,
            reviewNotes: reviewNotes ?? screeningRequest.reviewNotes,
            status: nextStatus,
          },
        });

        await transactionClient.screeningStatusEvent.create({
          data: {
            screeningRequestId: screeningRequest.id,
            status: nextStatus,
            detail,
            providerTimestamp: effectiveProviderTimestamp,
            payload: {
              attachmentExternalId,
              attachmentLabel,
              attachmentUrl,
              chargeAmountCents,
              chargeCurrency,
              chargeReference,
              providerReference,
              providerReportId,
              providerReportUrl,
            },
          },
        });

        if (
          nextStatus === ScreeningRequestStatus.CONSENT_COMPLETED &&
          screeningRequest.consentRecords.length === 0
        ) {
          await transactionClient.screeningConsentRecord.create({
            data: {
              screeningRequestId: screeningRequest.id,
              consentedAt: effectiveProviderTimestamp,
              disclosureVersion,
              providerReference: providerReference ?? screeningRequest.providerReference,
              source: consentSource,
            },
          });
        }

        if (attachmentLabel || attachmentUrl || attachmentExternalId) {
          await transactionClient.screeningAttachmentReference.create({
            data: {
              contentType: attachmentContentType,
              externalId: attachmentExternalId,
              label:
                attachmentLabel ??
                providerReportId ??
                providerReference ??
                "Screening report reference",
              screeningRequestId: screeningRequest.id,
              url: attachmentUrl,
            },
          });
        }

        await transactionClient.auditEvent.create({
          data: {
            workspaceId: actionContext.workspaceId,
            leadId: screeningRequest.leadId,
            propertyId: screeningRequest.propertyId,
            actorUserId: actionContext.actorUserId,
            actorType: AuditActorType.USER,
            eventType: workflowEventTypes[resolveScreeningWorkflowEventType(nextStatus)],
            payload: {
              chargeAmountCents,
              chargeCurrency,
              chargeReference,
              nextStatus,
              screeningRequestId: screeningRequest.id,
            },
          },
        });
      });
    },
  };

  export type CreateManualTourActionDependencies = {
    appendNotificationEvent: typeof appendNotificationEvent;
    assertLeadActionPermission: (params: {
      workspaceId: string;
      leadId: string;
      actorUserId: string;
      membershipRole: MembershipRole;
      leadActionPermissionKey: LeadActionPermissionKey;
    }) => Promise<void>;
    assertLeadStatusTransitionIsAllowed: typeof assertLeadStatusTransitionIsAllowed;
    assertScheduledAtWithinAvailabilityWindow: typeof assertScheduledAtWithinAvailabilityWindow;
    buildInitialTourReminderState: typeof buildInitialTourReminderState;
    createManualTour: (input: {
      actionContext: LeadActionContext;
      assignedMembershipId: string | null;
      lead: {
        fullName: string;
        id: string;
        property: {
          id: string;
          lifecycleStatus: PropertyLifecycleStatus;
          name: string;
          schedulingAvailability: Parameters<typeof parseAvailabilityWindowConfig>[0];
        } | null;
        propertyId: string | null;
        status: LeadStatus;
        tours: Array<{
          status: TourEventStatus;
        }>;
        workspace: {
          webhookSigningSecret: string | null;
        };
      };
      propertyCalendarSettings: {
        calendarTargetExternalId: string | null;
        calendarTargetProvider: string | null;
      } | null;
      reminderSequenceState: ReturnType<typeof buildInitialTourReminderState>;
      scheduledAt: Date;
      workspaceCalendarConnections: ReturnType<typeof parseCalendarConnectionsConfig>;
    }) => Promise<{
      calendarSyncState: ReturnType<typeof buildCalendarSyncState>;
      nextTour: {
        id: string;
      };
    }>;
    evaluateLeadQualification: typeof evaluateLeadQualification;
    findPropertyCalendarSettings: (input: {
      propertyId: string;
      workspaceId: string;
    }) => Promise<{
      calendarTargetExternalId: string | null;
      calendarTargetProvider: string | null;
    } | null>;
    getActionContext: (leadId: string) => Promise<LeadActionContext>;
    getCurrentWorkspaceMembership: typeof getCurrentWorkspaceMembership;
    getEligibleTourCoverageMemberships: typeof getEligibleTourCoverageMemberships;
    getLeadWorkflowContext: typeof getLeadWorkflowContext;
    parseAvailabilityWindowConfig: typeof parseAvailabilityWindowConfig;
    parseCalendarConnectionsConfig: typeof parseCalendarConnectionsConfig;
    parseTourReminderSequence: typeof parseTourReminderSequence;
    propertyAcceptsNewLeads: typeof propertyAcceptsNewLeads;
    queueOutboundWorkflowWebhook: typeof queueOutboundWorkflowWebhook;
    redirect: typeof redirect;
    redirectToWorkflowErrorPath: typeof redirectToWorkflowErrorPath;
    refreshLeadWorkflow: (leadId: string) => void;
    resolveAssignedTourMembershipId: typeof resolveAssignedTourMembershipId;
    scheduleTourReminderJobs: typeof scheduleTourReminderJobs;
    sendTourScheduledConfirmation: typeof sendTourScheduledConfirmation;
    updateTourProspectNotificationSentAt: (tourEventId: string) => Promise<unknown>;
    workspaceHasCapability: typeof workspaceHasCapability;
  };

  const defaultCreateManualTourActionDependencies: CreateManualTourActionDependencies = {
    appendNotificationEvent,
    assertLeadActionPermission: (params) => handleAssertLeadActionPermission(params),
    assertLeadStatusTransitionIsAllowed,
    assertScheduledAtWithinAvailabilityWindow,
    buildInitialTourReminderState,
    createManualTour: async ({ actionContext, assignedMembershipId, lead, propertyCalendarSettings, reminderSequenceState, scheduledAt, workspaceCalendarConnections }) => {
      const now = new Date();

      return prisma.$transaction(async (transactionClient) => {
        const createdTour = await transactionClient.tourEvent.create({
          data: {
            assignedMembershipId,
            workspaceId: actionContext.workspaceId,
            leadId: lead.id,
            propertyId: lead.propertyId,
            reminderSequenceState,
            status: TourEventStatus.SCHEDULED,
            scheduledAt,
          },
        });
        const calendarSyncState = buildCalendarSyncState({
          propertyCalendarTargetExternalId:
            propertyCalendarSettings?.calendarTargetExternalId ?? null,
          propertyCalendarTargetProvider: propertyCalendarSettings?.calendarTargetProvider ?? null,
          tourEventId: createdTour.id,
          workspaceCalendarConnections,
        });

        await transactionClient.tourEvent.update({
          where: {
            id: createdTour.id,
          },
          data: {
            calendarSyncError: calendarSyncState.calendarSyncError,
            calendarSyncProvider: calendarSyncState.calendarSyncProvider,
            calendarSyncStatus: calendarSyncState.calendarSyncStatus,
            calendarSyncedAt: calendarSyncState.calendarSyncedAt,
            externalCalendarId: calendarSyncState.externalCalendarId,
          },
        });

        if (assignedMembershipId) {
          await transactionClient.membership.update({
            where: {
              id: assignedMembershipId,
            },
            data: {
              lastTourAssignedAt: now,
            },
          });
        }

        await transactionClient.lead.update({
          where: {
            id: lead.id,
          },
          data: {
            status: LeadStatus.TOUR_SCHEDULED,
            lastActivityAt: now,
          },
        });

        await transactionClient.leadStatusHistory.create({
          data: {
            leadId: lead.id,
            fromStatus: lead.status,
            toStatus: LeadStatus.TOUR_SCHEDULED,
            reason: "Manual tour scheduled by operator.",
          },
        });

        await transactionClient.auditEvent.create({
          data: {
            workspaceId: actionContext.workspaceId,
            leadId: lead.id,
            propertyId: lead.propertyId,
            actorUserId: actionContext.actorUserId,
            actorType: AuditActorType.USER,
            eventType: workflowEventTypes.tourScheduled,
            payload: {
              assignedMembershipId,
              calendarSyncStatus: calendarSyncState.calendarSyncStatus,
              scheduledAt: scheduledAt.toISOString(),
              schedulingMethod: "manual",
              source: "operator",
            },
          },
        });

        return {
          calendarSyncState,
          nextTour: createdTour,
        };
      });
    },
    evaluateLeadQualification,
    findPropertyCalendarSettings: ({ propertyId, workspaceId }) =>
      prisma.property.findFirst({
        where: {
          id: propertyId,
          workspaceId,
        },
        select: {
          calendarTargetExternalId: true,
          calendarTargetProvider: true,
        },
      }),
    getActionContext,
    getCurrentWorkspaceMembership,
    getEligibleTourCoverageMemberships,
    getLeadWorkflowContext,
    parseAvailabilityWindowConfig,
    parseCalendarConnectionsConfig,
    parseTourReminderSequence,
    propertyAcceptsNewLeads,
    queueOutboundWorkflowWebhook,
    redirect,
    redirectToWorkflowErrorPath,
    refreshLeadWorkflow,
    resolveAssignedTourMembershipId,
    scheduleTourReminderJobs,
    sendTourScheduledConfirmation,
    updateTourProspectNotificationSentAt: (tourEventId) =>
      prisma.tourEvent.update({
        where: {
          id: tourEventId,
        },
        data: {
          prospectNotificationSentAt: new Date(),
        },
      }),
    workspaceHasCapability,
  };

  export type CancelTourActionDependencies = {
    assertLeadActionPermission: (params: {
      workspaceId: string;
      leadId: string;
      actorUserId: string;
      membershipRole: MembershipRole;
      leadActionPermissionKey: LeadActionPermissionKey;
    }) => Promise<void>;
    assertLeadStatusTransitionIsAllowed: typeof assertLeadStatusTransitionIsAllowed;
    buildCalendarSyncState: typeof buildCalendarSyncState;
    cancelTourAndRouteLead: (input: {
      actionContext: LeadActionContext;
      activeTour: {
        id: string;
      };
      calendarSyncState: ReturnType<typeof buildCalendarSyncState>;
      lead: {
        id: string;
        propertyId: string | null;
        status: LeadStatus;
      };
      notifyProspect: boolean;
      operatorCancelReason: string;
      targetStatus: LeadStatus;
    }) => Promise<void>;
    findLeadForCancelTour: (input: { leadId: string; workspaceId: string }) => Promise<{
      id: string;
      property: {
        calendarTargetExternalId: string | null;
        calendarTargetProvider: string | null;
        name: string;
      } | null;
      propertyId: string | null;
      status: LeadStatus;
      tours: Array<{
        externalCalendarId: string | null;
        id: string;
      }>;
      workspace: {
        webhookSigningSecret: string | null;
      } | null;
    } | null>;
    getActionContext: (leadId: string) => Promise<LeadActionContext>;
    getCurrentWorkspaceMembership: typeof getCurrentWorkspaceMembership;
    parseCalendarConnectionsConfig: typeof parseCalendarConnectionsConfig;
    queueOutboundWorkflowWebhook: typeof queueOutboundWorkflowWebhook;
    redirect: typeof redirect;
    redirectToWorkflowErrorPath: typeof redirectToWorkflowErrorPath;
    refreshLeadWorkflow: (leadId: string) => void;
    sendTourCanceledNotification: typeof sendTourCanceledNotification;
    updateTourProspectNotificationSentAt: (tourEventId: string) => Promise<unknown>;
  };

  const defaultCancelTourActionDependencies: CancelTourActionDependencies = {
    assertLeadActionPermission: (params) => handleAssertLeadActionPermission(params),
    assertLeadStatusTransitionIsAllowed,
    buildCalendarSyncState,
    cancelTourAndRouteLead: async ({ actionContext, activeTour, calendarSyncState, lead, notifyProspect, operatorCancelReason, targetStatus }) => {
      await prisma.$transaction(async (transactionClient) => {
        await transactionClient.tourEvent.update({
          where: {
            id: activeTour.id,
          },
          data: {
            calendarSyncError: calendarSyncState.calendarSyncError,
            calendarSyncProvider: calendarSyncState.calendarSyncProvider,
            calendarSyncStatus: calendarSyncState.calendarSyncStatus,
            calendarSyncedAt: calendarSyncState.calendarSyncedAt,
            status: "CANCELED",
            canceledAt: new Date(),
            cancelReason: operatorCancelReason,
            operatorCancelReason,
          },
        });

        await transactionClient.lead.update({
          where: {
            id: lead.id,
          },
          data: {
            status: targetStatus,
            lastActivityAt: new Date(),
          },
        });

        await transactionClient.leadStatusHistory.create({
          data: {
            leadId: lead.id,
            fromStatus: lead.status,
            toStatus: targetStatus,
            reason: "Tour canceled and rerouted.",
          },
        });

        await transactionClient.auditEvent.create({
          data: {
            workspaceId: actionContext.workspaceId,
            leadId: lead.id,
            propertyId: lead.propertyId,
            actorUserId: actionContext.actorUserId,
            actorType: AuditActorType.USER,
            eventType: workflowEventTypes.tourCanceled,
            payload: {
              tourEventId: activeTour.id,
              cancelReason: operatorCancelReason,
              notifyProspect,
              reroutedStatus: targetStatus,
            },
          },
        });
      });
    },
    findLeadForCancelTour: ({ leadId, workspaceId }) =>
      prisma.lead.findFirst({
        where: {
          id: leadId,
          workspaceId,
        },
        include: {
          property: {
            select: {
              calendarTargetExternalId: true,
              calendarTargetProvider: true,
              name: true,
            },
          },
          workspace: {
            select: {
              webhookSigningSecret: true,
            },
          },
          tours: {
            where: {
              status: "SCHEDULED",
            },
            orderBy: {
              createdAt: "desc",
            },
            take: 1,
          },
        },
      }),
    getActionContext,
    getCurrentWorkspaceMembership,
    parseCalendarConnectionsConfig,
    queueOutboundWorkflowWebhook,
    redirect,
    redirectToWorkflowErrorPath,
    refreshLeadWorkflow,
    sendTourCanceledNotification,
    updateTourProspectNotificationSentAt: (tourEventId) =>
      prisma.tourEvent.update({
        where: {
          id: tourEventId,
        },
        data: {
          prospectNotificationSentAt: new Date(),
        },
      }),
  };

  export type RescheduleTourActionDependencies = {
    assertLeadActionPermission: (params: {
      workspaceId: string;
      leadId: string;
      actorUserId: string;
      membershipRole: MembershipRole;
      leadActionPermissionKey: LeadActionPermissionKey;
    }) => Promise<void>;
    assertScheduledAtWithinAvailabilityWindow: typeof assertScheduledAtWithinAvailabilityWindow;
    buildInitialTourReminderState: typeof buildInitialTourReminderState;
    findLeadForRescheduleTour: (input: { leadId: string; workspaceId: string }) => Promise<{
      id: string;
      property: {
        calendarTargetExternalId: string | null;
        calendarTargetProvider: string | null;
        name: string;
        schedulingAvailability: Parameters<typeof parseAvailabilityWindowConfig>[0];
      } | null;
      propertyId: string | null;
      tours: Array<{
        externalCalendarId: string | null;
        id: string;
      }>;
      workspace: {
        webhookSigningSecret: string | null;
      } | null;
    } | null>;
    findPropertyAvailabilityForRescheduleTour: (input: {
      propertyId: string;
      workspaceId: string;
    }) => Promise<{
      schedulingAvailability: Parameters<typeof parseAvailabilityWindowConfig>[0];
    } | null>;
    getActionContext: (leadId: string) => Promise<LeadActionContext>;
    getCurrentWorkspaceMembership: typeof getCurrentWorkspaceMembership;
    getEligibleTourCoverageMemberships: typeof getEligibleTourCoverageMemberships;
    parseAvailabilityWindowConfig: typeof parseAvailabilityWindowConfig;
    parseCalendarConnectionsConfig: typeof parseCalendarConnectionsConfig;
    parseTourReminderSequence: typeof parseTourReminderSequence;
    queueOutboundWorkflowWebhook: typeof queueOutboundWorkflowWebhook;
    redirect: typeof redirect;
    redirectToWorkflowErrorPath: typeof redirectToWorkflowErrorPath;
    refreshLeadWorkflow: (leadId: string) => void;
    rescheduleTour: (input: {
      actionContext: LeadActionContext;
      assignedMembershipId: string | null;
      lead: {
        id: string;
        property: {
          calendarTargetExternalId: string | null;
          calendarTargetProvider: string | null;
          name: string;
          schedulingAvailability: Parameters<typeof parseAvailabilityWindowConfig>[0];
        } | null;
        propertyId: string | null;
      };
      notifyProspect: boolean;
      operatorRescheduleReason: string;
      previousTourEvent: {
        externalCalendarId: string | null;
        id: string;
      };
      reminderSequenceState: ReturnType<typeof buildInitialTourReminderState>;
      scheduledAtDate: Date;
      workspaceCalendarConnections: ReturnType<typeof parseCalendarConnectionsConfig>;
    }) => Promise<{
      calendarSyncState: ReturnType<typeof buildCalendarSyncState>;
      nextTourEvent: {
        id: string;
      };
    }>;
    resolveAssignedTourMembershipId: typeof resolveAssignedTourMembershipId;
    scheduleTourReminderJobs: typeof scheduleTourReminderJobs;
    sendTourRescheduledNotification: typeof sendTourRescheduledNotification;
    updateTourProspectNotificationSentAt: (tourEventId: string) => Promise<unknown>;
    workspaceHasCapability: typeof workspaceHasCapability;
  };

  const defaultRescheduleTourActionDependencies: RescheduleTourActionDependencies = {
    assertLeadActionPermission: (params) => handleAssertLeadActionPermission(params),
    assertScheduledAtWithinAvailabilityWindow,
    buildInitialTourReminderState,
    findLeadForRescheduleTour: ({ leadId, workspaceId }) =>
      prisma.lead.findFirst({
        where: {
          id: leadId,
          workspaceId,
        },
        include: {
          property: {
            select: {
              calendarTargetExternalId: true,
              calendarTargetProvider: true,
              name: true,
              schedulingAvailability: true,
            },
          },
          workspace: {
            select: {
              webhookSigningSecret: true,
            },
          },
          tours: {
            where: {
              status: TourEventStatus.SCHEDULED,
            },
            orderBy: {
              createdAt: "desc",
            },
            take: 1,
          },
        },
      }),
    findPropertyAvailabilityForRescheduleTour: ({ propertyId, workspaceId }) =>
      prisma.property.findFirst({
        where: {
          id: propertyId,
          workspaceId,
        },
        select: {
          schedulingAvailability: true,
        },
      }),
    getActionContext,
    getCurrentWorkspaceMembership,
    getEligibleTourCoverageMemberships,
    parseAvailabilityWindowConfig,
    parseCalendarConnectionsConfig,
    parseTourReminderSequence,
    queueOutboundWorkflowWebhook,
    redirect,
    redirectToWorkflowErrorPath,
    refreshLeadWorkflow,
    rescheduleTour: async ({
      actionContext,
      assignedMembershipId,
      lead,
      notifyProspect,
      operatorRescheduleReason,
      previousTourEvent,
      reminderSequenceState,
      scheduledAtDate,
      workspaceCalendarConnections,
    }) =>
      prisma.$transaction(async (transactionClient) => {
        await transactionClient.tourEvent.update({
          where: {
            id: previousTourEvent.id,
          },
          data: {
            operatorRescheduleReason,
            status: "RESCHEDULED",
          },
        });

        const nextTourEvent = await transactionClient.tourEvent.create({
          data: {
            assignedMembershipId,
            operatorRescheduleReason,
            workspaceId: actionContext.workspaceId,
            leadId: lead.id,
            propertyId: lead.propertyId,
            reminderSequenceState,
            status: "SCHEDULED",
            scheduledAt: scheduledAtDate,
            previousTourEventId: previousTourEvent.id,
          },
        });
        const calendarSyncState = buildCalendarSyncState({
          existingExternalCalendarId: previousTourEvent.externalCalendarId,
          propertyCalendarTargetExternalId:
            lead.property?.calendarTargetExternalId ?? null,
          propertyCalendarTargetProvider: lead.property?.calendarTargetProvider ?? null,
          tourEventId: nextTourEvent.id,
          workspaceCalendarConnections,
        });

        await transactionClient.tourEvent.update({
          where: {
            id: nextTourEvent.id,
          },
          data: {
            calendarSyncError: calendarSyncState.calendarSyncError,
            calendarSyncProvider: calendarSyncState.calendarSyncProvider,
            calendarSyncStatus: calendarSyncState.calendarSyncStatus,
            calendarSyncedAt: calendarSyncState.calendarSyncedAt,
            externalCalendarId: calendarSyncState.externalCalendarId,
          },
        });

        if (assignedMembershipId) {
          await transactionClient.membership.update({
            where: {
              id: assignedMembershipId,
            },
            data: {
              lastTourAssignedAt: new Date(),
            },
          });
        }

        await transactionClient.auditEvent.create({
          data: {
            workspaceId: actionContext.workspaceId,
            leadId: lead.id,
            propertyId: lead.propertyId,
            actorUserId: actionContext.actorUserId,
            actorType: AuditActorType.USER,
            eventType: workflowEventTypes.tourRescheduled,
            payload: {
              assignedMembershipId,
              calendarSyncStatus: calendarSyncState.calendarSyncStatus,
              notifyProspect,
              operatorRescheduleReason,
              previousTourEventId: previousTourEvent.id,
              nextTourEventId: nextTourEvent.id,
              scheduledAt: scheduledAtDate.toISOString(),
            },
          },
        });

        return {
          calendarSyncState,
          nextTourEvent,
        };
      }),
    resolveAssignedTourMembershipId,
    scheduleTourReminderJobs,
    sendTourRescheduledNotification,
    updateTourProspectNotificationSentAt: (tourEventId) =>
      prisma.tourEvent.update({
        where: {
          id: tourEventId,
        },
        data: {
          prospectNotificationSentAt: new Date(),
        },
      }),
    workspaceHasCapability,
  };

  export type OverrideLeadRoutingActionDependencies = {
    assertLeadActionPermission: (params: {
      workspaceId: string;
      leadId: string;
      actorUserId: string;
      membershipRole: MembershipRole;
      leadActionPermissionKey: LeadActionPermissionKey;
    }) => Promise<void>;
    assertLeadStatusTransitionIsAllowed: typeof assertLeadStatusTransitionIsAllowed;
    createRecomputedFitAuditEvent: (input: {
      actionContext: LeadActionContext;
      lead: {
        id: string;
        propertyId: string | null;
      };
      overrideFit: QualificationFit;
      recomputedEvaluation: ReturnType<typeof evaluateLeadQualification>;
    }) => Promise<unknown>;
    evaluateLeadQualification: typeof evaluateLeadQualification;
    findLeadForOverride: (input: { leadId: string; workspaceId: string }) => Promise<{
      fitResult: QualificationFit | null;
      id: string;
      propertyId: string | null;
      status: LeadStatus;
    } | null>;
    getActionContext: (leadId: string) => Promise<LeadActionContext>;
    getLeadWorkflowContext: typeof getLeadWorkflowContext;
    redirect: typeof redirect;
    redirectToWorkflowErrorPath: typeof redirectToWorkflowErrorPath;
    refreshLeadWorkflow: (leadId: string) => void;
    shouldRecomputeFitForTrigger: typeof shouldRecomputeFitForTrigger;
    updateLeadRoutingOverride: (input: {
      actionContext: LeadActionContext;
      lead: {
        fitResult: QualificationFit | null;
        id: string;
        propertyId: string | null;
        status: LeadStatus;
      };
      overrideFit: QualificationFit;
      overrideReason: string;
      overrideStatus: LeadStatus;
    }) => Promise<void>;
  };

  const defaultOverrideLeadRoutingActionDependencies: OverrideLeadRoutingActionDependencies = {
    assertLeadActionPermission: (params) => handleAssertLeadActionPermission(params),
    assertLeadStatusTransitionIsAllowed,
    createRecomputedFitAuditEvent: ({ actionContext, lead, overrideFit, recomputedEvaluation }) =>
      prisma.auditEvent.create({
        data: {
          workspaceId: actionContext.workspaceId,
          leadId: lead.id,
          propertyId: lead.propertyId,
          actorUserId: actionContext.actorUserId,
          actorType: AuditActorType.USER,
          eventType: workflowEventTypes.fitComputed,
          payload: {
            triggerType: "override_confirmed",
            previousFitResult: overrideFit,
            recomputedFitResult: recomputedEvaluation.fitResult,
            recommendedStatus: recomputedEvaluation.recommendedStatus,
            summary: recomputedEvaluation.summary,
          },
        },
      }),
    evaluateLeadQualification,
    findLeadForOverride: ({ leadId, workspaceId }) =>
      prisma.lead.findFirst({
        where: {
          id: leadId,
          workspaceId,
        },
        select: {
          fitResult: true,
          id: true,
          propertyId: true,
          status: true,
        },
      }),
    getActionContext,
    getLeadWorkflowContext,
    redirect,
    redirectToWorkflowErrorPath,
    refreshLeadWorkflow,
    shouldRecomputeFitForTrigger,
    updateLeadRoutingOverride: async ({ actionContext, lead, overrideFit, overrideReason, overrideStatus }) => {
      await prisma.$transaction(async (transactionClient) => {
        await transactionClient.lead.update({
          where: {
            id: lead.id,
          },
          data: {
            status: overrideStatus,
            fitResult: overrideFit,
            lastActivityAt: new Date(),
          },
        });

        if (lead.status !== overrideStatus) {
          await transactionClient.leadStatusHistory.create({
            data: {
              leadId: lead.id,
              fromStatus: lead.status,
              toStatus: overrideStatus,
              reason: `Manual override: ${overrideReason}`,
            },
          });
        }

        await transactionClient.auditEvent.create({
          data: {
            workspaceId: actionContext.workspaceId,
            leadId: lead.id,
            propertyId: lead.propertyId,
            actorUserId: actionContext.actorUserId,
            actorType: AuditActorType.USER,
            eventType: workflowEventTypes.overrideApplied,
            payload: {
              reason: overrideReason,
              previousStatus: lead.status,
              nextStatus: overrideStatus,
              previousFitResult: lead.fitResult,
              nextFitResult: overrideFit,
            },
          },
        });
      });
    },
  };

async function getActionContext(leadId: string) {
  const workspaceState = await getCurrentWorkspaceState();

  return {
    actorUserId: workspaceState.user.id,
    leadId,
    membershipRole: workspaceState.membership.role,
    workspaceId: workspaceState.workspace.id,
  };
}

function refreshLeadWorkflow(leadId: string) {
  revalidatePath("/app");
  revalidatePath("/app/calendar");
  revalidatePath("/app/inbox");
  revalidatePath("/app/leads");
  revalidatePath("/app/properties");
  revalidatePath(`/app/leads/${leadId}`);
}

function getLeadDetailPath(leadId: string) {
  return `/app/leads/${leadId}`;
}

function redirectToWorkflowErrorPath(
  redirectPath: string,
  workflowErrorCode: Parameters<typeof appendWorkflowErrorCodeToPath>[1],
) {
  redirect(appendWorkflowErrorCodeToPath(redirectPath, workflowErrorCode));
}

async function executeWorkflowActionWithErrorRedirect(params: {
  leadId: string;
  redirectPath?: string;
  executeAction: () => Promise<void>;
}) {
  const fallbackLeadDetailPath = getLeadDetailPath(params.leadId);
  const redirectPath = params.redirectPath ?? fallbackLeadDetailPath;

  try {
    await params.executeAction();
  } catch (error) {
    if (isLeadWorkflowError(error)) {
      redirectToWorkflowErrorPath(redirectPath, error.code);
    }

    throw error;
  }

  refreshLeadWorkflow(params.leadId);
  redirect(redirectPath);
}

async function assertLeadActionPermission(params: {
  workspaceId: string;
  leadId: string;
  actorUserId: string;
  membershipRole: MembershipRole;
  leadActionPermissionKey: LeadActionPermissionKey;
}) {
  const canPerformLeadAction = canMembershipRolePerformLeadAction(
    params.membershipRole,
    params.leadActionPermissionKey,
  );

  if (canPerformLeadAction) {
    return;
  }

  await prisma.auditEvent.create({
    data: {
      workspaceId: params.workspaceId,
      leadId: params.leadId,
      actorUserId: params.actorUserId,
      actorType: AuditActorType.USER,
      eventType: "lead.action_denied",
      payload: {
        membershipRole: params.membershipRole,
        permission: params.leadActionPermissionKey,
      },
    },
  });

  throw new LeadWorkflowError(
    "ACTION_FORBIDDEN_BY_ROLE",
    `Role ${params.membershipRole} cannot perform ${params.leadActionPermissionKey}.`,
  );
}

export async function handleAssertLeadActionPermission(
  params: {
    workspaceId: string;
    leadId: string;
    actorUserId: string;
    membershipRole: MembershipRole;
    leadActionPermissionKey: LeadActionPermissionKey;
  },
  dependencies: LeadActionPermissionDependencies = defaultLeadActionPermissionDependencies,
) {
  const canPerformLeadAction = dependencies.canMembershipRolePerformLeadAction(
    params.membershipRole,
    params.leadActionPermissionKey,
  );

  if (canPerformLeadAction) {
    return;
  }

  await dependencies.createAuditEvent({
    workspaceId: params.workspaceId,
    leadId: params.leadId,
    actorUserId: params.actorUserId,
    actorType: AuditActorType.USER,
    eventType: "lead.action_denied",
    payload: {
      membershipRole: params.membershipRole,
      permission: params.leadActionPermissionKey,
    },
  });

  throw new LeadWorkflowError(
    "ACTION_FORBIDDEN_BY_ROLE",
    `Role ${params.membershipRole} cannot perform ${params.leadActionPermissionKey}.`,
  );
}

export async function handleExecuteWorkflowActionWithErrorRedirect(
  params: {
    leadId: string;
    redirectPath?: string;
    executeAction: () => Promise<void>;
  },
  dependencies: WorkflowActionRedirectDependencies = defaultWorkflowActionRedirectDependencies,
) {
  const fallbackLeadDetailPath = getLeadDetailPath(params.leadId);
  const redirectPath = params.redirectPath ?? fallbackLeadDetailPath;

  try {
    await params.executeAction();
  } catch (error) {
    if (dependencies.isLeadWorkflowError(error)) {
      dependencies.redirect(
        dependencies.appendWorkflowErrorCodeToPath(redirectPath, error.code),
      );
      return;
    }

    throw error;
  }

  dependencies.refreshLeadWorkflow(params.leadId);
  dependencies.redirect(redirectPath);
}

export async function handleEvaluateLeadAction(
  leadId: string,
  formData?: FormData,
  dependencies: EvaluateLeadActionDependencies = defaultEvaluateLeadActionDependencies,
) {
  const actionContext = await dependencies.getActionContext(leadId);
  const redirectTargetValue = formData?.get("redirectTo");
  const redirectPath =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : getLeadDetailPath(leadId);

  await dependencies.executeWorkflowActionWithErrorRedirect({
    leadId,
    redirectPath,
    executeAction: async () => {
      await dependencies.assertLeadActionPermission({
        ...actionContext,
        leadActionPermissionKey: "evaluateFit",
      });
      await dependencies.applyLeadEvaluation(actionContext);
    },
  });
}

export async function evaluateLeadAction(leadId: string, formData?: FormData) {
  return handleEvaluateLeadAction(leadId, formData);
}

export async function requestInfoAction(leadId: string) {
  const actionContext = await getActionContext(leadId);

  await executeWorkflowActionWithErrorRedirect({
    leadId,
    executeAction: async () => {
      await assertLeadActionPermission({
        ...actionContext,
        leadActionPermissionKey: "requestInfo",
      });
      await performLeadWorkflowAction({
        ...actionContext,
        action: "request_info",
      });
    },
  });
}

export async function scheduleTourAction(leadId: string) {
  const actionContext = await getActionContext(leadId);

  await executeWorkflowActionWithErrorRedirect({
    leadId,
    executeAction: async () => {
      await assertLeadActionPermission({
        ...actionContext,
        leadActionPermissionKey: "scheduleTour",
      });
      await performLeadWorkflowAction({
        ...actionContext,
        action: "schedule_tour",
      });
    },
  });
}

export async function handleCreateManualTourAction(
  leadId: string,
  formData: FormData,
  dependencies: CreateManualTourActionDependencies = defaultCreateManualTourActionDependencies,
) {
  const actionContext = await dependencies.getActionContext(leadId);
  const redirectTargetValue = formData.get("redirectTo");
  const fallbackRedirectPath = getLeadDetailPath(leadId);
  const redirectPath =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : fallbackRedirectPath;

  try {
    await dependencies.assertLeadActionPermission({
      ...actionContext,
      leadActionPermissionKey: "scheduleTour",
    });

    const scheduledAt = parseScheduledAtFromFormValue(formData.get("scheduledAt"));
    const explicitAssignedMembershipId = parseAssignedMembershipIdFromFormValue(
      formData.get("assignedMembershipId"),
    );
    const notifyProspect = formData.get("notifyProspect") === "on";
    const workspaceMembership = await dependencies.getCurrentWorkspaceMembership();
    const lead = await dependencies.getLeadWorkflowContext(actionContext.workspaceId, leadId);

    if (!lead) {
      throw new LeadWorkflowError(
        "LEAD_NOT_FOUND",
        `Lead ${leadId} was not found in workspace ${actionContext.workspaceId}.`,
      );
    }

    if (!lead.propertyId || !lead.property) {
      throw new LeadWorkflowError(
        "ACTION_REQUIRES_PROPERTY",
        "A lead must be assigned to an active property before manual tour scheduling.",
      );
    }

    if (!dependencies.propertyAcceptsNewLeads(lead.property.lifecycleStatus)) {
      throw new LeadWorkflowError(
        "PROPERTY_NOT_ACTIVE",
        `Property ${lead.property.id} is not active for manual scheduling.`,
      );
    }

    const evaluation = dependencies.evaluateLeadQualification(lead);

    if (evaluation.fitResult === QualificationFit.MISMATCH) {
      throw new LeadWorkflowError(
        "ACTION_NOT_ALLOWED_FOR_MISMATCH",
        "Mismatched leads cannot be manually scheduled for tours.",
      );
    }

    if (evaluation.recommendedStatus === LeadStatus.INCOMPLETE) {
      throw new LeadWorkflowError(
        "ACTION_BLOCKED_MISSING_INFO",
        "This lead is still missing required qualification data.",
      );
    }

    if (lead.status !== LeadStatus.QUALIFIED) {
      throw new LeadWorkflowError(
        "ACTION_REQUIRES_QUALIFIED_LEAD",
        `Lead ${lead.id} must be qualified before a manual tour can be created.`,
      );
    }

    const propertyCalendarSettings = await dependencies.findPropertyCalendarSettings({
      propertyId: lead.propertyId,
      workspaceId: actionContext.workspaceId,
    });
    const eligibleTourCoverageMemberships = dependencies.workspaceHasCapability(
      workspaceMembership.workspace.enabledCapabilities,
      WorkspaceCapability.ORG_MEMBERS,
    )
      ? await dependencies.getEligibleTourCoverageMemberships(actionContext.workspaceId)
      : [];
    const assignedMembershipId = dependencies.resolveAssignedTourMembershipId({
      currentMembershipId: workspaceMembership.id,
      eligibleMemberships: eligibleTourCoverageMemberships,
      explicitAssignedMembershipId,
      workspaceSchedulingMode: workspaceMembership.workspace.tourSchedulingMode,
    });
    const reminderSequence = dependencies.parseTourReminderSequence(
      workspaceMembership.workspace.tourReminderSequence,
    );
    const reminderSequenceState = dependencies.buildInitialTourReminderState({
      reminderSequence,
      scheduledAt,
    });
    dependencies.assertScheduledAtWithinAvailabilityWindow({
      availabilityWindow: dependencies.parseAvailabilityWindowConfig(
        workspaceMembership.schedulingAvailability,
      ),
      label: "Operator",
      scheduledAt,
    });
    dependencies.assertScheduledAtWithinAvailabilityWindow({
      availabilityWindow: dependencies.parseAvailabilityWindowConfig(
        lead.property.schedulingAvailability,
      ),
      label: "Property",
      scheduledAt,
    });

    const existingScheduledTour = lead.tours.find(
      (tour) => tour.status === TourEventStatus.SCHEDULED,
    );

    if (existingScheduledTour) {
      throw new LeadWorkflowError(
        "ACTIVE_TOUR_ALREADY_EXISTS",
        `Lead ${lead.id} already has an active scheduled tour.`,
      );
    }

    dependencies.assertLeadStatusTransitionIsAllowed(lead.status, LeadStatus.TOUR_SCHEDULED);

    const { nextTour, calendarSyncState } = await dependencies.createManualTour({
      actionContext,
      assignedMembershipId,
      lead,
      propertyCalendarSettings,
      reminderSequenceState,
      scheduledAt,
      workspaceCalendarConnections: dependencies.parseCalendarConnectionsConfig(
        workspaceMembership.workspace.calendarConnections,
      ),
    });

    try {
      await dependencies.scheduleTourReminderJobs({
        leadId: lead.id,
        reminderSequence,
        scheduledAt,
        tourEventId: nextTour.id,
      });
    } catch {
      // Reminder enqueue is best-effort and should not block tour scheduling.
    }

    if (notifyProspect) {
      const prospectNotificationSent = await dependencies.sendTourScheduledConfirmation({
        leadId: lead.id,
        propertyName: lead.property.name,
        scheduledAt,
      });

      if (prospectNotificationSent) {
        await dependencies.updateTourProspectNotificationSentAt(nextTour.id);
      }
    }

    await dependencies.appendNotificationEvent({
      workspaceId: actionContext.workspaceId,
      leadId: lead.id,
      type: NotificationType.TOUR_SCHEDULED,
      title: "Manual tour scheduled",
      body: `${lead.fullName} is scheduled for ${lead.property.name} on ${scheduledAt.toLocaleString()}.`,
      payload: {
        assignedMembershipId,
        calendarSyncStatus: calendarSyncState.calendarSyncStatus,
        leadId: lead.id,
        tourEventId: nextTour.id,
        scheduledAt: scheduledAt.toISOString(),
      },
    });

    await dependencies.queueOutboundWorkflowWebhook({
      workspaceId: actionContext.workspaceId,
      leadId: lead.id,
      eventType: "tour.scheduled",
      signingSecret: lead.workspace.webhookSigningSecret,
      payload: {
        assignedMembershipId,
        calendarSyncStatus: calendarSyncState.calendarSyncStatus,
        leadId: lead.id,
        workspaceId: actionContext.workspaceId,
        scheduledAt: scheduledAt.toISOString(),
        schedulingMethod: "manual",
      },
    });
  } catch (error) {
    if (isLeadWorkflowError(error)) {
      dependencies.redirectToWorkflowErrorPath(redirectPath, error.code);
    }

    throw error;
  }

  dependencies.refreshLeadWorkflow(leadId);
  dependencies.redirect(redirectPath);
}

export async function createManualTourAction(leadId: string, formData: FormData) {
  return handleCreateManualTourAction(leadId, formData);
}

export async function sendApplicationAction(leadId: string) {
  const actionContext = await getActionContext(leadId);

  await executeWorkflowActionWithErrorRedirect({
    leadId,
    executeAction: async () => {
      await assertLeadActionPermission({
        ...actionContext,
        leadActionPermissionKey: "sendApplication",
      });
      await performLeadWorkflowAction({
        ...actionContext,
        action: "send_application",
      });
    },
  });
}

export async function handleLaunchScreeningAction(
  leadId: string,
  formData: FormData,
  dependencies: LaunchScreeningActionDependencies = defaultLaunchScreeningActionDependencies,
) {
  const actionContext = await dependencies.getActionContext(leadId);
  const redirectTargetValue = formData.get("redirectTo");
  const redirectPath =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : getLeadDetailPath(leadId);

  try {
    await dependencies.assertLeadActionPermission({
      ...actionContext,
      leadActionPermissionKey: "launchScreening",
    });

    const workspaceMembership = await dependencies.getCurrentWorkspaceMembership();

    if (
      !dependencies.workspaceHasCapability(
        workspaceMembership.workspace.enabledCapabilities,
        WorkspaceCapability.SCREENING,
      )
    ) {
      throw new LeadWorkflowError(
        "ACTION_FORBIDDEN_BY_ROLE",
        "Screening is not enabled for this workspace.",
      );
    }

    const screeningConnectionId = parseRequiredFormText(
      formData.get("screeningConnectionId"),
      "Screening connection",
    );
    const packageKey = parseRequiredFormText(formData.get("packageKey"), "Package key");
    const packageLabel = parseRequiredFormText(
      formData.get("packageLabel"),
      "Package label",
    );
    const providerReference = parseOptionalFormText(formData.get("providerReference"));

    const [lead, screeningConnection] = await Promise.all([
      dependencies.findLeadForScreeningLaunch({
        leadId,
        workspaceId: actionContext.workspaceId,
      }),
      dependencies.findScreeningConnection({
        screeningConnectionId,
        workspaceId: actionContext.workspaceId,
      }),
    ]);

    if (!lead) {
      throw new LeadWorkflowError(
        "LEAD_NOT_FOUND",
        `Lead ${leadId} was not found in workspace ${actionContext.workspaceId}.`,
      );
    }

    if (lead.status !== LeadStatus.QUALIFIED) {
      throw new LeadWorkflowError(
        "ACTION_REQUIRES_QUALIFIED_LEAD",
        "Only qualified leads can start screening.",
      );
    }

    if (lead.screeningRequests.length > 0) {
      throw new LeadWorkflowError(
        "ACTIVE_SCREENING_ALREADY_EXISTS",
        `Lead ${lead.id} already has an active screening request.`,
      );
    }

    if (!screeningConnection) {
      throw new LeadWorkflowError(
        "SCREENING_CONNECTION_REQUIRED",
        "Select a configured screening provider before launching screening.",
      );
    }

    if (screeningConnection.authState !== ScreeningConnectionAuthState.ACTIVE) {
      throw new LeadWorkflowError(
        "SCREENING_CONNECTION_INACTIVE",
        "The selected screening provider connection is not active.",
      );
    }

    const screeningRequest = await dependencies.createScreeningRequest({
      actionContext,
      lead,
      packageKey,
      packageLabel,
      providerReference,
      screeningConnection,
    });

    await dependencies.appendNotificationEvent({
      workspaceId: actionContext.workspaceId,
      leadId: lead.id,
      type: NotificationType.TOUR_SCHEDULED,
      title: "Screening launched",
      body: `${lead.fullName} started ${packageLabel} screening through ${screeningConnection.provider}.`,
      payload: {
        screeningRequestId: screeningRequest.id,
      },
    });

    await dependencies.queueOutboundWorkflowWebhook({
      workspaceId: actionContext.workspaceId,
      leadId: lead.id,
      eventType: "screening.requested",
      signingSecret: lead.workspace?.webhookSigningSecret ?? null,
      payload: {
        leadId: lead.id,
        packageKey,
        packageLabel,
        provider: screeningConnection.provider,
        screeningRequestId: screeningRequest.id,
        workspaceId: actionContext.workspaceId,
      },
    });
  } catch (error) {
    if (isLeadWorkflowError(error)) {
      dependencies.redirectToWorkflowErrorPath(redirectPath, error.code);
    }

    throw error;
  }

  dependencies.refreshLeadWorkflow(leadId);
  dependencies.redirect(redirectPath);
}

export async function launchScreeningAction(leadId: string, formData: FormData) {
  return handleLaunchScreeningAction(leadId, formData);
}

export async function handleUpdateScreeningRequestStatusAction(
  leadId: string,
  screeningRequestId: string,
  formData: FormData,
  dependencies: UpdateScreeningRequestStatusActionDependencies = defaultUpdateScreeningRequestStatusActionDependencies,
) {
  const actionContext = await dependencies.getActionContext(leadId);
  const redirectTargetValue = formData.get("redirectTo");
  const redirectPath =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : getLeadDetailPath(leadId);

  try {
    await dependencies.assertLeadActionPermission({
      ...actionContext,
      leadActionPermissionKey: "launchScreening",
    });

    const nextStatus = parseScreeningRequestStatusFromFormValue(formData.get("status"));
    const detail = parseOptionalFormText(formData.get("detail"));
    const providerReference = parseOptionalFormText(formData.get("providerReference"));
    const providerReportId = parseOptionalFormText(formData.get("providerReportId"));
    const providerReportUrl = parseOptionalFormText(formData.get("providerReportUrl"));
    const providerTimestamp = parseOptionalFormDateTime(formData.get("providerTimestamp"));
    const consentSource = parseOptionalFormText(formData.get("consentSource"));
    const disclosureVersion = parseOptionalFormText(formData.get("disclosureVersion"));
    const chargeAmountCents = parseOptionalFormCurrencyAmountToCents(
      formData.get("chargeAmount"),
    );
    const chargeCurrency = parseOptionalFormCurrencyCode(formData.get("chargeCurrency"));
    const chargeReference = parseOptionalFormText(formData.get("chargeReference"));
    const reviewNotes = parseOptionalFormText(formData.get("reviewNotes"));
    const adverseActionNotes = parseOptionalFormText(formData.get("adverseActionNotes"));
    const attachmentLabel = parseOptionalFormText(formData.get("attachmentLabel"));
    const attachmentUrl = parseOptionalFormText(formData.get("attachmentUrl"));
    const attachmentExternalId = parseOptionalFormText(formData.get("attachmentExternalId"));
    const attachmentContentType = parseOptionalFormText(formData.get("attachmentContentType"));

    const screeningRequest = await dependencies.findScreeningRequestForStatusUpdate({
      leadId,
      screeningRequestId,
      workspaceId: actionContext.workspaceId,
    });

    if (!screeningRequest) {
      throw new LeadWorkflowError(
        "LEAD_NOT_FOUND",
        `Screening request ${screeningRequestId} was not found in workspace ${actionContext.workspaceId}.`,
      );
    }

    const now = new Date();
    const effectiveProviderTimestamp = providerTimestamp ?? now;
    const transitionGuard = dependencies.resolveScreeningStatusTransitionGuard({
      completedAt: screeningRequest.completedAt,
      consentCompletedAt: screeningRequest.consentCompletedAt,
      currentStatus: screeningRequest.status,
      nextStatus,
      reviewedAt: screeningRequest.reviewedAt,
    });

    if (!transitionGuard.allowed) {
      throw new LeadWorkflowError(
        transitionGuard.reason === "consent_required"
          ? "SCREENING_CONSENT_REQUIRED"
          : "SCREENING_STATUS_TRANSITION_INVALID",
        `Screening request ${screeningRequest.id} cannot transition from ${screeningRequest.status} to ${nextStatus}.`,
      );
    }

    await dependencies.updateScreeningRequestStatus({
      actionContext,
      adverseActionNotes,
      attachmentContentType,
      attachmentExternalId,
      attachmentLabel,
      attachmentUrl,
      chargeAmountCents,
      chargeCurrency,
      chargeReference,
      consentSource,
      detail,
      disclosureVersion,
      effectiveProviderTimestamp,
      nextStatus,
      providerReference,
      providerReportId,
      providerReportUrl,
      reviewNotes,
      screeningRequest,
    });

    if (nextStatus === ScreeningRequestStatus.COMPLETED) {
      await dependencies.appendNotificationEvent({
        workspaceId: actionContext.workspaceId,
        leadId: screeningRequest.leadId,
        type: NotificationType.TOUR_SCHEDULED,
        title: "Screening completed",
        body: `${screeningRequest.lead.fullName} has a completed screening result ready for review.`,
        payload: {
          screeningRequestId: screeningRequest.id,
        },
      });

      await dependencies.queueOutboundWorkflowWebhook({
        workspaceId: actionContext.workspaceId,
        leadId: screeningRequest.leadId,
        eventType: dependencies.resolveScreeningWebhookEventType(nextStatus),
        signingSecret: screeningRequest.lead.workspace?.webhookSigningSecret ?? null,
        payload: {
          leadId: screeningRequest.leadId,
          provider: screeningRequest.screeningProviderConnection.provider,
          screeningRequestId: screeningRequest.id,
          status: nextStatus,
          workspaceId: actionContext.workspaceId,
        },
      });
    } else {
      await dependencies.queueOutboundWorkflowWebhook({
        workspaceId: actionContext.workspaceId,
        leadId: screeningRequest.leadId,
        eventType: dependencies.resolveScreeningWebhookEventType(nextStatus),
        signingSecret: screeningRequest.lead.workspace?.webhookSigningSecret ?? null,
        payload: {
          leadId: screeningRequest.leadId,
          provider: screeningRequest.screeningProviderConnection.provider,
          screeningRequestId: screeningRequest.id,
          status: nextStatus,
          workspaceId: actionContext.workspaceId,
        },
      });
    }
  } catch (error) {
    if (isLeadWorkflowError(error)) {
      dependencies.redirectToWorkflowErrorPath(redirectPath, error.code);
    }

    throw error;
  }

  dependencies.refreshLeadWorkflow(leadId);
  dependencies.redirect(redirectPath);
}

export async function updateScreeningRequestStatusAction(
  leadId: string,
  screeningRequestId: string,
  formData: FormData,
) {
  return handleUpdateScreeningRequestStatusAction(leadId, screeningRequestId, formData);
}

export async function handleAssignLeadPropertyAction(
  leadId: string,
  formData: FormData,
  dependencies: AssignLeadPropertyActionDependencies = defaultAssignLeadPropertyActionDependencies,
) {
  const actionContext = await dependencies.getActionContext(leadId);
  const propertyIdFormValue = formData.get("propertyId");
  const redirectTargetValue = formData.get("redirectTo");
  const fallbackRedirectPath = getLeadDetailPath(leadId);
  const redirectPath =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : fallbackRedirectPath;

  await dependencies.executeWorkflowActionWithErrorRedirect({
    leadId,
    redirectPath,
    executeAction: async () => {
      await dependencies.assertLeadActionPermission({
        ...actionContext,
        leadActionPermissionKey: "assignProperty",
      });

      if (
        typeof propertyIdFormValue !== "string" ||
        propertyIdFormValue.length === 0
      ) {
        throw new LeadWorkflowError(
          "PROPERTY_SELECTION_REQUIRED",
          "Property selection is required before assignment.",
        );
      }

      const matchingProperty = await dependencies.findAssignableProperty({
        propertyId: propertyIdFormValue,
        workspaceId: actionContext.workspaceId,
      });

      if (!matchingProperty) {
        const existingProperty = await dependencies.findExistingProperty({
          propertyId: propertyIdFormValue,
          workspaceId: actionContext.workspaceId,
        });

        if (
          existingProperty &&
          !dependencies.propertyAcceptsNewLeads(existingProperty.lifecycleStatus)
        ) {
          throw new LeadWorkflowError(
            "PROPERTY_NOT_ACTIVE",
            `Property ${propertyIdFormValue} is not active for new lead assignment.`,
          );
        }

        throw new LeadWorkflowError(
          "PROPERTY_NOT_FOUND",
          `Property ${propertyIdFormValue} was not found in workspace ${actionContext.workspaceId}.`,
        );
      }

      await dependencies.updateLead({
        leadId,
        propertyId: matchingProperty.id,
        lastActivityAt: new Date(),
      });

      await dependencies.createAuditEvent({
        workspaceId: actionContext.workspaceId,
        leadId,
        propertyId: matchingProperty.id,
        actorUserId: actionContext.actorUserId,
        actorType: AuditActorType.USER,
        eventType: `Lead assigned to ${matchingProperty.name}`,
        payload: {
          propertyId: matchingProperty.id,
          propertyName: matchingProperty.name,
        },
      });

      if (dependencies.shouldRecomputeFitForTrigger("property_reassigned")) {
        await dependencies.applyLeadEvaluation(actionContext);
      }
    },
  });
}

export async function assignLeadPropertyAction(leadId: string, formData: FormData) {
  return handleAssignLeadPropertyAction(leadId, formData);
}

export async function handleConfirmDuplicateLeadAction(
  leadId: string,
  formData: FormData,
  dependencies: ConfirmDuplicateLeadActionDependencies = defaultConfirmDuplicateLeadActionDependencies,
) {
  const actionContext = await dependencies.getActionContext(leadId);
  const candidateLeadIdFormValue = formData.get("candidateLeadId");
  const redirectTargetValue = formData.get("redirectTo");
  const fallbackRedirectPath = getLeadDetailPath(leadId);
  const redirectPath =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : fallbackRedirectPath;

  try {
    await dependencies.assertLeadActionPermission({
      ...actionContext,
      leadActionPermissionKey: "archiveLead",
    });

    if (
      typeof candidateLeadIdFormValue !== "string" ||
      candidateLeadIdFormValue.length === 0
    ) {
      throw new LeadWorkflowError(
        "DUPLICATE_CANDIDATE_REQUIRED",
        "Duplicate candidate id is required.",
      );
    }

    if (candidateLeadIdFormValue === leadId) {
      throw new LeadWorkflowError(
        "DUPLICATE_CANDIDATE_INVALID",
        "Lead cannot be marked as a duplicate of itself.",
      );
    }

    const [duplicateLead, canonicalLead] = await Promise.all([
      dependencies.findDuplicateLead({
        leadId,
        workspaceId: actionContext.workspaceId,
      }),
      dependencies.findCanonicalLead({
        leadId: candidateLeadIdFormValue,
        workspaceId: actionContext.workspaceId,
      }),
    ]);

    if (!duplicateLead) {
      throw new LeadWorkflowError(
        "LEAD_NOT_FOUND",
        `Lead ${leadId} was not found in workspace ${actionContext.workspaceId}.`,
      );
    }

    if (!canonicalLead) {
      throw new LeadWorkflowError(
        "DUPLICATE_CANDIDATE_NOT_FOUND",
        `Duplicate candidate ${candidateLeadIdFormValue} was not found in workspace ${actionContext.workspaceId}.`,
      );
    }

    await dependencies.confirmDuplicateLead({
      actionContext,
      canonicalLead,
      duplicateLead,
    });

  } catch (error) {
    if (isLeadWorkflowError(error)) {
      dependencies.redirectToWorkflowErrorPath(redirectPath, error.code);
    }

    throw error;
  }

  dependencies.refreshLeadWorkflow(leadId);
  dependencies.refreshLeadWorkflow(
    typeof candidateLeadIdFormValue === "string" ? candidateLeadIdFormValue : leadId,
  );
  dependencies.redirect(redirectPath);
}

export async function confirmDuplicateLeadAction(leadId: string, formData: FormData) {
  return handleConfirmDuplicateLeadAction(leadId, formData);
}

export type ArchiveLeadActionDependencies = {
  archiveLead: (input: {
    actionContext: LeadActionContext;
    archiveReason: string | null;
    lead: {
      id: string;
      propertyId: string | null;
      status: LeadStatus;
    };
  }) => Promise<void>;
  assertLeadActionPermission: (params: {
    workspaceId: string;
    leadId: string;
    actorUserId: string;
    membershipRole: MembershipRole;
    leadActionPermissionKey: LeadActionPermissionKey;
  }) => Promise<void>;
  assertLeadStatusTransitionIsAllowed: typeof assertLeadStatusTransitionIsAllowed;
  findLeadForArchive: (input: { leadId: string; workspaceId: string }) => Promise<{
    id: string;
    propertyId: string | null;
    status: LeadStatus;
  } | null>;
  getActionContext: (leadId: string) => Promise<LeadActionContext>;
  redirect: typeof redirect;
  redirectToWorkflowErrorPath: typeof redirectToWorkflowErrorPath;
  refreshLeadWorkflow: (leadId: string) => void;
};

const defaultArchiveLeadActionDependencies: ArchiveLeadActionDependencies = {
  archiveLead: async ({ actionContext, archiveReason, lead }) => {
    await prisma.$transaction(async (transactionClient) => {
      await transactionClient.lead.update({
        where: {
          id: lead.id,
        },
        data: {
          lastActivityAt: new Date(),
          status: LeadStatus.ARCHIVED,
        },
      });

      if (lead.status !== LeadStatus.ARCHIVED) {
        await transactionClient.leadStatusHistory.create({
          data: {
            leadId: lead.id,
            fromStatus: lead.status,
            toStatus: LeadStatus.ARCHIVED,
            reason: archiveReason ?? "Archived by operator.",
          },
        });
      }

      await transactionClient.auditEvent.create({
        data: {
          workspaceId: actionContext.workspaceId,
          leadId: lead.id,
          propertyId: lead.propertyId,
          actorUserId: actionContext.actorUserId,
          actorType: AuditActorType.USER,
          eventType: workflowEventTypes.archived,
          payload: {
            nextStatus: LeadStatus.ARCHIVED,
            previousStatus: lead.status,
            reason: archiveReason ?? "Archived by operator.",
          },
        },
      });
    });
  },
  assertLeadActionPermission: (params) => handleAssertLeadActionPermission(params),
  assertLeadStatusTransitionIsAllowed,
  findLeadForArchive: ({ leadId, workspaceId }) =>
    prisma.lead.findFirst({
      where: {
        id: leadId,
        workspaceId,
      },
      select: {
        id: true,
        propertyId: true,
        status: true,
      },
    }),
  getActionContext,
  redirect,
  redirectToWorkflowErrorPath,
  refreshLeadWorkflow,
};

export async function handleArchiveLeadAction(
  leadId: string,
  formData: FormData,
  dependencies: ArchiveLeadActionDependencies = defaultArchiveLeadActionDependencies,
) {
  const actionContext = await dependencies.getActionContext(leadId);
  const archiveReason = parseOptionalFormText(formData.get("archiveReason"));
  const redirectTargetValue = formData.get("redirectTo");
  const fallbackRedirectPath = getLeadDetailPath(leadId);
  const redirectPath =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : fallbackRedirectPath;

  try {
    await dependencies.assertLeadActionPermission({
      ...actionContext,
      leadActionPermissionKey: "archiveLead",
    });

    const lead = await dependencies.findLeadForArchive({
      leadId,
      workspaceId: actionContext.workspaceId,
    });

    if (!lead) {
      throw new LeadWorkflowError(
        "LEAD_NOT_FOUND",
        `Lead ${leadId} was not found in workspace ${actionContext.workspaceId}.`,
      );
    }

    dependencies.assertLeadStatusTransitionIsAllowed(lead.status, LeadStatus.ARCHIVED);

    await dependencies.archiveLead({
      actionContext,
      archiveReason,
      lead,
    });
  } catch (error) {
    if (isLeadWorkflowError(error)) {
      dependencies.redirectToWorkflowErrorPath(redirectPath, error.code);
    }

    throw error;
  }

  dependencies.refreshLeadWorkflow(leadId);
  dependencies.redirect(redirectPath);
}

export async function archiveLeadAction(leadId: string, formData: FormData) {
  return handleArchiveLeadAction(leadId, formData);
}

export type UnarchiveLeadActionDependencies = {
  assertLeadActionPermission: (params: {
    workspaceId: string;
    leadId: string;
    actorUserId: string;
    membershipRole: MembershipRole;
    leadActionPermissionKey: LeadActionPermissionKey;
  }) => Promise<void>;
  assertLeadStatusTransitionIsAllowed: typeof assertLeadStatusTransitionIsAllowed;
  getActionContext: (leadId: string) => Promise<LeadActionContext>;
  redirect: typeof redirect;
  redirectToWorkflowErrorPath: typeof redirectToWorkflowErrorPath;
  refreshLeadWorkflow: (leadId: string) => void;
  restoreLead: (input: {
    actionContext: LeadActionContext;
    lead: {
      id: string;
      propertyId: string | null;
      restoreStatus: LeadStatus | null;
      status: LeadStatus;
    };
  }) => Promise<void>;
  findLeadForUnarchive: (input: { leadId: string; workspaceId: string }) => Promise<{
    id: string;
    propertyId: string | null;
    restoreStatus: LeadStatus | null;
    status: LeadStatus;
  } | null>;
};

const defaultUnarchiveLeadActionDependencies: UnarchiveLeadActionDependencies = {
  assertLeadActionPermission: (params) => handleAssertLeadActionPermission(params),
  assertLeadStatusTransitionIsAllowed,
  getActionContext,
  redirect,
  redirectToWorkflowErrorPath,
  refreshLeadWorkflow,
  restoreLead: async ({ actionContext, lead }) => {
    const restoredStatus = resolveRestoredLeadStatus(lead.restoreStatus);

    await prisma.$transaction(async (transactionClient) => {
      await transactionClient.lead.update({
        where: {
          id: lead.id,
        },
        data: {
          lastActivityAt: new Date(),
          status: restoredStatus,
        },
      });

      await transactionClient.leadStatusHistory.create({
        data: {
          leadId: lead.id,
          fromStatus: lead.status,
          toStatus: restoredStatus,
          reason: "Restored from archive.",
        },
      });

      await transactionClient.auditEvent.create({
        data: {
          workspaceId: actionContext.workspaceId,
          leadId: lead.id,
          propertyId: lead.propertyId,
          actorUserId: actionContext.actorUserId,
          actorType: AuditActorType.USER,
          eventType: workflowEventTypes.restored,
          payload: {
            previousStatus: lead.status,
            restoredFromStatus: lead.restoreStatus,
            nextStatus: restoredStatus,
          },
        },
      });
    });
  },
  findLeadForUnarchive: ({ leadId, workspaceId }) =>
    prisma.lead.findFirst({
      where: {
        id: leadId,
        workspaceId,
      },
      select: {
        id: true,
        propertyId: true,
        status: true,
        statusHistory: {
          where: {
            toStatus: LeadStatus.ARCHIVED,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
          select: {
            fromStatus: true,
          },
        },
      },
    }).then((lead) =>
      lead
        ? {
            id: lead.id,
            propertyId: lead.propertyId,
            restoreStatus: lead.statusHistory[0]?.fromStatus ?? null,
            status: lead.status,
          }
        : null,
    ),
};

export async function handleUnarchiveLeadAction(
  leadId: string,
  formData: FormData,
  dependencies: UnarchiveLeadActionDependencies = defaultUnarchiveLeadActionDependencies,
) {
  const actionContext = await dependencies.getActionContext(leadId);
  const redirectTargetValue = formData.get("redirectTo");
  const fallbackRedirectPath = getLeadDetailPath(leadId);
  const redirectPath =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : fallbackRedirectPath;

  try {
    await dependencies.assertLeadActionPermission({
      ...actionContext,
      leadActionPermissionKey: "archiveLead",
    });

    const lead = await dependencies.findLeadForUnarchive({
      leadId,
      workspaceId: actionContext.workspaceId,
    });

    if (!lead) {
      throw new LeadWorkflowError(
        "LEAD_NOT_FOUND",
        `Lead ${leadId} was not found in workspace ${actionContext.workspaceId}.`,
      );
    }

    const restoredStatus = resolveRestoredLeadStatus(lead.restoreStatus);
    dependencies.assertLeadStatusTransitionIsAllowed(lead.status, restoredStatus);

    await dependencies.restoreLead({
      actionContext,
      lead,
    });
  } catch (error) {
    if (isLeadWorkflowError(error)) {
      dependencies.redirectToWorkflowErrorPath(redirectPath, error.code);
    }

    throw error;
  }

  dependencies.refreshLeadWorkflow(leadId);
  dependencies.redirect(redirectPath);
}

export async function unarchiveLeadAction(leadId: string, formData: FormData) {
  return handleUnarchiveLeadAction(leadId, formData);
}

function parseLeadStatusFromFormValue(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }

  return Object.values(LeadStatus).includes(value as LeadStatus)
    ? (value as LeadStatus)
    : null;
}

function parseScheduledAtFromFormValue(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new LeadWorkflowError(
      "SCHEDULED_AT_REQUIRED",
      "A scheduled date and time is required.",
    );
  }

  const scheduledAt = new Date(value);

  if (Number.isNaN(scheduledAt.getTime())) {
    throw new LeadWorkflowError(
      "SCHEDULED_AT_INVALID",
      `Scheduled date ${value} is invalid.`,
    );
  }

  return scheduledAt;
}

function parseOptionalFormText(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();

  return normalizedValue.length > 0 ? normalizedValue : null;
}

function resolveRestoredLeadStatus(previousStatus: LeadStatus | null) {
  if (
    previousStatus &&
    previousStatus !== LeadStatus.ARCHIVED &&
    previousStatus !== LeadStatus.CLOSED
  ) {
    return previousStatus;
  }

  return LeadStatus.UNDER_REVIEW;
}

function parseOptionalFormDateTime(value: FormDataEntryValue | null) {
  const normalizedValue = parseOptionalFormText(value);

  if (!normalizedValue) {
    return null;
  }

  const parsedDate = new Date(normalizedValue);

  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error(`Invalid date value: ${normalizedValue}`);
  }

  return parsedDate;
}

function parseOptionalFormCurrencyAmountToCents(value: FormDataEntryValue | null) {
  const normalizedValue = parseOptionalFormText(value);

  if (!normalizedValue) {
    return null;
  }

  const parsedAmount = Number(normalizedValue);

  if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
    throw new Error(`Invalid screening charge amount: ${normalizedValue}`);
  }

  return Math.round(parsedAmount * 100);
}

function parseOptionalFormCurrencyCode(value: FormDataEntryValue | null) {
  const normalizedValue = parseOptionalFormText(value);

  if (!normalizedValue) {
    return null;
  }

  return normalizedValue.toUpperCase();
}

function parseRequiredFormText(value: FormDataEntryValue | null, fieldLabel: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldLabel} is required.`);
  }

  return value.trim();
}

function parseAssignedMembershipIdFromFormValue(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function parseScreeningRequestStatusFromFormValue(value: FormDataEntryValue | null) {
  if (
    value === ScreeningRequestStatus.REQUESTED ||
    value === ScreeningRequestStatus.INVITE_SENT ||
    value === ScreeningRequestStatus.CONSENT_COMPLETED ||
    value === ScreeningRequestStatus.IN_PROGRESS ||
    value === ScreeningRequestStatus.COMPLETED ||
    value === ScreeningRequestStatus.REVIEWED ||
    value === ScreeningRequestStatus.ADVERSE_ACTION_RECORDED
  ) {
    return value;
  }

  throw new Error("A valid screening status is required.");
}

async function getEligibleTourCoverageMemberships(workspaceId: string) {
  const workspaceMemberships = await prisma.membership.findMany({
    where: {
      workspaceId,
    },
    include: {
      user: {
        select: {
          name: true,
        },
      },
    },
  });

  return workspaceMemberships.filter((workspaceMembership) =>
    canMembershipRolePerformLeadAction(workspaceMembership.role, "scheduleTour"),
  );
}

async function scheduleTourReminderJobs(params: {
  leadId: string;
  reminderSequence: ReturnType<typeof parseTourReminderSequence>;
  scheduledAt: Date;
  tourEventId: string;
}) {
  const reminderDelays = resolveTourReminderDelays({
    reminderSequence: params.reminderSequence,
    scheduledAt: params.scheduledAt,
  });

  await Promise.all(
    reminderDelays.map((reminderDelay) =>
      scheduleReminderSend(
        {
          leadId: params.leadId,
          reminderLabel: reminderDelay.label,
          reminderStepId: reminderDelay.id,
          scheduledFor: reminderDelay.sendAt.toISOString(),
          tourEventId: params.tourEventId,
        },
        reminderDelay.delaySeconds,
      ),
    ),
  );
}

function assertScheduledAtWithinAvailabilityWindow(params: {
  availabilityWindow: ReturnType<typeof parseAvailabilityWindowConfig>;
  label: string;
  scheduledAt: Date;
}) {
  if (!params.availabilityWindow) {
    return;
  }

  if (
    !isDateTimeWithinAvailabilityWindow({
      availabilityWindow: params.availabilityWindow,
      referenceTime: params.scheduledAt,
    })
  ) {
    throw new LeadWorkflowError(
      "SCHEDULED_AT_OUTSIDE_AVAILABILITY",
      `${params.label} availability does not include ${params.scheduledAt.toISOString()}.`,
    );
  }
}

function parseQualificationFitFromFormValue(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }

  return Object.values(QualificationFit).includes(value as QualificationFit)
    ? (value as QualificationFit)
    : null;
}

function parseDeclineReasonFromFormValue(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }

  return Object.values(DeclineReason).includes(value as DeclineReason)
    ? (value as DeclineReason)
    : null;
}

function parseMessageChannelFromFormValue(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }

  if (value === MessageChannel.EMAIL) {
    return MessageChannel.EMAIL;
  }

  if (value === MessageChannel.SMS) {
    return MessageChannel.SMS;
  }

  if (value === MessageChannel.INTERNAL_NOTE) {
    return MessageChannel.INTERNAL_NOTE;
  }

  if (value === MessageChannel.WHATSAPP) {
    return MessageChannel.WHATSAPP;
  }

  if (value === MessageChannel.INSTAGRAM) {
    return MessageChannel.INSTAGRAM;
  }

  return null;
}

function parseBooleanFormValue(value: FormDataEntryValue | null) {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return null;
}

export async function handleOverrideLeadRoutingAction(
  leadId: string,
  formData: FormData,
  dependencies: OverrideLeadRoutingActionDependencies = defaultOverrideLeadRoutingActionDependencies,
) {
  const actionContext = await dependencies.getActionContext(leadId);
  const overrideStatus = parseLeadStatusFromFormValue(formData.get("overrideStatus"));
  const overrideFit = parseQualificationFitFromFormValue(formData.get("overrideFit"));
  const overrideReason = formData.get("overrideReason");
  const redirectTargetValue = formData.get("redirectTo");
  const fallbackRedirectPath = getLeadDetailPath(leadId);
  const redirectPath =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : fallbackRedirectPath;

  try {
    await dependencies.assertLeadActionPermission({
      ...actionContext,
      leadActionPermissionKey: "overrideFit",
    });

    if (!overrideStatus) {
      throw new LeadWorkflowError(
        "OVERRIDE_STATUS_REQUIRED",
        "Override status is required.",
      );
    }

    if (!overrideFit) {
      throw new LeadWorkflowError(
        "OVERRIDE_FIT_REQUIRED",
        "Override fit result is required.",
      );
    }

    if (typeof overrideReason !== "string" || overrideReason.trim().length === 0) {
      throw new LeadWorkflowError(
        "OVERRIDE_REASON_REQUIRED",
        "Override reason is required.",
      );
    }

    const lead = await dependencies.findLeadForOverride({
      leadId,
      workspaceId: actionContext.workspaceId,
    });

    if (!lead) {
      throw new LeadWorkflowError(
        "LEAD_NOT_FOUND",
        `Lead ${leadId} was not found in workspace ${actionContext.workspaceId}.`,
      );
    }

    try {
      dependencies.assertLeadStatusTransitionIsAllowed(lead.status, overrideStatus);
    } catch {
      throw new LeadWorkflowError(
        "INVALID_STATUS_TRANSITION",
        `Lead status transition is not allowed: ${lead.status} -> ${overrideStatus}`,
      );
    }

    await dependencies.updateLeadRoutingOverride({
      actionContext,
      lead,
      overrideFit,
      overrideReason: overrideReason.trim(),
      overrideStatus,
    });

    if (dependencies.shouldRecomputeFitForTrigger("override_confirmed")) {
      const leadAfterOverride = await dependencies.getLeadWorkflowContext(
        actionContext.workspaceId,
        leadId,
      );

      if (leadAfterOverride) {
        const recomputedEvaluation = dependencies.evaluateLeadQualification(leadAfterOverride);

        await dependencies.createRecomputedFitAuditEvent({
          actionContext,
          lead: leadAfterOverride,
          overrideFit,
          recomputedEvaluation,
        });
      }
    }
  } catch (error) {
    if (isLeadWorkflowError(error)) {
      dependencies.redirectToWorkflowErrorPath(redirectPath, error.code);
    }

    throw error;
  }

  dependencies.refreshLeadWorkflow(leadId);
  dependencies.redirect(redirectPath);
}

export async function overrideLeadRoutingAction(leadId: string, formData: FormData) {
  return handleOverrideLeadRoutingAction(leadId, formData);
}

export async function handleSendManualOutboundMessageAction(
  leadId: string,
  formData: FormData,
  dependencies: SendManualOutboundMessageActionDependencies = defaultSendManualOutboundMessageActionDependencies,
) {
  const actionContext = await dependencies.getActionContext(leadId);
  const outboundMessageChannel = parseMessageChannelFromFormValue(
    formData.get("manualChannel"),
  );
  const outboundMessageSubjectValue = formData.get("manualSubject");
  const outboundMessageBodyValue = formData.get("manualBody");
  const redirectTargetValue = formData.get("redirectTo");
  const fallbackRedirectPath = getLeadDetailPath(leadId);
  const redirectPath =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : fallbackRedirectPath;

  await dependencies.executeWorkflowActionWithErrorRedirect({
    leadId,
    redirectPath,
    executeAction: async () => {
      await dependencies.assertLeadActionPermission({
        ...actionContext,
        leadActionPermissionKey: "requestInfo",
      });

      if (!outboundMessageChannel) {
        throw new LeadWorkflowError(
          "ACTION_REQUIRES_CONTACT_CHANNEL",
          "A manual outbound channel is required.",
        );
      }

      if (
        typeof outboundMessageBodyValue !== "string" ||
        outboundMessageBodyValue.trim().length === 0
      ) {
        throw new LeadWorkflowError(
          "ACTION_BLOCKED_MISSING_INFO",
          "Manual outbound body is required.",
        );
      }

      const lead = await dependencies.findLeadForManualOutbound({
        leadId,
        workspaceId: actionContext.workspaceId,
      });

      if (!lead) {
        throw new LeadWorkflowError(
          "LEAD_NOT_FOUND",
          `Lead ${leadId} was not found in workspace ${actionContext.workspaceId}.`,
        );
      }

      const resolvedContactEmailAddress = lead.contact?.email ?? lead.email;
      const resolvedContactPhoneNumber = lead.contact?.phone ?? lead.phone;

      if (outboundMessageChannel === MessageChannel.EMAIL && !resolvedContactEmailAddress) {
        throw new LeadWorkflowError(
          "ACTION_REQUIRES_CONTACT_CHANNEL",
          "Lead is missing an email address for manual outbound.",
        );
      }

      if (outboundMessageChannel === MessageChannel.SMS && !resolvedContactPhoneNumber) {
        throw new LeadWorkflowError(
          "ACTION_REQUIRES_CONTACT_CHANNEL",
          "Lead is missing a phone number for manual outbound.",
        );
      }

      if (dependencies.isLeadChannelOptedOut(lead, outboundMessageChannel)) {
        throw new LeadWorkflowError(
          "ACTION_BLOCKED_OPT_OUT",
          `Lead has opted out of ${formatMessageChannelLabel(outboundMessageChannel)} messaging.`,
        );
      }

      const normalizedSubject =
        typeof outboundMessageSubjectValue === "string" &&
        outboundMessageSubjectValue.trim().length > 0
          ? outboundMessageSubjectValue.trim()
          : null;
      const conversation =
        lead.conversation ??
        (await dependencies.createConversation({
          leadId: lead.id,
          subject: normalizedSubject,
        }));

      const isInternalNoteChannel =
        outboundMessageChannel === MessageChannel.INTERNAL_NOTE;
      const normalizedManualBody = isInternalNoteChannel
        ? dependencies.resolveInternalNoteMentions({
            noteBody: outboundMessageBodyValue.trim(),
            workspaceMembers: await dependencies.findWorkspaceMembersForInternalNotes({
              workspaceId: actionContext.workspaceId,
              actorUserId: actionContext.actorUserId,
            }),
          }).normalizedNoteBody
        : outboundMessageBodyValue.trim();
      const messageRecord = await dependencies.createMessage({
        body: normalizedManualBody,
        channel: outboundMessageChannel,
        conversationId: conversation.id,
        deliveryStatus: serializeDeliveryStatus({
          state: isInternalNoteChannel ? "sent" : "queued",
          provider: outboundMessageChannel,
          retryCount: 0,
        }),
        direction: MessageDirection.OUTBOUND,
        origin: MessageOrigin.OUTBOUND_MANUAL,
        sentAt: isInternalNoteChannel ? new Date() : null,
        subject: normalizedSubject,
      });

      if (!isInternalNoteChannel) {
        try {
          await dependencies.sendQueuedMessage(messageRecord.id, 0);
        } catch (error) {
          const deliveryErrorMessage =
            error instanceof Error ? error.message : "Manual outbound delivery failed";

          if (dependencies.isProviderConfigurationError(deliveryErrorMessage)) {
            await dependencies.markMessageProviderUnresolved({
              messageId: messageRecord.id,
              error: deliveryErrorMessage,
            });
          } else {
            await dependencies.markMessageDeliveryFailure({
              messageId: messageRecord.id,
              retryCount: 0,
              error: deliveryErrorMessage,
            });
          }
        }
      }

      await dependencies.persistManualOutboundActivity({
        actionContext,
        lead,
        messageId: messageRecord.id,
        outboundMessageChannel,
      });
    },
  });
}

export async function sendManualOutboundMessageAction(
  leadId: string,
  formData: FormData,
) {
  return handleSendManualOutboundMessageAction(leadId, formData);
}

export async function handleUpdateLeadChannelOptOutAction(
  leadId: string,
  formData: FormData,
  dependencies: UpdateLeadChannelOptOutActionDependencies = defaultUpdateLeadChannelOptOutActionDependencies,
) {
  const actionContext = await dependencies.getActionContext(leadId);
  const channel = parseMessageChannelFromFormValue(formData.get("channel"));
  const isOptedOut = parseBooleanFormValue(formData.get("isOptedOut"));
  const reasonValue = formData.get("reason");
  const redirectTargetValue = formData.get("redirectTo");
  const redirectPath =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : getLeadDetailPath(leadId);

  await dependencies.executeWorkflowActionWithErrorRedirect({
    leadId,
    redirectPath,
    executeAction: async () => {
      await dependencies.assertLeadActionPermission({
        ...actionContext,
        leadActionPermissionKey: "requestInfo",
      });

      if (
        !channel ||
        channel === MessageChannel.INTERNAL_NOTE ||
        isOptedOut === null
      ) {
        throw new LeadWorkflowError(
          "ACTION_REQUIRES_CONTACT_CHANNEL",
          "A valid contact channel is required for opt-out updates.",
        );
      }

      const lead = await dependencies.findLeadForChannelOptOut({
        leadId,
        workspaceId: actionContext.workspaceId,
      });

      if (!lead) {
        throw new LeadWorkflowError(
          "LEAD_NOT_FOUND",
          `Lead ${leadId} was not found in workspace ${actionContext.workspaceId}.`,
        );
      }

      const normalizedReason = typeof reasonValue === "string" ? reasonValue.trim() : "";
      const updateData = dependencies.buildLeadChannelOptOutUpdate({
        lead,
        channel,
        isOptedOut,
        changedAt: new Date(),
        reason: typeof reasonValue === "string" ? reasonValue : null,
      });

      await dependencies.persistLeadChannelOptOutUpdate({
        actionContext,
        channel,
        isOptedOut,
        lead,
        reason: normalizedReason.length > 0 ? normalizedReason : null,
        updateData,
      });
    },
  });
}

export async function updateLeadChannelOptOutAction(
  leadId: string,
  formData: FormData,
) {
  return handleUpdateLeadChannelOptOutAction(leadId, formData);
}

export async function declineLeadAction(leadId: string, formData: FormData) {
  return handleDeclineLeadAction(leadId, formData);
}

export async function handleDeclineLeadAction(
  leadId: string,
  formData: FormData,
  dependencies: DeclineLeadActionDependencies = defaultDeclineLeadActionDependencies,
) {
  const actionContext = await dependencies.getActionContext(leadId);
  const declineReason = parseDeclineReasonFromFormValue(formData.get("declineReason"));
  const declineNoteValue = formData.get("declineNote");
  const redirectTargetValue = formData.get("redirectTo");
  const fallbackRedirectPath = getLeadDetailPath(leadId);
  const redirectPath =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : fallbackRedirectPath;

  await dependencies.executeWorkflowActionWithErrorRedirect({
    leadId,
    redirectPath,
    executeAction: async () => {
      await dependencies.assertLeadActionPermission({
        ...actionContext,
        leadActionPermissionKey: "declineLead",
      });

      if (!declineReason) {
        throw new LeadWorkflowError(
          "DECLINE_REASON_REQUIRED",
          "Decline reason is required.",
        );
      }

      if (!Object.values(DeclineReason).includes(declineReason)) {
        throw new LeadWorkflowError(
          "DECLINE_REASON_INVALID",
          "Decline reason is invalid.",
        );
      }

      const lead = await dependencies.findLeadForDecline({
        leadId,
        workspaceId: actionContext.workspaceId,
      });

      if (!lead) {
        throw new LeadWorkflowError(
          "LEAD_NOT_FOUND",
          `Lead ${leadId} was not found in workspace ${actionContext.workspaceId}.`,
        );
      }

      try {
        dependencies.assertLeadStatusTransitionIsAllowed(lead.status, LeadStatus.DECLINED);
      } catch {
        throw new LeadWorkflowError(
          "INVALID_STATUS_TRANSITION",
          `Lead status transition is not allowed: ${lead.status} -> ${LeadStatus.DECLINED}`,
        );
      }

      await dependencies.declineLead({
        actionContext,
        declineNote: typeof declineNoteValue === "string" ? declineNoteValue : null,
        declineReason,
        lead,
      });
    },
  });
}

export async function handleCompleteTourAction(
  leadId: string,
  formData: FormData,
  dependencies: CompleteTourActionDependencies = defaultCompleteTourActionDependencies,
) {
  const actionContext = await dependencies.getActionContext(leadId);
  const redirectTargetValue = formData.get("redirectTo");
  const redirectPath =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : getLeadDetailPath(leadId);

  await dependencies.executeWorkflowActionWithErrorRedirect({
    leadId,
    redirectPath,
    executeAction: async () => {
      await dependencies.assertLeadActionPermission({
        ...actionContext,
        leadActionPermissionKey: "scheduleTour",
      });

      const lead = await dependencies.findLeadWithActiveScheduledTour({
        leadId,
        workspaceId: actionContext.workspaceId,
      });

      if (!lead) {
        throw new LeadWorkflowError("LEAD_NOT_FOUND", `Lead ${leadId} was not found.`);
      }

      const activeTour = lead.tours[0] ?? null;

      if (!activeTour) {
        throw new LeadWorkflowError(
          "ACTION_REQUIRES_QUALIFIED_LEAD",
          "No active scheduled tour exists for this lead.",
        );
      }

      await dependencies.completeTour({
        actionContext,
        activeTour,
        lead,
      });
    },
  });
}

export async function handleMarkTourNoShowAction(
  leadId: string,
  formData: FormData,
  dependencies: MarkTourNoShowActionDependencies = defaultMarkTourNoShowActionDependencies,
) {
  const actionContext = await dependencies.getActionContext(leadId);
  const redirectTargetValue = formData.get("redirectTo");
  const operatorNoShowReason =
    parseOptionalFormText(formData.get("operatorNoShowReason")) ?? "Prospect did not attend.";
  const redirectPath =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : getLeadDetailPath(leadId);

  await dependencies.executeWorkflowActionWithErrorRedirect({
    leadId,
    redirectPath,
    executeAction: async () => {
      await dependencies.assertLeadActionPermission({
        ...actionContext,
        leadActionPermissionKey: "scheduleTour",
      });

      const lead = await dependencies.findLeadWithActiveScheduledTour({
        leadId,
        workspaceId: actionContext.workspaceId,
      });

      if (!lead) {
        throw new LeadWorkflowError("LEAD_NOT_FOUND", `Lead ${leadId} was not found.`);
      }

      const activeTour = lead.tours[0] ?? null;

      if (!activeTour) {
        throw new LeadWorkflowError(
          "ACTION_REQUIRES_QUALIFIED_LEAD",
          "No active scheduled tour exists for this lead.",
        );
      }

      await dependencies.markTourNoShow({
        actionContext,
        activeTour,
        lead,
        operatorNoShowReason,
      });
    },
  });
}

export async function handleCancelTourAction(
  leadId: string,
  formData: FormData,
  dependencies: CancelTourActionDependencies = defaultCancelTourActionDependencies,
) {
  const actionContext = await dependencies.getActionContext(leadId);
  const operatorCancelReason =
    parseOptionalFormText(formData.get("operatorCancelReason")) ?? "Canceled by operator";
  const notifyProspect = formData.get("notifyProspect") === "on";
  const prospectMessage = parseOptionalFormText(formData.get("prospectMessage"));
  const routeToStatus = parseLeadStatusFromFormValue(formData.get("routeToStatus"));
  const redirectTargetValue = formData.get("redirectTo");
  const fallbackRedirectPath = getLeadDetailPath(leadId);
  const redirectPath =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : fallbackRedirectPath;

  try {
    await dependencies.assertLeadActionPermission({
      ...actionContext,
      leadActionPermissionKey: "scheduleTour",
    });

    const workspaceMembership = await dependencies.getCurrentWorkspaceMembership();

    const lead = await dependencies.findLeadForCancelTour({
      leadId,
      workspaceId: actionContext.workspaceId,
    });

    if (!lead) {
      throw new LeadWorkflowError(
        "LEAD_NOT_FOUND",
        `Lead ${leadId} was not found in workspace ${actionContext.workspaceId}.`,
      );
    }

    const activeTour = lead.tours[0] ?? null;

    if (!activeTour) {
      throw new LeadWorkflowError(
        "ACTION_REQUIRES_QUALIFIED_LEAD",
        "No active scheduled tour exists for this lead.",
      );
    }

    const fallbackRouteStatus = LeadStatus.QUALIFIED;
    const targetStatus =
      routeToStatus === LeadStatus.UNDER_REVIEW ? LeadStatus.UNDER_REVIEW : fallbackRouteStatus;

    dependencies.assertLeadStatusTransitionIsAllowed(lead.status, targetStatus);

    const calendarSyncState = dependencies.buildCalendarSyncState({
      existingExternalCalendarId: activeTour.externalCalendarId,
      propertyCalendarTargetExternalId: lead.property?.calendarTargetExternalId ?? null,
      propertyCalendarTargetProvider: lead.property?.calendarTargetProvider ?? null,
      tourEventId: activeTour.id,
      workspaceCalendarConnections: dependencies.parseCalendarConnectionsConfig(
        workspaceMembership.workspace.calendarConnections,
      ),
    });

    await dependencies.cancelTourAndRouteLead({
      actionContext,
      activeTour,
      calendarSyncState,
      lead,
      notifyProspect,
      operatorCancelReason,
      targetStatus,
    });

    if (notifyProspect && lead.property?.name) {
      const prospectNotificationSent = await dependencies.sendTourCanceledNotification({
        leadId: lead.id,
        propertyName: lead.property.name,
        prospectMessage,
      });

      if (prospectNotificationSent) {
        await dependencies.updateTourProspectNotificationSentAt(activeTour.id);
      }
    }

    await dependencies.queueOutboundWorkflowWebhook({
      workspaceId: actionContext.workspaceId,
      leadId: lead.id,
      eventType: "tour.canceled",
      signingSecret: lead.workspace?.webhookSigningSecret ?? null,
      payload: {
        leadId: lead.id,
        operatorCancelReason,
        reroutedStatus: targetStatus,
        tourEventId: activeTour.id,
        workspaceId: actionContext.workspaceId,
      },
    });
  } catch (error) {
    if (isLeadWorkflowError(error)) {
      dependencies.redirectToWorkflowErrorPath(redirectPath, error.code);
    }

    throw error;
  }

  dependencies.refreshLeadWorkflow(leadId);
  dependencies.redirect(redirectPath);
}

export async function cancelTourAction(leadId: string, formData: FormData) {
  return handleCancelTourAction(leadId, formData);
}

export async function handleRescheduleTourAction(
  leadId: string,
  formData: FormData,
  dependencies: RescheduleTourActionDependencies = defaultRescheduleTourActionDependencies,
) {
  const actionContext = await dependencies.getActionContext(leadId);
  const redirectTargetValue = formData.get("redirectTo");
  const explicitAssignedMembershipId = parseAssignedMembershipIdFromFormValue(
    formData.get("assignedMembershipId"),
  );
  const notifyProspect = formData.get("notifyProspect") === "on";
  const prospectMessage = parseOptionalFormText(formData.get("prospectMessage"));
  const operatorRescheduleReason =
    parseOptionalFormText(formData.get("operatorRescheduleReason")) ??
    "Rescheduled by operator";
  const fallbackRedirectPath = getLeadDetailPath(leadId);
  const redirectPath =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : fallbackRedirectPath;

  try {
    await dependencies.assertLeadActionPermission({
      ...actionContext,
      leadActionPermissionKey: "scheduleTour",
    });

    const scheduledAtDate = parseScheduledAtFromFormValue(formData.get("scheduledAt"));
    const workspaceMembership = await dependencies.getCurrentWorkspaceMembership();
    const reminderSequence = dependencies.parseTourReminderSequence(
      workspaceMembership.workspace.tourReminderSequence,
    );

    const lead = await dependencies.findLeadForRescheduleTour({
      leadId,
      workspaceId: actionContext.workspaceId,
    });

    if (!lead) {
      throw new LeadWorkflowError(
        "LEAD_NOT_FOUND",
        `Lead ${leadId} was not found in workspace ${actionContext.workspaceId}.`,
      );
    }

    const previousTourEvent = lead.tours[0] ?? null;

    if (!previousTourEvent) {
      throw new LeadWorkflowError(
        "ACTION_REQUIRES_QUALIFIED_LEAD",
        "No active scheduled tour exists for this lead.",
      );
    }

    dependencies.assertScheduledAtWithinAvailabilityWindow({
      availabilityWindow: dependencies.parseAvailabilityWindowConfig(
        workspaceMembership.schedulingAvailability,
      ),
      label: "Operator",
      scheduledAt: scheduledAtDate,
    });

    const propertyAvailability = lead.propertyId
      ? await dependencies.findPropertyAvailabilityForRescheduleTour({
          propertyId: lead.propertyId,
          workspaceId: actionContext.workspaceId,
        })
      : null;

    dependencies.assertScheduledAtWithinAvailabilityWindow({
      availabilityWindow: dependencies.parseAvailabilityWindowConfig(
        propertyAvailability?.schedulingAvailability ?? lead.property?.schedulingAvailability,
      ),
      label: "Property",
      scheduledAt: scheduledAtDate,
    });

    const eligibleTourCoverageMemberships = dependencies.workspaceHasCapability(
      workspaceMembership.workspace.enabledCapabilities,
      WorkspaceCapability.ORG_MEMBERS,
    )
      ? await dependencies.getEligibleTourCoverageMemberships(actionContext.workspaceId)
      : [];
    const assignedMembershipId = dependencies.resolveAssignedTourMembershipId({
      currentMembershipId: workspaceMembership.id,
      eligibleMemberships: eligibleTourCoverageMemberships,
      explicitAssignedMembershipId,
      workspaceSchedulingMode: workspaceMembership.workspace.tourSchedulingMode,
    });
    const reminderSequenceState = dependencies.buildInitialTourReminderState({
      reminderSequence,
      scheduledAt: scheduledAtDate,
    });
    const workspaceCalendarConnections = dependencies.parseCalendarConnectionsConfig(
      workspaceMembership.workspace.calendarConnections,
    );

    const { calendarSyncState, nextTourEvent } = await dependencies.rescheduleTour({
      actionContext,
      assignedMembershipId,
      lead,
      notifyProspect,
      operatorRescheduleReason,
      previousTourEvent,
      reminderSequenceState,
      scheduledAtDate,
      workspaceCalendarConnections,
    });

    try {
      await dependencies.scheduleTourReminderJobs({
        leadId: lead.id,
        reminderSequence,
        scheduledAt: scheduledAtDate,
        tourEventId: nextTourEvent.id,
      });
    } catch {
      // Reminder enqueue is best-effort and should not block tour rescheduling.
    }

    if (notifyProspect && lead.property?.name) {
      const prospectNotificationSent = await dependencies.sendTourRescheduledNotification({
        leadId: lead.id,
        propertyName: lead.property.name,
        prospectMessage,
        scheduledAt: scheduledAtDate,
      });

      if (prospectNotificationSent) {
        await dependencies.updateTourProspectNotificationSentAt(nextTourEvent.id);
      }
    }

    await dependencies.queueOutboundWorkflowWebhook({
      workspaceId: actionContext.workspaceId,
      leadId: lead.id,
      eventType: "tour.rescheduled",
      signingSecret: lead.workspace?.webhookSigningSecret ?? null,
      payload: {
        assignedMembershipId,
        calendarSyncStatus: calendarSyncState.calendarSyncStatus,
        leadId: lead.id,
        nextTourEventId: nextTourEvent.id,
        operatorRescheduleReason,
        scheduledAt: scheduledAtDate.toISOString(),
        workspaceId: actionContext.workspaceId,
      },
    });
  } catch (error) {
    if (isLeadWorkflowError(error)) {
      dependencies.redirectToWorkflowErrorPath(redirectPath, error.code);
    }

    throw error;
  }

  dependencies.refreshLeadWorkflow(leadId);
  dependencies.redirect(redirectPath);
}

export async function rescheduleTourAction(leadId: string, formData: FormData) {
  return handleRescheduleTourAction(leadId, formData);
}

export async function completeTourAction(leadId: string, formData: FormData) {
  return handleCompleteTourAction(leadId, formData);
}

export async function markTourNoShowAction(leadId: string, formData: FormData) {
  return handleMarkTourNoShowAction(leadId, formData);
}
