import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { getPropertyDetailViewData } from "@/lib/app-data";
import {
  updatePropertyCalendarTargetAction,
  updatePropertyLifecycleStatusAction,
  updatePropertyListingSourceMetadataAction,
  updatePropertyListingSyncStatusAction,
  updatePropertyOperationalDetailsAction,
  updatePropertyQuietHoursAction,
  updatePropertySchedulingLinkAction,
} from "@/lib/property-actions";
import {
  formatPropertyListingSyncStatus,
  propertyListingSyncStatuses,
} from "@/lib/property-listing-sync";
import {
  formatPropertyLifecycleStatus,
  propertyLifecycleStatuses,
} from "@/lib/property-lifecycle";
import { getPropertyStatusChips } from "@/lib/property-summary";

type PropertyDetailPageProps = {
  params: Promise<{
    propertyId: string;
  }>;
};
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

function getAmenityLabel(enabled: boolean, enabledLabel: string, disabledLabel: string) {
  return enabled ? enabledLabel : disabledLabel;
}

function getPropertySetupTasks(property: NonNullable<Awaited<ReturnType<typeof getPropertyDetailViewData>>>) {
  const propertySetupTasks: string[] = [];

  if (property.lifecycleStatusValue !== "ACTIVE") {
    propertySetupTasks.push(
      "Return the property to Active before expecting automated lead qualification or new assignments.",
    );
  }

  if (property.rulesCount === 0) {
    propertySetupTasks.push("Add at least one active property rule so qualification has real guardrails.");
  }

  if (property.questionSetCount === 0) {
    propertySetupTasks.push("Create a qualification question set so lead intake can capture consistent answers.");
  }

  if (!property.schedulingUrl) {
    propertySetupTasks.push("Save a scheduling URL before handing qualified leads to the tour workflow.");
  }

  if (!property.propertyType || !property.addressLine1 || !property.locality) {
    propertySetupTasks.push("Fill in the missing property profile fields so operators have enough context in the workspace.");
  }

  return propertySetupTasks;
}

export default async function PropertyDetailPage({ params }: PropertyDetailPageProps) {
  const { propertyId } = await params;
  const property = await getPropertyDetailViewData(propertyId);

  if (!property) {
    notFound();
  }

  const propertySetupTasks = getPropertySetupTasks(property);

  return (
    <main>
      <PageHeader
        eyebrow="Property detail"
        title={property.name}
        description="Review the property profile, readiness signals, communication defaults, and scheduling handoff from one place before drilling into rules or questions."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-2 text-sm font-medium"
              href="/app/properties"
            >
              Back to properties
            </Link>
            <Link
              className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-2 text-sm font-medium"
              href={`/app/properties/${property.id}/rules`}
            >
              Open rules
            </Link>
            <Link
              className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-2 text-sm font-medium"
              href={`/app/properties/${property.id}/questions`}
            >
              View questions
            </Link>
          </div>
        }
      />

      <section className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-sm text-[var(--color-muted)]">
              {[property.propertyType, property.locality, property.addressLine1]
                .filter(Boolean)
                .join(" • ") || "Property profile is still missing descriptive details."}
            </div>
            <div className="mt-2 text-sm text-[var(--color-muted)]">
              Lifecycle: {property.lifecycleStatus}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
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
          <div className="grid gap-2 text-sm text-[var(--color-muted)] sm:text-right">
            <div>Created {property.createdAtLabel}</div>
            <div>Updated {property.updatedAtLabel}</div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-4">
            <div className="text-sm text-[var(--color-muted)]">Active leads</div>
            <div className="mt-2 text-3xl font-semibold">{property.activeLeads}</div>
            <div className="mt-2 text-sm text-[var(--color-muted)]">{property.totalLeadCount} total assigned</div>
          </div>
          <div className="rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-4">
            <div className="text-sm text-[var(--color-muted)]">Qualified demand</div>
            <div className="mt-2 text-3xl font-semibold">{property.qualifiedLeads}</div>
            <div className="mt-2 text-sm text-[var(--color-muted)]">{property.scheduledTourCount} tours scheduled</div>
          </div>
          <div className="rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-4">
            <div className="text-sm text-[var(--color-muted)]">Rules coverage</div>
            <div className="mt-2 text-3xl font-semibold">{property.activeRuleCount}</div>
            <div className="mt-2 text-sm text-[var(--color-muted)]">{property.inactiveRuleCount} inactive rules</div>
          </div>
          <div className="rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-4">
            <div className="text-sm text-[var(--color-muted)]">Question coverage</div>
            <div className="mt-2 text-3xl font-semibold">{property.questionCount}</div>
            <div className="mt-2 text-sm text-[var(--color-muted)]">{property.questionSetCount} question sets</div>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xl font-semibold">Listing performance</div>
            <div className="mt-2 text-sm text-[var(--color-muted)]">
              Property-level inquiry and conversion signals derived from the leads already assigned to this listing.
            </div>
          </div>
          <div className="text-sm text-[var(--color-muted)]">
            {property.distinctLeadSourceCount} distinct inquiry sources tracked
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-4">
          <div className="rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-4">
            <div className="text-sm text-[var(--color-muted)]">30-day inquiries</div>
            <div className="mt-2 text-3xl font-semibold">{property.recentInquiryCount}</div>
            <div className="mt-2 text-sm text-[var(--color-muted)]">Recent inbound volume for this property</div>
          </div>
          <div className="rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-4">
            <div className="text-sm text-[var(--color-muted)]">Top lead source</div>
            <div className="mt-2 text-lg font-semibold">{property.topLeadSourceName}</div>
            <div className="mt-2 text-sm text-[var(--color-muted)]">{property.topLeadSourceCount} inquiries from the strongest source</div>
          </div>
          <div className="rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-4">
            <div className="text-sm text-[var(--color-muted)]">Qualification rate</div>
            <div className="mt-2 text-3xl font-semibold">{property.qualificationRateLabel}</div>
            <div className="mt-2 text-sm text-[var(--color-muted)]">Qualified leads divided by total inquiries</div>
          </div>
          <div className="rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-4">
            <div className="text-sm text-[var(--color-muted)]">Tour conversion</div>
            <div className="mt-2 text-3xl font-semibold">{property.tourConversionRateLabel}</div>
            <div className="mt-2 text-sm text-[var(--color-muted)]">Scheduled tours divided by total inquiries</div>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4">
          <section className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
            <div className="text-xl font-semibold">Property summary</div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <div className="text-sm text-[var(--color-muted)]">Property type</div>
                <div className="mt-1 font-medium">{property.propertyType ?? "Not set"}</div>
              </div>
              <div>
                <div className="text-sm text-[var(--color-muted)]">Lifecycle</div>
                <div className="mt-1 font-medium">{property.lifecycleStatus}</div>
              </div>
              <div>
                <div className="text-sm text-[var(--color-muted)]">Locality</div>
                <div className="mt-1 font-medium">{property.locality ?? "Not set"}</div>
              </div>
              <div className="sm:col-span-2">
                <div className="text-sm text-[var(--color-muted)]">Address</div>
                <div className="mt-1 font-medium">{property.addressLine1 ?? "Not set"}</div>
              </div>
              <div>
                <div className="text-sm text-[var(--color-muted)]">Rentable rooms</div>
                <div className="mt-1 font-medium">{property.activeRooms}</div>
              </div>
              <div>
                <div className="text-sm text-[var(--color-muted)]">Shared bathrooms</div>
                <div className="mt-1 font-medium">{property.sharedBathroomCount}</div>
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
            <div className="text-xl font-semibold">Operational details</div>
            <div className="mt-2 text-sm text-[var(--color-muted)]">
              Update the operator-facing details that most directly affect qualification and listing clarity for this property.
            </div>
            <form
              action={updatePropertyOperationalDetailsAction.bind(null, property.id)}
              className="mt-5 grid gap-4 sm:grid-cols-2"
            >
              <label className="space-y-2">
                <span className="text-sm font-medium">Rentable rooms</span>
                <input
                  className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                  defaultValue={property.activeRooms}
                  min={0}
                  name="rentableRoomCount"
                  type="number"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Shared bathrooms</span>
                <input
                  className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                  defaultValue={property.sharedBathroomCount}
                  min={0}
                  name="sharedBathroomCount"
                  type="number"
                />
              </label>
              <label className="flex items-center justify-between rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4 sm:col-span-2">
                <span className="font-medium">Parking available</span>
                <input
                  defaultChecked={property.parkingAvailable}
                  name="parkingAvailable"
                  type="checkbox"
                />
              </label>
              <input type="hidden" name="redirectTo" value={`/app/properties/${property.id}`} />
              <div className="flex justify-end sm:col-span-2">
                <button
                  className="rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white"
                  type="submit"
                >
                  Save operational details
                </button>
              </div>
            </form>
          </section>

          <section className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
            <div className="text-xl font-semibold">Amenities and house policy</div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4">
                <div className="text-sm text-[var(--color-muted)]">Parking</div>
                <div className="mt-1 font-medium">
                  {getAmenityLabel(property.parkingAvailable, "Available", "Unavailable")}
                </div>
              </div>
              <div className="rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4">
                <div className="text-sm text-[var(--color-muted)]">Smoking</div>
                <div className="mt-1 font-medium">
                  {getAmenityLabel(property.smokingAllowed, "Allowed", "Not allowed")}
                </div>
              </div>
              <div className="rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4">
                <div className="text-sm text-[var(--color-muted)]">Pets</div>
                <div className="mt-1 font-medium">
                  {getAmenityLabel(property.petsAllowed, "Allowed", "Not allowed")}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xl font-semibold">Lifecycle controls</div>
                <div className="mt-2 text-sm text-[var(--color-muted)]">
                  Active properties accept new leads and automation. Inactive or archived properties stay visible for reference but are excluded from new assignment flow.
                </div>
              </div>
              <div className="rounded-full border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-3 py-2 text-sm font-medium">
                {property.lifecycleStatus}
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              {propertyLifecycleStatuses.map((propertyLifecycleStatus) => {
                const isCurrentLifecycleStatus =
                  propertyLifecycleStatus === property.lifecycleStatusValue;

                return (
                  <form
                    action={updatePropertyLifecycleStatusAction.bind(null, property.id)}
                    key={propertyLifecycleStatus}
                  >
                    <input
                      type="hidden"
                      name="lifecycleStatus"
                      value={propertyLifecycleStatus}
                    />
                    <input type="hidden" name="redirectTo" value={`/app/properties/${property.id}`} />
                    <button
                      className={`rounded-2xl border px-4 py-2 text-sm font-medium ${
                        isCurrentLifecycleStatus
                          ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-white"
                          : "border-[var(--color-line)] bg-[var(--color-panel-strong)]"
                      }`}
                      disabled={isCurrentLifecycleStatus}
                      type="submit"
                    >
                      Set {formatPropertyLifecycleStatus(propertyLifecycleStatus)}
                    </button>
                  </form>
                );
              })}
            </div>
          </section>

          <section className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xl font-semibold">Scheduling config</div>
                <div className="mt-2 text-sm text-[var(--color-muted)]">
                  Keep the handoff link current so qualified leads can move straight into tour scheduling.
                </div>
              </div>
              <div className="rounded-full border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-3 py-2 text-sm font-medium">
                {property.schedulingUrl
                  ? property.schedulingEnabled
                    ? "Configured and enabled"
                    : "Configured but disabled"
                  : "Not configured"}
              </div>
            </div>
            <form
              action={updatePropertySchedulingLinkAction.bind(null, property.id)}
              className="mt-5 flex flex-col gap-3 md:flex-row md:items-end"
            >
              <label className="flex-1 space-y-2">
                <span className="text-sm font-medium">Scheduling URL</span>
                <input
                  className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                  defaultValue={property.schedulingUrl ?? ""}
                  name="schedulingUrl"
                  placeholder="https://calendar.example.com/property-tour"
                  type="url"
                />
              </label>
              <input type="hidden" name="redirectTo" value={`/app/properties/${property.id}`} />
              <button
                className="rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white"
                type="submit"
              >
                Save scheduling link
              </button>
            </form>
            <div className="mt-3 text-xs text-[var(--color-muted)]">
              Leaving this blank clears the property-level scheduling handoff URL.
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
            <div className="text-xl font-semibold">Listing source metadata</div>
            <div className="mt-2 text-sm text-[var(--color-muted)]">
              Store the source label and external reference now so the next listing-sync slice has stable property metadata to build on.
            </div>
            <form
              action={updatePropertyListingSourceMetadataAction.bind(null, property.id)}
              className="mt-5 grid gap-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">Source name</span>
                  <input
                    className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                    defaultValue={property.listingSourceName ?? ""}
                    name="listingSourceName"
                    placeholder="SpareRoom"
                    type="text"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">Source type</span>
                  <input
                    className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                    defaultValue={property.listingSourceType ?? ""}
                    name="listingSourceType"
                    placeholder="Marketplace"
                    type="text"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">External listing ID</span>
                  <input
                    className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                    defaultValue={property.listingSourceExternalId ?? ""}
                    name="listingSourceExternalId"
                    placeholder="listing_4821"
                    type="text"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">Listing URL</span>
                  <input
                    className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                    defaultValue={property.listingSourceUrl ?? ""}
                    name="listingSourceUrl"
                    placeholder="https://example.com/listings/maple-house"
                    type="url"
                  />
                </label>
              </div>
              <input type="hidden" name="redirectTo" value={`/app/properties/${property.id}`} />
              <div className="flex justify-end">
                <button
                  className="rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white"
                  type="submit"
                >
                  Save listing metadata
                </button>
              </div>
            </form>
          </section>

          <section className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xl font-semibold">Listing sync status</div>
                <div className="mt-2 text-sm text-[var(--color-muted)]">
                  Track whether the external listing connection is healthy, pending, failed, or out of date before deeper sync automation exists.
                </div>
              </div>
              <div className="rounded-full border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-3 py-2 text-sm font-medium">
                {property.listingSyncStatus}
              </div>
            </div>
            <div className="mt-3 text-sm text-[var(--color-muted)]">
              Last updated: {property.listingSyncUpdatedAtLabel}
            </div>
            <form
              action={updatePropertyListingSyncStatusAction.bind(null, property.id)}
              className="mt-5 grid gap-4"
            >
              <label className="space-y-2">
                <span className="text-sm font-medium">Sync status</span>
                <select
                  className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                  defaultValue={property.listingSyncStatusValue ?? ""}
                  name="listingSyncStatus"
                >
                  <option value="">Not tracked</option>
                  {propertyListingSyncStatuses.map((propertyListingSyncStatus) => (
                    <option key={propertyListingSyncStatus} value={propertyListingSyncStatus}>
                      {formatPropertyListingSyncStatus(propertyListingSyncStatus)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Sync note</span>
                <textarea
                  className="min-h-28 w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                  defaultValue={property.listingSyncMessage ?? ""}
                  name="listingSyncMessage"
                  placeholder="Waiting for initial feed connection, authentication failed, or listing needs a manual refresh."
                />
              </label>
              <input type="hidden" name="redirectTo" value={`/app/properties/${property.id}`} />
              <div className="flex justify-end">
                <button
                  className="rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white"
                  type="submit"
                >
                  Save sync status
                </button>
              </div>
            </form>
          </section>

          <section className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
            <div className="text-xl font-semibold">Calendar target selection</div>
            <div className="mt-2 text-sm text-[var(--color-muted)]">
              Choose the operator calendar target this property should hand off to, even before native calendar integrations are fully connected.
            </div>
            <form
              action={updatePropertyCalendarTargetAction.bind(null, property.id)}
              className="mt-5 grid gap-4 sm:grid-cols-2"
            >
              <label className="space-y-2">
                <span className="text-sm font-medium">Calendar target name</span>
                <input
                  className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                  defaultValue={property.calendarTargetName ?? ""}
                  name="calendarTargetName"
                  placeholder="Maple House Tour Calendar"
                  type="text"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Calendar provider</span>
                <input
                  className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                  defaultValue={property.calendarTargetProvider ?? ""}
                  name="calendarTargetProvider"
                  placeholder="Google Calendar"
                  type="text"
                />
              </label>
              <label className="space-y-2 sm:col-span-2">
                <span className="text-sm font-medium">External calendar ID</span>
                <input
                  className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                  defaultValue={property.calendarTargetExternalId ?? ""}
                  name="calendarTargetExternalId"
                  placeholder="primary or calendar_123"
                  type="text"
                />
              </label>
              <input type="hidden" name="redirectTo" value={`/app/properties/${property.id}`} />
              <div className="flex justify-end sm:col-span-2">
                <button
                  className="rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white"
                  type="submit"
                >
                  Save calendar target
                </button>
              </div>
            </form>
          </section>

          <section className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
            <div className="text-xl font-semibold">Channel settings</div>
            <div className="mt-2 text-sm text-[var(--color-muted)]">
              Lead workflow uses this priority order when the property has an assigned conversation channel.
            </div>
            <div className="mt-5 rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-4">
              <div className="text-sm text-[var(--color-muted)]">Priority source</div>
              <div className="mt-1 font-medium">{property.channelPrioritySource}</div>
            </div>
            <div className="mt-4 space-y-3">
              {property.channelPriorityOrder.map((channelLabel, channelIndex) => (
                <div
                  className="flex items-center justify-between rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4"
                  key={`${property.id}-${channelLabel}`}
                >
                  <div className="font-medium">{channelLabel}</div>
                  <div className="text-sm text-[var(--color-muted)]">Priority {channelIndex + 1}</div>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-4">
              <div className="text-sm text-[var(--color-muted)]">Quiet hours source</div>
              <div className="mt-1 font-medium">{property.quietHoursSource}</div>
              <div className="mt-2 text-sm text-[var(--color-muted)]">
                Active setting: {property.quietHoursSummary}
              </div>
              <div className="mt-2 text-xs text-[var(--color-muted)]">
                Workspace default: {property.workspaceQuietHoursSummary}
              </div>
            </div>
            <form
              action={updatePropertyQuietHoursAction.bind(null, property.id)}
              className="mt-4 grid gap-3 rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-4 md:grid-cols-3"
            >
              <label className="flex items-center gap-2 md:col-span-3">
                <input
                  defaultChecked={Boolean(property.quietHoursStartLocal)}
                  name="quietHoursOverrideEnabled"
                  type="checkbox"
                />
                <span className="text-sm font-medium">Enable property quiet-hours override</span>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Start</span>
                <input
                  className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                  defaultValue={property.quietHoursStartLocal ?? "21:00"}
                  name="quietHoursStartLocal"
                  type="time"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">End</span>
                <input
                  className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                  defaultValue={property.quietHoursEndLocal ?? "08:00"}
                  name="quietHoursEndLocal"
                  type="time"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Time zone</span>
                <input
                  className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                  defaultValue={property.quietHoursTimeZone ?? "America/New_York"}
                  name="quietHoursTimeZone"
                  placeholder="America/New_York"
                  type="text"
                />
              </label>
              <input type="hidden" name="redirectTo" value={`/app/properties/${property.id}`} />
              <div className="flex justify-end md:col-span-3">
                <button
                  className="rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white"
                  type="submit"
                >
                  Save quiet hours override
                </button>
              </div>
            </form>
          </section>

          <section className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
            <div className="text-xl font-semibold">Configuration coverage</div>
            {propertySetupTasks.length === 0 ? (
              <div className="mt-4 rounded-[1.5rem] border border-[rgba(61,122,88,0.2)] bg-[rgba(61,122,88,0.08)] px-4 py-4 text-sm text-[rgb(61,122,88)]">
                This property has the core profile, rules, questions, and scheduling pieces needed for active qualification flow.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {propertySetupTasks.map((propertySetupTask) => (
                  <div
                    className="rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4 text-sm"
                    key={propertySetupTask}
                  >
                    {propertySetupTask}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
            <div className="text-xl font-semibold">Linked configuration</div>
            <div className="mt-4 space-y-3">
              <Link
                className="flex items-center justify-between rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4"
                href={`/app/properties/${property.id}/rules`}
              >
                <div>
                  <div className="font-medium">Property rules</div>
                  <div className="mt-1 text-sm text-[var(--color-muted)]">
                    {property.activeRuleCount} active of {property.rulesCount} total rules
                  </div>
                </div>
                <div className="text-sm text-[var(--color-muted)]">Open</div>
              </Link>
              <Link
                className="flex items-center justify-between rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4"
                href={`/app/properties/${property.id}/questions`}
              >
                <div>
                  <div className="font-medium">Qualification questions</div>
                  <div className="mt-1 text-sm text-[var(--color-muted)]">
                    {property.questionCount} questions across {property.defaultQuestionSetCount} default sets
                  </div>
                </div>
                <div className="text-sm text-[var(--color-muted)]">Open</div>
              </Link>
              <Link
                className="flex items-center justify-between rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4"
                href="/app/calendar"
              >
                <div>
                  <div className="font-medium">Calendar handoff</div>
                  <div className="mt-1 text-sm text-[var(--color-muted)]">
                    {property.scheduledTourCount} scheduled tours, {property.totalTourCount} total tour events
                  </div>
                </div>
                <div className="text-sm text-[var(--color-muted)]">Open</div>
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}