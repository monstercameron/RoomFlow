import assert from "node:assert/strict";
import test from "node:test";

import {
  MembershipRole,
  TaskStatus,
  WorkspaceCapability,
} from "@/generated/prisma/client";
import type {
  AssignLeadOwnerActionDependencies,
  CreateTaskActionDependencies,
  UpdateMemberPropertyScopesActionDependencies,
  UpdateTaskStatusActionDependencies,
  UpdateWorkspaceSlaSettingsActionDependencies,
} from "@/lib/collaboration-actions";

function getCollaborationActionsModule() {
  process.env.DATABASE_URL ??=
    "postgresql://postgres:postgres@localhost:5432/template1";

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("./collaboration-actions") as typeof import("@/lib/collaboration-actions");
}

function createWorkspaceMembership(overrides: Partial<{
  enabledCapabilities: WorkspaceCapability[];
  id: string;
  role: MembershipRole;
  workspaceId: string;
}> = {}) {
  return {
    id: "membership-1",
    role: MembershipRole.OWNER,
    workspaceId: "workspace-1",
    workspace: {
      enabledCapabilities: [WorkspaceCapability.ORG_MEMBERS],
      leadResponseSlaMinutes: 30,
      leadReviewSlaMinutes: 240,
    },
    ...overrides,
  };
}

function createWorkspaceState() {
  return {
    user: {
      id: "user-1",
    },
  };
}

function createAssignLeadDependencies(
  overrides: Partial<AssignLeadOwnerActionDependencies> = {},
): AssignLeadOwnerActionDependencies {
  return {
    createAuditEvent: async () => undefined,
    findLead: async () => ({
      assignedMembershipId: null,
      fullName: "Jordan Lead",
      id: "lead-1",
    }),
    findMembership: async () => ({
      id: "membership-2",
      user: {
        email: "teammate@roomflow.local",
        name: "Taylor Manager",
      },
    }),
    getCurrentWorkspaceMembership: async () => createWorkspaceMembership() as never,
    getCurrentWorkspaceState: async () => createWorkspaceState() as never,
    redirect: () => undefined as never,
    revalidatePaths: () => undefined,
    updateLeadOwner: async () => undefined,
    workspaceHasCapability: () => true,
    ...overrides,
  };
}

function createTaskDependencies(
  overrides: Partial<CreateTaskActionDependencies> = {},
): CreateTaskActionDependencies {
  return {
    createAuditEvent: async () => undefined,
    createTask: async () => ({
      id: "task-1",
    }),
    findLead: async () => ({
      fullName: "Jordan Lead",
      id: "lead-1",
      propertyId: "property-1",
    }),
    findMembership: async () => ({
      id: "membership-2",
      user: {
        email: "teammate@roomflow.local",
        name: "Taylor Manager",
      },
    }),
    findProperty: async () => ({
      id: "property-1",
      name: "Maple House",
    }),
    getCurrentWorkspaceMembership: async () => createWorkspaceMembership() as never,
    getCurrentWorkspaceState: async () => createWorkspaceState() as never,
    redirect: () => undefined as never,
    revalidatePaths: () => undefined,
    workspaceHasCapability: () => true,
    ...overrides,
  };
}

function createTaskStatusDependencies(
  overrides: Partial<UpdateTaskStatusActionDependencies> = {},
): UpdateTaskStatusActionDependencies {
  return {
    createAuditEvent: async () => undefined,
    findTask: async () => ({
      id: "task-1",
      leadId: "lead-1",
      propertyId: "property-1",
      status: TaskStatus.OPEN,
      title: "Follow up",
    }),
    getCurrentWorkspaceMembership: async () => createWorkspaceMembership() as never,
    getCurrentWorkspaceState: async () => createWorkspaceState() as never,
    redirect: () => undefined as never,
    revalidatePaths: () => undefined,
    updateTaskStatus: async () => undefined,
    ...overrides,
  };
}

function createSlaDependencies(
  overrides: Partial<UpdateWorkspaceSlaSettingsActionDependencies> = {},
): UpdateWorkspaceSlaSettingsActionDependencies {
  return {
    createAuditEvent: async () => undefined,
    getCurrentWorkspaceMembership: async () => createWorkspaceMembership() as never,
    getCurrentWorkspaceState: async () => createWorkspaceState() as never,
    redirect: () => undefined as never,
    revalidatePaths: () => undefined,
    updateWorkspace: async () => undefined,
    workspaceHasCapability: () => true,
    ...overrides,
  };
}

function createPropertyScopeDependencies(
  overrides: Partial<UpdateMemberPropertyScopesActionDependencies> = {},
): UpdateMemberPropertyScopesActionDependencies {
  return {
    createAuditEvent: async () => undefined,
    findProperties: async () => [
      {
        id: "property-1",
        name: "Maple House",
      },
    ],
    findTargetMembership: async () => ({
      id: "membership-2",
      role: MembershipRole.MANAGER,
      user: {
        email: "teammate@roomflow.local",
        name: "Taylor Manager",
      },
    }),
    getCurrentWorkspaceMembership: async () => createWorkspaceMembership() as never,
    getCurrentWorkspaceState: async () => createWorkspaceState() as never,
    redirect: () => undefined as never,
    replacePropertyScopes: async () => undefined,
    revalidatePaths: () => undefined,
    workspaceHasCapability: () => true,
    ...overrides,
  };
}

test("handleAssignLeadOwnerAction enforces Org capability and updates ownership", async () => {
  const { handleAssignLeadOwnerAction } = getCollaborationActionsModule();

  await assert.rejects(
    handleAssignLeadOwnerAction(
      "lead-1",
      new FormData(),
      createAssignLeadDependencies({
        workspaceHasCapability: () => false,
      }),
    ),
    /Lead ownership is only available on Org workspaces/,
  );

  const leadUpdates: unknown[] = [];
  const auditEvents: unknown[] = [];
  const redirects: string[] = [];
  const formData = new FormData();
  formData.set("assignedMembershipId", "membership-2");
  formData.set("redirectTo", "/app/inbox?queue=mine");

  await handleAssignLeadOwnerAction(
    "lead-1",
    formData,
    createAssignLeadDependencies({
      createAuditEvent: async (input) => {
        auditEvents.push(input);
      },
      redirect: (path) => {
        redirects.push(path);
        return undefined as never;
      },
      updateLeadOwner: async (input) => {
        leadUpdates.push({
          ...input,
          lastActivityAt: input.lastActivityAt instanceof Date,
        });
      },
    }),
  );

  assert.deepEqual(leadUpdates, [
    {
      assignedMembershipId: "membership-2",
      leadId: "lead-1",
      lastActivityAt: true,
    },
  ]);
  assert.equal(auditEvents.length, 1);
  assert.deepEqual(redirects, ["/app/inbox?queue=mine"]);
});

test("handleCreateTaskAction creates a due-dated task with an assignee", async () => {
  const { handleCreateTaskAction } = getCollaborationActionsModule();
  const createdTasks: unknown[] = [];
  const auditEvents: unknown[] = [];
  const redirects: string[] = [];
  const formData = new FormData();
  formData.set("title", "Review screening packet");
  formData.set("description", "Double check employment verification.");
  formData.set("dueAt", "2026-03-09T13:30");
  formData.set("leadId", "lead-1");
  formData.set("assignedMembershipId", "membership-2");
  formData.set("redirectTo", "/app/leads/lead-1");

  await handleCreateTaskAction(
    formData,
    createTaskDependencies({
      createAuditEvent: async (input) => {
        auditEvents.push(input);
      },
      createTask: async (input) => {
        createdTasks.push({
          ...input,
          dueAt: input.dueAt instanceof Date,
        });
        return {
          id: "task-1",
        };
      },
      redirect: (path) => {
        redirects.push(path);
        return undefined as never;
      },
    }),
  );

  assert.deepEqual(createdTasks, [
    {
      assignedMembershipId: "membership-2",
      createdByUserId: "user-1",
      description: "Double check employment verification.",
      dueAt: true,
      leadId: "lead-1",
      propertyId: "property-1",
      title: "Review screening packet",
      workspaceId: "workspace-1",
    },
  ]);
  assert.equal(auditEvents.length, 1);
  assert.deepEqual(redirects, ["/app/leads/lead-1"]);
});

test("handleUpdateTaskStatusAction marks tasks completed and audits the change", async () => {
  const { handleUpdateTaskStatusAction } = getCollaborationActionsModule();
  const taskUpdates: unknown[] = [];
  const redirects: string[] = [];
  const formData = new FormData();
  formData.set("status", TaskStatus.COMPLETED);
  formData.set("redirectTo", "/app/tasks");

  await handleUpdateTaskStatusAction(
    "task-1",
    formData,
    createTaskStatusDependencies({
      redirect: (path) => {
        redirects.push(path);
        return undefined as never;
      },
      updateTaskStatus: async (input) => {
        taskUpdates.push({
          ...input,
          completedAt: input.completedAt instanceof Date,
        });
      },
    }),
  );

  assert.deepEqual(taskUpdates, [
    {
      completedAt: true,
      status: TaskStatus.COMPLETED,
      taskId: "task-1",
    },
  ]);
  assert.deepEqual(redirects, ["/app/tasks"]);
});

test("handleUpdateWorkspaceSlaSettingsAction and handleUpdateMemberPropertyScopesAction persist collaboration settings", async () => {
  const {
    handleUpdateMemberPropertyScopesAction,
    handleUpdateWorkspaceSlaSettingsAction,
  } = getCollaborationActionsModule();

  const workspaceUpdates: unknown[] = [];
  const propertyScopeUpdates: unknown[] = [];
  const formData = new FormData();
  formData.set("leadResponseSlaMinutes", "45");
  formData.set("leadReviewSlaMinutes", "180");

  await handleUpdateWorkspaceSlaSettingsAction(
    formData,
    createSlaDependencies({
      updateWorkspace: async (input) => {
        workspaceUpdates.push(input);
      },
    }),
  );

  const scopeFormData = new FormData();
  scopeFormData.append("propertyIds", "property-1");

  await handleUpdateMemberPropertyScopesAction(
    "membership-2",
    scopeFormData,
    createPropertyScopeDependencies({
      replacePropertyScopes: async (input) => {
        propertyScopeUpdates.push(input);
      },
    }),
  );

  assert.deepEqual(workspaceUpdates, [
    {
      leadResponseSlaMinutes: 45,
      leadReviewSlaMinutes: 180,
      workspaceId: "workspace-1",
    },
  ]);
  assert.deepEqual(propertyScopeUpdates, [
    {
      membershipId: "membership-2",
      propertyIds: ["property-1"],
    },
  ]);
});