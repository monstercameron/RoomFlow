import assert from "node:assert/strict";
import test from "node:test";
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

function getWorkflowDataModule() {
  process.env.DATABASE_URL ??=
    "postgresql://postgres:postgres@localhost:5432/template1";

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("./workflow-data") as typeof import("@/lib/workflow-data");
}

test("formatRelativeTime returns a fallback when no date is present", () => {
  const { formatRelativeTime } = getWorkflowDataModule();
  assert.equal(formatRelativeTime(null), "Not set");
});

test("formatRelativeTime formats minute and day granularity", () => {
  const { formatRelativeTime } = getWorkflowDataModule();
  const originalDateNow = Date.now;
  Date.now = () => new Date("2026-03-08T12:00:00.000Z").getTime();

  try {
    assert.equal(
      formatRelativeTime(new Date("2026-03-08T11:30:00.000Z")),
      "30 minutes ago",
    );
    assert.equal(
      formatRelativeTime(new Date("2026-03-06T12:00:00.000Z")),
      "2 days ago",
    );
  } finally {
    Date.now = originalDateNow;
  }
});

test("getWorkflowNodeCatalogLabel resolves known trigger, condition, and action labels", () => {
  const { getWorkflowNodeCatalogLabel } = getWorkflowDataModule();
  assert.equal(
    getWorkflowNodeCatalogLabel({
      actionType: null,
      conditionType: null,
      name: "Fallback trigger",
      nodeType: WorkflowNodeType.TRIGGER,
      triggerType: WorkflowTriggerType.LEAD_CREATED,
    }),
    "Lead created",
  );
  assert.equal(
    getWorkflowNodeCatalogLabel({
      actionType: null,
      conditionType: WorkflowConditionType.STATUS,
      name: "Fallback condition",
      nodeType: WorkflowNodeType.CONDITION,
      triggerType: null,
    }),
    "Status",
  );
  assert.equal(
    getWorkflowNodeCatalogLabel({
      actionType: WorkflowActionType.SEND_TEMPLATE,
      conditionType: null,
      name: "Fallback action",
      nodeType: WorkflowNodeType.ACTION,
      triggerType: null,
    }),
    "Send template",
  );
});

test("formatVersionStatusLabel creates operator-friendly labels", () => {
  const { formatVersionStatusLabel } = getWorkflowDataModule();
  assert.equal(formatVersionStatusLabel(WorkflowVersionStatus.DRAFT), "Draft");
  assert.equal(formatVersionStatusLabel(WorkflowVersionStatus.PUBLISHED), "Published");
});

test("buildWorkflowsViewData aggregates workflow list metrics and latest-version summaries", () => {
  const { buildWorkflowsViewData } = getWorkflowDataModule();
  const originalDateNow = Date.now;
  Date.now = () => new Date("2026-03-08T12:00:00.000Z").getTime();

  try {
    const viewData = buildWorkflowsViewData({
      membership: {
        workspaceId: "workspace-1",
        workspace: {
          enabledCapabilities: [
            WorkspaceCapability.ADVANCED_AUTOMATIONS,
            WorkspaceCapability.ORG_MEMBERS,
          ],
        },
      },
      properties: [{ id: "property-1", name: "Maple House" }],
      workflowDefinitions: [
        {
          baseWorkflow: { id: "base-1", name: "Base workflow" },
          description: null,
          id: "workflow-1",
          isStarterTemplate: false,
          name: "Leasing follow-up",
          overrides: [
            {
              id: "override-1",
              property: { name: "Maple House" },
            },
          ],
          property: { name: "Maple House" },
          scope: WorkflowScope.PROPERTY,
          sharingVisibility: WorkflowSharingVisibility.ORG_LIBRARY,
          status: WorkflowStatus.ACTIVE,
          versions: [
            {
              createdAt: new Date("2026-03-08T11:30:00.000Z"),
              edges: [{ id: "edge-1" }],
              id: "version-2",
              nodes: [
                {
                  actionType: null,
                  approvalRequired: false,
                  conditionType: null,
                  name: "Lead created fallback",
                  nodeType: WorkflowNodeType.TRIGGER,
                  triggerType: WorkflowTriggerType.LEAD_CREATED,
                },
                {
                  actionType: WorkflowActionType.SEND_TEMPLATE,
                  approvalRequired: true,
                  conditionType: null,
                  name: "Send template fallback",
                  nodeType: WorkflowNodeType.ACTION,
                  triggerType: null,
                },
              ],
              status: WorkflowVersionStatus.DRAFT,
              versionNumber: 2,
            },
            {
              createdAt: new Date("2026-03-07T12:00:00.000Z"),
              edges: [],
              id: "version-1",
              nodes: [],
              status: WorkflowVersionStatus.PUBLISHED,
              versionNumber: 1,
            },
          ],
        },
      ],
    });

    assert.equal(viewData.hasAdvancedAutomations, true);
    assert.equal(viewData.canUseOrgLibrary, true);
    assert.deepEqual(viewData.workflowCounts, {
      active: 1,
      propertyOverrides: 1,
      sharedLibrary: 1,
      total: 1,
    });
    assert.deepEqual(viewData.workflows[0], {
      baseWorkflowName: "Base workflow",
      description: "No description yet.",
      id: "workflow-1",
      isStarterTemplate: false,
      latestVersion: {
        actionLabels: ["Send template"],
        approvalNodeCount: 1,
        createdAt: "30 minutes ago",
        edgeCount: 1,
        id: "version-2",
        nodeCount: 2,
        triggerLabels: ["Lead created"],
        versionNumber: 2,
        versionStatus: "Draft",
      },
      name: "Leasing follow-up",
      overrideSummaries: [{ id: "override-1", propertyName: "Maple House" }],
      propertyName: "Maple House",
      publishedVersionNumber: 1,
      scope: "Property override",
      scopeValue: WorkflowScope.PROPERTY,
      sharingVisibility: "Org shared",
      sharingVisibilityValue: WorkflowSharingVisibility.ORG_LIBRARY,
      status: "Active",
      statusValue: WorkflowStatus.ACTIVE,
      versionCount: 2,
    });
  } finally {
    Date.now = originalDateNow;
  }
});

test("buildWorkflowBuilderViewData shapes version history and selected builder nodes", () => {
  const { buildWorkflowBuilderViewData } = getWorkflowDataModule();
  const originalDateNow = Date.now;
  Date.now = () => new Date("2026-03-08T12:00:00.000Z").getTime();

  try {
    const builderViewData = buildWorkflowBuilderViewData({
      availableProperties: [{ id: "property-2", name: "Oak House" }],
      membership: {
        workspaceId: "workspace-1",
        workspace: {
          enabledCapabilities: [WorkspaceCapability.ORG_MEMBERS],
        },
      },
      selectedVersionId: "version-1",
      workflowDefinition: {
        baseWorkflow: null,
        description: "Existing workflow",
        id: "workflow-2",
        isStarterTemplate: false,
        name: "Tour scheduling",
        overrides: [
          {
            id: "override-2",
            name: "Oak override",
            property: null,
          },
        ],
        property: { id: "property-2", name: "Oak House" },
        scope: WorkflowScope.WORKSPACE,
        sharingVisibility: WorkflowSharingVisibility.PRIVATE,
        status: WorkflowStatus.DRAFT,
        versions: [
          {
            createdAt: new Date("2026-03-08T11:45:00.000Z"),
            edges: [
              {
                branchKey: "yes",
                id: "edge-2",
                label: "Yes",
                orderIndex: 0,
                sourceNodeId: "node-1",
                targetNodeId: "node-2",
              },
            ],
            id: "version-1",
            nodes: [
              {
                actionType: null,
                approvalRequired: false,
                conditionType: null,
                config: { event: "lead.created" },
                id: "node-1",
                name: "Lead created fallback",
                nodeType: WorkflowNodeType.TRIGGER,
                orderIndex: 0,
                positionX: 10,
                positionY: 20,
                triggerType: WorkflowTriggerType.LEAD_CREATED,
              },
              {
                actionType: null,
                approvalRequired: false,
                conditionType: WorkflowConditionType.STATUS,
                config: { status: "QUALIFIED" },
                id: "node-2",
                name: "Status fallback",
                nodeType: WorkflowNodeType.CONDITION,
                orderIndex: 1,
                positionX: 110,
                positionY: 120,
                triggerType: null,
              },
            ],
            notes: "Draft notes",
            publishedAt: null,
            status: WorkflowVersionStatus.DRAFT,
            versionNumber: 1,
          },
          {
            createdAt: new Date("2026-03-07T12:00:00.000Z"),
            edges: [],
            id: "version-0",
            nodes: [],
            notes: null,
            publishedAt: new Date("2026-03-07T12:30:00.000Z"),
            status: WorkflowVersionStatus.PUBLISHED,
            versionNumber: 0,
          },
        ],
      },
    });

    assert.equal(builderViewData?.hasAdvancedAutomations, false);
    assert.equal(builderViewData?.canUseOrgLibrary, true);
    assert.deepEqual(builderViewData?.workflow.versions, [
      {
        approvalNodeCount: 0,
        createdAt: "15 minutes ago",
        edgeCount: 1,
        id: "version-1",
        nodeCount: 2,
        notes: "Draft notes",
        publishedAt: "Not set",
        status: "Draft",
        statusValue: WorkflowVersionStatus.DRAFT,
        versionNumber: 1,
      },
      {
        approvalNodeCount: 0,
        createdAt: "1 day ago",
        edgeCount: 0,
        id: "version-0",
        nodeCount: 0,
        notes: null,
        publishedAt: "1 day ago",
        status: "Published",
        statusValue: WorkflowVersionStatus.PUBLISHED,
        versionNumber: 0,
      },
    ]);
    assert.deepEqual(builderViewData?.builder, {
      edges: [
        {
          branchKey: "yes",
          id: "edge-2",
          label: "Yes",
          sourceNodeId: "node-1",
          targetNodeId: "node-2",
        },
      ],
      nodes: [
        {
          actionType: null,
          approvalRequired: false,
          conditionType: null,
          config: { event: "lead.created" },
          id: "node-1",
          label: "Lead created",
          name: "Lead created fallback",
          nodeType: WorkflowNodeType.TRIGGER,
          positionX: 10,
          positionY: 20,
          triggerType: WorkflowTriggerType.LEAD_CREATED,
        },
        {
          actionType: null,
          approvalRequired: false,
          conditionType: WorkflowConditionType.STATUS,
          config: { status: "QUALIFIED" },
          id: "node-2",
          label: "Status",
          name: "Status fallback",
          nodeType: WorkflowNodeType.CONDITION,
          positionX: 110,
          positionY: 120,
          triggerType: null,
        },
      ],
      selectedVersionId: "version-1",
      selectedVersionNumber: 1,
      selectedVersionStatus: "Draft",
    });
  } finally {
    Date.now = originalDateNow;
  }
});