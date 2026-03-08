import assert from "node:assert/strict";
import test from "node:test";
import { MessageChannel, TemplateType, WorkspaceCapability } from "@/generated/prisma/client";
import type {
  ApplyWorkflowTemplateActionDependencies,
  GenerateWorkflowTemplateActionDependencies,
} from "@/lib/ai-actions";

function getAiActionsModule() {
  process.env.DATABASE_URL ??=
    "postgresql://postgres:postgres@localhost:5432/template1";

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("./ai-actions") as typeof import("@/lib/ai-actions");
}

function createAiMembership() {
  return {
    userId: "user-1",
    workspaceId: "workspace-1",
    workspace: {
      enabledCapabilities: [WorkspaceCapability.AI_ASSIST],
      name: "Roomflow Workspace",
    },
  };
}

test("handleGenerateWorkflowTemplateAction audits generated templates", async () => {
  const { handleGenerateWorkflowTemplateAction } = getAiActionsModule();
  const auditPayloads: unknown[] = [];
  let redirectPath: string | null = null;

  const dependencies: GenerateWorkflowTemplateActionDependencies = {
    buildAiArtifactErrorPayload: (_kind, error) => ({ status: "error", message: String(error) }),
    buildAiArtifactPayload: (_kind, artifact) => ({ status: "ready", artifact }),
    createAiAuditEvent: async ({ payload }) => {
      auditPayloads.push(payload);
    },
    findSampleLead: async () => ({
      conversation: {
        messages: [{ body: "Prospect asked about parking" }],
      },
      property: {
        name: "Maple Court",
      },
    }),
    findSampleProperty: async () => ({ name: "Maple Court" }),
    generateWorkflowTemplate: async () => ({
      body: "Thanks for your interest.",
      channel: "EMAIL",
      name: "Follow-up",
      rationale: "Keep the prospect engaged after the first inquiry.",
      subject: "Thanks",
      type: "FOLLOW_UP",
    }),
    getAiActionContext: async () => createAiMembership(),
    redirect: (path) => {
      redirectPath = path;
      return undefined as never;
    },
    revalidateAiPaths: () => undefined,
  };

  await handleGenerateWorkflowTemplateAction(new FormData(), dependencies);

  assert.equal(auditPayloads.length, 1);
  assert.deepEqual(auditPayloads[0], {
    artifact: {
      body: "Thanks for your interest.",
      channel: "EMAIL",
      name: "Follow-up",
      rationale: "Keep the prospect engaged after the first inquiry.",
      subject: "Thanks",
      type: "FOLLOW_UP",
    },
    status: "ready",
  });
  assert.equal(redirectPath, "/app/templates");
});

test("handleGenerateWorkflowTemplateAction audits provider failures without throwing", async () => {
  const { handleGenerateWorkflowTemplateAction } = getAiActionsModule();
  const auditPayloads: unknown[] = [];

  const dependencies: GenerateWorkflowTemplateActionDependencies = {
    buildAiArtifactErrorPayload: (_kind, error) => ({
      message: error instanceof Error ? error.message : String(error),
      status: "error",
    }),
    buildAiArtifactPayload: (_kind, artifact) => artifact,
    createAiAuditEvent: async ({ payload }) => {
      auditPayloads.push(payload);
    },
    findSampleLead: async () => null,
    findSampleProperty: async () => null,
    generateWorkflowTemplate: async () => {
      throw new Error("Provider unavailable");
    },
    getAiActionContext: async () => createAiMembership(),
    redirect: () => undefined as never,
    revalidateAiPaths: () => undefined,
  };

  await handleGenerateWorkflowTemplateAction(new FormData(), dependencies);

  assert.deepEqual(auditPayloads, [
    {
      message: "Provider unavailable",
      status: "error",
    },
  ]);
});

test("handleApplyWorkflowTemplateAction rejects missing ready artifacts", async () => {
  const { handleApplyWorkflowTemplateAction } = getAiActionsModule();
  const dependencies: ApplyWorkflowTemplateActionDependencies = {
    createAiAuditEvent: async () => undefined,
    createMessageTemplate: async () => undefined,
    findAuditEvents: async () => [],
    findLatestAiArtifact: () => null,
    getAiActionContext: async () => createAiMembership(),
    redirect: () => undefined as never,
    revalidateAiPaths: () => undefined,
  };

  await assert.rejects(
    handleApplyWorkflowTemplateAction(new FormData(), dependencies),
    /No generated workflow template is available to apply/,
  );
});

test("handleApplyWorkflowTemplateAction persists ready workflow templates", async () => {
  const { handleApplyWorkflowTemplateAction } = getAiActionsModule();
  const auditPayloads: unknown[] = [];
  const createdTemplates: Array<{
    body: string;
    channel: MessageChannel;
    name: string;
    subject: string | null;
    type: TemplateType;
    workspaceId: string;
  }> = [];
  let redirectPath: string | null = null;

  const dependencies: ApplyWorkflowTemplateActionDependencies = {
    createAiAuditEvent: async (input) => {
      auditPayloads.push(input);
    },
    createMessageTemplate: async (input) => {
      createdTemplates.push(input);
    },
    findAuditEvents: async () => [
      {
        createdAt: new Date("2026-03-08T00:00:00.000Z"),
        eventType: "ai_artifact_generated",
        payload: {},
      },
    ],
    findLatestAiArtifact: () => ({
      artifactKind: "workflow_template_generator",
      data: {
        body: "We would love to schedule a showing.",
        channel: "SMS",
        name: "Scheduling nudge",
        subject: null,
        type: "REMINDER",
      },
      status: "ready",
    }),
    getAiActionContext: async () => createAiMembership(),
    redirect: (path) => {
      redirectPath = path;
      return undefined as never;
    },
    revalidateAiPaths: () => undefined,
  };

  await handleApplyWorkflowTemplateAction(new FormData(), dependencies);

  assert.deepEqual(createdTemplates, [
    {
      body: "We would love to schedule a showing.",
      channel: MessageChannel.SMS,
      name: "Scheduling nudge",
      subject: null,
      type: TemplateType.REMINDER,
      workspaceId: "workspace-1",
    },
  ]);
  assert.deepEqual(auditPayloads, [
    {
      actorUserId: "user-1",
      eventType: "ai_artifact_applied",
      payload: {
        artifactKind: "workflow_template_generator",
        status: "applied",
        templateName: "Scheduling nudge",
        workspaceId: "workspace-1",
      },
      workspaceId: "workspace-1",
    },
  ]);
  assert.equal(redirectPath, "/app/templates");
});

test("handleGenerateWorkflowTemplateAction uses fallback lead context and honors custom redirects", async () => {
  const { handleGenerateWorkflowTemplateAction } = getAiActionsModule();
  const generatorInputs: Array<{
    propertyName: string | null;
    recentLeadSummary: string;
    workspaceName: string;
  }> = [];
  const auditPayloads: unknown[] = [];
  let redirectPath: string | null = null;
  const formData = new FormData();
  formData.set("redirectTo", "/app/templates?tab=generated");

  const dependencies: GenerateWorkflowTemplateActionDependencies = {
    buildAiArtifactErrorPayload: (_kind, error) => ({ status: "error", message: String(error) }),
    buildAiArtifactPayload: (_kind, artifact) => ({ status: "ready", artifact }),
    createAiAuditEvent: async ({ payload }) => {
      auditPayloads.push(payload);
    },
    findSampleLead: async () => ({
      conversation: null,
      property: {
        name: "Oak House",
      },
    }),
    findSampleProperty: async () => null,
    generateWorkflowTemplate: async (input) => {
      generatorInputs.push(input);
      return {
        body: "Translated follow-up",
        channel: "SMS",
        name: "Fallback summary",
        rationale: "Use the latest workspace context when no recent messages exist.",
        subject: null,
        type: "FOLLOW_UP",
      };
    },
    getAiActionContext: async () => createAiMembership(),
    redirect: (path) => {
      redirectPath = path;
      return undefined as never;
    },
    revalidateAiPaths: () => undefined,
  };

  await handleGenerateWorkflowTemplateAction(formData, dependencies);

  assert.deepEqual(generatorInputs, [
    {
      propertyName: "Oak House",
      recentLeadSummary: "No recent conversation history available.",
      workspaceName: "Roomflow Workspace",
    },
  ]);
  assert.equal(auditPayloads.length, 1);
  assert.equal(redirectPath, "/app/templates?tab=generated");
});

test("handleApplyWorkflowTemplateAction rejects non-ready or data-less artifacts and maps email channels", async () => {
  const { handleApplyWorkflowTemplateAction } = getAiActionsModule();

  await assert.rejects(
    handleApplyWorkflowTemplateAction(
      new FormData(),
      {
        createAiAuditEvent: async () => undefined,
        createMessageTemplate: async () => undefined,
        findAuditEvents: async () => [],
        findLatestAiArtifact: () => ({ status: "error" }),
        getAiActionContext: async () => createAiMembership(),
        redirect: () => undefined as never,
        revalidateAiPaths: () => undefined,
      },
    ),
    /No generated workflow template is available to apply/,
  );

  await assert.rejects(
    handleApplyWorkflowTemplateAction(
      new FormData(),
      {
        createAiAuditEvent: async () => undefined,
        createMessageTemplate: async () => undefined,
        findAuditEvents: async () => [],
        findLatestAiArtifact: () => ({ status: "ready" }),
        getAiActionContext: async () => createAiMembership(),
        redirect: () => undefined as never,
        revalidateAiPaths: () => undefined,
      },
    ),
    /No generated workflow template is available to apply/,
  );

  const createdTemplates: Array<{
    body: string;
    channel: MessageChannel;
    name: string;
    subject: string | null;
    type: TemplateType;
    workspaceId: string;
  }> = [];
  let redirectPath: string | null = null;
  const formData = new FormData();
  formData.set("redirectTo", "/app/templates?tab=library");

  await handleApplyWorkflowTemplateAction(formData, {
    createAiAuditEvent: async () => undefined,
    createMessageTemplate: async (input) => {
      createdTemplates.push(input);
    },
    findAuditEvents: async () => [
      {
        createdAt: new Date("2026-03-08T00:00:00.000Z"),
        eventType: "ai_artifact_generated",
        payload: {},
      },
    ],
    findLatestAiArtifact: () => ({
      data: {
        body: "Email body",
        channel: "EMAIL",
        name: "Welcome sequence",
        subject: "Welcome home",
        type: "REMINDER",
      },
      status: "ready",
    }),
    getAiActionContext: async () => createAiMembership(),
    redirect: (path) => {
      redirectPath = path;
      return undefined as never;
    },
    revalidateAiPaths: () => undefined,
  });

  assert.deepEqual(createdTemplates, [
    {
      body: "Email body",
      channel: MessageChannel.EMAIL,
      name: "Welcome sequence",
      subject: "Welcome home",
      type: TemplateType.REMINDER,
      workspaceId: "workspace-1",
    },
  ]);
  assert.equal(redirectPath, "/app/templates?tab=library");
});