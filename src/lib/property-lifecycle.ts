import { PropertyLifecycleStatus } from "@/generated/prisma/client";

export const propertyLifecycleStatuses = [
  PropertyLifecycleStatus.ACTIVE,
  PropertyLifecycleStatus.INACTIVE,
  PropertyLifecycleStatus.ARCHIVED,
] as const;

export function isPropertyLifecycleStatus(
  value: unknown,
): value is PropertyLifecycleStatus {
  return propertyLifecycleStatuses.includes(value as PropertyLifecycleStatus);
}

export function formatPropertyLifecycleStatus(
  propertyLifecycleStatus: PropertyLifecycleStatus,
) {
  switch (propertyLifecycleStatus) {
    case PropertyLifecycleStatus.ACTIVE:
      return "Active";
    case PropertyLifecycleStatus.INACTIVE:
      return "Inactive";
    case PropertyLifecycleStatus.ARCHIVED:
      return "Archived";
  }
}

export function propertyAcceptsNewLeads(
  propertyLifecycleStatus: PropertyLifecycleStatus,
) {
  return propertyLifecycleStatus === PropertyLifecycleStatus.ACTIVE;
}