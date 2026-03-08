export type PropertyIndexFilter =
  | "all"
  | "lead-active"
  | "qualified-demand"
  | "ready"
  | "setup-needed";

export type PropertyStatusChipTone = "default" | "success" | "warning";

export type PropertyStatusChip = {
  label: string;
  tone: PropertyStatusChipTone;
};

type PropertySummaryInput = {
  activeLeads: number;
  qualifiedLeads: number;
  rulesCount: number;
  schedulingUrl?: string | null;
};

export function isPropertyIndexFilter(value: string): value is PropertyIndexFilter {
  return ["all", "lead-active", "qualified-demand", "ready", "setup-needed"].includes(value);
}

export function getPropertyStatusChips(propertySummary: PropertySummaryInput) {
  const propertyStatusChips: PropertyStatusChip[] = [];
  const hasRulesConfigured = propertySummary.rulesCount > 0;
  const hasSchedulingConfigured = Boolean(propertySummary.schedulingUrl);
  const isReadyForQualificationFlow = hasRulesConfigured && hasSchedulingConfigured;

  propertyStatusChips.push({
    label: isReadyForQualificationFlow ? "Ready" : "Setup needed",
    tone: isReadyForQualificationFlow ? "success" : "warning",
  });

  if (!hasRulesConfigured) {
    propertyStatusChips.push({
      label: "Rules missing",
      tone: "warning",
    });
  }

  if (!hasSchedulingConfigured) {
    propertyStatusChips.push({
      label: "Scheduling missing",
      tone: "warning",
    });
  }

  if (propertySummary.activeLeads > 0) {
    propertyStatusChips.push({
      label: "Lead flow active",
      tone: "default",
    });
  }

  if (propertySummary.qualifiedLeads > 0) {
    propertyStatusChips.push({
      label: "Qualified demand",
      tone: "success",
    });
  }

  return propertyStatusChips;
}

export function matchesPropertyIndexFilter(
  propertySummary: PropertySummaryInput,
  propertyIndexFilter: PropertyIndexFilter,
) {
  const hasRulesConfigured = propertySummary.rulesCount > 0;
  const hasSchedulingConfigured = Boolean(propertySummary.schedulingUrl);

  switch (propertyIndexFilter) {
    case "lead-active":
      return propertySummary.activeLeads > 0;
    case "qualified-demand":
      return propertySummary.qualifiedLeads > 0;
    case "ready":
      return hasRulesConfigured && hasSchedulingConfigured;
    case "setup-needed":
      return !hasRulesConfigured || !hasSchedulingConfigured;
    default:
      return true;
  }
}