import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { getPropertiesViewData } from "@/lib/app-data";

export default async function PropertiesPage() {
  const properties = await getPropertiesViewData();

  return (
    <main>
      <PageHeader
        eyebrow="Properties"
        title="Shared-house setup"
        description="Properties exist mainly to anchor rules, question sets, source routing, and lead counts. Room inventory can stay deferred until routing actually needs it."
      />

      <div className="grid gap-4 md:grid-cols-2">
        {properties.map((property) => (
          <Link
            key={property.id}
            href={`/app/properties/${property.id}/rules`}
            prefetch={false}
            className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]"
          >
            <div className="text-2xl font-semibold">{property.name}</div>
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
              <div className="sm:col-span-2">
                <div className="text-sm text-[var(--color-muted)]">Scheduling</div>
                <div className="mt-1 font-medium">
                  {property.schedulingUrl ? "Scheduling link configured" : "Scheduling link missing"}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
