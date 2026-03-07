import assert from "node:assert/strict";
import test from "node:test";
import {
  getLeadWorkflowErrorUserMessage,
  isLeadWorkflowError,
  LeadWorkflowError,
  parseLeadWorkflowErrorCode,
} from "./lead-workflow-errors";

test("isLeadWorkflowError returns true for LeadWorkflowError instances", () => {
  const workflowError = new LeadWorkflowError(
    "LEAD_NOT_FOUND",
    "Lead was not found.",
  );

  assert.equal(isLeadWorkflowError(workflowError), true);
});

test("isLeadWorkflowError returns false for generic errors", () => {
  const genericError = new Error("Generic runtime failure.");

  assert.equal(isLeadWorkflowError(genericError), false);
});

test("parseLeadWorkflowErrorCode returns the code for valid values", () => {
  const parsedCode = parseLeadWorkflowErrorCode("SCHEDULING_LINK_REQUIRED");

  assert.equal(parsedCode, "SCHEDULING_LINK_REQUIRED");
});

test("parseLeadWorkflowErrorCode returns null for unknown values", () => {
  const parsedCode = parseLeadWorkflowErrorCode("UNKNOWN_ERROR");

  assert.equal(parsedCode, null);
});

test("getLeadWorkflowErrorUserMessage returns a user-safe message for each known code", () => {
  const knownCodes = [
    "LEAD_NOT_FOUND",
    "INVALID_STATUS_TRANSITION",
    "ACTION_NOT_ALLOWED_FOR_MISMATCH",
    "ACTION_BLOCKED_MISSING_INFO",
    "ACTION_REQUIRES_PROPERTY",
    "ACTION_REQUIRES_ACTIVE_QUESTION_SET",
    "ACTION_REQUIRES_CONTACT_CHANNEL",
    "SCHEDULING_LINK_REQUIRED",
    "MISSING_INFO_PROMPT_THROTTLED",
    "ACTION_BLOCKED_INACTIVE_LEAD",
    "ACTION_BLOCKED_OPT_OUT",
    "ACTION_BLOCKED_CHANNEL_INVALID",
    "ACTION_BLOCKED_DAILY_SEND_CAP",
    "ACTION_BLOCKED_DUPLICATE_TEMPLATE",
    "TEMPLATE_UNRESOLVED_TOKENS",
    "ACTION_REQUIRES_QUALIFIED_LEAD",
    "OVERRIDE_REASON_REQUIRED",
    "OVERRIDE_STATUS_REQUIRED",
    "OVERRIDE_FIT_REQUIRED",
    "DECLINE_REASON_REQUIRED",
    "DECLINE_REASON_INVALID",
    "ACTION_FORBIDDEN_BY_ROLE",
    "DUPLICATE_CANDIDATE_REQUIRED",
    "DUPLICATE_CANDIDATE_INVALID",
    "DUPLICATE_CANDIDATE_NOT_FOUND",
    "PROPERTY_SELECTION_REQUIRED",
    "PROPERTY_NOT_FOUND",
  ] as const;

  for (const workflowErrorCode of knownCodes) {
    const userFacingMessage = getLeadWorkflowErrorUserMessage(
      workflowErrorCode,
    );

    assert.equal(typeof userFacingMessage, "string");
    assert.equal(userFacingMessage.length > 0, true);
  }
});
