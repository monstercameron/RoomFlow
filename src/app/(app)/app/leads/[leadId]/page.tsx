import Link from "next/link";
import { notFound } from "next/navigation";
import { LeadStatus, QualificationFit } from "@/generated/prisma/client";
import { PageHeader } from "@/components/page-header";
import {
  getLeadDetailNavigationData,
  getLeadDetailViewData,
  type LeadListFilter,
  type LeadListSort,
} from "@/lib/app-data";
import {
  generateLeadInsightsAction,
  generateLeadTranslationAction,
  reviewLeadFieldSuggestionAction,
} from "@/lib/ai-actions";
import {
  getLeadWorkflowErrorUserMessage,
  parseLeadWorkflowErrorCode,
} from "@/lib/lead-workflow-errors";
import { canTransitionLeadStatus } from "@/lib/lead-status-machine";
import {
  cancelTourAction,
  completeTourAction,
  createManualTourAction,
  evaluateLeadAction,
  launchScreeningAction,
  markTourNoShowAction,
  requestInfoAction,
  rescheduleTourAction,
  scheduleTourAction,
  sendApplicationAction,
  updateScreeningRequestStatusAction,
  archiveLeadAction,
  unarchiveLeadAction,
  assignLeadPropertyAction,
  confirmDuplicateLeadAction,
  declineLeadAction,
  overrideLeadRoutingAction,
  sendManualOutboundMessageAction,
  updateLeadChannelOptOutAction,
} from "@/lib/lead-actions";
import {
  assignLeadOwnerAction,
  createTaskAction,
  updateTaskStatusAction,
} from "@/lib/collaboration-actions";

type LeadDetailPageProps = {
  params: Promise<{
    leadId: string;
  }>;
  searchParams: Promise<{
    assignment?: string;
    compose?: string;
    filter?: string;
    fit?: string;
    page?: string;
    pageSize?: string;
    property?: string;
    q?: string;
    source?: string;
    status?: string;
    showArchived?: string;
    sort?: string;
    workflowError?: string;
  }>;
};

const leadListFilterValues: LeadListFilter[] = [
  "all",
  "awaiting-response",
  "archived",
  "review",
  "qualified",
  "unassigned",
  "overdue",
];

const leadListSortValues: LeadListSort[] = [
  "last-activity-desc",
  "last-activity-asc",
  "name-asc",
  "name-desc",
  "property-asc",
  "property-desc",
  "assignee-asc",
  "assignee-desc",
  "move-in-asc",
  "move-in-desc",
  "budget-high",
  "budget-low",
];

const leadWorkflowStages = [
  {
    description: "Lead captured and ready for first action.",
    key: "intake",
    label: "Intake",
    statuses: ["NEW"],
  },
  {
    description: "Waiting on outreach or missing details.",
    key: "follow-up",
    label: "Follow-up",
    statuses: ["AWAITING_RESPONSE", "INCOMPLETE"],
  },
  {
    description: "Needs operator review before routing forward.",
    key: "review",
    label: "Review",
    statuses: ["UNDER_REVIEW", "CAUTION"],
  },
  {
    description: "Qualified and ready for scheduling or application.",
    key: "qualified",
    label: "Qualified",
    statuses: ["QUALIFIED"],
  },
  {
    description: "Tour coordination is active.",
    key: "tour",
    label: "Tour",
    statuses: ["TOUR_SCHEDULED"],
  },
  {
    description: "Application has been sent and is in flight.",
    key: "application",
    label: "Application",
    statuses: ["APPLICATION_SENT"],
  },
  {
    description: "Lead reached a final state.",
    key: "outcome",
    label: "Outcome",
    statuses: ["DECLINED", "ARCHIVED", "CLOSED"],
  },
] as const;

const majorPanelClassName =
  "mb-6 rounded-[2.4rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[0_26px_60px_rgba(44,32,20,0.09)] md:p-7";

const sectionPanelClassName =
  "rounded-[2.1rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[0_22px_52px_rgba(44,32,20,0.08)]";

const insetPanelClassName =
  "rounded-[1.7rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.34)]";

const metadataTileClassName =
  "rounded-[1.45rem] border border-[rgba(184,88,51,0.14)] bg-[rgba(255,255,255,0.78)] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.42)]";

const navigationActionClassName =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-[rgba(184,88,51,0.18)] bg-[rgba(249,240,231,0.96)] px-4 py-3 text-sm font-medium text-[var(--color-accent-strong)] shadow-[0_8px_18px_rgba(62,43,28,0.05)] transition-[color,background-color,border-color,transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:border-[rgba(184,88,51,0.3)] hover:bg-[rgba(255,247,239,0.98)] hover:text-[rgb(123,54,29)] hover:shadow-[0_14px_28px_rgba(62,43,28,0.08)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(184,88,51,0.08)]";

const navigationActionDisabledClassName =
  "inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-2xl border border-[rgba(184,88,51,0.14)] bg-[rgba(241,232,222,0.68)] px-4 py-3 text-sm font-medium text-[rgba(113,94,78,0.64)] shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]";

const primaryWorkflowButtonClassName =
  "inline-flex min-h-11 items-center justify-center rounded-2xl border border-[rgba(184,88,51,0.24)] bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white shadow-[0_12px_24px_rgba(141,63,33,0.22)] transition-colors duration-150 hover:bg-[var(--color-accent-strong)] disabled:cursor-not-allowed disabled:opacity-50";

const secondaryWorkflowButtonClassName =
  "inline-flex min-h-11 items-center justify-center rounded-2xl border border-[var(--color-line)] bg-[rgba(255,255,255,0.86)] px-4 py-3 text-sm font-medium text-[var(--color-ink)] transition-colors duration-150 hover:border-[rgba(184,88,51,0.2)] hover:bg-[rgba(255,255,255,0.96)] disabled:cursor-not-allowed disabled:opacity-50";

export default async function LeadDetailPage({
  params,
  searchParams,
}: LeadDetailPageProps) {
  const { leadId } = await params;
  const resolvedSearchParams = await searchParams;
  const lead = await getLeadDetailViewData(leadId);
  const workflowErrorCode = parseLeadWorkflowErrorCode(
    resolvedSearchParams.workflowError,
  );
  const workflowErrorMessage = workflowErrorCode
    ? getLeadWorkflowErrorUserMessage(workflowErrorCode)
    : null;

  if (!lead) {
    notFound();
  }

  const activeFilter = isLeadListFilter(resolvedSearchParams.filter)
    ? resolvedSearchParams.filter
    : "all";
  const activeSort = normalizeLeadListSort(resolvedSearchParams.sort);
  const activeAssignment = normalizeLeadListScopedFilterValue(
    resolvedSearchParams.assignment,
  );
  const activePage = parsePositiveInteger(resolvedSearchParams.page) ?? 1;
  const activePageSize = parsePositiveInteger(resolvedSearchParams.pageSize) ?? 10;
  const activeFit = normalizeLeadListFitValue(resolvedSearchParams.fit);
  const activeProperty = normalizeLeadListScopedFilterValue(
    resolvedSearchParams.property,
  );
  const activeQuery = resolvedSearchParams.q ?? "";
  const activeSource = normalizeLeadListScopedFilterValue(
    resolvedSearchParams.source,
  );
  const activeStatus = normalizeLeadListStatusValue(resolvedSearchParams.status);
  const showArchived =
    parseBooleanSearchParam(resolvedSearchParams.showArchived) ||
    activeFilter === "archived";
  const currentListParams = {
    assignment: activeAssignment,
    filter: activeFilter,
    fit: activeFit,
    page: activePage,
    pageSize: activePageSize,
    property: activeProperty,
    query: activeQuery,
    source: activeSource,
    status: activeStatus,
    showArchived,
    sort: activeSort,
  };
  const currentListHref = buildLeadsHref(currentListParams);
  const currentDetailHref = buildLeadDetailHref(lead.id, currentListParams);
  const messageLeadHref = buildLeadDetailHref(lead.id, {
    ...currentListParams,
    compose: "manual",
  });
  const askMissingQuestionsHref = buildLeadDetailHref(lead.id, {
    ...currentListParams,
    compose: "missing-info",
  });
  const composeMode = resolvedSearchParams.compose;
  const isManualComposerOpen = composeMode === "manual";
  const isMissingInfoDraftOpen = composeMode === "missing-info";
  const canMarkAsUnderReview =
    lead.actions.overrideFit &&
    lead.statusValue !== "UNDER_REVIEW" &&
    canTransitionLeadStatus(lead.statusValue, "UNDER_REVIEW");
  const canReassignProperty =
    lead.actions.assignProperty && lead.availableProperties.length > 0;
  const routingQuickActions = lead.actions.overrideFit
    ? getLeadRoutingQuickActions({
        currentFitValue: lead.fitValue,
        currentStatusValue: lead.statusValue,
        recommendedStatusValue: lead.recommendedStatusValue,
      })
    : [];
  const routingStatusOptions = lead.actions.overrideFit
    ? getLeadRoutingStatusOptions(lead.statusValue)
    : [];
  const extractedInfoRows = getPriorityExtractedInfoRows(
    lead.normalizedFieldMetadataRows,
  );
  const leadNavigation = await getLeadDetailNavigationData({
    assignment: activeAssignment,
    filter: activeFilter,
    fit: activeFit,
    leadId,
    property: activeProperty,
    query: activeQuery,
    source: activeSource,
    status: activeStatus,
    showArchived,
    sort: activeSort,
  });
  const workflowChart = getLeadWorkflowChart(lead.statusValue, lead.status);

  return (
    <main>
      <PageHeader
        eyebrow={lead.source}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span>{lead.name}</span>
            {lead.statusValue === "ARCHIVED" ? (
              <span className="inline-flex items-center rounded-full border border-[rgba(126,87,53,0.28)] bg-[rgb(229,214,198)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[rgb(98,66,40)] shadow-[inset_0_1px_0_rgba(255,255,255,0.34)]">
                Archived
              </span>
            ) : null}
          </span>
        }
        description={`${lead.property} | ${lead.status} | ${lead.contactMethod}`}
        actions={
          <div className="flex flex-col items-end gap-3">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="rounded-full border border-[rgba(21,94,239,0.18)] bg-[rgba(37,99,235,0.08)] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[rgb(29,78,216)]">
                Prospect-facing
              </span>
              {lead.actions.manualOutbound ? (
                <Link
                  className={primaryWorkflowButtonClassName}
                  href={`${messageLeadHref}#manual-outbound`}
                >
                  Message lead
                </Link>
              ) : null}
              {lead.requestInfoActionLabel === "Ask missing questions" ? (
                lead.askMissingQuestionsAvailability.canOpenComposer ? (
                  <Link
                    className={secondaryWorkflowButtonClassName}
                    href={`${askMissingQuestionsHref}#manual-outbound`}
                  >
                    Ask missing questions
                  </Link>
                ) : (
                  <button
                    className={secondaryWorkflowButtonClassName}
                    disabled
                    type="button"
                  >
                    Ask missing questions
                  </button>
                )
              ) : lead.actions.requestInfo ? (
                <form action={requestInfoAction.bind(null, lead.id)}>
                  <input type="hidden" name="redirectTo" value={currentDetailHref} />
                  <button className={secondaryWorkflowButtonClassName} type="submit">
                    Request info
                  </button>
                </form>
              ) : null}
              <Link className={secondaryWorkflowButtonClassName} href="#shared-thread">
                Open thread
              </Link>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="rounded-full border border-[rgba(184,88,51,0.18)] bg-[rgba(184,88,51,0.08)] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-accent-strong)]">
                Internal
              </span>
              {canReassignProperty ? (
                <Link
                  className={secondaryWorkflowButtonClassName}
                  href="#assignment-panel"
                >
                  Reassign property
                </Link>
              ) : null}
              {lead.actions.overrideFit ? (
                <Link
                  className={secondaryWorkflowButtonClassName}
                  href="#routing-controls"
                >
                  Qualify / Move status
                </Link>
              ) : null}
              <Link className={navigationActionClassName} href={currentListHref}>
                <span aria-hidden="true">←</span>
                Back to leads
              </Link>
              {leadNavigation.previousLead ? (
                <Link
                  className={navigationActionClassName}
                  href={buildLeadDetailHref(leadNavigation.previousLead.id, currentListParams)}
                  title={leadNavigation.previousLead.fullName}
                >
                  <span aria-hidden="true">←</span>
                  Previous lead
                </Link>
              ) : (
                <span aria-disabled="true" className={navigationActionDisabledClassName}>
                  <span aria-hidden="true">←</span>
                  Previous lead
                </span>
              )}
              {leadNavigation.nextLead ? (
                <Link
                  className={navigationActionClassName}
                  href={buildLeadDetailHref(leadNavigation.nextLead.id, currentListParams)}
                  title={leadNavigation.nextLead.fullName}
                >
                  Next lead
                  <span aria-hidden="true">→</span>
                </Link>
              ) : (
                <span aria-disabled="true" className={navigationActionDisabledClassName}>
                  Next lead
                  <span aria-hidden="true">→</span>
                </span>
              )}
            </div>
          </div>
        }
      />
      {workflowErrorMessage ? (
        <div className="mb-5 rounded-2xl border border-[rgba(184,88,51,0.28)] bg-[rgba(184,88,51,0.12)] px-4 py-3 text-sm text-[var(--color-accent-strong)]">
          {workflowErrorMessage}
        </div>
      ) : null}
      <section className={majorPanelClassName}>
        <div className="mb-6 rounded-[2rem] border border-[rgba(184,88,51,0.16)] bg-[linear-gradient(180deg,rgba(255,250,245,0.98),rgba(247,239,230,0.94))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] md:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">
                Workflow chart
              </div>
              <div className="mt-2 text-xl font-semibold tracking-tight">
                {workflowChart.currentStageLabel} stage
              </div>
              <div className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-muted)]">
                {workflowChart.summary}
              </div>
            </div>
            <div className="rounded-[1.4rem] border border-[rgba(184,88,51,0.16)] bg-[rgba(255,255,255,0.84)] px-4 py-3 shadow-[0_10px_24px_rgba(62,43,28,0.05)]">
              <div className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">
                Current status
              </div>
              <div className="mt-2 inline-flex items-center rounded-full border border-[rgba(184,88,51,0.18)] bg-[rgba(249,240,231,0.96)] px-3 py-1 text-sm font-semibold text-[var(--color-accent-strong)]">
                {workflowChart.currentStatusLabel}
              </div>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto pb-1">
            <div className="flex min-w-[980px] items-stretch gap-0">
              {workflowChart.stages.map((stage, index) => (
                <div key={stage.key} className="flex min-w-[132px] flex-1 items-center">
                  <div className="flex min-w-0 flex-1 flex-col items-center text-center">
                    <div
                      className={getWorkflowStageNodeClassName(stage.state)}
                    >
                      <span aria-hidden="true">{index + 1}</span>
                    </div>
                    <div className="mt-3 text-sm font-semibold text-[var(--color-ink)]">
                      {stage.label}
                    </div>
                    <div className="mt-1 max-w-[11rem] text-xs leading-5 text-[var(--color-muted)]">
                      {stage.displayDescription}
                    </div>
                  </div>
                  {index < workflowChart.stages.length - 1 ? (
                    <div className="mx-2 mt-[-2.7rem] h-[3px] flex-1 rounded-full bg-[rgba(184,88,51,0.14)]">
                      <div
                        className={getWorkflowConnectorFillClassName(stage.connectorState)}
                      />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.88fr)]">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
            <div className={insetPanelClassName}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">
                    Lead snapshot
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className={getDetailStatusBadgeClassName(lead.statusValue)}>{lead.status}</span>
                    <span className={getDetailFitBadgeClassName(lead.fitValue)}>{lead.fit}</span>
                    <span className="inline-flex items-center rounded-full border border-[rgba(184,88,51,0.16)] bg-[rgba(255,255,255,0.8)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                      {lead.source}
                    </span>
                  </div>
                </div>
                <div className="rounded-[1.35rem] border border-[rgba(184,88,51,0.14)] bg-[rgba(255,255,255,0.74)] px-4 py-3 text-right">
                  <div className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">
                    Last activity
                  </div>
                  <div className="mt-1 text-sm font-medium text-[var(--color-ink)]">{lead.lastActivity}</div>
                </div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className={metadataTileClassName}>
                  <div className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">Primary contact</div>
                  <div className="mt-2 text-sm font-medium">{lead.contactMethod}</div>
                </div>
                <div className={metadataTileClassName}>
                  <div className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">Assigned property</div>
                  <div className="mt-2 text-sm font-medium">{lead.property}</div>
                </div>
                <div className={metadataTileClassName}>
                  <div className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">Email</div>
                  <div className="mt-2 break-all text-sm font-medium">{lead.email}</div>
                </div>
                <div className={metadataTileClassName}>
                  <div className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">Phone</div>
                  <div className="mt-2 text-sm font-medium">{lead.phone}</div>
                </div>
                <div className={metadataTileClassName}>
                  <div className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">Assigned teammate</div>
                  <div className="mt-2 text-sm font-medium">{lead.leadOwner.assignedTo}</div>
                </div>
              </div>
            </div>

            <div className={insetPanelClassName}>
              <div className="text-sm font-semibold">Quick facts</div>
              <div className="mt-4 grid gap-3">
                <SnapshotFact label="Assigned owner" value={lead.leadOwner.assignedTo} />
                <SnapshotFact label="Move-in date" value={lead.moveInDate} />
                <SnapshotFact label="Budget" value={lead.budget} />
                <SnapshotFact label="Stay length" value={lead.stayLength} />
                <SnapshotFact label="Work status" value={lead.workStatus} />
              </div>
              <div className="mt-4 rounded-[1.45rem] border border-[rgba(184,88,51,0.12)] bg-[rgba(255,255,255,0.7)] px-4 py-4 text-sm text-[var(--color-muted)]">
                {lead.notes}
              </div>
            </div>

            {extractedInfoRows.length > 0 ? (
              <div className={`${insetPanelClassName} lg:col-span-2`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">Extracted lead info</div>
                    <div className="mt-2 text-sm text-[var(--color-muted)]">
                      The normalized fields currently driving qualification and follow-up decisions.
                    </div>
                  </div>
                  <Link
                    className="text-sm font-medium text-[var(--color-accent-strong)] underline decoration-[var(--color-line)] underline-offset-4"
                    href="#qualification-details"
                  >
                    Open fit explanation
                  </Link>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {extractedInfoRows.map((fieldRow) => (
                    <div
                      key={fieldRow.key}
                      className="rounded-[1.35rem] border border-[rgba(184,88,51,0.12)] bg-[rgba(255,255,255,0.74)] px-4 py-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
                          {fieldRow.label}
                        </div>
                        <div className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
                          {fieldRow.confidencePercent}%
                        </div>
                      </div>
                      <div className="mt-2 text-sm font-medium text-[var(--color-ink)]">
                        {fieldRow.value}
                      </div>
                      <div className="mt-2 text-xs text-[var(--color-muted)]">
                        {fieldRow.source}
                        {fieldRow.isSuggested ? " | suggested review" : ""}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="grid gap-5">
            <div className="rounded-[2rem] border border-[rgba(184,88,51,0.18)] bg-[linear-gradient(180deg,rgba(255,250,244,0.98),rgba(248,241,234,0.94))] p-5 shadow-[0_22px_54px_rgba(44,32,20,0.08)]">
              <div className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">
                Workflow focus
              </div>
              <div className="mt-2 text-lg font-semibold leading-tight">
                Move this lead forward with the smallest next step.
              </div>
              <div className="mt-4 space-y-3">
                {lead.slaSummary ? (
                  <div className="rounded-[1.35rem] border border-[rgba(184,88,51,0.14)] bg-[rgba(255,255,255,0.82)] px-4 py-3 text-sm text-[var(--color-muted)]">
                    <span className="font-medium text-[var(--color-ink)]">{lead.slaSummary.label}</span> due {lead.slaSummary.dueAtRelative}
                  </div>
                ) : null}
                {lead.possibleDuplicateCandidate ? (
                  <div className="rounded-[1.35rem] border border-[rgba(184,88,51,0.18)] bg-[rgba(184,88,51,0.08)] px-4 py-3 text-sm text-[var(--color-accent-strong)]">
                    Possible duplicate found with {lead.possibleDuplicateCandidate.name}.
                  </div>
                ) : null}
                {lead.optOutSummary.isOptedOut ? (
                  <div className="rounded-[1.35rem] border border-[rgba(184,88,51,0.14)] bg-[rgba(255,255,255,0.82)] px-4 py-3 text-sm text-[var(--color-muted)]">
                    Latest opt-out {lead.optOutSummary.optedOutAt}
                    {lead.optOutSummary.optedOutReason ? ` | ${lead.optOutSummary.optedOutReason}` : ""}
                  </div>
                ) : null}
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <form action={evaluateLeadAction.bind(null, lead.id)}>
                  <input type="hidden" name="redirectTo" value={currentDetailHref} />
                  <button
                    className={primaryWorkflowButtonClassName}
                    disabled={!lead.actions.evaluateFit}
                    type="submit"
                  >
                    Evaluate fit
                  </button>
                </form>
                {lead.requestInfoActionLabel === "Ask missing questions" ? (
                  lead.actions.manualOutbound && lead.askMissingQuestionsDraft ? (
                    <Link
                      className={secondaryWorkflowButtonClassName}
                      href={`${askMissingQuestionsHref}#manual-outbound`}
                    >
                      {lead.requestInfoActionLabel}
                    </Link>
                  ) : (
                    <button
                      className={secondaryWorkflowButtonClassName}
                      disabled
                      type="button"
                    >
                      {lead.requestInfoActionLabel}
                    </button>
                  )
                ) : (
                  <form action={requestInfoAction.bind(null, lead.id)}>
                    <input type="hidden" name="redirectTo" value={currentDetailHref} />
                    <button
                      className={secondaryWorkflowButtonClassName}
                      disabled={!lead.actions.requestInfo}
                      type="submit"
                    >
                      {lead.requestInfoActionLabel}
                    </button>
                  </form>
                )}
                <form action={scheduleTourAction.bind(null, lead.id)}>
                  <input type="hidden" name="redirectTo" value={currentDetailHref} />
                  <button
                    className={secondaryWorkflowButtonClassName}
                    disabled={!lead.actions.scheduleTour}
                    type="submit"
                  >
                    Send scheduling handoff
                  </button>
                </form>
                <form action={sendApplicationAction.bind(null, lead.id)}>
                  <input type="hidden" name="redirectTo" value={currentDetailHref} />
                  <button
                    className={secondaryWorkflowButtonClassName}
                    disabled={!lead.actions.sendApplication}
                    type="submit"
                  >
                    Send application
                  </button>
                </form>
              </div>
              {lead.actions.archiveLead || lead.actions.unarchiveLead ? (
                <form className="mt-3" action={(lead.actions.unarchiveLead ? unarchiveLeadAction : archiveLeadAction).bind(null, lead.id)}>
                  <input type="hidden" name="redirectTo" value={currentDetailHref} />
                  <button
                    className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-[rgba(184,88,51,0.18)] bg-[rgba(255,255,255,0.9)] px-4 py-3 text-sm font-medium text-[var(--color-ink)] transition-colors duration-150 hover:border-[rgba(184,88,51,0.28)] hover:bg-[rgba(255,255,255,0.98)]"
                    type="submit"
                  >
                    {lead.actions.unarchiveLead ? "Unarchive lead" : "Archive lead"}
                  </button>
                </form>
              ) : null}
            </div>

            {lead.actions.overrideFit ? (
              <div
                className="rounded-[2rem] border border-[rgba(184,88,51,0.18)] bg-[rgba(255,255,255,0.9)] p-5 shadow-[0_20px_48px_rgba(44,32,20,0.07)]"
                id="routing-controls"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">
                      Routing controls
                    </div>
                    <div className="mt-2 text-lg font-semibold leading-tight">
                      Move status without dropping into the full operator stack.
                    </div>
                  </div>
                  <div className="rounded-[1.35rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm text-[var(--color-muted)]">
                    Recommended next state: <span className="font-semibold text-[var(--color-ink)]">{lead.recommendedStatus}</span>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[1.35rem] border border-[rgba(184,88,51,0.12)] bg-[rgba(249,240,231,0.6)] px-4 py-4">
                    <div className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">Current</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className={getDetailStatusBadgeClassName(lead.statusValue)}>{lead.status}</span>
                      <span className={getDetailFitBadgeClassName(lead.fitValue)}>{lead.fit}</span>
                    </div>
                  </div>
                  <div className="rounded-[1.35rem] border border-[rgba(184,88,51,0.12)] bg-[rgba(255,255,255,0.8)] px-4 py-4 text-sm text-[var(--color-muted)]">
                    {routingStatusOptions.length > 1
                      ? `${routingStatusOptions.length - 1} valid manual status transition${routingStatusOptions.length === 2 ? "" : "s"} from here.`
                      : "No forward transitions are available from this status."}
                  </div>
                </div>

                {routingQuickActions.length > 0 ? (
                  <div className="mt-4">
                    <div className="text-sm font-semibold">Quick moves</div>
                    <div className="mt-3 flex flex-wrap gap-3">
                      {routingQuickActions.map((quickAction) => (
                        <form
                          action={overrideLeadRoutingAction.bind(null, lead.id)}
                          key={quickAction.statusValue}
                        >
                          <input type="hidden" name="overrideStatus" value={quickAction.statusValue} />
                          <input type="hidden" name="overrideFit" value={quickAction.fitValue} />
                          <input type="hidden" name="overrideReason" value={quickAction.reason} />
                          <input type="hidden" name="redirectTo" value={currentDetailHref} />
                          <button className={secondaryWorkflowButtonClassName} type="submit">
                            {quickAction.label}
                          </button>
                        </form>
                      ))}
                    </div>
                  </div>
                ) : null}

                <form
                  action={overrideLeadRoutingAction.bind(null, lead.id)}
                  className="mt-5 rounded-[1.45rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-4"
                >
                  <div className="text-sm font-semibold">Manual routing update</div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                        Status
                      </span>
                      <select
                        className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                        defaultValue={lead.recommendedStatusValue}
                        name="overrideStatus"
                        required
                      >
                        {routingStatusOptions.map((statusOption) => (
                          <option key={statusOption} value={statusOption}>
                            {formatLeadStatusOptionLabel(statusOption)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                        Fit
                      </span>
                      <select
                        className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                        defaultValue={resolveRoutingPanelFitDefault(
                          lead.fitValue,
                          lead.recommendedStatusValue,
                        )}
                        name="overrideFit"
                        required
                      >
                        {["UNKNOWN", "PASS", "CAUTION", "MISMATCH"].map((fitOption) => (
                          <option key={fitOption} value={fitOption}>
                            {formatLeadStatusOptionLabel(fitOption)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label className="mt-3 block space-y-2">
                    <span className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                      Reason
                    </span>
                    <input
                      className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                      defaultValue="Routed from the Workflow 7 status controls."
                      name="overrideReason"
                      required
                      type="text"
                    />
                  </label>
                  <input type="hidden" name="redirectTo" value={currentDetailHref} />
                  <button className="mt-3 rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white" type="submit">
                    Save routing update
                  </button>
                </form>
              </div>
            ) : null}
          </div>
        </div>
      </section>
      <section className={majorPanelClassName}>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="text-lg font-semibold">Assignment and review SLA</div>
            <div className="mt-2 text-sm text-[var(--color-muted)]">
              Current owner: {lead.leadOwner.assignedTo}
            </div>
            {lead.slaSummary ? (
              <div className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs ${lead.slaSummary.isOverdue ? "border-[rgba(184,88,51,0.28)] bg-[rgba(184,88,51,0.08)] text-[var(--color-accent-strong)]" : "border-[var(--color-line)] bg-[var(--color-panel-strong)] text-[var(--color-muted)]"}`}>
                {lead.slaSummary.label} due {lead.slaSummary.dueAtRelative}
              </div>
            ) : null}
          </div>

          <div id="assignment-panel" className="grid gap-4 lg:grid-cols-2">
            <form
              action={assignLeadOwnerAction.bind(null, lead.id)}
              className="rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-5"
            >
              <div className="text-sm font-medium">Assign lead owner</div>
              <select
                className="mt-3 min-w-64 rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                defaultValue={lead.leadOwner.assignedMembershipId ?? "unassigned"}
                disabled={!lead.actions.assignProperty}
                name="assignedMembershipId"
              >
                {lead.leadAssignmentOptions.map((assignmentOption) => (
                  <option key={assignmentOption.value} value={assignmentOption.value}>
                    {assignmentOption.label} | {assignmentOption.summary}
                  </option>
                ))}
              </select>
              <input type="hidden" name="redirectTo" value={currentDetailHref} />
              <button
                className="mt-4 rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!lead.actions.assignProperty}
                type="submit"
              >
                Save owner
              </button>
            </form>
            {canReassignProperty ? (
              <form
                action={assignLeadPropertyAction.bind(null, lead.id)}
                className="rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-5"
              >
                <div className="text-sm font-medium">
                  {lead.property === "Unassigned" ? "Assign property" : "Reassign property"}
                </div>
                <select
                  className="mt-3 w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                  name="propertyId"
                  required
                  defaultValue={lead.propertyId ?? ""}
                >
                  <option disabled={lead.property !== "Unassigned"} value="">
                    Choose property
                  </option>
                  {lead.availableProperties.map((propertyOption) => (
                    <option key={propertyOption.id} value={propertyOption.id}>
                      {propertyOption.name}
                    </option>
                  ))}
                </select>
                <input type="hidden" name="redirectTo" value={currentDetailHref} />
                <button
                  className="mt-4 rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white"
                  type="submit"
                >
                  {lead.property === "Unassigned" ? "Assign property" : "Save property"}
                </button>
              </form>
            ) : null}
          </div>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <form action={createTaskAction} className="rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-5">
            <div className="text-sm font-medium">Create follow-up task</div>
            <label className="mt-3 block text-sm text-[var(--color-muted)]">
              Title
              <input
                className="mt-2 w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                name="title"
                placeholder="Review duplicate risk before next reply"
                required
                type="text"
              />
            </label>
            <label className="mt-3 block text-sm text-[var(--color-muted)]">
              Description
              <textarea
                className="mt-2 min-h-24 w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                name="description"
                placeholder="Optional extra context for the assigned teammate."
              />
            </label>
            <label className="mt-3 block text-sm text-[var(--color-muted)]">
              Due at
              <input
                className="mt-2 w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                name="dueAt"
                type="datetime-local"
              />
            </label>
            <label className="mt-3 block text-sm text-[var(--color-muted)]">
              Assign to
              <select
                className="mt-2 w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                defaultValue={lead.leadOwner.assignedMembershipId ?? "unassigned"}
                disabled={!lead.actions.assignProperty}
                name="assignedMembershipId"
              >
                {lead.leadAssignmentOptions.map((assignmentOption) => (
                  <option key={`${lead.id}-${assignmentOption.value}`} value={assignmentOption.value}>
                    {assignmentOption.label} | {assignmentOption.summary}
                  </option>
                ))}
              </select>
            </label>
            <input type="hidden" name="leadId" value={lead.id} />
            <input type="hidden" name="redirectTo" value={currentDetailHref} />
            <button
              className="mt-4 rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white"
              type="submit"
            >
              Create task
            </button>
          </form>

          <div className="rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-5">
            <div className="text-sm font-medium">Open tasks</div>
            {lead.tasks.length === 0 ? (
              <div className="mt-4 text-sm text-[var(--color-muted)]">
                No follow-up tasks on this lead yet.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {lead.tasks.map((task) => (
                  <form
                    action={updateTaskStatusAction.bind(null, task.id)}
                    className="rounded-2xl border border-[var(--color-line)] bg-white p-4"
                    key={task.id}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{task.title}</div>
                        <div className="mt-1 text-sm text-[var(--color-muted)]">
                          {task.assignedTo} {task.dueAt !== "Not set" ? `| due ${task.dueAt}` : "| no due date"}
                        </div>
                        {task.description ? (
                          <div className="mt-2 text-sm text-[var(--color-muted)]">
                            {task.description}
                          </div>
                        ) : null}
                      </div>
                      {task.isOverdue ? (
                        <div className="rounded-full border border-[rgba(184,88,51,0.28)] bg-[rgba(184,88,51,0.08)] px-3 py-1 text-xs text-[var(--color-accent-strong)]">
                          Overdue
                        </div>
                      ) : null}
                    </div>
                    <div className="mt-4 flex flex-wrap items-end gap-3">
                      <label className="space-y-2 text-sm font-medium">
                        <span>Status</span>
                        <select
                          className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-3 outline-none"
                          defaultValue={task.statusValue}
                          name="status"
                        >
                          <option value="OPEN">Open</option>
                          <option value="IN_PROGRESS">In Progress</option>
                          <option value="COMPLETED">Completed</option>
                          <option value="CANCELED">Canceled</option>
                        </select>
                      </label>
                        <input type="hidden" name="redirectTo" value={currentDetailHref} />
                      <button
                        className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-3 text-sm font-medium"
                        type="submit"
                      >
                        Save task
                      </button>
                    </div>
                  </form>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
      {lead.automationSuppressionSummaries.length > 0 ? (
        <div className={`${sectionPanelClassName} mb-5`}>
          <div className="text-sm font-semibold">Automation suppression reasons</div>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Manual outbound remains available, but these automated actions are currently blocked.
          </p>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {lead.automationSuppressionSummaries.map((summary) => (
              <div
                key={summary.actionKey}
                className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4"
              >
                <div className="text-sm font-medium">{summary.actionLabel}</div>
                <div className="mt-3 space-y-2 text-sm text-[var(--color-muted)]">
                  {summary.reasons.map((reason) => (
                    <div key={`${summary.actionKey}-${reason}`}>{reason}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <section className={majorPanelClassName}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-lg font-semibold">Manual tour scheduling</div>
            <p className="mt-2 max-w-2xl text-sm text-[var(--color-muted)]">
              Schedule an operator-managed tour here, or keep using the separate handoff button when the prospect should pick their own time from the property link.
            </p>
            <div className="mt-3 grid gap-2 text-sm text-[var(--color-muted)] md:grid-cols-2">
              <div>Operator availability: {lead.operatorSchedulingAvailabilitySummary}</div>
              <div>Property availability: {lead.propertySchedulingAvailabilitySummary}</div>
              <div>Assignment mode: {lead.tourSchedulingModeSummary}</div>
              <div>Reminder sequence: {lead.tourReminderSequenceSummary}</div>
            </div>
          </div>
          {lead.upcomingTour ? (
            <div className="rounded-full border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-2 text-sm font-medium">
              Upcoming tour on {lead.upcomingTour.scheduledAt}
            </div>
          ) : null}
        </div>

        {lead.upcomingTour ? (
          <div className="mt-5 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-5">
              <div className="text-sm font-medium text-[var(--color-muted)]">Upcoming tour</div>
              <div className="mt-2 text-xl font-semibold">{lead.upcomingTour.scheduledAt}</div>
              <div className="mt-2 text-sm text-[var(--color-muted)]">
                Status: {lead.upcomingTour.status}
              </div>
              <div className="mt-2 text-sm text-[var(--color-muted)]">
                Assigned to: {lead.upcomingTour.assignedTo}
              </div>
              <div className="mt-2 text-sm text-[var(--color-muted)]">
                Property: {lead.property}
              </div>
              <div className="mt-2 text-sm text-[var(--color-muted)]">
                Sync: {lead.upcomingTour.calendarSyncSummary}
              </div>
              <div className="mt-2 text-sm text-[var(--color-muted)]">
                Reminders: {lead.upcomingTour.reminderSummary}
              </div>
              <div className="mt-2 text-sm text-[var(--color-muted)]">
                Prospect notified: {lead.upcomingTour.prospectNotificationSentAt}
              </div>
              {lead.upcomingTour.externalCalendarId ? (
                <div className="mt-2 text-sm text-[var(--color-muted)]">
                  External calendar id: {lead.upcomingTour.externalCalendarId}
                </div>
              ) : null}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <form
                action={rescheduleTourAction.bind(null, lead.id)}
                className="rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-5"
              >
                <div className="text-sm font-medium">Reschedule tour</div>
                <label className="mt-3 block text-sm text-[var(--color-muted)]">
                  New tour date and time
                  <input
                    className="mt-2 w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                    defaultValue={lead.upcomingTour.scheduledAtInputValue}
                    name="scheduledAt"
                    required
                    type="datetime-local"
                  />
                </label>
                <label className="mt-3 block text-sm text-[var(--color-muted)]">
                  Assign to
                  <select
                    className="mt-2 w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                    defaultValue={lead.upcomingTour.assignedMembershipId ?? lead.tourAssignmentOptions[0]?.value}
                    name="assignedMembershipId"
                  >
                    {lead.tourAssignmentOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label} | {option.summary}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="mt-3 block text-sm text-[var(--color-muted)]">
                  Reschedule reason
                  <input
                    className="mt-2 w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                    defaultValue="Rescheduled by operator"
                    name="operatorRescheduleReason"
                    placeholder="Rescheduled by operator"
                  />
                </label>
                <label className="mt-3 flex items-center gap-2 text-sm text-[var(--color-muted)]">
                  <input defaultChecked name="notifyProspect" type="checkbox" />
                  Notify prospect about this change
                </label>
                <label className="mt-3 block text-sm text-[var(--color-muted)]">
                  Optional prospect message
                  <textarea
                    className="mt-2 min-h-24 w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                    name="prospectMessage"
                    placeholder="Your tour has been moved to a new time."
                  />
                </label>
                <input type="hidden" name="redirectTo" value={currentDetailHref} />
                <button
                  className="mt-4 rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!lead.actions.manageScheduledTour}
                  type="submit"
                >
                  Reschedule tour
                </button>
              </form>

              <form
                action={cancelTourAction.bind(null, lead.id)}
                className="rounded-[1.5rem] border border-[rgba(184,88,51,0.28)] bg-[rgba(184,88,51,0.08)] p-5"
              >
                <div className="text-sm font-medium">Cancel tour</div>
                <label className="mt-3 block text-sm text-[var(--color-muted)]">
                  Cancellation reason
                  <input
                    className="mt-2 w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                    defaultValue="Canceled by operator"
                    name="operatorCancelReason"
                    placeholder="Canceled by operator"
                    required
                  />
                </label>
                <label className="mt-3 flex items-center gap-2 text-sm text-[var(--color-muted)]">
                  <input defaultChecked name="notifyProspect" type="checkbox" />
                  Notify prospect about cancellation
                </label>
                <label className="mt-3 block text-sm text-[var(--color-muted)]">
                  Optional prospect message
                  <textarea
                    className="mt-2 min-h-24 w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                    name="prospectMessage"
                    placeholder="Your tour has been canceled. Reply if you want another time."
                  />
                </label>
                <label className="mt-3 block text-sm text-[var(--color-muted)]">
                  Route lead back to
                  <select
                    className="mt-2 w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                    defaultValue="QUALIFIED"
                    name="routeToStatus"
                  >
                    <option value="QUALIFIED">Qualified</option>
                    <option value="UNDER_REVIEW">Under review</option>
                  </select>
                </label>
                <input type="hidden" name="redirectTo" value={currentDetailHref} />
                <button
                  className="mt-4 rounded-2xl border border-[rgba(184,88,51,0.28)] bg-[rgba(184,88,51,0.14)] px-4 py-3 text-sm font-medium text-[var(--color-accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!lead.actions.manageScheduledTour}
                  type="submit"
                >
                  Cancel scheduled tour
                </button>
              </form>

              <form
                action={completeTourAction.bind(null, lead.id)}
                className="rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-5"
              >
                <div className="text-sm font-medium">Complete tour</div>
                <p className="mt-3 text-sm text-[var(--color-muted)]">
                  Mark the scheduled tour as completed and move the lead back to qualified follow-up.
                </p>
                <input type="hidden" name="redirectTo" value={currentDetailHref} />
                <button
                  disabled={!lead.actions.manageScheduledTour}
                  type="submit"
                >
                  Mark completed
                </button>
              </form>

              <form
                action={markTourNoShowAction.bind(null, lead.id)}
                className="rounded-[1.5rem] border border-[rgba(184,88,51,0.28)] bg-[rgba(184,88,51,0.06)] p-5"
              >
                <div className="text-sm font-medium">Mark no-show</div>
                <label className="mt-3 block text-sm text-[var(--color-muted)]">
                  No-show reason
                  <input
                    className="mt-2 w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                    defaultValue="Prospect did not attend."
                    name="operatorNoShowReason"
                    placeholder="Prospect did not attend."
                  />
                </label>
                <input type="hidden" name="redirectTo" value={currentDetailHref} />
                <button
                  className="mt-4 rounded-2xl border border-[rgba(184,88,51,0.28)] bg-[rgba(184,88,51,0.14)] px-4 py-3 text-sm font-medium text-[var(--color-accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!lead.actions.manageScheduledTour}
                  type="submit"
                >
                  Record no-show
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="mt-5 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-5">
              <div className="text-sm font-medium">No upcoming tour</div>
              <p className="mt-3 text-sm text-[var(--color-muted)]">
                Manual scheduling becomes available once the lead is qualified and assigned to an active property.
              </p>
            </div>
            <form
              action={createManualTourAction.bind(null, lead.id)}
              className="rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-5"
            >
              <div className="text-sm font-medium">Create manual tour</div>
              <div className="mt-3 text-sm text-[var(--color-muted)]">
                Assignment mode: {lead.tourSchedulingModeSummary}
              </div>
              <label className="mt-3 block text-sm text-[var(--color-muted)]">
                Tour date and time
                <input
                  className="mt-2 w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                  name="scheduledAt"
                  required
                  type="datetime-local"
                />
              </label>
              <label className="mt-3 block text-sm text-[var(--color-muted)]">
                Assign to
                <select
                  className="mt-2 w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                  defaultValue={lead.tourAssignmentOptions[0]?.value}
                  name="assignedMembershipId"
                >
                  {lead.tourAssignmentOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label} | {option.summary}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mt-3 flex items-center gap-2 text-sm text-[var(--color-muted)]">
                <input defaultChecked name="notifyProspect" type="checkbox" />
                Send confirmation to prospect
              </label>
              <input type="hidden" name="redirectTo" value={currentDetailHref} />
              <button
                className="mt-4 rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!lead.actions.manualScheduleTour}
                type="submit"
              >
                Schedule manually
              </button>
            </form>
          </div>
        )}

        {lead.tourHistory.length > 0 ? (
          <div className="mt-5 border-t border-[var(--color-line)] pt-5">
            <div className="text-sm font-medium">Tour history</div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {lead.tourHistory.map((tour) => (
                <div
                  key={tour.id}
                  className="rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{tour.status}</div>
                      <div className="mt-1 text-sm text-[var(--color-muted)]">
                        {tour.scheduledAt}
                      </div>
                          <div className="mt-3 text-sm text-[var(--color-muted)]">
                            Assigned to: {tour.assignedTo}
                          </div>
                          <div className="mt-2 text-sm text-[var(--color-muted)]">
                            Sync: {tour.calendarSyncSummary}
                          </div>
                          <div className="mt-2 text-sm text-[var(--color-muted)]">
                            Reminders: {tour.reminderSummary}
                          </div>
                    </div>
                    <div className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">
                      {tour.createdAt}
                    </div>
                  </div>
                  {tour.cancelReason ? (
                    <div className="mt-3 text-sm text-[var(--color-muted)]">
                      Reason: {tour.cancelReason}
                    </div>
                  ) : null}
                  {tour.operatorRescheduleReason ? (
                    <div className="mt-2 text-sm text-[var(--color-muted)]">
                      Reschedule note: {tour.operatorRescheduleReason}
                    </div>
                  ) : null}
                  {tour.operatorNoShowReason ? (
                    <div className="mt-2 text-sm text-[var(--color-muted)]">
                      No-show note: {tour.operatorNoShowReason}
                    </div>
                  ) : null}
                  {tour.externalCalendarId ? (
                    <div className="mt-2 text-sm text-[var(--color-muted)]">
                      External calendar id: {tour.externalCalendarId}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {lead.canUseScreening ? (
        <section className={majorPanelClassName}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-lg font-semibold">Screening and verification</div>
              <p className="mt-2 max-w-3xl text-sm text-[var(--color-muted)]">
                Launch provider-hosted screening from a qualified lead, then track consent, review readiness, report references, and adverse-action workflow steps here.
              </p>
            </div>
            <div className="rounded-full border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-2 text-sm font-medium">
              {lead.screeningRequests.length} screening request{lead.screeningRequests.length === 1 ? "" : "s"}
            </div>
          </div>

          {lead.screeningConnections.length === 0 ? (
            <div className="mt-5 rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-5 text-sm text-[var(--color-muted)]">
              No active screening providers are configured yet. Add one from settings before launching a screening request.
            </div>
          ) : (
            <div className="mt-5 grid gap-4 xl:grid-cols-3">
              {lead.screeningConnections.map((screeningConnection) => (
                <form
                  action={launchScreeningAction.bind(null, lead.id)}
                  className="rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-5"
                  key={screeningConnection.id}
                >
                  <div className="text-sm font-medium">Launch {screeningConnection.providerLabel}</div>
                  <div className="mt-2 text-sm text-[var(--color-muted)]">
                    {screeningConnection.summary}
                  </div>
                  <label className="mt-3 block text-sm text-[var(--color-muted)]">
                    Package
                    <select
                      className="mt-2 w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                      defaultValue={screeningConnection.packageOptions[0]?.key}
                      name="packageKey"
                    >
                      {screeningConnection.packageOptions.map((packageOption) => (
                        <option key={packageOption.key} value={packageOption.key}>
                          {packageOption.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="mt-3 block text-sm text-[var(--color-muted)]">
                    Package label
                    <input
                      className="mt-2 w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                      defaultValue={screeningConnection.packageOptions[0]?.label ?? ""}
                      name="packageLabel"
                      placeholder="Standard screening"
                      type="text"
                    />
                  </label>
                  <label className="mt-3 block text-sm text-[var(--color-muted)]">
                    Provider reference
                    <input
                      className="mt-2 w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                      name="providerReference"
                      placeholder="Invite or applicant reference"
                      type="text"
                    />
                  </label>
                  <input name="screeningConnectionId" type="hidden" value={screeningConnection.id} />
                    <input type="hidden" name="redirectTo" value={currentDetailHref} />
                  <button
                    className="mt-4 rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!lead.actions.launchScreening}
                    type="submit"
                  >
                    Launch screening
                  </button>
                </form>
              ))}
            </div>
          )}

          {lead.screeningRequests.length > 0 ? (
            <div className="mt-6 space-y-4 border-t border-[var(--color-line)] pt-5">
              {lead.screeningRequests.map((screeningRequest) => (
                <div
                  className="rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-5"
                  key={screeningRequest.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">{screeningRequest.summary}</div>
                      <div className="mt-2 text-sm text-[var(--color-muted)]">
                        Requested {screeningRequest.requestedAt} · Invite {screeningRequest.invitedAt}
                      </div>
                      <div className="mt-2 text-sm text-[var(--color-muted)]">
                        Current status: {screeningRequest.currentStatus} · Charge mode: {screeningRequest.chargeMode}
                      </div>
                    </div>
                    <div className="text-sm text-[var(--color-muted)]">
                      Provider: {screeningRequest.provider}
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    <div className="rounded-2xl border border-[var(--color-line)] bg-white px-4 py-4 text-sm text-[var(--color-muted)]">
                      <div>Consent completed: {screeningRequest.consentCompletedAt}</div>
                      <div className="mt-2">Started: {screeningRequest.startedAt}</div>
                      <div className="mt-2">Completed: {screeningRequest.completedAt}</div>
                      <div className="mt-2">Reviewed: {screeningRequest.reviewedAt}</div>
                      <div className="mt-2">
                        Adverse action recorded: {screeningRequest.adverseActionRecordedAt}
                      </div>
                      <div className="mt-2">Provider updated: {screeningRequest.providerUpdatedAt}</div>
                      <div className="mt-2">Charge recorded: {screeningRequest.chargeAmount}</div>
                      {screeningRequest.chargeReference ? (
                        <div className="mt-2">Charge reference: {screeningRequest.chargeReference}</div>
                      ) : null}
                      {screeningRequest.providerReference ? (
                        <div className="mt-2">Provider reference: {screeningRequest.providerReference}</div>
                      ) : null}
                      {screeningRequest.providerReportId ? (
                        <div className="mt-2">Report id: {screeningRequest.providerReportId}</div>
                      ) : null}
                      {screeningRequest.providerReportUrl ? (
                        <div className="mt-2 break-all">Report url: {screeningRequest.providerReportUrl}</div>
                      ) : null}
                    </div>
                    <div className="rounded-2xl border border-[var(--color-line)] bg-white px-4 py-4 text-sm text-[var(--color-muted)]">
                      <div className="font-medium text-[color:var(--color-ink)]">Status timeline</div>
                      <div className="mt-3 space-y-2">
                        {screeningRequest.statusEvents.map((statusEvent) => (
                          <div key={statusEvent.id}>
                            {statusEvent.status} · {statusEvent.at}
                            {statusEvent.detail ? ` · ${statusEvent.detail}` : ""}
                          </div>
                        ))}
                      </div>
                      {screeningRequest.consentRecords.length > 0 ? (
                        <div className="mt-4 border-t border-[var(--color-line)] pt-3">
                          <div className="font-medium text-[color:var(--color-ink)]">Consent records</div>
                          <div className="mt-2 space-y-2">
                            {screeningRequest.consentRecords.map((consentRecord) => (
                              <div key={consentRecord.id}>
                                {consentRecord.consentedAt}
                                {consentRecord.source ? ` · ${consentRecord.source}` : ""}
                                {consentRecord.disclosureVersion
                                  ? ` · ${consentRecord.disclosureVersion}`
                                  : ""}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {screeningRequest.attachmentReferences.length > 0 ? (
                        <div className="mt-4 border-t border-[var(--color-line)] pt-3">
                          <div className="font-medium text-[color:var(--color-ink)]">
                            Report references
                          </div>
                          <div className="mt-2 space-y-2">
                            {screeningRequest.attachmentReferences.map((attachmentReference) => (
                              <div key={attachmentReference.id}>
                                <div>
                                  {attachmentReference.url ? (
                                    <a
                                      className="underline decoration-[var(--color-line)] underline-offset-4"
                                      href={attachmentReference.url}
                                      rel="noreferrer"
                                      target="_blank"
                                    >
                                      {attachmentReference.label}
                                    </a>
                                  ) : (
                                    attachmentReference.label
                                  )}
                                </div>
                                <div className="mt-1 text-xs text-[var(--color-muted)]">
                                  Added {attachmentReference.createdAt}
                                  {attachmentReference.externalId
                                    ? ` · ${attachmentReference.externalId}`
                                    : ""}
                                  {attachmentReference.contentType
                                    ? ` · ${attachmentReference.contentType}`
                                    : ""}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <form
                    action={updateScreeningRequestStatusAction.bind(
                      null,
                      lead.id,
                      screeningRequest.id,
                    )}
                    className="mt-4 grid gap-3 rounded-2xl border border-[var(--color-line)] bg-white p-4 md:grid-cols-2"
                  >
                    <label className="space-y-2">
                      <span className="text-sm font-medium">Update status</span>
                      <select
                        className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                        defaultValue={screeningRequest.currentStatusValue}
                        name="status"
                      >
                        <option value="REQUESTED">Requested</option>
                        <option value="INVITE_SENT">Invite sent</option>
                        <option value="CONSENT_COMPLETED">Consent completed</option>
                        <option value="IN_PROGRESS">In progress</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="REVIEWED">Reviewed</option>
                        <option value="ADVERSE_ACTION_RECORDED">Adverse action recorded</option>
                      </select>
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-medium">Status detail</span>
                      <input
                        className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                        name="detail"
                        placeholder="Provider webhook, manual operator note, or review outcome"
                        type="text"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-medium">Provider reference</span>
                      <input
                        className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                        defaultValue={screeningRequest.providerReference ?? ""}
                        name="providerReference"
                        type="text"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-medium">Report id</span>
                      <input
                        className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                        defaultValue={screeningRequest.providerReportId ?? ""}
                        name="providerReportId"
                        type="text"
                      />
                    </label>
                    <label className="space-y-2 md:col-span-2">
                      <span className="text-sm font-medium">Report url</span>
                      <input
                        className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                        defaultValue={screeningRequest.providerReportUrl ?? ""}
                        name="providerReportUrl"
                        type="url"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-medium">Provider timestamp</span>
                      <input
                        className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                        name="providerTimestamp"
                        type="datetime-local"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-medium">Consent source</span>
                      <input
                        className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                        name="consentSource"
                        placeholder="Provider-hosted authorization"
                        type="text"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-medium">Disclosure version</span>
                      <input
                        className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                        name="disclosureVersion"
                        placeholder="v1"
                        type="text"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-medium">Charge amount</span>
                      <input
                        className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                        defaultValue={screeningRequest.chargeAmountValue}
                        min="0"
                        name="chargeAmount"
                        placeholder="45.00"
                        step="0.01"
                        type="number"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-medium">Charge currency</span>
                      <input
                        className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 uppercase outline-none"
                        defaultValue={screeningRequest.chargeCurrency}
                        maxLength={3}
                        name="chargeCurrency"
                        placeholder="USD"
                        type="text"
                      />
                    </label>
                    <label className="space-y-2 md:col-span-2">
                      <span className="text-sm font-medium">Charge reference</span>
                      <input
                        className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                        defaultValue={screeningRequest.chargeReference ?? ""}
                        name="chargeReference"
                        placeholder="Provider invoice or charge id"
                        type="text"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-medium">Reference label</span>
                      <input
                        className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                        name="attachmentLabel"
                        placeholder="Tenant-safe report reference"
                        type="text"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-medium">Reference external id</span>
                      <input
                        className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                        name="attachmentExternalId"
                        placeholder="doc_123"
                        type="text"
                      />
                    </label>
                    <label className="space-y-2 md:col-span-2">
                      <span className="text-sm font-medium">Reference url</span>
                      <input
                        className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                        name="attachmentUrl"
                        placeholder="https://provider.example/reports/abc"
                        type="url"
                      />
                    </label>
                    <label className="space-y-2 md:col-span-2">
                      <span className="text-sm font-medium">Reference content type</span>
                      <input
                        className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                        name="attachmentContentType"
                        placeholder="application/pdf"
                        type="text"
                      />
                    </label>
                    <label className="space-y-2 md:col-span-2">
                      <span className="text-sm font-medium">Review notes</span>
                      <textarea
                        className="min-h-24 w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                        defaultValue={screeningRequest.reviewNotes ?? ""}
                        name="reviewNotes"
                      />
                    </label>
                    <label className="space-y-2 md:col-span-2">
                      <span className="text-sm font-medium">Adverse action notes</span>
                      <textarea
                        className="min-h-24 w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                        defaultValue={screeningRequest.adverseActionNotes ?? ""}
                        name="adverseActionNotes"
                      />
                    </label>
                    <input type="hidden" name="redirectTo" value={currentDetailHref} />
                    <div className="md:col-span-2 flex justify-end">
                      <button
                        className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={!lead.actions.manageScreening}
                        type="submit"
                      >
                        Save screening update
                      </button>
                    </div>
                  </form>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="space-y-6">
          {lead.hasAiAssist ? (
            <div className={sectionPanelClassName}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold">AI operator assist</div>
                  <p className="mt-2 text-sm text-[var(--color-muted)]">
                    Generate a lead summary, reply draft, missing-info follow-up, conflict explanation, duplicate rationale, and next-best-action recommendation.
                  </p>
                </div>
                <form action={generateLeadInsightsAction.bind(null, lead.id)}>
                  <input type="hidden" name="redirectTo" value={currentDetailHref} />
                  <button
                    className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm font-medium"
                    type="submit"
                  >
                    Generate AI insights
                  </button>
                </form>
              </div>
              {lead.leadInsightsArtifact?.status === "failed" ? (
                <div className="mt-4 rounded-2xl border border-[rgba(184,88,51,0.28)] bg-[rgba(184,88,51,0.08)] px-4 py-4 text-sm text-[var(--color-accent-strong)]">
                  AI generation failed {lead.leadInsightsArtifact.generatedAt}: {lead.leadInsightsArtifact.error}
                </div>
              ) : null}
              {lead.leadInsightsArtifact?.status === "ready" ? (
                <div className="mt-4 space-y-4">
                  <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">
                      Lead summary | {lead.leadInsightsArtifact.generatedAt}
                    </div>
                    <div className="mt-2 text-sm leading-7">
                      {lead.leadInsightsArtifact.data.summary}
                    </div>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-2">
                    <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4">
                      <div className="text-sm font-medium">Next best action</div>
                      <div className="mt-2 text-sm font-medium">
                        {lead.leadInsightsArtifact.data.nextBestAction.label}
                      </div>
                      <div className="mt-2 text-sm text-[var(--color-muted)]">
                        {lead.leadInsightsArtifact.data.nextBestAction.rationale}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4">
                      <div className="text-sm font-medium">Conflict explanation</div>
                      <div className="mt-2 text-sm text-[var(--color-muted)]">
                        {lead.leadInsightsArtifact.data.conflictExplanation}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4">
                      <div className="text-sm font-medium">Duplicate review</div>
                      <div className="mt-2 text-sm text-[var(--color-muted)]">
                        {lead.leadInsightsArtifact.data.duplicateSuggestion.rationale}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4">
                      <div className="text-sm font-medium">Stale lead recommendation</div>
                      <div className="mt-2 text-sm text-[var(--color-muted)]">
                        {lead.leadInsightsArtifact.data.staleLeadRecommendation}
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-2">
                    <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4">
                      <div className="text-sm font-medium">Reply draft</div>
                      {lead.leadInsightsArtifact.data.replyDraft.subject ? (
                        <div className="mt-2 text-sm font-medium">
                          Subject: {lead.leadInsightsArtifact.data.replyDraft.subject}
                        </div>
                      ) : null}
                      <div className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[var(--color-muted)]">
                        {lead.leadInsightsArtifact.data.replyDraft.body}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4">
                      <div className="text-sm font-medium">Missing-info follow-up</div>
                      {lead.leadInsightsArtifact.data.missingInfoFollowUp.subject ? (
                        <div className="mt-2 text-sm font-medium">
                          Subject: {lead.leadInsightsArtifact.data.missingInfoFollowUp.subject}
                        </div>
                      ) : null}
                      <div className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[var(--color-muted)]">
                        {lead.leadInsightsArtifact.data.missingInfoFollowUp.body}
                      </div>
                      {lead.leadInsightsArtifact.data.missingInfoFollowUp.missingItems.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--color-muted)]">
                          {lead.leadInsightsArtifact.data.missingInfoFollowUp.missingItems.map((item) => (
                            <span key={item} className="rounded-full border border-[var(--color-line)] px-3 py-1">
                              {item}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {lead.possibleDuplicateCandidate ? (
            <div className="rounded-[2.1rem] border border-[rgba(184,88,51,0.28)] bg-[rgba(184,88,51,0.08)] p-6 shadow-[0_22px_52px_rgba(44,32,20,0.08)]">
              <div className="text-lg font-semibold">Possible duplicate lead</div>
              <p className="mt-2 text-sm text-[var(--color-muted)]">
                This lead matched an existing record with medium confidence. Confirm if this
                should be treated as a duplicate.
              </p>
              <div className="mt-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4">
                <div className="font-medium">
                  <Link
                    className="underline decoration-[var(--color-line)] underline-offset-4"
                    href={buildLeadDetailHref(
                      lead.possibleDuplicateCandidate.id,
                      currentListParams,
                    )}
                  >
                    {lead.possibleDuplicateCandidate.name}
                  </Link>
                </div>
                <div className="mt-2 text-sm text-[var(--color-muted)]">
                  {lead.possibleDuplicateCandidate.status} |{" "}
                  {lead.possibleDuplicateCandidate.source} |{" "}
                  {lead.possibleDuplicateCandidate.property} |{" "}
                  {lead.possibleDuplicateCandidate.lastActivity}
                </div>
              </div>
              <form
                action={confirmDuplicateLeadAction.bind(null, lead.id)}
                className="mt-4"
              >
                <input
                  type="hidden"
                  name="candidateLeadId"
                  value={lead.possibleDuplicateCandidate.id}
                />
                <input type="hidden" name="redirectTo" value={currentDetailHref} />
                <button
                  className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!lead.actions.confirmDuplicate}
                  type="submit"
                >
                  Confirm duplicate and archive this lead
                </button>
              </form>
            </div>
          ) : null}

          <div className={sectionPanelClassName}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">Missing-info checklist</div>
                <p className="mt-2 max-w-2xl text-sm text-[var(--color-muted)]">
                  Use the current qualification rules to see what is still blocking routing and ask only for the unanswered fields that matter.
                </p>
              </div>
              <div className={getReadinessBadgeClassName(lead.missingInfoChecklist.readiness.tone)}>
                {lead.missingInfoChecklist.readiness.label}
              </div>
            </div>

            <div className="mt-4 rounded-[1.45rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-[var(--color-ink)]">
                    {lead.missingInfoChecklist.totalRequiredCount > 0
                      ? `${lead.missingInfoChecklist.items.filter((item) => item.kind === "required").length} of ${lead.missingInfoChecklist.totalRequiredCount} required answers still missing`
                      : "No required qualification questions are configured for this property yet."}
                  </div>
                  <div className="mt-2 text-sm text-[var(--color-muted)]">
                    {lead.missingInfoChecklist.readiness.detail}
                  </div>
                </div>
                {lead.missingInfoChecklist.mostRecentRequestAt ? (
                  <div className="rounded-full border border-[var(--color-line)] bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                    Last requested {lead.missingInfoChecklist.mostRecentRequestAt}
                  </div>
                ) : null}
              </div>

              {lead.missingInfoChecklist.throttleSummary ? (
                <div className="mt-4 rounded-2xl border border-[rgba(184,88,51,0.2)] bg-[rgba(184,88,51,0.08)] px-4 py-3 text-sm text-[var(--color-accent-strong)]">
                  {lead.missingInfoChecklist.throttleSummary}
                </div>
              ) : null}
              {lead.missingInfoChecklist.mostRecentRequestAt ? (
                <div className="mt-4 rounded-2xl border border-[rgba(21,94,239,0.18)] bg-[rgba(37,99,235,0.08)] px-4 py-3 text-sm text-[rgb(29,78,216)]">
                  Missing-info outreach was last sent {lead.missingInfoChecklist.mostRecentRequestAt}. This lead now sits in {lead.missingInfoChecklist.statusAfterSend} while you wait for the next reply.
                </div>
              ) : null}

              {lead.missingInfoChecklist.items.length > 0 ? (
                <div className="mt-4 space-y-4">
                  {(["required", "optional"] as const).map((itemKind) => {
                    const checklistItems = lead.missingInfoChecklist.items.filter(
                      (item) => item.kind === itemKind,
                    );

                    if (checklistItems.length === 0) {
                      return null;
                    }

                    return (
                      <div key={itemKind}>
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
                          {itemKind === "required" ? "Required blockers" : "Useful optional follow-up"}
                        </div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          {checklistItems.map((item) => (
                            <div
                              key={item.questionId}
                              className="rounded-2xl border border-[rgba(184,88,51,0.14)] bg-white px-4 py-4"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="text-sm font-semibold text-[var(--color-ink)]">
                                  {item.fieldLabel}
                                </div>
                                <div className={`rounded-full px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] ${
                                  item.kind === "required"
                                    ? "border border-[rgba(184,88,51,0.18)] bg-[rgba(184,88,51,0.08)] text-[var(--color-accent-strong)]"
                                    : "border border-[rgba(107,114,128,0.18)] bg-[rgba(148,163,184,0.12)] text-[rgb(71,85,105)]"
                                }`}>
                                  {item.severityLabel}
                                </div>
                              </div>
                              <div className="mt-2 text-sm text-[var(--color-muted)]">{item.label}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-[var(--color-line)] bg-white px-4 py-4 text-sm text-[var(--color-muted)]">
                  All required qualification fields currently have answers. Continue with fit evaluation or move the lead forward.
                </div>
              )}

              <div className="mt-5 flex flex-wrap gap-3">
                {lead.requestInfoActionLabel === "Ask missing questions" ? (
                  lead.askMissingQuestionsAvailability.canOpenComposer ? (
                    <Link
                      className={primaryWorkflowButtonClassName}
                      href={`${askMissingQuestionsHref}#manual-outbound`}
                    >
                      {lead.requestInfoActionLabel}
                    </Link>
                  ) : (
                    <button
                      className={primaryWorkflowButtonClassName}
                      disabled
                      title={lead.askMissingQuestionsAvailability.disabledReason ?? undefined}
                      type="button"
                    >
                      {lead.requestInfoActionLabel}
                    </button>
                  )
                ) : (
                  <form action={requestInfoAction.bind(null, lead.id)}>
                    <input type="hidden" name="redirectTo" value={currentDetailHref} />
                    <button
                      className={primaryWorkflowButtonClassName}
                      disabled={!lead.actions.requestInfo}
                      type="submit"
                    >
                      {lead.requestInfoActionLabel}
                    </button>
                  </form>
                )}
                {canMarkAsUnderReview ? (
                  <form action={overrideLeadRoutingAction.bind(null, lead.id)}>
                    <input type="hidden" name="overrideStatus" value="UNDER_REVIEW" />
                    <input type="hidden" name="overrideFit" value={lead.fitValue} />
                    <input
                      type="hidden"
                      name="overrideReason"
                      value="Moved into review from the missing-info checklist."
                    />
                    <input type="hidden" name="redirectTo" value={currentDetailHref} />
                    <button className={secondaryWorkflowButtonClassName} type="submit">
                      Mark as under review
                    </button>
                  </form>
                ) : null}
                <Link className={secondaryWorkflowButtonClassName} href="#operator-controls">
                  Continue manually
                </Link>
              </div>
            </div>
          </div>

          <div className={sectionPanelClassName} id="operator-controls">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">Operator controls</div>
                <p className="mt-2 max-w-2xl text-sm text-[var(--color-muted)]">
                  Keep routing, outreach, exceptions, and operator-only context together so the top of the page can stay focused on the prospect profile.
                </p>
              </div>
              <div className="rounded-[1.45rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm text-[var(--color-muted)]">
                {lead.schedulingUrl ? (
                  <a
                    className="text-[var(--color-accent-strong)] underline decoration-[var(--color-line)] underline-offset-4"
                    href={lead.schedulingUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Scheduling handoff link
                  </a>
                ) : (
                  "Property scheduling link not configured"
                )}
              </div>
            </div>
            <div className="mt-4 rounded-[1.45rem] border border-[rgba(184,88,51,0.14)] bg-[rgba(255,255,255,0.74)] px-4 py-4 text-sm text-[var(--color-muted)]">
              {lead.notes}
            </div>
            {lead.actions.manualOutbound ? (
              <div className="mt-6 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-4">
                <div className="text-sm font-semibold">Contact preferences</div>
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  Track channel-specific opt-outs and operator overrides directly on the lead.
                </p>
                <div className="mt-3 rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm">
                  {lead.optOutSummary.isOptedOut
                    ? `Latest opt-out: ${lead.optOutSummary.optedOutAt}${
                        lead.optOutSummary.optedOutReason
                          ? ` | ${lead.optOutSummary.optedOutReason}`
                          : ""
                      }`
                    : "No active opt-outs recorded."}
                </div>
                <div className="mt-4 space-y-3">
                  {lead.channelOptOuts.map((channelOptOut) => (
                    <form
                      key={channelOptOut.value}
                      action={updateLeadChannelOptOutAction.bind(null, lead.id)}
                      className="rounded-2xl border border-[var(--color-line)] bg-white px-4 py-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="font-medium">{channelOptOut.label}</div>
                          <div className="mt-1 text-sm text-[var(--color-muted)]">
                            {channelOptOut.isOptedOut
                              ? `Opted out${channelOptOut.optedOutAt ? ` ${channelOptOut.optedOutAt}` : ""}`
                              : "Available for outreach"}
                          </div>
                          {channelOptOut.optedOutReason ? (
                            <div className="mt-2 text-xs text-[var(--color-muted)]">
                              Reason: {channelOptOut.optedOutReason}
                            </div>
                          ) : null}
                        </div>
                        <button
                          className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-2 text-sm font-medium"
                          type="submit"
                        >
                          {channelOptOut.isOptedOut ? "Mark opted in" : "Mark opted out"}
                        </button>
                      </div>
                      <input type="hidden" name="channel" value={channelOptOut.value} />
                      <input
                        type="hidden"
                        name="isOptedOut"
                        value={channelOptOut.isOptedOut ? "false" : "true"}
                      />
                      <input type="hidden" name="redirectTo" value={currentDetailHref} />
                      <label className="mt-3 block space-y-2">
                        <span className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                          {channelOptOut.isOptedOut ? "Optional note" : "Reason"}
                        </span>
                        <input
                          className="w-full rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-3 outline-none"
                          name="reason"
                          placeholder={
                            channelOptOut.isOptedOut
                              ? "Optional opt-in note"
                              : "Optional opt-out reason"
                          }
                          type="text"
                        />
                      </label>
                    </form>
                  ))}
                </div>
              </div>
            ) : null}
            {lead.actions.overrideFit ? (
              <div className="mt-6 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-4 text-sm text-[var(--color-muted)]">
                Status and fit overrides now live in the dedicated routing panel near the top of the page.
                <div className="mt-3">
                  <Link
                    className="font-medium text-[var(--color-accent-strong)] underline decoration-[var(--color-line)] underline-offset-4"
                    href="#routing-controls"
                  >
                    Open routing controls
                  </Link>
                </div>
              </div>
            ) : null}

            {lead.actions.declineLead ? (
              <form
                action={declineLeadAction.bind(null, lead.id)}
                className="mt-4 rounded-2xl border border-[rgba(184,88,51,0.28)] bg-[rgba(184,88,51,0.08)] p-4"
              >
                <div className="text-sm font-semibold">Decline lead</div>
                <label className="mt-3 block space-y-2">
                  <span className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                    Decline reason
                  </span>
                  <select
                    className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                    name="declineReason"
                    required
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Select reason
                    </option>
                    {[
                      "RULE_MISMATCH",
                      "MISSING_INFO",
                      "OPERATOR_DECISION",
                      "NO_AVAILABILITY",
                      "UNRESPONSIVE",
                      "DUPLICATE",
                      "WITHDREW",
                    ].map((declineReasonOption) => (
                      <option key={declineReasonOption} value={declineReasonOption}>
                        {declineReasonOption.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="mt-3 block space-y-2">
                  <span className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                    Note
                  </span>
                  <input
                    className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                    name="declineNote"
                    placeholder="Optional context for the timeline."
                    type="text"
                  />
                </label>
                <input type="hidden" name="redirectTo" value={currentDetailHref} />
                <button
                  className="mt-3 rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white"
                  type="submit"
                >
                  Decline lead
                </button>
              </form>
            ) : null}

            {lead.actions.manualOutbound ? (
              <form
                action={sendManualOutboundMessageAction.bind(null, lead.id)}
                className="mt-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-4"
              >
                <div className="text-sm font-semibold">Internal note</div>
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  Save private operator context directly on the lead thread without sending anything externally.
                </p>
                {lead.availableInternalNoteMentions.length > 0 ? (
                  <p className="mt-2 text-xs text-[var(--color-muted)]">
                    Mention teammates with {lead.availableInternalNoteMentions.map((mention) => `@${mention.canonicalHandle}`).join(", ")}.
                  </p>
                ) : null}
                <input type="hidden" name="manualChannel" value="INTERNAL_NOTE" />
                <input type="hidden" name="redirectTo" value={currentDetailHref} />
                <label className="mt-3 block space-y-2">
                  <span className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                    Note
                  </span>
                  <textarea
                    className="min-h-28 w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                    name="manualBody"
                    placeholder="Capture context, objections, follow-up plans, or team-only guidance. Use @teammate to tag someone."
                    required
                  />
                </label>
                <button
                  className="mt-3 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-3 text-sm font-medium"
                  type="submit"
                >
                  Save note
                </button>
              </form>
            ) : null}

            {lead.actions.manualOutbound ? (
              <form
                action={sendManualOutboundMessageAction.bind(null, lead.id)}
                id="manual-outbound"
                className="mt-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-4"
              >
                <div className="text-sm font-semibold">Manual outbound</div>
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  Operator-initiated messages stay available even when automation is blocked.
                </p>
                {isManualComposerOpen ? (
                  <div className="mt-3 rounded-2xl border border-[rgba(184,88,51,0.18)] bg-[rgba(184,88,51,0.08)] px-4 py-3 text-sm text-[var(--color-accent-strong)]">
                    Compose a direct reply from here without leaving the lead record.
                  </div>
                ) : null}
                {isMissingInfoDraftOpen && lead.askMissingQuestionsDraft ? (
                  <div className="mt-3 rounded-2xl border border-[rgba(21,94,239,0.18)] bg-[rgba(37,99,235,0.08)] px-4 py-3 text-sm text-[rgb(29,78,216)]">
                    Review this missing-info draft before sending. It reflects the current checklist instead of firing the workflow automation immediately.
                  </div>
                ) : null}
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                      Channel
                    </span>
                    <select
                      className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                      name="manualChannel"
                      required
                      defaultValue={
                        isMissingInfoDraftOpen && lead.askMissingQuestionsDraft
                          ? lead.askMissingQuestionsDraft.channel
                          : "EMAIL"
                      }
                    >
                      {lead.manualOutboundChannels.map((manualChannelOption) => (
                        <option
                          key={manualChannelOption.value}
                          value={manualChannelOption.value}
                        >
                          {manualChannelOption.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                      Subject
                    </span>
                    <input
                      className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                      defaultValue={
                        isMissingInfoDraftOpen && lead.askMissingQuestionsDraft
                          ? lead.askMissingQuestionsDraft.subject
                          : ""
                      }
                      name="manualSubject"
                      placeholder="Optional subject"
                      type="text"
                    />
                  </label>
                </div>
                <label className="mt-3 block space-y-2">
                  <span className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                    Message
                  </span>
                  <textarea
                    className="min-h-28 w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                    defaultValue={
                      isMissingInfoDraftOpen && lead.askMissingQuestionsDraft
                        ? lead.askMissingQuestionsDraft.body
                        : ""
                    }
                    name="manualBody"
                    placeholder="Write the manual outbound message."
                    required
                  />
                </label>
                <input type="hidden" name="redirectTo" value={currentDetailHref} />
                {isMissingInfoDraftOpen ? (
                  <input type="hidden" name="manualWorkflowIntent" value="missing-info" />
                ) : null}
                <button
                  className="mt-3 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-3 text-sm font-medium"
                  type="submit"
                >
                  Send manual message
                </button>
              </form>
            ) : null}
          </div>

          {lead.normalizedFieldMetadataRows.length > 0 ? (
            <div className={sectionPanelClassName}>
              <div className="text-lg font-semibold">Extraction confidence</div>
              <p className="mt-2 text-sm text-[var(--color-muted)]">
                Normalized lead fields from inbound parsing with confidence and source.
              </p>
              <div className="mt-4 space-y-3">
                {lead.normalizedFieldMetadataRows.map((fieldRow) => (
                  <div
                    className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium">{fieldRow.label}</div>
                      <div className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">
                        {fieldRow.confidencePercent}% confidence
                      </div>
                    </div>
                    <div className="mt-2 text-sm">{fieldRow.value}</div>
                    {fieldRow.evidenceSnippet ? (
                      <div className="mt-2 rounded-xl border border-[var(--color-line)] bg-white px-3 py-2 text-sm text-[var(--color-muted)]">
                        &quot;{fieldRow.evidenceSnippet}&quot;
                      </div>
                    ) : null}
                    <div className="mt-2 text-xs text-[var(--color-muted)]">
                      source: {fieldRow.source} | updated: {fieldRow.lastUpdatedAt}
                      {fieldRow.sourceMessageReference
                        ? ` | message: ${fieldRow.sourceMessageReference}`
                        : ""}
                      {fieldRow.isSuggested ? " | suggested review" : ""}
                    </div>
                    {lead.hasAiAssist && fieldRow.isSuggested ? (
                      <form
                        action={reviewLeadFieldSuggestionAction.bind(null, lead.id)}
                        className="mt-3 rounded-2xl border border-[var(--color-line)] bg-white p-3"
                      >
                        <div className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">
                          Review suggestion
                        </div>
                        <input type="hidden" name="fieldKey" value={fieldRow.key} />
                        <input type="hidden" name="redirectTo" value={currentDetailHref} />
                        <input
                          className="mt-3 w-full rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-3 outline-none"
                          defaultValue={fieldRow.value}
                          name="editedValue"
                          type="text"
                        />
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-2 text-sm font-medium"
                            name="reviewAction"
                            type="submit"
                            value="accept"
                          >
                            Accept
                          </button>
                          <button
                            className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-2 text-sm font-medium"
                            name="reviewAction"
                            type="submit"
                            value="edit"
                          >
                            Save edit
                          </button>
                          <button
                            className="rounded-2xl border border-[rgba(184,88,51,0.28)] bg-[rgba(184,88,51,0.08)] px-4 py-2 text-sm font-medium"
                            name="reviewAction"
                            type="submit"
                            value="reject"
                          >
                            Reject
                          </button>
                        </div>
                      </form>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {lead.hasAiAssist && lead.latestMessageForTranslation ? (
            <div className={sectionPanelClassName}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold">Translation assist</div>
                  <p className="mt-2 text-sm text-[var(--color-muted)]">
                    Translate the latest inbound or outbound message while preserving the original thread text.
                  </p>
                </div>
                <form
                  action={generateLeadTranslationAction.bind(null, lead.id)}
                  className="flex flex-wrap items-end gap-3"
                >
                  <input type="hidden" name="redirectTo" value={currentDetailHref} />
                  <input type="hidden" name="sourceText" value={lead.latestMessageForTranslation.body} />
                  <input
                    type="hidden"
                    name="sourceSummary"
                    value={lead.latestMessageForTranslation.sourceSummary}
                  />
                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                      Target language
                    </span>
                    <input
                      className="rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                      defaultValue="Spanish"
                      name="targetLanguage"
                      type="text"
                    />
                  </label>
                  <button
                    className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm font-medium"
                    type="submit"
                  >
                    Translate latest message
                  </button>
                </form>
              </div>
              <div className="mt-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4 text-sm leading-7">
                {lead.latestMessageForTranslation.body}
              </div>
              {lead.translationArtifact?.status === "failed" ? (
                <div className="mt-4 rounded-2xl border border-[rgba(184,88,51,0.28)] bg-[rgba(184,88,51,0.08)] px-4 py-4 text-sm text-[var(--color-accent-strong)]">
                  Translation failed {lead.translationArtifact.generatedAt}: {lead.translationArtifact.error}
                </div>
              ) : null}
              {lead.translationArtifact?.status === "ready" ? (
                <div className="mt-4 rounded-2xl border border-[var(--color-line)] bg-white px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">
                    {lead.translationArtifact.data.language} | {lead.translationArtifact.generatedAt}
                  </div>
                  <div className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[var(--color-muted)]">
                    {lead.translationArtifact.data.translatedText}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className={sectionPanelClassName} id="qualification-details">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">Qualification details</div>
                <div className="mt-2 text-sm text-[var(--color-muted)]">
                  The lead facts, rule outcomes, and intake answers that support the current fit judgment.
                </div>
              </div>
              <div className="rounded-full bg-[var(--color-sidebar)] px-3 py-1 text-sm text-white">
                {lead.fit}
              </div>
            </div>
            <p className="mt-4 text-sm leading-7 text-[var(--color-muted)]">
              {lead.evaluationSummary}
            </p>
            <div className="mt-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm">
              Recommended status after evaluation:{" "}
              <span className="font-medium">{lead.recommendedStatus}</span>
            </div>
            <div className="mt-4 space-y-3">
              {lead.evaluationIssues.map((issue) => (
                <div
                  key={`${issue.label}-${issue.detail}`}
                  className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium">{issue.label}</div>
                    <div className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">
                      {issue.severity} | {issue.outcome}
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-[var(--color-muted)]">
                    {issue.detail}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-3">
              {lead.qualificationAnswers.map((answer) => (
                <div
                  key={answer.label}
                  className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3"
                >
                  <div className="text-sm text-[var(--color-muted)]">{answer.label}</div>
                  <div className="mt-1 font-medium">{answer.value}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className={sectionPanelClassName} id="shared-thread">
            <div className="text-lg font-semibold">Shared thread</div>
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              A single chronological thread for messages, notes, status changes, and system events.
            </p>
            <div className="mt-4 space-y-3">
              {lead.sharedThread.map((item: (typeof lead.sharedThread)[number]) => (
                <div key={`${item.kind}-${item.id}`} className="flex gap-4">
                  <div className="w-24 shrink-0 text-sm text-[var(--color-muted)]">
                    {item.at}
                  </div>
                  <div className="flex-1 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">
                      <span>{item.kindLabel}</span>
                      {item.meta ? (
                        <span className="rounded-full border border-[var(--color-line)] px-3 py-1 normal-case tracking-normal">
                          {item.meta}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 font-medium">{item.title}</div>
                    {item.detail ? (
                      <div className="mt-2 text-sm text-[var(--color-muted)]">{item.detail}</div>
                    ) : null}
                    {item.body ? (
                      <div className="mt-3 text-sm leading-7">{item.body}</div>
                    ) : null}
                    {item.error ? (
                      <div className="mt-3 text-xs text-[var(--color-accent-strong)]">
                        Delivery issue: {item.error}
                      </div>
                    ) : null}
                    {item.mentionedTeammates.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--color-muted)]">
                        {item.mentionedTeammates.map((mention) => (
                          <span
                            key={`${item.id}-${mention.userId}`}
                            className="rounded-full border border-[var(--color-line)] px-3 py-1"
                          >
                            @{mention.canonicalHandle} | {mention.name}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function SnapshotFact(params: { label: string; value: string }) {
  return (
    <div className="rounded-[1.35rem] border border-[rgba(184,88,51,0.12)] bg-[rgba(255,255,255,0.74)] px-4 py-3">
      <div className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
        {params.label}
      </div>
      <div className="mt-1.5 text-sm font-medium text-[var(--color-ink)]">{params.value}</div>
    </div>
  );
}

function getPriorityExtractedInfoRows(
  rows: Array<{
    confidencePercent: number;
    isSuggested: boolean;
    key: string;
    label: string;
    source: string;
    value: string;
  }>,
) {
  const preferredOrder = [
    "email",
    "phone",
    "moveInDate",
    "monthlyBudget",
    "stayLengthMonths",
    "smoking",
    "pets",
    "bathroomSharingComfort",
    "parkingNeed",
    "guestExpectations",
    "workScheduleNotes",
  ];
  const orderIndexByKey = new Map(
    preferredOrder.map((key, index) => [key, index]),
  );

  return [...rows]
    .sort((leftRow, rightRow) => {
      const leftOrder = orderIndexByKey.get(leftRow.key) ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = orderIndexByKey.get(rightRow.key) ?? Number.MAX_SAFE_INTEGER;

      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      return leftRow.label.localeCompare(rightRow.label);
    })
    .slice(0, 9);
}

function getReadinessBadgeClassName(tone: "pending" | "review" | "ready") {
  switch (tone) {
    case "ready":
      return "inline-flex items-center rounded-full border border-[rgba(39,110,78,0.24)] bg-[rgb(225,244,233)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[rgb(39,110,78)]";
    case "review":
      return "inline-flex items-center rounded-full border border-[rgba(21,94,239,0.28)] bg-[rgba(37,99,235,0.12)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[rgb(29,78,216)]";
    default:
      return "inline-flex items-center rounded-full border border-[rgba(184,88,51,0.24)] bg-[rgba(184,88,51,0.08)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-accent-strong)]";
  }
}

function getDetailStatusBadgeClassName(statusValue: string) {
  switch (statusValue) {
    case "NEW":
    case "AWAITING_RESPONSE":
    case "INCOMPLETE":
      return "inline-flex items-center rounded-full border border-[rgba(21,94,239,0.34)] bg-[rgba(37,99,235,0.14)] px-3 py-1 text-xs font-semibold text-[rgb(29,78,216)]";
    case "QUALIFIED":
    case "TOUR_SCHEDULED":
    case "APPLICATION_SENT":
      return "inline-flex items-center rounded-full border border-[rgba(22,101,52,0.28)] bg-[rgba(34,197,94,0.14)] px-3 py-1 text-xs font-semibold text-[rgb(21,128,61)]";
    case "UNDER_REVIEW":
    case "CAUTION":
      return "inline-flex items-center rounded-full border border-[rgba(180,83,9,0.3)] bg-[rgba(245,158,11,0.14)] px-3 py-1 text-xs font-semibold text-[rgb(180,83,9)]";
    default:
      return "inline-flex items-center rounded-full border border-[rgba(71,85,105,0.24)] bg-[rgba(148,163,184,0.14)] px-3 py-1 text-xs font-semibold text-[rgb(71,85,105)]";
  }
}

function getDetailFitBadgeClassName(fitValue: string) {
  switch (fitValue) {
    case "PASS":
      return "inline-flex items-center rounded-full border border-[rgba(39,110,78,0.24)] bg-[rgb(225,244,233)] px-3 py-1 text-xs font-semibold text-[rgb(39,110,78)]";
    case "CAUTION":
      return "inline-flex items-center rounded-full border border-[rgba(184,88,51,0.24)] bg-[rgb(248,228,214)] px-3 py-1 text-xs font-semibold text-[var(--color-accent-strong)]";
    case "MISMATCH":
      return "inline-flex items-center rounded-full border border-[rgba(157,60,76,0.22)] bg-[rgb(246,221,227)] px-3 py-1 text-xs font-semibold text-[rgb(157,60,76)]";
    default:
      return "inline-flex items-center rounded-full border border-[rgba(123,112,97,0.18)] bg-[rgb(239,233,225)] px-3 py-1 text-xs font-semibold text-[rgb(107,98,86)]";
  }
}

function getWorkflowStageNodeClassName(
  state: "complete" | "current" | "upcoming",
) {
  switch (state) {
    case "complete":
      return "flex h-12 w-12 items-center justify-center rounded-full border border-[rgba(39,110,78,0.22)] bg-[rgb(225,244,233)] text-sm font-semibold text-[rgb(39,110,78)] shadow-[0_10px_20px_rgba(39,110,78,0.12)]";
    case "current":
      return "flex h-14 w-14 items-center justify-center rounded-full border border-[rgba(184,88,51,0.3)] bg-[linear-gradient(180deg,rgba(204,103,62,0.94),rgba(160,71,37,0.96))] text-sm font-semibold text-white shadow-[0_14px_28px_rgba(141,63,33,0.24)]";
    default:
      return "flex h-12 w-12 items-center justify-center rounded-full border border-[rgba(184,88,51,0.12)] bg-[rgba(255,255,255,0.88)] text-sm font-semibold text-[var(--color-muted)] shadow-[inset_0_1px_0_rgba(255,255,255,0.42)]";
  }
}

function getWorkflowConnectorFillClassName(
  state: "complete" | "current" | "upcoming",
) {
  switch (state) {
    case "complete":
      return "h-full w-full rounded-full bg-[rgb(112,176,142)]";
    case "current":
      return "h-full w-1/2 rounded-full bg-[linear-gradient(90deg,rgb(112,176,142),rgb(204,103,62))]";
    default:
      return "h-full w-0 rounded-full bg-transparent";
  }
}

function getWorkflowChartStatusDescription(statusValue: string) {
  switch (statusValue) {
    case "NEW":
      return "The lead has entered the queue and is ready for first contact or evaluation.";
    case "AWAITING_RESPONSE":
      return "Outreach is active and the team is waiting on the lead to reply.";
    case "INCOMPLETE":
      return "Progress is blocked on missing information before the lead can move forward.";
    case "UNDER_REVIEW":
      return "An operator review is in progress to resolve fit or routing questions.";
    case "CAUTION":
      return "The lead has review flags and needs a manual decision before advancing.";
    case "QUALIFIED":
      return "The lead has cleared qualification and can move into scheduling or application steps.";
    case "TOUR_SCHEDULED":
      return "A tour is scheduled, so the workflow is focused on showing coordination and follow-up.";
    case "APPLICATION_SENT":
      return "The application has been sent and the lead is in the conversion stage.";
    case "DECLINED":
      return "The lead has exited the workflow as declined.";
    case "ARCHIVED":
      return "The lead has been archived and removed from the active workflow.";
    case "CLOSED":
      return "The lead completed the workflow and is now closed.";
    default:
      return "This lead is moving through the standard qualification workflow.";
  }
}

function formatLeadStatusOptionLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function resolveRoutingPanelFitDefault(
  currentFitValue: QualificationFit,
  recommendedStatusValue: LeadStatus,
) {
  if (
    recommendedStatusValue === LeadStatus.QUALIFIED ||
    recommendedStatusValue === LeadStatus.TOUR_SCHEDULED ||
    recommendedStatusValue === LeadStatus.APPLICATION_SENT ||
    recommendedStatusValue === LeadStatus.CLOSED
  ) {
    return QualificationFit.PASS;
  }

  if (recommendedStatusValue === LeadStatus.CAUTION) {
    return QualificationFit.CAUTION;
  }

  return currentFitValue;
}

function getLeadRoutingStatusOptions(currentStatusValue: LeadStatus) {
  const statusOrder: LeadStatus[] = [
    LeadStatus.NEW,
    LeadStatus.AWAITING_RESPONSE,
    LeadStatus.INCOMPLETE,
    LeadStatus.UNDER_REVIEW,
    LeadStatus.CAUTION,
    LeadStatus.QUALIFIED,
    LeadStatus.TOUR_SCHEDULED,
    LeadStatus.APPLICATION_SENT,
    LeadStatus.DECLINED,
    LeadStatus.ARCHIVED,
    LeadStatus.CLOSED,
  ];

  return statusOrder.filter((statusValue) =>
    canTransitionLeadStatus(currentStatusValue, statusValue),
  );
}

function getLeadRoutingQuickActions(params: {
  currentFitValue: QualificationFit;
  currentStatusValue: LeadStatus;
  recommendedStatusValue: LeadStatus;
}) {
  const preferredStatusOrder: LeadStatus[] = [
    params.recommendedStatusValue,
    LeadStatus.UNDER_REVIEW,
    LeadStatus.QUALIFIED,
    LeadStatus.AWAITING_RESPONSE,
    LeadStatus.INCOMPLETE,
    LeadStatus.TOUR_SCHEDULED,
    LeadStatus.APPLICATION_SENT,
    LeadStatus.DECLINED,
    LeadStatus.ARCHIVED,
  ];
  const seenStatuses = new Set<LeadStatus>();

  return preferredStatusOrder
    .filter((statusValue) => {
      if (seenStatuses.has(statusValue)) {
        return false;
      }

      seenStatuses.add(statusValue);
      return canTransitionLeadStatus(params.currentStatusValue, statusValue);
    })
    .slice(0, 4)
    .map((statusValue) => ({
      fitValue:
        statusValue === LeadStatus.QUALIFIED ||
        statusValue === LeadStatus.TOUR_SCHEDULED ||
        statusValue === LeadStatus.APPLICATION_SENT ||
        statusValue === LeadStatus.CLOSED
          ? QualificationFit.PASS
          : statusValue === LeadStatus.CAUTION
            ? QualificationFit.CAUTION
            : params.currentFitValue,
      label:
        statusValue === params.recommendedStatusValue
          ? `Use recommended: ${formatLeadStatusOptionLabel(statusValue)}`
          : `Move to ${formatLeadStatusOptionLabel(statusValue)}`,
      reason: `Moved to ${formatLeadStatusOptionLabel(statusValue)} from the Workflow 7 routing controls.`,
      statusValue,
    }));
}

function getLeadWorkflowChart(statusValue: string, statusLabel: string) {
  const currentStageIndex = Math.max(
    0,
    leadWorkflowStages.findIndex((stage) => stage.statuses.includes(statusValue)),
  );

  return {
    currentStageLabel: leadWorkflowStages[currentStageIndex]?.label ?? "Workflow",
    currentStatusLabel: statusLabel,
    stages: leadWorkflowStages.map((stage, index) => {
      const state =
        index < currentStageIndex
          ? "complete"
          : index === currentStageIndex
            ? "current"
            : "upcoming";

      return {
        connectorState:
          index < currentStageIndex
            ? "complete"
            : index === currentStageIndex
              ? "current"
              : "upcoming",
        displayDescription:
          index === currentStageIndex
            ? getWorkflowChartStatusDescription(statusValue)
            : stage.description,
        key: stage.key,
        label: stage.label,
        state,
      };
    }),
    summary: getWorkflowChartStatusDescription(statusValue),
  };
}

function buildLeadsHref(params: {
  assignment?: string;
  filter: LeadListFilter;
  fit?: string;
  page: number;
  pageSize: number;
  property?: string;
  query: string;
  source?: string;
  status?: string;
  showArchived: boolean;
  sort: LeadListSort;
}) {
  const searchParameters = new URLSearchParams();

  if (params.filter !== "all") {
    searchParameters.set("filter", params.filter);
  }

  if (params.page > 1) {
    searchParameters.set("page", String(params.page));
  }

  if (params.pageSize !== 10) {
    searchParameters.set("pageSize", String(params.pageSize));
  }

  if (params.query.trim().length > 0) {
    searchParameters.set("q", params.query.trim());
  }

  if (params.property) {
    searchParameters.set("property", params.property);
  }

  if (params.status) {
    searchParameters.set("status", params.status);
  }

  if (params.fit) {
    searchParameters.set("fit", params.fit);
  }

  if (params.source) {
    searchParameters.set("source", params.source);
  }

  if (params.assignment) {
    searchParameters.set("assignment", params.assignment);
  }

  if (params.showArchived) {
    searchParameters.set("showArchived", "1");
  }

  if (params.sort !== "last-activity-desc") {
    searchParameters.set("sort", params.sort);
  }

  const queryString = searchParameters.toString();

  return queryString.length > 0 ? `/app/leads?${queryString}` : "/app/leads";
}

function buildLeadDetailHref(
  leadId: string,
  params: {
    assignment?: string;
    compose?: string;
    filter: LeadListFilter;
    fit?: string;
    page: number;
    pageSize: number;
    property?: string;
    query: string;
    source?: string;
    status?: string;
    showArchived: boolean;
    sort: LeadListSort;
  },
) {
  const listHref = buildLeadsHref(params);
  const searchParameters = new URLSearchParams(listHref.split("?")[1] ?? "");

  if (params.compose) {
    searchParameters.set("compose", params.compose);
  }

  const queryString = searchParameters.toString();

  return queryString.length > 0
    ? `/app/leads/${leadId}?${queryString}`
    : `/app/leads/${leadId}`;
}

function isLeadListFilter(value: string | undefined): value is LeadListFilter {
  return leadListFilterValues.includes(value as LeadListFilter);
}

function isLeadListSort(value: string | undefined): value is LeadListSort {
  return leadListSortValues.includes(value as LeadListSort);
}

function normalizeLeadListSort(value: string | undefined): LeadListSort {
  switch (value) {
    case "last-activity":
      return "last-activity-desc";
    default:
      return isLeadListSort(value) ? value : "last-activity-desc";
  }
}

function parseBooleanSearchParam(value: string | undefined) {
  return value === "1" || value === "true";
}

function parsePositiveInteger(value: string | undefined) {
  if (!value) {
    return null;
  }

  const parsedValue = Number.parseInt(value, 10);

  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : null;
}

function normalizeLeadListScopedFilterValue(value: string | undefined) {
  const trimmedValue = value?.trim();

  return trimmedValue ? trimmedValue : undefined;
}

function normalizeLeadListStatusValue(value: string | undefined) {
  return [
    "NEW",
    "AWAITING_RESPONSE",
    "INCOMPLETE",
    "UNDER_REVIEW",
    "QUALIFIED",
    "CAUTION",
    "TOUR_SCHEDULED",
    "APPLICATION_SENT",
    "DECLINED",
    "ARCHIVED",
    "CLOSED",
  ].includes(value ?? "")
    ? value
    : undefined;
}

function normalizeLeadListFitValue(value: string | undefined) {
  return ["UNKNOWN", "PASS", "CAUTION", "MISMATCH"].includes(value ?? "")
    ? value
    : undefined;
}
