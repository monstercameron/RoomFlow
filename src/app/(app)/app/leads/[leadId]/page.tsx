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
    taskSort?: string;
    workflowError?: string;
  }>;
};

type LeadDetailTaskSort = "priority" | "age";

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
  "inline-flex min-h-11 items-center justify-center rounded-2xl border border-[rgba(184,88,51,0.24)] bg-[var(--color-accent)] px-4 py-3 text-sm font-medium !text-white visited:!text-white hover:!text-white shadow-[0_12px_24px_rgba(141,63,33,0.22)] transition-colors duration-150 hover:bg-[var(--color-accent-strong)] disabled:cursor-not-allowed disabled:opacity-50";

const secondaryWorkflowButtonClassName =
  "inline-flex min-h-11 items-center justify-center rounded-2xl border border-[var(--color-line)] bg-[rgba(255,255,255,0.86)] px-4 py-3 text-sm font-medium text-[var(--color-ink)] transition-colors duration-150 hover:border-[rgba(184,88,51,0.2)] hover:bg-[rgba(255,255,255,0.96)] disabled:cursor-not-allowed disabled:opacity-50";

const topActionPanelClassName =
  "rounded-[1.8rem] border border-[rgba(184,88,51,0.18)] bg-[rgba(255,250,245,0.92)] p-3 shadow-[0_16px_34px_rgba(62,43,28,0.06)]";

const topActionSectionClassName =
  "flex h-full flex-col rounded-[1.45rem] border border-[rgba(184,88,51,0.14)] bg-[rgba(255,255,255,0.84)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.42)]";

const topActionEyebrowClassName =
  "text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent-strong)]";

const topActionSecondaryButtonClassName =
  "inline-flex min-h-11 items-center justify-center rounded-2xl border border-[rgba(184,88,51,0.2)] bg-[rgba(249,240,231,0.96)] px-4 py-3 text-sm font-medium text-[var(--color-accent-strong)] shadow-[0_8px_18px_rgba(62,43,28,0.05)] transition-[color,background-color,border-color,box-shadow] duration-150 hover:border-[rgba(184,88,51,0.3)] hover:bg-[rgba(255,247,239,0.98)] hover:text-[rgb(123,54,29)] hover:shadow-[0_14px_28px_rgba(62,43,28,0.08)] disabled:cursor-not-allowed disabled:border-[rgba(184,88,51,0.14)] disabled:bg-[rgba(241,232,222,0.68)] disabled:text-[rgba(113,94,78,0.64)] disabled:shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]";

const leadDetailFocusPanelClassName =
  "rounded-[2rem] border border-[rgba(184,88,51,0.18)] bg-[rgb(245,236,226)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.32),0_14px_32px_rgba(62,43,28,0.06)]";

const leadDetailFocusInsetClassName =
  "rounded-[1.35rem] border border-[rgba(184,88,51,0.14)] bg-[rgba(255,255,255,0.82)] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.38)]";

const operatorWorkspaceCardClassName =
  "rounded-[1.6rem] border border-[rgba(184,88,51,0.18)] bg-[rgb(245,236,226)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.32),0_14px_32px_rgba(62,43,28,0.06)]";

const operatorWorkspaceInputClassName =
  "mt-2 w-full rounded-2xl border border-[rgba(184,88,51,0.2)] bg-[rgba(255,255,255,0.98)] px-4 py-3 text-[var(--color-ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.86),0_8px_18px_rgba(62,43,28,0.05)] outline-none transition-[border-color,box-shadow,background-color] duration-150 focus:border-[rgba(184,88,51,0.34)] focus:bg-white focus:ring-4 focus:ring-[rgba(184,88,51,0.08)]";

const operatorWorkspaceMutedTextClassName =
  "text-[rgba(82,66,52,0.82)]";

const operatorWorkspaceInsetCardClassName =
  "rounded-[1.35rem] border border-[rgba(184,88,51,0.18)] bg-[rgb(252,244,236)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.36)]";

const operatorWorkspaceSecondaryButtonClassName =
  "inline-flex min-h-11 items-center justify-center rounded-2xl border border-[rgba(184,88,51,0.2)] bg-[rgb(249,240,231)] px-4 py-3 text-sm font-medium text-[var(--color-ink)] transition-colors duration-150 hover:border-[rgba(184,88,51,0.3)] hover:bg-[rgb(245,232,219)]";

const taskSoonThresholdMs = 24 * 60 * 60 * 1000;

type LeadDetailTaskListItem = {
  assignedTo: string;
  createdAt: string;
  createdAtInputValue: string;
  description: string | null;
  dueAt: string;
  dueAtInputValue: string;
  id: string;
  isOverdue: boolean;
  statusValue: string;
  title: string;
};

function getTaskPriority(task: LeadDetailTaskListItem, now: number) {
  if (task.isOverdue) {
    return {
      label: "Overdue",
      rank: 0,
      toneClassName:
        "border-[rgba(184,88,51,0.28)] bg-[rgba(184,88,51,0.08)] text-[var(--color-accent-strong)]",
    };
  }

  const dueAtTimestamp = task.dueAtInputValue ? Date.parse(task.dueAtInputValue) : Number.NaN;
  if (!Number.isNaN(dueAtTimestamp)) {
    if (dueAtTimestamp - now <= taskSoonThresholdMs) {
      return {
        label: "Due soon",
        rank: 1,
        toneClassName:
          "border-[rgba(184,88,51,0.22)] bg-[rgba(184,88,51,0.12)] text-[rgb(123,54,29)]",
      };
    }

    return {
      label: "Scheduled",
      rank: 2,
      toneClassName:
        "border-[rgba(142,115,91,0.18)] bg-[rgba(255,255,255,0.7)] text-[var(--color-ink)]",
    };
  }

  return {
    label: "No due date",
    rank: 3,
    toneClassName:
      "border-[rgba(142,115,91,0.14)] bg-[rgba(255,255,255,0.58)] text-[rgba(82,66,52,0.82)]",
  };
}

function compareLeadDetailTasks(
  leftTask: LeadDetailTaskListItem,
  rightTask: LeadDetailTaskListItem,
  now: number,
) {
  const leftPriority = getTaskPriority(leftTask, now);
  const rightPriority = getTaskPriority(rightTask, now);

  if (leftPriority.rank !== rightPriority.rank) {
    return leftPriority.rank - rightPriority.rank;
  }

  const leftDueAt = leftTask.dueAtInputValue ? Date.parse(leftTask.dueAtInputValue) : Number.POSITIVE_INFINITY;
  const rightDueAt = rightTask.dueAtInputValue ? Date.parse(rightTask.dueAtInputValue) : Number.POSITIVE_INFINITY;

  if (leftDueAt !== rightDueAt) {
    return leftDueAt - rightDueAt;
  }

  return leftTask.title.localeCompare(rightTask.title);
}

function compareLeadDetailTaskAge(
  leftTask: LeadDetailTaskListItem,
  rightTask: LeadDetailTaskListItem,
) {
  const leftCreatedAt = leftTask.createdAtInputValue
    ? Date.parse(leftTask.createdAtInputValue)
    : Number.POSITIVE_INFINITY;
  const rightCreatedAt = rightTask.createdAtInputValue
    ? Date.parse(rightTask.createdAtInputValue)
    : Number.POSITIVE_INFINITY;

  if (leftCreatedAt !== rightCreatedAt) {
    return leftCreatedAt - rightCreatedAt;
  }

  return leftTask.title.localeCompare(rightTask.title);
}

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
  const activeTaskSort = normalizeLeadDetailTaskSort(resolvedSearchParams.taskSort);
  const currentDetailParams = {
    ...currentListParams,
    taskSort: activeTaskSort,
  };
  const currentListHref = buildLeadsHref(currentListParams);
  const currentDetailHref = buildLeadDetailHref(lead.id, currentDetailParams);
  const assignmentPanelHref = `${currentDetailHref}#assignment-panel`;
  const propertyPanelHref = `${currentDetailHref}#property-panel`;
  const addTaskPanelHref = `${currentDetailHref}#add-task-panel`;
  const openTasksPanelHref = `${currentDetailHref}#open-tasks-panel`;
  const messageLeadHref = buildLeadDetailHref(lead.id, {
    ...currentDetailParams,
    compose: "manual",
  });
  const askMissingQuestionsHref = buildLeadDetailHref(lead.id, {
    ...currentDetailParams,
    compose: "missing-info",
  });
  const taskPriorityNow = Date.now();
  const prioritizedTasks =
    activeTaskSort === "age"
      ? [...lead.tasks].sort(compareLeadDetailTaskAge)
      : [...lead.tasks].sort((leftTask, rightTask) =>
          compareLeadDetailTasks(leftTask, rightTask, taskPriorityNow),
        );
  const overdueTaskCount = prioritizedTasks.filter((task) => task.isOverdue).length;
  const dueSoonTaskCount = prioritizedTasks.filter((task) => {
    if (task.isOverdue || !task.dueAtInputValue) {
      return false;
    }

    const dueAtTimestamp = Date.parse(task.dueAtInputValue);
    return !Number.isNaN(dueAtTimestamp) && dueAtTimestamp - taskPriorityNow <= taskSoonThresholdMs;
  }).length;
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
  const automationSharedReasons =
    lead.automationSuppressionSummaries.length > 1
      ? lead.automationSuppressionSummaries[0]?.reasons.filter((reason) =>
          lead.automationSuppressionSummaries.every((summary) =>
            summary.reasons.includes(reason),
          ),
        ) ?? []
      : [];
  const automationActionSpecificSummaries =
    lead.automationSuppressionSummaries.map((summary) => ({
      ...summary,
      specificReasons: summary.reasons.filter(
        (reason) => !automationSharedReasons.includes(reason),
      ),
    }));

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
        description={`${lead.property} | Assigned to ${lead.leadOwner.assignedTo} | ${lead.contactMethod}`}
        actions={
          <div className="flex max-w-[58rem] flex-col gap-3 md:items-end">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Link className={navigationActionClassName} href={currentListHref}>
                <span aria-hidden="true">&larr;</span>
                Back to leads
              </Link>
              {leadNavigation.previousLead ? (
                <Link
                  className={navigationActionClassName}
                  href={buildLeadDetailHref(leadNavigation.previousLead.id, currentDetailParams)}
                  title={leadNavigation.previousLead.fullName}
                >
                  <span aria-hidden="true">&larr;</span>
                  Previous lead
                </Link>
              ) : (
                <span aria-disabled="true" className={navigationActionDisabledClassName}>
                  <span aria-hidden="true">&larr;</span>
                  Previous lead
                </span>
              )}
              {leadNavigation.nextLead ? (
                <Link
                  className={navigationActionClassName}
                  href={buildLeadDetailHref(leadNavigation.nextLead.id, currentDetailParams)}
                  title={leadNavigation.nextLead.fullName}
                >
                  Next lead
                  <span aria-hidden="true">&rarr;</span>
                </Link>
              ) : (
                <span aria-disabled="true" className={navigationActionDisabledClassName}>
                  Next lead
                  <span aria-hidden="true">&rarr;</span>
                </span>
              )}
            </div>

            <div className={topActionPanelClassName}>
              <div className="grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.95fr)]">
                <div className={topActionSectionClassName}>
                  <div className={topActionEyebrowClassName}>
                    Prospect-facing
                  </div>
                  <div className="mt-2 text-sm font-semibold text-[var(--color-ink)]">
                    Keep the active conversation close to the lead record.
                  </div>
                  <div className="mt-1 text-sm text-[var(--color-muted)]">
                    Start with direct outreach, then use the thread for context and history.
                  </div>
                  <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
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
                          className={topActionSecondaryButtonClassName}
                          href={`${askMissingQuestionsHref}#manual-outbound`}
                        >
                          Ask missing questions
                        </Link>
                      ) : (
                        <button
                          className={topActionSecondaryButtonClassName}
                          disabled
                          title={lead.askMissingQuestionsAvailability.disabledReason ?? undefined}
                          type="button"
                        >
                          Ask missing questions
                        </button>
                      )
                    ) : lead.actions.requestInfo ? (
                      <form action={requestInfoAction.bind(null, lead.id)}>
                        <input type="hidden" name="redirectTo" value={currentDetailHref} />
                        <button className={topActionSecondaryButtonClassName} type="submit">
                          Request info
                        </button>
                      </form>
                    ) : null}
                    <Link
                      className={topActionSecondaryButtonClassName}
                      href="#shared-thread"
                    >
                      Open thread
                    </Link>
                  </div>
                </div>

                <div className={topActionSectionClassName}>
                  <div className={topActionEyebrowClassName}>
                    Internal ops
                  </div>
                  <div className="mt-2 text-sm font-semibold text-[var(--color-ink)]">
                    Keep assignment and routing decisions one click away.
                  </div>
                  <div className="mt-1 text-sm text-[var(--color-muted)]">
                    High-touch operational controls stay near the top; lower-frequency tools remain below.
                  </div>
                  <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
                    {lead.actions.overrideFit ? (
                      <Link
                        className={topActionSecondaryButtonClassName}
                        href="#routing-controls"
                      >
                        Qualify / Move status
                      </Link>
                    ) : null}
                    {canReassignProperty ? (
                      <Link
                        className={topActionSecondaryButtonClassName}
                        href="#property-panel"
                      >
                        Reassign property
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
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
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(340px,0.92fr)]">
          <div className="grid gap-5">
            <div className={leadDetailFocusPanelClassName}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className={topActionEyebrowClassName}>
                    At a glance
                  </div>
                  <div className="mt-2 text-sm text-[var(--color-muted)]">
                    The main facts you need before you decide what to do next.
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className={getDetailStatusBadgeClassName(lead.statusValue)}>{lead.status}</span>
                    <span className={getDetailFitBadgeClassName(lead.fitValue)}>{lead.fit}</span>
                    <span className="inline-flex items-center px-1 py-1 text-xs font-medium text-[var(--color-muted)]">
                      {lead.source}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className={metadataTileClassName}>
                      <div className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
                        Owner
                      </div>
                      <div className="mt-2 text-sm font-medium">{lead.leadOwner.assignedTo}</div>
                    </div>
                    <div className={metadataTileClassName}>
                      <div className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
                        Contact
                      </div>
                      <div className="mt-2 text-sm font-medium">{lead.contactMethod}</div>
                    </div>
                    <div className={metadataTileClassName}>
                      <div className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
                        Last activity
                      </div>
                      <div className="mt-2 text-sm font-medium">{lead.lastActivity}</div>
                    </div>
                    <div className={metadataTileClassName}>
                      <div className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
                        Property
                      </div>
                      <div className="mt-2 text-sm font-medium">{lead.property}</div>
                    </div>
                  </div>
                </div>
                <div className={`${leadDetailFocusInsetClassName} text-left lg:max-w-[18rem]`}>
                  <div className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">
                    Ready check
                  </div>
                  <div className="mt-2 text-sm font-medium text-[var(--color-ink)]">
                    Status, fit, and contact are visible first so the next action is easy to choose.
                  </div>
                </div>
              </div>
              <div className="mt-5 grid justify-items-start gap-3 sm:grid-cols-2">
                <div className={metadataTileClassName}>
                  <div className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">Email</div>
                  <div className="mt-2 break-all text-sm font-medium">{lead.email}</div>
                </div>
                <div className={metadataTileClassName}>
                  <div className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">Phone</div>
                  <div className="mt-2 text-sm font-medium">{lead.phone}</div>
                </div>
              </div>
            </div>

            <div className={leadDetailFocusPanelClassName}>
              <div className={topActionEyebrowClassName}>Key details</div>
              <div className="mt-2 text-lg font-semibold text-[var(--color-ink)]">Review fit, timing, and operating context.</div>
              <div className="mt-2 text-sm text-[var(--color-muted)]">
                The details that shape fit, timing, and follow-up.
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <SnapshotFact label="Move-in" value={lead.moveInDate} />
                <SnapshotFact label="Budget" value={lead.budget} />
                <SnapshotFact label="Stay length" value={lead.stayLength} />
                <SnapshotFact label="Work" value={lead.workStatus} />
              </div>
              <div className={`mt-4 ${leadDetailFocusInsetClassName} text-sm text-[var(--color-muted)]`}>
                <div className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
                  Notes
                </div>
                <div className="mt-2">
                {lead.notes}
                </div>
              </div>
            </div>

            {extractedInfoRows.length > 0 ? (
              <div className={insetPanelClassName}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">Extracted lead info</div>
                    <div className="mt-2 text-sm text-[var(--color-muted)]">
                      The normalized fields currently driving qualification and follow-up decisions.
                    </div>
                  </div>
                  <Link
                    className={topActionSecondaryButtonClassName}
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
            <div className={leadDetailFocusPanelClassName}>
              <div className={topActionEyebrowClassName}>
                Next step
              </div>
              <div className="mt-2 text-lg font-semibold leading-tight">
                Do the next useful thing for this lead.
              </div>
              <div className="mt-2 text-sm text-[var(--color-muted)]">
                Start with fit or missing info, then move to scheduling or application when the lead is ready.
              </div>
              <div className="mt-4 space-y-3">
                {lead.slaSummary ? (
                  <div className={`${leadDetailFocusInsetClassName} py-3 text-sm text-[var(--color-muted)]`}>
                    <span className="font-medium text-[var(--color-ink)]">{lead.slaSummary.label}</span> due {lead.slaSummary.dueAtRelative}
                  </div>
                ) : null}
                {lead.possibleDuplicateCandidate ? (
                  <div className="rounded-[1.35rem] border border-[rgba(184,88,51,0.18)] bg-[rgba(184,88,51,0.08)] px-4 py-3 text-sm text-[var(--color-accent-strong)]">
                    Possible duplicate found with {lead.possibleDuplicateCandidate.name}.
                  </div>
                ) : null}
                {lead.optOutSummary.isOptedOut ? (
                  <div className={`${leadDetailFocusInsetClassName} py-3 text-sm text-[var(--color-muted)]`}>
                    Latest opt-out {lead.optOutSummary.optedOutAt}
                    {lead.optOutSummary.optedOutReason ? ` | ${lead.optOutSummary.optedOutReason}` : ""}
                  </div>
                ) : null}
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
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
                      className={topActionSecondaryButtonClassName}
                      href={`${askMissingQuestionsHref}#manual-outbound`}
                    >
                      {lead.requestInfoActionLabel}
                    </Link>
                  ) : (
                    <button
                      className={topActionSecondaryButtonClassName}
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
                      className={topActionSecondaryButtonClassName}
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
                    className={topActionSecondaryButtonClassName}
                    disabled={!lead.actions.scheduleTour}
                    type="submit"
                  >
                    Send scheduling handoff
                  </button>
                </form>
                <form action={sendApplicationAction.bind(null, lead.id)}>
                  <input type="hidden" name="redirectTo" value={currentDetailHref} />
                  <button
                    className={topActionSecondaryButtonClassName}
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
                    className={topActionSecondaryButtonClassName}
                    type="submit"
                  >
                    {lead.actions.unarchiveLead ? "Unarchive lead" : "Archive lead"}
                  </button>
                </form>
              ) : null}
            </div>

            {lead.actions.overrideFit ? (
              <div
                className={leadDetailFocusPanelClassName}
                id="routing-controls"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className={topActionEyebrowClassName}>
                      Move lead
                    </div>
                    <div className="mt-2 text-lg font-semibold leading-tight">
                      Update status and fit without dropping into the full operator stack.
                    </div>
                    <div className="mt-2 text-sm text-[var(--color-muted)]">
                      Use a fast move when the next step is obvious. Use the form when you need more control.
                    </div>
                  </div>
                  <div className={`${operatorWorkspaceInsetCardClassName} py-3 text-sm text-[var(--color-muted)]`}>
                    Recommended: <span className="font-semibold text-[var(--color-ink)]">{lead.recommendedStatus}</span>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className={operatorWorkspaceInsetCardClassName}>
                    <div className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">Current</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className={getDetailStatusBadgeClassName(lead.statusValue)}>{lead.status}</span>
                      <span className={getDetailFitBadgeClassName(lead.fitValue)}>{lead.fit}</span>
                    </div>
                  </div>
                  <div className={`${operatorWorkspaceInsetCardClassName} text-sm text-[var(--color-muted)]`}>
                    {routingStatusOptions.length > 1
                      ? `${routingStatusOptions.length - 1} valid manual status transition${routingStatusOptions.length === 2 ? "" : "s"} from here.`
                      : "No forward moves are available from this status."}
                  </div>
                </div>

                {routingQuickActions.length > 0 ? (
                  <div className="mt-4">
                    <div className="text-sm font-semibold">Fast moves</div>
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
                          <button className={topActionSecondaryButtonClassName} type="submit">
                            {quickAction.label}
                          </button>
                        </form>
                      ))}
                    </div>
                  </div>
                ) : null}

                <form
                  action={overrideLeadRoutingAction.bind(null, lead.id)}
                  className={`mt-5 ${operatorWorkspaceInsetCardClassName}`}
                >
                  <div className="text-sm font-semibold">More options</div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                        Status
                      </span>
                      <select
                        className="w-full rounded-2xl border border-[rgba(184,88,51,0.2)] bg-[rgba(255,255,255,0.98)] px-4 py-3 text-[var(--color-ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.86),0_8px_18px_rgba(62,43,28,0.05)] outline-none transition-[border-color,box-shadow,background-color] duration-150 focus:border-[rgba(184,88,51,0.34)] focus:bg-white focus:ring-4 focus:ring-[rgba(184,88,51,0.08)]"
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
                        className="w-full rounded-2xl border border-[rgba(184,88,51,0.2)] bg-[rgba(255,255,255,0.98)] px-4 py-3 text-[var(--color-ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.86),0_8px_18px_rgba(62,43,28,0.05)] outline-none transition-[border-color,box-shadow,background-color] duration-150 focus:border-[rgba(184,88,51,0.34)] focus:bg-white focus:ring-4 focus:ring-[rgba(184,88,51,0.08)]"
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
                      className="w-full rounded-2xl border border-[rgba(184,88,51,0.2)] bg-[rgba(255,255,255,0.98)] px-4 py-3 text-[var(--color-ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.86),0_8px_18px_rgba(62,43,28,0.05)] outline-none transition-[border-color,box-shadow,background-color] duration-150 focus:border-[rgba(184,88,51,0.34)] focus:bg-white focus:ring-4 focus:ring-[rgba(184,88,51,0.08)]"
                      defaultValue="Routed from the Workflow 7 status controls."
                      name="overrideReason"
                      required
                      type="text"
                    />
                  </label>
                  <input type="hidden" name="redirectTo" value={currentDetailHref} />
                  <button className={`${primaryWorkflowButtonClassName} mt-3`} type="submit">
                    Save routing update
                  </button>
                </form>
              </div>
            ) : null}
          </div>
        </div>
      </section>
      <section className={majorPanelClassName}>
        <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="md:col-span-2 xl:col-span-2">
            <div>
              <div className="text-lg font-semibold">Owner and property</div>
              <div className={`mt-2 text-sm ${operatorWorkspaceMutedTextClassName}`}>
                Keep the right person and property tied to the lead before you hand off work.
              </div>
              {lead.slaSummary ? (
                <div className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-medium ${lead.slaSummary.isOverdue ? "border-[rgba(184,88,51,0.28)] bg-[rgba(184,88,51,0.08)] text-[var(--color-accent-strong)]" : "border-[var(--color-line)] bg-[var(--color-panel-strong)] text-[var(--color-muted)]"}`}>
                  Review due {lead.slaSummary.dueAtRelative}
                </div>
              ) : null}
            </div>
          </div>
          <div className="md:col-span-2 xl:col-span-2">
            <div>
              <div className="text-lg font-semibold">Tasks</div>
              <div className={`mt-2 text-sm ${operatorWorkspaceMutedTextClassName}`}>
                Add the next piece of work and keep current follow-ups easy to update.
              </div>
            </div>
          </div>

          <div className={`${operatorWorkspaceCardClassName} h-fit`} id="assignment-panel">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium">Lead owner</div>
                <div className={`mt-1 text-sm ${operatorWorkspaceMutedTextClassName}`}>
                  Current owner: {lead.leadOwner.assignedTo}
                </div>
              </div>
            </div>
            <form action={assignLeadOwnerAction.bind(null, lead.id)} className="mt-4">
              <label className={`block space-y-2 text-sm ${operatorWorkspaceMutedTextClassName}`}>
                <span>Assign to</span>
                <select
                  className={operatorWorkspaceInputClassName}
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
              </label>
              <input type="hidden" name="redirectTo" value={assignmentPanelHref} />
              <button
                className={`${primaryWorkflowButtonClassName} mt-4`}
                disabled={!lead.actions.assignProperty}
                type="submit"
              >
                Update owner
              </button>
            </form>
          </div>

          {canReassignProperty ? (
            <div className={`${operatorWorkspaceCardClassName} h-fit`} id="property-panel">
              <div>
                <div className="text-sm font-medium">
                  {lead.property === "Unassigned" ? "Property" : "Assigned property"}
                </div>
                <div className={`mt-1 text-sm ${operatorWorkspaceMutedTextClassName}`}>
                  Current property: {lead.property}
                </div>
              </div>
              <form action={assignLeadPropertyAction.bind(null, lead.id)} className="mt-4">
                <label className={`block space-y-2 text-sm ${operatorWorkspaceMutedTextClassName}`}>
                  <span>{lead.property === "Unassigned" ? "Choose property" : "Move to"}</span>
                  <select
                    className={operatorWorkspaceInputClassName}
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
                </label>
                <input type="hidden" name="redirectTo" value={propertyPanelHref} />
                <button className={`${primaryWorkflowButtonClassName} mt-4`} type="submit">
                  {lead.property === "Unassigned" ? "Assign property" : "Update property"}
                </button>
              </form>
            </div>
          ) : (
            <div className={`${operatorWorkspaceCardClassName} h-fit`} id="property-panel">
              <div className="text-sm font-medium">Assigned property</div>
              <div className={`mt-1 text-sm ${operatorWorkspaceMutedTextClassName}`}>
                Current property: {lead.property}
              </div>
            </div>
          )}

          <form
            action={createTaskAction}
            className={`${operatorWorkspaceCardClassName} flex h-[34rem] min-h-0 flex-col`}
            id="add-task-panel"
          >
            <div className="text-sm font-medium">Add task</div>
            <div className="flex-1">
              <label className={`mt-3 block text-sm ${operatorWorkspaceMutedTextClassName}`}>
                Title
                <input
                  className={operatorWorkspaceInputClassName}
                  name="title"
                  placeholder="Review duplicate risk before next reply"
                  required
                  type="text"
                />
              </label>
              <label className={`mt-3 block text-sm ${operatorWorkspaceMutedTextClassName}`}>
                Details
                <textarea
                  className={`${operatorWorkspaceInputClassName} min-h-24`}
                  name="description"
                  placeholder="Optional extra context for the teammate handling it."
                />
              </label>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <label className={`block text-sm ${operatorWorkspaceMutedTextClassName}`}>
                  Due
                  <input
                    className={operatorWorkspaceInputClassName}
                    name="dueAt"
                    type="datetime-local"
                  />
                </label>
                <label className={`block text-sm ${operatorWorkspaceMutedTextClassName}`}>
                  Assign to
                  <select
                    className={operatorWorkspaceInputClassName}
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
              </div>
            </div>
            <input type="hidden" name="leadId" value={lead.id} />
            <input type="hidden" name="redirectTo" value={addTaskPanelHref} />
            <button className={`${primaryWorkflowButtonClassName} mt-4 self-start`} type="submit">
              Create task
            </button>
          </form>

          <div
            className={`${operatorWorkspaceCardClassName} flex h-[34rem] min-h-0 flex-col overflow-hidden`}
            id="open-tasks-panel"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">Open tasks</div>
                <div className={`mt-1 text-sm ${operatorWorkspaceMutedTextClassName}`}>
                  {activeTaskSort === "age"
                    ? "Oldest tasks stay at the top."
                    : "Time-sensitive work stays at the top."}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap rounded-full border border-[rgba(184,88,51,0.18)] bg-[rgba(255,255,255,0.54)] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.34)]">
                  {([
                    {
                      href: buildLeadDetailHref(lead.id, {
                        ...currentDetailParams,
                        taskSort: "priority",
                      }),
                      label: "Priority first",
                      value: "priority",
                    },
                    {
                      href: buildLeadDetailHref(lead.id, {
                        ...currentDetailParams,
                        taskSort: "age",
                      }),
                      label: "Oldest first",
                      value: "age",
                    },
                  ] as const).map((taskSortOption) => (
                    <Link
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-150 ${
                        activeTaskSort === taskSortOption.value
                          ? "bg-[var(--color-accent)] !text-white visited:!text-white hover:!text-white shadow-[0_8px_18px_rgba(141,63,33,0.18)]"
                          : "text-[var(--color-accent-strong)] hover:bg-[rgba(249,240,231,0.92)] hover:text-[var(--color-accent-strong)]"
                      }`}
                      href={`${taskSortOption.href}#open-tasks-panel`}
                      key={taskSortOption.value}
                    >
                      {taskSortOption.label}
                    </Link>
                  ))}
                </div>
                {overdueTaskCount > 0 ? (
                  <div className="rounded-full border border-[rgba(184,88,51,0.28)] bg-[rgba(184,88,51,0.08)] px-3 py-1 text-xs font-medium text-[var(--color-accent-strong)]">
                    {overdueTaskCount} overdue
                  </div>
                ) : null}
                {dueSoonTaskCount > 0 ? (
                  <div className="rounded-full border border-[rgba(184,88,51,0.22)] bg-[rgba(184,88,51,0.12)] px-3 py-1 text-xs font-medium text-[rgb(123,54,29)]">
                    {dueSoonTaskCount} due soon
                  </div>
                ) : null}
                <div className={`${operatorWorkspaceInsetCardClassName} px-3 py-1 text-xs font-medium ${operatorWorkspaceMutedTextClassName}`}>
                  {prioritizedTasks.length} open
                </div>
              </div>
            </div>
            {prioritizedTasks.length === 0 ? (
              <div className={`mt-4 ${operatorWorkspaceInsetCardClassName} text-sm ${operatorWorkspaceMutedTextClassName}`}>
                No tasks yet. Add one when the next step should stay with the team.
              </div>
            ) : (
              <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                {prioritizedTasks.map((task) => {
                  const taskPriority = getTaskPriority(task, taskPriorityNow);

                  return (
                  <form
                    action={updateTaskStatusAction.bind(null, task.id)}
                    className={operatorWorkspaceInsetCardClassName}
                    key={task.id}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{task.title}</div>
                        <div className={`mt-1 text-sm ${operatorWorkspaceMutedTextClassName}`}>
                          {task.assignedTo} {task.dueAt !== "Not set" ? `| due ${task.dueAt}` : "| no due date"}
                        </div>
                        {task.description ? (
                          <div className={`mt-2 text-sm ${operatorWorkspaceMutedTextClassName}`}>
                            {task.description}
                          </div>
                        ) : null}
                      </div>
                      <div className={`rounded-full border px-3 py-1 text-xs font-medium ${taskPriority.toneClassName}`}>
                        {taskPriority.label}
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-end gap-3">
                      <label className="space-y-2 text-sm font-medium">
                        <span>Status</span>
                        <select
                          className={operatorWorkspaceInputClassName}
                          defaultValue={task.statusValue}
                          name="status"
                        >
                          <option value="OPEN">Open</option>
                          <option value="IN_PROGRESS">In Progress</option>
                          <option value="COMPLETED">Completed</option>
                          <option value="CANCELED">Canceled</option>
                        </select>
                      </label>
                      <input type="hidden" name="redirectTo" value={openTasksPanelHref} />
                      <button className={primaryWorkflowButtonClassName} type="submit">
                        Update status
                      </button>
                    </div>
                  </form>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>
      {lead.automationSuppressionSummaries.length > 0 ? (
        <div className={`${sectionPanelClassName} mb-5`}>
          <div className="text-sm font-semibold">Automation suppression reasons</div>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Manual outbound remains available. This panel explains what is blocking automated request info, scheduling, and application sends right now.
          </p>
          {automationSharedReasons.length > 0 ? (
            <div className={`${operatorWorkspaceInsetCardClassName} mt-4`}>
              <div className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
                Shared blockers across all automated actions
              </div>
              <div className="mt-3 space-y-2 text-sm text-[var(--color-muted)]">
                {automationSharedReasons.map((reason) => (
                  <div key={`automation-shared-${reason}`}>{reason}</div>
                ))}
              </div>
            </div>
          ) : null}
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {automationActionSpecificSummaries.map((summary) => (
              <div
                key={summary.actionKey}
                className={operatorWorkspaceInsetCardClassName}
              >
                <div className="text-sm font-medium text-[var(--color-ink)]">
                  {summary.actionLabel}
                </div>
                <div className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">
                  {summary.specificReasons.length > 0
                    ? "Action-specific blockers"
                    : automationSharedReasons.length > 0
                      ? "No extra blockers"
                      : "Current blockers"}
                </div>
                <div className="mt-3 space-y-2 text-sm text-[var(--color-muted)]">
                  {summary.specificReasons.length > 0
                    ? summary.specificReasons.map((reason) => (
                        <div key={`${summary.actionKey}-${reason}`}>{reason}</div>
                      ))
                    : automationSharedReasons.length > 0
                      ? (
                        <div>Only the shared blockers above are preventing this action.</div>
                      )
                      : summary.reasons.map((reason) => (
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
                        Requested {screeningRequest.requestedAt} | Invite {screeningRequest.invitedAt}
                      </div>
                      <div className="mt-2 text-sm text-[var(--color-muted)]">
                        Current status: {screeningRequest.currentStatus} | Charge mode: {screeningRequest.chargeMode}
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
                            {statusEvent.status} | {statusEvent.at}
                            {statusEvent.detail ? ` | ${statusEvent.detail}` : ""}
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
                                {consentRecord.source ? ` | ${consentRecord.source}` : ""}
                                {consentRecord.disclosureVersion
                                  ? ` | ${consentRecord.disclosureVersion}`
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
                                    ? ` | ${attachmentReference.externalId}`
                                    : ""}
                                  {attachmentReference.contentType
                                    ? ` | ${attachmentReference.contentType}`
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
    <div className={`${leadDetailFocusInsetClassName} py-3`}>
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
      return "inline-flex items-center rounded-full border border-[rgba(21,94,239,0.38)] bg-[rgba(37,99,235,0.18)] px-3 py-1 text-xs font-semibold text-[rgb(29,78,216)]";
    case "QUALIFIED":
    case "TOUR_SCHEDULED":
    case "APPLICATION_SENT":
      return "inline-flex items-center rounded-full border border-[rgba(22,101,52,0.34)] bg-[rgba(34,197,94,0.18)] px-3 py-1 text-xs font-semibold text-[rgb(21,128,61)]";
    case "UNDER_REVIEW":
    case "CAUTION":
      return "inline-flex items-center rounded-full border border-[rgba(180,83,9,0.34)] bg-[rgba(245,158,11,0.18)] px-3 py-1 text-xs font-semibold text-[rgb(180,83,9)]";
    case "DECLINED":
    case "ARCHIVED":
    case "CLOSED":
      return "inline-flex items-center rounded-full border border-[rgba(71,85,105,0.28)] bg-[rgba(148,163,184,0.18)] px-3 py-1 text-xs font-semibold text-[rgb(71,85,105)]";
    default:
      return "inline-flex items-center rounded-full border border-[rgba(71,85,105,0.22)] bg-[rgba(241,245,249,0.9)] px-3 py-1 text-xs font-semibold text-[rgb(71,85,105)]";
  }
}

function getDetailFitBadgeClassName(fitValue: string) {
  switch (fitValue) {
    case "PASS":
      return "inline-flex items-center rounded-full border border-[rgba(39,110,78,0.24)] bg-[rgb(225,244,233)] px-3 py-1 text-xs font-semibold text-[rgb(39,110,78)] shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]";
    case "CAUTION":
      return "inline-flex items-center rounded-full border border-[rgba(184,88,51,0.26)] bg-[rgb(248,228,214)] px-3 py-1 text-xs font-semibold text-[var(--color-accent-strong)] shadow-[inset_0_1px_0_rgba(255,255,255,0.42)]";
    case "MISMATCH":
      return "inline-flex items-center rounded-full border border-[rgba(157,60,76,0.22)] bg-[rgb(246,221,227)] px-3 py-1 text-xs font-semibold text-[rgb(157,60,76)] shadow-[inset_0_1px_0_rgba(255,255,255,0.42)]";
    default:
      return "inline-flex items-center rounded-full border border-[rgba(123,112,97,0.18)] bg-[rgb(239,233,225)] px-3 py-1 text-xs font-semibold text-[rgb(107,98,86)] shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]";
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
    taskSort?: LeadDetailTaskSort;
  },
) {
  const listHref = buildLeadsHref(params);
  const searchParameters = new URLSearchParams(listHref.split("?")[1] ?? "");

  if (params.compose) {
    searchParameters.set("compose", params.compose);
  }

  if (params.taskSort && params.taskSort !== "priority") {
    searchParameters.set("taskSort", params.taskSort);
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

function normalizeLeadDetailTaskSort(value: string | undefined): LeadDetailTaskSort {
  return value === "age" ? "age" : "priority";
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
