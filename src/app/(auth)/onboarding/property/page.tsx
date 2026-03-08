import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspaceMembership } from "@/lib/app-data";
import {
  buildPropertyOnboardingRetryPath,
  handleSavePropertyOnboardingAction,
  PropertyOnboardingActionError,
  workflow2PropertyTypeOptions,
} from "@/lib/workflow2-property";

type PropertyOnboardingPageProps = {
  searchParams: Promise<{
    addressLine1?: string;
    error?: string;
    locality?: string;
    name?: string;
    parkingAvailable?: string;
    petsAllowed?: string;
    propertyType?: string;
    rentableRoomCount?: string;
    schedulingUrl?: string;
    sharedBathroomCount?: string;
    smokingAllowed?: string;
  }>;
};

export default async function PropertyOnboardingPage({
  searchParams,
}: PropertyOnboardingPageProps) {
  const membership = await getCurrentWorkspaceMembership();
  const resolvedSearchParams = await searchParams;
  const property = await prisma.property.findFirst({
    where: {
      workspaceId: membership.workspaceId,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  async function savePropertySetup(formData: FormData) {
    "use server";

    try {
      await handleSavePropertyOnboardingAction(formData);
    } catch (error) {
      if (error instanceof PropertyOnboardingActionError) {
        redirect(buildPropertyOnboardingRetryPath(formData, error.message));
      }

      throw error;
    }
  }

  const draftName = resolvedSearchParams.name ?? property?.name ?? "My First Property";
  const draftPropertyType =
    resolvedSearchParams.propertyType ??
    property?.propertyType ??
    workflow2PropertyTypeOptions[0].value;
  const draftAddress = resolvedSearchParams.addressLine1 ?? property?.addressLine1 ?? "";
  const draftLocality = resolvedSearchParams.locality ?? property?.locality ?? "";
  const draftRentableRoomCount =
    resolvedSearchParams.rentableRoomCount ?? `${property?.rentableRoomCount ?? ""}`;
  const draftSharedBathroomCount =
    resolvedSearchParams.sharedBathroomCount ?? `${property?.sharedBathroomCount ?? ""}`;
  const draftSchedulingUrl =
    resolvedSearchParams.schedulingUrl ?? property?.schedulingUrl ?? "";
  const draftParkingAvailable = getCheckboxDraftValue(
    resolvedSearchParams.parkingAvailable,
    property?.parkingAvailable ?? false,
  );
  const draftSmokingAllowed = getCheckboxDraftValue(
    resolvedSearchParams.smokingAllowed,
    property?.smokingAllowed ?? false,
  );
  const draftPetsAllowed = getCheckboxDraftValue(
    resolvedSearchParams.petsAllowed,
    property?.petsAllowed ?? false,
  );

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-5 py-10 md:px-8">
      <form
        action={savePropertySetup}
        className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-8 shadow-[var(--shadow-panel)]"
        noValidate
      >
        <div className="flex items-center justify-between gap-4">
          <div className="text-xs uppercase tracking-[0.24em] text-[var(--color-muted)]">
            Step 1 of 5
          </div>
          <Link
            className="text-sm font-medium text-[var(--color-accent-strong)]"
            href="/onboarding"
          >
            Back
          </Link>
        </div>
        <h1 className="mt-3 text-4xl font-semibold">Set up your first property</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--color-muted)]">
          This gives Roomflow the context it needs to qualify leads and suggest
          the right next steps.
        </p>
        {resolvedSearchParams.error ? (
          <div className="mt-6 rounded-2xl border border-[rgba(184,88,51,0.25)] bg-[rgba(184,88,51,0.08)] px-4 py-3 text-sm text-[var(--color-accent-strong)]" role="alert">
            {resolvedSearchParams.error}
          </div>
        ) : null}

        <div className="mt-8 space-y-8">
          <section>
            <div className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">
              Basic details
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-medium">Property name</span>
            <input
              autoFocus
              className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
              defaultValue={draftName}
              maxLength={100}
              name="name"
              placeholder="Maple House"
              required
              type="text"
            />
          </label>

              <fieldset className="space-y-2 md:col-span-2">
                <legend className="text-sm font-medium">Property type</legend>
                <div className="grid gap-3 md:grid-cols-2">
                  {workflow2PropertyTypeOptions.map((option) => (
                    <label className="block cursor-pointer" key={option.value}>
                      <input
                        className="peer sr-only"
                        defaultChecked={draftPropertyType === option.value}
                        name="propertyType"
                        required
                        type="radio"
                        value={option.value}
                      />
                      <span className="flex h-full rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4 transition peer-checked:border-[var(--color-accent)] peer-checked:bg-[rgba(184,88,51,0.08)]">
                        <span>
                          <span className="block text-sm font-semibold text-[var(--color-ink)]">
                            {option.value}
                          </span>
                          <span className="mt-2 block text-sm leading-6 text-[var(--color-muted)]">
                            {option.description}
                          </span>
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className="space-y-2">
                <span className="text-sm font-medium">Street address</span>
                <input
                  className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                  defaultValue={draftAddress}
                  name="addressLine1"
                  placeholder="18 Maple Ave"
                  type="text"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium">City, neighborhood, or address</span>
                <input
                  className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                  defaultValue={draftLocality}
                  name="locality"
                  placeholder="Providence, RI"
                  required
                  type="text"
                />
              </label>
            </div>
          </section>

          <section>
            <div className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">
              Shared-living details
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium">Rentable rooms</span>
                <input
                  className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                  defaultValue={draftRentableRoomCount}
                  min={1}
                  name="rentableRoomCount"
                  placeholder="4"
                  required
                  type="number"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium">Shared bathroom count</span>
                <input
                  className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                  defaultValue={draftSharedBathroomCount}
                  min={0}
                  name="sharedBathroomCount"
                  placeholder="2"
                  type="number"
                />
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium">Scheduling link</span>
                <input
                  className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                  defaultValue={draftSchedulingUrl}
                  name="schedulingUrl"
                  placeholder="https://calendar.example.com/property-tour"
                  type="url"
                />
              </label>
            </div>
          </section>

          <section>
            <div className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">
              Optional preferences
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--color-muted)]">
              Keep this lightweight. These settings help Roomflow suggest better
              rules and messaging, and you can change them later.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <label className="flex items-center justify-between rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4">
                <span className="font-medium">Parking available</span>
                <input
                  defaultChecked={draftParkingAvailable}
                  name="parkingAvailable"
                  type="checkbox"
                />
              </label>
              <label className="flex items-center justify-between rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4">
                <span className="font-medium">Smoking allowed</span>
                <input
                  defaultChecked={draftSmokingAllowed}
                  name="smokingAllowed"
                  type="checkbox"
                />
              </label>
              <label className="flex items-center justify-between rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4">
                <span className="font-medium">Pets allowed</span>
                <input
                  defaultChecked={draftPetsAllowed}
                  name="petsAllowed"
                  type="checkbox"
                />
              </label>
            </div>
          </section>
        </div>

        <div className="mt-8 flex justify-end">
          <button
            className="rounded-2xl bg-[var(--color-accent)] px-5 py-3 font-medium text-white"
            type="submit"
          >
            Save and continue
          </button>
        </div>
      </form>
    </main>
  );
}

function getCheckboxDraftValue(queryValue: string | undefined, fallbackValue: boolean) {
  if (queryValue === "1") {
    return true;
  }

  if (queryValue === "0") {
    return false;
  }

  return fallbackValue;
}
