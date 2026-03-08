import assert from "node:assert/strict";
import test from "node:test";
import {
  AuditActorType,
  MembershipRole,
  MessageChannel,
} from "@/generated/prisma/client";
import type { Workflow2PropertyActionDependencies } from "@/lib/workflow2-property";

function getWorkflow2PropertyModule() {
  process.env.DATABASE_URL ??=
    "postgresql://postgres:postgres@localhost:5432/template1";

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("./workflow2-property") as typeof import("@/lib/workflow2-property");
}

function createMembership(role: MembershipRole = MembershipRole.OWNER) {
  return {
    role,
    userId: "user-1",
    workspaceId: "workspace-1",
  };
}

function createValidFormData() {
  const formData = new FormData();
  formData.set("name", "Maple House");
  formData.set("propertyType", "Owner-occupied shared home");
  formData.set("addressLine1", "18 Maple Ave");
  formData.set("locality", "Providence, RI");
  formData.set("rentableRoomCount", "4");
  formData.set("sharedBathroomCount", "2");
  formData.set("schedulingUrl", "https://calendar.example.com/tour");

  return formData;
}

function createDependencies(
  overrides: Partial<Workflow2PropertyActionDependencies> = {},
): Workflow2PropertyActionDependencies {
  return {
    createAuditEvent: async () => undefined,
    createProperty: async () => ({ id: "property-1", name: "Maple House" }),
    findFirstPropertyForWorkspace: async () => null,
    getCurrentWorkspaceMembership: async () => createMembership(),
    redirect: () => undefined as never,
    revalidatePath: () => undefined,
    upsertPropertySettings: async () => undefined,
    updateProperty: async () => ({ id: "property-1", name: "Maple House" }),
    ...overrides,
  };
}

test("buildPropertyOnboardingRetryPath preserves form values and stable error state", () => {
  const { buildPropertyOnboardingRetryPath } = getWorkflow2PropertyModule();
  const formData = createValidFormData();
  formData.set("name", "");
  formData.set("parkingAvailable", "on");

  const retryPath = buildPropertyOnboardingRetryPath(
    formData,
    "Please add a property name.",
  );

  assert.match(retryPath, /^\/onboarding\/property\?/);

  const queryString = retryPath.split("?")[1];
  const searchParams = new URLSearchParams(queryString);

  assert.equal(searchParams.get("error"), "Please add a property name.");
  assert.equal(searchParams.get("name"), "");
  assert.equal(searchParams.get("propertyType"), "Owner-occupied shared home");
  assert.equal(searchParams.get("locality"), "Providence, RI");
  assert.equal(searchParams.get("rentableRoomCount"), "4");
  assert.equal(searchParams.get("parkingAvailable"), "1");
  assert.equal(searchParams.get("smokingAllowed"), "0");
});

test("handleSavePropertyOnboardingAction validates required fields and numeric constraints", async () => {
  const { handleSavePropertyOnboardingAction } = getWorkflow2PropertyModule();

  await assert.rejects(
    handleSavePropertyOnboardingAction(new FormData(), createDependencies()),
    /Please add a property name/,
  );

  const missingTypeFormData = createValidFormData();
  missingTypeFormData.set("propertyType", "   ");
  await assert.rejects(
    handleSavePropertyOnboardingAction(missingTypeFormData, createDependencies()),
    /Please choose a property type/,
  );

  const missingLocationFormData = createValidFormData();
  missingLocationFormData.set("locality", " ");
  await assert.rejects(
    handleSavePropertyOnboardingAction(missingLocationFormData, createDependencies()),
    /Please add a city, area, or address/,
  );

  const invalidRoomsFormData = createValidFormData();
  invalidRoomsFormData.set("rentableRoomCount", "0");
  await assert.rejects(
    handleSavePropertyOnboardingAction(invalidRoomsFormData, createDependencies()),
    /Please enter at least 1 rentable room/,
  );

  const invalidBathroomsFormData = createValidFormData();
  invalidBathroomsFormData.set("sharedBathroomCount", "-1");
  await assert.rejects(
    handleSavePropertyOnboardingAction(invalidBathroomsFormData, createDependencies()),
    /Shared bathroom count cannot be negative/,
  );
});

test("handleSavePropertyOnboardingAction creates the first property in the current workspace, logs audit state, and redirects", async () => {
  const { handleSavePropertyOnboardingAction } = getWorkflow2PropertyModule();
  const createdProperties: Array<{ data: unknown; workspaceId: string }> = [];
  const upsertedSettings: Array<unknown> = [];
  const auditEvents: Array<unknown> = [];
  const revalidatedPaths: string[] = [];
  let redirectPath: string | null = null;

  await handleSavePropertyOnboardingAction(
    (() => {
      const formData = createValidFormData();
      formData.set("sharedBathroomCount", "");
      return formData;
    })(),
    createDependencies({
      createAuditEvent: async (input) => {
        auditEvents.push(input);
      },
      createProperty: async (input) => {
        createdProperties.push(input);
        return { id: "property-1", name: "Maple House" };
      },
      redirect: (path) => {
        redirectPath = path;
        return undefined as never;
      },
      revalidatePath: (path) => {
        revalidatedPaths.push(path);
      },
      upsertPropertySettings: async (input) => {
        upsertedSettings.push(input);
      },
    }),
  );

  assert.deepEqual(createdProperties, [
    {
      workspaceId: "workspace-1",
      data: {
        addressLine1: "18 Maple Ave",
        locality: "Providence, RI",
        name: "Maple House",
        parkingAvailable: false,
        petsAllowed: false,
        propertyType: "Owner-occupied shared home",
        rentableRoomCount: 4,
        schedulingEnabled: true,
        schedulingUrl: "https://calendar.example.com/tour",
        sharedBathroomCount: null,
        smokingAllowed: false,
      },
    },
  ]);
  assert.deepEqual(auditEvents, [
    {
      actorType: AuditActorType.USER,
      actorUserId: "user-1",
      eventType: "property_created",
      payload: {
        createdBy: "user-1",
        initialType: "Owner-occupied shared home",
        onboardingSource: "initial_setup",
        propertyId: "property-1",
      },
      propertyId: "property-1",
      workspaceId: "workspace-1",
    },
    {
      actorType: AuditActorType.USER,
      actorUserId: "user-1",
      eventType: "ai_artifact_generated",
      payload: {
        artifactKind: "house_rules_generator",
        payload: {
          rules: [
            {
              category: "Lifestyle",
              description: "Applies to bedrooms and shared areas.",
              label: "No smoking",
              severity: "REQUIRED",
            },
            {
              category: "Compatibility",
              description: "Use when the house is pet-free because of allergies or lease limits.",
              label: "No pets",
              severity: "REQUIRED",
            },
            {
              category: "House operations",
              description: "Sets guest expectations up front for shared spaces.",
              label: "No frequent overnight guests",
              severity: "WARNING",
            },
            {
              category: "Screening",
              description: "Use when short stays create turnover problems.",
              label: "Minimum stay preferred",
              severity: "PREFERENCE",
            },
            {
              category: "House operations",
              description: "Captures agreement to house quiet hours.",
              label: "Quiet hours acknowledgment",
              severity: "WARNING",
            },
          ],
          summary:
            "Starter rules for Maple House based on the property type, bathroom setup, and household preferences captured during onboarding.",
        },
        status: "ready",
      },
      propertyId: "property-1",
      workspaceId: "workspace-1",
    },
    {
      actorType: AuditActorType.USER,
      actorUserId: "user-1",
      eventType: "ai_artifact_generated",
      payload: {
        artifactKind: "intake_form_generator",
        payload: {
          questions: [
            {
              fieldKey: "moveInDate",
              label: "When do you want to move in?",
              required: true,
              type: "DATE",
            },
            {
              fieldKey: "monthlyBudget",
              label: "What monthly budget are you working with?",
              required: true,
              type: "NUMBER",
            },
            {
              fieldKey: "stayLengthMonths",
              label: "How many months do you expect to stay?",
              required: true,
              type: "NUMBER",
            },
            {
              fieldKey: "noSmokingOk",
              label: "Can you follow a no-smoking house rule?",
              required: true,
              type: "YES_NO",
            },
            {
              fieldKey: "bringingPets",
              label: "Will you be bringing any pets?",
              required: true,
              type: "YES_NO",
            },
          ],
          rationale:
            "These questions are prepared from the first-property setup so later qualification can start from a concrete shared-housing baseline.",
          setName: "Maple House starter intake",
        },
        status: "ready",
      },
      propertyId: "property-1",
      workspaceId: "workspace-1",
    },
  ]);
  assert.deepEqual(upsertedSettings, [
    {
      defaultChannelPreference: MessageChannel.EMAIL,
      defaultFollowUpPolicy: "conservative",
      propertyId: "property-1",
      qualificationEnabled: true,
    },
  ]);
  assert.deepEqual(revalidatedPaths, ["/onboarding", "/app", "/app/properties"]);
  assert.equal(redirectPath, "/onboarding/house-rules");
});

test("handleSavePropertyOnboardingAction updates the existing onboarding property instead of creating a duplicate", async () => {
  const { handleSavePropertyOnboardingAction } = getWorkflow2PropertyModule();
  const updatedProperties: Array<unknown> = [];
  const createdProperties: unknown[] = [];
  const auditEvents: Array<unknown> = [];
  const upsertedSettings: Array<unknown> = [];

  await handleSavePropertyOnboardingAction(
    createValidFormData(),
    createDependencies({
      createAuditEvent: async (input) => {
        auditEvents.push(input);
      },
      createProperty: async (input) => {
        createdProperties.push(input);
        return { id: "property-2", name: "Should not create" };
      },
      findFirstPropertyForWorkspace: async () => ({
        id: "property-1",
        name: "Maple House",
      }),
      upsertPropertySettings: async (input) => {
        upsertedSettings.push(input);
      },
      updateProperty: async (input) => {
        updatedProperties.push(input);
        return { id: "property-1", name: "Maple House" };
      },
    }),
  );

  assert.deepEqual(createdProperties, []);
  assert.deepEqual(updatedProperties, [
    {
      id: "property-1",
      data: {
        addressLine1: "18 Maple Ave",
        locality: "Providence, RI",
        name: "Maple House",
        parkingAvailable: false,
        petsAllowed: false,
        propertyType: "Owner-occupied shared home",
        rentableRoomCount: 4,
        schedulingEnabled: true,
        schedulingUrl: "https://calendar.example.com/tour",
        sharedBathroomCount: 2,
        smokingAllowed: false,
      },
    },
  ]);
  assert.equal(auditEvents.length, 3);
  assert.deepEqual(upsertedSettings, [
    {
      defaultChannelPreference: MessageChannel.EMAIL,
      defaultFollowUpPolicy: "conservative",
      propertyId: "property-1",
      qualificationEnabled: true,
    },
  ]);
});

test("handleSavePropertyOnboardingAction blocks manager access and allows admin access", async () => {
  const { handleSavePropertyOnboardingAction } = getWorkflow2PropertyModule();

  await assert.rejects(
    handleSavePropertyOnboardingAction(
      createValidFormData(),
      createDependencies({
        getCurrentWorkspaceMembership: async () =>
          createMembership(MembershipRole.MANAGER),
      }),
    ),
    /Only workspace owners or admins can create the first property/,
  );

  let createCalls = 0;
  await handleSavePropertyOnboardingAction(
    createValidFormData(),
    createDependencies({
      createProperty: async () => {
        createCalls += 1;
        return { id: "property-1", name: "Maple House" };
      },
      getCurrentWorkspaceMembership: async () =>
        createMembership(MembershipRole.ADMIN),
    }),
  );

  assert.equal(createCalls, 1);
});