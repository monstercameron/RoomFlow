import { normalizedLeadFieldKeys } from "@/lib/lead-field-metadata";

const leadFieldLabelByKey: Record<(typeof normalizedLeadFieldKeys)[number], string> =
  {
    fullName: "Full name",
    email: "Email",
    phone: "Phone",
    moveInDate: "Move-in date",
    monthlyBudget: "Monthly budget",
    stayLengthMonths: "Stay length (months)",
    smokingStatus: "Smoking status",
    petStatus: "Pet status",
    parkingNeed: "Parking need",
    guestExpectations: "Guest expectations",
    bathroomSharingAcceptance: "Bathroom sharing acceptance",
    workStatus: "Work status",
  };

type LeadFieldMetadataRow = {
  key: (typeof normalizedLeadFieldKeys)[number];
  label: string;
  value: string;
  source: string;
  confidencePercent: number;
  isSuggested: boolean;
  lastUpdatedAt: string;
};

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function formatMetadataValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "Not provided";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  return JSON.stringify(value);
}

export function buildLeadFieldMetadataRows(
  leadFieldMetadata: unknown,
): LeadFieldMetadataRow[] {
  if (!isObjectRecord(leadFieldMetadata)) {
    return [];
  }

  const leadFieldMetadataRows: LeadFieldMetadataRow[] = [];

  for (const leadFieldKey of normalizedLeadFieldKeys) {
    const metadataEntry = leadFieldMetadata[leadFieldKey];

    if (!isObjectRecord(metadataEntry)) {
      continue;
    }

    const confidenceValue = metadataEntry.confidence;
    const sourceValue = metadataEntry.source;
    const lastUpdatedAtValue = metadataEntry.lastUpdatedAt;
    const isSuggestedValue = metadataEntry.isSuggested;

    if (
      typeof confidenceValue !== "number" ||
      typeof sourceValue !== "string" ||
      typeof lastUpdatedAtValue !== "string"
    ) {
      continue;
    }

    leadFieldMetadataRows.push({
      key: leadFieldKey,
      label: leadFieldLabelByKey[leadFieldKey],
      value: formatMetadataValue(metadataEntry.value),
      source: sourceValue,
      confidencePercent: Math.round(Math.max(0, Math.min(1, confidenceValue)) * 100),
      isSuggested:
        typeof isSuggestedValue === "boolean" ? isSuggestedValue : confidenceValue < 0.8,
      lastUpdatedAt: lastUpdatedAtValue,
    });
  }

  return leadFieldMetadataRows;
}
