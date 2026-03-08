import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import {
  AuditActorType,
  MembershipRole,
  MessageChannel,
} from "@/generated/prisma/client";
import {
  buildAiArtifactPayload,
  type HouseRulesGeneratorArtifact,
  type IntakeFormGeneratorArtifact,
} from "@/lib/ai-assist";
import { getCurrentWorkspaceMembership } from "@/lib/app-data";
import {
  onboardingRulePresets,
  parseCheckbox,
  parseNullableInt,
  parseNullableString,
} from "@/lib/onboarding";
import { canMembershipRoleManagePropertyScopes } from "@/lib/property-scopes";
import { prisma } from "@/lib/prisma";

export const workflow2PropertyTypeOptions = [
  {
    value: "Owner-occupied shared home",
    description: "Best when you live on-site and want rules tuned for shared daily routines.",
  },
  {
    value: "Non-owner-occupied shared home",
    description: "Use for shared houses you manage remotely or through a team.",
  },
  {
    value: "Small co-living property",
    description: "Fits multi-room shared housing with more structured operating norms.",
  },
  {
    value: "Other shared housing",
    description: "Choose this when the setup is shared housing but does not fit the other patterns.",
  },
] as const;

const maxPropertyNameLength = 100;

const retryFieldKeys = [
  "name",
  "propertyType",
  "addressLine1",
  "locality",
  "rentableRoomCount",
  "sharedBathroomCount",
  "schedulingUrl",
] as const;

const retryCheckboxKeys = [
  "parkingAvailable",
  "smokingAllowed",
  "petsAllowed",
] as const;

type Workflow2Membership = {
  role: MembershipRole;
  userId: string;
  workspaceId: string;
};

type Workflow2PropertyData = {
  addressLine1: string | null;
  locality: string;
  name: string;
  parkingAvailable: boolean;
  petsAllowed: boolean;
  propertyType: string;
  rentableRoomCount: number;
  schedulingEnabled: boolean;
  schedulingUrl: string | null;
  sharedBathroomCount: number | null;
  smokingAllowed: boolean;
};

type Workflow2PropertyRecord = {
  id: string;
  name: string;
};

type Workflow2PropertySettingsInput = {
  defaultChannelPreference: MessageChannel;
  defaultFollowUpPolicy: string;
  propertyId: string;
  qualificationEnabled: boolean;
};

type Workflow2AuditEventInput = {
  actorType: AuditActorType;
  actorUserId: string;
  eventType: string;
  payload: Prisma.InputJsonObject;
  propertyId: string;
  workspaceId: string;
};

export type Workflow2PropertyActionDependencies = {
  createAuditEvent: (input: Workflow2AuditEventInput) => Promise<void>;
  createProperty: (input: {
    data: Workflow2PropertyData;
    workspaceId: string;
  }) => Promise<Workflow2PropertyRecord>;
  findFirstPropertyForWorkspace: (
    workspaceId: string,
  ) => Promise<Workflow2PropertyRecord | null>;
  getCurrentWorkspaceMembership: () => Promise<Workflow2Membership>;
  redirect: (path: string) => never;
  revalidatePath: (path: string) => void;
  upsertPropertySettings: (input: Workflow2PropertySettingsInput) => Promise<void>;
  updateProperty: (input: {
    data: Workflow2PropertyData;
    id: string;
  }) => Promise<Workflow2PropertyRecord>;
};

export class PropertyOnboardingActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PropertyOnboardingActionError";
  }
}

export function buildPropertyOnboardingRetryPath(
  formData: FormData,
  errorMessage: string,
) {
  return buildPropertySetupRetryPath("/onboarding/property", formData, errorMessage);
}

export function buildPropertySetupRetryPath(
  basePath: string,
  formData: FormData,
  errorMessage: string,
) {
  const queryParameters = new URLSearchParams();

  queryParameters.set("error", errorMessage);

  for (const key of retryFieldKeys) {
    queryParameters.set(key, getRawStringValue(formData, key));
  }

  for (const key of retryCheckboxKeys) {
    queryParameters.set(key, formData.get(key) === "on" ? "1" : "0");
  }

  return `${basePath}?${queryParameters.toString()}`;
}

export async function handleSavePropertyOnboardingAction(
  formData: FormData,
  dependencies: Workflow2PropertyActionDependencies = defaultDependencies,
) {
  const workspaceMembership = await dependencies.getCurrentWorkspaceMembership();

  if (!canMembershipRoleManagePropertyScopes(workspaceMembership.role)) {
    throw new PropertyOnboardingActionError(
      "Only workspace owners or admins can create the first property.",
    );
  }

  const propertyData = parseWorkflow2PropertyData(formData);
  const existingProperty = await dependencies.findFirstPropertyForWorkspace(
    workspaceMembership.workspaceId,
  );
  const property = existingProperty
    ? await dependencies.updateProperty({
        id: existingProperty.id,
        data: propertyData,
      })
    : await dependencies.createProperty({
        workspaceId: workspaceMembership.workspaceId,
        data: propertyData,
      });

  await dependencies.createAuditEvent({
    workspaceId: workspaceMembership.workspaceId,
    propertyId: property.id,
    actorUserId: workspaceMembership.userId,
    actorType: AuditActorType.USER,
    eventType: existingProperty ? "property_onboarding_updated" : "property_created",
    payload: {
      createdBy: workspaceMembership.userId,
      initialType: propertyData.propertyType,
      onboardingSource: "initial_setup",
      propertyId: property.id,
    },
  });

  await dependencies.upsertPropertySettings({
    propertyId: property.id,
    qualificationEnabled: true,
    defaultChannelPreference: MessageChannel.EMAIL,
    defaultFollowUpPolicy: "conservative",
  });

  const suggestedRules = buildWorkflow2SuggestedRules(propertyData);
  const suggestedIntakeForm = buildWorkflow2SuggestedIntakeForm(
    propertyData,
    suggestedRules,
  );

  await dependencies.createAuditEvent({
    workspaceId: workspaceMembership.workspaceId,
    propertyId: property.id,
    actorUserId: workspaceMembership.userId,
    actorType: AuditActorType.USER,
    eventType: "ai_artifact_generated",
    payload: buildAiArtifactPayload(
      "house_rules_generator",
      suggestedRules,
    ) as Prisma.InputJsonObject,
  });

  await dependencies.createAuditEvent({
    workspaceId: workspaceMembership.workspaceId,
    propertyId: property.id,
    actorUserId: workspaceMembership.userId,
    actorType: AuditActorType.USER,
    eventType: "ai_artifact_generated",
    payload: buildAiArtifactPayload(
      "intake_form_generator",
      suggestedIntakeForm,
    ) as Prisma.InputJsonObject,
  });

  dependencies.revalidatePath("/onboarding");
  dependencies.revalidatePath("/app");
  dependencies.revalidatePath("/app/properties");
  dependencies.redirect("/onboarding/house-rules");
}

export async function handleCreatePropertyAction(
  formData: FormData,
  dependencies: Workflow2PropertyActionDependencies = defaultDependencies,
) {
  const workspaceMembership = await dependencies.getCurrentWorkspaceMembership();

  if (!canMembershipRoleManagePropertyScopes(workspaceMembership.role)) {
    throw new PropertyOnboardingActionError(
      "Only workspace owners or admins can add properties.",
    );
  }

  const propertyData = parseWorkflow2PropertyData(formData);
  const property = await dependencies.createProperty({
    workspaceId: workspaceMembership.workspaceId,
    data: propertyData,
  });

  await dependencies.createAuditEvent({
    workspaceId: workspaceMembership.workspaceId,
    propertyId: property.id,
    actorUserId: workspaceMembership.userId,
    actorType: AuditActorType.USER,
    eventType: "property_created",
    payload: {
      createdBy: workspaceMembership.userId,
      initialType: propertyData.propertyType,
      onboardingSource: "app_properties",
      propertyId: property.id,
    },
  });

  await dependencies.upsertPropertySettings({
    propertyId: property.id,
    qualificationEnabled: true,
    defaultChannelPreference: MessageChannel.EMAIL,
    defaultFollowUpPolicy: "conservative",
  });

  const suggestedRules = buildWorkflow2SuggestedRules(propertyData);
  const suggestedIntakeForm = buildWorkflow2SuggestedIntakeForm(
    propertyData,
    suggestedRules,
  );

  await dependencies.createAuditEvent({
    workspaceId: workspaceMembership.workspaceId,
    propertyId: property.id,
    actorUserId: workspaceMembership.userId,
    actorType: AuditActorType.USER,
    eventType: "ai_artifact_generated",
    payload: buildAiArtifactPayload(
      "house_rules_generator",
      suggestedRules,
    ) as Prisma.InputJsonObject,
  });

  await dependencies.createAuditEvent({
    workspaceId: workspaceMembership.workspaceId,
    propertyId: property.id,
    actorUserId: workspaceMembership.userId,
    actorType: AuditActorType.USER,
    eventType: "ai_artifact_generated",
    payload: buildAiArtifactPayload(
      "intake_form_generator",
      suggestedIntakeForm,
    ) as Prisma.InputJsonObject,
  });

  dependencies.revalidatePath("/app");
  dependencies.revalidatePath("/app/properties");
  dependencies.redirect(`/app/properties/${property.id}`);
}

function getRawStringValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function parseWorkflow2PropertyData(formData: FormData): Workflow2PropertyData {
  const name = parseNullableString(formData, "name");
  const propertyType = parseNullableString(formData, "propertyType");
  const locality = parseNullableString(formData, "locality");
  const rentableRoomCount = parseNullableInt(formData, "rentableRoomCount");
  const sharedBathroomCount = parseNullableInt(formData, "sharedBathroomCount");
  const schedulingUrl = parseNullableString(formData, "schedulingUrl");

  if (!name) {
    throw new PropertyOnboardingActionError("Please add a property name.");
  }

  if (name.length > maxPropertyNameLength) {
    throw new PropertyOnboardingActionError(
      `Property names must be ${maxPropertyNameLength} characters or less.`,
    );
  }

  if (!propertyType) {
    throw new PropertyOnboardingActionError("Please choose a property type.");
  }

  if (!locality) {
    throw new PropertyOnboardingActionError(
      "Please add a city, area, or address.",
    );
  }

  if (!rentableRoomCount || rentableRoomCount < 1) {
    throw new PropertyOnboardingActionError(
      "Please enter at least 1 rentable room.",
    );
  }

  if (sharedBathroomCount !== null && sharedBathroomCount < 0) {
    throw new PropertyOnboardingActionError(
      "Shared bathroom count cannot be negative.",
    );
  }

  if (schedulingUrl) {
    const parsedSchedulingUrl = URL.parse(schedulingUrl);

    if (
      !parsedSchedulingUrl ||
      (parsedSchedulingUrl.protocol !== "http:" &&
        parsedSchedulingUrl.protocol !== "https:")
    ) {
      throw new PropertyOnboardingActionError(
        "Please enter a valid scheduling link.",
      );
    }
  }

  return {
    name,
    propertyType,
    addressLine1: parseNullableString(formData, "addressLine1"),
    locality,
    rentableRoomCount,
    sharedBathroomCount,
    parkingAvailable: parseCheckbox(formData, "parkingAvailable"),
    smokingAllowed: parseCheckbox(formData, "smokingAllowed"),
    petsAllowed: parseCheckbox(formData, "petsAllowed"),
    schedulingEnabled: Boolean(schedulingUrl),
    schedulingUrl,
  };
}

function buildWorkflow2SuggestedRules(
  propertyData: Workflow2PropertyData,
): HouseRulesGeneratorArtifact {
  const suggestedPresetKeys = new Set<string>();

  if (!propertyData.smokingAllowed) {
    suggestedPresetKeys.add("no_smoking");
  }

  if (!propertyData.petsAllowed) {
    suggestedPresetKeys.add("no_pets");
  }

  if ((propertyData.sharedBathroomCount ?? 0) > 0) {
    suggestedPresetKeys.add("shared_bathroom");
  }

  if (
    propertyData.propertyType === "Owner-occupied shared home" ||
    (propertyData.sharedBathroomCount ?? 0) > 0
  ) {
    suggestedPresetKeys.add("quiet_hours");
    suggestedPresetKeys.add("no_overnight_guests");
  }

  if (propertyData.rentableRoomCount >= 4) {
    suggestedPresetKeys.add("minimum_stay");
  }

  return {
    summary: `Starter rules for ${propertyData.name} based on the property type, bathroom setup, and household preferences captured during onboarding.`,
    rules: onboardingRulePresets
      .filter((preset) => suggestedPresetKeys.has(preset.key))
      .map((preset) => ({
        label: preset.label,
        description: preset.description,
        severity: preset.severity,
        category: preset.category,
      })),
  };
}

function buildWorkflow2SuggestedIntakeForm(
  propertyData: Workflow2PropertyData,
  suggestedRules: HouseRulesGeneratorArtifact,
): IntakeFormGeneratorArtifact {
  const questions: IntakeFormGeneratorArtifact["questions"] = [
    {
      label: "When do you want to move in?",
      fieldKey: "moveInDate",
      type: "DATE",
      required: true,
    },
    {
      label: "What monthly budget are you working with?",
      fieldKey: "monthlyBudget",
      type: "NUMBER",
      required: true,
    },
    {
      label: "How many months do you expect to stay?",
      fieldKey: "stayLengthMonths",
      type: "NUMBER",
      required: true,
    },
  ];

  if ((propertyData.sharedBathroomCount ?? 0) > 0) {
    questions.push({
      label: "Are you comfortable sharing a bathroom?",
      fieldKey: "sharedBathroomOk",
      type: "YES_NO",
      required: true,
    });
  }

  if (suggestedRules.rules.some((rule) => rule.label === "No smoking")) {
    questions.push({
      label: "Can you follow a no-smoking house rule?",
      fieldKey: "noSmokingOk",
      type: "YES_NO",
      required: true,
    });
  }

  if (suggestedRules.rules.some((rule) => rule.label === "No pets")) {
    questions.push({
      label: "Will you be bringing any pets?",
      fieldKey: "bringingPets",
      type: "YES_NO",
      required: true,
    });
  }

  return {
    setName: `${propertyData.name} starter intake`,
    rationale:
      "These questions are prepared from the first-property setup so later qualification can start from a concrete shared-housing baseline.",
    questions,
  };
}

const defaultDependencies: Workflow2PropertyActionDependencies = {
  createAuditEvent: async (input) => {
    await prisma.auditEvent.create({
      data: input,
    });
  },
  createProperty: async (input) => {
    const property = await prisma.property.create({
      data: {
        workspaceId: input.workspaceId,
        ...input.data,
      },
      select: {
        id: true,
        name: true,
      },
    });

    return property;
  },
  findFirstPropertyForWorkspace: async (workspaceId) => {
    return prisma.property.findFirst({
      where: {
        workspaceId,
      },
      orderBy: {
        createdAt: "asc",
      },
      select: {
        id: true,
        name: true,
      },
    });
  },
  getCurrentWorkspaceMembership,
  redirect,
  revalidatePath,
  upsertPropertySettings: async (input) => {
    await prisma.propertySettings.upsert({
      where: {
        propertyId: input.propertyId,
      },
      create: input,
      update: {
        defaultChannelPreference: input.defaultChannelPreference,
        defaultFollowUpPolicy: input.defaultFollowUpPolicy,
        qualificationEnabled: input.qualificationEnabled,
      },
    });
  },
  updateProperty: async (input) => {
    const property = await prisma.property.update({
      where: {
        id: input.id,
      },
      data: input.data,
      select: {
        id: true,
        name: true,
      },
    });

    return property;
  },
};