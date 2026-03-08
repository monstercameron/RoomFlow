import assert from "node:assert/strict";
import test from "node:test";
import {
  ScreeningChargeMode,
  ScreeningConnectionAuthState,
  ScreeningRequestStatus,
} from "@/generated/prisma/client";
import {
  buildScreeningStatusTimestampUpdate,
  formatScreeningConnectionSummary,
  getScreeningStatusTimestampField,
  parseScreeningPackageConfig,
  resolveScreeningStatusTransitionGuard,
  resolveScreeningWebhookEventType,
  resolveScreeningWorkflowEventType,
  screeningStatusRequiresConsent,
} from "./screening";

test("parseScreeningPackageConfig ignores malformed entries", () => {
  const packages = parseScreeningPackageConfig([
    { isDefault: true, key: "standard", label: "Standard package" },
    { key: "", label: "Missing key" },
    null,
  ]);

  assert.deepEqual(packages, [
    {
      isDefault: true,
      key: "standard",
      label: "Standard package",
    },
  ]);
});

test("formatScreeningConnectionSummary reflects auth state and package details", () => {
  assert.equal(
    formatScreeningConnectionSummary({
      authState: ScreeningConnectionAuthState.ACTIVE,
      connectedAccount: "ops@roomflow.app",
      defaultPackageLabel: "Standard",
      lastError: null,
    }),
    "ops@roomflow.app · Standard · active",
  );
});

test("screening status timestamp helpers map statuses consistently", () => {
  assert.equal(
    getScreeningStatusTimestampField(ScreeningRequestStatus.CONSENT_COMPLETED),
    "consentCompletedAt",
  );

  const timestampUpdate = buildScreeningStatusTimestampUpdate(
    ScreeningRequestStatus.REVIEWED,
    new Date("2026-03-07T12:00:00.000Z"),
  );

  assert.deepEqual(timestampUpdate, {
    reviewedAt: new Date("2026-03-07T12:00:00.000Z"),
  });
});

test("screening charge mode enum remains available for forms", () => {
  assert.equal(ScreeningChargeMode.PASS_THROUGH, "PASS_THROUGH");
});

test("screening transition guard requires consent before later stages", () => {
  const transition = resolveScreeningStatusTransitionGuard({
    completedAt: null,
    consentCompletedAt: null,
    currentStatus: ScreeningRequestStatus.INVITE_SENT,
    nextStatus: ScreeningRequestStatus.IN_PROGRESS,
    reviewedAt: null,
  });

  assert.deepEqual(transition, {
    allowed: false,
    reason: "consent_required",
  });
  assert.equal(screeningStatusRequiresConsent(ScreeningRequestStatus.COMPLETED), true);
});

test("screening transition guard requires review before adverse action", () => {
  const transition = resolveScreeningStatusTransitionGuard({
    completedAt: new Date("2026-03-07T12:00:00.000Z"),
    consentCompletedAt: new Date("2026-03-07T10:00:00.000Z"),
    currentStatus: ScreeningRequestStatus.COMPLETED,
    nextStatus: ScreeningRequestStatus.ADVERSE_ACTION_RECORDED,
    reviewedAt: null,
  });

  assert.deepEqual(transition, {
    allowed: false,
    reason: "review_required",
  });
});

test("screening event helpers map reviewed lifecycle updates consistently", () => {
  assert.equal(
    resolveScreeningWorkflowEventType(ScreeningRequestStatus.REVIEWED),
    "screeningReviewed",
  );
  assert.equal(
    resolveScreeningWebhookEventType(ScreeningRequestStatus.ADVERSE_ACTION_RECORDED),
    "screening.adverse_action_recorded",
  );
});