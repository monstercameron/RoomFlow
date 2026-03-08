"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentWorkspaceState } from "@/lib/app-data";
import {
  isAvailabilityDay,
  serializeAvailabilityWindowConfig,
  validateAvailabilityWindowConfig,
} from "@/lib/availability-windows";
import { applyLeadEvaluation } from "@/lib/lead-workflow";
import { shouldRecomputeFitForTrigger } from "@/lib/lead-rule-engine";
import {
  formatPropertyListingSyncStatus,
  isPropertyListingSyncStatus,
} from "@/lib/property-listing-sync";
import {
  formatPropertyLifecycleStatus,
  isPropertyLifecycleStatus,
} from "@/lib/property-lifecycle";
import { prisma } from "@/lib/prisma";
import { validateQuietHoursConfig } from "@/lib/quiet-hours";

type PropertyActionWorkspaceState = {
  user: {
    id: string;
  };
  workspace: {
    id: string;
  };
};

type PropertyAvailabilityConfigInput = {
  days: readonly import("@/lib/availability-windows").AvailabilityDay[];
  endLocal: string;
  startLocal: string;
  timeZone: string;
};

type SerializedAvailabilityWindowConfig = ReturnType<typeof serializeAvailabilityWindowConfig>;

export type PropertyAvailabilityActionDependencies = {
  createAuditEvent: (input: {
    workspaceId: string;
    propertyId: string;
    actorUserId: string;
    eventType: string;
    payload: unknown;
  }) => Promise<unknown>;
  findProperty: (input: { id: string; workspaceId: string }) => Promise<{
    id: string;
    name: string;
  } | null>;
  getCurrentWorkspaceState: () => Promise<PropertyActionWorkspaceState>;
  redirect: typeof redirect;
  revalidatePath: typeof revalidatePath;
  serializeAvailabilityWindowConfig: (value: PropertyAvailabilityConfigInput | null) => SerializedAvailabilityWindowConfig;
  updateProperty: (input: {
    id: string;
    schedulingAvailability: SerializedAvailabilityWindowConfig;
  }) => Promise<unknown>;
  validateAvailabilityWindowConfig: (value: PropertyAvailabilityConfigInput) => PropertyAvailabilityConfigInput;
};

const defaultPropertyAvailabilityActionDependencies: PropertyAvailabilityActionDependencies = {
  createAuditEvent: (input) =>
    prisma.auditEvent.create({
      data: {
        workspaceId: input.workspaceId,
        propertyId: input.propertyId,
        actorUserId: input.actorUserId,
        eventType: input.eventType,
        payload: input.payload as never,
      },
    }),
  findProperty: ({ id, workspaceId }) =>
    prisma.property.findFirst({
      where: {
        id,
        workspaceId,
      },
    }),
  getCurrentWorkspaceState,
  redirect,
  revalidatePath,
  serializeAvailabilityWindowConfig: (value) => serializeAvailabilityWindowConfig(value),
  updateProperty: ({ id, schedulingAvailability }) =>
    prisma.property.update({
      where: {
        id,
      },
      data: {
        schedulingAvailability,
      },
    }),
  validateAvailabilityWindowConfig,
};

export type TogglePropertyRuleActionDependencies = {
  applyLeadEvaluation: (params: {
    workspaceId: string;
    leadId: string;
    actorUserId: string;
  }) => Promise<unknown>;
  createAuditEvent: (input: {
    workspaceId: string;
    propertyId?: string;
    leadId?: string;
    actorUserId: string;
    eventType: string;
    payload: unknown;
  }) => Promise<unknown>;
  findLeadsForProperty: (input: {
    propertyId: string;
    workspaceId: string;
  }) => Promise<Array<{ id: string }>>;
  findPropertyRule: (input: {
    propertyId: string;
    propertyRuleId: string;
    workspaceId: string;
  }) => Promise<{
    id: string;
    label: string;
    property: {
      id: string;
      name: string;
    };
  } | null>;
  getCurrentWorkspaceState: () => Promise<PropertyActionWorkspaceState>;
  redirect: typeof redirect;
  revalidatePath: typeof revalidatePath;
  shouldRecomputeFitForTrigger: typeof shouldRecomputeFitForTrigger;
  updatePropertyRule: (input: { id: string; active: boolean }) => Promise<unknown>;
};

export type PropertyLifecycleStatusActionDependencies = {
  createAuditEvent: (input: {
    workspaceId: string;
    propertyId: string;
    actorUserId: string;
    eventType: string;
    payload: unknown;
  }) => Promise<unknown>;
  findProperty: (input: { id: string; workspaceId: string }) => Promise<{
    id: string;
    lifecycleStatus: import("@/generated/prisma/client").PropertyLifecycleStatus;
    name: string;
  } | null>;
  formatPropertyLifecycleStatus: typeof formatPropertyLifecycleStatus;
  getCurrentWorkspaceState: () => Promise<PropertyActionWorkspaceState>;
  redirect: typeof redirect;
  revalidatePath: typeof revalidatePath;
  updateProperty: (input: {
    id: string;
    lifecycleStatus: import("@/generated/prisma/client").PropertyLifecycleStatus;
  }) => Promise<unknown>;
};

export type PropertyQuietHoursActionDependencies = {
  createAuditEvent: (input: {
    workspaceId: string;
    propertyId: string;
    actorUserId: string;
    eventType: string;
    payload: unknown;
  }) => Promise<unknown>;
  findProperty: (input: { id: string; workspaceId: string }) => Promise<{
    id: string;
    name: string;
  } | null>;
  getCurrentWorkspaceState: () => Promise<PropertyActionWorkspaceState>;
  redirect: typeof redirect;
  revalidatePath: typeof revalidatePath;
  updateProperty: (input: {
    id: string;
    quietHoursEndLocal: string | null;
    quietHoursStartLocal: string | null;
    quietHoursTimeZone: string | null;
  }) => Promise<unknown>;
  validateQuietHoursConfig: typeof validateQuietHoursConfig;
};

type PropertyRecord = {
  id: string;
  name: string;
};

export type PropertySchedulingLinkActionDependencies = {
  createAuditEvent: (input: {
    workspaceId: string;
    propertyId: string;
    actorUserId: string;
    eventType: string;
    payload: unknown;
  }) => Promise<unknown>;
  findProperty: (input: { id: string; workspaceId: string }) => Promise<PropertyRecord | null>;
  getCurrentWorkspaceState: () => Promise<PropertyActionWorkspaceState>;
  redirect: typeof redirect;
  revalidatePath: typeof revalidatePath;
  updateProperty: (input: { id: string; schedulingUrl: string | null }) => Promise<unknown>;
};

export type PropertyListingSourceMetadataActionDependencies = {
  createAuditEvent: (input: {
    workspaceId: string;
    propertyId: string;
    actorUserId: string;
    eventType: string;
    payload: unknown;
  }) => Promise<unknown>;
  findProperty: (input: { id: string; workspaceId: string }) => Promise<PropertyRecord | null>;
  getCurrentWorkspaceState: () => Promise<PropertyActionWorkspaceState>;
  redirect: typeof redirect;
  revalidatePath: typeof revalidatePath;
  updateProperty: (input: {
    id: string;
    listingSourceExternalId: string | null;
    listingSourceName: string | null;
    listingSourceType: string | null;
    listingSourceUrl: string | null;
  }) => Promise<unknown>;
};

export type PropertyListingSyncStatusActionDependencies = {
  createAuditEvent: (input: {
    workspaceId: string;
    propertyId: string;
    actorUserId: string;
    eventType: string;
    payload: unknown;
  }) => Promise<unknown>;
  findProperty: (input: { id: string; workspaceId: string }) => Promise<PropertyRecord | null>;
  formatPropertyListingSyncStatus: typeof formatPropertyListingSyncStatus;
  getCurrentWorkspaceState: () => Promise<PropertyActionWorkspaceState>;
  redirect: typeof redirect;
  revalidatePath: typeof revalidatePath;
  updateProperty: (input: {
    id: string;
    listingSyncMessage: string | null;
    listingSyncStatus: import("@/generated/prisma/client").PropertyListingSyncStatus | null;
    listingSyncUpdatedAt: Date | null;
  }) => Promise<unknown>;
};

export type PropertyCalendarTargetActionDependencies = {
  createAuditEvent: (input: {
    workspaceId: string;
    propertyId: string;
    actorUserId: string;
    eventType: string;
    payload: unknown;
  }) => Promise<unknown>;
  findProperty: (input: { id: string; workspaceId: string }) => Promise<PropertyRecord | null>;
  getCurrentWorkspaceState: () => Promise<PropertyActionWorkspaceState>;
  redirect: typeof redirect;
  revalidatePath: typeof revalidatePath;
  updateProperty: (input: {
    id: string;
    calendarTargetExternalId: string | null;
    calendarTargetName: string | null;
    calendarTargetProvider: string | null;
  }) => Promise<unknown>;
};

export type PropertyOperationalDetailsActionDependencies = {
  createAuditEvent: (input: {
    workspaceId: string;
    propertyId: string;
    actorUserId: string;
    eventType: string;
    payload: unknown;
  }) => Promise<unknown>;
  findProperty: (input: { id: string; workspaceId: string }) => Promise<PropertyRecord | null>;
  getCurrentWorkspaceState: () => Promise<PropertyActionWorkspaceState>;
  redirect: typeof redirect;
  revalidatePath: typeof revalidatePath;
  updateProperty: (input: {
    id: string;
    parkingAvailable: boolean;
    rentableRoomCount: number | null;
    sharedBathroomCount: number | null;
  }) => Promise<unknown>;
};

const defaultTogglePropertyRuleActionDependencies: TogglePropertyRuleActionDependencies = {
  applyLeadEvaluation,
  createAuditEvent: (input) =>
    prisma.auditEvent.create({
      data: {
        workspaceId: input.workspaceId,
        propertyId: input.propertyId,
        leadId: input.leadId,
        actorUserId: input.actorUserId,
        eventType: input.eventType,
        payload: input.payload as never,
      },
    }),
  findLeadsForProperty: ({ propertyId, workspaceId }) =>
    prisma.lead.findMany({
      where: {
        workspaceId,
        propertyId,
      },
      select: {
        id: true,
      },
      take: 200,
    }),
  findPropertyRule: ({ propertyId, propertyRuleId, workspaceId }) =>
    prisma.propertyRule.findFirst({
      where: {
        id: propertyRuleId,
        propertyId,
        property: {
          workspaceId,
        },
      },
      include: {
        property: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
  getCurrentWorkspaceState,
  redirect,
  revalidatePath,
  shouldRecomputeFitForTrigger,
  updatePropertyRule: ({ id, active }) =>
    prisma.propertyRule.update({
      where: {
        id,
      },
      data: {
        active,
      },
    }),
};

const defaultPropertyLifecycleStatusActionDependencies: PropertyLifecycleStatusActionDependencies = {
  createAuditEvent: (input) =>
    prisma.auditEvent.create({
      data: {
        workspaceId: input.workspaceId,
        propertyId: input.propertyId,
        actorUserId: input.actorUserId,
        eventType: input.eventType,
        payload: input.payload as never,
      },
    }),
  findProperty: ({ id, workspaceId }) =>
    prisma.property.findFirst({
      where: {
        id,
        workspaceId,
      },
    }),
  formatPropertyLifecycleStatus,
  getCurrentWorkspaceState,
  redirect,
  revalidatePath,
  updateProperty: ({ id, lifecycleStatus }) =>
    prisma.property.update({
      where: {
        id,
      },
      data: {
        lifecycleStatus,
      },
    }),
};

const defaultPropertyQuietHoursActionDependencies: PropertyQuietHoursActionDependencies = {
  createAuditEvent: (input) =>
    prisma.auditEvent.create({
      data: {
        workspaceId: input.workspaceId,
        propertyId: input.propertyId,
        actorUserId: input.actorUserId,
        eventType: input.eventType,
        payload: input.payload as never,
      },
    }),
  findProperty: ({ id, workspaceId }) =>
    prisma.property.findFirst({
      where: {
        id,
        workspaceId,
      },
    }),
  getCurrentWorkspaceState,
  redirect,
  revalidatePath,
  updateProperty: ({ id, quietHoursEndLocal, quietHoursStartLocal, quietHoursTimeZone }) =>
    prisma.property.update({
      where: {
        id,
      },
      data: {
        quietHoursStartLocal,
        quietHoursEndLocal,
        quietHoursTimeZone,
      },
    }),
  validateQuietHoursConfig,
};

const defaultPropertySchedulingLinkActionDependencies: PropertySchedulingLinkActionDependencies = {
  createAuditEvent: (input) =>
    prisma.auditEvent.create({
      data: {
        workspaceId: input.workspaceId,
        propertyId: input.propertyId,
        actorUserId: input.actorUserId,
        eventType: input.eventType,
        payload: input.payload as never,
      },
    }),
  findProperty: ({ id, workspaceId }) =>
    prisma.property.findFirst({
      where: {
        id,
        workspaceId,
      },
    }),
  getCurrentWorkspaceState,
  redirect,
  revalidatePath,
  updateProperty: ({ id, schedulingUrl }) =>
    prisma.property.update({
      where: { id },
      data: { schedulingUrl },
    }),
};

const defaultPropertyListingSourceMetadataActionDependencies: PropertyListingSourceMetadataActionDependencies = {
  createAuditEvent: (input) =>
    prisma.auditEvent.create({
      data: {
        workspaceId: input.workspaceId,
        propertyId: input.propertyId,
        actorUserId: input.actorUserId,
        eventType: input.eventType,
        payload: input.payload as never,
      },
    }),
  findProperty: ({ id, workspaceId }) =>
    prisma.property.findFirst({
      where: {
        id,
        workspaceId,
      },
    }),
  getCurrentWorkspaceState,
  redirect,
  revalidatePath,
  updateProperty: ({ id, listingSourceExternalId, listingSourceName, listingSourceType, listingSourceUrl }) =>
    prisma.property.update({
      where: { id },
      data: {
        listingSourceExternalId,
        listingSourceName,
        listingSourceType,
        listingSourceUrl,
      },
    }),
};

const defaultPropertyListingSyncStatusActionDependencies: PropertyListingSyncStatusActionDependencies = {
  createAuditEvent: (input) =>
    prisma.auditEvent.create({
      data: {
        workspaceId: input.workspaceId,
        propertyId: input.propertyId,
        actorUserId: input.actorUserId,
        eventType: input.eventType,
        payload: input.payload as never,
      },
    }),
  findProperty: ({ id, workspaceId }) =>
    prisma.property.findFirst({
      where: {
        id,
        workspaceId,
      },
    }),
  formatPropertyListingSyncStatus,
  getCurrentWorkspaceState,
  redirect,
  revalidatePath,
  updateProperty: ({ id, listingSyncMessage, listingSyncStatus, listingSyncUpdatedAt }) =>
    prisma.property.update({
      where: { id },
      data: {
        listingSyncStatus,
        listingSyncMessage,
        listingSyncUpdatedAt,
      },
    }),
};

const defaultPropertyCalendarTargetActionDependencies: PropertyCalendarTargetActionDependencies = {
  createAuditEvent: (input) =>
    prisma.auditEvent.create({
      data: {
        workspaceId: input.workspaceId,
        propertyId: input.propertyId,
        actorUserId: input.actorUserId,
        eventType: input.eventType,
        payload: input.payload as never,
      },
    }),
  findProperty: ({ id, workspaceId }) =>
    prisma.property.findFirst({
      where: {
        id,
        workspaceId,
      },
    }),
  getCurrentWorkspaceState,
  redirect,
  revalidatePath,
  updateProperty: ({ id, calendarTargetExternalId, calendarTargetName, calendarTargetProvider }) =>
    prisma.property.update({
      where: { id },
      data: {
        calendarTargetExternalId,
        calendarTargetName,
        calendarTargetProvider,
      },
    }),
};

const defaultPropertyOperationalDetailsActionDependencies: PropertyOperationalDetailsActionDependencies = {
  createAuditEvent: (input) =>
    prisma.auditEvent.create({
      data: {
        workspaceId: input.workspaceId,
        propertyId: input.propertyId,
        actorUserId: input.actorUserId,
        eventType: input.eventType,
        payload: input.payload as never,
      },
    }),
  findProperty: ({ id, workspaceId }) =>
    prisma.property.findFirst({
      where: {
        id,
        workspaceId,
      },
    }),
  getCurrentWorkspaceState,
  redirect,
  revalidatePath,
  updateProperty: ({ id, parkingAvailable, rentableRoomCount, sharedBathroomCount }) =>
    prisma.property.update({
      where: { id },
      data: {
        parkingAvailable,
        rentableRoomCount,
        sharedBathroomCount,
      },
    }),
};

function parseSchedulingUrl(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  try {
    const parsed = new URL(normalized);

    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("Scheduling links must use http or https.");
    }

    return parsed.toString();
  } catch {
    throw new Error("A valid scheduling URL is required.");
  }
}

function parseOptionalHttpUrl(
  value: FormDataEntryValue | null,
  fieldLabel: string,
) {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return null;
  }

  try {
    const parsed = new URL(normalizedValue);

    if (![
      "http:",
      "https:",
    ].includes(parsed.protocol)) {
      throw new Error(`${fieldLabel} must use http or https.`);
    }

    return parsed.toString();
  } catch {
    throw new Error(`A valid ${fieldLabel.toLowerCase()} is required.`);
  }
}

function parseOptionalText(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();

  return normalizedValue.length > 0 ? normalizedValue : null;
}

function parseOptionalInteger(value: FormDataEntryValue | null, fieldLabel: string) {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return null;
  }

  const parsedValue = Number.parseInt(normalizedValue, 10);

  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    throw new Error(`${fieldLabel} must be a non-negative whole number.`);
  }

  return parsedValue;
}

function parseOptionalQuietHoursText(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();

  return normalizedValue.length > 0 ? normalizedValue : null;
}

function parseAvailabilityDayValues(values: FormDataEntryValue[]) {
  return values.filter(
    (value): value is import("@/lib/availability-windows").AvailabilityDay =>
      typeof value === "string" && isAvailabilityDay(value),
  );
}

function parseBooleanFormValue(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.toLowerCase() === "true";
}

function parsePropertyLifecycleStatus(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !isPropertyLifecycleStatus(value)) {
    throw new Error("A valid property lifecycle status is required.");
  }

  return value;
}

function parseOptionalPropertyListingSyncStatus(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  if (value.length === 0) {
    return null;
  }

  if (!isPropertyListingSyncStatus(value)) {
    throw new Error("A valid property listing sync status is required.");
  }

  return value;
}

export async function handleUpdatePropertySchedulingLinkAction(
  propertyId: string,
  formData: FormData,
  dependencies: PropertySchedulingLinkActionDependencies = defaultPropertySchedulingLinkActionDependencies,
) {
  const workspaceState = await dependencies.getCurrentWorkspaceState();
  const schedulingUrl = parseSchedulingUrl(formData.get("schedulingUrl"));
  const redirectTargetValue = formData.get("redirectTo");

  const property = await dependencies.findProperty({
    id: propertyId,
    workspaceId: workspaceState.workspace.id,
  });

  if (!property) {
    throw new Error("Property not found.");
  }

  await dependencies.updateProperty({
    id: property.id,
    schedulingUrl,
  });

  await dependencies.createAuditEvent({
    workspaceId: workspaceState.workspace.id,
    propertyId: property.id,
    actorUserId: workspaceState.user.id,
    eventType: schedulingUrl
      ? "Property scheduling link updated"
      : "Property scheduling link cleared",
    payload: {
      propertyName: property.name,
      schedulingUrl,
    },
  });

  dependencies.revalidatePath("/app/properties");
  dependencies.revalidatePath("/app/calendar");
  dependencies.revalidatePath("/app/leads");
  dependencies.revalidatePath(`/app/properties/${property.id}/rules`);
  dependencies.revalidatePath(`/app/properties/${property.id}/questions`);

  const redirectTarget =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : `/app/properties/${property.id}/rules`;

  dependencies.redirect(redirectTarget);
}

export async function updatePropertySchedulingLinkAction(
  propertyId: string,
  formData: FormData,
) {
  return handleUpdatePropertySchedulingLinkAction(propertyId, formData);
}

export async function handleUpdatePropertyListingSourceMetadataAction(
  propertyId: string,
  formData: FormData,
  dependencies: PropertyListingSourceMetadataActionDependencies = defaultPropertyListingSourceMetadataActionDependencies,
) {
  const workspaceState = await dependencies.getCurrentWorkspaceState();
  const redirectTargetValue = formData.get("redirectTo");
  const listingSourceName = parseOptionalText(formData.get("listingSourceName"));
  const listingSourceType = parseOptionalText(formData.get("listingSourceType"));
  const listingSourceExternalId = parseOptionalText(
    formData.get("listingSourceExternalId"),
  );
  const listingSourceUrl = parseOptionalHttpUrl(
    formData.get("listingSourceUrl"),
    "Listing source URL",
  );

  const property = await dependencies.findProperty({
    id: propertyId,
    workspaceId: workspaceState.workspace.id,
  });

  if (!property) {
    throw new Error("Property not found.");
  }

  await dependencies.updateProperty({
    id: property.id,
    listingSourceExternalId,
    listingSourceName,
    listingSourceType,
    listingSourceUrl,
  });

  await dependencies.createAuditEvent({
    workspaceId: workspaceState.workspace.id,
    propertyId: property.id,
    actorUserId: workspaceState.user.id,
    eventType: "property_listing_source_metadata_updated",
    payload: {
      listingSourceExternalId,
      listingSourceName,
      listingSourceType,
      listingSourceUrl,
      propertyName: property.name,
    },
  });

  dependencies.revalidatePath("/app/properties");
  dependencies.revalidatePath(`/app/properties/${property.id}`);

  const redirectTarget =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : `/app/properties/${property.id}`;

  dependencies.redirect(redirectTarget);
}

export async function updatePropertyListingSourceMetadataAction(
  propertyId: string,
  formData: FormData,
) {
  return handleUpdatePropertyListingSourceMetadataAction(propertyId, formData);
}

export async function handleUpdatePropertyListingSyncStatusAction(
  propertyId: string,
  formData: FormData,
  dependencies: PropertyListingSyncStatusActionDependencies = defaultPropertyListingSyncStatusActionDependencies,
) {
  const workspaceState = await dependencies.getCurrentWorkspaceState();
  const redirectTargetValue = formData.get("redirectTo");
  const listingSyncStatus = parseOptionalPropertyListingSyncStatus(
    formData.get("listingSyncStatus"),
  );
  const listingSyncMessage = parseOptionalText(formData.get("listingSyncMessage"));

  const property = await dependencies.findProperty({
    id: propertyId,
    workspaceId: workspaceState.workspace.id,
  });

  if (!property) {
    throw new Error("Property not found.");
  }

  await dependencies.updateProperty({
    id: property.id,
    listingSyncStatus,
    listingSyncMessage,
    listingSyncUpdatedAt: listingSyncStatus ? new Date() : null,
  });

  await dependencies.createAuditEvent({
    workspaceId: workspaceState.workspace.id,
    propertyId: property.id,
    actorUserId: workspaceState.user.id,
    eventType: "property_listing_sync_status_updated",
    payload: {
      listingSyncMessage,
      listingSyncStatus,
      propertyName: property.name,
    },
  });

  dependencies.revalidatePath("/app/properties");
  dependencies.revalidatePath(`/app/properties/${property.id}`);

  const redirectTarget =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : `/app/properties/${property.id}`;

  dependencies.redirect(
    listingSyncStatus
      ? `${redirectTarget}?listingSyncStatus=${encodeURIComponent(
          dependencies.formatPropertyListingSyncStatus(listingSyncStatus),
        )}`
      : redirectTarget,
  );
}

export async function updatePropertyListingSyncStatusAction(
  propertyId: string,
  formData: FormData,
) {
  return handleUpdatePropertyListingSyncStatusAction(propertyId, formData);
}

export async function handleUpdatePropertyCalendarTargetAction(
  propertyId: string,
  formData: FormData,
  dependencies: PropertyCalendarTargetActionDependencies = defaultPropertyCalendarTargetActionDependencies,
) {
  const workspaceState = await dependencies.getCurrentWorkspaceState();
  const redirectTargetValue = formData.get("redirectTo");
  const calendarTargetExternalId = parseOptionalText(
    formData.get("calendarTargetExternalId"),
  );
  const calendarTargetName = parseOptionalText(formData.get("calendarTargetName"));
  const calendarTargetProvider = parseOptionalText(
    formData.get("calendarTargetProvider"),
  );

  const property = await dependencies.findProperty({
    id: propertyId,
    workspaceId: workspaceState.workspace.id,
  });

  if (!property) {
    throw new Error("Property not found.");
  }

  await dependencies.updateProperty({
    id: property.id,
    calendarTargetExternalId,
    calendarTargetName,
    calendarTargetProvider,
  });

  await dependencies.createAuditEvent({
    workspaceId: workspaceState.workspace.id,
    propertyId: property.id,
    actorUserId: workspaceState.user.id,
    eventType: "property_calendar_target_updated",
    payload: {
      calendarTargetExternalId,
      calendarTargetName,
      calendarTargetProvider,
      propertyName: property.name,
    },
  });

  dependencies.revalidatePath("/app/calendar");
  dependencies.revalidatePath("/app/properties");
  dependencies.revalidatePath(`/app/properties/${property.id}`);

  const redirectTarget =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : `/app/properties/${property.id}`;

  dependencies.redirect(redirectTarget);
}

export async function updatePropertyCalendarTargetAction(
  propertyId: string,
  formData: FormData,
) {
  return handleUpdatePropertyCalendarTargetAction(propertyId, formData);
}

export async function handleUpdatePropertyOperationalDetailsAction(
  propertyId: string,
  formData: FormData,
  dependencies: PropertyOperationalDetailsActionDependencies = defaultPropertyOperationalDetailsActionDependencies,
) {
  const workspaceState = await dependencies.getCurrentWorkspaceState();
  const redirectTargetValue = formData.get("redirectTo");
  const parkingAvailable = formData.get("parkingAvailable") === "on";
  const rentableRoomCount = parseOptionalInteger(
    formData.get("rentableRoomCount"),
    "Rentable room count",
  );
  const sharedBathroomCount = parseOptionalInteger(
    formData.get("sharedBathroomCount"),
    "Shared bathroom count",
  );

  const property = await dependencies.findProperty({
    id: propertyId,
    workspaceId: workspaceState.workspace.id,
  });

  if (!property) {
    throw new Error("Property not found.");
  }

  await dependencies.updateProperty({
    id: property.id,
    parkingAvailable,
    rentableRoomCount,
    sharedBathroomCount,
  });

  await dependencies.createAuditEvent({
    workspaceId: workspaceState.workspace.id,
    propertyId: property.id,
    actorUserId: workspaceState.user.id,
    eventType: "property_operational_details_updated",
    payload: {
      parkingAvailable,
      propertyName: property.name,
      rentableRoomCount,
      sharedBathroomCount,
    },
  });

  dependencies.revalidatePath("/app/properties");
  dependencies.revalidatePath(`/app/properties/${property.id}`);

  const redirectTarget =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : `/app/properties/${property.id}`;

  dependencies.redirect(redirectTarget);
}

export async function updatePropertyOperationalDetailsAction(
  propertyId: string,
  formData: FormData,
) {
  return handleUpdatePropertyOperationalDetailsAction(propertyId, formData);
}

export async function handleUpdatePropertyLifecycleStatusAction(
  propertyId: string,
  formData: FormData,
  dependencies: PropertyLifecycleStatusActionDependencies = defaultPropertyLifecycleStatusActionDependencies,
) {
  const workspaceState = await dependencies.getCurrentWorkspaceState();
  const redirectTargetValue = formData.get("redirectTo");
  const nextLifecycleStatus = parsePropertyLifecycleStatus(
    formData.get("lifecycleStatus"),
  );

  const property = await dependencies.findProperty({
    id: propertyId,
    workspaceId: workspaceState.workspace.id,
  });

  if (!property) {
    throw new Error("Property not found.");
  }

  if (property.lifecycleStatus !== nextLifecycleStatus) {
    await dependencies.updateProperty({
      id: property.id,
      lifecycleStatus: nextLifecycleStatus,
    });

    await dependencies.createAuditEvent({
      workspaceId: workspaceState.workspace.id,
      propertyId: property.id,
      actorUserId: workspaceState.user.id,
      eventType: "property_lifecycle_status_updated",
      payload: {
        fromStatus: property.lifecycleStatus,
        toStatus: nextLifecycleStatus,
        propertyName: property.name,
      },
    });
  }

  dependencies.revalidatePath("/app");
  dependencies.revalidatePath("/app/calendar");
  dependencies.revalidatePath("/app/inbox");
  dependencies.revalidatePath("/app/leads");
  dependencies.revalidatePath("/app/properties");
  dependencies.revalidatePath(`/app/properties/${property.id}`);
  dependencies.revalidatePath(`/app/properties/${property.id}/questions`);
  dependencies.revalidatePath(`/app/properties/${property.id}/rules`);

  const redirectTarget =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : `/app/properties/${property.id}`;

  dependencies.redirect(
    `${redirectTarget}?propertyStatus=${encodeURIComponent(
      dependencies.formatPropertyLifecycleStatus(nextLifecycleStatus),
    )}`,
  );
}

export async function updatePropertyLifecycleStatusAction(
  propertyId: string,
  formData: FormData,
) {
  return handleUpdatePropertyLifecycleStatusAction(propertyId, formData);
}

export async function handleUpdatePropertyQuietHoursAction(
  propertyId: string,
  formData: FormData,
  dependencies: PropertyQuietHoursActionDependencies = defaultPropertyQuietHoursActionDependencies,
) {
  const workspaceState = await dependencies.getCurrentWorkspaceState();
  const redirectTargetValue = formData.get("redirectTo");
  const quietHoursOverrideEnabled =
    formData.get("quietHoursOverrideEnabled") === "on";
  const quietHoursStartLocal = parseOptionalQuietHoursText(
    formData.get("quietHoursStartLocal"),
  );
  const quietHoursEndLocal = parseOptionalQuietHoursText(
    formData.get("quietHoursEndLocal"),
  );
  const quietHoursTimeZone = parseOptionalQuietHoursText(
    formData.get("quietHoursTimeZone"),
  );

  if (quietHoursOverrideEnabled) {
    if (!quietHoursStartLocal || !quietHoursEndLocal || !quietHoursTimeZone) {
      throw new Error("Property quiet hours start, end, and time zone are required when override is enabled.");
    }

    dependencies.validateQuietHoursConfig({
      startLocal: quietHoursStartLocal,
      endLocal: quietHoursEndLocal,
      timeZone: quietHoursTimeZone,
    });
  }

  const property = await dependencies.findProperty({
    id: propertyId,
    workspaceId: workspaceState.workspace.id,
  });

  if (!property) {
    throw new Error("Property not found.");
  }

  await dependencies.updateProperty({
    id: property.id,
    quietHoursStartLocal: quietHoursOverrideEnabled ? quietHoursStartLocal : null,
    quietHoursEndLocal: quietHoursOverrideEnabled ? quietHoursEndLocal : null,
    quietHoursTimeZone: quietHoursOverrideEnabled ? quietHoursTimeZone : null,
  });

  await dependencies.createAuditEvent({
    workspaceId: workspaceState.workspace.id,
    propertyId: property.id,
    actorUserId: workspaceState.user.id,
    eventType: "property_quiet_hours_updated",
    payload: {
      propertyName: property.name,
      quietHoursOverrideEnabled,
      quietHoursStartLocal: quietHoursOverrideEnabled ? quietHoursStartLocal : null,
      quietHoursEndLocal: quietHoursOverrideEnabled ? quietHoursEndLocal : null,
      quietHoursTimeZone: quietHoursOverrideEnabled ? quietHoursTimeZone : null,
    },
  });

  dependencies.revalidatePath("/app/settings/integrations");
  dependencies.revalidatePath("/app/properties");
  dependencies.revalidatePath(`/app/properties/${property.id}`);
  dependencies.revalidatePath("/app/inbox");
  dependencies.revalidatePath("/app/leads");

  const redirectTarget =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : `/app/properties/${property.id}`;

  dependencies.redirect(redirectTarget);
}

export async function updatePropertyQuietHoursAction(
  propertyId: string,
  formData: FormData,
) {
  return handleUpdatePropertyQuietHoursAction(propertyId, formData);
}

export async function handleUpdatePropertyAvailabilityAction(
  propertyId: string,
  formData: FormData,
  dependencies: PropertyAvailabilityActionDependencies = defaultPropertyAvailabilityActionDependencies,
) {
  const workspaceState = await dependencies.getCurrentWorkspaceState();
  const redirectTargetValue = formData.get("redirectTo");
  const availabilityEnabled = formData.get("availabilityEnabled") === "on";
  const startLocal = parseOptionalQuietHoursText(formData.get("availabilityStartLocal"));
  const endLocal = parseOptionalQuietHoursText(formData.get("availabilityEndLocal"));
  const timeZone = parseOptionalQuietHoursText(formData.get("availabilityTimeZone"));
  const days = parseAvailabilityDayValues(formData.getAll("availabilityDays"));

  if (availabilityEnabled && (!startLocal || !endLocal || !timeZone)) {
    throw new Error("Property availability start, end, and time zone are required when availability is enabled.");
  }

  const property = await dependencies.findProperty({
    id: propertyId,
    workspaceId: workspaceState.workspace.id,
  });

  if (!property) {
    throw new Error("Property not found.");
  }

  const validatedSchedulingAvailability = availabilityEnabled
    ? dependencies.validateAvailabilityWindowConfig({
        days,
        endLocal: endLocal ?? "",
        startLocal: startLocal ?? "",
        timeZone: timeZone ?? "",
      })
    : null;
  const schedulingAvailability = dependencies.serializeAvailabilityWindowConfig(validatedSchedulingAvailability);

  await dependencies.updateProperty({
    id: property.id,
    schedulingAvailability,
  });

  await dependencies.createAuditEvent({
    workspaceId: workspaceState.workspace.id,
    propertyId: property.id,
    actorUserId: workspaceState.user.id,
    eventType: "property_scheduling_availability_updated",
    payload: {
      availabilityEnabled,
      propertyName: property.name,
      schedulingAvailability: validatedSchedulingAvailability,
    },
  });

  dependencies.revalidatePath("/app/calendar");
  dependencies.revalidatePath("/app/leads");
  dependencies.revalidatePath("/app/properties");
  dependencies.revalidatePath(`/app/properties/${property.id}`);

  const redirectTarget =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : `/app/properties/${property.id}`;

  dependencies.redirect(redirectTarget);
}

export async function updatePropertyAvailabilityAction(
  propertyId: string,
  formData: FormData,
) {
  return handleUpdatePropertyAvailabilityAction(propertyId, formData);
}

export async function handleTogglePropertyRuleActiveAction(
  propertyId: string,
  formData: FormData,
  dependencies: TogglePropertyRuleActionDependencies = defaultTogglePropertyRuleActionDependencies,
) {
  const workspaceState = await dependencies.getCurrentWorkspaceState();
  const propertyRuleIdValue = formData.get("propertyRuleId");
  const nextActiveValue = formData.get("nextActive");
  const redirectTargetValue = formData.get("redirectTo");

  if (typeof propertyRuleIdValue !== "string" || propertyRuleIdValue.length === 0) {
    throw new Error("Property rule id is required.");
  }

  const propertyRule = await dependencies.findPropertyRule({
    propertyId,
    propertyRuleId: propertyRuleIdValue,
    workspaceId: workspaceState.workspace.id,
  });

  if (!propertyRule) {
    throw new Error("Property rule not found.");
  }

  const nextActive = parseBooleanFormValue(nextActiveValue);

  await dependencies.updatePropertyRule({ id: propertyRule.id, active: nextActive });

  await dependencies.createAuditEvent({
    workspaceId: workspaceState.workspace.id,
    propertyId: propertyRule.property.id,
    actorUserId: workspaceState.user.id,
    eventType: nextActive
      ? "property_rule_activated"
      : "property_rule_deactivated",
    payload: {
      propertyRuleId: propertyRule.id,
      propertyRuleLabel: propertyRule.label,
      nextActive,
    },
  });

  if (dependencies.shouldRecomputeFitForTrigger("rule_changed")) {
    const leadsForProperty = await dependencies.findLeadsForProperty({
      propertyId: propertyRule.property.id,
      workspaceId: workspaceState.workspace.id,
    });

    for (const leadForProperty of leadsForProperty) {
      try {
        await dependencies.applyLeadEvaluation({
          workspaceId: workspaceState.workspace.id,
          leadId: leadForProperty.id,
          actorUserId: workspaceState.user.id,
        });
      } catch {
        await dependencies.createAuditEvent({
          workspaceId: workspaceState.workspace.id,
          leadId: leadForProperty.id,
          propertyId: propertyRule.property.id,
          actorUserId: workspaceState.user.id,
          eventType: "fit_recompute_failed_after_rule_change",
          payload: {
            propertyRuleId: propertyRule.id,
          },
        });
      }
    }
  }

  dependencies.revalidatePath("/app");
  dependencies.revalidatePath("/app/inbox");
  dependencies.revalidatePath("/app/leads");
  dependencies.revalidatePath("/app/properties");
  dependencies.revalidatePath(`/app/properties/${propertyId}/rules`);

  const redirectTarget =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : `/app/properties/${propertyId}/rules`;

  dependencies.redirect(redirectTarget);
}

export async function togglePropertyRuleActiveAction(
  propertyId: string,
  formData: FormData,
) {
  return handleTogglePropertyRuleActiveAction(propertyId, formData);
}
