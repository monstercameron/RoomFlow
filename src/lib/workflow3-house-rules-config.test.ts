import assert from "node:assert/strict";
import test from "node:test";
import {
  getWorkflow3SuggestedRuleDrafts,
  hydrateWorkflow3DraftsFromExistingRules,
  mapModeToWorkflow3Severity,
} from "@/lib/workflow3-house-rules-config";

test("getWorkflow3SuggestedRuleDrafts varies defaults by property profile", () => {
  const ownerOccupiedDrafts = getWorkflow3SuggestedRuleDrafts({
    parkingAvailable: false,
    petsAllowed: false,
    propertyType: "Owner-occupied shared home",
    sharedBathroomCount: 1,
    smokingAllowed: false,
  });
  const colivingDrafts = getWorkflow3SuggestedRuleDrafts({
    parkingAvailable: true,
    petsAllowed: true,
    propertyType: "Co-living house",
    sharedBathroomCount: 0,
    smokingAllowed: true,
  });

  assert.deepEqual(ownerOccupiedDrafts.smoking, {
    enabled: true,
    selectedValue: "not_allowed",
    severity: "blocking",
    suggested: true,
  });
  assert.deepEqual(ownerOccupiedDrafts.pets, {
    enabled: true,
    selectedValue: "not_allowed",
    severity: "blocking",
    suggested: true,
  });
  assert.equal(ownerOccupiedDrafts.guests.selectedValue, "limited_overnight");
  assert.equal(ownerOccupiedDrafts.bathroomSharing.selectedValue, "must_be_comfortable_sharing");
  assert.equal(ownerOccupiedDrafts.parking.selectedValue, "no_parking");
  assert.equal(ownerOccupiedDrafts.minimumStay.selectedValue, "three_months_plus");
  assert.equal(ownerOccupiedDrafts.quietHours.selectedValue, "quiet_household");
  assert.equal(ownerOccupiedDrafts.quietHours.severity, "informational");

  assert.equal(colivingDrafts.smoking.enabled, false);
  assert.equal(colivingDrafts.pets.enabled, false);
  assert.equal(colivingDrafts.guests.selectedValue, "case_by_case");
  assert.equal(colivingDrafts.bathroomSharing.enabled, false);
  assert.equal(colivingDrafts.parking.selectedValue, "ask_first");
  assert.equal(colivingDrafts.minimumStay.selectedValue, "one_month_plus");
  assert.equal(colivingDrafts.quietHours.selectedValue, "standard_quiet_hours");
  assert.equal(colivingDrafts.quietHours.severity, "warning");
  assert.equal(colivingDrafts.furnishing.selectedValue, "varies");
});

test("hydrateWorkflow3DraftsFromExistingRules preserves custom rules and infers legacy structured values", () => {
  const hydrated = hydrateWorkflow3DraftsFromExistingRules({
    rules: [
      {
        category: "Smoking",
        description: "Smoking is acceptable only outside and away from shared spaces.",
        label: "Smoking: Allowed outside only",
        mode: "BLOCKING",
        ruleCategory: "GENERAL",
      },
      {
        category: "Minimum stay",
        description: "Stay length is flexible and should not strongly affect fit.",
        label: "Minimum stay: No preference",
        mode: "INFORMATIONAL",
        ruleCategory: "MINIMUM_STAY",
      },
      {
        category: "Household rhythm",
        description: "Noise expectations do not need to drive qualification right now.",
        label: "Quiet hours and noise: Not specified",
        mode: "WARNING_ONLY",
        ruleCategory: "QUIET_HOURS",
      },
      {
        category: "Room setup",
        description: "The room includes some furniture, but not a full setup.",
        label: "Furnishing and room setup: Partially furnished",
        mode: "INFORMATIONAL",
        ruleCategory: "FURNISHING",
      },
      {
        category: "Custom",
        description: "Keep kitchen cleanup same-day so shared spaces stay usable.",
        label: "Kitchen resets nightly",
        mode: "WARNING_ONLY",
        ruleCategory: "CUSTOM",
      },
    ],
  });

  assert.deepEqual(hydrated.ruleDrafts.smoking, {
    enabled: true,
    selectedValue: "outside_only",
    severity: "blocking",
    suggested: false,
  });
  assert.deepEqual(hydrated.ruleDrafts.minimumStay, {
    enabled: true,
    selectedValue: "no_preference",
    severity: "informational",
    suggested: false,
  });
  assert.deepEqual(hydrated.ruleDrafts.quietHours, {
    enabled: true,
    selectedValue: "not_specified",
    severity: "warning",
    suggested: false,
  });
  assert.deepEqual(hydrated.ruleDrafts.furnishing, {
    enabled: true,
    selectedValue: "partially_furnished",
    severity: "informational",
    suggested: false,
  });
  assert.deepEqual(hydrated.customRules, [
    {
      title: "Kitchen resets nightly",
      description: "Keep kitchen cleanup same-day so shared spaces stay usable.",
      severity: "warning",
    },
  ]);
});

test("mapModeToWorkflow3Severity maps rule modes to onboarding severity labels", () => {
  assert.equal(mapModeToWorkflow3Severity("BLOCKING"), "blocking");
  assert.equal(mapModeToWorkflow3Severity("WARNING_ONLY"), "warning");
  assert.equal(mapModeToWorkflow3Severity("INFORMATIONAL"), "informational");
});