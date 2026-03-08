import { PropertyListingSyncStatus } from "@/generated/prisma/client";

export const propertyListingSyncStatuses = [
  PropertyListingSyncStatus.HEALTHY,
  PropertyListingSyncStatus.PENDING,
  PropertyListingSyncStatus.FAILED,
  PropertyListingSyncStatus.OUT_OF_DATE,
] as const;

export function isPropertyListingSyncStatus(
  value: unknown,
): value is PropertyListingSyncStatus {
  return propertyListingSyncStatuses.includes(value as PropertyListingSyncStatus);
}

export function formatPropertyListingSyncStatus(
  propertyListingSyncStatus: PropertyListingSyncStatus,
) {
  switch (propertyListingSyncStatus) {
    case PropertyListingSyncStatus.HEALTHY:
      return "Healthy";
    case PropertyListingSyncStatus.PENDING:
      return "Pending";
    case PropertyListingSyncStatus.FAILED:
      return "Failed";
    case PropertyListingSyncStatus.OUT_OF_DATE:
      return "Out of date";
  }
}