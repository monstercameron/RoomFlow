import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { getPropertiesViewData } from "@/lib/app-data";
import {
  getPropertyStatusChips,
  isPropertyIndexFilter,
  matchesPropertyIndexFilter,
  type PropertyIndexFilter,
} from "@/lib/property-summary";

const propertyIndexFilters: Array<{ label: string; value: PropertyIndexFilter }> = [
  { label: "All", value: "all" },
  { label: "Setup needed", value: "setup-needed" },
  { label: "Lead flow active", value: "lead-active" },
  { label: "Qualified demand", value: "qualified-demand" },
  { label: "Ready", value: "ready" },
];

function getChipClassName(chipTone: "default" | "success" | "warning") {
  switch (chipTone) {
    case "success":
      return "border-[rgba(61,122,88,0.2)] bg-[rgba(61,122,88,0.08)] text-[rgb(61,122,88)]";
    case "warning":
      return "border-[rgba(184,88,51,0.2)] bg-[rgba(184,88,51,0.08)] text-[var(--color-accent-strong)]";
    default:
      return "border-[var(--color-line)] bg-[var(--color-panel-strong)] text-[var(--color-muted)]";
  }
}

function formatFilterHref(propertyIndexFilter: PropertyIndexFilter) {
  return propertyIndexFilter === "all"
    ? "/app/properties"
    : `/app/properties?filter=${propertyIndexFilter}`;
}

export default async function PropertiesPage(props: {
  searchParams: Promise<{
    filter?: string;
  }>;
}) {
  const properties = await getPropertiesViewData();
  const searchParameters = await props.searchParams;
  const requestedPropertyIndexFilter = searchParameters.filter ?? "";
  const activePropertyIndexFilter: PropertyIndexFilter = isPropertyIndexFilter(
    requestedPropertyIndexFilter,
  )
    ? requestedPropertyIndexFilter
    : "all";
  const filteredProperties = properties.filter((property) =>
    matchesPropertyIndexFilter(property, activePropertyIndexFilter),
  );
  const setupNeededPropertyCount = properties.filter((property) =>
    matchesPropertyIndexFilter(property, "setup-needed"),
  ).length;
  const readyPropertyCount = properties.filter((property) =>
    matchesPropertyIndexFilter(property, "ready"),
  ).length;
  const activeLeadPropertyCount = properties.filter((property) => property.activeLeads > 0).length;

  return (
    <main>
      <PageHeader
        eyebrow="Properties"
        title="Property operations"
        description="Track which properties are ready for qualification flow, which ones still need setup work, and where lead demand is already landing."
        actions={
          <div className="flex flex-wrap gap-2">
            {propertyIndexFilters.map((propertyIndexFilter) => {
              const isActive = propertyIndexFilter.value === activePropertyIndexFilter;

              return (
                <Link
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                    isActive
                      ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-white"
                      : "border-[var(--color-line)] bg-[var(--color-panel)] text-[var(--color-muted)]"
                  }`}
                  href={formatFilterHref(propertyIndexFilter.value)}
                  key={propertyIndexFilter.value}
                >
                  {propertyIndexFilter.label}
                </Link>
              );
            })}
          </div>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
          <div className="text-sm text-[var(--color-muted)]">Properties tracked</div>
          <div className="mt-2 text-3xl font-semibold">{properties.length}</div>
          <div className="mt-2 text-sm text-[var(--color-muted)]">
            {activeLeadPropertyCount} with active lead flow
          </div>
        </div>
        <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
          <div className="text-sm text-[var(--color-muted)]">Ready for handoff</div>
          <div className="mt-2 text-3xl font-semibold">{readyPropertyCount}</div>
          <div className="mt-2 text-sm text-[var(--color-muted)]">
            Rules and scheduling already configured
          </div>
        </div>
        <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
          <div className="text-sm text-[var(--color-muted)]">Needs setup work</div>
          <div className="mt-2 text-3xl font-semibold">{setupNeededPropertyCount}</div>
          <div className="mt-2 text-sm text-[var(--color-muted)]">
            Missing rules, scheduling, or both
          </div>
        </div>
      </div>

      {filteredProperties.length === 0 ? (
        <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 text-sm text-[var(--color-muted)] shadow-[var(--shadow-panel)]">
          No properties matched this filter.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredProperties.map((property) => (
          <Link
            key={property.id}
            href={`/app/properties/${property.id}`}
            prefetch={false}
            className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-2xl font-semibold">{property.name}</div>
                <div className="mt-2 text-sm text-[var(--color-muted)]">
                  {[property.propertyType, property.locality, property.addressLine1]
                    .filter(Boolean)
                    .join(" • ") || "Property profile still needs more descriptive details."}
                </div>
                <div className="mt-2 text-sm text-[var(--color-muted)]">
                  Lifecycle: {property.lifecycleStatus}
                </div>
                <div className="mt-2 text-sm text-[var(--color-muted)]">
                  Listing source: {property.listingSourceName ?? property.listingSourceType ?? "Not set"}
                </div>
                <div className="mt-2 text-sm text-[var(--color-muted)]">
                  Sync status: {property.listingSyncStatus}
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                {getPropertyStatusChips(property).map((propertyStatusChip) => (
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${getChipClassName(propertyStatusChip.tone)}`}
                    key={`${property.id}-${propertyStatusChip.label}`}
                  >
                    {propertyStatusChip.label}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <div className="text-sm text-[var(--color-muted)]">Active rooms</div>
                <div className="mt-1 font-medium">{property.activeRooms}</div>
              </div>
              <div>
                <div className="text-sm text-[var(--color-muted)]">Active leads</div>
                <div className="mt-1 font-medium">{property.activeLeads}</div>
              </div>
              <div>
                <div className="text-sm text-[var(--color-muted)]">Qualified leads</div>
                <div className="mt-1 font-medium">{property.qualifiedLeads}</div>
              </div>
              <div>
                <div className="text-sm text-[var(--color-muted)]">Rules count</div>
                <div className="mt-1 font-medium">{property.rulesCount}</div>
              </div>
              <div>
                <div className="text-sm text-[var(--color-muted)]">Question sets</div>
                <div className="mt-1 font-medium">{property.questionSetCount}</div>
              </div>
              <div className="sm:col-span-2">
                <div className="text-sm text-[var(--color-muted)]">Scheduling</div>
                <div className="mt-1 font-medium">
                  {property.schedulingUrl
                    ? property.schedulingEnabled
                      ? "Scheduling link configured and enabled"
                      : "Scheduling link configured but disabled"
                    : "Scheduling link missing"}
                </div>
              </div>
              <div>
                <div className="text-sm text-[var(--color-muted)]">Shared bathrooms</div>
                <div className="mt-1 font-medium">{property.sharedBathroomCount}</div>
              </div>
              <div>
                <div className="text-sm text-[var(--color-muted)]">Parking</div>
                <div className="mt-1 font-medium">{property.parkingAvailable ? "Available" : "Unavailable"}</div>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-4 text-sm text-[var(--color-muted)]">
              <span>Open property overview</span>
              <span>Rules and question setup linked</span>
            </div>
          </Link>
          ))}
        </div>
      )}
    </main>
  );
}
