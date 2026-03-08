export type LeadWorkflowErrorCode =
  | "LEAD_NOT_FOUND"
  | "INVALID_STATUS_TRANSITION"
  | "ACTION_NOT_ALLOWED_FOR_MISMATCH"
  | "ACTION_BLOCKED_MISSING_INFO"
  | "ACTION_REQUIRES_PROPERTY"
  | "ACTION_REQUIRES_ACTIVE_QUESTION_SET"
  | "ACTION_REQUIRES_CONTACT_CHANNEL"
  | "SCHEDULING_LINK_REQUIRED"
  | "MISSING_INFO_PROMPT_THROTTLED"
  | "ACTION_BLOCKED_INACTIVE_LEAD"
  | "ACTION_BLOCKED_OPT_OUT"
  | "ACTION_BLOCKED_QUIET_HOURS"
  | "ACTION_BLOCKED_CHANNEL_INVALID"
  | "ACTION_BLOCKED_DAILY_SEND_CAP"
  | "ACTION_BLOCKED_DUPLICATE_TEMPLATE"
  | "TEMPLATE_UNRESOLVED_TOKENS"
  | "ACTION_REQUIRES_QUALIFIED_LEAD"
  | "OVERRIDE_REASON_REQUIRED"
  | "OVERRIDE_STATUS_REQUIRED"
  | "OVERRIDE_FIT_REQUIRED"
  | "DECLINE_REASON_REQUIRED"
  | "DECLINE_REASON_INVALID"
  | "ACTION_FORBIDDEN_BY_ROLE"
  | "DUPLICATE_CANDIDATE_REQUIRED"
  | "DUPLICATE_CANDIDATE_INVALID"
  | "DUPLICATE_CANDIDATE_NOT_FOUND"
  | "PROPERTY_SELECTION_REQUIRED"
  | "PROPERTY_NOT_FOUND"
  | "PROPERTY_NOT_ACTIVE";

const userFacingMessageByWorkflowErrorCode: Record<
  LeadWorkflowErrorCode,
  string
> = {
  LEAD_NOT_FOUND: "That lead could not be found in your workspace.",
  INVALID_STATUS_TRANSITION:
    "This action is blocked because the lead status cannot transition that way.",
  ACTION_NOT_ALLOWED_FOR_MISMATCH:
    "This lead currently has a mismatch and cannot be advanced.",
  ACTION_BLOCKED_MISSING_INFO:
    "This lead is missing required information and cannot be advanced yet.",
  ACTION_REQUIRES_PROPERTY:
    "Assign a property before using this action.",
  ACTION_REQUIRES_ACTIVE_QUESTION_SET:
    "Configure at least one active qualification question for this property before using automation.",
  ACTION_REQUIRES_CONTACT_CHANNEL:
    "Add an email or SMS contact method before running this automated action.",
  SCHEDULING_LINK_REQUIRED:
    "Add a scheduling link to the property before sending a tour handoff.",
  MISSING_INFO_PROMPT_THROTTLED:
    "A missing-info prompt was sent recently. Wait for the throttle window before sending another.",
  ACTION_BLOCKED_INACTIVE_LEAD:
    "This lead is not active for automated actions.",
  ACTION_BLOCKED_OPT_OUT:
    "This lead opted out of automated messaging.",
  ACTION_BLOCKED_QUIET_HOURS:
    "Automated messaging is paused during the active quiet-hours window.",
  ACTION_BLOCKED_CHANNEL_INVALID:
    "No valid outbound channel is available for this action.",
  ACTION_BLOCKED_DAILY_SEND_CAP:
    "This lead has reached today's automated send cap.",
  ACTION_BLOCKED_DUPLICATE_TEMPLATE:
    "A similar automated message was already sent recently.",
  TEMPLATE_UNRESOLVED_TOKENS:
    "Template rendering failed because some variables are unresolved.",
  ACTION_REQUIRES_QUALIFIED_LEAD:
    "Only qualified leads can receive this scheduling handoff.",
  OVERRIDE_REASON_REQUIRED:
    "A reason is required before applying a manual override.",
  OVERRIDE_STATUS_REQUIRED:
    "Select an override status before submitting.",
  OVERRIDE_FIT_REQUIRED:
    "Select an override fit result before submitting.",
  DECLINE_REASON_REQUIRED: "Select a structured decline reason before declining.",
  DECLINE_REASON_INVALID: "The selected decline reason is invalid.",
  ACTION_FORBIDDEN_BY_ROLE:
    "Your role does not allow this lead action.",
  DUPLICATE_CANDIDATE_REQUIRED:
    "Select a duplicate candidate before confirming.",
  DUPLICATE_CANDIDATE_INVALID:
    "The selected duplicate candidate is invalid.",
  DUPLICATE_CANDIDATE_NOT_FOUND:
    "The duplicate candidate could not be found in this workspace.",
  PROPERTY_SELECTION_REQUIRED: "Choose a property before submitting the assignment.",
  PROPERTY_NOT_FOUND: "The selected property was not found in this workspace.",
  PROPERTY_NOT_ACTIVE:
    "Only active properties can receive new lead and workflow actions.",
};

export class LeadWorkflowError extends Error {
  readonly code: LeadWorkflowErrorCode;

  constructor(code: LeadWorkflowErrorCode, message: string) {
    super(message);
    this.name = "LeadWorkflowError";
    this.code = code;
  }
}

export function isLeadWorkflowError(error: unknown): error is LeadWorkflowError {
  return error instanceof LeadWorkflowError;
}

export function getLeadWorkflowErrorUserMessage(code: LeadWorkflowErrorCode) {
  return userFacingMessageByWorkflowErrorCode[code];
}

export function parseLeadWorkflowErrorCode(
  value: string | null | undefined,
): LeadWorkflowErrorCode | null {
  if (!value) {
    return null;
  }

  if (value in userFacingMessageByWorkflowErrorCode) {
    return value as LeadWorkflowErrorCode;
  }

  return null;
}
