"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  AuditActorType,
  MembershipRole,
  TaskStatus,
  WorkspaceCapability,
} from "@/generated/prisma/client";
import {
  getCurrentWorkspaceMembership,
  getCurrentWorkspaceState,
} from "@/lib/app-data";
import { membershipRoleSupportsPropertyScopes, canMembershipRoleManagePropertyScopes } from "@/lib/property-scopes";
import { prisma } from "@/lib/prisma";
import { workspaceHasCapability } from "@/lib/workspace-plan";

type CollaborationWorkspaceState = Awaited<ReturnType<typeof getCurrentWorkspaceState>>;
type CollaborationMembership = Awaited<ReturnType<typeof getCurrentWorkspaceMembership>>;

function canOperateOnSharedPipeline(membershipRole: MembershipRole) {
  return membershipRole !== MembershipRole.VIEWER;
}

function parseRequiredText(value: FormDataEntryValue | null, label: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} is required.`);
  }

  return value.trim();
}

function parseOptionalText(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();

  return normalizedValue.length > 0 ? normalizedValue : null;
}

function parseOptionalDateTime(value: FormDataEntryValue | null) {
  const normalizedValue = parseOptionalText(value);

  if (!normalizedValue) {
    return null;
  }

  const parsedValue = new Date(normalizedValue);

  if (Number.isNaN(parsedValue.getTime())) {
    throw new Error("Provide a valid date and time.");
  }

  return parsedValue;
}

function parsePositiveInt(value: FormDataEntryValue | null, label: string) {
  const normalizedValue = parseRequiredText(value, label);
  const parsedValue = Number.parseInt(normalizedValue, 10);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(`${label} must be a whole number greater than zero.`);
  }

  return parsedValue;
}

function parseTaskStatus(value: FormDataEntryValue | null) {
  if (value === TaskStatus.OPEN || value === TaskStatus.IN_PROGRESS || value === TaskStatus.COMPLETED || value === TaskStatus.CANCELED) {
    return value;
  }

  throw new Error("Select a valid task status.");
}

function parseMembershipId(value: FormDataEntryValue | null) {
  const normalizedValue = parseOptionalText(value);

  return normalizedValue === "unassigned" ? null : normalizedValue;
}

function revalidateCollaborationPaths(leadId?: string | null) {
  revalidatePath("/app");
  revalidatePath("/app/inbox");
  revalidatePath("/app/leads");
  revalidatePath("/app/tasks");
  revalidatePath("/app/settings/team");
  revalidatePath("/app/properties");

  if (leadId) {
    revalidatePath(`/app/leads/${leadId}`);
  }
}

export type AssignLeadOwnerActionDependencies = {
  createAuditEvent: (input: {
    workspaceId: string;
    leadId: string;
    actorUserId: string;
    eventType: string;
    payload: unknown;
  }) => Promise<unknown>;
  findLead: (input: { leadId: string; workspaceId: string }) => Promise<{
    assignedMembershipId: string | null;
    fullName: string;
    id: string;
  } | null>;
  findMembership: (input: { membershipId: string; workspaceId: string }) => Promise<{
    id: string;
    user: {
      email: string;
      name: string;
    };
  } | null>;
  getCurrentWorkspaceMembership: () => Promise<CollaborationMembership>;
  getCurrentWorkspaceState: () => Promise<CollaborationWorkspaceState>;
  redirect: typeof redirect;
  revalidatePaths: (leadId?: string | null) => void;
  updateLeadOwner: (input: {
    assignedMembershipId: string | null;
    leadId: string;
    lastActivityAt: Date;
  }) => Promise<unknown>;
  workspaceHasCapability: typeof workspaceHasCapability;
};

const defaultAssignLeadOwnerActionDependencies: AssignLeadOwnerActionDependencies = {
  createAuditEvent: (input) =>
    prisma.auditEvent.create({
      data: {
        workspaceId: input.workspaceId,
        leadId: input.leadId,
        actorUserId: input.actorUserId,
        actorType: AuditActorType.USER,
        eventType: input.eventType,
        payload: input.payload as never,
      },
    }),
  findLead: ({ leadId, workspaceId }) =>
    prisma.lead.findFirst({
      where: {
        id: leadId,
        workspaceId,
      },
      select: {
        assignedMembershipId: true,
        fullName: true,
        id: true,
      },
    }),
  findMembership: ({ membershipId, workspaceId }) =>
    prisma.membership.findFirst({
      where: {
        id: membershipId,
        workspaceId,
      },
      select: {
        id: true,
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    }),
  getCurrentWorkspaceMembership,
  getCurrentWorkspaceState,
  redirect,
  revalidatePaths: (leadId) => {
    revalidateCollaborationPaths(leadId);
  },
  updateLeadOwner: ({ assignedMembershipId, leadId, lastActivityAt }) =>
    prisma.lead.update({
      where: {
        id: leadId,
      },
      data: {
        assignedMembershipId,
        lastActivityAt,
      },
    }),
  workspaceHasCapability,
};

export async function handleAssignLeadOwnerAction(
  leadId: string,
  formData: FormData,
  dependencies: AssignLeadOwnerActionDependencies = defaultAssignLeadOwnerActionDependencies,
) {
  const [workspaceMembership, workspaceState] = await Promise.all([
    dependencies.getCurrentWorkspaceMembership(),
    dependencies.getCurrentWorkspaceState(),
  ]);

  if (
    !dependencies.workspaceHasCapability(
      workspaceMembership.workspace.enabledCapabilities,
      WorkspaceCapability.ORG_MEMBERS,
    )
  ) {
    throw new Error("Lead ownership is only available on Org workspaces.");
  }

  if (!canOperateOnSharedPipeline(workspaceMembership.role)) {
    throw new Error("Only owners, admins, and managers can assign lead ownership.");
  }

  const redirectPath =
    parseOptionalText(formData.get("redirectTo")) ?? `/app/leads/${leadId}`;
  const nextAssignedMembershipId = parseMembershipId(
    formData.get("assignedMembershipId"),
  );
  const lead = await dependencies.findLead({
    leadId,
    workspaceId: workspaceMembership.workspaceId,
  });

  if (!lead) {
    throw new Error("Lead not found.");
  }

  const assignedMembership = nextAssignedMembershipId
    ? await dependencies.findMembership({
        membershipId: nextAssignedMembershipId,
        workspaceId: workspaceMembership.workspaceId,
      })
    : null;

  if (nextAssignedMembershipId && !assignedMembership) {
    throw new Error("Assigned teammate not found.");
  }

  await dependencies.updateLeadOwner({
    assignedMembershipId: nextAssignedMembershipId,
    leadId,
    lastActivityAt: new Date(),
  });

  await dependencies.createAuditEvent({
    workspaceId: workspaceMembership.workspaceId,
    leadId,
    actorUserId: workspaceState.user.id,
    eventType: "lead_owner_updated",
    payload: {
      leadName: lead.fullName,
      nextAssignedMembershipId,
      nextAssignedTeammateEmail: assignedMembership?.user.email ?? null,
      nextAssignedTeammateName: assignedMembership?.user.name ?? null,
      previousAssignedMembershipId: lead.assignedMembershipId,
    },
  });

  dependencies.revalidatePaths(leadId);
  dependencies.redirect(redirectPath);
}

export async function assignLeadOwnerAction(leadId: string, formData: FormData) {
  return handleAssignLeadOwnerAction(leadId, formData);
}

export type CreateTaskActionDependencies = {
  createAuditEvent: (input: {
    workspaceId: string;
    leadId?: string | null;
    propertyId?: string | null;
    actorUserId: string;
    eventType: string;
    payload: unknown;
  }) => Promise<unknown>;
  createTask: (input: {
    assignedMembershipId: string | null;
    createdByUserId: string;
    description: string | null;
    dueAt: Date | null;
    leadId: string | null;
    propertyId: string | null;
    title: string;
    workspaceId: string;
  }) => Promise<{ id: string }>;
  findLead: (input: { leadId: string; workspaceId: string }) => Promise<{
    fullName: string;
    id: string;
    propertyId: string | null;
  } | null>;
  findMembership: (input: { membershipId: string; workspaceId: string }) => Promise<{
    id: string;
    user: {
      email: string;
      name: string;
    };
  } | null>;
  findProperty: (input: { propertyId: string; workspaceId: string }) => Promise<{
    id: string;
    name: string;
  } | null>;
  getCurrentWorkspaceMembership: () => Promise<CollaborationMembership>;
  getCurrentWorkspaceState: () => Promise<CollaborationWorkspaceState>;
  redirect: typeof redirect;
  revalidatePaths: (leadId?: string | null) => void;
  workspaceHasCapability: typeof workspaceHasCapability;
};

const defaultCreateTaskActionDependencies: CreateTaskActionDependencies = {
  createAuditEvent: (input) =>
    prisma.auditEvent.create({
      data: {
        workspaceId: input.workspaceId,
        leadId: input.leadId ?? null,
        propertyId: input.propertyId ?? null,
        actorUserId: input.actorUserId,
        actorType: AuditActorType.USER,
        eventType: input.eventType,
        payload: input.payload as never,
      },
    }),
  createTask: (input) =>
    prisma.task.create({
      data: {
        assignedMembershipId: input.assignedMembershipId,
        createdByUserId: input.createdByUserId,
        description: input.description,
        dueAt: input.dueAt,
        leadId: input.leadId,
        propertyId: input.propertyId,
        title: input.title,
        workspaceId: input.workspaceId,
      },
      select: {
        id: true,
      },
    }),
  findLead: ({ leadId, workspaceId }) =>
    prisma.lead.findFirst({
      where: {
        id: leadId,
        workspaceId,
      },
      select: {
        fullName: true,
        id: true,
        propertyId: true,
      },
    }),
  findMembership: ({ membershipId, workspaceId }) =>
    prisma.membership.findFirst({
      where: {
        id: membershipId,
        workspaceId,
      },
      select: {
        id: true,
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    }),
  findProperty: ({ propertyId, workspaceId }) =>
    prisma.property.findFirst({
      where: {
        id: propertyId,
        workspaceId,
      },
      select: {
        id: true,
        name: true,
      },
    }),
  getCurrentWorkspaceMembership,
  getCurrentWorkspaceState,
  redirect,
  revalidatePaths: (leadId) => {
    revalidateCollaborationPaths(leadId);
  },
  workspaceHasCapability,
};

export async function handleCreateTaskAction(
  formData: FormData,
  dependencies: CreateTaskActionDependencies = defaultCreateTaskActionDependencies,
) {
  const [workspaceMembership, workspaceState] = await Promise.all([
    dependencies.getCurrentWorkspaceMembership(),
    dependencies.getCurrentWorkspaceState(),
  ]);

  if (
    !dependencies.workspaceHasCapability(
      workspaceMembership.workspace.enabledCapabilities,
      WorkspaceCapability.ORG_MEMBERS,
    )
  ) {
    throw new Error("Tasks are only available on Org workspaces.");
  }

  if (!canOperateOnSharedPipeline(workspaceMembership.role)) {
    throw new Error("Only owners, admins, and managers can create tasks.");
  }

  const title = parseRequiredText(formData.get("title"), "Task title");
  const description = parseOptionalText(formData.get("description"));
  const redirectPath = parseOptionalText(formData.get("redirectTo")) ?? "/app/tasks";
  const dueAt = parseOptionalDateTime(formData.get("dueAt"));
  const leadId = parseOptionalText(formData.get("leadId"));
  const requestedPropertyId = parseOptionalText(formData.get("propertyId"));
  const assignedMembershipId = parseMembershipId(formData.get("assignedMembershipId"));

  const lead = leadId
    ? await dependencies.findLead({
        leadId,
        workspaceId: workspaceMembership.workspaceId,
      })
    : null;

  if (leadId && !lead) {
    throw new Error("Lead not found for task creation.");
  }

  const propertyId = requestedPropertyId ?? lead?.propertyId ?? null;
  const property = propertyId
    ? await dependencies.findProperty({
        propertyId,
        workspaceId: workspaceMembership.workspaceId,
      })
    : null;

  if (propertyId && !property) {
    throw new Error("Property not found for task creation.");
  }

  const assignedMembership = assignedMembershipId
    ? await dependencies.findMembership({
        membershipId: assignedMembershipId,
        workspaceId: workspaceMembership.workspaceId,
      })
    : null;

  if (assignedMembershipId && !assignedMembership) {
    throw new Error("Assigned teammate not found.");
  }

  const task = await dependencies.createTask({
    assignedMembershipId,
    createdByUserId: workspaceState.user.id,
    description,
    dueAt,
    leadId: lead?.id ?? null,
    propertyId: property?.id ?? null,
    title,
    workspaceId: workspaceMembership.workspaceId,
  });

  await dependencies.createAuditEvent({
    workspaceId: workspaceMembership.workspaceId,
    leadId: lead?.id ?? null,
    propertyId: property?.id ?? null,
    actorUserId: workspaceState.user.id,
    eventType: "task_created",
    payload: {
      assignedMembershipId,
      assignedTeammateEmail: assignedMembership?.user.email ?? null,
      assignedTeammateName: assignedMembership?.user.name ?? null,
      dueAt: dueAt?.toISOString() ?? null,
      leadId: lead?.id ?? null,
      leadName: lead?.fullName ?? null,
      propertyId: property?.id ?? null,
      propertyName: property?.name ?? null,
      taskId: task.id,
      title,
    },
  });

  dependencies.revalidatePaths(lead?.id ?? null);
  dependencies.redirect(redirectPath);
}

export async function createTaskAction(formData: FormData) {
  return handleCreateTaskAction(formData);
}

export type UpdateTaskStatusActionDependencies = {
  createAuditEvent: (input: {
    workspaceId: string;
    leadId?: string | null;
    propertyId?: string | null;
    actorUserId: string;
    eventType: string;
    payload: unknown;
  }) => Promise<unknown>;
  findTask: (input: { taskId: string; workspaceId: string }) => Promise<{
    id: string;
    leadId: string | null;
    propertyId: string | null;
    status: TaskStatus;
    title: string;
  } | null>;
  getCurrentWorkspaceMembership: () => Promise<CollaborationMembership>;
  getCurrentWorkspaceState: () => Promise<CollaborationWorkspaceState>;
  redirect: typeof redirect;
  revalidatePaths: (leadId?: string | null) => void;
  updateTaskStatus: (input: {
    completedAt: Date | null;
    status: TaskStatus;
    taskId: string;
  }) => Promise<unknown>;
};

const defaultUpdateTaskStatusActionDependencies: UpdateTaskStatusActionDependencies = {
  createAuditEvent: (input) =>
    prisma.auditEvent.create({
      data: {
        workspaceId: input.workspaceId,
        leadId: input.leadId ?? null,
        propertyId: input.propertyId ?? null,
        actorUserId: input.actorUserId,
        actorType: AuditActorType.USER,
        eventType: input.eventType,
        payload: input.payload as never,
      },
    }),
  findTask: ({ taskId, workspaceId }) =>
    prisma.task.findFirst({
      where: {
        id: taskId,
        workspaceId,
      },
      select: {
        id: true,
        leadId: true,
        propertyId: true,
        status: true,
        title: true,
      },
    }),
  getCurrentWorkspaceMembership,
  getCurrentWorkspaceState,
  redirect,
  revalidatePaths: (leadId) => {
    revalidateCollaborationPaths(leadId);
  },
  updateTaskStatus: ({ completedAt, status, taskId }) =>
    prisma.task.update({
      where: {
        id: taskId,
      },
      data: {
        completedAt,
        status,
      },
    }),
};

export async function handleUpdateTaskStatusAction(
  taskId: string,
  formData: FormData,
  dependencies: UpdateTaskStatusActionDependencies = defaultUpdateTaskStatusActionDependencies,
) {
  const [workspaceMembership, workspaceState] = await Promise.all([
    dependencies.getCurrentWorkspaceMembership(),
    dependencies.getCurrentWorkspaceState(),
  ]);

  if (!canOperateOnSharedPipeline(workspaceMembership.role)) {
    throw new Error("Only owners, admins, and managers can update tasks.");
  }

  const nextStatus = parseTaskStatus(formData.get("status"));
  const redirectPath = parseOptionalText(formData.get("redirectTo")) ?? "/app/tasks";
  const task = await dependencies.findTask({
    taskId,
    workspaceId: workspaceMembership.workspaceId,
  });

  if (!task) {
    throw new Error("Task not found.");
  }

  const completedAt = nextStatus === TaskStatus.COMPLETED ? new Date() : null;

  await dependencies.updateTaskStatus({
    completedAt,
    status: nextStatus,
    taskId,
  });

  await dependencies.createAuditEvent({
    workspaceId: workspaceMembership.workspaceId,
    leadId: task.leadId,
    propertyId: task.propertyId,
    actorUserId: workspaceState.user.id,
    eventType: "task_status_updated",
    payload: {
      nextStatus,
      previousStatus: task.status,
      taskId,
      title: task.title,
    },
  });

  dependencies.revalidatePaths(task.leadId);
  dependencies.redirect(redirectPath);
}

export async function updateTaskStatusAction(taskId: string, formData: FormData) {
  return handleUpdateTaskStatusAction(taskId, formData);
}

export type UpdateWorkspaceSlaSettingsActionDependencies = {
  createAuditEvent: (input: {
    workspaceId: string;
    actorUserId: string;
    eventType: string;
    payload: unknown;
  }) => Promise<unknown>;
  getCurrentWorkspaceMembership: () => Promise<CollaborationMembership>;
  getCurrentWorkspaceState: () => Promise<CollaborationWorkspaceState>;
  redirect: typeof redirect;
  revalidatePaths: () => void;
  updateWorkspace: (input: {
    leadResponseSlaMinutes: number;
    leadReviewSlaMinutes: number;
    workspaceId: string;
  }) => Promise<unknown>;
  workspaceHasCapability: typeof workspaceHasCapability;
};

const defaultUpdateWorkspaceSlaSettingsActionDependencies: UpdateWorkspaceSlaSettingsActionDependencies = {
  createAuditEvent: (input) =>
    prisma.auditEvent.create({
      data: {
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
        actorType: AuditActorType.USER,
        eventType: input.eventType,
        payload: input.payload as never,
      },
    }),
  getCurrentWorkspaceMembership,
  getCurrentWorkspaceState,
  redirect,
  revalidatePaths: () => {
    revalidateCollaborationPaths();
  },
  updateWorkspace: ({ leadResponseSlaMinutes, leadReviewSlaMinutes, workspaceId }) =>
    prisma.workspace.update({
      where: {
        id: workspaceId,
      },
      data: {
        leadResponseSlaMinutes,
        leadReviewSlaMinutes,
      },
    }),
  workspaceHasCapability,
};

export async function handleUpdateWorkspaceSlaSettingsAction(
  formData: FormData,
  dependencies: UpdateWorkspaceSlaSettingsActionDependencies = defaultUpdateWorkspaceSlaSettingsActionDependencies,
) {
  const [workspaceMembership, workspaceState] = await Promise.all([
    dependencies.getCurrentWorkspaceMembership(),
    dependencies.getCurrentWorkspaceState(),
  ]);

  if (
    !dependencies.workspaceHasCapability(
      workspaceMembership.workspace.enabledCapabilities,
      WorkspaceCapability.ORG_MEMBERS,
    )
  ) {
    throw new Error("SLA settings are only available on Org workspaces.");
  }

  if (!canMembershipRoleManagePropertyScopes(workspaceMembership.role)) {
    throw new Error("Only workspace owners and admins can update SLA settings.");
  }

  const leadResponseSlaMinutes = parsePositiveInt(
    formData.get("leadResponseSlaMinutes"),
    "Lead response SLA",
  );
  const leadReviewSlaMinutes = parsePositiveInt(
    formData.get("leadReviewSlaMinutes"),
    "Lead review SLA",
  );
  const redirectPath =
    parseOptionalText(formData.get("redirectTo")) ?? "/app/settings/team?tab=sla";

  await dependencies.updateWorkspace({
    leadResponseSlaMinutes,
    leadReviewSlaMinutes,
    workspaceId: workspaceMembership.workspaceId,
  });

  await dependencies.createAuditEvent({
    workspaceId: workspaceMembership.workspaceId,
    actorUserId: workspaceState.user.id,
    eventType: "workspace_sla_settings_updated",
    payload: {
      leadResponseSlaMinutes,
      leadReviewSlaMinutes,
    },
  });

  dependencies.revalidatePaths();
  dependencies.redirect(redirectPath);
}

export async function updateWorkspaceSlaSettingsAction(formData: FormData) {
  return handleUpdateWorkspaceSlaSettingsAction(formData);
}

export type UpdateMemberPropertyScopesActionDependencies = {
  createAuditEvent: (input: {
    workspaceId: string;
    actorUserId: string;
    eventType: string;
    payload: unknown;
  }) => Promise<unknown>;
  findProperties: (input: { propertyIds: string[]; workspaceId: string }) => Promise<Array<{
    id: string;
    name: string;
  }>>;
  findTargetMembership: (input: { membershipId: string; workspaceId: string }) => Promise<{
    id: string;
    role: MembershipRole;
    user: {
      email: string;
      name: string;
    };
  } | null>;
  getCurrentWorkspaceMembership: () => Promise<CollaborationMembership>;
  getCurrentWorkspaceState: () => Promise<CollaborationWorkspaceState>;
  redirect: typeof redirect;
  replacePropertyScopes: (input: {
    membershipId: string;
    propertyIds: string[];
  }) => Promise<unknown>;
  revalidatePaths: () => void;
  workspaceHasCapability: typeof workspaceHasCapability;
};

const defaultUpdateMemberPropertyScopesActionDependencies: UpdateMemberPropertyScopesActionDependencies = {
  createAuditEvent: (input) =>
    prisma.auditEvent.create({
      data: {
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
        actorType: AuditActorType.USER,
        eventType: input.eventType,
        payload: input.payload as never,
      },
    }),
  findProperties: ({ propertyIds, workspaceId }) =>
    prisma.property.findMany({
      where: {
        id: {
          in: propertyIds,
        },
        workspaceId,
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
      },
    }),
  findTargetMembership: ({ membershipId, workspaceId }) =>
    prisma.membership.findFirst({
      where: {
        id: membershipId,
        workspaceId,
      },
      select: {
        id: true,
        role: true,
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    }),
  getCurrentWorkspaceMembership,
  getCurrentWorkspaceState,
  redirect,
  replacePropertyScopes: ({ membershipId, propertyIds }) =>
    prisma.$transaction([
      prisma.membershipPropertyScope.deleteMany({
        where: {
          membershipId,
        },
      }),
      ...(propertyIds.length > 0
        ? [
            prisma.membershipPropertyScope.createMany({
              data: propertyIds.map((propertyId) => ({
                membershipId,
                propertyId,
              })),
            }),
          ]
        : []),
    ]),
  revalidatePaths: () => {
    revalidateCollaborationPaths();
  },
  workspaceHasCapability,
};

export async function handleUpdateMemberPropertyScopesAction(
  membershipId: string,
  formData: FormData,
  dependencies: UpdateMemberPropertyScopesActionDependencies = defaultUpdateMemberPropertyScopesActionDependencies,
) {
  const [workspaceMembership, workspaceState] = await Promise.all([
    dependencies.getCurrentWorkspaceMembership(),
    dependencies.getCurrentWorkspaceState(),
  ]);

  if (
    !dependencies.workspaceHasCapability(
      workspaceMembership.workspace.enabledCapabilities,
      WorkspaceCapability.ORG_MEMBERS,
    )
  ) {
    throw new Error("Property scopes are only available on Org workspaces.");
  }

  if (!canMembershipRoleManagePropertyScopes(workspaceMembership.role)) {
    throw new Error("Only workspace owners and admins can manage property scopes.");
  }

  const targetMembership = await dependencies.findTargetMembership({
    membershipId,
    workspaceId: workspaceMembership.workspaceId,
  });

  if (!targetMembership) {
    throw new Error("Workspace member not found.");
  }

  if (!membershipRoleSupportsPropertyScopes(targetMembership.role)) {
    throw new Error("Property scopes only apply to manager and viewer teammates.");
  }

  const redirectPath =
    parseOptionalText(formData.get("redirectTo")) ?? "/app/settings/team?tab=scopes";
  const propertyIds = [...new Set(
    formData
      .getAll("propertyIds")
      .filter((value): value is string => typeof value === "string" && value.length > 0),
  )];
  const resolvedProperties = propertyIds.length
    ? await dependencies.findProperties({
        propertyIds,
        workspaceId: workspaceMembership.workspaceId,
      })
    : [];

  if (resolvedProperties.length !== propertyIds.length) {
    throw new Error("One or more selected properties were not found.");
  }

  await dependencies.replacePropertyScopes({
    membershipId,
    propertyIds,
  });

  await dependencies.createAuditEvent({
    workspaceId: workspaceMembership.workspaceId,
    actorUserId: workspaceState.user.id,
    eventType: "workspace_member_property_scopes_updated",
    payload: {
      memberEmailAddress: targetMembership.user.email,
      memberName: targetMembership.user.name,
      membershipId,
      propertyIds,
      propertyNames: resolvedProperties.map((property) => property.name),
      propertyScopeCount: propertyIds.length,
    },
  });

  dependencies.revalidatePaths();
  dependencies.redirect(redirectPath);
}

export async function updateMemberPropertyScopesAction(
  membershipId: string,
  formData: FormData,
) {
  return handleUpdateMemberPropertyScopesAction(membershipId, formData);
}