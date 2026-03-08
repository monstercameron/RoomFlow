import { Prisma } from "@/generated/prisma/client";
import {
  ScreeningChargeMode,
  ScreeningConnectionAuthState,
  ScreeningProvider,
  ScreeningRequestStatus,
} from "@/generated/prisma/client";

export const screeningProviderOptions = [
  { label: "Checkr", value: ScreeningProvider.CHECKR },
  { label: "TransUnion", value: ScreeningProvider.TRANSUNION },
  { label: "Zumper", value: ScreeningProvider.ZUMPER },
] as const;

export const screeningConnectionAuthStateOptions = [
  { label: "Disconnected", value: ScreeningConnectionAuthState.DISCONNECTED },
  { label: "Configured", value: ScreeningConnectionAuthState.CONFIGURED },
  { label: "Active", value: ScreeningConnectionAuthState.ACTIVE },
  { label: "Error", value: ScreeningConnectionAuthState.ERROR },
] as const;

export const screeningChargeModeOptions = [
  { label: "Applicant pays", value: ScreeningChargeMode.APPLICANT_PAY },
  { label: "Landlord pays", value: ScreeningChargeMode.LANDLORD_PAY },
  { label: "Pass-through", value: ScreeningChargeMode.PASS_THROUGH },
] as const;

export const screeningRequestStatusOptions = [
  { label: "Requested", value: ScreeningRequestStatus.REQUESTED },
  { label: "Invite sent", value: ScreeningRequestStatus.INVITE_SENT },
  { label: "Consent completed", value: ScreeningRequestStatus.CONSENT_COMPLETED },
  { label: "In progress", value: ScreeningRequestStatus.IN_PROGRESS },
  { label: "Completed", value: ScreeningRequestStatus.COMPLETED },
  { label: "Reviewed", value: ScreeningRequestStatus.REVIEWED },
  {
    label: "Adverse action recorded",
    value: ScreeningRequestStatus.ADVERSE_ACTION_RECORDED,
  },
] as const;

const screeningStatusOrder = new Map(
  screeningRequestStatusOptions.map((option, index) => [option.value, index]),
);

export type ScreeningStatusTransitionGuardReason =
  | "consent_required"
  | "completion_required"
  | "review_required"
  | "reverse_transition";

export type ScreeningPackageConfig = {
  isDefault: boolean;
  key: string;
  label: string;
};

function normalizeScreeningPackageConfig(
  value: Partial<ScreeningPackageConfig> | null | undefined,
) {
  const key = typeof value?.key === "string" ? value.key.trim() : "";
  const label = typeof value?.label === "string" ? value.label.trim() : "";

  if (!key || !label) {
    return null;
  }

  return {
    isDefault: value?.isDefault === true,
    key,
    label,
  };
}

export function parseScreeningPackageConfig(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as ScreeningPackageConfig[];
  }

  return value
    .map((entry) =>
      normalizeScreeningPackageConfig(
        entry && typeof entry === "object" && !Array.isArray(entry)
          ? (entry as Partial<ScreeningPackageConfig>)
          : null,
      ),
    )
    .filter((entry): entry is ScreeningPackageConfig => Boolean(entry));
}

export function serializeScreeningPackageConfig(
  value: ReadonlyArray<ScreeningPackageConfig>,
): Prisma.InputJsonValue {
  return parseScreeningPackageConfig(value).map((entry) => ({
    isDefault: entry.isDefault,
    key: entry.key,
    label: entry.label,
  }));
}

export function formatScreeningConnectionSummary(params: {
  authState: ScreeningConnectionAuthState;
  connectedAccount: string | null;
  defaultPackageLabel: string | null;
  lastError: string | null;
}) {
  if (params.authState === ScreeningConnectionAuthState.DISCONNECTED) {
    return "Not connected";
  }

  const accountSummary = params.connectedAccount?.trim() || "Account pending";
  const packageSummary = params.defaultPackageLabel?.trim() || "Package not selected";

  if (params.authState === ScreeningConnectionAuthState.ERROR && params.lastError) {
    return `${accountSummary} · ${packageSummary} · Error: ${params.lastError}`;
  }

  return `${accountSummary} · ${packageSummary} · ${params.authState.toLowerCase()}`;
}

export function getScreeningStatusTimestampField(status: ScreeningRequestStatus) {
  switch (status) {
    case ScreeningRequestStatus.REQUESTED:
      return "requestedAt";
    case ScreeningRequestStatus.INVITE_SENT:
      return "inviteSentAt";
    case ScreeningRequestStatus.CONSENT_COMPLETED:
      return "consentCompletedAt";
    case ScreeningRequestStatus.IN_PROGRESS:
      return "startedAt";
    case ScreeningRequestStatus.COMPLETED:
      return "completedAt";
    case ScreeningRequestStatus.REVIEWED:
      return "reviewedAt";
    case ScreeningRequestStatus.ADVERSE_ACTION_RECORDED:
      return "adverseActionRecordedAt";
  }
}

export function buildScreeningStatusTimestampUpdate(
  status: ScreeningRequestStatus,
  referenceTime = new Date(),
) {
  const statusTimestampField = getScreeningStatusTimestampField(status);

  return {
    [statusTimestampField]: referenceTime,
  } as Record<string, Date>;
}

export function screeningStatusRequiresConsent(status: ScreeningRequestStatus) {
  return (
    status === ScreeningRequestStatus.IN_PROGRESS ||
    status === ScreeningRequestStatus.COMPLETED ||
    status === ScreeningRequestStatus.REVIEWED ||
    status === ScreeningRequestStatus.ADVERSE_ACTION_RECORDED
  );
}

export function resolveScreeningWorkflowEventType(status: ScreeningRequestStatus) {
  switch (status) {
    case ScreeningRequestStatus.CONSENT_COMPLETED:
      return "screeningConsentCompleted" as const;
    case ScreeningRequestStatus.COMPLETED:
      return "screeningCompleted" as const;
    case ScreeningRequestStatus.REVIEWED:
      return "screeningReviewed" as const;
    case ScreeningRequestStatus.ADVERSE_ACTION_RECORDED:
      return "screeningAdverseActionRecorded" as const;
    default:
      return "screeningRequested" as const;
  }
}

export function resolveScreeningWebhookEventType(status: ScreeningRequestStatus) {
  switch (status) {
    case ScreeningRequestStatus.CONSENT_COMPLETED:
      return "screening.consent_completed" as const;
    case ScreeningRequestStatus.COMPLETED:
      return "screening.completed" as const;
    case ScreeningRequestStatus.REVIEWED:
      return "screening.reviewed" as const;
    case ScreeningRequestStatus.ADVERSE_ACTION_RECORDED:
      return "screening.adverse_action_recorded" as const;
    default:
      return "screening.updated" as const;
  }
}

export function resolveScreeningStatusTransitionGuard(params: {
  completedAt: Date | null;
  consentCompletedAt: Date | null;
  currentStatus: ScreeningRequestStatus;
  nextStatus: ScreeningRequestStatus;
  reviewedAt: Date | null;
}) {
  if (params.currentStatus === params.nextStatus) {
    return {
      allowed: true,
      reason: null,
    } as const;
  }

  const currentOrder = screeningStatusOrder.get(params.currentStatus) ?? 0;
  const nextOrder = screeningStatusOrder.get(params.nextStatus) ?? 0;

  if (nextOrder < currentOrder) {
    return {
      allowed: false,
      reason: "reverse_transition",
    } as const;
  }

  const hasConsent =
    Boolean(params.consentCompletedAt) ||
    currentOrder >= (screeningStatusOrder.get(ScreeningRequestStatus.CONSENT_COMPLETED) ?? 2);

  if (screeningStatusRequiresConsent(params.nextStatus) && !hasConsent) {
    return {
      allowed: false,
      reason: "consent_required",
    } as const;
  }

  const hasCompleted =
    Boolean(params.completedAt) ||
    currentOrder >= (screeningStatusOrder.get(ScreeningRequestStatus.COMPLETED) ?? 4);

  if (params.nextStatus === ScreeningRequestStatus.REVIEWED && !hasCompleted) {
    return {
      allowed: false,
      reason: "completion_required",
    } as const;
  }

  const hasReviewed =
    Boolean(params.reviewedAt) ||
    currentOrder >= (screeningStatusOrder.get(ScreeningRequestStatus.REVIEWED) ?? 5);

  if (
    params.nextStatus === ScreeningRequestStatus.ADVERSE_ACTION_RECORDED &&
    !hasReviewed
  ) {
    return {
      allowed: false,
      reason: "review_required",
    } as const;
  }

  return {
    allowed: true,
    reason: null,
  } as const;
}