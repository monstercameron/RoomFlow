import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { getAnalyticsViewData } from "@/lib/app-data";

type AnalyticsPageProps = {
  searchParams: Promise<{
    report?: string;
    window?: string;
  }>;
};

function getSectionClassName(isFocused: boolean) {
  return `rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)] ${
    isFocused ? "ring-2 ring-[rgba(184,88,51,0.18)]" : ""
  }`;
}

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  const resolvedSearchParams = await searchParams;
  const reportValue =
    typeof resolvedSearchParams.report === "string" && resolvedSearchParams.report.trim().length > 0
      ? resolvedSearchParams.report.trim()
      : "overview";
  const analytics = await getAnalyticsViewData(
    typeof resolvedSearchParams.window === "string" ? resolvedSearchParams.window : "30d",
  );
  const selectedReport =
    analytics.reportPresets.find((reportPreset) => reportPreset.value === reportValue) ??
    analytics.reportPresets[0];

  return (
    <main>
      <PageHeader
        eyebrow="Analytics"
        title="Funnel and performance reporting"
        description={`${analytics.currentWindowLabel} across source quality, rule friction, property performance, stale leads, and operational health.`}
      />

      <section className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xl font-semibold">Reporting filters</div>
            <div className="mt-2 max-w-3xl text-sm leading-7 text-[var(--color-muted)]">
              Use time windows for trend slices and jump between saved report views that keep the query state in the URL.
            </div>
          </div>
          {analytics.latestUsageSnapshot ? (
            <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm text-[var(--color-muted)]">
              Usage snapshot: {analytics.latestUsageSnapshot.snapshotDateLabel}
              <br />
              {analytics.latestUsageSnapshot.monthlyLeads} monthly leads | {analytics.latestUsageSnapshot.automationSends} automation sends
            </div>
          ) : null}
        </div>

        <form className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_auto]">
          <label className="space-y-2">
            <span className="text-sm font-medium">Time window</span>
            <select
              className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
              defaultValue={analytics.timeWindow.value}
              name="window"
            >
              {analytics.timeWindowOptions.map((timeWindowOption) => (
                <option key={timeWindowOption.value} value={timeWindowOption.value}>
                  {timeWindowOption.label}
                </option>
              ))}
            </select>
          </label>
          <input name="report" type="hidden" value={selectedReport.value} />
          <button
            className="rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white md:self-end"
            type="submit"
          >
            Apply
          </button>
          <Link
            className="rounded-2xl border border-[var(--color-line)] px-4 py-3 text-sm font-medium text-[var(--color-accent-strong)] md:self-end"
            href="/app/analytics"
          >
            Reset
          </Link>
        </form>

        <div className="mt-5 grid gap-3 lg:grid-cols-4">
          {analytics.reportPresets.map((reportPreset) => {
            const isSelected = reportPreset.value === selectedReport.value;

            return (
              <Link
                className={`rounded-2xl border px-4 py-4 text-sm ${
                  isSelected
                    ? "border-[rgba(184,88,51,0.25)] bg-[rgba(184,88,51,0.08)]"
                    : "border-[var(--color-line)] bg-[var(--color-panel-strong)]"
                }`}
                href={`/app/analytics?report=${reportPreset.value}&window=${analytics.timeWindow.value}`}
                key={reportPreset.value}
              >
                <div className="font-medium">{reportPreset.label}</div>
                <div className="mt-2 text-[var(--color-muted)]">{reportPreset.description}</div>
              </Link>
            );
          })}
        </div>

        {!analytics.hasAdvancedAnalytics ? (
          <div className="mt-5 rounded-2xl border border-[rgba(184,88,51,0.2)] bg-[rgba(184,88,51,0.08)] px-4 py-4 text-sm text-[var(--color-accent-strong)]">
            Advanced analytics capability is not enabled for this workspace. Core funnel, source, property, and stale reporting stay visible here, while team and AI depth are intended for Org analytics setups.
          </div>
        ) : null}
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        {analytics.summaryCards.map((summaryCard) => (
          <article
            className="rounded-[1.75rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-5 shadow-[var(--shadow-panel)]"
            key={summaryCard.label}
          >
            <div className="text-sm text-[var(--color-muted)]">{summaryCard.label}</div>
            <div className="mt-3 text-4xl font-semibold">{summaryCard.value}</div>
            <div className="mt-2 text-sm text-[var(--color-accent-strong)]">{summaryCard.detail}</div>
          </article>
        ))}
      </section>

      <section className={`mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr] ${selectedReport.value === "overview" ? "" : ""}`}>
        <div className={getSectionClassName(selectedReport.value === "overview")} id="funnel">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xl font-semibold">Funnel overview</div>
              <div className="mt-2 text-sm leading-7 text-[var(--color-muted)]">
                Inquiry-to-qualified, inquiry-to-tour, and inquiry-to-application rollups for the selected reporting window.
              </div>
            </div>
            <div className="text-sm text-[var(--color-muted)]">Report: {selectedReport.label}</div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-4">
            {analytics.funnelSteps.map((funnelStep, index) => (
              <div
                className="rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-4"
                key={funnelStep.label}
              >
                <div className="text-sm text-[var(--color-muted)]">{funnelStep.label}</div>
                <div className="mt-3 text-3xl font-semibold">{funnelStep.count}</div>
                <div className="mt-2 text-sm text-[var(--color-accent-strong)]">{funnelStep.rateLabel} of inquiries</div>
                {index > 0 ? (
                  <div className="mt-4 h-2 rounded-full bg-[rgba(184,88,51,0.08)]">
                    <div
                      className="h-2 rounded-full bg-[var(--color-accent)]"
                      style={{ width: funnelStep.rateLabel }}
                    />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className={getSectionClassName(selectedReport.value === "overview")} id="stale">
          <div className="text-xl font-semibold">Stale lead view</div>
          <div className="mt-2 text-sm leading-7 text-[var(--color-muted)]">
            Current stale leads stay visible outside the time-window filter so operators can review the live backlog.
          </div>
          <div className="mt-5 space-y-3">
            {analytics.staleLeadRows.length === 0 ? (
              <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4 text-sm text-[var(--color-muted)]">
                No stale leads are flagged in the visible workspace scope.
              </div>
            ) : (
              analytics.staleLeadRows.map((staleLeadRow) => (
                <article
                  className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4"
                  key={staleLeadRow.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <Link className="font-medium underline underline-offset-4" href={`/app/leads/${staleLeadRow.id}`}>
                        {staleLeadRow.name}
                      </Link>
                      <div className="mt-1 text-xs text-[var(--color-muted)]">
                        {staleLeadRow.propertyName} | {staleLeadRow.statusLabel}
                      </div>
                    </div>
                    <div className="text-sm text-[var(--color-muted)]">{staleLeadRow.staleAtLabel}</div>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </section>

      <section className={`mt-6 ${getSectionClassName(selectedReport.value === "sources")}`} id="sources">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xl font-semibold">Source quality comparison</div>
            <div className="mt-2 text-sm leading-7 text-[var(--color-muted)]">
              Compare listing channels and campaign sources by inquiry volume, qualified rate, tour rate, and application rate.
            </div>
          </div>
          <div className="text-sm text-[var(--color-muted)]">{analytics.sourceRows.length} tracked sources</div>
        </div>
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {analytics.sourceRows.length === 0 ? (
            <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4 text-sm text-[var(--color-muted)]">
              No lead-source data is available for the selected window.
            </div>
          ) : (
            analytics.sourceRows.map((sourceRow) => (
              <article
                className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-4"
                key={sourceRow.label}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{sourceRow.label}</div>
                    <div className="mt-1 text-xs text-[var(--color-muted)]">{sourceRow.sourceTypeLabel}</div>
                  </div>
                  <div className="text-sm text-[var(--color-muted)]">{sourceRow.inquiries} inquiries</div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Qualified</div>
                    <div className="mt-2 text-lg font-semibold">{sourceRow.qualifiedRate}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Tours</div>
                    <div className="mt-2 text-lg font-semibold">{sourceRow.touredRate}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Applications</div>
                    <div className="mt-2 text-lg font-semibold">{sourceRow.applicationRate}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Caution</div>
                    <div className="mt-2 text-lg font-semibold">{sourceRow.cautionCount}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Mismatch</div>
                    <div className="mt-2 text-lg font-semibold">{sourceRow.mismatchCount}</div>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className={`mt-6 ${getSectionClassName(selectedReport.value === "friction")}`} id="friction">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xl font-semibold">Rule and question friction</div>
            <div className="mt-2 text-sm leading-7 text-[var(--color-muted)]">
              Highlight which triggered rules and unanswered required questions most often slow progression.
            </div>
          </div>
          <div className="text-sm text-[var(--color-muted)]">
            {analytics.ruleFriction.evaluationsWithMissingQuestions} fit evaluations flagged missing required answers
          </div>
        </div>
        <div className="mt-5 grid gap-6 xl:grid-cols-2">
          <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-4">
            <div className="text-sm font-medium">Most triggered rules</div>
            <div className="mt-4 space-y-3">
              {analytics.ruleFriction.topRules.length === 0 ? (
                <div className="text-sm text-[var(--color-muted)]">No triggered-rule audit data landed in this window.</div>
              ) : (
                analytics.ruleFriction.topRules.map((ruleRow) => (
                  <div className="rounded-2xl border border-[var(--color-line)] bg-white px-4 py-4" key={`${ruleRow.label}-${ruleRow.categoryLabel}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{ruleRow.label}</div>
                        <div className="mt-1 text-xs text-[var(--color-muted)]">
                          {ruleRow.categoryLabel} | {ruleRow.modeLabel}
                        </div>
                      </div>
                      <div className="text-sm text-[var(--color-accent-strong)]">{ruleRow.count} hits</div>
                    </div>
                    <div className="mt-3 text-sm text-[var(--color-muted)]">{ruleRow.explanation}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-4">
            <div className="text-sm font-medium">Most-missed required questions</div>
            <div className="mt-4 space-y-3">
              {analytics.ruleFriction.topMissingQuestions.length === 0 ? (
                <div className="text-sm text-[var(--color-muted)]">Every required question has an answer in the current reporting slice.</div>
              ) : (
                analytics.ruleFriction.topMissingQuestions.map((questionRow) => (
                  <div className="rounded-2xl border border-[var(--color-line)] bg-white px-4 py-4" key={`${questionRow.propertyName}-${questionRow.label}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{questionRow.label}</div>
                        <div className="mt-1 text-xs text-[var(--color-muted)]">{questionRow.propertyName}</div>
                      </div>
                      <div className="text-sm text-[var(--color-accent-strong)]">{questionRow.count} unanswered</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      <section className={`mt-6 ${getSectionClassName(selectedReport.value === "overview")}`} id="properties">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xl font-semibold">Property performance comparisons</div>
            <div className="mt-2 text-sm leading-7 text-[var(--color-muted)]">
              Compare visible properties by inquiry volume, fit rate, conversion, and stale lead pressure.
            </div>
          </div>
          <div className="text-sm text-[var(--color-muted)]">{analytics.propertyRows.length} accessible properties</div>
        </div>
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {analytics.propertyRows.map((propertyRow) => (
            <article className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-4" key={propertyRow.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link className="font-medium underline underline-offset-4" href={`/app/properties/${propertyRow.id}`}>
                    {propertyRow.name}
                  </Link>
                  <div className="mt-1 text-xs text-[var(--color-muted)]">{propertyRow.lifecycleStatus}</div>
                </div>
                <div className="text-sm text-[var(--color-muted)]">{propertyRow.inquiries} inquiries</div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Qualified</div>
                  <div className="mt-2 text-lg font-semibold">{propertyRow.qualificationRate}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Tours</div>
                  <div className="mt-2 text-lg font-semibold">{propertyRow.tourRate}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Applications</div>
                  <div className="mt-2 text-lg font-semibold">{propertyRow.applicationRate}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Stale</div>
                  <div className="mt-2 text-lg font-semibold">{propertyRow.staleCount}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Top source</div>
                  <div className="mt-2 text-sm font-semibold">{propertyRow.topSource}</div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {analytics.canViewTeamMetrics ? (
        <section className={`mt-6 ${getSectionClassName(selectedReport.value === "team")}`} id="team">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xl font-semibold">Team performance</div>
              <div className="mt-2 text-sm leading-7 text-[var(--color-muted)]">
                Org workspace ownership, workload, completion, and operator activity for the selected reporting slice.
              </div>
            </div>
            <div className="text-sm text-[var(--color-muted)]">{analytics.teamRows.length} teammates in scope</div>
          </div>
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {analytics.teamRows.map((teamRow) => (
              <article className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-4" key={teamRow.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{teamRow.name}</div>
                    <div className="mt-1 text-xs text-[var(--color-muted)]">{teamRow.roleLabel}</div>
                  </div>
                  <div className="text-sm text-[var(--color-muted)]">{teamRow.actionsLogged} audit actions</div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Owned leads</div>
                    <div className="mt-2 text-lg font-semibold">{teamRow.ownedLeads}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Open tasks</div>
                    <div className="mt-2 text-lg font-semibold">{teamRow.openTasks}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Overdue</div>
                    <div className="mt-2 text-lg font-semibold">{teamRow.overdueTasks}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Completed</div>
                    <div className="mt-2 text-lg font-semibold">{teamRow.completedTasks}</div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {analytics.hasAiAssist ? (
        <section className={`mt-6 ${getSectionClassName(selectedReport.value === "team")}`} id="ai-usage">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xl font-semibold">AI usage</div>
              <div className="mt-2 text-sm leading-7 text-[var(--color-muted)]">
                Suggestion volume, ready versus failed generations, and apply-rate tracking across the current reporting window.
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm text-[var(--color-muted)]">
              {analytics.aiUsage.generatedCount} generated | {analytics.aiUsage.appliedCount} applied | acceptance {analytics.aiUsage.acceptanceRateLabel}
            </div>
          </div>
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {analytics.aiUsage.rows.length === 0 ? (
              <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4 text-sm text-[var(--color-muted)]">
                No AI artifact activity landed in this window.
              </div>
            ) : (
              analytics.aiUsage.rows.map((aiUsageRow) => (
                <article className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-4" key={aiUsageRow.artifactKindLabel}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="font-medium">{aiUsageRow.artifactKindLabel}</div>
                    <div className="text-sm text-[var(--color-muted)]">acceptance {aiUsageRow.acceptanceRateLabel}</div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-4">
                    <div>
                      <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Generated</div>
                      <div className="mt-2 text-lg font-semibold">{aiUsageRow.generatedCount}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Ready</div>
                      <div className="mt-2 text-lg font-semibold">{aiUsageRow.readyCount}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Failed</div>
                      <div className="mt-2 text-lg font-semibold">{aiUsageRow.failedCount}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Applied</div>
                      <div className="mt-2 text-lg font-semibold">{aiUsageRow.appliedCount}</div>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      ) : null}

      <section className={`mt-6 ${getSectionClassName(selectedReport.value === "team")}`} id="integrations">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xl font-semibold">Integration health</div>
            <div className="mt-2 text-sm leading-7 text-[var(--color-muted)]">
              Connected-system health, sync state, and setup gaps across the integration hub.
            </div>
          </div>
          <div className="grid gap-2 text-sm text-[var(--color-muted)] sm:text-right">
            <div>{analytics.integrationHealth.healthyCount} healthy</div>
            <div>{analytics.integrationHealth.degradedCount} degraded | {analytics.integrationHealth.errorCount} error</div>
            <div>{analytics.integrationHealth.setupNeededCount} need setup</div>
          </div>
        </div>
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {analytics.integrationHealth.rows.map((integrationRow) => (
            <article className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-4" key={`${integrationRow.providerLabel}-${integrationRow.displayName}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{integrationRow.displayName}</div>
                  <div className="mt-1 text-xs text-[var(--color-muted)]">{integrationRow.providerLabel}</div>
                </div>
                <div className="text-sm text-[var(--color-muted)]">{integrationRow.healthLabel}</div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Setup</div>
                  <div className="mt-2 text-sm font-semibold">{integrationRow.setupSummary}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Sync</div>
                  <div className="mt-2 text-sm font-semibold">{integrationRow.syncLabel}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Last sync</div>
                  <div className="mt-2 text-sm font-semibold">{integrationRow.updatedAtLabel}</div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}