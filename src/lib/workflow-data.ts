import { cache } from "react";
import {
  WorkflowNodeType,
  WorkflowScope,
  WorkflowSharingVisibility,
  WorkflowStatus,
  WorkflowVersionStatus,
  WorkspaceCapability,
} from "@/generated/prisma/client";
import { getCurrentWorkspaceMembership } from "@/lib/app-data";
import { prisma } from "@/lib/prisma";
import {
  formatWorkflowScopeLabel,
  formatWorkflowSharingVisibilityLabel,
  formatWorkflowStatusLabel,
  workflowActionCatalog,
  workflowConditionCatalog,
  workflowStarterTemplates,
  workflowTriggerCatalog,
} from "@/lib/workflows";
import { workspaceHasCapability } from "@/lib/workspace-plan";

export function formatRelativeTime(value: Date | null) {
  if (!value) {
    return "Not set";
  }

  const diffMs = Date.now() - value.getTime();
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));

  if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

export function getWorkflowNodeCatalogLabel(node: {
  name: string;
  nodeType: WorkflowNodeType;
  triggerType: string | null;
  conditionType: string | null;
  actionType: string | null;
}) {
  if (node.nodeType === WorkflowNodeType.TRIGGER) {
    return (
      workflowTriggerCatalog.find((item) => item.value === node.triggerType)?.label ?? node.name
    );
  }

  if (node.nodeType === WorkflowNodeType.CONDITION) {
    return (
      workflowConditionCatalog.find((item) => item.value === node.conditionType)?.label ?? node.name
    );
  }

  return workflowActionCatalog.find((item) => item.value === node.actionType)?.label ?? node.name;
}

export function formatVersionStatusLabel(status: WorkflowVersionStatus) {
  return status.toLowerCase().replace(/^./, (value) => value.toUpperCase());
}

type WorkflowDataMembership = {
  workspaceId: string;
  workspace: {
    enabledCapabilities: WorkspaceCapability[];
  };
};

type WorkflowListProperty = {
  id: string;
  name: string;
};

type WorkflowListVersion = {
  createdAt: Date;
  id: string;
  status: WorkflowVersionStatus;
  versionNumber: number;
  edges: Array<unknown>;
  nodes: Array<{
    actionType: string | null;
    approvalRequired: boolean;
    conditionType: string | null;
    name: string;
    nodeType: WorkflowNodeType;
    triggerType: string | null;
  }>;
};

type WorkflowListDefinition = {
  baseWorkflow: {
    id: string;
    name: string;
  } | null;
  description: string | null;
  id: string;
  isStarterTemplate: boolean;
  name: string;
  overrides: Array<{
    id: string;
    property: {
      name: string;
    } | null;
  }>;
  property: {
    name: string;
  } | null;
  scope: WorkflowScope;
  sharingVisibility: WorkflowSharingVisibility;
  status: WorkflowStatus;
  versions: WorkflowListVersion[];
};

type WorkflowBuilderVersion = {
  createdAt: Date;
  id: string;
  notes: string | null;
  publishedAt: Date | null;
  status: WorkflowVersionStatus;
  versionNumber: number;
  edges: Array<{
    branchKey: string | null;
    id: string;
    label: string | null;
    orderIndex: number;
    sourceNodeId: string;
    targetNodeId: string;
  }>;
  nodes: Array<{
    actionType: string | null;
    approvalRequired: boolean;
    conditionType: string | null;
    config: unknown;
    id: string;
    name: string;
    nodeType: WorkflowNodeType;
    orderIndex: number;
    positionX: number;
    positionY: number;
    triggerType: string | null;
  }>;
};

type WorkflowBuilderDefinition = Omit<WorkflowListDefinition, "versions" | "property" | "overrides"> & {
  overrides: Array<{
    id: string;
    name: string;
    property: {
      name: string;
    } | null;
  }>;
  property: {
    id: string;
    name: string;
  } | null;
  versions: WorkflowBuilderVersion[];
};

export function buildWorkflowsViewData(input: {
  membership: WorkflowDataMembership;
  properties: WorkflowListProperty[];
  workflowDefinitions: WorkflowListDefinition[];
}) {
  const hasAdvancedAutomations = workspaceHasCapability(
    input.membership.workspace.enabledCapabilities,
    WorkspaceCapability.ADVANCED_AUTOMATIONS,
  );
  const canUseOrgLibrary = workspaceHasCapability(
    input.membership.workspace.enabledCapabilities,
    WorkspaceCapability.ORG_MEMBERS,
  );

  const workflows = input.workflowDefinitions.map((workflowDefinition) => {
    const latestVersion = workflowDefinition.versions[0] ?? null;
    const publishedVersion =
      workflowDefinition.versions.find(
        (workflowVersion) => workflowVersion.status === WorkflowVersionStatus.PUBLISHED,
      ) ?? null;

    return {
      baseWorkflowName: workflowDefinition.baseWorkflow?.name ?? null,
      description: workflowDefinition.description ?? "No description yet.",
      id: workflowDefinition.id,
      isStarterTemplate: workflowDefinition.isStarterTemplate,
      latestVersion:
        latestVersion
          ? {
              approvalNodeCount: latestVersion.nodes.filter((node) => node.approvalRequired)
                .length,
              createdAt: formatRelativeTime(latestVersion.createdAt),
              edgeCount: latestVersion.edges.length,
              id: latestVersion.id,
              nodeCount: latestVersion.nodes.length,
              triggerLabels: latestVersion.nodes
                .filter((node) => node.nodeType === WorkflowNodeType.TRIGGER)
                .map((node) => getWorkflowNodeCatalogLabel(node)),
              actionLabels: latestVersion.nodes
                .filter((node) => node.nodeType === WorkflowNodeType.ACTION)
                .map((node) => getWorkflowNodeCatalogLabel(node)),
              versionNumber: latestVersion.versionNumber,
              versionStatus: formatVersionStatusLabel(latestVersion.status),
            }
          : null,
      name: workflowDefinition.name,
      overrideSummaries: workflowDefinition.overrides.map((override) => ({
        id: override.id,
        propertyName: override.property?.name ?? "Unassigned property",
      })),
      propertyName: workflowDefinition.property?.name ?? null,
      publishedVersionNumber: publishedVersion?.versionNumber ?? null,
      scope: formatWorkflowScopeLabel(workflowDefinition.scope),
      scopeValue: workflowDefinition.scope,
      sharingVisibility: formatWorkflowSharingVisibilityLabel(
        workflowDefinition.sharingVisibility,
      ),
      sharingVisibilityValue: workflowDefinition.sharingVisibility,
      status: formatWorkflowStatusLabel(workflowDefinition.status),
      statusValue: workflowDefinition.status,
      versionCount: workflowDefinition.versions.length,
    };
  });

  return {
    canUseOrgLibrary,
    hasAdvancedAutomations,
    properties: input.properties,
    starterTemplates: workflowStarterTemplates,
    workflows,
    workflowCounts: {
      active: workflows.filter((workflow) => workflow.statusValue === WorkflowStatus.ACTIVE)
        .length,
      propertyOverrides: workflows.filter((workflow) => workflow.scopeValue === "PROPERTY")
        .length,
      sharedLibrary: workflows.filter(
        (workflow) =>
          workflow.sharingVisibilityValue === WorkflowSharingVisibility.ORG_LIBRARY,
      ).length,
      total: workflows.length,
    },
  };
}

export function buildWorkflowBuilderViewData(input: {
  availableProperties: WorkflowListProperty[];
  membership: WorkflowDataMembership;
  selectedVersionId?: string;
  workflowDefinition: WorkflowBuilderDefinition | null;
}) {
  const hasAdvancedAutomations = workspaceHasCapability(
    input.membership.workspace.enabledCapabilities,
    WorkspaceCapability.ADVANCED_AUTOMATIONS,
  );
  const canUseOrgLibrary = workspaceHasCapability(
    input.membership.workspace.enabledCapabilities,
    WorkspaceCapability.ORG_MEMBERS,
  );

  if (!input.workflowDefinition) {
    return null;
  }

  const selectedVersion =
    input.workflowDefinition.versions.find(
      (workflowVersion) => workflowVersion.id === input.selectedVersionId,
    ) ?? input.workflowDefinition.versions[0] ?? null;
  const publishedVersion =
    input.workflowDefinition.versions.find(
      (workflowVersion) => workflowVersion.status === WorkflowVersionStatus.PUBLISHED,
    ) ?? null;

  return {
    availableProperties: input.availableProperties,
    canUseOrgLibrary,
    hasAdvancedAutomations,
    workflow: {
      baseWorkflowName: input.workflowDefinition.baseWorkflow?.name ?? null,
      description: input.workflowDefinition.description ?? "No description yet.",
      id: input.workflowDefinition.id,
      name: input.workflowDefinition.name,
      overrides: input.workflowDefinition.overrides.map((override) => ({
        id: override.id,
        name: override.name,
        propertyName: override.property?.name ?? "Unassigned property",
      })),
      propertyName: input.workflowDefinition.property?.name ?? null,
      publishedVersionNumber: publishedVersion?.versionNumber ?? null,
      scope: formatWorkflowScopeLabel(input.workflowDefinition.scope),
      scopeValue: input.workflowDefinition.scope,
      sharingVisibility: formatWorkflowSharingVisibilityLabel(
        input.workflowDefinition.sharingVisibility,
      ),
      sharingVisibilityValue: input.workflowDefinition.sharingVisibility,
      status: formatWorkflowStatusLabel(input.workflowDefinition.status),
      statusValue: input.workflowDefinition.status,
      versions: input.workflowDefinition.versions.map((workflowVersion) => ({
        approvalNodeCount: workflowVersion.nodes.filter((node) => node.approvalRequired).length,
        createdAt: formatRelativeTime(workflowVersion.createdAt),
        edgeCount: workflowVersion.edges.length,
        id: workflowVersion.id,
        nodeCount: workflowVersion.nodes.length,
        notes: workflowVersion.notes,
        publishedAt: formatRelativeTime(workflowVersion.publishedAt),
        status: formatVersionStatusLabel(workflowVersion.status),
        statusValue: workflowVersion.status,
        versionNumber: workflowVersion.versionNumber,
      })),
    },
    builder: selectedVersion
      ? {
          edges: selectedVersion.edges.map((workflowEdge) => ({
            branchKey: workflowEdge.branchKey,
            id: workflowEdge.id,
            label: workflowEdge.label,
            sourceNodeId: workflowEdge.sourceNodeId,
            targetNodeId: workflowEdge.targetNodeId,
          })),
          nodes: selectedVersion.nodes.map((workflowNode) => ({
            actionType: workflowNode.actionType,
            approvalRequired: workflowNode.approvalRequired,
            conditionType: workflowNode.conditionType,
            config: workflowNode.config,
            id: workflowNode.id,
            label: getWorkflowNodeCatalogLabel(workflowNode),
            name: workflowNode.name,
            nodeType: workflowNode.nodeType,
            positionX: workflowNode.positionX,
            positionY: workflowNode.positionY,
            triggerType: workflowNode.triggerType,
          })),
          selectedVersionId: selectedVersion.id,
          selectedVersionNumber: selectedVersion.versionNumber,
          selectedVersionStatus: formatVersionStatusLabel(selectedVersion.status),
        }
      : null,
    catalogs: {
      actions: workflowActionCatalog,
      conditions: workflowConditionCatalog,
      triggers: workflowTriggerCatalog,
    },
  };
}

export const getWorkflowsViewData = cache(async () => {
  const membership = await getCurrentWorkspaceMembership();

  const [properties, workflowDefinitions] = await Promise.all([
    prisma.property.findMany({
      where: {
        workspaceId: membership.workspaceId,
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
      },
    }),
    prisma.workflowDefinition.findMany({
      where: {
        workspaceId: membership.workspaceId,
      },
      include: {
        property: {
          select: {
            name: true,
          },
        },
        baseWorkflow: {
          select: {
            id: true,
            name: true,
          },
        },
        overrides: {
          select: {
            id: true,
            property: {
              select: {
                name: true,
              },
            },
          },
        },
        versions: {
          include: {
            nodes: {
              orderBy: {
                orderIndex: "asc",
              },
            },
            edges: true,
          },
          orderBy: {
            versionNumber: "desc",
          },
        },
      },
      orderBy: [
        {
          updatedAt: "desc",
        },
        {
          createdAt: "desc",
        },
      ],
    }),
  ]);

  return buildWorkflowsViewData({
    membership,
    properties,
    workflowDefinitions,
  });
});

export const getWorkflowBuilderViewData = cache(
  async (workflowId: string, selectedVersionId?: string) => {
    const membership = await getCurrentWorkspaceMembership();

    const workflowDefinition = await prisma.workflowDefinition.findFirst({
      where: {
        id: workflowId,
        workspaceId: membership.workspaceId,
      },
      include: {
        property: {
          select: {
            id: true,
            name: true,
          },
        },
        baseWorkflow: {
          select: {
            id: true,
            name: true,
          },
        },
        overrides: {
          include: {
            property: {
              select: {
                name: true,
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
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

    return buildWorkflowBuilderViewData({
      availableProperties: await prisma.property.findMany({
        where: {
          workspaceId: membership.workspaceId,
        },
        orderBy: {
          name: "asc",
        },
        select: {
          id: true,
          name: true,
        },
      }),
      membership,
      selectedVersionId,
      workflowDefinition,
    });
  },
);
