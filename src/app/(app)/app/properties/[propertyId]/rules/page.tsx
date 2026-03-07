import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { getPropertyRulesViewData } from "@/lib/app-data";
import { updatePropertySchedulingLinkAction } from "@/lib/property-actions";

type PropertyRulesPageProps = {
  params: Promise<{
    propertyId: string;
  }>;
};

export default async function PropertyRulesPage({
  params,
}: PropertyRulesPageProps) {
  const { propertyId } = await params;
  const property = await getPropertyRulesViewData(propertyId);

  if (!property) {
    notFound();
  }

  return (
    <main>
      <PageHeader
        eyebrow="Property rules"
        title={property.propertyName}
        description="This route is in the first implementation slice because the product does not exist without explicit house-rule logic."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-2 text-sm font-medium"
              href={`/app/properties/${propertyId}/questions`}
            >
              View questions
            </Link>
            <Link
              className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-2 text-sm font-medium"
              href="/app/calendar"
            >
              Open calendar
            </Link>
          </div>
        }
      />

      <div className="space-y-4">
        <section className="rounded-[1.75rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xl font-semibold">Scheduling handoff</div>
              <div className="mt-2 text-sm text-[var(--color-muted)]">
                Qualified leads can only receive the tour handoff after this property
                has a live scheduling link.
              </div>
            </div>
            <div className="rounded-full border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-3 py-2 text-sm font-medium">
              {property.schedulingConfigured ? "Configured" : "Not configured"}
            </div>
          </div>
          <form
            action={updatePropertySchedulingLinkAction.bind(null, property.propertyId)}
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
            <input
              type="hidden"
              name="redirectTo"
              value={`/app/properties/${propertyId}/rules`}
            />
            <button
              className="rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white"
              type="submit"
            >
              Save scheduling link
            </button>
          </form>
          <div className="mt-3 text-xs text-[var(--color-muted)]">
            Leave this blank to disable scheduling handoff for the property.
          </div>
        </section>
        {property.rules.map((rule) => (
          <div
            key={rule.id}
            className="rounded-[1.75rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xl font-semibold">{rule.label}</div>
                <div className="mt-2 text-sm text-[var(--color-muted)]">
                  {rule.description}
                </div>
              </div>
              <div className="rounded-full border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-3 py-2 text-sm font-medium">
                {rule.mode}
              </div>
            </div>
            <div className="mt-4 text-sm uppercase tracking-[0.18em] text-[var(--color-muted)]">
              {rule.category}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
