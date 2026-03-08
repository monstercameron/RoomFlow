import assert from "node:assert/strict";
import test from "node:test";
import {
  AuditActorType,
  RuleCategory,
  RuleMode,
  RuleSeverity,
} from "@/generated/prisma/client";
import type { Workflow3HouseRulesActionDependencies } from "@/lib/workflow3-house-rules";

function getWorkflow3HouseRulesModule() {
  process.env.DATABASE_URL ??=
    "postgresql://postgres:postgres@localhost:5432/template1";

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("./workflow3-house-rules") as typeof import("@/lib/workflow3-house-rules");
}

function createDependencies(
  overrides: Partial<Workflow3HouseRulesActionDependencies> = {},
): Workflow3HouseRulesActionDependencies {
  return {
    createAuditEvent: async () => undefined,
    findFirstPropertyForWorkspace: async () => ({
      id: "property-1",
      name: "Maple House",
    }),
    getCurrentWorkspaceMembership: async () => ({
      userId: "user-1",
      workspaceId: "workspace-1",
    }),
    redirect: () => undefined as never,
    replacePropertyRules: async () => undefined,
    revalidatePath: () => undefined,
    ...overrides,
  };
}

function createValidWorkflow3FormData() {
  const formData = new FormData();
  formData.set("smokingEnabled", "1");
  formData.set("smokingValue", "not_allowed");
  formData.set("smokingSeverity", "blocking");
  formData.set("petsEnabled", "1");
  formData.set("petsValue", "case_by_case");
  formData.set("petsSeverity", "warning");
  formData.set("customRuleCount", "0");

  return formData;
}

test("buildHouseRulesOnboardingRetryPath preserves structured and custom drafts", () => {
  const { buildHouseRulesOnboardingRetryPath } = getWorkflow3HouseRulesModule();
  const formData = createValidWorkflow3FormData();
  formData.set("quietHoursEnabled", "1");
  formData.set("quietHoursValue", "quiet_household");
  formData.set("quietHoursSeverity", "informational");
  formData.set("customRuleCount", "1");
  formData.set("customTitle-0", "No parties after midnight");
  formData.set(
    "customDescription-0",
    "Keep shared spaces quiet once neighbors are asleep.",
  );
  formData.set("customSeverity-0", "warning");

  const retryPath = buildHouseRulesOnboardingRetryPath(
    formData,
    "Choose a setting for parking.",
  );

  assert.match(retryPath, /^\/onboarding\/house-rules\?/);

  const searchParams = new URLSearchParams(retryPath.split("?")[1]);

  assert.equal(searchParams.get("error"), "Choose a setting for parking.");
  assert.equal(searchParams.get("smokingEnabled"), "1");
  assert.equal(searchParams.get("smokingValue"), "not_allowed");
  assert.equal(searchParams.get("quietHoursSeverity"), "informational");
  assert.equal(searchParams.get("customRuleCount"), "1");
  assert.equal(searchParams.get("customTitle-0"), "No parties after midnight");
});

test("handleSaveHouseRulesOnboardingAction validates rule and custom-rule requirements", async () => {
  const { handleSaveHouseRulesOnboardingAction } = getWorkflow3HouseRulesModule();

  await assert.rejects(
    handleSaveHouseRulesOnboardingAction(new FormData(), createDependencies()),
    /Add at least one house rule or custom expectation/,
  );

  const missingSelectionFormData = new FormData();
  missingSelectionFormData.set("smokingEnabled", "1");
  missingSelectionFormData.set("smokingSeverity", "blocking");
  missingSelectionFormData.set("customRuleCount", "0");

  await assert.rejects(
    handleSaveHouseRulesOnboardingAction(
      missingSelectionFormData,
      createDependencies(),
    ),
    /Choose a setting for smoking/,
  );

  const incompleteCustomRuleFormData = new FormData();
  incompleteCustomRuleFormData.set("customRuleCount", "1");
  incompleteCustomRuleFormData.set("customTitle-0", "Quiet kitchen cleanup");
  incompleteCustomRuleFormData.set("customSeverity-0", "warning");

  await assert.rejects(
    handleSaveHouseRulesOnboardingAction(
      incompleteCustomRuleFormData,
      createDependencies(),
    ),
    /Please complete each custom rule before saving/,
  );
});

test("handleSaveHouseRulesOnboardingAction replaces rules, audits completion, prepares starter questions, and redirects", async () => {
  const { handleSaveHouseRulesOnboardingAction } = getWorkflow3HouseRulesModule();
  const replacedRuleSets: Array<unknown> = [];
  const auditEvents: Array<unknown> = [];
  const revalidatedPaths: string[] = [];
  let redirectPath: string | null = null;

  const formData = createValidWorkflow3FormData();
  formData.set("minimumStayEnabled", "1");
  formData.set("minimumStayValue", "three_months_plus");
  formData.set("minimumStaySeverity", "warning");
  formData.set("customRuleCount", "1");
  formData.set("customTitle-0", "Night-shift friendly");
  formData.set(
    "customDescription-0",
    "Prospects should be comfortable with a roommate who works overnight shifts.",
  );
  formData.set("customSeverity-0", "informational");

  await handleSaveHouseRulesOnboardingAction(
    formData,
    createDependencies({
      createAuditEvent: async (input) => {
        auditEvents.push(input);
      },
      redirect: (path) => {
        redirectPath = path;
        return undefined as never;
      },
      replacePropertyRules: async (input) => {
        replacedRuleSets.push(input);
      },
      revalidatePath: (path) => {
        revalidatedPaths.push(path);
      },
    }),
  );

  assert.deepEqual(replacedRuleSets, [
    {
      propertyId: "property-1",
      rules: [
        {
          active: true,
          autoDecline: true,
          category: "Smoking",
          description: "Smoking is not allowed anywhere on the property.",
          label: "Smoking: Not allowed",
          mode: RuleMode.BLOCKING,
          propertyId: "property-1",
          ruleCategory: RuleCategory.SMOKING,
          selectedValue: "not_allowed",
          severity: RuleSeverity.REQUIRED,
          warningOnly: false,
        },
        {
          active: true,
          autoDecline: false,
          category: "Pets",
          description: "Pets need manual review before confirming fit.",
          label: "Pets: Case by case",
          mode: RuleMode.WARNING_ONLY,
          propertyId: "property-1",
          ruleCategory: RuleCategory.PETS,
          selectedValue: "case_by_case",
          severity: RuleSeverity.WARNING,
          warningOnly: true,
        },
        {
          active: true,
          autoDecline: false,
          category: "Minimum stay",
          description: "A three-month stay is preferred for stability.",
          label: "Minimum stay: 3 months+",
          mode: RuleMode.WARNING_ONLY,
          propertyId: "property-1",
          ruleCategory: RuleCategory.MINIMUM_STAY,
          selectedValue: "three_months_plus",
          severity: RuleSeverity.WARNING,
          warningOnly: true,
        },
        {
          active: true,
          autoDecline: false,
          category: "Custom",
          description:
            "Prospects should be comfortable with a roommate who works overnight shifts.",
          label: "Night-shift friendly",
          mode: RuleMode.INFORMATIONAL,
          propertyId: "property-1",
          ruleCategory: RuleCategory.CUSTOM,
          selectedValue: null,
          severity: RuleSeverity.PREFERENCE,
          warningOnly: false,
        },
      ],
    },
  ]);

  assert.deepEqual(auditEvents, [
    {
      actorType: AuditActorType.USER,
      actorUserId: "user-1",
      eventType: "house_rules_completed",
      payload: {
        blockingRuleCount: 1,
        informationalRuleCount: 1,
        propertyId: "property-1",
        ruleCount: 4,
        warningRuleCount: 2,
      },
      propertyId: "property-1",
      workspaceId: "workspace-1",
    },
    {
      actorType: AuditActorType.USER,
      actorUserId: "user-1",
      eventType: "ai_artifact_generated",
      payload: {
        artifactKind: "intake_form_generator",
        payload: {
          questions: [
            {
              fieldKey: "moveInDate",
              label: "When do you want to move in?",
              required: true,
              type: "DATE",
            },
            {
              fieldKey: "monthlyBudget",
              label: "What monthly budget are you working with?",
              required: true,
              type: "NUMBER",
            },
            {
              fieldKey: "smokingPolicyFit",
              label: "Can you follow the house smoking expectation?",
              required: true,
              type: "YES_NO",
            },
            {
              fieldKey: "bringingPets",
              label: "Will you be bringing any pets?",
              required: true,
              type: "YES_NO",
            },
            {
              fieldKey: "stayLengthMonths",
              label: "How many months do you expect to stay?",
              required: true,
              type: "NUMBER",
            },
          ],
          rationale:
            "These starter questions are based on the rules you just set, so Roomflow can begin qualifying leads with household-specific context right away.",
          setName: "Maple House starter intake",
        },
        status: "ready",
      },
      propertyId: "property-1",
      workspaceId: "workspace-1",
    },
  ]);
  assert.deepEqual(revalidatedPaths, [
    "/onboarding",
    "/app",
    "/app/properties",
    "/app/properties/property-1/rules",
    "/app/properties/property-1/questions",
    "/onboarding/questions",
  ]);
  assert.equal(redirectPath, "/onboarding/questions");
});