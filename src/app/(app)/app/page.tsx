import { PageHeader } from "@/components/page-header";
import { getDashboardViewData } from "@/lib/app-data";

export default async function DashboardPage() {
  const dashboard = await getDashboardViewData();

  return (
    <main>
      <PageHeader
        eyebrow="Dashboard"
        title="Operational snapshot"
        description={dashboard.seedWindowLabel}
      />

      <div className="grid gap-4 lg:grid-cols-4">
        {dashboard.metrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-[1.75rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-5 shadow-[var(--shadow-panel)] backdrop-blur"
          >
            <div className="text-sm text-[var(--color-muted)]">{metric.label}</div>
            <div className="mt-3 text-4xl font-semibold">{metric.value}</div>
            <div className="mt-2 text-sm text-[var(--color-accent-strong)]">
              {metric.delta}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
          <div className="text-lg font-semibold">What exists now</div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {dashboard.implementationChecklist.map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4"
              >
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
          <div className="text-lg font-semibold">Recent activity</div>
          <div className="mt-4 space-y-3">
            {dashboard.recentActivity.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm"
              >
                <div>{item.label}</div>
                <div className="mt-1 text-xs text-[var(--color-muted)]">
                  {item.at}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
          <div className="text-lg font-semibold">Lead sources</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {dashboard.sourceSummaries.map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4"
              >
                <div className="text-sm text-[var(--color-muted)]">{item.label}</div>
                <div className="mt-2 text-2xl font-semibold">{item.value}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
          <div className="text-lg font-semibold">Pipeline status mix</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {dashboard.statusSummaries.map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4"
              >
                <div className="text-sm text-[var(--color-muted)]">{item.label}</div>
                <div className="mt-2 text-2xl font-semibold">{item.value}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
          <div className="text-lg font-semibold">Event-derived KPI highlights</div>
          <div className="mt-4 space-y-3">
            {dashboard.kpiHighlights.map((kpiHighlight) => (
              <div
                key={kpiHighlight}
                className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm"
              >
                {kpiHighlight}
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
          <div className="text-lg font-semibold">Plan warnings</div>
          <div className="mt-4 space-y-3">
            {dashboard.planWarnings.length === 0 ? (
              <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm">
                No soft-plan warnings right now.
              </div>
            ) : (
              dashboard.planWarnings.map((planWarning) => (
                <div
                  key={planWarning}
                  className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm"
                >
                  {planWarning}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
