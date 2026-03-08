import assert from "node:assert/strict";
import test from "node:test";
import {
  WorkspaceCapability,
  WorkspacePlanStatus,
  WorkspacePlanType,
} from "@/generated/prisma/client";
import {
  formatWorkspaceCapabilityLabel,
  getMinimumWorkspacePlanForCapability,
  getLockedCapabilitiesForWorkspacePlan,
  formatWorkspacePlanLabel,
  formatWorkspacePlanStatusLabel,
  getDefaultCapabilitiesForWorkspacePlan,
  resolveDisabledCapabilitiesForWorkspacePlanChange,
  resolveEnabledCapabilitiesForWorkspacePlanChange,
  workspaceHasCapability,
} from "@/lib/workspace-plan";

test("getDefaultCapabilitiesForWorkspacePlan returns the personal baseline", () => {
  assert.deepEqual(getDefaultCapabilitiesForWorkspacePlan(WorkspacePlanType.PERSONAL), [
    WorkspaceCapability.CORE_CRM,
    WorkspaceCapability.PROPERTY_PIPELINE,
    WorkspaceCapability.MESSAGING,
    WorkspaceCapability.INTEGRATIONS,
  ]);
});

test("getDefaultCapabilitiesForWorkspacePlan includes org member tooling for org plans", () => {
  assert.deepEqual(getDefaultCapabilitiesForWorkspacePlan(WorkspacePlanType.ORG), [
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
  ]);
});

test("workspace plan formatting helpers return operator-friendly labels", () => {
  assert.equal(formatWorkspacePlanLabel(WorkspacePlanType.ORG), "Org");
  assert.equal(formatWorkspacePlanStatusLabel(WorkspacePlanStatus.PAST_DUE), "Past due");
  assert.equal(formatWorkspaceCapabilityLabel(WorkspaceCapability.CALENDAR_SYNC), "Calendar sync");
});

test("getLockedCapabilitiesForWorkspacePlan exposes org-only capabilities on personal plans", () => {
  assert.deepEqual(getLockedCapabilitiesForWorkspacePlan(WorkspacePlanType.PERSONAL), [
    WorkspaceCapability.ORG_MEMBERS,
    WorkspaceCapability.ADVANCED_AUTOMATIONS,
    WorkspaceCapability.ADVANCED_ANALYTICS,
    WorkspaceCapability.AI_ASSIST,
    WorkspaceCapability.SCREENING,
    WorkspaceCapability.CALENDAR_SYNC,
  ]);
});

test("workspaceHasCapability checks enabled capability membership", () => {
  assert.equal(
    workspaceHasCapability(
      getDefaultCapabilitiesForWorkspacePlan(WorkspacePlanType.PERSONAL),
      WorkspaceCapability.ORG_MEMBERS,
    ),
    false,
  );
  assert.equal(
    workspaceHasCapability(
      getDefaultCapabilitiesForWorkspacePlan(WorkspacePlanType.ORG),
      WorkspaceCapability.ORG_MEMBERS,
    ),
    true,
  );
});

test("getMinimumWorkspacePlanForCapability marks org-only features correctly", () => {
  assert.equal(
    getMinimumWorkspacePlanForCapability(WorkspaceCapability.ORG_MEMBERS),
    WorkspacePlanType.ORG,
  );
  assert.equal(
    getMinimumWorkspacePlanForCapability(WorkspaceCapability.MESSAGING),
    WorkspacePlanType.PERSONAL,
  );
});

test("resolveEnabledCapabilitiesForWorkspacePlanChange drops unsupported capabilities on downgrade", () => {
  assert.deepEqual(
    resolveEnabledCapabilitiesForWorkspacePlanChange({
      currentEnabledCapabilities: getDefaultCapabilitiesForWorkspacePlan(WorkspacePlanType.ORG),
      targetWorkspacePlanType: WorkspacePlanType.PERSONAL,
    }),
    getDefaultCapabilitiesForWorkspacePlan(WorkspacePlanType.PERSONAL),
  );
});

test("resolveDisabledCapabilitiesForWorkspacePlanChange reports what a downgrade turns off", () => {
  assert.deepEqual(
    resolveDisabledCapabilitiesForWorkspacePlanChange({
      currentEnabledCapabilities: getDefaultCapabilitiesForWorkspacePlan(WorkspacePlanType.ORG),
      targetWorkspacePlanType: WorkspacePlanType.PERSONAL,
    }),
    [
      WorkspaceCapability.ORG_MEMBERS,
      WorkspaceCapability.ADVANCED_AUTOMATIONS,
      WorkspaceCapability.ADVANCED_ANALYTICS,
      WorkspaceCapability.AI_ASSIST,
      WorkspaceCapability.SCREENING,
      WorkspaceCapability.CALENDAR_SYNC,
    ],
  );
});