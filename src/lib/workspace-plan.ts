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