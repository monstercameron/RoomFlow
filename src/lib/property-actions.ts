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

export async function updatePropertySchedulingLinkAction(
  propertyId: string,
  formData: FormData,
) {
  const workspaceState = await getCurrentWorkspaceState();
  const schedulingUrl = parseSchedulingUrl(formData.get("schedulingUrl"));
  const redirectTargetValue = formData.get("redirectTo");

  const property = await prisma.property.findFirst({
    where: {
      id: propertyId,
      workspaceId: workspaceState.workspace.id,
    },
  });

  if (!property) {
    throw new Error("Property not found.");
  }

  await prisma.property.update({
    where: {
      id: property.id,
    },
    data: {
      schedulingUrl,
    },
  });

  await prisma.auditEvent.create({
    data: {
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
    },
  });

  revalidatePath("/app/properties");
  revalidatePath("/app/calendar");
  revalidatePath("/app/leads");
  revalidatePath(`/app/properties/${property.id}/rules`);
  revalidatePath(`/app/properties/${property.id}/questions`);

  const redirectTarget =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : `/app/properties/${property.id}/rules`;

  redirect(redirectTarget);
}

export async function updatePropertyListingSourceMetadataAction(
  propertyId: string,
  formData: FormData,
) {
  const workspaceState = await getCurrentWorkspaceState();
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

  const property = await prisma.property.findFirst({
    where: {
      id: propertyId,
      workspaceId: workspaceState.workspace.id,
    },
  });

  if (!property) {
    throw new Error("Property not found.");
  }

  await prisma.property.update({
    where: {
      id: property.id,
    },
    data: {
      listingSourceExternalId,
      listingSourceName,
      listingSourceType,
      listingSourceUrl,
    },
  });

  await prisma.auditEvent.create({
    data: {
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
    },
  });

  revalidatePath("/app/properties");
  revalidatePath(`/app/properties/${property.id}`);

  const redirectTarget =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : `/app/properties/${property.id}`;

  redirect(redirectTarget);
}

export async function updatePropertyListingSyncStatusAction(
  propertyId: string,
  formData: FormData,
) {
  const workspaceState = await getCurrentWorkspaceState();
  const redirectTargetValue = formData.get("redirectTo");
  const listingSyncStatus = parseOptionalPropertyListingSyncStatus(
    formData.get("listingSyncStatus"),
  );
  const listingSyncMessage = parseOptionalText(formData.get("listingSyncMessage"));

  const property = await prisma.property.findFirst({
    where: {
      id: propertyId,
      workspaceId: workspaceState.workspace.id,
    },
  });

  if (!property) {
    throw new Error("Property not found.");
  }

  await prisma.property.update({
    where: {
      id: property.id,
    },
    data: {
      listingSyncStatus,
      listingSyncMessage,
      listingSyncUpdatedAt: listingSyncStatus ? new Date() : null,
    },
  });

  await prisma.auditEvent.create({
    data: {
      workspaceId: workspaceState.workspace.id,
      propertyId: property.id,
      actorUserId: workspaceState.user.id,
      eventType: "property_listing_sync_status_updated",
      payload: {
        listingSyncMessage,
        listingSyncStatus,
        propertyName: property.name,
      },
    },
  });

  revalidatePath("/app/properties");
  revalidatePath(`/app/properties/${property.id}`);

  const redirectTarget =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : `/app/properties/${property.id}`;

  redirect(
    listingSyncStatus
      ? `${redirectTarget}?listingSyncStatus=${encodeURIComponent(
          formatPropertyListingSyncStatus(listingSyncStatus),
        )}`
      : redirectTarget,
  );
}

export async function updatePropertyCalendarTargetAction(
  propertyId: string,
  formData: FormData,
) {
  const workspaceState = await getCurrentWorkspaceState();
  const redirectTargetValue = formData.get("redirectTo");
  const calendarTargetExternalId = parseOptionalText(
    formData.get("calendarTargetExternalId"),
  );
  const calendarTargetName = parseOptionalText(formData.get("calendarTargetName"));
  const calendarTargetProvider = parseOptionalText(
    formData.get("calendarTargetProvider"),
  );

  const property = await prisma.property.findFirst({
    where: {
      id: propertyId,
      workspaceId: workspaceState.workspace.id,
    },
  });

  if (!property) {
    throw new Error("Property not found.");
  }

  await prisma.property.update({
    where: {
      id: property.id,
    },
    data: {
      calendarTargetExternalId,
      calendarTargetName,
      calendarTargetProvider,
    },
  });

  await prisma.auditEvent.create({
    data: {
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
    },
  });

  revalidatePath("/app/calendar");
  revalidatePath("/app/properties");
  revalidatePath(`/app/properties/${property.id}`);

  const redirectTarget =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : `/app/properties/${property.id}`;

  redirect(redirectTarget);
}

export async function updatePropertyOperationalDetailsAction(
  propertyId: string,
  formData: FormData,
) {
  const workspaceState = await getCurrentWorkspaceState();
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

  const property = await prisma.property.findFirst({
    where: {
      id: propertyId,
      workspaceId: workspaceState.workspace.id,
    },
  });

  if (!property) {
    throw new Error("Property not found.");
  }

  await prisma.property.update({
    where: {
      id: property.id,
    },
    data: {
      parkingAvailable,
      rentableRoomCount,
      sharedBathroomCount,
    },
  });

  await prisma.auditEvent.create({
    data: {
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
    },
  });

  revalidatePath("/app/properties");
  revalidatePath(`/app/properties/${property.id}`);

  const redirectTarget =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : `/app/properties/${property.id}`;

  redirect(redirectTarget);
}

export async function updatePropertyLifecycleStatusAction(
  propertyId: string,
  formData: FormData,
) {
  const workspaceState = await getCurrentWorkspaceState();
  const redirectTargetValue = formData.get("redirectTo");
  const nextLifecycleStatus = parsePropertyLifecycleStatus(
    formData.get("lifecycleStatus"),
  );

  const property = await prisma.property.findFirst({
    where: {
      id: propertyId,
      workspaceId: workspaceState.workspace.id,
    },
  });

  if (!property) {
    throw new Error("Property not found.");
  }

  if (property.lifecycleStatus !== nextLifecycleStatus) {
    await prisma.property.update({
      where: {
        id: property.id,
      },
      data: {
        lifecycleStatus: nextLifecycleStatus,
      },
    });

    await prisma.auditEvent.create({
      data: {
        workspaceId: workspaceState.workspace.id,
        propertyId: property.id,
        actorUserId: workspaceState.user.id,
        eventType: "property_lifecycle_status_updated",
        payload: {
          fromStatus: property.lifecycleStatus,
          toStatus: nextLifecycleStatus,
          propertyName: property.name,
        },
      },
    });
  }

  revalidatePath("/app");
  revalidatePath("/app/calendar");
  revalidatePath("/app/inbox");
  revalidatePath("/app/leads");
  revalidatePath("/app/properties");
  revalidatePath(`/app/properties/${property.id}`);
  revalidatePath(`/app/properties/${property.id}/questions`);
  revalidatePath(`/app/properties/${property.id}/rules`);

  const redirectTarget =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : `/app/properties/${property.id}`;

  redirect(
    `${redirectTarget}?propertyStatus=${encodeURIComponent(
      formatPropertyLifecycleStatus(nextLifecycleStatus),
    )}`,
  );
}

export async function updatePropertyQuietHoursAction(
  propertyId: string,
  formData: FormData,
) {
  const workspaceState = await getCurrentWorkspaceState();
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

    validateQuietHoursConfig({
      startLocal: quietHoursStartLocal,
      endLocal: quietHoursEndLocal,
      timeZone: quietHoursTimeZone,
    });
  }

  const property = await prisma.property.findFirst({
    where: {
      id: propertyId,
      workspaceId: workspaceState.workspace.id,
    },
  });

  if (!property) {
    throw new Error("Property not found.");
  }

  await prisma.property.update({
    where: {
      id: property.id,
    },
    data: {
      quietHoursStartLocal: quietHoursOverrideEnabled ? quietHoursStartLocal : null,
      quietHoursEndLocal: quietHoursOverrideEnabled ? quietHoursEndLocal : null,
      quietHoursTimeZone: quietHoursOverrideEnabled ? quietHoursTimeZone : null,
    },
  });

  await prisma.auditEvent.create({
    data: {
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
    },
  });

  revalidatePath("/app/settings/integrations");
  revalidatePath("/app/properties");
  revalidatePath(`/app/properties/${property.id}`);
  revalidatePath("/app/inbox");
  revalidatePath("/app/leads");

  const redirectTarget =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : `/app/properties/${property.id}`;

  redirect(redirectTarget);
}

export async function updatePropertyAvailabilityAction(
  propertyId: string,
  formData: FormData,
) {
  const workspaceState = await getCurrentWorkspaceState();
  const redirectTargetValue = formData.get("redirectTo");
  const availabilityEnabled = formData.get("availabilityEnabled") === "on";
  const startLocal = parseOptionalQuietHoursText(formData.get("availabilityStartLocal"));
  const endLocal = parseOptionalQuietHoursText(formData.get("availabilityEndLocal"));
  const timeZone = parseOptionalQuietHoursText(formData.get("availabilityTimeZone"));
  const days = parseAvailabilityDayValues(formData.getAll("availabilityDays"));

  if (availabilityEnabled && (!startLocal || !endLocal || !timeZone)) {
    throw new Error("Property availability start, end, and time zone are required when availability is enabled.");
  }

  const property = await prisma.property.findFirst({
    where: {
      id: propertyId,
      workspaceId: workspaceState.workspace.id,
    },
  });

  if (!property) {
    throw new Error("Property not found.");
  }

  const validatedSchedulingAvailability = availabilityEnabled
    ? validateAvailabilityWindowConfig({
        days,
        endLocal: endLocal ?? "",
        startLocal: startLocal ?? "",
        timeZone: timeZone ?? "",
      })
    : null;
  const schedulingAvailability = serializeAvailabilityWindowConfig(validatedSchedulingAvailability);

  await prisma.property.update({
    where: {
      id: property.id,
    },
    data: {
      schedulingAvailability,
    },
  });

  await prisma.auditEvent.create({
    data: {
      workspaceId: workspaceState.workspace.id,
      propertyId: property.id,
      actorUserId: workspaceState.user.id,
      eventType: "property_scheduling_availability_updated",
      payload: {
        availabilityEnabled,
        propertyName: property.name,
        schedulingAvailability: validatedSchedulingAvailability,
      },
    },
  });

  revalidatePath("/app/calendar");
  revalidatePath("/app/leads");
  revalidatePath("/app/properties");
  revalidatePath(`/app/properties/${property.id}`);

  const redirectTarget =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : `/app/properties/${property.id}`;

  redirect(redirectTarget);
}

export async function togglePropertyRuleActiveAction(
  propertyId: string,
  formData: FormData,
) {
  const workspaceState = await getCurrentWorkspaceState();
  const propertyRuleIdValue = formData.get("propertyRuleId");
  const nextActiveValue = formData.get("nextActive");
  const redirectTargetValue = formData.get("redirectTo");

  if (typeof propertyRuleIdValue !== "string" || propertyRuleIdValue.length === 0) {
    throw new Error("Property rule id is required.");
  }

  const propertyRule = await prisma.propertyRule.findFirst({
    where: {
      id: propertyRuleIdValue,
      propertyId,
      property: {
        workspaceId: workspaceState.workspace.id,
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
  });

  if (!propertyRule) {
    throw new Error("Property rule not found.");
  }

  const nextActive = parseBooleanFormValue(nextActiveValue);

  await prisma.propertyRule.update({
    where: {
      id: propertyRule.id,
    },
    data: {
      active: nextActive,
    },
  });

  await prisma.auditEvent.create({
    data: {
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
    },
  });

  if (shouldRecomputeFitForTrigger("rule_changed")) {
    const leadsForProperty = await prisma.lead.findMany({
      where: {
        workspaceId: workspaceState.workspace.id,
        propertyId: propertyRule.property.id,
      },
      select: {
        id: true,
      },
      take: 200,
    });

    for (const leadForProperty of leadsForProperty) {
      try {
        await applyLeadEvaluation({
          workspaceId: workspaceState.workspace.id,
          leadId: leadForProperty.id,
          actorUserId: workspaceState.user.id,
        });
      } catch {
        await prisma.auditEvent.create({
          data: {
            workspaceId: workspaceState.workspace.id,
            leadId: leadForProperty.id,
            propertyId: propertyRule.property.id,
            actorUserId: workspaceState.user.id,
            eventType: "fit_recompute_failed_after_rule_change",
            payload: {
              propertyRuleId: propertyRule.id,
            },
          },
        });
      }
    }
  }

  revalidatePath("/app");
  revalidatePath("/app/inbox");
  revalidatePath("/app/leads");
  revalidatePath("/app/properties");
  revalidatePath(`/app/properties/${propertyId}/rules`);

  const redirectTarget =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : `/app/properties/${propertyId}/rules`;

  redirect(redirectTarget);
}
