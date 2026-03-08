import assert from "node:assert/strict";
import test from "node:test";
import {
  WorkspaceCapability,
  WorkspacePlanStatus,
  WorkspacePlanType,
} from "@/generated/prisma/client";
import {
  formatWorkspaceCapabilityLabel,
  formatWorkspacePlanLabel,
  formatWorkspacePlanStatusLabel,
  getDefaultCapabilitiesForWorkspacePlan,
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
  ]);
});

test("workspace plan formatting helpers return operator-friendly labels", () => {
  assert.equal(formatWorkspacePlanLabel(WorkspacePlanType.ORG), "Org");
  assert.equal(formatWorkspacePlanStatusLabel(WorkspacePlanStatus.PAST_DUE), "Past due");
  assert.equal(formatWorkspaceCapabilityLabel(WorkspaceCapability.CALENDAR_SYNC), "Calendar sync");
});