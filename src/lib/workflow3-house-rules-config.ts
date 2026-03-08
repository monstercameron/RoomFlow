export type Workflow3SeverityChoice = "blocking" | "warning" | "informational";

export type Workflow3RuleCategoryKey =
  | "SMOKING"
  | "PETS"
  | "GUESTS"
  | "BATHROOM_SHARING"
  | "PARKING"
  | "MINIMUM_STAY"
  | "QUIET_HOURS"
  | "FURNISHING"
  | "CUSTOM";

export type Workflow3StructuredRuleKey =
  | "smoking"
  | "pets"
  | "guests"
  | "bathroomSharing"
  | "parking"
  | "minimumStay"
  | "quietHours"
  | "furnishing";

export type Workflow3RuleOption = {
  description: string;
  label: string;
  value: string;
};

export type Workflow3RuleDefinition = {
  categoryLabel: string;
  defaultSeverity: Workflow3SeverityChoice;
  description: string;
  key: Workflow3StructuredRuleKey;
  options: readonly Workflow3RuleOption[];
  ruleCategory: Workflow3RuleCategoryKey;
  title: string;
};

export type Workflow3RuleDraft = {
  enabled: boolean;
  selectedValue: string;
  severity: Workflow3SeverityChoice;
  suggested: boolean;
};

export type Workflow3CustomRuleDraft = {
  description: string;
  severity: Workflow3SeverityChoice;
  title: string;
};

export const workflow3SeverityOptions = [
  {
    value: "blocking",
    label: "Treat this as a likely mismatch",
    description: "Use this for hard no's that should strongly affect fit.",
  },
  {
    value: "warning",
    label: "Flag this for my review",
    description: "Use this for softer preferences or situations that need operator judgment.",
  },
  {
    value: "informational",
    label: "Show this as a note only",
    description: "Use this for helpful context that should not trigger a mismatch on its own.",
  },
] as const;

export const workflow3StructuredRuleDefinitions: readonly Workflow3RuleDefinition[] = [
  {
    key: "smoking",
    title: "Smoking",
    categoryLabel: "Lifestyle",
    description: "How should Roomflow treat smoking-related fit for this house?",
    ruleCategory: "SMOKING",
    defaultSeverity: "blocking",
    options: [
      {
        value: "not_allowed",
        label: "Not allowed",
        description: "Smoking is not allowed anywhere on the property.",
      },
      {
        value: "outside_only",
        label: "Allowed outside only",
        description: "Smoking is acceptable only outside and away from shared spaces.",
      },
      {
        value: "allowed",
        label: "Allowed",
        description: "Smoking is acceptable for this property.",
      },
      {
        value: "case_by_case",
        label: "Case by case",
        description: "Smoking needs a manual conversation before deciding fit.",
      },
    ],
  },
  {
    key: "pets",
    title: "Pets",
    categoryLabel: "Compatibility",
    description: "Set the baseline expectation for pets in the house.",
    ruleCategory: "PETS",
    defaultSeverity: "blocking",
    options: [
      {
        value: "not_allowed",
        label: "Not allowed",
        description: "Pets are not allowed because of allergies, roommates, or lease limits.",
      },
      {
        value: "allowed",
        label: "Allowed",
        description: "Pets are acceptable for this property.",
      },
      {
        value: "case_by_case",
        label: "Case by case",
        description: "Pets need manual review before confirming fit.",
      },
    ],
  },
  {
    key: "guests",
    title: "Guests",
    categoryLabel: "Shared living",
    description: "Set expectations around visitors and overnight guests.",
    ruleCategory: "GUESTS",
    defaultSeverity: "warning",
    options: [
      {
        value: "no_overnight",
        label: "No overnight guests",
        description: "Overnight guests are not part of the house setup.",
      },
      {
        value: "limited_overnight",
        label: "Limited overnight guests",
        description: "Occasional overnight guests may be okay, but only within clear limits.",
      },
      {
        value: "reasonable_guests_allowed",
        label: "Reasonable guests allowed",
        description: "Normal guest activity is okay if it stays respectful of the household.",
      },
      {
        value: "case_by_case",
        label: "Case by case",
        description: "Guest expectations need a manual conversation before deciding fit.",
      },
    ],
  },
  {
    key: "bathroomSharing",
    title: "Bathroom sharing",
    categoryLabel: "Daily routine",
    description: "Clarify what bathroom setup a future housemate needs to be comfortable with.",
    ruleCategory: "BATHROOM_SHARING",
    defaultSeverity: "blocking",
    options: [
      {
        value: "must_be_comfortable_sharing",
        label: "Must be comfortable sharing a bathroom",
        description: "A shared bathroom is part of the expected living setup.",
      },
      {
        value: "private_bathroom_available",
        label: "Private bathroom available",
        description: "A private bathroom is available for the room being offered.",
      },
      {
        value: "varies_by_room",
        label: "Varies by room",
        description: "Bathroom setup depends on the room and needs follow-up during qualification.",
      },
      {
        value: "not_applicable",
        label: "Not applicable",
        description: "Bathroom sharing is not an important part of fit for this property.",
      },
    ],
  },
  {
    key: "parking",
    title: "Parking",
    categoryLabel: "Logistics",
    description: "Set expectations for what a lead should assume about parking.",
    ruleCategory: "PARKING",
    defaultSeverity: "warning",
    options: [
      {
        value: "no_parking",
        label: "No parking",
        description: "Parking is not available with the property.",
      },
      {
        value: "street_only",
        label: "Street only",
        description: "Street parking is the only realistic option.",
      },
      {
        value: "limited_on_site",
        label: "Limited on-site parking",
        description: "Parking may be available, but not for every room or resident.",
      },
      {
        value: "guaranteed_parking",
        label: "Guaranteed parking",
        description: "Parking is reliably available for this room or property.",
      },
      {
        value: "ask_first",
        label: "Ask first",
        description: "Parking should be discussed before confirming fit.",
      },
    ],
  },
  {
    key: "minimumStay",
    title: "Minimum stay",
    categoryLabel: "Stability",
    description: "Set the minimum stay expectation that matters for this house.",
    ruleCategory: "MINIMUM_STAY",
    defaultSeverity: "warning",
    options: [
      {
        value: "no_preference",
        label: "No preference",
        description: "Stay length is flexible and should not strongly affect fit.",
      },
      {
        value: "one_month_plus",
        label: "1 month+",
        description: "Shorter stays are usually not a fit.",
      },
      {
        value: "three_months_plus",
        label: "3 months+",
        description: "A three-month stay is preferred for stability.",
      },
      {
        value: "six_months_plus",
        label: "6 months+",
        description: "Longer stays are strongly preferred.",
      },
      {
        value: "twelve_months_plus",
        label: "12 months+",
        description: "This house works best for long-term residents.",
      },
    ],
  },
  {
    key: "quietHours",
    title: "Quiet hours and noise",
    categoryLabel: "Household rhythm",
    description: "Set how much daily quiet and noise expectations matter in this house.",
    ruleCategory: "QUIET_HOURS",
    defaultSeverity: "warning",
    options: [
      {
        value: "quiet_household",
        label: "Quiet household",
        description: "The household tends to be very quiet and future residents should expect that.",
      },
      {
        value: "standard_quiet_hours",
        label: "Standard quiet hours",
        description: "Normal quiet-hours expectations matter and should be respected.",
      },
      {
        value: "flexible",
        label: "Flexible",
        description: "Noise expectations are present but not unusually strict.",
      },
      {
        value: "not_specified",
        label: "Not specified",
        description: "Noise expectations do not need to drive qualification right now.",
      },
    ],
  },
  {
    key: "furnishing",
    title: "Furnishing and room setup",
    categoryLabel: "Room setup",
    description: "Clarify what kind of room setup the lead should expect.",
    ruleCategory: "FURNISHING",
    defaultSeverity: "informational",
    options: [
      {
        value: "furnished",
        label: "Furnished",
        description: "The room is furnished and move-in ready.",
      },
      {
        value: "unfurnished",
        label: "Unfurnished",
        description: "The room is offered unfurnished.",
      },
      {
        value: "partially_furnished",
        label: "Partially furnished",
        description: "The room includes some furniture, but not a full setup.",
      },
      {
        value: "varies",
        label: "Varies",
        description: "Room setup depends on the room being offered.",
      },
    ],
  },
] as const;

export function createEmptyWorkflow3RuleDraft(
  definition: Workflow3RuleDefinition,
): Workflow3RuleDraft {
  return {
    enabled: false,
    selectedValue: definition.options[0]?.value ?? "",
    severity: definition.defaultSeverity,
    suggested: false,
  };
}

export function createEmptyWorkflow3CustomRuleDraft(): Workflow3CustomRuleDraft {
  return {
    title: "",
    description: "",
    severity: "warning",
  };
}

export function createEmptyWorkflow3RuleDrafts() {
  return Object.fromEntries(
    workflow3StructuredRuleDefinitions.map((definition) => [
      definition.key,
      createEmptyWorkflow3RuleDraft(definition),
    ]),
  ) as Record<Workflow3StructuredRuleKey, Workflow3RuleDraft>;
}

export function getWorkflow3RuleDefinition(key: Workflow3StructuredRuleKey) {
  return workflow3StructuredRuleDefinitions.find((definition) => definition.key === key);
}

export function getWorkflow3RuleOption(
  key: Workflow3StructuredRuleKey,
  value: string,
) {
  return getWorkflow3RuleDefinition(key)?.options.find((option) => option.value === value);
}

export function getWorkflow3SuggestedRuleDrafts(input: {
  parkingAvailable: boolean;
  petsAllowed: boolean;
  propertyType: string | null;
  sharedBathroomCount: number | null;
  smokingAllowed: boolean;
}) {
  const drafts = createEmptyWorkflow3RuleDrafts();
  const normalizedPropertyType = (input.propertyType ?? "").toLowerCase();
  const isOwnerOccupied = normalizedPropertyType.includes("owner-occupied");
  const isCoLiving = normalizedPropertyType.includes("co-living");

  if (!input.smokingAllowed) {
    drafts.smoking = {
      enabled: true,
      selectedValue: "not_allowed",
      severity: "blocking",
      suggested: true,
    };
  }

  if (!input.petsAllowed) {
    drafts.pets = {
      enabled: true,
      selectedValue: "not_allowed",
      severity: "blocking",
      suggested: true,
    };
  }

  drafts.guests = {
    enabled: true,
    selectedValue: isOwnerOccupied ? "limited_overnight" : "case_by_case",
    severity: "warning",
    suggested: true,
  };

  if ((input.sharedBathroomCount ?? 0) > 0) {
    drafts.bathroomSharing = {
      enabled: true,
      selectedValue: "must_be_comfortable_sharing",
      severity: "blocking",
      suggested: true,
    };
  }

  drafts.parking = {
    enabled: true,
    selectedValue: input.parkingAvailable
      ? isCoLiving
        ? "ask_first"
        : "limited_on_site"
      : "no_parking",
    severity: "warning",
    suggested: true,
  };

  drafts.minimumStay = {
    enabled: true,
    selectedValue: isOwnerOccupied ? "three_months_plus" : "one_month_plus",
    severity: "warning",
    suggested: true,
  };

  drafts.quietHours = {
    enabled: true,
    selectedValue: isOwnerOccupied ? "quiet_household" : "standard_quiet_hours",
    severity: isOwnerOccupied ? "informational" : "warning",
    suggested: true,
  };

  drafts.furnishing = {
    enabled: true,
    selectedValue: "varies",
    severity: "informational",
    suggested: true,
  };

  return drafts;
}

export function hydrateWorkflow3RuleDraftsFromQuery(
  searchParams: Record<string, string | string[] | undefined>,
  fallbackDrafts: Record<Workflow3StructuredRuleKey, Workflow3RuleDraft>,
) {
  const nextDrafts = { ...fallbackDrafts };

  for (const definition of workflow3StructuredRuleDefinitions) {
    const enabledValue = getSearchParamValue(searchParams, `${definition.key}Enabled`);
    const selectedValue = getSearchParamValue(searchParams, `${definition.key}Value`);
    const severityValue = getSearchParamValue(searchParams, `${definition.key}Severity`);

    if (enabledValue === null && selectedValue === null && severityValue === null) {
      continue;
    }

    nextDrafts[definition.key] = {
      enabled: enabledValue === "1",
      selectedValue:
        selectedValue ?? fallbackDrafts[definition.key].selectedValue,
      severity: isWorkflow3SeverityChoice(severityValue)
        ? severityValue
        : fallbackDrafts[definition.key].severity,
      suggested: fallbackDrafts[definition.key].suggested,
    };
  }

  return nextDrafts;
}

export function hydrateWorkflow3CustomRulesFromQuery(
  searchParams: Record<string, string | string[] | undefined>,
  fallbackRules: Workflow3CustomRuleDraft[],
) {
  const countValue = getSearchParamValue(searchParams, "customRuleCount");
  const count = countValue ? Number.parseInt(countValue, 10) : Number.NaN;

  if (!Number.isFinite(count)) {
    return fallbackRules;
  }

  const customRules: Workflow3CustomRuleDraft[] = [];

  for (let index = 0; index < count; index += 1) {
    customRules.push({
      title: getSearchParamValue(searchParams, `customTitle-${index}`) ?? "",
      description:
        getSearchParamValue(searchParams, `customDescription-${index}`) ?? "",
      severity: isWorkflow3SeverityChoice(
        getSearchParamValue(searchParams, `customSeverity-${index}`),
      )
        ? (getSearchParamValue(
            searchParams,
            `customSeverity-${index}`,
          ) as Workflow3SeverityChoice)
        : "warning",
    });
  }

  return customRules.length > 0 ? customRules : fallbackRules;
}

export function hydrateWorkflow3DraftsFromExistingRules(input: {
  rules: Array<{
    category: string | null;
    description: string | null;
    label: string;
    mode: string;
    ruleCategory: string;
    selectedValue?: string | null;
  }>;
}) {
  const ruleDrafts = createEmptyWorkflow3RuleDrafts();
  const customRules: Workflow3CustomRuleDraft[] = [];

  for (const rule of input.rules) {
    const structuredKey = inferWorkflow3StructuredRuleKey(rule);

    if (!structuredKey) {
      customRules.push({
        title: rule.label,
        description: rule.description ?? "",
        severity: mapModeToWorkflow3Severity(rule.mode),
      });
      continue;
    }

    const definition = getWorkflow3RuleDefinition(structuredKey);
    const selectedValue =
      rule.selectedValue ?? inferWorkflow3SelectedValueFromLegacyRule(structuredKey, rule);

    if (!definition || !selectedValue) {
      continue;
    }

    ruleDrafts[structuredKey] = {
      enabled: true,
      selectedValue,
      severity: mapModeToWorkflow3Severity(rule.mode),
      suggested: false,
    };
  }

  return {
    ruleDrafts,
    customRules,
  };
}

export function mapModeToWorkflow3Severity(mode: string): Workflow3SeverityChoice {
  if (mode === "WARNING_ONLY") {
    return "warning";
  }

  if (mode === "INFORMATIONAL") {
    return "informational";
  }

  return "blocking";
}

function inferWorkflow3StructuredRuleKey(input: {
  category: string | null;
  label: string;
  ruleCategory: string;
}) {
  switch (input.ruleCategory) {
    case "SMOKING":
      return "smoking";
    case "PETS":
      return "pets";
    case "GUESTS":
      return "guests";
    case "BATHROOM_SHARING":
      return "bathroomSharing";
    case "PARKING":
      return "parking";
    case "MINIMUM_STAY":
      return "minimumStay";
    case "QUIET_HOURS":
      return "quietHours";
    case "FURNISHING":
      return "furnishing";
    default:
      break;
  }

  const normalizedLabel = `${input.category ?? ""} ${input.label}`.toLowerCase();

  if (normalizedLabel.includes("smok")) {
    return "smoking";
  }

  if (normalizedLabel.includes("pet")) {
    return "pets";
  }

  if (normalizedLabel.includes("guest")) {
    return "guests";
  }

  if (normalizedLabel.includes("bathroom")) {
    return "bathroomSharing";
  }

  if (normalizedLabel.includes("parking")) {
    return "parking";
  }

  if (normalizedLabel.includes("stay")) {
    return "minimumStay";
  }

  if (normalizedLabel.includes("quiet") || normalizedLabel.includes("noise")) {
    return "quietHours";
  }

  if (normalizedLabel.includes("furnish")) {
    return "furnishing";
  }

  return null;
}

function inferWorkflow3SelectedValueFromLegacyRule(
  key: Workflow3StructuredRuleKey,
  input: {
    category: string | null;
    description: string | null;
    label: string;
  },
) {
  const normalizedText = `${input.category ?? ""} ${input.label} ${input.description ?? ""}`.toLowerCase();

  switch (key) {
    case "smoking":
      if (normalizedText.includes("outside")) {
        return "outside_only";
      }
      if (normalizedText.includes("case by case")) {
        return "case_by_case";
      }
      if (normalizedText.includes("allowed") && !normalizedText.includes("not allowed")) {
        return "allowed";
      }
      return "not_allowed";
    case "pets":
      if (normalizedText.includes("case by case")) {
        return "case_by_case";
      }
      if (normalizedText.includes("allowed") && !normalizedText.includes("not allowed")) {
        return "allowed";
      }
      return "not_allowed";
    case "guests":
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
    case "bathroomSharing":
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
    case "parking":
      if (normalizedText.includes("street")) {
        return "street_only";
      }
      if (normalizedText.includes("guaranteed")) {
        return "guaranteed_parking";
      }
      if (normalizedText.includes("ask first")) {
        return "ask_first";
      }
      if (normalizedText.includes("no parking")) {
        return "no_parking";
      }
      return "limited_on_site";
    case "minimumStay":
      if (normalizedText.includes("12")) {
        return "twelve_months_plus";
      }
      if (normalizedText.includes("6")) {
        return "six_months_plus";
      }
      if (normalizedText.includes("3")) {
        return "three_months_plus";
      }
      if (normalizedText.includes("1 month")) {
        return "one_month_plus";
      }
      return "no_preference";
    case "quietHours":
      if (normalizedText.includes("quiet household")) {
        return "quiet_household";
      }
      if (normalizedText.includes("flexible")) {
        return "flexible";
      }
      if (normalizedText.includes("not specified")) {
        return "not_specified";
      }
      return "standard_quiet_hours";
    case "furnishing":
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

function getSearchParamValue(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = searchParams[key];

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function isWorkflow3SeverityChoice(
  value: string | null,
): value is Workflow3SeverityChoice {
  return value === "blocking" || value === "warning" || value === "informational";
}