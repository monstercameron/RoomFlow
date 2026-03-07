import { LeadSourceType, RuleSeverity } from "@/generated/prisma/client";

export const onboardingRulePresets = [
  {
    key: "no_smoking",
    label: "No smoking",
    category: "Lifestyle",
    description: "Applies to bedrooms and shared areas.",
    severity: RuleSeverity.REQUIRED,
    autoDecline: true,
  },
  {
    key: "no_pets",
    label: "No pets",
    category: "Compatibility",
    description: "Use when the house is pet-free because of allergies or lease limits.",
    severity: RuleSeverity.REQUIRED,
    autoDecline: true,
  },
  {
    key: "no_overnight_guests",
    label: "No frequent overnight guests",
    category: "House operations",
    description: "Sets guest expectations up front for shared spaces.",
    severity: RuleSeverity.WARNING,
    autoDecline: false,
  },
  {
    key: "minimum_stay",
    label: "Minimum stay preferred",
    category: "Screening",
    description: "Use when short stays create turnover problems.",
    severity: RuleSeverity.PREFERENCE,
    autoDecline: false,
  },
  {
    key: "shared_bathroom",
    label: "Shared bathroom required",
    category: "Logistics",
    description: "Confirms the lead is okay with the shared setup.",
    severity: RuleSeverity.REQUIRED,
    autoDecline: false,
  },
  {
    key: "quiet_hours",
    label: "Quiet hours acknowledgment",
    category: "House operations",
    description: "Captures agreement to house quiet hours.",
    severity: RuleSeverity.WARNING,
    autoDecline: false,
  },
] as const;

export const onboardingChannelOptions = [
  {
    key: "manual",
    label: "Manual entry",
    description: "Always available for direct operator-created leads.",
    type: LeadSourceType.MANUAL,
    name: "Manual intake",
    mode: "direct",
  },
  {
    key: "email",
    label: "Inbound email",
    description: "Direct support channel for email inquiries.",
    type: LeadSourceType.EMAIL,
    name: "Inbound email",
    mode: "direct",
  },
  {
    key: "sms",
    label: "Inbound SMS",
    description: "Direct support channel for text conversations.",
    type: LeadSourceType.SMS,
    name: "Inbound SMS",
    mode: "direct",
  },
  {
    key: "facebook",
    label: "Facebook Marketplace",
    description: "Source tag only for v1, not a live integration.",
    type: LeadSourceType.FACEBOOK,
    name: "Facebook Marketplace",
    mode: "source_tag",
  },
  {
    key: "zillow",
    label: "Zillow",
    description: "Source tag only for v1, not a live integration.",
    type: LeadSourceType.ZILLOW,
    name: "Zillow",
    mode: "source_tag",
  },
  {
    key: "spareroom",
    label: "SpareRoom",
    description: "Source tag only for v1, not a live integration.",
    type: LeadSourceType.SPAREROOM,
    name: "SpareRoom",
    mode: "source_tag",
  },
  {
    key: "roomster",
    label: "Roomster",
    description: "Source tag only for v1, not a live integration.",
    type: LeadSourceType.ROOMSTER,
    name: "Roomster",
    mode: "source_tag",
  },
  {
    key: "craigslist",
    label: "Craigslist",
    description: "Source tag only for v1, not a live integration.",
    type: LeadSourceType.CRAIGSLIST,
    name: "Craigslist",
    mode: "source_tag",
  },
] as const;

export function parseNullableString(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function parseNullableInt(formData: FormData, key: string) {
  const value = parseNullableString(formData, key);

  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) ? parsed : null;
}

export function parseCheckbox(formData: FormData, key: string) {
  return formData.get(key) === "on";
}
