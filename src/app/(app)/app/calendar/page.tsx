import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { getCalendarViewData } from "@/lib/app-data";

export default async function CalendarPage() {
  const calendar = await getCalendarViewData();

  return (
    <main>
      <PageHeader
        eyebrow="Calendar"
        title="Scheduling handoff queue"
        description="This v1 calendar view tracks which qualified leads are ready for a scheduling link and which leads have already received the handoff."
      />

      {calendar.unconfiguredProperties.length > 0 ? (
        <section className="mb-6 rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
          <div className="text-lg font-semibold">Properties missing scheduling links</div>
          <div className="mt-4 flex flex-wrap gap-3">
            {calendar.unconfiguredProperties.map((property) => (
              <Link
                key={property.id}
                className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm font-medium"
                href={`/app/properties/${property.id}/rules`}
              >
                {property.name}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {calendar.properties.length === 0 ? (
        <section className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
          <div className="text-lg font-semibold">No scheduling handoffs yet</div>
          <div className="mt-3 text-sm text-[var(--color-muted)]">
            Configure a property scheduling link and move a lead to
            <span className="font-medium"> Qualified </span>
            before sending the handoff from the lead detail view.
          </div>
        </section>
      ) : null}

      <div className="space-y-6">
        {calendar.properties.map((property) => (
          <section
            key={property.id}
            className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xl font-semibold">{property.name}</div>
                <a
                  className="mt-2 block text-sm text-[var(--color-accent-strong)] underline-offset-4 hover:underline"
                  href={property.schedulingUrl ?? "#"}
                  rel="noreferrer"
                  target="_blank"
                >
                  {property.schedulingUrl}
                </a>
              </div>
              <div className="flex flex-wrap gap-3 text-sm">
                <div className="rounded-full border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-3 py-2">
                  {property.readyCount} ready to send
                </div>
                <div className="rounded-full border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-3 py-2">
                  {property.handoffCount} handoff sent
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {property.leads.map((lead) => (
                <Link
                  key={lead.id}
                  href={`/app/leads/${lead.id}`}
                  className="rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold">{lead.name}</div>
                      <div className="mt-1 text-sm text-[var(--color-muted)]">
                        {lead.status}
                      </div>
                    </div>
                    <div className="text-right text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
                      {lead.lastSchedulingEvent}
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div>
                      <div className="text-sm text-[var(--color-muted)]">Move-in date</div>
                      <div className="mt-1 font-medium">{lead.moveInDate}</div>
                    </div>
                    <div>
                      <div className="text-sm text-[var(--color-muted)]">Budget</div>
                      <div className="mt-1 font-medium">{lead.budget}</div>
                    </div>
                  </div>
                  <div className="mt-4 text-sm text-[var(--color-muted)]">
                    Last activity: {lead.lastActivity}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
