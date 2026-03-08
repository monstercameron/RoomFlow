import assert from "node:assert/strict";
import test from "node:test";
import { AuditActorType, CalendarSyncProvider, DeclineReason, LeadStatus, MembershipRole, MessageChannel, PropertyLifecycleStatus, QualificationFit, ScreeningChargeMode, ScreeningConnectionAuthState, ScreeningProvider, ScreeningRequestStatus, WorkspaceCapability } from "@/generated/prisma/client";
import { LeadWorkflowError } from "@/lib/lead-workflow-errors";
import type {
  AssignLeadPropertyActionDependencies,
  CancelTourActionDependencies,
  CreateManualTourActionDependencies,
  CompleteTourActionDependencies,
  ConfirmDuplicateLeadActionDependencies,
  DeclineLeadActionDependencies,
  EvaluateLeadActionDependencies,
  LaunchScreeningActionDependencies,
  LeadActionPermissionDependencies,
  MarkTourNoShowActionDependencies,
  OverrideLeadRoutingActionDependencies,
  RescheduleTourActionDependencies,
  SendManualOutboundMessageActionDependencies,
  UpdateScreeningRequestStatusActionDependencies,
  UpdateLeadChannelOptOutActionDependencies,
  WorkflowActionRedirectDependencies,
} from "@/lib/lead-actions";

function getLeadActionsModule() {
  process.env.DATABASE_URL ??=
    "postgresql://postgres:postgres@localhost:5432/template1";

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("./lead-actions") as typeof import("@/lib/lead-actions");
}

function createActionContext(overrides: Partial<{
  actorUserId: string;
  leadId: string;
  membershipRole: MembershipRole;
  workspaceId: string;
}> = {}) {
  return {
    actorUserId: "user-1",
    leadId: "lead-1",
    membershipRole: MembershipRole.MANAGER,
    workspaceId: "workspace-1",
    ...overrides,
  };
}

test("handleAssertLeadActionPermission audits and rejects forbidden actions", async () => {
  const { handleAssertLeadActionPermission } = getLeadActionsModule();
  const auditEvents: unknown[] = [];

  const dependencies: LeadActionPermissionDependencies = {
    canMembershipRolePerformLeadAction: () => false,
    createAuditEvent: async (input) => {
      auditEvents.push(input);
    },
  };

  await assert.rejects(
    handleAssertLeadActionPermission(
      {
        actorUserId: "user-1",
        leadActionPermissionKey: "assignProperty",
        leadId: "lead-1",
        membershipRole: MembershipRole.VIEWER,
        workspaceId: "workspace-1",
      },
      dependencies,
    ),
    (error: unknown) =>
      error instanceof LeadWorkflowError && error.code === "ACTION_FORBIDDEN_BY_ROLE",
  );

  assert.deepEqual(auditEvents, [
    {
      actorType: AuditActorType.USER,
      actorUserId: "user-1",
      eventType: "lead.action_denied",
      leadId: "lead-1",
      payload: {
        membershipRole: MembershipRole.VIEWER,
        permission: "assignProperty",
      },
      workspaceId: "workspace-1",
    },
  ]);
});

test("handleExecuteWorkflowActionWithErrorRedirect redirects workflow errors and refreshes successful actions", async () => {
  const { handleExecuteWorkflowActionWithErrorRedirect } = getLeadActionsModule();
  const redirects: string[] = [];
  const refreshedLeadIds: string[] = [];

  const dependencies: WorkflowActionRedirectDependencies = {
    appendWorkflowErrorCodeToPath: (path, code) => `${path}?workflowError=${code}`,
    isLeadWorkflowError: (error): error is LeadWorkflowError => error instanceof LeadWorkflowError,
    redirect: (path) => {
      redirects.push(path);
      return undefined as never;
    },
    refreshLeadWorkflow: (leadId) => {
      refreshedLeadIds.push(leadId);
    },
  };

  await handleExecuteWorkflowActionWithErrorRedirect(
    {
      executeAction: async () => undefined,
      leadId: "lead-1",
      redirectPath: "/app/leads/lead-1",
    },
    dependencies,
  );

  await handleExecuteWorkflowActionWithErrorRedirect(
    {
      executeAction: async () => {
        throw new LeadWorkflowError("PROPERTY_NOT_FOUND", "missing property");
      },
      leadId: "lead-1",
      redirectPath: "/app/leads/lead-1",
    },
    dependencies,
  );

  assert.deepEqual(refreshedLeadIds, ["lead-1"]);
  assert.deepEqual(redirects, [
    "/app/leads/lead-1",
    "/app/leads/lead-1?workflowError=PROPERTY_NOT_FOUND",
  ]);
});

test("handleEvaluateLeadAction checks permission and executes the evaluation", async () => {
  const { handleEvaluateLeadAction } = getLeadActionsModule();
  const permissionChecks: unknown[] = [];
  const evaluations: unknown[] = [];

  const dependencies: EvaluateLeadActionDependencies = {
    applyLeadEvaluation: async (params) => {
      evaluations.push(params);
    },
    assertLeadActionPermission: async (params) => {
      permissionChecks.push(params);
    },
    executeWorkflowActionWithErrorRedirect: async ({ executeAction }) => {
      await executeAction();
    },
    getActionContext: async () => createActionContext(),
  };

  const formData = new FormData();
  formData.set("redirectTo", "/app/leads/lead-1?tab=fit");

  await handleEvaluateLeadAction("lead-1", formData, dependencies);

  assert.equal(permissionChecks.length, 1);
  assert.equal(evaluations.length, 1);
});

test("handleAssignLeadPropertyAction rejects inactive properties and triggers reevaluation on success", async () => {
  const { handleAssignLeadPropertyAction } = getLeadActionsModule();

  const inactiveDependencies: AssignLeadPropertyActionDependencies = {
    applyLeadEvaluation: async () => undefined,
    assertLeadActionPermission: async () => undefined,
    createAuditEvent: async () => undefined,
    executeWorkflowActionWithErrorRedirect: async ({ executeAction }) => {
      await executeAction();
    },
    findAssignableProperty: async () => null,
    findExistingProperty: async () => ({ lifecycleStatus: PropertyLifecycleStatus.INACTIVE }),
    getActionContext: async () => createActionContext(),
    propertyAcceptsNewLeads: () => false,
    shouldRecomputeFitForTrigger: () => false,
    updateLead: async () => undefined,
  };

  const missingPropertyFormData = new FormData();
  missingPropertyFormData.set("propertyId", "property-1");

  await assert.rejects(
    handleAssignLeadPropertyAction("lead-1", missingPropertyFormData, inactiveDependencies),
    (error: unknown) =>
      error instanceof LeadWorkflowError && error.code === "PROPERTY_NOT_ACTIVE",
  );

  const updatedLeads: unknown[] = [];
  const auditEvents: unknown[] = [];
  const reevaluations: unknown[] = [];

  const successDependencies: AssignLeadPropertyActionDependencies = {
    applyLeadEvaluation: async (params) => {
      reevaluations.push(params);
    },
    assertLeadActionPermission: async () => undefined,
    createAuditEvent: async (input) => {
      auditEvents.push(input);
    },
    executeWorkflowActionWithErrorRedirect: async ({ executeAction }) => {
      await executeAction();
    },
    findAssignableProperty: async () => ({ id: "property-1", name: "Maple Court" }),
    findExistingProperty: async () => null,
    getActionContext: async () => createActionContext({ membershipRole: MembershipRole.ADMIN }),
    propertyAcceptsNewLeads: () => true,
    shouldRecomputeFitForTrigger: (trigger) => trigger === "property_reassigned",
    updateLead: async (input) => {
      updatedLeads.push(input);
    },
  };

  await handleAssignLeadPropertyAction("lead-1", missingPropertyFormData, successDependencies);

  assert.equal(updatedLeads.length, 1);
  assert.equal(auditEvents.length, 1);
  assert.equal(reevaluations.length, 1);
});

test("handleDeclineLeadAction requires a decline reason and records successful declines", async () => {
  const { handleDeclineLeadAction } = getLeadActionsModule();

  const missingReasonDependencies: DeclineLeadActionDependencies = {
    assertLeadActionPermission: async () => undefined,
    assertLeadStatusTransitionIsAllowed: () => undefined,
    declineLead: async () => undefined,
    executeWorkflowActionWithErrorRedirect: async ({ executeAction }) => {
      await executeAction();
    },
    findLeadForDecline: async () => null,
    getActionContext: async () => createActionContext(),
  };

  await assert.rejects(
    handleDeclineLeadAction("lead-1", new FormData(), missingReasonDependencies),
    (error: unknown) =>
      error instanceof LeadWorkflowError && error.code === "DECLINE_REASON_REQUIRED",
  );

  const declinedPayloads: unknown[] = [];
  const formData = new FormData();
  formData.set("declineReason", DeclineReason.UNRESPONSIVE);
  formData.set("declineNote", "Stopped replying");

  const successDependencies: DeclineLeadActionDependencies = {
    assertLeadActionPermission: async () => undefined,
    assertLeadStatusTransitionIsAllowed: () => undefined,
    declineLead: async (input) => {
      declinedPayloads.push(input);
    },
    executeWorkflowActionWithErrorRedirect: async ({ executeAction }) => {
      await executeAction();
    },
    findLeadForDecline: async () => ({
      conversation: {
        messages: [{ id: "message-1" }],
      },
      id: "lead-1",
      propertyId: "property-1",
      status: LeadStatus.QUALIFIED,
    }),
    getActionContext: async () => createActionContext({ membershipRole: MembershipRole.ADMIN }),
  };

  await handleDeclineLeadAction("lead-1", formData, successDependencies);

  assert.equal(declinedPayloads.length, 1);
  assert.equal(
    (declinedPayloads[0] as { declineReason: string }).declineReason,
    DeclineReason.UNRESPONSIVE,
  );
});

test("handleCompleteTourAction requires an active tour and records completions", async () => {
  const { handleCompleteTourAction } = getLeadActionsModule();

  const missingTourDependencies: CompleteTourActionDependencies = {
    assertLeadActionPermission: async () => undefined,
    completeTour: async () => undefined,
    executeWorkflowActionWithErrorRedirect: async ({ executeAction }) => {
      await executeAction();
    },
    findLeadWithActiveScheduledTour: async () => ({
      id: "lead-1",
      propertyId: "property-1",
      tours: [],
    }),
    getActionContext: async () => createActionContext(),
  };

  await assert.rejects(
    handleCompleteTourAction("lead-1", new FormData(), missingTourDependencies),
    (error: unknown) =>
      error instanceof LeadWorkflowError && error.code === "ACTION_REQUIRES_QUALIFIED_LEAD",
  );

  const completedPayloads: unknown[] = [];

  const successDependencies: CompleteTourActionDependencies = {
    assertLeadActionPermission: async () => undefined,
    completeTour: async (input) => {
      completedPayloads.push(input);
    },
    executeWorkflowActionWithErrorRedirect: async ({ executeAction }) => {
      await executeAction();
    },
    findLeadWithActiveScheduledTour: async () => ({
      id: "lead-1",
      propertyId: "property-1",
      tours: [{ id: "tour-1" }],
    }),
    getActionContext: async () => createActionContext({ membershipRole: MembershipRole.ADMIN }),
  };

  await handleCompleteTourAction("lead-1", new FormData(), successDependencies);

  assert.equal(completedPayloads.length, 1);
  assert.equal((completedPayloads[0] as { activeTour: { id: string } }).activeTour.id, "tour-1");
});

test("handleMarkTourNoShowAction applies the default reason and records the no-show", async () => {
  const { handleMarkTourNoShowAction } = getLeadActionsModule();
  const noShowPayloads: unknown[] = [];

  const dependencies: MarkTourNoShowActionDependencies = {
    assertLeadActionPermission: async () => undefined,
    executeWorkflowActionWithErrorRedirect: async ({ executeAction }) => {
      await executeAction();
    },
    findLeadWithActiveScheduledTour: async () => ({
      id: "lead-1",
      propertyId: "property-1",
      tours: [{ id: "tour-1" }],
    }),
    getActionContext: async () => createActionContext({ membershipRole: MembershipRole.ADMIN }),
    markTourNoShow: async (input) => {
      noShowPayloads.push(input);
    },
  };

  await handleMarkTourNoShowAction("lead-1", new FormData(), dependencies);

  assert.equal(noShowPayloads.length, 1);
  assert.equal(
    (noShowPayloads[0] as { operatorNoShowReason: string }).operatorNoShowReason,
    "Prospect did not attend.",
  );
});

test("handleSendManualOutboundMessageAction validates required manual outbound inputs", async () => {
  const { handleSendManualOutboundMessageAction } = getLeadActionsModule();

  const missingChannelDependencies: SendManualOutboundMessageActionDependencies = {
    assertLeadActionPermission: async () => undefined,
    createConversation: async () => ({ id: "conversation-1" }),
    createMessage: async () => ({ id: "message-1" }),
    executeWorkflowActionWithErrorRedirect: async ({ executeAction }) => {
      await executeAction();
    },
    findLeadForManualOutbound: async () => null,
    findWorkspaceMembersForInternalNotes: async () => [],
    getActionContext: async () => createActionContext(),
    isLeadChannelOptedOut: () => false,
    isProviderConfigurationError: () => false,
    markMessageDeliveryFailure: async () => undefined,
    markMessageProviderUnresolved: async () => undefined,
    persistManualOutboundActivity: async () => undefined,
    resolveInternalNoteMentions: ({ noteBody }) => ({
      availableMentions: [],
      mentions: [],
      normalizedNoteBody: noteBody,
    }),
    sendQueuedMessage: async () => undefined,
  };

  await assert.rejects(
    handleSendManualOutboundMessageAction("lead-1", new FormData(), missingChannelDependencies),
    (error: unknown) =>
      error instanceof LeadWorkflowError && error.code === "ACTION_REQUIRES_CONTACT_CHANNEL",
  );

  const missingBodyFormData = new FormData();
  missingBodyFormData.set("manualChannel", MessageChannel.EMAIL);

  await assert.rejects(
    handleSendManualOutboundMessageAction("lead-1", missingBodyFormData, missingChannelDependencies),
    (error: unknown) =>
      error instanceof LeadWorkflowError && error.code === "ACTION_BLOCKED_MISSING_INFO",
  );
});

test("handleSendManualOutboundMessageAction sends internal notes with mention normalization and no provider delivery", async () => {
  const { handleSendManualOutboundMessageAction } = getLeadActionsModule();
  const createdConversations: unknown[] = [];
  const createdMessages: Array<{ body: string; channel: MessageChannel; sentAt: Date | null; subject: string | null }> = [];
  const workspaceMemberLookups: unknown[] = [];
  const persistedActivities: unknown[] = [];
  let sendQueuedCalled = false;
  const formData = new FormData();
  formData.set("manualChannel", MessageChannel.INTERNAL_NOTE);
  formData.set("manualSubject", " Internal context ");
  formData.set("manualBody", "hi @jamie");
  formData.set("redirectTo", "/app/leads/lead-1?tab=notes");

  const dependencies: SendManualOutboundMessageActionDependencies = {
    assertLeadActionPermission: async () => undefined,
    createConversation: async (input) => {
      createdConversations.push(input);
      return { id: "conversation-1" };
    },
    createMessage: async (input) => {
      createdMessages.push({
        body: input.body,
        channel: input.channel,
        sentAt: input.sentAt,
        subject: input.subject,
      });
      return { id: "message-1" };
    },
    executeWorkflowActionWithErrorRedirect: async ({ executeAction }) => {
      await executeAction();
    },
    findLeadForManualOutbound: async () => ({
      contact: null,
      conversation: null,
      email: "lead@example.com",
      fullName: "Lead Prospect",
      id: "lead-1",
      propertyId: "property-1",
      phone: null,
    }),
    findWorkspaceMembersForInternalNotes: async (input) => {
      workspaceMemberLookups.push(input);
      return [
        {
          emailAddress: "jamie@example.com",
          membershipRole: MembershipRole.ADMIN,
          name: "Jamie",
          userId: "user-2",
        },
      ];
    },
    getActionContext: async () => createActionContext(),
    isLeadChannelOptedOut: () => false,
    isProviderConfigurationError: () => false,
    markMessageDeliveryFailure: async () => undefined,
    markMessageProviderUnresolved: async () => undefined,
    persistManualOutboundActivity: async (input) => {
      persistedActivities.push(input);
    },
    resolveInternalNoteMentions: ({ noteBody, workspaceMembers }) => {
      assert.equal(workspaceMembers.length, 1);
      return {
        availableMentions: [
          {
            canonicalHandle: "jamie",
            emailAddress: "jamie@example.com",
            membershipRole: MembershipRole.ADMIN,
            name: "Jamie",
            userId: "user-2",
          },
        ],
        mentions: [
          {
            canonicalHandle: "jamie",
            emailAddress: "jamie@example.com",
            matchedHandle: "jamie",
            membershipRole: MembershipRole.ADMIN,
            name: "Jamie",
            userId: "user-2",
          },
        ],
        normalizedNoteBody: `${noteBody} [resolved]`,
      };
    },
    sendQueuedMessage: async () => {
      sendQueuedCalled = true;
    },
  };

  await handleSendManualOutboundMessageAction("lead-1", formData, dependencies);

  assert.deepEqual(createdConversations, [
    {
      leadId: "lead-1",
      subject: "Internal context",
    },
  ]);
  assert.equal(createdMessages.length, 1);
  assert.equal(createdMessages[0]?.channel, MessageChannel.INTERNAL_NOTE);
  assert.equal(createdMessages[0]?.body, "hi @jamie [resolved]");
  assert.equal(createdMessages[0]?.subject, "Internal context");
  assert.ok(createdMessages[0]?.sentAt instanceof Date);
  assert.deepEqual(workspaceMemberLookups, [
    {
      actorUserId: "user-1",
      workspaceId: "workspace-1",
    },
  ]);
  assert.equal(sendQueuedCalled, false);
  assert.equal(persistedActivities.length, 1);
});

test("handleSendManualOutboundMessageAction marks unresolved providers for configuration failures", async () => {
  const { handleSendManualOutboundMessageAction } = getLeadActionsModule();
  const unresolvedPayloads: unknown[] = [];
  const failurePayloads: unknown[] = [];
  const persistedActivities: unknown[] = [];
  const formData = new FormData();
  formData.set("manualChannel", MessageChannel.EMAIL);
  formData.set("manualBody", "Follow up");

  const dependencies: SendManualOutboundMessageActionDependencies = {
    assertLeadActionPermission: async () => undefined,
    createConversation: async () => ({ id: "conversation-1" }),
    createMessage: async () => ({ id: "message-1" }),
    executeWorkflowActionWithErrorRedirect: async ({ executeAction }) => {
      await executeAction();
    },
    findLeadForManualOutbound: async () => ({
      contact: null,
      conversation: { id: "conversation-1" },
      email: "lead@example.com",
      fullName: "Lead Prospect",
      id: "lead-1",
      propertyId: "property-1",
      phone: null,
      optOutAt: null,
    }),
    findWorkspaceMembersForInternalNotes: async () => [],
    getActionContext: async () => createActionContext(),
    isLeadChannelOptedOut: () => false,
    isProviderConfigurationError: (message) => message.includes("RESEND_API_KEY"),
    markMessageDeliveryFailure: async (input) => {
      failurePayloads.push(input);
    },
    markMessageProviderUnresolved: async (input) => {
      unresolvedPayloads.push(input);
    },
    persistManualOutboundActivity: async (input) => {
      persistedActivities.push(input);
    },
    resolveInternalNoteMentions: ({ noteBody }) => ({
      availableMentions: [],
      mentions: [],
      normalizedNoteBody: noteBody,
    }),
    sendQueuedMessage: async () => {
      throw new Error("RESEND_API_KEY is not configured.");
    },
  };

  await handleSendManualOutboundMessageAction("lead-1", formData, dependencies);

  assert.deepEqual(unresolvedPayloads, [
    {
      error: "RESEND_API_KEY is not configured.",
      messageId: "message-1",
    },
  ]);
  assert.deepEqual(failurePayloads, []);
  assert.equal(persistedActivities.length, 1);
});

test("handleUpdateLeadChannelOptOutAction validates channel input and persists opt-out changes", async () => {
  const { handleUpdateLeadChannelOptOutAction } = getLeadActionsModule();

  const invalidDependencies: UpdateLeadChannelOptOutActionDependencies = {
    assertLeadActionPermission: async () => undefined,
    buildLeadChannelOptOutUpdate: () => ({
      emailOptOutAt: null,
      emailOptOutReason: null,
      instagramOptOutAt: null,
      instagramOptOutReason: null,
      optOutAt: null,
      optOutReason: null,
      smsOptOutAt: null,
      smsOptOutReason: null,
      whatsappOptOutAt: null,
      whatsappOptOutReason: null,
    }),
    executeWorkflowActionWithErrorRedirect: async ({ executeAction }) => {
      await executeAction();
    },
    findLeadForChannelOptOut: async () => null,
    getActionContext: async () => createActionContext(),
    persistLeadChannelOptOutUpdate: async () => undefined,
  };

  await assert.rejects(
    handleUpdateLeadChannelOptOutAction("lead-1", new FormData(), invalidDependencies),
    (error: unknown) =>
      error instanceof LeadWorkflowError && error.code === "ACTION_REQUIRES_CONTACT_CHANNEL",
  );

  const missingLeadFormData = new FormData();
  missingLeadFormData.set("channel", MessageChannel.EMAIL);
  missingLeadFormData.set("isOptedOut", "true");

  await assert.rejects(
    handleUpdateLeadChannelOptOutAction("lead-1", missingLeadFormData, invalidDependencies),
    (error: unknown) => error instanceof LeadWorkflowError && error.code === "LEAD_NOT_FOUND",
  );

  const persistedUpdates: unknown[] = [];
  const formData = new FormData();
  formData.set("channel", MessageChannel.SMS);
  formData.set("isOptedOut", "true");
  formData.set("reason", " Requested text stop ");
  formData.set("redirectTo", "/app/leads/lead-1?tab=contact");

  const successDependencies: UpdateLeadChannelOptOutActionDependencies = {
    assertLeadActionPermission: async () => undefined,
    buildLeadChannelOptOutUpdate: (input) => ({
      emailOptOutAt: null,
      emailOptOutReason: null,
      instagramOptOutAt: null,
      instagramOptOutReason: null,
      optOutAt: input.changedAt,
      optOutReason: "Requested text stop",
      smsOptOutAt: input.changedAt,
      smsOptOutReason: "Requested text stop",
      whatsappOptOutAt: null,
      whatsappOptOutReason: null,
    }),
    executeWorkflowActionWithErrorRedirect: async ({ executeAction }) => {
      await executeAction();
    },
    findLeadForChannelOptOut: async () => ({
      emailOptOutAt: null,
      emailOptOutReason: null,
      id: "lead-1",
      instagramOptOutAt: null,
      instagramOptOutReason: null,
      optOutAt: null,
      optOutReason: null,
      propertyId: "property-1",
      smsOptOutAt: null,
      smsOptOutReason: null,
      whatsappOptOutAt: null,
      whatsappOptOutReason: null,
    }),
    getActionContext: async () => createActionContext(),
    persistLeadChannelOptOutUpdate: async (input) => {
      persistedUpdates.push(input);
    },
  };

  await handleUpdateLeadChannelOptOutAction("lead-1", formData, successDependencies);

  assert.equal(persistedUpdates.length, 1);
  assert.equal((persistedUpdates[0] as { channel: MessageChannel }).channel, MessageChannel.SMS);
  assert.equal((persistedUpdates[0] as { isOptedOut: boolean }).isOptedOut, true);
  assert.equal((persistedUpdates[0] as { reason: string | null }).reason, "Requested text stop");
  assert.ok((persistedUpdates[0] as { updateData: { smsOptOutAt: Date | null } }).updateData.smsOptOutAt instanceof Date);
});

test("handleConfirmDuplicateLeadAction validates candidate inputs and confirms duplicates", async () => {
  const { handleConfirmDuplicateLeadAction } = getLeadActionsModule();

  const invalidDependencies: ConfirmDuplicateLeadActionDependencies = {
    assertLeadActionPermission: async () => undefined,
    confirmDuplicateLead: async () => undefined,
    findCanonicalLead: async () => null,
    findDuplicateLead: async () => null,
    getActionContext: async () => createActionContext(),
    redirect: () => undefined as never,
    redirectToWorkflowErrorPath: () => undefined as never,
    refreshLeadWorkflow: () => undefined,
  };

  await assert.rejects(
    handleConfirmDuplicateLeadAction("lead-1", new FormData(), invalidDependencies),
    (error: unknown) =>
      error instanceof LeadWorkflowError && error.code === "DUPLICATE_CANDIDATE_REQUIRED",
  );

  const selfReferenceFormData = new FormData();
  selfReferenceFormData.set("candidateLeadId", "lead-1");

  await assert.rejects(
    handleConfirmDuplicateLeadAction("lead-1", selfReferenceFormData, invalidDependencies),
    (error: unknown) =>
      error instanceof LeadWorkflowError && error.code === "DUPLICATE_CANDIDATE_INVALID",
  );

  const confirmedDuplicates: unknown[] = [];
  const refreshedLeadIds: string[] = [];
  const redirects: string[] = [];
  const successFormData = new FormData();
  successFormData.set("candidateLeadId", "lead-2");
  successFormData.set("redirectTo", "/app/leads/lead-1?tab=duplicates");

  await handleConfirmDuplicateLeadAction(
    "lead-1",
    successFormData,
    {
      assertLeadActionPermission: async () => undefined,
      confirmDuplicateLead: async (input) => {
        confirmedDuplicates.push(input);
      },
      findCanonicalLead: async () => ({
        id: "lead-2",
        fullName: "Canonical Lead",
        propertyId: "property-2",
      }),
      findDuplicateLead: async () => ({
        id: "lead-1",
        fullName: "Duplicate Lead",
        propertyId: "property-1",
        status: LeadStatus.UNDER_REVIEW,
      }),
      getActionContext: async () => createActionContext({ membershipRole: MembershipRole.ADMIN }),
      redirect: (path) => {
        redirects.push(path);
        return undefined as never;
      },
      redirectToWorkflowErrorPath: () => undefined as never,
      refreshLeadWorkflow: (leadId) => {
        refreshedLeadIds.push(leadId);
      },
    },
  );

  assert.deepEqual(confirmedDuplicates, [
    {
      actionContext: createActionContext({ membershipRole: MembershipRole.ADMIN }),
      canonicalLead: {
        id: "lead-2",
        fullName: "Canonical Lead",
        propertyId: "property-2",
      },
      duplicateLead: {
        id: "lead-1",
        fullName: "Duplicate Lead",
        propertyId: "property-1",
        status: LeadStatus.UNDER_REVIEW,
      },
    },
  ]);
  assert.deepEqual(refreshedLeadIds, ["lead-1", "lead-2"]);
  assert.deepEqual(redirects, ["/app/leads/lead-1?tab=duplicates"]);
});

test("handleOverrideLeadRoutingAction validates override inputs and audits recomputed fit", async () => {
  const { handleOverrideLeadRoutingAction } = getLeadActionsModule();

  const invalidDependencies: OverrideLeadRoutingActionDependencies = {
    assertLeadActionPermission: async () => undefined,
    assertLeadStatusTransitionIsAllowed: () => undefined,
    createRecomputedFitAuditEvent: async () => undefined,
    evaluateLeadQualification: () => ({
      fitResult: QualificationFit.PASS,
      recommendedStatus: LeadStatus.QUALIFIED,
      summary: "recomputed",
    }) as never,
    findLeadForOverride: async () => null,
    getActionContext: async () => createActionContext(),
    getLeadWorkflowContext: async () => null,
    redirect: () => undefined as never,
    redirectToWorkflowErrorPath: () => undefined as never,
    refreshLeadWorkflow: () => undefined,
    shouldRecomputeFitForTrigger: () => false,
    updateLeadRoutingOverride: async () => undefined,
  };

  await assert.rejects(
    handleOverrideLeadRoutingAction("lead-1", new FormData(), invalidDependencies),
    (error: unknown) =>
      error instanceof LeadWorkflowError && error.code === "OVERRIDE_STATUS_REQUIRED",
  );

  const missingReasonFormData = new FormData();
  missingReasonFormData.set("overrideStatus", LeadStatus.QUALIFIED);
  missingReasonFormData.set("overrideFit", QualificationFit.PASS);

  await assert.rejects(
    handleOverrideLeadRoutingAction("lead-1", missingReasonFormData, invalidDependencies),
    (error: unknown) =>
      error instanceof LeadWorkflowError && error.code === "OVERRIDE_REASON_REQUIRED",
  );

  const overrideUpdates: unknown[] = [];
  const recomputeAudits: unknown[] = [];
  const refreshedLeadIds: string[] = [];
  const redirects: string[] = [];
  const successFormData = new FormData();
  successFormData.set("overrideStatus", LeadStatus.QUALIFIED);
  successFormData.set("overrideFit", QualificationFit.PASS);
  successFormData.set("overrideReason", " Operator confirmed fit ");
  successFormData.set("redirectTo", "/app/leads/lead-1?tab=review");

  await handleOverrideLeadRoutingAction(
    "lead-1",
    successFormData,
    {
      assertLeadActionPermission: async () => undefined,
      assertLeadStatusTransitionIsAllowed: () => undefined,
      createRecomputedFitAuditEvent: async (input) => {
        recomputeAudits.push(input);
      },
      evaluateLeadQualification: () => ({
        fitResult: QualificationFit.PASS,
        recommendedStatus: LeadStatus.QUALIFIED,
        summary: "Recomputed after override",
      }) as never,
      findLeadForOverride: async () => ({
        fitResult: QualificationFit.CAUTION,
        id: "lead-1",
        propertyId: "property-1",
        status: LeadStatus.UNDER_REVIEW,
      }),
      getActionContext: async () => createActionContext({ membershipRole: MembershipRole.ADMIN }),
      getLeadWorkflowContext: async () => ({
        id: "lead-1",
        propertyId: "property-1",
      }) as never,
      redirect: (path) => {
        redirects.push(path);
        return undefined as never;
      },
      redirectToWorkflowErrorPath: () => undefined as never,
      refreshLeadWorkflow: (leadId) => {
        refreshedLeadIds.push(leadId);
      },
      shouldRecomputeFitForTrigger: (trigger) => trigger === "override_confirmed",
      updateLeadRoutingOverride: async (input) => {
        overrideUpdates.push(input);
      },
    },
  );

  assert.deepEqual(overrideUpdates, [
    {
      actionContext: createActionContext({ membershipRole: MembershipRole.ADMIN }),
      lead: {
        fitResult: QualificationFit.CAUTION,
        id: "lead-1",
        propertyId: "property-1",
        status: LeadStatus.UNDER_REVIEW,
      },
      overrideFit: QualificationFit.PASS,
      overrideReason: "Operator confirmed fit",
      overrideStatus: LeadStatus.QUALIFIED,
    },
  ]);
  assert.deepEqual(recomputeAudits, [
    {
      actionContext: createActionContext({ membershipRole: MembershipRole.ADMIN }),
      lead: {
        id: "lead-1",
        propertyId: "property-1",
      },
      overrideFit: QualificationFit.PASS,
      recomputedEvaluation: {
        fitResult: QualificationFit.PASS,
        recommendedStatus: LeadStatus.QUALIFIED,
        summary: "Recomputed after override",
      },
    },
  ]);
  assert.deepEqual(refreshedLeadIds, ["lead-1"]);
  assert.deepEqual(redirects, ["/app/leads/lead-1?tab=review"]);
});

test("handleLaunchScreeningAction enforces workspace capability and screening prerequisites", async () => {
  const { handleLaunchScreeningAction } = getLeadActionsModule();
  const baseFormData = new FormData();
  baseFormData.set("screeningConnectionId", "connection-1");
  baseFormData.set("packageKey", "basic");
  baseFormData.set("packageLabel", "Basic package");

  const baseDependencies: LaunchScreeningActionDependencies = {
    appendNotificationEvent: async () => undefined,
    assertLeadActionPermission: async () => undefined,
    createScreeningRequest: async () => ({ id: "screening-1" }),
    findLeadForScreeningLaunch: async () => ({
      fullName: "Lead Prospect",
      id: "lead-1",
      property: { name: "Maple Court" },
      propertyId: "property-1",
      screeningRequests: [],
      status: LeadStatus.QUALIFIED,
      workspace: { webhookSigningSecret: "secret" },
    }),
    findScreeningConnection: async () => ({
      authState: ScreeningConnectionAuthState.ACTIVE,
      chargeMode: ScreeningChargeMode.APPLICANT_PAY,
      id: "connection-1",
      provider: ScreeningProvider.CHECKR,
    }),
    getActionContext: async () => createActionContext(),
    getCurrentWorkspaceMembership: async () => ({
      workspace: {
        enabledCapabilities: [],
      },
    }) as never,
    queueOutboundWorkflowWebhook: async () => undefined,
    redirect: () => undefined as never,
    redirectToWorkflowErrorPath: () => undefined as never,
    refreshLeadWorkflow: () => undefined,
    workspaceHasCapability: () => false,
  };

  await assert.rejects(
    handleLaunchScreeningAction("lead-1", baseFormData, baseDependencies),
    (error: unknown) =>
      error instanceof LeadWorkflowError && error.code === "ACTION_FORBIDDEN_BY_ROLE",
  );

  await assert.rejects(
    handleLaunchScreeningAction(
      "lead-1",
      baseFormData,
      {
        ...baseDependencies,
        getCurrentWorkspaceMembership: async () => ({
          workspace: {
            enabledCapabilities: [WorkspaceCapability.SCREENING],
          },
        }) as never,
        workspaceHasCapability: () => true,
        findLeadForScreeningLaunch: async () => ({
          fullName: "Lead Prospect",
          id: "lead-1",
          property: { name: "Maple Court" },
          propertyId: "property-1",
          screeningRequests: [{}],
          status: LeadStatus.QUALIFIED,
          workspace: { webhookSigningSecret: "secret" },
        }),
      },
    ),
    (error: unknown) =>
      error instanceof LeadWorkflowError && error.code === "ACTIVE_SCREENING_ALREADY_EXISTS",
  );
});

test("handleLaunchScreeningAction persists screening launch side effects and redirects", async () => {
  const { handleLaunchScreeningAction } = getLeadActionsModule();
  const createdRequests: unknown[] = [];
  const notifications: unknown[] = [];
  const outboundWebhooks: unknown[] = [];
  const refreshedLeadIds: string[] = [];
  const redirects: string[] = [];
  const formData = new FormData();
  formData.set("screeningConnectionId", "connection-1");
  formData.set("packageKey", "basic");
  formData.set("packageLabel", "Basic package");
  formData.set("providerReference", " checkr-ref ");
  formData.set("redirectTo", "/app/leads/lead-1?tab=screening");

  await handleLaunchScreeningAction(
    "lead-1",
    formData,
    {
      appendNotificationEvent: async (input) => {
        notifications.push(input);
      },
      assertLeadActionPermission: async () => undefined,
      createScreeningRequest: async (input) => {
        createdRequests.push(input);
        return { id: "screening-1" };
      },
      findLeadForScreeningLaunch: async () => ({
        fullName: "Lead Prospect",
        id: "lead-1",
        property: { name: "Maple Court" },
        propertyId: "property-1",
        screeningRequests: [],
        status: LeadStatus.QUALIFIED,
        workspace: { webhookSigningSecret: "secret" },
      }),
      findScreeningConnection: async () => ({
        authState: ScreeningConnectionAuthState.ACTIVE,
        chargeMode: ScreeningChargeMode.APPLICANT_PAY,
        id: "connection-1",
        provider: ScreeningProvider.CHECKR,
      }),
      getActionContext: async () => createActionContext({ membershipRole: MembershipRole.ADMIN }),
      getCurrentWorkspaceMembership: async () => ({
        workspace: {
          enabledCapabilities: [WorkspaceCapability.SCREENING],
        },
      }) as never,
      queueOutboundWorkflowWebhook: async (input) => {
        outboundWebhooks.push(input);
      },
      redirect: (path) => {
        redirects.push(path);
        return undefined as never;
      },
      redirectToWorkflowErrorPath: () => undefined as never,
      refreshLeadWorkflow: (leadId) => {
        refreshedLeadIds.push(leadId);
      },
      workspaceHasCapability: () => true,
    },
  );

  assert.deepEqual(createdRequests, [
    {
      actionContext: createActionContext({ membershipRole: MembershipRole.ADMIN }),
      lead: {
        fullName: "Lead Prospect",
        id: "lead-1",
        property: { name: "Maple Court" },
        propertyId: "property-1",
        screeningRequests: [],
        status: LeadStatus.QUALIFIED,
        workspace: { webhookSigningSecret: "secret" },
      },
      packageKey: "basic",
      packageLabel: "Basic package",
      providerReference: "checkr-ref",
      screeningConnection: {
        authState: ScreeningConnectionAuthState.ACTIVE,
        chargeMode: ScreeningChargeMode.APPLICANT_PAY,
        id: "connection-1",
        provider: ScreeningProvider.CHECKR,
      },
    },
  ]);
  assert.deepEqual(notifications, [
    {
      workspaceId: "workspace-1",
      leadId: "lead-1",
      type: "TOUR_SCHEDULED",
      title: "Screening launched",
      body: "Lead Prospect started Basic package screening through CHECKR.",
      payload: {
        screeningRequestId: "screening-1",
      },
    },
  ]);
  assert.deepEqual(outboundWebhooks, [
    {
      workspaceId: "workspace-1",
      leadId: "lead-1",
      eventType: "screening.requested",
      signingSecret: "secret",
      payload: {
        leadId: "lead-1",
        packageKey: "basic",
        packageLabel: "Basic package",
        provider: ScreeningProvider.CHECKR,
        screeningRequestId: "screening-1",
        workspaceId: "workspace-1",
      },
    },
  ]);
  assert.deepEqual(refreshedLeadIds, ["lead-1"]);
  assert.deepEqual(redirects, ["/app/leads/lead-1?tab=screening"]);
});

test("handleCreateManualTourAction blocks duplicate active tours and persists successful schedules", async () => {
  const { handleCreateManualTourAction } = getLeadActionsModule();

  const blockedFormData = new FormData();
  blockedFormData.set("scheduledAt", "2026-03-08T19:30:00.000Z");

  const blockedDependencies: CreateManualTourActionDependencies = {
    appendNotificationEvent: async () => undefined,
    assertLeadActionPermission: async () => undefined,
    assertLeadStatusTransitionIsAllowed: () => undefined,
    assertScheduledAtWithinAvailabilityWindow: () => undefined,
    buildInitialTourReminderState: () => ({ sequence: [] }) as never,
    createManualTour: async () => ({
      calendarSyncState: {
        calendarSyncError: null,
        calendarSyncProvider: CalendarSyncProvider.GOOGLE,
        calendarSyncStatus: "PENDING",
        calendarSyncedAt: null,
        externalCalendarId: null,
      },
      nextTour: { id: "tour-2" },
    }) as never,
    evaluateLeadQualification: () => ({
      fitResult: QualificationFit.PASS,
      recommendedStatus: LeadStatus.QUALIFIED,
    }) as never,
    findPropertyCalendarSettings: async () => ({
      calendarTargetExternalId: "calendar-1",
      calendarTargetProvider: CalendarSyncProvider.GOOGLE,
    }),
    getActionContext: async () => createActionContext(),
    getCurrentWorkspaceMembership: async () => ({
      id: "membership-1",
      schedulingAvailability: { timezone: "UTC" },
      workspace: {
        calendarConnections: null,
        enabledCapabilities: [],
        tourReminderSequence: null,
        tourSchedulingMode: "ROUND_ROBIN",
      },
    }) as never,
    getEligibleTourCoverageMemberships: async () => [],
    getLeadWorkflowContext: async () => ({
      fullName: "Casey Client",
      id: "lead-1",
      property: {
        id: "property-1",
        lifecycleStatus: PropertyLifecycleStatus.ACTIVE,
        name: "Maple Court",
        schedulingAvailability: { timezone: "UTC" },
      },
      propertyId: "property-1",
      status: LeadStatus.QUALIFIED,
      tours: [{ status: "SCHEDULED" }],
      workspace: { webhookSigningSecret: "secret" },
    }) as never,
    parseAvailabilityWindowConfig: (value) => value as never,
    parseCalendarConnectionsConfig: (value) => value as never,
    parseTourReminderSequence: () => [] as never,
    propertyAcceptsNewLeads: (
      propertyLifecycleStatus,
    ): propertyLifecycleStatus is "ACTIVE" => true,
    queueOutboundWorkflowWebhook: async () => undefined,
    redirect: () => undefined as never,
    redirectToWorkflowErrorPath: () => undefined as never,
    refreshLeadWorkflow: () => undefined,
    resolveAssignedTourMembershipId: () => "membership-1",
    scheduleTourReminderJobs: async () => undefined,
    sendTourScheduledConfirmation: async () => false,
    updateTourProspectNotificationSentAt: async () => undefined,
    workspaceHasCapability: () => false,
  };

  await assert.rejects(
    handleCreateManualTourAction("lead-1", blockedFormData, blockedDependencies),
    (error: unknown) =>
      error instanceof LeadWorkflowError && error.code === "ACTIVE_TOUR_ALREADY_EXISTS",
  );

  const availabilityChecks: unknown[] = [];
  const createdTours: unknown[] = [];
  const reminderJobs: unknown[] = [];
  const notificationEvents: unknown[] = [];
  const outboundWebhooks: unknown[] = [];
  const notificationUpdates: string[] = [];
  const refreshedLeadIds: string[] = [];
  const redirects: string[] = [];
  const formData = new FormData();
  formData.set("scheduledAt", "2026-03-08T20:00:00.000Z");
  formData.set("assignedMembershipId", "membership-2");
  formData.set("notifyProspect", "on");
  formData.set("redirectTo", "/app/leads/lead-1?tab=tours");

  await handleCreateManualTourAction(
    "lead-1",
    formData,
    {
      appendNotificationEvent: async (input) => {
        notificationEvents.push(input);
      },
      assertLeadActionPermission: async () => undefined,
      assertLeadStatusTransitionIsAllowed: () => undefined,
      assertScheduledAtWithinAvailabilityWindow: (input) => {
        availabilityChecks.push(input);
      },
      buildInitialTourReminderState: (input) => ({ initial: input }) as never,
      createManualTour: async (input) => {
        createdTours.push(input);
        return {
          calendarSyncState: {
            calendarSyncError: null,
            calendarSyncProvider: CalendarSyncProvider.GOOGLE,
            calendarSyncStatus: "SYNCED",
            calendarSyncedAt: new Date("2026-03-08T18:00:00.000Z"),
            externalCalendarId: "calendar-event-1",
          },
          nextTour: { id: "tour-1" },
        } as never;
      },
      evaluateLeadQualification: () => ({
          fitResult: QualificationFit.PASS,
        recommendedStatus: LeadStatus.QUALIFIED,
      }) as never,
      findPropertyCalendarSettings: async () => ({
        calendarTargetExternalId: "calendar-1",
        calendarTargetProvider: CalendarSyncProvider.GOOGLE,
      }),
      getActionContext: async () => createActionContext({ membershipRole: MembershipRole.ADMIN }),
      getCurrentWorkspaceMembership: async () => ({
        id: "membership-1",
        schedulingAvailability: { timezone: "workspace-window" },
        workspace: {
          calendarConnections: { GOOGLE: { status: "ACTIVE" } },
          enabledCapabilities: [WorkspaceCapability.ORG_MEMBERS],
          tourReminderSequence: [{ minutesBefore: 60 }],
          tourSchedulingMode: "ROUND_ROBIN",
        },
      }) as never,
      getEligibleTourCoverageMemberships: async () => [{ id: "membership-2" }] as never,
      getLeadWorkflowContext: async () => ({
        fullName: "Casey Client",
        id: "lead-1",
        property: {
          id: "property-1",
          lifecycleStatus: PropertyLifecycleStatus.ACTIVE,
          name: "Maple Court",
          schedulingAvailability: { timezone: "property-window" },
        },
        propertyId: "property-1",
        status: LeadStatus.QUALIFIED,
        tours: [],
        workspace: { webhookSigningSecret: "secret" },
      }) as never,
      parseAvailabilityWindowConfig: (value) => value as never,
      parseCalendarConnectionsConfig: (value) => value as never,
      parseTourReminderSequence: (value) => value as never,
      propertyAcceptsNewLeads: (
        propertyLifecycleStatus,
      ): propertyLifecycleStatus is "ACTIVE" => true,
      queueOutboundWorkflowWebhook: async (input) => {
        outboundWebhooks.push(input);
      },
      redirect: (path) => {
        redirects.push(path);
        return undefined as never;
      },
      redirectToWorkflowErrorPath: () => undefined as never,
      refreshLeadWorkflow: (leadId) => {
        refreshedLeadIds.push(leadId);
      },
      resolveAssignedTourMembershipId: () => "membership-2",
      scheduleTourReminderJobs: async (input) => {
        reminderJobs.push(input);
      },
      sendTourScheduledConfirmation: async () => true,
      updateTourProspectNotificationSentAt: async (tourEventId) => {
        notificationUpdates.push(tourEventId);
      },
      workspaceHasCapability: () => true,
    },
  );

  assert.deepEqual(availabilityChecks, [
    {
      availabilityWindow: { timezone: "workspace-window" },
      label: "Operator",
      scheduledAt: new Date("2026-03-08T20:00:00.000Z"),
    },
    {
      availabilityWindow: { timezone: "property-window" },
      label: "Property",
      scheduledAt: new Date("2026-03-08T20:00:00.000Z"),
    },
  ]);
  assert.deepEqual(createdTours, [
    {
      actionContext: createActionContext({ membershipRole: MembershipRole.ADMIN }),
      assignedMembershipId: "membership-2",
      lead: {
        fullName: "Casey Client",
        id: "lead-1",
        property: {
          id: "property-1",
          lifecycleStatus: PropertyLifecycleStatus.ACTIVE,
          name: "Maple Court",
          schedulingAvailability: { timezone: "property-window" },
        },
        propertyId: "property-1",
        status: LeadStatus.QUALIFIED,
        tours: [],
        workspace: { webhookSigningSecret: "secret" },
      },
      propertyCalendarSettings: {
        calendarTargetExternalId: "calendar-1",
        calendarTargetProvider: CalendarSyncProvider.GOOGLE,
      },
      reminderSequenceState: {
        initial: {
          reminderSequence: [{ minutesBefore: 60 }],
          scheduledAt: new Date("2026-03-08T20:00:00.000Z"),
        },
      },
      scheduledAt: new Date("2026-03-08T20:00:00.000Z"),
      workspaceCalendarConnections: { GOOGLE: { status: "ACTIVE" } },
    },
  ]);
  assert.deepEqual(reminderJobs, [
    {
      leadId: "lead-1",
      reminderSequence: [{ minutesBefore: 60 }],
      scheduledAt: new Date("2026-03-08T20:00:00.000Z"),
      tourEventId: "tour-1",
    },
  ]);
  assert.deepEqual(notificationUpdates, ["tour-1"]);
  assert.equal(notificationEvents.length, 1);
  assert.equal((notificationEvents[0] as { workspaceId: string }).workspaceId, "workspace-1");
  assert.equal((notificationEvents[0] as { leadId: string }).leadId, "lead-1");
  assert.equal((notificationEvents[0] as { type: string }).type, "TOUR_SCHEDULED");
  assert.equal((notificationEvents[0] as { title: string }).title, "Manual tour scheduled");
  assert.match(
    (notificationEvents[0] as { body: string }).body,
    /^Casey Client is scheduled for Maple Court on /,
  );
  assert.deepEqual((notificationEvents[0] as { payload: unknown }).payload, {
    assignedMembershipId: "membership-2",
    calendarSyncStatus: "SYNCED",
    leadId: "lead-1",
    tourEventId: "tour-1",
    scheduledAt: "2026-03-08T20:00:00.000Z",
  });
  assert.deepEqual(outboundWebhooks, [
    {
      workspaceId: "workspace-1",
      leadId: "lead-1",
      eventType: "tour.scheduled",
      signingSecret: "secret",
      payload: {
        assignedMembershipId: "membership-2",
        calendarSyncStatus: "SYNCED",
        leadId: "lead-1",
        workspaceId: "workspace-1",
        scheduledAt: "2026-03-08T20:00:00.000Z",
        schedulingMethod: "manual",
      },
    },
  ]);
  assert.deepEqual(refreshedLeadIds, ["lead-1"]);
  assert.deepEqual(redirects, ["/app/leads/lead-1?tab=tours"]);
});

test("handleCancelTourAction rejects missing scheduled tours and persists successful cancellations", async () => {
  const { handleCancelTourAction } = getLeadActionsModule();

  const invalidDependencies: CancelTourActionDependencies = {
    assertLeadActionPermission: async () => undefined,
    assertLeadStatusTransitionIsAllowed: () => undefined,
    buildCalendarSyncState: () => ({
      calendarSyncError: null,
      calendarSyncProvider: CalendarSyncProvider.GOOGLE,
      calendarSyncStatus: "PENDING",
      calendarSyncedAt: null,
      externalCalendarId: null,
    }) as never,
    cancelTourAndRouteLead: async () => undefined,
    findLeadForCancelTour: async () => ({
      id: "lead-1",
      property: { calendarTargetExternalId: null, calendarTargetProvider: null, name: "Maple Court" },
      propertyId: "property-1",
      status: LeadStatus.TOUR_SCHEDULED,
      tours: [],
      workspace: { webhookSigningSecret: "secret" },
    }),
    getActionContext: async () => createActionContext(),
    getCurrentWorkspaceMembership: async () => ({
      workspace: {
        calendarConnections: null,
      },
    }) as never,
    parseCalendarConnectionsConfig: () => ({} as never),
    queueOutboundWorkflowWebhook: async () => undefined,
    redirect: () => undefined as never,
    redirectToWorkflowErrorPath: () => undefined as never,
    refreshLeadWorkflow: () => undefined,
    sendTourCanceledNotification: async () => false,
    updateTourProspectNotificationSentAt: async () => undefined,
  };

  await assert.rejects(
    handleCancelTourAction("lead-1", new FormData(), invalidDependencies),
    (error: unknown) =>
      error instanceof LeadWorkflowError && error.code === "ACTION_REQUIRES_QUALIFIED_LEAD",
  );

  const canceledTours: unknown[] = [];
  const outboundWebhooks: unknown[] = [];
  const notificationUpdates: string[] = [];
  const refreshedLeadIds: string[] = [];
  const redirects: string[] = [];
  const formData = new FormData();
  formData.set("operatorCancelReason", " Prospect unavailable ");
  formData.set("notifyProspect", "on");
  formData.set("prospectMessage", "Custom cancel note");
  formData.set("routeToStatus", LeadStatus.UNDER_REVIEW);
  formData.set("redirectTo", "/app/leads/lead-1?tab=tours");

  await handleCancelTourAction(
    "lead-1",
    formData,
    {
      assertLeadActionPermission: async () => undefined,
      assertLeadStatusTransitionIsAllowed: () => undefined,
      buildCalendarSyncState: () => ({
        calendarSyncError: null,
        calendarSyncProvider: CalendarSyncProvider.GOOGLE,
        calendarSyncStatus: "SYNCED",
        calendarSyncedAt: new Date("2026-03-08T00:00:00.000Z"),
        externalCalendarId: "calendar-event-1",
      }) as never,
      cancelTourAndRouteLead: async (input) => {
        canceledTours.push(input);
      },
      findLeadForCancelTour: async () => ({
        id: "lead-1",
        property: {
          calendarTargetExternalId: "calendar-1",
          calendarTargetProvider: CalendarSyncProvider.GOOGLE,
          name: "Maple Court",
        },
        propertyId: "property-1",
        status: LeadStatus.TOUR_SCHEDULED,
        tours: [{ externalCalendarId: "calendar-event-1", id: "tour-1" }],
        workspace: { webhookSigningSecret: "secret" },
      }),
      getActionContext: async () => createActionContext({ membershipRole: MembershipRole.ADMIN }),
      getCurrentWorkspaceMembership: async () => ({
        workspace: {
          calendarConnections: { GOOGLE: { status: "ACTIVE" } },
        },
      }) as never,
      parseCalendarConnectionsConfig: (value) => value as never,
      queueOutboundWorkflowWebhook: async (input) => {
        outboundWebhooks.push(input);
      },
      redirect: (path) => {
        redirects.push(path);
        return undefined as never;
      },
      redirectToWorkflowErrorPath: () => undefined as never,
      refreshLeadWorkflow: (leadId) => {
        refreshedLeadIds.push(leadId);
      },
      sendTourCanceledNotification: async () => true,
      updateTourProspectNotificationSentAt: async (tourEventId) => {
        notificationUpdates.push(tourEventId);
      },
    },
  );

  assert.deepEqual(canceledTours, [
    {
      actionContext: createActionContext({ membershipRole: MembershipRole.ADMIN }),
      activeTour: {
        externalCalendarId: "calendar-event-1",
        id: "tour-1",
      },
      calendarSyncState: {
        calendarSyncError: null,
        calendarSyncProvider: CalendarSyncProvider.GOOGLE,
        calendarSyncStatus: "SYNCED",
        calendarSyncedAt: new Date("2026-03-08T00:00:00.000Z"),
        externalCalendarId: "calendar-event-1",
      },
      lead: {
        id: "lead-1",
        property: {
          calendarTargetExternalId: "calendar-1",
          calendarTargetProvider: CalendarSyncProvider.GOOGLE,
          name: "Maple Court",
        },
        propertyId: "property-1",
        status: LeadStatus.TOUR_SCHEDULED,
        tours: [{ externalCalendarId: "calendar-event-1", id: "tour-1" }],
        workspace: { webhookSigningSecret: "secret" },
      },
      notifyProspect: true,
      operatorCancelReason: "Prospect unavailable",
      targetStatus: LeadStatus.UNDER_REVIEW,
    },
  ]);
  assert.deepEqual(notificationUpdates, ["tour-1"]);
  assert.deepEqual(outboundWebhooks, [
    {
      workspaceId: "workspace-1",
      leadId: "lead-1",
      eventType: "tour.canceled",
      signingSecret: "secret",
      payload: {
        leadId: "lead-1",
        operatorCancelReason: "Prospect unavailable",
        reroutedStatus: LeadStatus.UNDER_REVIEW,
        tourEventId: "tour-1",
        workspaceId: "workspace-1",
      },
    },
  ]);
  assert.deepEqual(refreshedLeadIds, ["lead-1"]);
  assert.deepEqual(redirects, ["/app/leads/lead-1?tab=tours"]);
});

test("handleRescheduleTourAction rejects missing scheduled tours and persists successful reschedules", async () => {
  const { handleRescheduleTourAction } = getLeadActionsModule();

  const invalidDependencies: RescheduleTourActionDependencies = {
    assertLeadActionPermission: async () => undefined,
    assertScheduledAtWithinAvailabilityWindow: () => undefined,
    buildInitialTourReminderState: () => ({ sequence: [] }) as never,
    findLeadForRescheduleTour: async () => ({
      id: "lead-1",
      property: {
        calendarTargetExternalId: "calendar-1",
        calendarTargetProvider: CalendarSyncProvider.GOOGLE,
        name: "Maple Court",
        schedulingAvailability: { timezone: "UTC" },
      },
      propertyId: "property-1",
      tours: [],
      workspace: { webhookSigningSecret: "secret" },
    }),
    findPropertyAvailabilityForRescheduleTour: async () => ({
      schedulingAvailability: { timezone: "UTC" },
    }),
    getActionContext: async () => createActionContext(),
    getCurrentWorkspaceMembership: async () => ({
      id: "membership-1",
      schedulingAvailability: { timezone: "UTC" },
      workspace: {
        calendarConnections: null,
        enabledCapabilities: [],
        tourReminderSequence: null,
        tourSchedulingMode: "ROUND_ROBIN",
      },
    }) as never,
    getEligibleTourCoverageMemberships: async () => [],
    parseAvailabilityWindowConfig: (value) => value as never,
    parseCalendarConnectionsConfig: (value) => value as never,
    parseTourReminderSequence: () => [] as never,
    queueOutboundWorkflowWebhook: async () => undefined,
    redirect: () => undefined as never,
    redirectToWorkflowErrorPath: () => undefined as never,
    refreshLeadWorkflow: () => undefined,
    rescheduleTour: async () => ({
      calendarSyncState: {
        calendarSyncError: null,
        calendarSyncProvider: CalendarSyncProvider.GOOGLE,
        calendarSyncStatus: "PENDING",
        calendarSyncedAt: null,
        externalCalendarId: null,
      },
      nextTourEvent: { id: "tour-2" },
    }) as never,
    resolveAssignedTourMembershipId: () => "membership-1",
    scheduleTourReminderJobs: async () => undefined,
    sendTourRescheduledNotification: async () => false,
    updateTourProspectNotificationSentAt: async () => undefined,
    workspaceHasCapability: () => false,
  };

  const missingTourFormData = new FormData();
  missingTourFormData.set("scheduledAt", "2026-03-08T15:00:00.000Z");

  await assert.rejects(
    handleRescheduleTourAction("lead-1", missingTourFormData, invalidDependencies),
    (error: unknown) =>
      error instanceof LeadWorkflowError && error.code === "ACTION_REQUIRES_QUALIFIED_LEAD",
  );

  const availabilityChecks: unknown[] = [];
  const rescheduledTours: unknown[] = [];
  const reminderJobs: unknown[] = [];
  const outboundWebhooks: unknown[] = [];
  const notificationUpdates: string[] = [];
  const refreshedLeadIds: string[] = [];
  const redirects: string[] = [];
  const eligibleMembershipRequests: string[] = [];
  const formData = new FormData();
  formData.set("scheduledAt", "2026-03-08T16:30:00.000Z");
  formData.set("assignedMembershipId", "membership-2");
  formData.set("notifyProspect", "on");
  formData.set("prospectMessage", "Updated arrival details");
  formData.set("operatorRescheduleReason", " Prospect asked to move the tour ");
  formData.set("redirectTo", "/app/leads/lead-1?tab=tours");

  await handleRescheduleTourAction(
    "lead-1",
    formData,
    {
      assertLeadActionPermission: async () => undefined,
      assertScheduledAtWithinAvailabilityWindow: (input) => {
        availabilityChecks.push(input);
      },
      buildInitialTourReminderState: (input) => ({ initial: input }) as never,
      findLeadForRescheduleTour: async () => ({
        id: "lead-1",
        property: {
          calendarTargetExternalId: "calendar-1",
          calendarTargetProvider: CalendarSyncProvider.GOOGLE,
          name: "Maple Court",
          schedulingAvailability: { timezone: "property-fallback" },
        },
        propertyId: "property-1",
        tours: [{ externalCalendarId: "calendar-event-1", id: "tour-1" }],
        workspace: { webhookSigningSecret: "secret" },
      }),
      findPropertyAvailabilityForRescheduleTour: async ({ workspaceId }) => {
        eligibleMembershipRequests.push(workspaceId);
        return {
          schedulingAvailability: { timezone: "property-window" },
        };
      },
      getActionContext: async () => createActionContext({ membershipRole: MembershipRole.ADMIN }),
      getCurrentWorkspaceMembership: async () => ({
        id: "membership-1",
        schedulingAvailability: { timezone: "workspace-window" },
        workspace: {
          calendarConnections: { GOOGLE: { status: "ACTIVE" } },
          enabledCapabilities: [WorkspaceCapability.ORG_MEMBERS],
          tourReminderSequence: [{ minutesBefore: 60 }],
          tourSchedulingMode: "ROUND_ROBIN",
        },
      }) as never,
      getEligibleTourCoverageMemberships: async (workspaceId) => {
        eligibleMembershipRequests.push(workspaceId);
        return [{ id: "membership-2" }] as never;
      },
      parseAvailabilityWindowConfig: (value) => value as never,
      parseCalendarConnectionsConfig: (value) => value as never,
      parseTourReminderSequence: (value) => value as never,
      queueOutboundWorkflowWebhook: async (input) => {
        outboundWebhooks.push(input);
      },
      redirect: (path) => {
        redirects.push(path);
        return undefined as never;
      },
      redirectToWorkflowErrorPath: () => undefined as never,
      refreshLeadWorkflow: (leadId) => {
        refreshedLeadIds.push(leadId);
      },
      rescheduleTour: async (input) => {
        rescheduledTours.push(input);
        return {
          calendarSyncState: {
            calendarSyncError: null,
            calendarSyncProvider: CalendarSyncProvider.GOOGLE,
            calendarSyncStatus: "SYNCED",
            calendarSyncedAt: new Date("2026-03-08T12:00:00.000Z"),
            externalCalendarId: "calendar-event-2",
          },
          nextTourEvent: { id: "tour-2" },
        } as never;
      },
      resolveAssignedTourMembershipId: () => "membership-2",
      scheduleTourReminderJobs: async (input) => {
        reminderJobs.push(input);
      },
      sendTourRescheduledNotification: async () => true,
      updateTourProspectNotificationSentAt: async (tourEventId) => {
        notificationUpdates.push(tourEventId);
      },
      workspaceHasCapability: () => true,
    },
  );

  assert.deepEqual(availabilityChecks, [
    {
      availabilityWindow: { timezone: "workspace-window" },
      label: "Operator",
      scheduledAt: new Date("2026-03-08T16:30:00.000Z"),
    },
    {
      availabilityWindow: { timezone: "property-window" },
      label: "Property",
      scheduledAt: new Date("2026-03-08T16:30:00.000Z"),
    },
  ]);
  assert.deepEqual(rescheduledTours, [
    {
      actionContext: createActionContext({ membershipRole: MembershipRole.ADMIN }),
      assignedMembershipId: "membership-2",
      lead: {
        id: "lead-1",
        property: {
          calendarTargetExternalId: "calendar-1",
          calendarTargetProvider: CalendarSyncProvider.GOOGLE,
          name: "Maple Court",
          schedulingAvailability: { timezone: "property-fallback" },
        },
        propertyId: "property-1",
        tours: [{ externalCalendarId: "calendar-event-1", id: "tour-1" }],
        workspace: { webhookSigningSecret: "secret" },
      },
      notifyProspect: true,
      operatorRescheduleReason: "Prospect asked to move the tour",
      previousTourEvent: {
        externalCalendarId: "calendar-event-1",
        id: "tour-1",
      },
      reminderSequenceState: {
        initial: {
          reminderSequence: [{ minutesBefore: 60 }],
          scheduledAt: new Date("2026-03-08T16:30:00.000Z"),
        },
      },
      scheduledAtDate: new Date("2026-03-08T16:30:00.000Z"),
      workspaceCalendarConnections: { GOOGLE: { status: "ACTIVE" } },
    },
  ]);
  assert.deepEqual(reminderJobs, [
    {
      leadId: "lead-1",
      reminderSequence: [{ minutesBefore: 60 }],
      scheduledAt: new Date("2026-03-08T16:30:00.000Z"),
      tourEventId: "tour-2",
    },
  ]);
  assert.deepEqual(notificationUpdates, ["tour-2"]);
  assert.deepEqual(outboundWebhooks, [
    {
      workspaceId: "workspace-1",
      leadId: "lead-1",
      eventType: "tour.rescheduled",
      signingSecret: "secret",
      payload: {
        assignedMembershipId: "membership-2",
        calendarSyncStatus: "SYNCED",
        leadId: "lead-1",
        nextTourEventId: "tour-2",
        operatorRescheduleReason: "Prospect asked to move the tour",
        scheduledAt: "2026-03-08T16:30:00.000Z",
        workspaceId: "workspace-1",
      },
    },
  ]);
  assert.deepEqual(notificationUpdates, ["tour-2"]);
  assert.deepEqual(refreshedLeadIds, ["lead-1"]);
  assert.deepEqual(redirects, ["/app/leads/lead-1?tab=tours"]);
  assert.deepEqual(eligibleMembershipRequests, ["workspace-1", "workspace-1"]);
});

test("handleUpdateScreeningRequestStatusAction enforces transition guards and persists completed updates", async () => {
  const { handleUpdateScreeningRequestStatusAction } = getLeadActionsModule();

  const blockedFormData = new FormData();
  blockedFormData.set("status", ScreeningRequestStatus.REVIEWED);

  const blockedDependencies: UpdateScreeningRequestStatusActionDependencies = {
    appendNotificationEvent: async () => undefined,
    assertLeadActionPermission: async () => undefined,
    findScreeningRequestForStatusUpdate: async () => ({
      adverseActionNotes: null,
      chargeAmountCents: null,
      chargeCurrency: null,
      chargeReference: null,
      completedAt: null,
      consentCompletedAt: null,
      consentRecords: [],
      id: "screening-1",
      lead: {
        fullName: "Casey Client",
        workspace: { webhookSigningSecret: "secret" },
      },
      leadId: "lead-1",
      propertyId: "property-1",
      providerReference: null,
      providerReportId: null,
      providerReportUrl: null,
      reviewNotes: null,
      reviewedAt: null,
      screeningProviderConnection: {
        provider: ScreeningProvider.CHECKR,
      },
      status: ScreeningRequestStatus.REQUESTED,
    }),
    getActionContext: async () => createActionContext(),
    queueOutboundWorkflowWebhook: async () => undefined,
    redirect: () => undefined as never,
    redirectToWorkflowErrorPath: () => undefined as never,
    refreshLeadWorkflow: () => undefined,
    resolveScreeningStatusTransitionGuard: () => ({
      allowed: false,
      reason: "consent_required",
    }),
    resolveScreeningWebhookEventType: () => "screening.completed",
    updateScreeningRequestStatus: async () => undefined,
  };

  await assert.rejects(
    handleUpdateScreeningRequestStatusAction(
      "lead-1",
      "screening-1",
      blockedFormData,
      blockedDependencies,
    ),
    (error: unknown) =>
      error instanceof LeadWorkflowError && error.code === "SCREENING_CONSENT_REQUIRED",
  );

  const persistedUpdates: unknown[] = [];
  const notificationEvents: unknown[] = [];
  const outboundWebhooks: unknown[] = [];
  const refreshedLeadIds: string[] = [];
  const redirects: string[] = [];
  const completeFormData = new FormData();
  completeFormData.set("status", ScreeningRequestStatus.COMPLETED);
  completeFormData.set("detail", "Report reviewed by operator");
  completeFormData.set("providerReference", "checkr-ref-1");
  completeFormData.set("providerReportId", "report-1");
  completeFormData.set("providerReportUrl", "https://example.com/report");
  completeFormData.set("providerTimestamp", "2026-03-08T18:00:00.000Z");
  completeFormData.set("chargeAmount", "42.50");
  completeFormData.set("chargeCurrency", "usd");
  completeFormData.set("chargeReference", "charge-1");
  completeFormData.set("reviewNotes", "Ready for review");
  completeFormData.set("attachmentLabel", "Background report");
  completeFormData.set("attachmentUrl", "https://example.com/report.pdf");
  completeFormData.set("attachmentExternalId", "attachment-1");
  completeFormData.set("attachmentContentType", "application/pdf");
  completeFormData.set("redirectTo", "/app/leads/lead-1?tab=screening");

  await handleUpdateScreeningRequestStatusAction(
    "lead-1",
    "screening-1",
    completeFormData,
    {
      appendNotificationEvent: async (input) => {
        notificationEvents.push(input);
      },
      assertLeadActionPermission: async () => undefined,
      findScreeningRequestForStatusUpdate: async () => ({
        adverseActionNotes: null,
        chargeAmountCents: null,
        chargeCurrency: null,
        chargeReference: null,
        completedAt: null,
        consentCompletedAt: new Date("2026-03-08T17:00:00.000Z"),
        consentRecords: [{ id: "consent-1" }],
        id: "screening-1",
        lead: {
          fullName: "Casey Client",
          workspace: { webhookSigningSecret: "secret" },
        },
        leadId: "lead-1",
        propertyId: "property-1",
        providerReference: null,
        providerReportId: null,
        providerReportUrl: null,
        reviewNotes: null,
        reviewedAt: null,
        screeningProviderConnection: {
          provider: ScreeningProvider.CHECKR,
        },
        status: ScreeningRequestStatus.IN_PROGRESS,
      }),
      getActionContext: async () => createActionContext({ membershipRole: MembershipRole.ADMIN }),
      queueOutboundWorkflowWebhook: async (input) => {
        outboundWebhooks.push(input);
      },
      redirect: (path) => {
        redirects.push(path);
        return undefined as never;
      },
      redirectToWorkflowErrorPath: () => undefined as never,
      refreshLeadWorkflow: (leadId) => {
        refreshedLeadIds.push(leadId);
      },
      resolveScreeningStatusTransitionGuard: () => ({
        allowed: true,
        reason: null,
      }),
      resolveScreeningWebhookEventType: () => "screening.completed",
      updateScreeningRequestStatus: async (input) => {
        persistedUpdates.push(input);
      },
    },
  );

  assert.deepEqual(persistedUpdates, [
    {
      actionContext: createActionContext({ membershipRole: MembershipRole.ADMIN }),
      adverseActionNotes: null,
      attachmentContentType: "application/pdf",
      attachmentExternalId: "attachment-1",
      attachmentLabel: "Background report",
      attachmentUrl: "https://example.com/report.pdf",
      chargeAmountCents: 4250,
      chargeCurrency: "USD",
      chargeReference: "charge-1",
      consentSource: null,
      detail: "Report reviewed by operator",
      disclosureVersion: null,
      effectiveProviderTimestamp: new Date("2026-03-08T18:00:00.000Z"),
      nextStatus: ScreeningRequestStatus.COMPLETED,
      providerReference: "checkr-ref-1",
      providerReportId: "report-1",
      providerReportUrl: "https://example.com/report",
      reviewNotes: "Ready for review",
      screeningRequest: {
        adverseActionNotes: null,
        chargeAmountCents: null,
        chargeCurrency: null,
        chargeReference: null,
        completedAt: null,
        consentCompletedAt: new Date("2026-03-08T17:00:00.000Z"),
        consentRecords: [{ id: "consent-1" }],
        id: "screening-1",
        lead: {
          fullName: "Casey Client",
          workspace: { webhookSigningSecret: "secret" },
        },
        leadId: "lead-1",
        propertyId: "property-1",
        providerReference: null,
        providerReportId: null,
        providerReportUrl: null,
        reviewNotes: null,
        reviewedAt: null,
        screeningProviderConnection: {
          provider: ScreeningProvider.CHECKR,
        },
        status: ScreeningRequestStatus.IN_PROGRESS,
      },
    },
  ]);
  assert.deepEqual(notificationEvents, [
    {
      workspaceId: "workspace-1",
      leadId: "lead-1",
      type: "TOUR_SCHEDULED",
      title: "Screening completed",
      body: "Casey Client has a completed screening result ready for review.",
      payload: {
        screeningRequestId: "screening-1",
      },
    },
  ]);
  assert.deepEqual(outboundWebhooks, [
    {
      workspaceId: "workspace-1",
      leadId: "lead-1",
      eventType: "screening.completed",
      signingSecret: "secret",
      payload: {
        leadId: "lead-1",
        provider: ScreeningProvider.CHECKR,
        screeningRequestId: "screening-1",
        status: ScreeningRequestStatus.COMPLETED,
        workspaceId: "workspace-1",
      },
    },
  ]);
  assert.deepEqual(refreshedLeadIds, ["lead-1"]);
  assert.deepEqual(redirects, ["/app/leads/lead-1?tab=screening"]);
});