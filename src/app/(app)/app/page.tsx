import { PageHeader } from "@/components/page-header";
import Link from "next/link";
import { getDashboardViewData } from "@/lib/app-data";
import { generateLeadInsightsAction, generatePortfolioInsightsAction } from "@/lib/ai-actions";

export default async function DashboardPage() {
  const dashboard = await getDashboardViewData();

  if (dashboard.propertyCount === 0) {
    return (
      <main>
        <PageHeader
          eyebrow="Dashboard"
          title="Create your first property"
          description="Create your first property to start qualifying leads."
        />

        <section className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-8 shadow-[var(--shadow-panel)]">
          <div className="max-w-2xl">
            <div className="text-lg font-semibold">
              Roomflow needs a property context before the rest of the app becomes useful.
            </div>
            <div className="mt-3 text-sm leading-7 text-[var(--color-muted)]">
              Set up the first shared-home profile so rules, qualification, messaging, and scheduling all attach to a real property instead of staying abstract.
            </div>
            <div className="mt-6">
              <Link
                className="inline-flex rounded-2xl bg-[var(--color-accent)] px-5 py-3 text-sm font-medium text-white"
                href="/onboarding/property"
              >
                Create property
              </Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

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

      {dashboard.hasAiAssist ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">Portfolio AI insights</div>
                <div className="mt-2 text-sm text-[var(--color-muted)]">
                  Org-only summary of current portfolio opportunities and operational risks.
                </div>
              </div>
              <form action={generatePortfolioInsightsAction}>
                <input type="hidden" name="redirectTo" value="/app" />
                <button
                  className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm font-medium"
                  type="submit"
                >
                  Generate portfolio summary
                </button>
              </form>
            </div>
            {dashboard.portfolioInsights?.status === "failed" ? (
              <div className="mt-4 text-sm text-[var(--color-accent-strong)]">
                {dashboard.portfolioInsights.error}
              </div>
            ) : null}
            {dashboard.portfolioInsights?.status === "ready" ? (
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4 text-sm leading-7">
                  {dashboard.portfolioInsights.data.summary}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4">
                    <div className="text-sm font-medium">Opportunities</div>
                    <div className="mt-3 space-y-2 text-sm text-[var(--color-muted)]">
                      {dashboard.portfolioInsights.data.opportunities.map((item) => (
                        <div key={item}>{item}</div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4">
                    <div className="text-sm font-medium">Risks</div>
                    <div className="mt-3 space-y-2 text-sm text-[var(--color-muted)]">
                      {dashboard.portfolioInsights.data.risks.map((item) => (
                        <div key={item}>{item}</div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </section>

          <section className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
            <div className="text-lg font-semibold">Stale lead recommendations</div>
            <div className="mt-2 text-sm text-[var(--color-muted)]">
              Generate or refresh next-step guidance for leads already marked stale.
            </div>
            <div className="mt-4 space-y-3">
              {dashboard.staleLeadRecommendations.length === 0 ? (
                <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4 text-sm">
                  No stale leads are currently flagged.
                </div>
              ) : (
                dashboard.staleLeadRecommendations.map((lead) => (
                  <div
                    key={lead.id}
                    className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <Link className="font-medium underline underline-offset-4" href={`/app/leads/${lead.id}`}>
                          {lead.name}
                        </Link>
                        <div className="mt-1 text-xs text-[var(--color-muted)]">
                          {lead.status} | stale {lead.staleAt}
                        </div>
                      </div>
                      <form action={generateLeadInsightsAction.bind(null, lead.id)}>
                        <input type="hidden" name="redirectTo" value="/app" />
                        <button
                          className="rounded-2xl border border-[var(--color-line)] bg-white px-3 py-2 text-xs font-medium"
                          type="submit"
                        >
                          Refresh
                        </button>
                      </form>
                    </div>
                    {lead.recommendation?.status === "ready" ? (
                      <div className="mt-3 text-sm text-[var(--color-muted)]">
                        {lead.recommendation.data.staleLeadRecommendation}
                      </div>
                    ) : lead.recommendation?.status === "failed" ? (
                      <div className="mt-3 text-sm text-[var(--color-accent-strong)]">
                        {lead.recommendation.error}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      ) : null}

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
