import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import {
  AuditActorType,
  RuleCategory,
  RuleMode,
  RuleSeverity,
} from "@/generated/prisma/client";
import {
  buildAiArtifactPayload,
  type IntakeFormGeneratorArtifact,
} from "@/lib/ai-assist";
import { getCurrentWorkspaceMembership } from "@/lib/app-data";
import { prisma } from "@/lib/prisma";
import {
  getWorkflow3RuleDefinition,
  getWorkflow3RuleOption,
  type Workflow3CustomRuleDraft,
  type Workflow3RuleCategoryKey,
  type Workflow3SeverityChoice,
  workflow3StructuredRuleDefinitions,
} from "@/lib/workflow3-house-rules-config";

type Workflow3Membership = {
  userId: string;
  workspaceId: string;
};

type Workflow3PropertyRecord = {
  id: string;
  name: string;
};

type Workflow3PropertyRuleInput = {
  active: boolean;
  autoDecline: boolean;
  category: string;
  description: string;
  label: string;
  mode: RuleMode;
  propertyId: string;
  ruleCategory: RuleCategory;
  selectedValue: string | null;
  severity: RuleSeverity;
  warningOnly: boolean;
};

type Workflow3AuditEventInput = {
  actorType: AuditActorType;
  actorUserId: string;
  eventType: string;
  payload: Prisma.InputJsonObject;
  propertyId: string;
  workspaceId: string;
};

export type Workflow3HouseRulesActionDependencies = {
  createAuditEvent: (input: Workflow3AuditEventInput) => Promise<void>;
  findFirstPropertyForWorkspace: (
    workspaceId: string,
  ) => Promise<Workflow3PropertyRecord | null>;
  getCurrentWorkspaceMembership: () => Promise<Workflow3Membership>;
  redirect: (path: string) => never;
  replacePropertyRules: (input: {
    propertyId: string;
    rules: Workflow3PropertyRuleInput[];
  }) => Promise<void>;
  revalidatePath: (path: string) => void;
};

export class HouseRulesOnboardingActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HouseRulesOnboardingActionError";
  }
}

const defaultDependencies: Workflow3HouseRulesActionDependencies = {
  createAuditEvent: async (input) => {
    await prisma.auditEvent.create({
      data: {
        workspaceId: input.workspaceId,
        propertyId: input.propertyId,
        actorUserId: input.actorUserId,
        actorType: input.actorType,
        eventType: input.eventType,
        payload: input.payload,
      },
    });
  },
  findFirstPropertyForWorkspace: (workspaceId) =>
    prisma.property.findFirst({
      where: {
        workspaceId,
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    }),
  getCurrentWorkspaceMembership: async () => {
    const membership = await getCurrentWorkspaceMembership();

    return {
      workspaceId: membership.workspaceId,
      userId: membership.userId,
    };
  },
  redirect,
  replacePropertyRules: async ({ propertyId, rules }) => {
    await prisma.$transaction([
      prisma.propertyRule.deleteMany({
        where: {
          propertyId,
        },
      }),
      ...(rules.length > 0
        ? [
            prisma.propertyRule.createMany({
              data: rules,
            }),
          ]
        : []),
    ]);
  },
  revalidatePath,
};

export function buildHouseRulesOnboardingRetryPath(
  formData: FormData,
  errorMessage: string,
) {
  const queryParameters = new URLSearchParams();

  queryParameters.set("error", errorMessage);

  for (const definition of workflow3StructuredRuleDefinitions) {
    queryParameters.set(
      `${definition.key}Enabled`,
      formData.get(`${definition.key}Enabled`) === "1" ? "1" : "0",
    );

    const selectedValue = formData.get(`${definition.key}Value`);

    if (typeof selectedValue === "string") {
      queryParameters.set(`${definition.key}Value`, selectedValue);
    }

    const severityValue = formData.get(`${definition.key}Severity`);

    if (typeof severityValue === "string") {
      queryParameters.set(`${definition.key}Severity`, severityValue);
    }
  }

  const customRuleCountValue = formData.get("customRuleCount");
  const customRuleCount =
    typeof customRuleCountValue === "string"
      ? Number.parseInt(customRuleCountValue, 10)
      : Number.NaN;

  if (Number.isFinite(customRuleCount)) {
    queryParameters.set("customRuleCount", `${customRuleCount}`);

    for (let index = 0; index < customRuleCount; index += 1) {
      const title = formData.get(`customTitle-${index}`);
      const description = formData.get(`customDescription-${index}`);
      const severity = formData.get(`customSeverity-${index}`);

      queryParameters.set(
        `customTitle-${index}`,
        typeof title === "string" ? title : "",
      );
      queryParameters.set(
        `customDescription-${index}`,
        typeof description === "string" ? description : "",
      );
      queryParameters.set(
        `customSeverity-${index}`,
        typeof severity === "string" ? severity : "warning",
      );
    }
  }

  return `/onboarding/house-rules?${queryParameters.toString()}`;
}

export async function handleSaveHouseRulesOnboardingAction(
  formData: FormData,
  dependencies: Workflow3HouseRulesActionDependencies = defaultDependencies,
) {
  const workspaceMembership = await dependencies.getCurrentWorkspaceMembership();
  const property = await dependencies.findFirstPropertyForWorkspace(
    workspaceMembership.workspaceId,
  );

  if (!property) {
    dependencies.redirect("/onboarding/property");
  }

  const customRules = parseCustomRules(formData);
  const structuredRules = parseStructuredRules(formData, property.id);
  const nextRules = [...structuredRules, ...customRules.map((rule) => toCustomRule(rule, property.id))];

  if (nextRules.length === 0) {
    throw new HouseRulesOnboardingActionError(
      "Add at least one house rule or custom expectation before continuing.",
    );
  }

  await dependencies.replacePropertyRules({
    propertyId: property.id,
    rules: nextRules,
  });

  const blockingRuleCount = nextRules.filter((rule) => rule.mode === RuleMode.BLOCKING).length;
  const warningRuleCount = nextRules.filter((rule) => rule.mode === RuleMode.WARNING_ONLY).length;
  const informationalRuleCount = nextRules.filter(
    (rule) => rule.mode === RuleMode.INFORMATIONAL,
  ).length;

  await dependencies.createAuditEvent({
    workspaceId: workspaceMembership.workspaceId,
    propertyId: property.id,
    actorUserId: workspaceMembership.userId,
    actorType: AuditActorType.USER,
    eventType: "house_rules_completed",
    payload: {
      blockingRuleCount,
      informationalRuleCount,
      propertyId: property.id,
      ruleCount: nextRules.length,
      warningRuleCount,
    },
  });

  const starterIntakeForm = buildWorkflow3SuggestedIntakeForm(property.name, nextRules);

  await dependencies.createAuditEvent({
    workspaceId: workspaceMembership.workspaceId,
    propertyId: property.id,
    actorUserId: workspaceMembership.userId,
    actorType: AuditActorType.USER,
    eventType: "ai_artifact_generated",
    payload: buildAiArtifactPayload(
      "intake_form_generator",
      starterIntakeForm,
    ) as Prisma.InputJsonObject,
  });

  dependencies.revalidatePath("/onboarding");
  dependencies.revalidatePath("/app");
  dependencies.revalidatePath("/app/properties");
  dependencies.revalidatePath(`/app/properties/${property.id}/rules`);
  dependencies.revalidatePath(`/app/properties/${property.id}/questions`);
  dependencies.revalidatePath("/onboarding/questions");
  dependencies.redirect("/onboarding/questions");
}

export function inferRuleCategoryFromText(input: {
  category: string | null;
  label: string;
}) {
  const normalizedText = `${input.category ?? ""} ${input.label}`.toLowerCase();

  if (normalizedText.includes("smok")) {
    return RuleCategory.SMOKING;
  }

  if (normalizedText.includes("pet")) {
    return RuleCategory.PETS;
  }

  if (normalizedText.includes("guest")) {
    return RuleCategory.GUESTS;
  }

  if (normalizedText.includes("bathroom")) {
    return RuleCategory.BATHROOM_SHARING;
  }

  if (normalizedText.includes("parking")) {
    return RuleCategory.PARKING;
  }

  if (normalizedText.includes("stay")) {
    return RuleCategory.MINIMUM_STAY;
  }

  if (normalizedText.includes("quiet") || normalizedText.includes("noise")) {
    return RuleCategory.QUIET_HOURS;
  }

  if (normalizedText.includes("furnish")) {
    return RuleCategory.FURNISHING;
  }

  return RuleCategory.GENERAL;
}

export function inferSelectedValueFromText(input: {
  category: string | null;
  label: string;
}) {
  const category = inferRuleCategoryFromText(input);
  const normalizedText = `${input.category ?? ""} ${input.label}`.toLowerCase();

  switch (category) {
    case RuleCategory.SMOKING:
      if (normalizedText.includes("outside")) {
        return "outside_only";
      }
      if (normalizedText.includes("case by case")) {
        return "case_by_case";
      }
      if (normalizedText.includes("allowed") && !normalizedText.includes("not")) {
        return "allowed";
      }
      return "not_allowed";
    case RuleCategory.PETS:
      if (normalizedText.includes("case by case")) {
        return "case_by_case";
      }
      if (normalizedText.includes("allowed") && !normalizedText.includes("not")) {
        return "allowed";
      }
      return "not_allowed";
    case RuleCategory.GUESTS:
      if (normalizedText.includes("reasonable")) {
        return "reasonable_guests_allowed";
      }
      if (normalizedText.includes("case by case")) {
        return "case_by_case";
      }
      if (normalizedText.includes("no overnight")) {
        return "no_overnight";
      }
      return "limited_overnight";
    case RuleCategory.BATHROOM_SHARING:
      if (normalizedText.includes("private")) {
        return "private_bathroom_available";
      }
      if (normalizedText.includes("varies")) {
        return "varies_by_room";
      }
      if (normalizedText.includes("not applicable")) {
        return "not_applicable";
      }
      return "must_be_comfortable_sharing";
    case RuleCategory.PARKING:
      if (normalizedText.includes("street")) {
        return "street_only";
      }
      if (normalizedText.includes("guaranteed")) {
        return "guaranteed_parking";
      }
      if (normalizedText.includes("ask")) {
        return "ask_first";
      }
      if (normalizedText.includes("no parking")) {
        return "no_parking";
      }
      return "limited_on_site";
    case RuleCategory.MINIMUM_STAY:
      if (normalizedText.includes("12")) {
        return "twelve_months_plus";
      }
      if (normalizedText.includes("6")) {
        return "six_months_plus";
      }
      if (normalizedText.includes("3")) {
        return "three_months_plus";
      }
      return "one_month_plus";
    case RuleCategory.QUIET_HOURS:
      if (normalizedText.includes("quiet household")) {
        return "quiet_household";
      }
      if (normalizedText.includes("flexible")) {
        return "flexible";
      }
      return "standard_quiet_hours";
    case RuleCategory.FURNISHING:
      if (normalizedText.includes("unfurnished")) {
        return "unfurnished";
      }
      if (normalizedText.includes("partially")) {
        return "partially_furnished";
      }
      if (normalizedText.includes("varies")) {
        return "varies";
      }
      return "furnished";
    default:
      return null;
  }
}

function parseStructuredRules(formData: FormData, propertyId: string) {
  const rules: Workflow3PropertyRuleInput[] = [];

  for (const definition of workflow3StructuredRuleDefinitions) {
    const enabled = formData.get(`${definition.key}Enabled`) === "1";

    if (!enabled) {
      continue;
    }

    const selectedValue = formData.get(`${definition.key}Value`);
    const severity = formData.get(`${definition.key}Severity`);

    if (typeof selectedValue !== "string" || selectedValue.length === 0) {
      throw new HouseRulesOnboardingActionError(
        `Choose a setting for ${definition.title.toLowerCase()}.`,
      );
    }

    if (!isWorkflow3SeverityChoice(severity)) {
      throw new HouseRulesOnboardingActionError(
        `Choose how Roomflow should treat ${definition.title.toLowerCase()}.`,
      );
    }

    const option = getWorkflow3RuleOption(definition.key, selectedValue);

    if (!option) {
      throw new HouseRulesOnboardingActionError(
        `Choose a valid setting for ${definition.title.toLowerCase()}.`,
      );
    }

    const severityMetadata = toSeverityMetadata(severity);

    rules.push({
      propertyId,
      active: true,
      autoDecline: severityMetadata.autoDecline,
      category: definition.title,
      description: option.description,
      label: `${definition.title}: ${option.label}`,
      mode: severityMetadata.mode,
      ruleCategory: toRuleCategory(definition.ruleCategory),
      selectedValue,
      severity: severityMetadata.severity,
      warningOnly: severityMetadata.warningOnly,
    });
  }

  return rules;
}

function parseCustomRules(formData: FormData) {
  const customRuleCountValue = formData.get("customRuleCount");
  const customRuleCount =
    typeof customRuleCountValue === "string"
      ? Number.parseInt(customRuleCountValue, 10)
      : 0;
  const customRules: Workflow3CustomRuleDraft[] = [];

  if (!Number.isFinite(customRuleCount) || customRuleCount < 1) {
    return customRules;
  }

  for (let index = 0; index < customRuleCount; index += 1) {
    const titleValue = formData.get(`customTitle-${index}`);
    const descriptionValue = formData.get(`customDescription-${index}`);
    const severityValue = formData.get(`customSeverity-${index}`);

    const title = typeof titleValue === "string" ? titleValue.trim() : "";
    const description =
      typeof descriptionValue === "string" ? descriptionValue.trim() : "";
    const severity = isWorkflow3SeverityChoice(severityValue)
      ? severityValue
      : null;
    const hasAnyValue = title.length > 0 || description.length > 0;

    if (!hasAnyValue) {
      continue;
    }

    if (title.length === 0 || description.length === 0 || !severity) {
      throw new HouseRulesOnboardingActionError(
        "Please complete each custom rule before saving.",
      );
    }

    customRules.push({
      title,
      description,
      severity,
    });
  }

  return customRules;
}

function toCustomRule(rule: Workflow3CustomRuleDraft, propertyId: string): Workflow3PropertyRuleInput {
  const severityMetadata = toSeverityMetadata(rule.severity);

  return {
    propertyId,
    active: true,
    autoDecline: severityMetadata.autoDecline,
    category: "Custom",
    description: rule.description,
    label: rule.title,
    mode: severityMetadata.mode,
    ruleCategory: RuleCategory.CUSTOM,
    selectedValue: null,
    severity: severityMetadata.severity,
    warningOnly: severityMetadata.warningOnly,
  };
}

function toRuleCategory(ruleCategory: Workflow3RuleCategoryKey) {
  switch (ruleCategory) {
    case "SMOKING":
      return RuleCategory.SMOKING;
    case "PETS":
      return RuleCategory.PETS;
    case "GUESTS":
      return RuleCategory.GUESTS;
    case "BATHROOM_SHARING":
      return RuleCategory.BATHROOM_SHARING;
    case "PARKING":
      return RuleCategory.PARKING;
    case "MINIMUM_STAY":
      return RuleCategory.MINIMUM_STAY;
    case "QUIET_HOURS":
      return RuleCategory.QUIET_HOURS;
    case "FURNISHING":
      return RuleCategory.FURNISHING;
    case "CUSTOM":
      return RuleCategory.CUSTOM;
    default:
      return RuleCategory.GENERAL;
  }
}

function toSeverityMetadata(severityChoice: Workflow3SeverityChoice) {
  if (severityChoice === "warning") {
    return {
      autoDecline: false,
      mode: RuleMode.WARNING_ONLY,
      severity: RuleSeverity.WARNING,
      warningOnly: true,
    };
  }

  if (severityChoice === "informational") {
    return {
      autoDecline: false,
      mode: RuleMode.INFORMATIONAL,
      severity: RuleSeverity.PREFERENCE,
      warningOnly: false,
    };
  }

  return {
    autoDecline: true,
    mode: RuleMode.BLOCKING,
    severity: RuleSeverity.REQUIRED,
    warningOnly: false,
  };
}

function isWorkflow3SeverityChoice(
  value: FormDataEntryValue | null,
): value is Workflow3SeverityChoice {
  return value === "blocking" || value === "warning" || value === "informational";
}

function buildWorkflow3SuggestedIntakeForm(
  propertyName: string,
  rules: Workflow3PropertyRuleInput[],
): IntakeFormGeneratorArtifact {
  const questions: IntakeFormGeneratorArtifact["questions"] = [
    {
      fieldKey: "moveInDate",
      label: "When do you want to move in?",
      required: true,
      type: "DATE" as const,
    },
    {
      fieldKey: "monthlyBudget",
      label: "What monthly budget are you working with?",
      required: true,
      type: "NUMBER" as const,
    },
  ];

  for (const rule of rules) {
    switch (rule.ruleCategory) {
      case RuleCategory.MINIMUM_STAY:
        questions.push({
          fieldKey: "stayLengthMonths",
          label: "How many months do you expect to stay?",
          required: true,
          type: "NUMBER" as const,
        });
        break;
      case RuleCategory.SMOKING:
        questions.push({
          fieldKey: "smokingPolicyFit",
          label: "Can you follow the house smoking expectation?",
          required: true,
          type: "YES_NO" as const,
        });
        break;
      case RuleCategory.PETS:
        questions.push({
          fieldKey: "bringingPets",
          label: "Will you be bringing any pets?",
          required: true,
          type: "YES_NO" as const,
        });
        break;
      case RuleCategory.BATHROOM_SHARING:
        questions.push({
          fieldKey: "bathroomSharingOk",
          label: "Are you comfortable with the bathroom setup for this home?",
          required: true,
          type: "YES_NO" as const,
        });
        break;
      case RuleCategory.GUESTS:
        questions.push({
          fieldKey: "overnightGuestHabits",
          label: "Do you expect to host regular overnight guests?",
          required: true,
          type: "YES_NO" as const,
        });
        break;
      case RuleCategory.PARKING:
        questions.push({
          fieldKey: "needsParking",
          label: "Will you need parking?",
          required: true,
          type: "YES_NO" as const,
        });
        break;
      case RuleCategory.QUIET_HOURS:
        questions.push({
          fieldKey: "quietHoursFit",
          label: "Are you comfortable with the household quiet-hours expectations?",
          required: true,
          type: "YES_NO" as const,
        });
        break;
      case RuleCategory.FURNISHING:
        questions.push({
          fieldKey: "furnishingNeeds",
          label: "Do you need a furnished room?",
          required: false,
          type: "YES_NO" as const,
        });
        break;
      default:
        break;
    }
  }

  const deduplicatedQuestions = Array.from(
    new Map(questions.map((question) => [question.fieldKey, question])).values(),
  ).slice(0, 10);

  return {
    setName: `${propertyName} starter intake`,
    rationale:
      "These starter questions are based on the rules you just set, so Roomflow can begin qualifying leads with household-specific context right away.",
    questions: deduplicatedQuestions,
  };
}