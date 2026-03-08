import assert from "node:assert/strict";
import test from "node:test";
import { LeadStatus, WorkflowActionType, WorkflowTriggerType } from "@/generated/prisma/client";
import {
  doesWorkflowNodeRequireApproval,
  getWorkflowStarterTemplate,
  workflowActionCatalog,
  workflowConditionCatalog,
  workflowTriggerCatalog,
} from "@/lib/workflows";

test("workflow catalogs cover the expected phase 17 items", () => {
  assert.equal(workflowTriggerCatalog.length, 7);
  assert.equal(workflowConditionCatalog.length, 6);
  assert.equal(workflowActionCatalog.length, 8);
});

test("stale lead starter template includes an approval path", () => {
  const starterTemplate = getWorkflowStarterTemplate("stale-lead");

  assert.ok(starterTemplate);

  const graph = starterTemplate?.buildGraph();
  const approvalNode = graph?.nodes.find((node) => node.approvalRequired);

  assert.ok(approvalNode);
  assert.equal(approvalNode?.actionType, WorkflowActionType.REQUEST_APPROVAL);
});

test("workflow approval helper flags screening and decline steps", () => {
  assert.equal(
    doesWorkflowNodeRequireApproval({
      triggerType: WorkflowTriggerType.SCREENING_COMPLETED,
    }),
    true,
  );
  assert.equal(
    doesWorkflowNodeRequireApproval({
      actionType: WorkflowActionType.MOVE_STATUS,
      config: {
        toStatus: LeadStatus.DECLINED,
      },
    }),
    true,
  );
});
