"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  WorkflowActionType,
  WorkflowConditionType,
  WorkflowNodeType,
  WorkflowScope,
  WorkflowSharingVisibility,
  WorkflowStatus,
  WorkflowTriggerType,
  WorkflowVersionStatus,
  WorkspaceCapability,
} from "@/generated/prisma/client";
import { getCurrentWorkspaceMembership } from "@/lib/app-data";
import { prisma } from "@/lib/prisma";
import {
  doesWorkflowNodeRequireApproval,
  getWorkflowStarterTemplate,
} from "@/lib/workflows";
import { workspaceHasCapability } from "@/lib/workspace-plan";

function getRedirectPath(formData: FormData, fallbackPath: string) {
  const redirectValue = formData.get("redirectTo");

  return typeof redirectValue === "string" && redirectValue.length > 0
    ? redirectValue
    : fallbackPath;
}

function revalidateWorkflowPaths(workflowId?: string) {
  revalidatePath("/app/workflows");

  if (workflowId) {
    revalidatePath(`/app/workflows/${workflowId}`);
  }
}

async function getWorkflowActionContext() {
  const membership = await getCurrentWorkspaceMembership();

  if (
    !workspaceHasCapability(
      membership.workspace.enabledCapabilities,
      WorkspaceCapability.ADVANCED_AUTOMATIONS,
    )
  ) {
    throw new Error("Advanced automations are not enabled for this workspace.");
  }

  return membership;
}

function parseWorkflowScope(value: FormDataEntryValue | null) {
  if (value === WorkflowScope.WORKSPACE) {
    return WorkflowScope.WORKSPACE;
  }

  if (value === WorkflowScope.PROPERTY) {
    return WorkflowScope.PROPERTY;
  }

  if (value === WorkflowScope.ORG_LIBRARY) {
    return WorkflowScope.ORG_LIBRARY;
  }

  return null;
}

function parseWorkflowSharingVisibility(value: FormDataEntryValue | null) {
  if (value === WorkflowSharingVisibility.PRIVATE) {
    return WorkflowSharingVisibility.PRIVATE;
  }

  if (value === WorkflowSharingVisibility.WORKSPACE) {
    return WorkflowSharingVisibility.WORKSPACE;
  }

  if (value === WorkflowSharingVisibility.ORG_LIBRARY) {
    return WorkflowSharingVisibility.ORG_LIBRARY;
  }

  return null;
}

function parseWorkflowStatus(value: FormDataEntryValue | null) {
  if (value === WorkflowStatus.DRAFT) {
    return WorkflowStatus.DRAFT;
  }

  if (value === WorkflowStatus.ACTIVE) {
    return WorkflowStatus.ACTIVE;
  }

  if (value === WorkflowStatus.PAUSED) {
    return WorkflowStatus.PAUSED;
  }

  if (value === WorkflowStatus.ARCHIVED) {
    return WorkflowStatus.ARCHIVED;
  }

  return null;
}

function parseWorkflowNodeType(value: FormDataEntryValue | null) {
  if (value === WorkflowNodeType.TRIGGER) {
    return WorkflowNodeType.TRIGGER;
  }

  if (value === WorkflowNodeType.CONDITION) {
    return WorkflowNodeType.CONDITION;
  }

  if (value === WorkflowNodeType.ACTION) {
    return WorkflowNodeType.ACTION;
  }

  return null;
}

function parseWorkflowTriggerType(value: FormDataEntryValue | null) {
  return Object.values(WorkflowTriggerType).includes(value as WorkflowTriggerType)
    ? (value as WorkflowTriggerType)
    : null;
}

function parseWorkflowConditionType(value: FormDataEntryValue | null) {
  return Object.values(WorkflowConditionType).includes(value as WorkflowConditionType)
    ? (value as WorkflowConditionType)
    : null;
}

function parseWorkflowActionType(value: FormDataEntryValue | null) {
  return Object.values(WorkflowActionType).includes(value as WorkflowActionType)
    ? (value as WorkflowActionType)
    : null;
}

function parseConfigJson(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  return JSON.parse(value) as Record<string, unknown>;
}

async function createWorkflowDefinitionWithGraph(params: {
  workspaceId: string;
  name: string;
  description?: string | null;
  scope: WorkflowScope;
  sharingVisibility: WorkflowSharingVisibility;
  propertyId?: string | null;
  baseWorkflowId?: string | null;
  isStarterTemplate?: boolean;
  graph: {
    edges: Array<{
      branchKey?: string;
      label?: string;
      orderIndex: number;
      sourceNodeOrderIndex: number;
      targetNodeOrderIndex: number;
    }>;
    nodes: Array<{
      actionType?: WorkflowActionType;
      approvalRequired?: boolean;
      conditionType?: WorkflowConditionType;
      config?: Record<string, unknown>;
      name: string;
      nodeType: WorkflowNodeType;
      orderIndex: number;
      positionX: number;
      positionY: number;
      triggerType?: WorkflowTriggerType;
    }>;
  };
}) {
  return prisma.$transaction(async (transactionClient) => {
    const workflowDefinition = await transactionClient.workflowDefinition.create({
      data: {
        baseWorkflowId: params.baseWorkflowId ?? null,
        description: params.description ?? null,
        isStarterTemplate: params.isStarterTemplate ?? false,
        name: params.name,
        propertyId: params.propertyId ?? null,
        scope: params.scope,
        sharingVisibility: params.sharingVisibility,
        workspaceId: params.workspaceId,
      },
    });

    const workflowVersion = await transactionClient.workflowVersion.create({
      data: {
        status: WorkflowVersionStatus.DRAFT,
        versionNumber: 1,
        workflowId: workflowDefinition.id,
      },
    });

    const nodeIdByOrderIndex = new Map<number, string>();

    for (const workflowNode of [...params.graph.nodes].sort(
      (leftNode, rightNode) => leftNode.orderIndex - rightNode.orderIndex,
    )) {
      const createdNode = await transactionClient.workflowNode.create({
        data: {
          actionType: workflowNode.actionType ?? null,
          approvalRequired:
            workflowNode.approvalRequired ??
            doesWorkflowNodeRequireApproval({
              actionType: workflowNode.actionType,
              config: workflowNode.config ?? null,
              triggerType: workflowNode.triggerType,
            }),
          conditionType: workflowNode.conditionType ?? null,
          config: (workflowNode.config ?? null) as never,
          name: workflowNode.name,
          nodeType: workflowNode.nodeType,
          orderIndex: workflowNode.orderIndex,
          positionX: workflowNode.positionX,
          positionY: workflowNode.positionY,
          triggerType: workflowNode.triggerType ?? null,
          workflowVersionId: workflowVersion.id,
        },
      });

      nodeIdByOrderIndex.set(workflowNode.orderIndex, createdNode.id);
    }

    for (const workflowEdge of [...params.graph.edges].sort(
      (leftEdge, rightEdge) => leftEdge.orderIndex - rightEdge.orderIndex,
    )) {
      const sourceNodeId = nodeIdByOrderIndex.get(workflowEdge.sourceNodeOrderIndex);
      const targetNodeId = nodeIdByOrderIndex.get(workflowEdge.targetNodeOrderIndex);

      if (!sourceNodeId || !targetNodeId) {
        continue;
      }

      await transactionClient.workflowEdge.create({
        data: {
          branchKey: workflowEdge.branchKey ?? null,
          label: workflowEdge.label ?? null,
          orderIndex: workflowEdge.orderIndex,
          sourceNodeId,
          targetNodeId,
          workflowVersionId: workflowVersion.id,
        },
      });
    }

    return workflowDefinition;
  });
}

async function cloneWorkflowVersion(params: {
  workflowId: string;
  sourceVersionId: string;
}) {
  return prisma.$transaction(async (transactionClient) => {
    const workflowDefinition = await transactionClient.workflowDefinition.findFirst({
      where: {
        id: params.workflowId,
      },
      include: {
        versions: {
          orderBy: {
            versionNumber: "desc",
          },
        },
      },
    });

    if (!workflowDefinition) {
      throw new Error("Workflow not found.");
    }

    const sourceVersion = await transactionClient.workflowVersion.findFirst({
      where: {
        id: params.sourceVersionId,
        workflowId: params.workflowId,
      },
      include: {
        nodes: {
          orderBy: {
            orderIndex: "asc",
          },
        },
        edges: {
          orderBy: {
            orderIndex: "asc",
          },
        },
      },
    });

    if (!sourceVersion) {
      throw new Error("Source version not found.");
    }

    const nextVersionNumber = (workflowDefinition.versions[0]?.versionNumber ?? 0) + 1;
    const clonedVersion = await transactionClient.workflowVersion.create({
      data: {
        notes: `Cloned from version ${sourceVersion.versionNumber}`,
        status: WorkflowVersionStatus.DRAFT,
        versionNumber: nextVersionNumber,
        workflowId: params.workflowId,
      },
    });

    const nodeIdMap = new Map<string, string>();

    for (const workflowNode of sourceVersion.nodes) {
      const clonedNode = await transactionClient.workflowNode.create({
        data: {
          actionType: workflowNode.actionType,
          approvalRequired: workflowNode.approvalRequired,
          conditionType: workflowNode.conditionType,
          config: workflowNode.config as never,
          name: workflowNode.name,
          nodeType: workflowNode.nodeType,
          orderIndex: workflowNode.orderIndex,
          positionX: workflowNode.positionX,
          positionY: workflowNode.positionY,
          triggerType: workflowNode.triggerType,
          workflowVersionId: clonedVersion.id,
        },
      });

      nodeIdMap.set(workflowNode.id, clonedNode.id);
    }

    for (const workflowEdge of sourceVersion.edges) {
      const sourceNodeId = nodeIdMap.get(workflowEdge.sourceNodeId);
      const targetNodeId = nodeIdMap.get(workflowEdge.targetNodeId);

      if (!sourceNodeId || !targetNodeId) {
        continue;
      }

      await transactionClient.workflowEdge.create({
        data: {
          branchKey: workflowEdge.branchKey,
          label: workflowEdge.label,
          orderIndex: workflowEdge.orderIndex,
          sourceNodeId,
          targetNodeId,
          workflowVersionId: clonedVersion.id,
        },
      });
    }

    return clonedVersion;
  });
}

export async function createWorkflowAction(formData: FormData) {
  const membership = await getWorkflowActionContext();
  const redirectPath = getRedirectPath(formData, "/app/workflows");
  const nameValue = formData.get("name");
  const descriptionValue = formData.get("description");
  const scope = parseWorkflowScope(formData.get("scope"));
  const sharingVisibility = parseWorkflowSharingVisibility(formData.get("sharingVisibility"));
  const propertyIdValue = formData.get("propertyId");

  if (typeof nameValue !== "string" || nameValue.trim().length === 0 || !scope || !sharingVisibility) {
    throw new Error("Workflow name, scope, and sharing visibility are required.");
  }

  if (scope === WorkflowScope.PROPERTY && typeof propertyIdValue !== "string") {
    throw new Error("Property-scoped workflows require a property.");
  }

  if (
    sharingVisibility === WorkflowSharingVisibility.ORG_LIBRARY &&
    !workspaceHasCapability(
      membership.workspace.enabledCapabilities,
      WorkspaceCapability.ORG_MEMBERS,
    )
  ) {
    throw new Error("Org library sharing requires an Org workspace.");
  }

  const workflowDefinition = await createWorkflowDefinitionWithGraph({
    description: typeof descriptionValue === "string" ? descriptionValue.trim() : null,
    graph: {
      edges: [],
      nodes: [
        {
          name: "Choose trigger",
          nodeType: WorkflowNodeType.TRIGGER,
          orderIndex: 0,
          positionX: 48,
          positionY: 96,
          triggerType: WorkflowTriggerType.LEAD_CREATED,
        },
      ],
    },
    name: nameValue.trim(),
    propertyId: scope === WorkflowScope.PROPERTY && typeof propertyIdValue === "string" ? propertyIdValue : null,
    scope,
    sharingVisibility,
    workspaceId: membership.workspaceId,
  });

  revalidateWorkflowPaths(workflowDefinition.id);
  redirect(redirectPath === "/app/workflows" ? `/app/workflows/${workflowDefinition.id}` : redirectPath);
}

export async function createStarterWorkflowAction(formData: FormData) {
  const membership = await getWorkflowActionContext();
  const redirectPath = getRedirectPath(formData, "/app/workflows");
  const templateKeyValue = formData.get("templateKey");
  const scope = parseWorkflowScope(formData.get("scope"));
  const sharingVisibility = parseWorkflowSharingVisibility(formData.get("sharingVisibility"));
  const propertyIdValue = formData.get("propertyId");

  if (typeof templateKeyValue !== "string" || !scope || !sharingVisibility) {
    throw new Error("Starter template, scope, and sharing visibility are required.");
  }

  const starterTemplate = getWorkflowStarterTemplate(templateKeyValue);

  if (!starterTemplate) {
    throw new Error("Starter template not found.");
  }

  const workflowDefinition = await createWorkflowDefinitionWithGraph({
    description: starterTemplate.description,
    graph: starterTemplate.buildGraph(),
    isStarterTemplate: true,
    name: starterTemplate.name,
    propertyId: scope === WorkflowScope.PROPERTY && typeof propertyIdValue === "string" ? propertyIdValue : null,
    scope,
    sharingVisibility,
    workspaceId: membership.workspaceId,
  });

  revalidateWorkflowPaths(workflowDefinition.id);
  redirect(redirectPath === "/app/workflows" ? `/app/workflows/${workflowDefinition.id}` : redirectPath);
}

export async function updateWorkflowStatusAction(workflowId: string, formData: FormData) {
  await getWorkflowActionContext();
  const redirectPath = getRedirectPath(formData, `/app/workflows/${workflowId}`);
  const status = parseWorkflowStatus(formData.get("status"));

  if (!status) {
    throw new Error("Workflow status is required.");
  }

  await prisma.workflowDefinition.update({
    where: {
      id: workflowId,
    },
    data: {
      status,
    },
  });

  revalidateWorkflowPaths(workflowId);
  redirect(redirectPath);
}

export async function updateWorkflowSharingAction(workflowId: string, formData: FormData) {
  const membership = await getWorkflowActionContext();
  const redirectPath = getRedirectPath(formData, `/app/workflows/${workflowId}`);
  const sharingVisibility = parseWorkflowSharingVisibility(formData.get("sharingVisibility"));

  if (!sharingVisibility) {
    throw new Error("Workflow sharing visibility is required.");
  }

  if (
    sharingVisibility === WorkflowSharingVisibility.ORG_LIBRARY &&
    !workspaceHasCapability(
      membership.workspace.enabledCapabilities,
      WorkspaceCapability.ORG_MEMBERS,
    )
  ) {
    throw new Error("Org library sharing requires an Org workspace.");
  }

  await prisma.workflowDefinition.update({
    where: {
      id: workflowId,
    },
    data: {
      sharingVisibility,
    },
  });

  revalidateWorkflowPaths(workflowId);
  redirect(redirectPath);
}

export async function createWorkflowVersionAction(workflowId: string, formData: FormData) {
  await getWorkflowActionContext();
  const redirectPath = getRedirectPath(formData, `/app/workflows/${workflowId}`);
  const sourceVersionIdValue = formData.get("sourceVersionId");

  if (typeof sourceVersionIdValue !== "string") {
    throw new Error("A source version is required to create a new draft version.");
  }

  const newVersion = await cloneWorkflowVersion({
    sourceVersionId: sourceVersionIdValue,
    workflowId,
  });

  revalidateWorkflowPaths(workflowId);
  redirect(`${redirectPath.split("?")[0]}?versionId=${newVersion.id}`);
}

export async function publishWorkflowVersionAction(workflowId: string, formData: FormData) {
  await getWorkflowActionContext();
  const redirectPath = getRedirectPath(formData, `/app/workflows/${workflowId}`);
  const versionIdValue = formData.get("versionId");

  if (typeof versionIdValue !== "string") {
    throw new Error("A workflow version is required to publish.");
  }

  await prisma.$transaction(async (transactionClient) => {
    await transactionClient.workflowVersion.updateMany({
      where: {
        workflowId,
        status: WorkflowVersionStatus.PUBLISHED,
      },
      data: {
        status: WorkflowVersionStatus.SUPERSEDED,
      },
    });

    await transactionClient.workflowVersion.update({
      where: {
        id: versionIdValue,
      },
      data: {
        publishedAt: new Date(),
        status: WorkflowVersionStatus.PUBLISHED,
      },
    });

    await transactionClient.workflowDefinition.update({
      where: {
        id: workflowId,
      },
      data: {
        status: WorkflowStatus.ACTIVE,
      },
    });
  });

  revalidateWorkflowPaths(workflowId);
  redirect(redirectPath);
}

export async function addWorkflowNodeAction(workflowId: string, formData: FormData) {
  await getWorkflowActionContext();
  const redirectPath = getRedirectPath(formData, `/app/workflows/${workflowId}`);
  const workflowVersionIdValue = formData.get("workflowVersionId");
  const nameValue = formData.get("name");
  const nodeType = parseWorkflowNodeType(formData.get("nodeType"));
  const triggerType = parseWorkflowTriggerType(formData.get("triggerType"));
  const conditionType = parseWorkflowConditionType(formData.get("conditionType"));
  const actionType = parseWorkflowActionType(formData.get("actionType"));
  const config = parseConfigJson(formData.get("configJson"));

  if (typeof workflowVersionIdValue !== "string" || typeof nameValue !== "string" || !nodeType) {
    throw new Error("Workflow version, node type, and node name are required.");
  }

  const existingNodeCount = await prisma.workflowNode.count({
    where: {
      workflowVersionId: workflowVersionIdValue,
    },
  });

  const columnIndex = existingNodeCount % 4;
  const rowIndex = Math.floor(existingNodeCount / 4);

  await prisma.workflowNode.create({
    data: {
      actionType: actionType ?? null,
      approvalRequired: doesWorkflowNodeRequireApproval({
        actionType,
        config,
        triggerType,
      }),
      conditionType: conditionType ?? null,
      config: (config ?? null) as never,
      name: nameValue.trim(),
      nodeType,
      orderIndex: existingNodeCount,
      positionX: 40 + columnIndex * 232,
      positionY: 48 + rowIndex * 144,
      triggerType: triggerType ?? null,
      workflowVersionId: workflowVersionIdValue,
    },
  });

  revalidateWorkflowPaths(workflowId);
  redirect(redirectPath);
}

export async function addWorkflowEdgeAction(workflowId: string, formData: FormData) {
  await getWorkflowActionContext();
  const redirectPath = getRedirectPath(formData, `/app/workflows/${workflowId}`);
  const workflowVersionIdValue = formData.get("workflowVersionId");
  const sourceNodeIdValue = formData.get("sourceNodeId");
  const targetNodeIdValue = formData.get("targetNodeId");
  const labelValue = formData.get("label");
  const branchKeyValue = formData.get("branchKey");

  if (
    typeof workflowVersionIdValue !== "string" ||
    typeof sourceNodeIdValue !== "string" ||
    typeof targetNodeIdValue !== "string"
  ) {
    throw new Error("Workflow version, source node, and target node are required.");
  }

  const existingEdgeCount = await prisma.workflowEdge.count({
    where: {
      workflowVersionId: workflowVersionIdValue,
    },
  });

  await prisma.workflowEdge.create({
    data: {
      branchKey: typeof branchKeyValue === "string" && branchKeyValue.trim().length > 0 ? branchKeyValue.trim() : null,
      label: typeof labelValue === "string" && labelValue.trim().length > 0 ? labelValue.trim() : null,
      orderIndex: existingEdgeCount,
      sourceNodeId: sourceNodeIdValue,
      targetNodeId: targetNodeIdValue,
      workflowVersionId: workflowVersionIdValue,
    },
  });

  revalidateWorkflowPaths(workflowId);
  redirect(redirectPath);
}

export async function createPropertyWorkflowOverrideAction(
  workflowId: string,
  formData: FormData,
) {
  const membership = await getWorkflowActionContext();
  const redirectPath = getRedirectPath(formData, "/app/workflows");
  const propertyIdValue = formData.get("propertyId");

  if (typeof propertyIdValue !== "string") {
    throw new Error("Property is required to create an override.");
  }

  const baseWorkflow = await prisma.workflowDefinition.findFirst({
    where: {
      id: workflowId,
      workspaceId: membership.workspaceId,
    },
    include: {
      versions: {
        include: {
          nodes: {
            orderBy: {
              orderIndex: "asc",
            },
          },
          edges: {
            orderBy: {
              orderIndex: "asc",
            },
          },
        },
        orderBy: {
          versionNumber: "desc",
        },
      },
    },
  });

  if (!baseWorkflow) {
    throw new Error("Base workflow not found.");
  }

  const sourceVersion = baseWorkflow.versions[0];

  if (!sourceVersion) {
    throw new Error("Base workflow does not yet have a version to override.");
  }

  const propertyRecord = await prisma.property.findFirst({
    where: {
      id: propertyIdValue,
      workspaceId: membership.workspaceId,
    },
    select: {
      name: true,
    },
  });

  if (!propertyRecord) {
    throw new Error("Property not found for override.");
  }

  const overrideWorkflow = await createWorkflowDefinitionWithGraph({
    baseWorkflowId: baseWorkflow.id,
    description: `${baseWorkflow.name} override for ${propertyRecord.name}`,
    graph: {
      edges: sourceVersion.edges.map((workflowEdge) => {
        const sourceNode = sourceVersion.nodes.find((node) => node.id === workflowEdge.sourceNodeId);
        const targetNode = sourceVersion.nodes.find((node) => node.id === workflowEdge.targetNodeId);

        return {
          branchKey: workflowEdge.branchKey ?? undefined,
          label: workflowEdge.label ?? undefined,
          orderIndex: workflowEdge.orderIndex,
          sourceNodeOrderIndex: sourceNode?.orderIndex ?? 0,
          targetNodeOrderIndex: targetNode?.orderIndex ?? 0,
        };
      }),
      nodes: sourceVersion.nodes.map((workflowNode) => ({
        actionType: workflowNode.actionType ?? undefined,
        approvalRequired: workflowNode.approvalRequired,
        conditionType: workflowNode.conditionType ?? undefined,
        config: (workflowNode.config as Record<string, unknown> | null) ?? undefined,
        name: workflowNode.name,
        nodeType: workflowNode.nodeType,
        orderIndex: workflowNode.orderIndex,
        positionX: workflowNode.positionX,
        positionY: workflowNode.positionY,
        triggerType: workflowNode.triggerType ?? undefined,
      })),
    },
    name: `${baseWorkflow.name} (${propertyRecord.name})`,
    propertyId: propertyIdValue,
    scope: WorkflowScope.PROPERTY,
    sharingVisibility: baseWorkflow.sharingVisibility,
    workspaceId: membership.workspaceId,
  });

  revalidateWorkflowPaths(overrideWorkflow.id);
  redirect(redirectPath === "/app/workflows" ? `/app/workflows/${overrideWorkflow.id}` : redirectPath);
}
