import {
  LeadStatus,
  QualificationFit,
  WorkflowActionType,
  WorkflowConditionType,
  WorkflowNodeType,
  WorkflowScope,
  WorkflowSharingVisibility,
  WorkflowStatus,
  WorkflowTriggerType,
} from "@/generated/prisma/client";

export type WorkflowCatalogItem<TValue extends string> = {
  value: TValue;
  label: string;
  description: string;
};

export const workflowTriggerCatalog: WorkflowCatalogItem<WorkflowTriggerType>[] = [
  {
    value: WorkflowTriggerType.LEAD_CREATED,
    label: "Lead created",
    description: "Start the workflow when a new lead record is created.",
  },
  {
    value: WorkflowTriggerType.MESSAGE_RECEIVED,
    label: "Message received",
    description: "Run after an inbound message lands on the lead thread.",
  },
  {
    value: WorkflowTriggerType.FIT_CHANGED,
    label: "Fit changed",
    description: "Respond when qualification fit changes after evaluation.",
  },
  {
    value: WorkflowTriggerType.TOUR_SCHEDULED,
    label: "Tour scheduled",
    description: "Continue the workflow when a tour is placed on the calendar.",
  },
  {
    value: WorkflowTriggerType.SCREENING_COMPLETED,
    label: "Screening completed",
    description: "Handle the review stage after screening results arrive.",
  },
  {
    value: WorkflowTriggerType.APPLICATION_SENT,
    label: "Application sent",
    description: "Follow through after an application invite is sent.",
  },
  {
    value: WorkflowTriggerType.STALE_THRESHOLD_REACHED,
    label: "Stale threshold reached",
    description: "Run re-engagement or archive logic for stale leads.",
  },
];

export const workflowConditionCatalog: WorkflowCatalogItem<WorkflowConditionType>[] = [
  {
    value: WorkflowConditionType.PROPERTY,
    label: "Property",
    description: "Check the assigned property or property group before continuing.",
  },
  {
    value: WorkflowConditionType.FIT,
    label: "Fit",
    description: "Branch on the lead fit outcome or caution state.",
  },
  {
    value: WorkflowConditionType.CHANNEL_AVAILABILITY,
    label: "Channel availability",
    description: "Verify the lead can be reached on the needed outbound channel.",
  },
  {
    value: WorkflowConditionType.MISSING_FIELDS,
    label: "Missing fields",
    description: "Require certain lead fields or answers before continuing.",
  },
  {
    value: WorkflowConditionType.INACTIVITY_WINDOW,
    label: "Inactivity window",
    description: "Wait for or detect a quiet period with no operator or lead activity.",
  },
  {
    value: WorkflowConditionType.STATUS,
    label: "Status",
    description: "Branch on the current lead status.",
  },
];

export const workflowActionCatalog: WorkflowCatalogItem<WorkflowActionType>[] = [
  {
    value: WorkflowActionType.SEND_TEMPLATE,
    label: "Send template",
    description: "Send an existing message template through the selected channel.",
  },
  {
    value: WorkflowActionType.DRAFT_AI_MESSAGE,
    label: "Draft AI message",
    description: "Create an AI draft for operator review before sending.",
  },
  {
    value: WorkflowActionType.CREATE_TASK,
    label: "Create task",
    description: "Create an operator follow-up task in the workflow queue.",
  },
  {
    value: WorkflowActionType.ASSIGN_LEAD,
    label: "Assign lead",
    description: "Assign the lead to a property or teammate.",
  },
  {
    value: WorkflowActionType.MOVE_STATUS,
    label: "Move status",
    description: "Move the lead into the next workflow status.",
  },
  {
    value: WorkflowActionType.NOTIFY_OPERATOR,
    label: "Notify operator",
    description: "Send an internal notification or note for manual action.",
  },
  {
    value: WorkflowActionType.SCHEDULE_REMINDER,
    label: "Schedule reminder",
    description: "Create a timed reminder step for later follow-up.",
  },
  {
    value: WorkflowActionType.REQUEST_APPROVAL,
    label: "Request approval",
    description: "Pause for an approval-required step before a sensitive action runs.",
  },
];

export type WorkflowBuilderNodeDraft = {
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
};

export type WorkflowBuilderEdgeDraft = {
  branchKey?: string;
  label?: string;
  orderIndex: number;
  sourceNodeOrderIndex: number;
  targetNodeOrderIndex: number;
};

export type WorkflowStarterTemplate = {
  key: string;
  name: string;
  description: string;
  recommendedScope: WorkflowScope;
  sharingVisibility: WorkflowSharingVisibility;
  buildGraph: () => {
    edges: WorkflowBuilderEdgeDraft[];
    nodes: WorkflowBuilderNodeDraft[];
  };
};

function buildApprovalNode(orderIndex: number, positionX: number, positionY: number) {
  return {
    actionType: WorkflowActionType.REQUEST_APPROVAL,
    approvalRequired: true,
    config: {
      reason: "Sensitive workflow step requires approval.",
    },
    name: "Request approval",
    nodeType: WorkflowNodeType.ACTION,
    orderIndex,
    positionX,
    positionY,
  } satisfies WorkflowBuilderNodeDraft;
}

export const workflowStarterTemplates: WorkflowStarterTemplate[] = [
  {
    key: "follow-up",
    name: "Follow-up after inbound message",
    description: "Respond to new inquiries, draft a follow-up, and remind operators when required fields stay missing.",
    recommendedScope: WorkflowScope.WORKSPACE,
    sharingVisibility: WorkflowSharingVisibility.WORKSPACE,
    buildGraph: () => ({
      nodes: [
        {
          name: "Lead created",
          nodeType: WorkflowNodeType.TRIGGER,
          orderIndex: 0,
          positionX: 32,
          positionY: 48,
          triggerType: WorkflowTriggerType.LEAD_CREATED,
        },
        {
          conditionType: WorkflowConditionType.MISSING_FIELDS,
          config: {
            requiredFields: ["moveInDate", "monthlyBudget", "stayLengthMonths"],
          },
          name: "Missing qualification fields",
          nodeType: WorkflowNodeType.CONDITION,
          orderIndex: 1,
          positionX: 260,
          positionY: 48,
        },
        {
          actionType: WorkflowActionType.DRAFT_AI_MESSAGE,
          config: {
            objective: "Draft a missing-info follow-up for the operator to review.",
          },
          name: "Draft AI follow-up",
          nodeType: WorkflowNodeType.ACTION,
          orderIndex: 2,
          positionX: 488,
          positionY: 24,
        },
        {
          actionType: WorkflowActionType.SCHEDULE_REMINDER,
          config: {
            afterHours: 24,
          },
          name: "Reminder after 24h",
          nodeType: WorkflowNodeType.ACTION,
          orderIndex: 3,
          positionX: 488,
          positionY: 140,
        },
      ],
      edges: [
        {
          orderIndex: 0,
          sourceNodeOrderIndex: 0,
          targetNodeOrderIndex: 1,
        },
        {
          branchKey: "missing",
          label: "Missing info",
          orderIndex: 1,
          sourceNodeOrderIndex: 1,
          targetNodeOrderIndex: 2,
        },
        {
          branchKey: "missing",
          label: "Wait",
          orderIndex: 2,
          sourceNodeOrderIndex: 2,
          targetNodeOrderIndex: 3,
        },
      ],
    }),
  },
  {
    key: "reminder",
    name: "Tour reminder and operator notification",
    description: "Send a reminder sequence for scheduled tours and notify the operator if the lead still needs manual confirmation.",
    recommendedScope: WorkflowScope.WORKSPACE,
    sharingVisibility: WorkflowSharingVisibility.WORKSPACE,
    buildGraph: () => ({
      nodes: [
        {
          name: "Tour scheduled",
          nodeType: WorkflowNodeType.TRIGGER,
          orderIndex: 0,
          positionX: 32,
          positionY: 64,
          triggerType: WorkflowTriggerType.TOUR_SCHEDULED,
        },
        {
          actionType: WorkflowActionType.SEND_TEMPLATE,
          config: {
            templateType: "TOUR_CONFIRMATION",
          },
          name: "Send reminder template",
          nodeType: WorkflowNodeType.ACTION,
          orderIndex: 1,
          positionX: 268,
          positionY: 32,
        },
        {
          conditionType: WorkflowConditionType.STATUS,
          config: {
            allowedStatuses: [LeadStatus.TOUR_SCHEDULED],
          },
          name: "Still tour scheduled",
          nodeType: WorkflowNodeType.CONDITION,
          orderIndex: 2,
          positionX: 500,
          positionY: 32,
        },
        {
          actionType: WorkflowActionType.NOTIFY_OPERATOR,
          config: {
            channel: "internal_note",
            priority: "high",
          },
          name: "Notify operator",
          nodeType: WorkflowNodeType.ACTION,
          orderIndex: 3,
          positionX: 736,
          positionY: 32,
        },
      ],
      edges: [
        { orderIndex: 0, sourceNodeOrderIndex: 0, targetNodeOrderIndex: 1 },
        { orderIndex: 1, sourceNodeOrderIndex: 1, targetNodeOrderIndex: 2 },
        {
          branchKey: "yes",
          label: "Still pending",
          orderIndex: 2,
          sourceNodeOrderIndex: 2,
          targetNodeOrderIndex: 3,
        },
      ],
    }),
  },
  {
    key: "stale-lead",
    name: "Stale lead re-engagement with approval",
    description: "Re-engage stale leads, escalate to approval for sensitive declines, and keep the workflow library shareable across an org.",
    recommendedScope: WorkflowScope.ORG_LIBRARY,
    sharingVisibility: WorkflowSharingVisibility.ORG_LIBRARY,
    buildGraph: () => ({
      nodes: [
        {
          name: "Stale threshold reached",
          nodeType: WorkflowNodeType.TRIGGER,
          orderIndex: 0,
          positionX: 32,
          positionY: 96,
          triggerType: WorkflowTriggerType.STALE_THRESHOLD_REACHED,
        },
        {
          conditionType: WorkflowConditionType.FIT,
          config: {
            allowedFits: [QualificationFit.PASS, QualificationFit.CAUTION],
          },
          name: "Still worth re-engaging",
          nodeType: WorkflowNodeType.CONDITION,
          orderIndex: 1,
          positionX: 260,
          positionY: 96,
        },
        {
          actionType: WorkflowActionType.DRAFT_AI_MESSAGE,
          config: {
            objective: "Draft a re-engagement message for a stale shared-housing lead.",
          },
          name: "Draft AI re-engagement",
          nodeType: WorkflowNodeType.ACTION,
          orderIndex: 2,
          positionX: 500,
          positionY: 32,
        },
        buildApprovalNode(3, 500, 168),
        {
          actionType: WorkflowActionType.MOVE_STATUS,
          approvalRequired: true,
          config: {
            toStatus: LeadStatus.DECLINED,
            reason: "stale-lead workflow archive decision",
          },
          name: "Move to declined",
          nodeType: WorkflowNodeType.ACTION,
          orderIndex: 4,
          positionX: 736,
          positionY: 168,
        },
      ],
      edges: [
        { orderIndex: 0, sourceNodeOrderIndex: 0, targetNodeOrderIndex: 1 },
        {
          branchKey: "yes",
          label: "Re-engage",
          orderIndex: 1,
          sourceNodeOrderIndex: 1,
          targetNodeOrderIndex: 2,
        },
        {
          branchKey: "no",
          label: "Needs approval",
          orderIndex: 2,
          sourceNodeOrderIndex: 1,
          targetNodeOrderIndex: 3,
        },
        {
          branchKey: "approved",
          label: "Approve decline",
          orderIndex: 3,
          sourceNodeOrderIndex: 3,
          targetNodeOrderIndex: 4,
        },
      ],
    }),
  },
];

export function formatWorkflowScopeLabel(scope: WorkflowScope) {
  switch (scope) {
    case WorkflowScope.PROPERTY:
      return "Property override";
    case WorkflowScope.ORG_LIBRARY:
      return "Org library";
    default:
      return "Workspace";
  }
}

export function formatWorkflowStatusLabel(status: WorkflowStatus) {
  return status.toLowerCase().replace(/^./, (value) => value.toUpperCase());
}

export function formatWorkflowSharingVisibilityLabel(visibility: WorkflowSharingVisibility) {
  switch (visibility) {
    case WorkflowSharingVisibility.ORG_LIBRARY:
      return "Org shared";
    case WorkflowSharingVisibility.WORKSPACE:
      return "Workspace shared";
    default:
      return "Private";
  }
}

export function doesWorkflowNodeRequireApproval(params: {
  actionType?: WorkflowActionType | null;
  triggerType?: WorkflowTriggerType | null;
  config?: Record<string, unknown> | null;
}) {
  if (params.actionType === WorkflowActionType.REQUEST_APPROVAL) {
    return true;
  }

  if (params.triggerType === WorkflowTriggerType.SCREENING_COMPLETED) {
    return true;
  }

  if (
    params.actionType === WorkflowActionType.MOVE_STATUS &&
    params.config?.toStatus === LeadStatus.DECLINED
  ) {
    return true;
  }

  return false;
}

export function getWorkflowStarterTemplate(templateKey: string) {
  return workflowStarterTemplates.find((template) => template.key === templateKey) ?? null;
}
