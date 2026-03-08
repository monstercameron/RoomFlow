import assert from "node:assert/strict";
import test from "node:test";

import {
  applyWorkflow1IntentSearchParams,
  buildWorkflow1Path,
  getWorkflow1Intent,
  getWorkflow1IntentFromPath,
  getWorkflow1PasswordState,
  getWorkflow1WorkspaceBootstrapDecision,
  validateWorkflow1SignupFields,
} from "@/lib/workflow1";

test("getWorkflow1Intent normalizes recognized Workflow 1 params", () => {
  assert.deepEqual(
    getWorkflow1Intent({
      inviteToken: " invite-token-123 ",
      plan: "ORG",
      source: " ai-tool ",
      utmCampaign: " launch-week ",
    }),
    {
      inviteToken: "invite-token-123",
      plan: "org",
      source: "ai-tool",
      utmCampaign: "launch-week",
    },
  );
});

test("applyWorkflow1IntentSearchParams appends preserved workflow context", () => {
  const searchParams = new URLSearchParams();

  applyWorkflow1IntentSearchParams(searchParams, {
    inviteToken: "invite-token-123",
    plan: "personal",
    source: "ai-tool",
    utmCampaign: "launch-week",
  });

  assert.equal(
    searchParams.toString(),
    "plan=personal&invite=invite-token-123&source=ai-tool&utm_campaign=launch-week",
  );
});

test("buildWorkflow1Path appends Workflow 1 intent to the callback path", () => {
  assert.equal(
    buildWorkflow1Path("/onboarding", {
      inviteToken: "invite-token-123",
      plan: "org",
      source: "ai-tool",
      utmCampaign: "launch-week",
    }),
    "/onboarding?plan=org&invite=invite-token-123&source=ai-tool&utm_campaign=launch-week",
  );
});

test("getWorkflow1IntentFromPath reads invite intent from direct invite callback routes", () => {
  assert.deepEqual(getWorkflow1IntentFromPath("/invite/invite-token-123?source=ai-tool"), {
    inviteToken: "invite-token-123",
    plan: null,
    source: "ai-tool",
    utmCampaign: null,
  });
});

test("getWorkflow1WorkspaceBootstrapDecision reads nested auth callback state", () => {
  assert.deepEqual(
    getWorkflow1WorkspaceBootstrapDecision(
      "/signup?callbackURL=%2Fonboarding%3Fplan%3Dorg&invite=invite-token-123&utm_campaign=launch-week",
    ),
    {
      plan: "org",
      shouldSkipWorkspaceCreation: true,
      workflow1Intent: {
        inviteToken: "invite-token-123",
        plan: "org",
        source: null,
        utmCampaign: "launch-week",
      },
    },
  );
});

test("getWorkflow1PasswordState enforces length and character-class rules", () => {
  assert.deepEqual(getWorkflow1PasswordState("short"), {
    categoryCount: 1,
    hasLowercase: true,
    hasNumber: false,
    hasSymbol: false,
    hasUppercase: false,
    isValid: false,
    meetsLength: false,
    strengthLabel: "Almost there",
  });

  assert.deepEqual(getWorkflow1PasswordState("Roomflow123!"), {
    categoryCount: 4,
    hasLowercase: true,
    hasNumber: true,
    hasSymbol: true,
    hasUppercase: true,
    isValid: true,
    meetsLength: true,
    strengthLabel: "Strong",
  });
});

test("validateWorkflow1SignupFields returns field-level guidance", () => {
  assert.deepEqual(
    validateWorkflow1SignupFields({
      confirmPassword: "Mismatch123!",
      email: "bad-email",
      name: "A",
      password: "short",
    }),
    {
      confirmPassword: "Passwords do not match yet.",
      email: "Enter a valid email address.",
      name: "Enter the operator name for this workspace.",
      password: "Use at least 10 characters and any 2 of uppercase, lowercase, number, or symbol.",
    },
  );
});