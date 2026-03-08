import assert from "node:assert/strict";
import test from "node:test";
import { Prisma, PropertyLifecycleStatus } from "@/generated/prisma/client";
import type {
  PropertyAvailabilityActionDependencies,
  PropertyCalendarTargetActionDependencies,
  PropertyLifecycleStatusActionDependencies,
  PropertyListingSourceMetadataActionDependencies,
  PropertyListingSyncStatusActionDependencies,
  PropertyOperationalDetailsActionDependencies,
  PropertyQuietHoursActionDependencies,
  PropertySchedulingLinkActionDependencies,
  TogglePropertyRuleActionDependencies,
} from "@/lib/property-actions";

function getPropertyActionsModule() {
  process.env.DATABASE_URL ??=
    "postgresql://postgres:postgres@localhost:5432/template1";

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("./property-actions") as typeof import("@/lib/property-actions");
}

function createWorkspaceState() {
  return {
    user: { id: "user-1" },
    workspace: { id: "workspace-1" },
  };
}

test("handleUpdatePropertySchedulingLinkAction validates URLs, persists changes, and clears links", async () => {
  const { handleUpdatePropertySchedulingLinkAction } = getPropertyActionsModule();

  const invalidFormData = new FormData();
  invalidFormData.set("schedulingUrl", "ftp://example.com/tour");

  await assert.rejects(
    handleUpdatePropertySchedulingLinkAction(
      "property-1",
      invalidFormData,
      {
        createAuditEvent: async () => undefined,
        findProperty: async () => ({ id: "property-1", name: "Maple Court" }),
        getCurrentWorkspaceState: async () => createWorkspaceState(),
        redirect: () => undefined as never,
        revalidatePath: () => undefined,
        updateProperty: async () => undefined,
      },
    ),
    /A valid scheduling URL is required/,
  );

  const updates: Array<{ id: string; schedulingUrl: string | null }> = [];
  const auditEvents: Array<{ eventType: string; payload: unknown }> = [];
  const revalidatedPaths: string[] = [];
  let redirectPath: string | null = null;
  const formData = new FormData();
  formData.set("schedulingUrl", "https://example.com/tour");

  const dependencies: PropertySchedulingLinkActionDependencies = {
    createAuditEvent: async (input) => {
      auditEvents.push({ eventType: input.eventType, payload: input.payload });
    },
    findProperty: async () => ({ id: "property-1", name: "Maple Court" }),
    getCurrentWorkspaceState: async () => createWorkspaceState(),
    redirect: (path) => {
      redirectPath = path;
      return undefined as never;
    },
    revalidatePath: (path) => {
      revalidatedPaths.push(path);
    },
    updateProperty: async (input) => {
      updates.push(input);
    },
  };

  await handleUpdatePropertySchedulingLinkAction("property-1", formData, dependencies);

  assert.deepEqual(updates, [{ id: "property-1", schedulingUrl: "https://example.com/tour" }]);
  assert.deepEqual(auditEvents, [
    {
      eventType: "Property scheduling link updated",
      payload: {
        propertyName: "Maple Court",
        schedulingUrl: "https://example.com/tour",
      },
    },
  ]);
  assert.deepEqual(revalidatedPaths, [
    "/app/properties",
    "/app/calendar",
    "/app/leads",
    "/app/properties/property-1/rules",
    "/app/properties/property-1/questions",
  ]);
  assert.equal(redirectPath, "/app/properties/property-1/rules");

  const clearedUpdates: unknown[] = [];
  await handleUpdatePropertySchedulingLinkAction(
    "property-1",
    (() => {
      const clearFormData = new FormData();
      clearFormData.set("schedulingUrl", "   ");
      clearFormData.set("redirectTo", "/app/properties/property-1/rules?tab=scheduling");
      return clearFormData;
    })(),
    {
      createAuditEvent: async () => undefined,
      findProperty: async () => ({ id: "property-1", name: "Maple Court" }),
      getCurrentWorkspaceState: async () => createWorkspaceState(),
      redirect: () => undefined as never,
      revalidatePath: () => undefined,
      updateProperty: async (input) => {
        clearedUpdates.push(input);
      },
    },
  );

  assert.deepEqual(clearedUpdates, [{ id: "property-1", schedulingUrl: null }]);
});

test("handleUpdatePropertyListingSourceMetadataAction validates URLs and persists trimmed metadata", async () => {
  const { handleUpdatePropertyListingSourceMetadataAction } = getPropertyActionsModule();

  const invalidFormData = new FormData();
  invalidFormData.set("listingSourceUrl", "ftp://example.com/listing");

  await assert.rejects(
    handleUpdatePropertyListingSourceMetadataAction(
      "property-1",
      invalidFormData,
      {
        createAuditEvent: async () => undefined,
        findProperty: async () => ({ id: "property-1", name: "Maple Court" }),
        getCurrentWorkspaceState: async () => createWorkspaceState(),
        redirect: () => undefined as never,
        revalidatePath: () => undefined,
        updateProperty: async () => undefined,
      },
    ),
    /A valid listing source url is required/,
  );

  const updates: unknown[] = [];
  const auditPayloads: unknown[] = [];
  let redirectPath: string | null = null;
  const formData = new FormData();
  formData.set("listingSourceName", " Zillow ");
  formData.set("listingSourceType", " Marketplace ");
  formData.set("listingSourceExternalId", " ext-123 ");
  formData.set("listingSourceUrl", "https://example.com/listing/123");
  formData.set("redirectTo", "/app/properties/property-1?tab=listing");

  const dependencies: PropertyListingSourceMetadataActionDependencies = {
    createAuditEvent: async (input) => {
      auditPayloads.push(input.payload);
    },
    findProperty: async () => ({ id: "property-1", name: "Maple Court" }),
    getCurrentWorkspaceState: async () => createWorkspaceState(),
    redirect: (path) => {
      redirectPath = path;
      return undefined as never;
    },
    revalidatePath: () => undefined,
    updateProperty: async (input) => {
      updates.push(input);
    },
  };

  await handleUpdatePropertyListingSourceMetadataAction("property-1", formData, dependencies);

  assert.deepEqual(updates, [
    {
      id: "property-1",
      listingSourceExternalId: "ext-123",
      listingSourceName: "Zillow",
      listingSourceType: "Marketplace",
      listingSourceUrl: "https://example.com/listing/123",
    },
  ]);
  assert.deepEqual(auditPayloads, [
    {
      listingSourceExternalId: "ext-123",
      listingSourceName: "Zillow",
      listingSourceType: "Marketplace",
      listingSourceUrl: "https://example.com/listing/123",
      propertyName: "Maple Court",
    },
  ]);
  assert.equal(redirectPath, "/app/properties/property-1?tab=listing");
});

test("handleUpdatePropertyListingSyncStatusAction validates status values and appends the formatted redirect status", async () => {
  const { handleUpdatePropertyListingSyncStatusAction } = getPropertyActionsModule();

  const invalidFormData = new FormData();
  invalidFormData.set("listingSyncStatus", "INVALID");

  await assert.rejects(
    handleUpdatePropertyListingSyncStatusAction(
      "property-1",
      invalidFormData,
      {
        createAuditEvent: async () => undefined,
        findProperty: async () => ({ id: "property-1", name: "Maple Court" }),
        formatPropertyListingSyncStatus: () => "Healthy",
        getCurrentWorkspaceState: async () => createWorkspaceState(),
        redirect: () => undefined as never,
        revalidatePath: () => undefined,
        updateProperty: async () => undefined,
      },
    ),
    /A valid property listing sync status is required/,
  );

  const updates: Array<{
    id: string;
    listingSyncMessage: string | null;
    listingSyncStatus: string | null;
    listingSyncUpdatedAt: Date | null;
  }> = [];
  const auditPayloads: unknown[] = [];
  let redirectPath: string | null = null;
  const formData = new FormData();
  formData.set("listingSyncStatus", "HEALTHY");
  formData.set("listingSyncMessage", " Refreshed successfully ");

  const dependencies: PropertyListingSyncStatusActionDependencies = {
    createAuditEvent: async (input) => {
      auditPayloads.push(input.payload);
    },
    findProperty: async () => ({ id: "property-1", name: "Maple Court" }),
    formatPropertyListingSyncStatus: () => "Healthy",
    getCurrentWorkspaceState: async () => createWorkspaceState(),
    redirect: (path) => {
      redirectPath = path;
      return undefined as never;
    },
    revalidatePath: () => undefined,
    updateProperty: async (input) => {
      updates.push(input);
    },
  };

  await handleUpdatePropertyListingSyncStatusAction("property-1", formData, dependencies);

  assert.equal(updates[0]?.id, "property-1");
  assert.equal(updates[0]?.listingSyncStatus, "HEALTHY");
  assert.equal(updates[0]?.listingSyncMessage, "Refreshed successfully");
  assert.ok(updates[0]?.listingSyncUpdatedAt instanceof Date);
  assert.deepEqual(auditPayloads, [
    {
      listingSyncMessage: "Refreshed successfully",
      listingSyncStatus: "HEALTHY",
      propertyName: "Maple Court",
    },
  ]);
  assert.equal(redirectPath, "/app/properties/property-1?listingSyncStatus=Healthy");
});

test("handleUpdatePropertyCalendarTargetAction persists trimmed calendar target fields and redirects", async () => {
  const { handleUpdatePropertyCalendarTargetAction } = getPropertyActionsModule();
  const updates: unknown[] = [];
  const auditPayloads: unknown[] = [];
  const revalidatedPaths: string[] = [];
  let redirectPath: string | null = null;
  const formData = new FormData();
  formData.set("calendarTargetExternalId", " ext-cal-1 ");
  formData.set("calendarTargetName", " Leasing Calendar ");
  formData.set("calendarTargetProvider", " google ");
  formData.set("redirectTo", "/app/properties/property-1?tab=calendar");

  const dependencies: PropertyCalendarTargetActionDependencies = {
    createAuditEvent: async (input) => {
      auditPayloads.push(input.payload);
    },
    findProperty: async () => ({ id: "property-1", name: "Maple Court" }),
    getCurrentWorkspaceState: async () => createWorkspaceState(),
    redirect: (path) => {
      redirectPath = path;
      return undefined as never;
    },
    revalidatePath: (path) => {
      revalidatedPaths.push(path);
    },
    updateProperty: async (input) => {
      updates.push(input);
    },
  };

  await handleUpdatePropertyCalendarTargetAction("property-1", formData, dependencies);

  assert.deepEqual(updates, [
    {
      id: "property-1",
      calendarTargetExternalId: "ext-cal-1",
      calendarTargetName: "Leasing Calendar",
      calendarTargetProvider: "google",
    },
  ]);
  assert.deepEqual(auditPayloads, [
    {
      calendarTargetExternalId: "ext-cal-1",
      calendarTargetName: "Leasing Calendar",
      calendarTargetProvider: "google",
      propertyName: "Maple Court",
    },
  ]);
  assert.deepEqual(revalidatedPaths, [
    "/app/calendar",
    "/app/properties",
    "/app/properties/property-1",
  ]);
  assert.equal(redirectPath, "/app/properties/property-1?tab=calendar");
});

test("handleUpdatePropertyOperationalDetailsAction validates non-negative counts and persists changes", async () => {
  const { handleUpdatePropertyOperationalDetailsAction } = getPropertyActionsModule();
  const invalidFormData = new FormData();
  invalidFormData.set("sharedBathroomCount", "-1");

  await assert.rejects(
    handleUpdatePropertyOperationalDetailsAction(
      "property-1",
      invalidFormData,
      {
        createAuditEvent: async () => undefined,
        findProperty: async () => ({ id: "property-1", name: "Maple Court" }),
        getCurrentWorkspaceState: async () => createWorkspaceState(),
        redirect: () => undefined as never,
        revalidatePath: () => undefined,
        updateProperty: async () => undefined,
      },
    ),
    /Shared bathroom count must be a non-negative whole number/,
  );

  const updates: unknown[] = [];
  const auditPayloads: unknown[] = [];
  let redirectPath: string | null = null;
  const formData = new FormData();
  formData.set("parkingAvailable", "on");
  formData.set("rentableRoomCount", " 4 ");
  formData.set("sharedBathroomCount", " 2 ");
  formData.set("redirectTo", "/app/properties/property-1?tab=operations");

  const dependencies: PropertyOperationalDetailsActionDependencies = {
    createAuditEvent: async (input) => {
      auditPayloads.push(input.payload);
    },
    findProperty: async () => ({ id: "property-1", name: "Maple Court" }),
    getCurrentWorkspaceState: async () => createWorkspaceState(),
    redirect: (path) => {
      redirectPath = path;
      return undefined as never;
    },
    revalidatePath: () => undefined,
    updateProperty: async (input) => {
      updates.push(input);
    },
  };

  await handleUpdatePropertyOperationalDetailsAction("property-1", formData, dependencies);

  assert.deepEqual(updates, [
    {
      id: "property-1",
      parkingAvailable: true,
      rentableRoomCount: 4,
      sharedBathroomCount: 2,
    },
  ]);
  assert.deepEqual(auditPayloads, [
    {
      parkingAvailable: true,
      propertyName: "Maple Court",
      rentableRoomCount: 4,
      sharedBathroomCount: 2,
    },
  ]);
  assert.equal(redirectPath, "/app/properties/property-1?tab=operations");
});

test("handleUpdatePropertyAvailabilityAction validates enabled availability windows", async () => {
  const { handleUpdatePropertyAvailabilityAction } = getPropertyActionsModule();
  const formData = new FormData();
  formData.set("availabilityEnabled", "on");

  const dependencies: PropertyAvailabilityActionDependencies = {
    createAuditEvent: async () => undefined,
    findProperty: async () => ({ id: "property-1", name: "Maple Court" }),
    getCurrentWorkspaceState: async () => createWorkspaceState(),
    redirect: () => undefined as never,
    revalidatePath: () => undefined,
    serializeAvailabilityWindowConfig: () => Prisma.JsonNull,
    updateProperty: async () => undefined,
    validateAvailabilityWindowConfig: () => ({
      days: [],
      endLocal: "17:00",
      startLocal: "09:00",
      timeZone: "America/New_York",
    }),
  };

  await assert.rejects(
    handleUpdatePropertyAvailabilityAction("property-1", formData, dependencies),
    /Property availability start, end, and time zone are required/,
  );
});

test("handleUpdatePropertyAvailabilityAction persists scheduling availability and redirects", async () => {
  const { handleUpdatePropertyAvailabilityAction } = getPropertyActionsModule();
  const formData = new FormData();
  formData.set("availabilityEnabled", "on");
  formData.set("availabilityStartLocal", "09:00");
  formData.set("availabilityEndLocal", "17:00");
  formData.set("availabilityTimeZone", "America/New_York");
  formData.append("availabilityDays", "MONDAY");
  formData.append("availabilityDays", "WEDNESDAY");

  const revalidatedPaths: string[] = [];
  const auditPayloads: unknown[] = [];
  const propertyUpdates: Array<{ id: string; schedulingAvailability: unknown }> = [];
  let redirectPath: string | null = null;

  const dependencies: PropertyAvailabilityActionDependencies = {
    createAuditEvent: async (input) => {
      auditPayloads.push(input);
    },
    findProperty: async () => ({ id: "property-1", name: "Maple Court" }),
    getCurrentWorkspaceState: async () => createWorkspaceState(),
    redirect: (path) => {
      redirectPath = path;
      return undefined as never;
    },
    revalidatePath: (path) => {
      revalidatedPaths.push(path);
    },
    serializeAvailabilityWindowConfig: (value) => value as never,
    updateProperty: async (input) => {
      propertyUpdates.push(input);
    },
    validateAvailabilityWindowConfig: (value) => value,
  };

  await handleUpdatePropertyAvailabilityAction("property-1", formData, dependencies);

  assert.deepEqual(propertyUpdates, [
    {
      id: "property-1",
      schedulingAvailability: {
        days: ["MONDAY", "WEDNESDAY"],
        endLocal: "17:00",
        startLocal: "09:00",
        timeZone: "America/New_York",
      },
    },
  ]);
  assert.equal(auditPayloads.length, 1);
  assert.deepEqual(revalidatedPaths, [
    "/app/calendar",
    "/app/leads",
    "/app/properties",
    "/app/properties/property-1",
  ]);
  assert.equal(redirectPath, "/app/properties/property-1");
});

test("handleUpdatePropertyAvailabilityAction rejects unknown properties and clears disabled availability", async () => {
  const { handleUpdatePropertyAvailabilityAction } = getPropertyActionsModule();

  await assert.rejects(
    handleUpdatePropertyAvailabilityAction(
      "missing-property",
      new FormData(),
      {
        createAuditEvent: async () => undefined,
        findProperty: async () => null,
        getCurrentWorkspaceState: async () => createWorkspaceState(),
        redirect: () => undefined as never,
        revalidatePath: () => undefined,
        serializeAvailabilityWindowConfig: () => Prisma.JsonNull,
        updateProperty: async () => undefined,
        validateAvailabilityWindowConfig: () => ({
          days: [],
          endLocal: "17:00",
          startLocal: "09:00",
          timeZone: "America/New_York",
        }),
      },
    ),
    /Property not found/,
  );

  const propertyUpdates: Array<{ id: string; schedulingAvailability: unknown }> = [];
  const auditPayloads: unknown[] = [];

  await handleUpdatePropertyAvailabilityAction(
    "property-1",
    new FormData(),
    {
      createAuditEvent: async (input) => {
        auditPayloads.push(input.payload);
      },
      findProperty: async () => ({ id: "property-1", name: "Maple Court" }),
      getCurrentWorkspaceState: async () => createWorkspaceState(),
      redirect: () => undefined as never,
      revalidatePath: () => undefined,
      serializeAvailabilityWindowConfig: () => Prisma.JsonNull,
      updateProperty: async (input) => {
        propertyUpdates.push(input);
      },
      validateAvailabilityWindowConfig: () => {
        throw new Error("should not validate disabled availability");
      },
    },
  );

  assert.deepEqual(propertyUpdates, [
    {
      id: "property-1",
      schedulingAvailability: Prisma.JsonNull,
    },
  ]);
  assert.deepEqual(auditPayloads, [
    {
      availabilityEnabled: false,
      propertyName: "Maple Court",
      schedulingAvailability: null,
    },
  ]);
});

test("handleTogglePropertyRuleActiveAction requires a property rule id", async () => {
  const { handleTogglePropertyRuleActiveAction } = getPropertyActionsModule();
  const dependencies: TogglePropertyRuleActionDependencies = {
    applyLeadEvaluation: async () => ({
      evaluation: {} as never,
      leadId: "lead-1",
    }),
    createAuditEvent: async () => undefined,
    findLeadsForProperty: async () => [],
    findPropertyRule: async () => null,
    getCurrentWorkspaceState: async () => createWorkspaceState(),
    redirect: () => undefined as never,
    revalidatePath: () => undefined,
    shouldRecomputeFitForTrigger: () => false,
    updatePropertyRule: async () => undefined,
  };

  await assert.rejects(
    handleTogglePropertyRuleActiveAction("property-1", new FormData(), dependencies),
    /Property rule id is required/,
  );
});

test("handleTogglePropertyRuleActiveAction reevaluates leads and audits failures", async () => {
  const { handleTogglePropertyRuleActiveAction } = getPropertyActionsModule();
  const formData = new FormData();
  formData.set("propertyRuleId", "rule-1");
  formData.set("nextActive", "false");

  const reevaluatedLeadIds: string[] = [];
  const auditEvents: Array<{ eventType: string; leadId?: string; payload: unknown }> = [];
  const revalidatedPaths: string[] = [];
  let redirectPath: string | null = null;

  const dependencies: TogglePropertyRuleActionDependencies = {
    applyLeadEvaluation: async ({ leadId }) => {
      reevaluatedLeadIds.push(leadId);

      if (leadId === "lead-2") {
        throw new Error("Evaluation failed");
      }

      return {
        evaluation: {} as never,
        leadId,
      };
    },
    createAuditEvent: async (input) => {
      auditEvents.push({
        eventType: input.eventType,
        leadId: input.leadId,
        payload: input.payload,
      });
    },
    findLeadsForProperty: async () => [{ id: "lead-1" }, { id: "lead-2" }],
    findPropertyRule: async () => ({
      id: "rule-1",
      label: "No smoking",
      property: {
        id: "property-1",
        name: "Maple Court",
      },
    }),
    getCurrentWorkspaceState: async () => createWorkspaceState(),
    redirect: (path) => {
      redirectPath = path;
      return undefined as never;
    },
    revalidatePath: (path) => {
      revalidatedPaths.push(path);
    },
    shouldRecomputeFitForTrigger: () => true,
    updatePropertyRule: async () => undefined,
  };

  await handleTogglePropertyRuleActiveAction("property-1", formData, dependencies);

  assert.deepEqual(reevaluatedLeadIds, ["lead-1", "lead-2"]);
  assert.equal(auditEvents[0]?.eventType, "property_rule_deactivated");
  assert.equal(auditEvents[1]?.eventType, "fit_recompute_failed_after_rule_change");
  assert.equal(auditEvents[1]?.leadId, "lead-2");
  assert.deepEqual(revalidatedPaths, [
    "/app",
    "/app/inbox",
    "/app/leads",
    "/app/properties",
    "/app/properties/property-1/rules",
  ]);
  assert.equal(redirectPath, "/app/properties/property-1/rules");
});

test("handleTogglePropertyRuleActiveAction rejects unknown rules and skips recompute when disabled", async () => {
  const { handleTogglePropertyRuleActiveAction } = getPropertyActionsModule();

  await assert.rejects(
    handleTogglePropertyRuleActiveAction(
      "property-1",
      (() => {
        const formData = new FormData();
        formData.set("propertyRuleId", "missing-rule");
        return formData;
      })(),
      {
        applyLeadEvaluation: async () => ({
          evaluation: {} as never,
          leadId: "lead-1",
        }),
        createAuditEvent: async () => undefined,
        findLeadsForProperty: async () => [],
        findPropertyRule: async () => null,
        getCurrentWorkspaceState: async () => createWorkspaceState(),
        redirect: () => undefined as never,
        revalidatePath: () => undefined,
        shouldRecomputeFitForTrigger: () => false,
        updatePropertyRule: async () => undefined,
      },
    ),
    /Property rule not found/,
  );

  const formData = new FormData();
  formData.set("propertyRuleId", "rule-1");
  formData.set("nextActive", "true");
  formData.set("redirectTo", "/app/properties/property-1/rules?tab=details");

  const ruleUpdates: Array<{ id: string; active: boolean }> = [];
  const auditEvents: string[] = [];
  let reevaluationAttempted = false;
  let redirectPath: string | null = null;

  await handleTogglePropertyRuleActiveAction("property-1", formData, {
    applyLeadEvaluation: async () => {
      reevaluationAttempted = true;
      return {
        evaluation: {} as never,
        leadId: "lead-1",
      };
    },
    createAuditEvent: async (input) => {
      auditEvents.push(input.eventType);
    },
    findLeadsForProperty: async () => [{ id: "lead-1" }],
    findPropertyRule: async () => ({
      id: "rule-1",
      label: "No smoking",
      property: {
        id: "property-1",
        name: "Maple Court",
      },
    }),
    getCurrentWorkspaceState: async () => createWorkspaceState(),
    redirect: (path) => {
      redirectPath = path;
      return undefined as never;
    },
    revalidatePath: () => undefined,
    shouldRecomputeFitForTrigger: () => false,
    updatePropertyRule: async (input) => {
      ruleUpdates.push(input);
    },
  });

  assert.deepEqual(ruleUpdates, [{ id: "rule-1", active: true }]);
  assert.deepEqual(auditEvents, ["property_rule_activated"]);
  assert.equal(reevaluationAttempted, false);
  assert.equal(redirectPath, "/app/properties/property-1/rules?tab=details");
});

test("handleUpdatePropertyLifecycleStatusAction validates, updates changed status, and skips no-op writes", async () => {
  const { handleUpdatePropertyLifecycleStatusAction } = getPropertyActionsModule();

  await assert.rejects(
    handleUpdatePropertyLifecycleStatusAction(
      "property-1",
      new FormData(),
      {
        createAuditEvent: async () => undefined,
        findProperty: async () => ({
          id: "property-1",
          lifecycleStatus: PropertyLifecycleStatus.ACTIVE,
          name: "Maple Court",
        }),
        formatPropertyLifecycleStatus: () => "Active",
        getCurrentWorkspaceState: async () => createWorkspaceState(),
        redirect: () => undefined as never,
        revalidatePath: () => undefined,
        updateProperty: async () => undefined,
      },
    ),
    /A valid property lifecycle status is required/,
  );

  const updatedProperties: Array<{ id: string; lifecycleStatus: PropertyLifecycleStatus }> = [];
  const auditEvents: unknown[] = [];
  const revalidatedPaths: string[] = [];
  let redirectPath: string | null = null;
  const formData = new FormData();
  formData.set("lifecycleStatus", PropertyLifecycleStatus.ARCHIVED);

  const dependencies: PropertyLifecycleStatusActionDependencies = {
    createAuditEvent: async (input) => {
      auditEvents.push(input.payload);
    },
    findProperty: async () => ({
      id: "property-1",
      lifecycleStatus: PropertyLifecycleStatus.ACTIVE,
      name: "Maple Court",
    }),
    formatPropertyLifecycleStatus: () => "Archived",
    getCurrentWorkspaceState: async () => createWorkspaceState(),
    redirect: (path) => {
      redirectPath = path;
      return undefined as never;
    },
    revalidatePath: (path) => {
      revalidatedPaths.push(path);
    },
    updateProperty: async (input) => {
      updatedProperties.push(input);
    },
  };

  await handleUpdatePropertyLifecycleStatusAction("property-1", formData, dependencies);

  assert.deepEqual(updatedProperties, [
    { id: "property-1", lifecycleStatus: PropertyLifecycleStatus.ARCHIVED },
  ]);
  assert.deepEqual(auditEvents, [
    {
      fromStatus: PropertyLifecycleStatus.ACTIVE,
      toStatus: PropertyLifecycleStatus.ARCHIVED,
      propertyName: "Maple Court",
    },
  ]);
  assert.deepEqual(revalidatedPaths, [
    "/app",
    "/app/calendar",
    "/app/inbox",
    "/app/leads",
    "/app/properties",
    "/app/properties/property-1",
    "/app/properties/property-1/questions",
    "/app/properties/property-1/rules",
  ]);
  assert.equal(redirectPath, "/app/properties/property-1?propertyStatus=Archived");

  const noOpUpdates: unknown[] = [];
  const noOpAuditEvents: unknown[] = [];
  await handleUpdatePropertyLifecycleStatusAction(
    "property-1",
    (() => {
      const sameStatusFormData = new FormData();
      sameStatusFormData.set("lifecycleStatus", PropertyLifecycleStatus.ACTIVE);
      sameStatusFormData.set("redirectTo", "/app/properties/property-1?tab=overview");
      return sameStatusFormData;
    })(),
    {
      createAuditEvent: async (input) => {
        noOpAuditEvents.push(input);
      },
      findProperty: async () => ({
        id: "property-1",
        lifecycleStatus: PropertyLifecycleStatus.ACTIVE,
        name: "Maple Court",
      }),
      formatPropertyLifecycleStatus: () => "Active",
      getCurrentWorkspaceState: async () => createWorkspaceState(),
      redirect: () => undefined as never,
      revalidatePath: () => undefined,
      updateProperty: async (input) => {
        noOpUpdates.push(input);
      },
    },
  );

  assert.deepEqual(noOpUpdates, []);
  assert.deepEqual(noOpAuditEvents, []);
});

test("handleUpdatePropertyQuietHoursAction validates overrides, persists values, and clears disabled overrides", async () => {
  const { handleUpdatePropertyQuietHoursAction } = getPropertyActionsModule();

  const invalidFormData = new FormData();
  invalidFormData.set("quietHoursOverrideEnabled", "on");

  await assert.rejects(
    handleUpdatePropertyQuietHoursAction(
      "property-1",
      invalidFormData,
      {
        createAuditEvent: async () => undefined,
        findProperty: async () => ({ id: "property-1", name: "Maple Court" }),
        getCurrentWorkspaceState: async () => createWorkspaceState(),
        redirect: () => undefined as never,
        revalidatePath: () => undefined,
        updateProperty: async () => undefined,
        validateQuietHoursConfig: (value) => ({
          ...value,
          endMinutes: 420,
          startMinutes: 1320,
        }),
      },
    ),
    /Property quiet hours start, end, and time zone are required when override is enabled/,
  );

  const updatedProperties: Array<{
    id: string;
    quietHoursEndLocal: string | null;
    quietHoursStartLocal: string | null;
    quietHoursTimeZone: string | null;
  }> = [];
  const auditPayloads: unknown[] = [];
  const revalidatedPaths: string[] = [];
  let redirectPath: string | null = null;
  const enabledFormData = new FormData();
  enabledFormData.set("quietHoursOverrideEnabled", "on");
  enabledFormData.set("quietHoursStartLocal", "22:00");
  enabledFormData.set("quietHoursEndLocal", "07:00");
  enabledFormData.set("quietHoursTimeZone", "America/New_York");

  const dependencies: PropertyQuietHoursActionDependencies = {
    createAuditEvent: async (input) => {
      auditPayloads.push(input.payload);
    },
    findProperty: async () => ({ id: "property-1", name: "Maple Court" }),
    getCurrentWorkspaceState: async () => createWorkspaceState(),
    redirect: (path) => {
      redirectPath = path;
      return undefined as never;
    },
    revalidatePath: (path) => {
      revalidatedPaths.push(path);
    },
    updateProperty: async (input) => {
      updatedProperties.push(input);
    },
    validateQuietHoursConfig: (value) => ({
      ...value,
      endMinutes: 420,
      startMinutes: 1320,
    }),
  };

  await handleUpdatePropertyQuietHoursAction("property-1", enabledFormData, dependencies);

  assert.deepEqual(updatedProperties, [
    {
      id: "property-1",
      quietHoursEndLocal: "07:00",
      quietHoursStartLocal: "22:00",
      quietHoursTimeZone: "America/New_York",
    },
  ]);
  assert.deepEqual(auditPayloads, [
    {
      propertyName: "Maple Court",
      quietHoursOverrideEnabled: true,
      quietHoursStartLocal: "22:00",
      quietHoursEndLocal: "07:00",
      quietHoursTimeZone: "America/New_York",
    },
  ]);
  assert.deepEqual(revalidatedPaths, [
    "/app/settings/integrations",
    "/app/properties",
    "/app/properties/property-1",
    "/app/inbox",
    "/app/leads",
  ]);
  assert.equal(redirectPath, "/app/properties/property-1");

  const clearedProperties: unknown[] = [];
  await handleUpdatePropertyQuietHoursAction(
    "property-1",
    (() => {
      const disabledFormData = new FormData();
      disabledFormData.set("redirectTo", "/app/properties/property-1?tab=quiet-hours");
      return disabledFormData;
    })(),
    {
      createAuditEvent: async () => undefined,
      findProperty: async () => ({ id: "property-1", name: "Maple Court" }),
      getCurrentWorkspaceState: async () => createWorkspaceState(),
      redirect: () => undefined as never,
      revalidatePath: () => undefined,
      updateProperty: async (input) => {
        clearedProperties.push(input);
      },
      validateQuietHoursConfig: () => {
        throw new Error("should not validate disabled quiet hours");
      },
    },
  );

  assert.deepEqual(clearedProperties, [
    {
      id: "property-1",
      quietHoursEndLocal: null,
      quietHoursStartLocal: null,
      quietHoursTimeZone: null,
    },
  ]);
});