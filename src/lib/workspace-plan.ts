import {
  WorkspaceCapability,
  WorkspacePlanStatus,
  WorkspacePlanType,
} from "@/generated/prisma/client";

const workspaceCapabilityLabels: Record<WorkspaceCapability, string> = {
  [WorkspaceCapability.ADVANCED_ANALYTICS]: "Advanced analytics",
  [WorkspaceCapability.ADVANCED_AUTOMATIONS]: "Advanced automations",
  [WorkspaceCapability.AI_ASSIST]: "AI assist",
  [WorkspaceCapability.CALENDAR_SYNC]: "Calendar sync",
  [WorkspaceCapability.CORE_CRM]: "Core CRM",
  [WorkspaceCapability.INTEGRATIONS]: "Integrations",
  [WorkspaceCapability.MESSAGING]: "Messaging",
  [WorkspaceCapability.ORG_MEMBERS]: "Org members",
  [WorkspaceCapability.PROPERTY_PIPELINE]: "Property pipeline",
  [WorkspaceCapability.SCREENING]: "Screening",
};

const defaultCapabilitiesByWorkspacePlanType: Record<
  WorkspacePlanType,
  WorkspaceCapability[]
> = {
  [WorkspacePlanType.ORG]: [
    WorkspaceCapability.CORE_CRM,
    WorkspaceCapability.PROPERTY_PIPELINE,
    WorkspaceCapability.MESSAGING,
    WorkspaceCapability.INTEGRATIONS,
    WorkspaceCapability.ORG_MEMBERS,
    WorkspaceCapability.ADVANCED_AUTOMATIONS,
    WorkspaceCapability.ADVANCED_ANALYTICS,
    WorkspaceCapability.AI_ASSIST,
    WorkspaceCapability.SCREENING,
    WorkspaceCapability.CALENDAR_SYNC,
  ],
  [WorkspacePlanType.PERSONAL]: [
    WorkspaceCapability.CORE_CRM,
    WorkspaceCapability.PROPERTY_PIPELINE,
    WorkspaceCapability.MESSAGING,
    WorkspaceCapability.INTEGRATIONS,
  ],
};

const workspacePlanLabels: Record<WorkspacePlanType, string> = {
  [WorkspacePlanType.ORG]: "Org",
  [WorkspacePlanType.PERSONAL]: "Personal",
};

const workspacePlanStatusLabels: Record<WorkspacePlanStatus, string> = {
  [WorkspacePlanStatus.ACTIVE]: "Active",
  [WorkspacePlanStatus.CANCELED]: "Canceled",
  [WorkspacePlanStatus.PAST_DUE]: "Past due",
  [WorkspacePlanStatus.TRIAL]: "Trial",
};

const workspacePlanUsageLimits: Record<
  WorkspacePlanType,
  {
    memberships: number | null;
    messageTemplates: number | null;
    properties: number | null;
  }
> = {
  [WorkspacePlanType.ORG]: {
    memberships: null,
    messageTemplates: null,
    properties: null,
  },
  [WorkspacePlanType.PERSONAL]: {
    memberships: 1,
    messageTemplates: 10,
    properties: 1,
  },
};

const allWorkspaceCapabilities = Object.values(WorkspaceCapability);

export function formatWorkspaceCapabilityLabel(workspaceCapability: WorkspaceCapability) {
  return workspaceCapabilityLabels[workspaceCapability];
}

export function formatWorkspacePlanLabel(workspacePlanType: WorkspacePlanType) {
  return workspacePlanLabels[workspacePlanType];
}

export function formatWorkspacePlanStatusLabel(workspacePlanStatus: WorkspacePlanStatus) {
  return workspacePlanStatusLabels[workspacePlanStatus];
}

export function getDefaultCapabilitiesForWorkspacePlan(
  workspacePlanType: WorkspacePlanType,
) {
  return [...defaultCapabilitiesByWorkspacePlanType[workspacePlanType]];
}

export function getLockedCapabilitiesForWorkspacePlan(workspacePlanType: WorkspacePlanType) {
  const includedCapabilities = new Set(getDefaultCapabilitiesForWorkspacePlan(workspacePlanType));

  return allWorkspaceCapabilities.filter(
    (workspaceCapability) => !includedCapabilities.has(workspaceCapability),
  );
}

export function workspaceHasCapability(
  enabledCapabilities: WorkspaceCapability[],
  requiredCapability: WorkspaceCapability,
) {
  return enabledCapabilities.includes(requiredCapability);
}

export function getMinimumWorkspacePlanForCapability(
  requiredCapability: WorkspaceCapability,
) {
  switch (requiredCapability) {
    case WorkspaceCapability.ORG_MEMBERS:
    case WorkspaceCapability.ADVANCED_AUTOMATIONS:
    case WorkspaceCapability.ADVANCED_ANALYTICS:
    case WorkspaceCapability.AI_ASSIST:
    case WorkspaceCapability.SCREENING:
    case WorkspaceCapability.CALENDAR_SYNC:
      return WorkspacePlanType.ORG;
    default:
      return WorkspacePlanType.PERSONAL;
  }
}

export function resolveEnabledCapabilitiesForWorkspacePlanChange(params: {
  currentEnabledCapabilities: WorkspaceCapability[];
  targetWorkspacePlanType: WorkspacePlanType;
}) {
  const targetPlanCapabilities = getDefaultCapabilitiesForWorkspacePlan(params.targetWorkspacePlanType);

  if (params.targetWorkspacePlanType === WorkspacePlanType.ORG) {
    return targetPlanCapabilities;
  }

  return params.currentEnabledCapabilities.filter((workspaceCapability) =>
    targetPlanCapabilities.includes(workspaceCapability),
  );
}

export function resolveDisabledCapabilitiesForWorkspacePlanChange(params: {
  currentEnabledCapabilities: WorkspaceCapability[];
  targetWorkspacePlanType: WorkspacePlanType;
}) {
  const nextEnabledCapabilities = new Set(
    resolveEnabledCapabilitiesForWorkspacePlanChange(params),
  );

  return params.currentEnabledCapabilities.filter(
    (workspaceCapability) => !nextEnabledCapabilities.has(workspaceCapability),
  );
}

export function getWorkspacePlanUsageLimits(workspacePlanType: WorkspacePlanType) {
  return workspacePlanUsageLimits[workspacePlanType];
}