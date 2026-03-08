import assert from "node:assert/strict";
import test from "node:test";
import {
  WorkflowScope,
  WorkflowSharingVisibility,
  WorkspaceCapability,
} from "@/generated/prisma/client";
import type {
  AddWorkflowEdgeActionDependencies,
  AddWorkflowNodeActionDependencies,
  CreateWorkflowActionDependencies,
  CreateWorkflowVersionActionDependencies,
  PublishWorkflowVersionActionDependencies,
  UpdateWorkflowStatusActionDependencies,
  UpdateWorkflowSharingActionDependencies,
} from "@/lib/workflow-actions";

function getWorkflowActionsModule() {
  process.env.DATABASE_URL ??=
    "postgresql://postgres:postgres@localhost:5432/template1";

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("./workflow-actions") as typeof import("@/lib/workflow-actions");
}

function createWorkflowMembership(enabledCapabilities: WorkspaceCapability[] = []) {
  return {
    workspaceId: "workspace-1",
    workspace: {
      enabledCapabilities,
    },
  };
}

test("handleCreateWorkflowAction validates required workflow fields", async () => {
  const { handleCreateWorkflowAction } = getWorkflowActionsModule();
  const formData = new FormData();

  const dependencies: CreateWorkflowActionDependencies = {
    createWorkflowDefinitionWithGraph: async () => ({ id: "workflow-1" }) as never,
    getWorkflowActionContext: async () => createWorkflowMembership(),
    redirect: () => undefined as never,
    revalidateWorkflowPaths: () => undefined,
    workspaceHasCapability: () => false,
  };

  await assert.rejects(
    handleCreateWorkflowAction(formData, dependencies),
    /Workflow name, scope, and sharing visibility are required/,
  );
});

test("handleCreateWorkflowAction enforces org library capability gating", async () => {
  const { handleCreateWorkflowAction } = getWorkflowActionsModule();
  const formData = new FormData();
  formData.set("name", "Leasing workflow");
  formData.set("scope", WorkflowScope.WORKSPACE);
  formData.set("sharingVisibility", WorkflowSharingVisibility.ORG_LIBRARY);

  const dependencies: CreateWorkflowActionDependencies = {
    createWorkflowDefinitionWithGraph: async () => ({ id: "workflow-1" }) as never,
    getWorkflowActionContext: async () => createWorkflowMembership([]),
    redirect: () => undefined as never,
    revalidateWorkflowPaths: () => undefined,
    workspaceHasCapability: () => false,
  };

  await assert.rejects(
    handleCreateWorkflowAction(formData, dependencies),
    /Org library sharing requires an Org workspace/,
  );
});

test("handleCreateWorkflowAction creates the workflow and redirects to its builder", async () => {
  const { handleCreateWorkflowAction } = getWorkflowActionsModule();
  const formData = new FormData();
  formData.set("name", "Leasing workflow");
  formData.set("description", " Follow up after inquiry ");
  formData.set("scope", WorkflowScope.WORKSPACE);
  formData.set("sharingVisibility", WorkflowSharingVisibility.WORKSPACE);

  const createdInputs: unknown[] = [];
  const revalidatedWorkflowIds: Array<string | undefined> = [];
  let redirectPath: string | null = null;

  const dependencies: CreateWorkflowActionDependencies = {
    createWorkflowDefinitionWithGraph: async (input) => {
      createdInputs.push(input);
      return { id: "workflow-1" } as never;
    },
    getWorkflowActionContext: async () => createWorkflowMembership([]),
    redirect: (path) => {
      redirectPath = path;
      return undefined as never;
    },
    revalidateWorkflowPaths: (workflowId) => {
      revalidatedWorkflowIds.push(workflowId);
    },
    workspaceHasCapability: () => false,
  };

  await handleCreateWorkflowAction(formData, dependencies);

  assert.equal(createdInputs.length, 1);
  assert.deepEqual(revalidatedWorkflowIds, ["workflow-1"]);
  assert.equal(redirectPath, "/app/workflows/workflow-1");
});

test("handlePublishWorkflowVersionAction validates the target version", async () => {
  const { handlePublishWorkflowVersionAction } = getWorkflowActionsModule();
  const dependencies: PublishWorkflowVersionActionDependencies = {
    getWorkflowActionContext: async () => createWorkflowMembership([]),
    publishWorkflowVersion: async () => undefined,
    redirect: () => undefined as never,
    revalidateWorkflowPaths: () => undefined,
  };

  await assert.rejects(
    handlePublishWorkflowVersionAction("workflow-1", new FormData(), dependencies),
    /A workflow version is required to publish/,
  );
});

test("handlePublishWorkflowVersionAction publishes and redirects", async () => {
  const { handlePublishWorkflowVersionAction } = getWorkflowActionsModule();
  const formData = new FormData();
  formData.set("versionId", "version-2");

  const publishedVersions: Array<{ workflowId: string; versionId: string }> = [];
  const revalidatedWorkflowIds: Array<string | undefined> = [];
  let redirectPath: string | null = null;

  const dependencies: PublishWorkflowVersionActionDependencies = {
    getWorkflowActionContext: async () => createWorkflowMembership([]),
    publishWorkflowVersion: async (input) => {
      publishedVersions.push(input);
    },
    redirect: (path) => {
      redirectPath = path;
      return undefined as never;
    },
    revalidateWorkflowPaths: (workflowId) => {
      revalidatedWorkflowIds.push(workflowId);
    },
  };

  await handlePublishWorkflowVersionAction("workflow-1", formData, dependencies);

  assert.deepEqual(publishedVersions, [{ workflowId: "workflow-1", versionId: "version-2" }]);
  assert.deepEqual(revalidatedWorkflowIds, ["workflow-1"]);
  assert.equal(redirectPath, "/app/workflows/workflow-1");
});

test("handleUpdateWorkflowStatusAction validates the status and persists valid updates", async () => {
  const { handleUpdateWorkflowStatusAction } = getWorkflowActionsModule();

  const invalidDependencies: UpdateWorkflowStatusActionDependencies = {
    getWorkflowActionContext: async () => createWorkflowMembership([]),
    redirect: () => undefined as never,
    revalidateWorkflowPaths: () => undefined,
    updateWorkflowStatus: async () => undefined,
  };

  await assert.rejects(
    handleUpdateWorkflowStatusAction("workflow-1", new FormData(), invalidDependencies),
    /Workflow status is required/,
  );

  const formData = new FormData();
  formData.set("status", "ACTIVE");

  const statusUpdates: Array<{ workflowId: string; status: string }> = [];
  const revalidatedWorkflowIds: Array<string | undefined> = [];
  let redirectPath: string | null = null;

  const successDependencies: UpdateWorkflowStatusActionDependencies = {
    getWorkflowActionContext: async () => createWorkflowMembership([]),
    redirect: (path) => {
      redirectPath = path;
      return undefined as never;
    },
    revalidateWorkflowPaths: (workflowId) => {
      revalidatedWorkflowIds.push(workflowId);
    },
    updateWorkflowStatus: async (input) => {
      statusUpdates.push(input);
    },
  };

  await handleUpdateWorkflowStatusAction("workflow-1", formData, successDependencies);

  assert.deepEqual(statusUpdates, [{ workflowId: "workflow-1", status: "ACTIVE" }]);
  assert.deepEqual(revalidatedWorkflowIds, ["workflow-1"]);
  assert.equal(redirectPath, "/app/workflows/workflow-1");
});

test("handleUpdateWorkflowSharingAction validates sharing input and org capability gating", async () => {
  const { handleUpdateWorkflowSharingAction } = getWorkflowActionsModule();

  const invalidDependencies: UpdateWorkflowSharingActionDependencies = {
    getWorkflowActionContext: async () => createWorkflowMembership([]),
    redirect: () => undefined as never,
    revalidateWorkflowPaths: () => undefined,
    updateWorkflowSharing: async () => undefined,
    workspaceHasCapability: () => false,
  };

  await assert.rejects(
    handleUpdateWorkflowSharingAction("workflow-1", new FormData(), invalidDependencies),
    /Workflow sharing visibility is required/,
  );

  const orgOnlyFormData = new FormData();
  orgOnlyFormData.set("sharingVisibility", WorkflowSharingVisibility.ORG_LIBRARY);

  await assert.rejects(
    handleUpdateWorkflowSharingAction("workflow-1", orgOnlyFormData, invalidDependencies),
    /Org library sharing requires an Org workspace/,
  );
});

test("handleUpdateWorkflowSharingAction persists sharing visibility and redirects", async () => {
  const { handleUpdateWorkflowSharingAction } = getWorkflowActionsModule();
  const formData = new FormData();
  formData.set("sharingVisibility", WorkflowSharingVisibility.WORKSPACE);

  const sharingUpdates: Array<{ workflowId: string; sharingVisibility: WorkflowSharingVisibility }> = [];
  const revalidatedWorkflowIds: Array<string | undefined> = [];
  let redirectPath: string | null = null;

  const dependencies: UpdateWorkflowSharingActionDependencies = {
    getWorkflowActionContext: async () => createWorkflowMembership([WorkspaceCapability.ORG_MEMBERS]),
    redirect: (path) => {
      redirectPath = path;
      return undefined as never;
    },
    revalidateWorkflowPaths: (workflowId) => {
      revalidatedWorkflowIds.push(workflowId);
    },
    updateWorkflowSharing: async (input) => {
      sharingUpdates.push(input);
    },
    workspaceHasCapability: () => true,
  };

  await handleUpdateWorkflowSharingAction("workflow-1", formData, dependencies);

  assert.deepEqual(sharingUpdates, [
    { workflowId: "workflow-1", sharingVisibility: WorkflowSharingVisibility.WORKSPACE },
  ]);
  assert.deepEqual(revalidatedWorkflowIds, ["workflow-1"]);
  assert.equal(redirectPath, "/app/workflows/workflow-1");
});

test("handleCreateWorkflowVersionAction requires a source version and redirects to the new draft", async () => {
  const { handleCreateWorkflowVersionAction } = getWorkflowActionsModule();

  const missingSourceDependencies: CreateWorkflowVersionActionDependencies = {
    cloneWorkflowVersion: async () => ({ id: "version-2" }),
    getWorkflowActionContext: async () => createWorkflowMembership([]),
    redirect: () => undefined as never,
    revalidateWorkflowPaths: () => undefined,
  };

  await assert.rejects(
    handleCreateWorkflowVersionAction("workflow-1", new FormData(), missingSourceDependencies),
    /A source version is required to create a new draft version/,
  );

  const formData = new FormData();
  formData.set("sourceVersionId", "version-1");
  formData.set("redirectTo", "/app/workflows/workflow-1?tab=versions");

  const versionCloneCalls: Array<{ workflowId: string; sourceVersionId: string }> = [];
  const revalidatedWorkflowIds: Array<string | undefined> = [];
  let redirectPath: string | null = null;

  const successDependencies: CreateWorkflowVersionActionDependencies = {
    cloneWorkflowVersion: async (input) => {
      versionCloneCalls.push(input);
      return { id: "version-2" };
    },
    getWorkflowActionContext: async () => createWorkflowMembership([]),
    redirect: (path) => {
      redirectPath = path;
      return undefined as never;
    },
    revalidateWorkflowPaths: (workflowId) => {
      revalidatedWorkflowIds.push(workflowId);
    },
  };

  await handleCreateWorkflowVersionAction("workflow-1", formData, successDependencies);

  assert.deepEqual(versionCloneCalls, [{ workflowId: "workflow-1", sourceVersionId: "version-1" }]);
  assert.deepEqual(revalidatedWorkflowIds, ["workflow-1"]);
  assert.equal(redirectPath, "/app/workflows/workflow-1?versionId=version-2");
});

test("handleAddWorkflowNodeAction validates required fields and computes node layout", async () => {
  const { handleAddWorkflowNodeAction } = getWorkflowActionsModule();

  const invalidDependencies: AddWorkflowNodeActionDependencies = {
    countWorkflowNodes: async () => 0,
    createWorkflowNode: async () => undefined,
    doesWorkflowNodeRequireApproval: () => false,
    getWorkflowActionContext: async () => createWorkflowMembership([]),
    redirect: () => undefined as never,
    revalidateWorkflowPaths: () => undefined,
  };

  await assert.rejects(
    handleAddWorkflowNodeAction("workflow-1", new FormData(), invalidDependencies),
    /Workflow version, node type, and node name are required/,
  );

  const formData = new FormData();
  formData.set("workflowVersionId", "version-2");
  formData.set("name", " Follow up ");
  formData.set("nodeType", "ACTION");
  formData.set("actionType", "SEND_TEMPLATE");
  formData.set("configJson", '{"templateKey":"tour-reminder"}');

  const createdNodes: unknown[] = [];
  const revalidatedWorkflowIds: Array<string | undefined> = [];
  let redirectPath: string | null = null;

  const successDependencies: AddWorkflowNodeActionDependencies = {
    countWorkflowNodes: async () => 5,
    createWorkflowNode: async (input) => {
      createdNodes.push(input);
    },
    doesWorkflowNodeRequireApproval: () => true,
    getWorkflowActionContext: async () => createWorkflowMembership([]),
    redirect: (path) => {
      redirectPath = path;
      return undefined as never;
    },
    revalidateWorkflowPaths: (workflowId) => {
      revalidatedWorkflowIds.push(workflowId);
    },
  };

  await handleAddWorkflowNodeAction("workflow-1", formData, successDependencies);

  assert.deepEqual(createdNodes, [
    {
      actionType: "SEND_TEMPLATE",
      approvalRequired: true,
      conditionType: null,
      config: { templateKey: "tour-reminder" },
      name: "Follow up",
      nodeType: "ACTION",
      orderIndex: 5,
      positionX: 272,
      positionY: 192,
      triggerType: null,
      workflowVersionId: "version-2",
    },
  ]);
  assert.deepEqual(revalidatedWorkflowIds, ["workflow-1"]);
  assert.equal(redirectPath, "/app/workflows/workflow-1");
});

test("handleAddWorkflowEdgeAction validates required nodes and trims optional labels", async () => {
  const { handleAddWorkflowEdgeAction } = getWorkflowActionsModule();

  const invalidDependencies: AddWorkflowEdgeActionDependencies = {
    countWorkflowEdges: async () => 0,
    createWorkflowEdge: async () => undefined,
    getWorkflowActionContext: async () => createWorkflowMembership([]),
    redirect: () => undefined as never,
    revalidateWorkflowPaths: () => undefined,
  };

  await assert.rejects(
    handleAddWorkflowEdgeAction("workflow-1", new FormData(), invalidDependencies),
    /Workflow version, source node, and target node are required/,
  );

  const formData = new FormData();
  formData.set("workflowVersionId", "version-2");
  formData.set("sourceNodeId", "node-1");
  formData.set("targetNodeId", "node-2");
  formData.set("label", " Yes ");
  formData.set("branchKey", " accepted ");

  const createdEdges: unknown[] = [];
  const revalidatedWorkflowIds: Array<string | undefined> = [];
  let redirectPath: string | null = null;

  const successDependencies: AddWorkflowEdgeActionDependencies = {
    countWorkflowEdges: async () => 3,
    createWorkflowEdge: async (input) => {
      createdEdges.push(input);
    },
    getWorkflowActionContext: async () => createWorkflowMembership([]),
    redirect: (path) => {
      redirectPath = path;
      return undefined as never;
    },
    revalidateWorkflowPaths: (workflowId) => {
      revalidatedWorkflowIds.push(workflowId);
    },
  };

  await handleAddWorkflowEdgeAction("workflow-1", formData, successDependencies);

  assert.deepEqual(createdEdges, [
    {
      branchKey: "accepted",
      label: "Yes",
      orderIndex: 3,
      sourceNodeId: "node-1",
      targetNodeId: "node-2",
      workflowVersionId: "version-2",
    },
  ]);
  assert.deepEqual(revalidatedWorkflowIds, ["workflow-1"]);
  assert.equal(redirectPath, "/app/workflows/workflow-1");
});