import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  parseCheckbox,
  parseNullableInt,
  parseNullableString,
} from "@/lib/onboarding";
import { getCurrentWorkspaceMembership } from "@/lib/app-data";

export default async function PropertyOnboardingPage() {
  const membership = await getCurrentWorkspaceMembership();
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

    const workspaceMembership = await getCurrentWorkspaceMembership();
    const existingProperty = await prisma.property.findFirst({
      where: {
        workspaceId: workspaceMembership.workspaceId,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    const data = {
      name: parseNullableString(formData, "name") ?? "Untitled property",
      propertyType: parseNullableString(formData, "propertyType"),
      addressLine1: parseNullableString(formData, "addressLine1"),
      locality: parseNullableString(formData, "locality"),
      rentableRoomCount: parseNullableInt(formData, "rentableRoomCount"),
      sharedBathroomCount: parseNullableInt(formData, "sharedBathroomCount"),
      parkingAvailable: parseCheckbox(formData, "parkingAvailable"),
      smokingAllowed: parseCheckbox(formData, "smokingAllowed"),
      petsAllowed: parseCheckbox(formData, "petsAllowed"),
      schedulingUrl: parseNullableString(formData, "schedulingUrl"),
    };

    if (existingProperty) {
      await prisma.property.update({
        where: {
          id: existingProperty.id,
        },
        data,
      });
    } else {
      await prisma.property.create({
        data: {
          workspaceId: workspaceMembership.workspaceId,
          ...data,
        },
      });
    }

    revalidatePath("/onboarding");
    revalidatePath("/app");
    revalidatePath("/app/properties");
    redirect("/onboarding/house-rules");
  }

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-5 py-10 md:px-8">
      <form
        action={savePropertySetup}
        className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-8 shadow-[var(--shadow-panel)]"
      >
        <div className="text-xs uppercase tracking-[0.24em] text-[var(--color-muted)]">
          Step 1
        </div>
        <h1 className="mt-3 text-4xl font-semibold">Create the first property</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--color-muted)]">
          Save the minimum property data the rest of the workflow depends on:
          location, room count, bathroom sharing, and the house-level policy
          flags.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-medium">Property name</span>
            <input
              className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
              defaultValue={property?.name ?? ""}
              name="name"
              placeholder="Maple House"
              type="text"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium">Property type</span>
            <input
              className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
              defaultValue={property?.propertyType ?? ""}
              name="propertyType"
              placeholder="Shared house"
              type="text"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium">Address</span>
            <input
              className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
              defaultValue={property?.addressLine1 ?? ""}
              name="addressLine1"
              placeholder="18 Maple Ave"
              type="text"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium">City or area</span>
            <input
              className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
              defaultValue={property?.locality ?? ""}
              name="locality"
              placeholder="Providence, RI"
              type="text"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium">Rentable rooms</span>
            <input
              className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
              defaultValue={property?.rentableRoomCount ?? ""}
              min={1}
              name="rentableRoomCount"
              placeholder="4"
              type="number"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium">Shared bathroom count</span>
            <input
              className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
              defaultValue={property?.sharedBathroomCount ?? ""}
              min={0}
              name="sharedBathroomCount"
              placeholder="2"
              type="number"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium">Scheduling link</span>
            <input
              className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
              defaultValue={property?.schedulingUrl ?? ""}
              name="schedulingUrl"
              placeholder="https://calendar.example.com/property-tour"
              type="url"
            />
          </label>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <label className="flex items-center justify-between rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4">
            <span className="font-medium">Parking available</span>
            <input
              defaultChecked={property?.parkingAvailable ?? false}
              name="parkingAvailable"
              type="checkbox"
            />
          </label>
          <label className="flex items-center justify-between rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4">
            <span className="font-medium">Smoking allowed</span>
            <input
              defaultChecked={property?.smokingAllowed ?? false}
              name="smokingAllowed"
              type="checkbox"
            />
          </label>
          <label className="flex items-center justify-between rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4">
            <span className="font-medium">Pets allowed</span>
            <input
              defaultChecked={property?.petsAllowed ?? false}
              name="petsAllowed"
              type="checkbox"
            />
          </label>
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
