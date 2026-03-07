type LeadNormalizationDiffEntry = {
  field: string;
  before: string | number | boolean | null;
  after: string | number | boolean | null;
};

type BuildLeadNormalizationDiffParams = {
  beforeLead: {
    propertyId: string | null;
    leadSourceId: string | null;
    fullName: string;
    email: string | null;
    phone: string | null;
    preferredContactChannel: string | null;
  };
  afterLead: {
    propertyId: string | null;
    leadSourceId: string | null;
    fullName: string;
    email: string | null;
    phone: string | null;
    preferredContactChannel: string | null;
  };
  beforeFieldMetadata: unknown;
  afterFieldMetadata: unknown;
};

function normalizeComparableValue(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  return JSON.stringify(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function buildLeadNormalizationDiff(
  params: BuildLeadNormalizationDiffParams,
) {
  const diffEntries: LeadNormalizationDiffEntry[] = [];

  const trackedLeadFields: Array<keyof BuildLeadNormalizationDiffParams["beforeLead"]> = [
    "propertyId",
    "leadSourceId",
    "fullName",
    "email",
    "phone",
    "preferredContactChannel",
  ];

  for (const trackedLeadField of trackedLeadFields) {
    const beforeValue = normalizeComparableValue(params.beforeLead[trackedLeadField]);
    const afterValue = normalizeComparableValue(params.afterLead[trackedLeadField]);

    if (beforeValue !== afterValue) {
      diffEntries.push({
        field: trackedLeadField,
        before: beforeValue,
        after: afterValue,
      });
    }
  }

  const beforeMetadataRecord = isRecord(params.beforeFieldMetadata)
    ? params.beforeFieldMetadata
    : {};
  const afterMetadataRecord = isRecord(params.afterFieldMetadata)
    ? params.afterFieldMetadata
    : {};
  const metadataFieldKeys = new Set([
    ...Object.keys(beforeMetadataRecord),
    ...Object.keys(afterMetadataRecord),
  ]);

  for (const metadataFieldKey of metadataFieldKeys) {
    const beforeMetadataValue = normalizeComparableValue(
      beforeMetadataRecord[metadataFieldKey],
    );
    const afterMetadataValue = normalizeComparableValue(
      afterMetadataRecord[metadataFieldKey],
    );

    if (beforeMetadataValue !== afterMetadataValue) {
      diffEntries.push({
        field: `fieldMetadata.${metadataFieldKey}`,
        before: beforeMetadataValue,
        after: afterMetadataValue,
      });
    }
  }

  return diffEntries;
}
