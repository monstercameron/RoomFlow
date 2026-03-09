import assert from "node:assert/strict";
import test from "node:test";
import {
  AuditActorType,
  ContactChannel,
  LeadSourceType,
  MembershipRole,
  NotificationType,
  QualificationFit,
} from "@/generated/prisma/client";
import type { CreateManualLeadDependencies } from "@/lib/manual-leads";

function getManualLeadsModule() {
  process.env.DATABASE_URL ??=
    "postgresql://postgres:postgres@localhost:5432/template1";

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("./manual-leads") as typeof import("@/lib/manual-leads");
}

function createDependencies(
  overrides: Partial<CreateManualLeadDependencies> = {},
): CreateManualLeadDependencies {
  return {
    canMembershipRolePerformLeadAction: () => true,
    createAuditEvent: async () => undefined,
    createContact: async () => undefined,
    createLead: async () => ({ id: "lead-1" }),
    createNotificationEvent: async () => undefined,
    getCurrentWorkspaceMembership: async () => ({
      id: "membership-1",
      role: MembershipRole.MANAGER,
      userId: "user-1",
      workspaceId: "workspace-1",
    }),
    getLeadCreateViewData: async () => ({
      defaultLeadSourceId: "source-manual",
      properties: [{ id: "property-1", name: "Maple House" }],
      sources: [
        {
          id: "source-manual",
          name: "Manual intake",
          type: LeadSourceType.MANUAL,
        },
      ],
    }),
    queueOutboundWorkflowWebhook: async () => undefined,
    ...overrides,
  } as CreateManualLeadDependencies;
}

test("buildCreateLeadRetryPath preserves draft values", () => {
  const { buildCreateLeadRetryPath } = getManualLeadsModule();
  const formData = new FormData();
  formData.set("fullName", "Avery Mason");
  formData.set("email", "avery@example.com");
  formData.set("phone", "+15551234567");
  formData.set("notes", "Needs an early April move-in.");

  const path = buildCreateLeadRetryPath(
    "/app/leads/new",
    formData,
    "Lead name is required.",
  );

  assert.equal(
    path,
    "/app/leads/new?fullName=Avery+Mason&email=avery%40example.com&phone=%2B15551234567&notes=Needs+an+early+April+move-in.&error=Lead+name+is+required.",
  );
});

test("resolveCreateManualLeadDraft rejects viewer role", () => {
  const { CreateManualLeadActionError, resolveCreateManualLeadDraft } =
    getManualLeadsModule();

  assert.throws(
    () =>
      resolveCreateManualLeadDraft({
        draft: {
          email: "avery@example.com",
          fullName: "Avery Mason",
          leadSourceId: null,
          monthlyBudget: 1200,
          moveInDate: null,
          notes: null,
          phone: null,
          preferredContactChannel: ContactChannel.EMAIL,
          propertyId: null,
        },
        membership: {
          role: MembershipRole.VIEWER,
        },
        viewData: {
          defaultLeadSourceId: "source-manual",
          properties: [],
          sources: [
            {
              id: "source-manual",
              name: "Manual intake",
              type: LeadSourceType.MANUAL,
            },
          ],
        },
      }),
    (error: unknown) =>
      error instanceof CreateManualLeadActionError &&
      error.message === "Your role cannot add manual leads in this workspace.",
  );
});

test("handleCreateManualLeadAction uses the default manual source and emits side effects", async () => {
  const { handleCreateManualLeadAction } = getManualLeadsModule();
  const auditEvents: unknown[] = [];
  const contacts: unknown[] = [];
  const leads: unknown[] = [];
  const notificationEvents: unknown[] = [];
  const webhookEvents: unknown[] = [];
  const formData = new FormData();
  formData.set("fullName", "Avery Mason");
  formData.set("email", "Avery@Example.com");
  formData.set("preferredContactChannel", ContactChannel.EMAIL);
  formData.set("propertyId", "property-1");
  formData.set("monthlyBudget", "1350");
  formData.set("notes", "Prefers the upstairs room.");

  const createdLead = await handleCreateManualLeadAction(
    formData,
    createDependencies({
      createAuditEvent: async (input) => {
        auditEvents.push(input);
      },
      createContact: async (input) => {
        contacts.push(input);
      },
      createLead: async (input) => {
        leads.push(input);
        return { id: "lead-42" };
      },
      createNotificationEvent: async (input) => {
        notificationEvents.push(input);
      },
      queueOutboundWorkflowWebhook: async (input) => {
        webhookEvents.push(input);
      },
    }),
  );

  assert.deepEqual(createdLead, { id: "lead-42" });
  assert.equal(leads.length, 1);
  assert.deepEqual(
    leads[0],
    {
      assignedMembershipId: "membership-1",
      email: "avery@example.com",
      fitResult: QualificationFit.UNKNOWN,
      fullName: "Avery Mason",
      lastActivityAt: leads[0] && (leads[0] as { lastActivityAt: Date }).lastActivityAt,
      leadSourceId: "source-manual",
      monthlyBudget: 1350,
      moveInDate: null,
      notes: "Prefers the upstairs room.",
      phone: null,
      preferredContactChannel: ContactChannel.EMAIL,
      propertyId: "property-1",
      status: "NEW",
      workspaceId: "workspace-1",
    },
  );
  assert.equal(
    (leads[0] as { lastActivityAt: Date }).lastActivityAt instanceof Date,
    true,
  );
  assert.deepEqual(contacts, [
    {
      email: "avery@example.com",
      leadId: "lead-42",
      phone: null,
      preferredChannel: ContactChannel.EMAIL,
    },
  ]);
  assert.deepEqual(auditEvents, [
    {
      actorType: AuditActorType.USER,
      actorUserId: "user-1",
      eventType: "lead_created",
      leadId: "lead-42",
      payload: {
        createdManually: true,
        sourceName: "Manual intake",
        sourceType: "MANUAL",
      },
      propertyId: "property-1",
      workspaceId: "workspace-1",
    },
  ]);
  assert.deepEqual(notificationEvents, [
    {
      body: "Avery Mason was added from Manual intake.",
      leadId: "lead-42",
      title: "New lead created",
      type: NotificationType.NEW_LEAD,
      workspaceId: "workspace-1",
    },
  ]);
  assert.deepEqual(webhookEvents, [
    {
      eventType: "lead.created",
      leadId: "lead-42",
      payload: {
        leadId: "lead-42",
        sourceType: "MANUAL",
        workspaceId: "workspace-1",
      },
      workspaceId: "workspace-1",
    },
  ]);
});