import { headers } from "next/headers";
import Link from "next/link";
import { LeadAssigneeQuickSelect } from "@/components/lead-assignee-quick-select";
import { LeadsFilterTabs } from "@/components/leads-filter-tabs";
import { LeadsPaginationShell } from "@/components/leads-pagination-shell";
import { LeadsSortLink } from "@/components/leads-sort-link";
import { PageHeader } from "@/components/page-header";
import { assignLeadOwnerAction } from "@/lib/collaboration-actions";
import {
  getIntlLocaleForLeadsPageLocale,
  getLeadsPageCopy,
  resolveLeadsPageLocale,
  type LeadsPageCopy,
} from "@/lib/leads-page-i18n";
import { archiveLeadAction, unarchiveLeadAction } from "@/lib/lead-actions";
import {
  getLeadListViewData,
  type LeadListFilter,
  type LeadListSort,
} from "@/lib/app-data";

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

function getLeadListFilters(copy: LeadsPageCopy): Array<{
  description: string;
  label: string;
  value: LeadListFilter;
}> {
  return [
    {
      description: copy.filters.all.description,
      label: copy.filters.all.label,
      value: "all",
    },
    {
      description: copy.filters.awaitingResponse.description,
      label: copy.filters.awaitingResponse.label,
      value: "awaiting-response",
    },
    {
      description: copy.filters.archived.description,
      label: copy.filters.archived.label,
      value: "archived",
    },
    {
      description: copy.filters.review.description,
      label: copy.filters.review.label,
      value: "review",
    },
    {
      description: copy.filters.qualified.description,
      label: copy.filters.qualified.label,
      value: "qualified",
    },
    {
      description: copy.filters.unassigned.description,
      label: copy.filters.unassigned.label,
      value: "unassigned",
    },
    {
      description: copy.filters.overdue.description,
      label: copy.filters.overdue.label,
      value: "overdue",
    },
  ];
}

function getLeadListSortOptions(copy: LeadsPageCopy): Array<{
  label: string;
  value: LeadListSort;
}> {
  return [
    { label: copy.sorts.lastActivityDesc, value: "last-activity-desc" },
    { label: copy.sorts.lastActivityAsc, value: "last-activity-asc" },
    { label: copy.sorts.nameAsc, value: "name-asc" },
    { label: copy.sorts.nameDesc, value: "name-desc" },
    { label: copy.sorts.propertyAsc, value: "property-asc" },
    { label: copy.sorts.propertyDesc, value: "property-desc" },
    { label: copy.sorts.assigneeAsc, value: "assignee-asc" },
    { label: copy.sorts.assigneeDesc, value: "assignee-desc" },
    { label: copy.sorts.moveInAsc, value: "move-in-asc" },
    { label: copy.sorts.moveInDesc, value: "move-in-desc" },
    { label: copy.sorts.budgetHigh, value: "budget-high" },
    { label: copy.sorts.budgetLow, value: "budget-low" },
  ];
}

const primaryActionClassName =
  "inline-flex cursor-pointer items-center justify-center rounded-2xl border border-[rgba(184,88,51,0.24)] bg-[var(--color-accent)] px-4 py-3 text-sm font-medium !text-white shadow-[0_10px_24px_rgba(141,63,33,0.22)] transition-colors duration-150 hover:bg-[var(--color-accent-strong)] hover:!text-white";

const secondaryActionClassName =
  "inline-flex cursor-pointer items-center justify-center rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm font-medium text-[var(--color-ink)] transition-colors duration-150 hover:border-[rgba(184,88,51,0.18)] hover:bg-[var(--color-panel-strong)]";

const resetActionClassName =
  "inline-flex cursor-pointer items-center justify-center rounded-2xl border border-[rgba(184,88,51,0.24)] bg-[rgb(238,224,210)] px-4 py-3 text-sm font-semibold text-[rgb(113,48,24)] shadow-[0_10px_20px_rgba(141,63,33,0.08),inset_0_1px_0_rgba(255,255,255,0.38)] transition-colors duration-150 hover:border-[rgba(184,88,51,0.34)] hover:bg-[rgb(232,212,195)] hover:text-[rgb(97,39,18)]";

const resetDisabledClassName =
  "inline-flex cursor-not-allowed items-center justify-center rounded-2xl border border-[rgba(160,141,121,0.18)] bg-[rgb(233,225,216)] px-4 py-3 text-sm font-medium text-[rgba(112,100,88,0.72)] shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]";

const compactSecondaryActionClassName =
  "inline-flex cursor-pointer items-center justify-center rounded-full border border-[rgba(184,88,51,0.22)] bg-[rgb(240,227,214)] px-3 py-1.5 text-xs font-semibold text-[rgb(113,48,24)] shadow-[0_8px_16px_rgba(141,63,33,0.07),inset_0_1px_0_rgba(255,255,255,0.34)] transition-colors duration-150 hover:border-[rgba(184,88,51,0.32)] hover:bg-[rgb(233,216,200)] hover:text-[rgb(97,39,18)]";

const rowActionButtonClassName =
  "inline-flex min-w-20 cursor-pointer items-center justify-center rounded-full border border-[rgba(184,88,51,0.22)] bg-[rgb(240,227,214)] px-3 py-2 text-xs font-semibold text-[rgb(113,48,24)] shadow-[0_8px_16px_rgba(141,63,33,0.07),inset_0_1px_0_rgba(255,255,255,0.34)] transition-colors duration-150 hover:border-[rgba(184,88,51,0.32)] hover:bg-[rgb(233,216,200)] hover:text-[rgb(97,39,18)]";

const filterControlClassName =
  "w-full rounded-2xl border border-[rgba(184,88,51,0.16)] bg-[rgba(255,255,255,0.96)] px-4 py-3 text-sm text-[var(--color-ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_8px_18px_rgba(62,43,28,0.05)] outline-none transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-[rgba(109,103,93,0.85)] focus:border-[rgba(184,88,51,0.3)] focus:bg-white focus:ring-4 focus:ring-[rgba(184,88,51,0.08)]";

const stickyHeaderCellClassName =
  "sticky top-0 z-10 border-b border-[rgba(184,88,51,0.16)] bg-[rgba(247,239,230,0.97)] px-5 py-4 text-[0.95rem] font-bold text-[rgba(82,66,52,0.94)] shadow-[inset_0_-2px_0_rgba(184,88,51,0.14),0_12px_18px_rgba(62,43,28,0.08)] backdrop-blur supports-[backdrop-filter]:bg-[rgba(247,239,230,0.88)]";

type SortableLeadColumn = "assignee" | "last-activity" | "name" | "property";

const pageSizeOptions = [5, 10, 25, 50];

type LeadsPageProps = {
  searchParams: Promise<{
    filter?: string;
    page?: string;
    pageSize?: string;
    q?: string;
    showArchived?: string;
    sort?: string;
  }>;
};

export default async function LeadsPage({ searchParams }: LeadsPageProps) {
  const locale = resolveLeadsPageLocale((await headers()).get("accept-language"));
  const copy = getLeadsPageCopy(locale);
  const leadListFilters = getLeadListFilters(copy);
  const leadListSortOptions = getLeadListSortOptions(copy);
  const resolvedSearchParams = await searchParams;
  const activeFilter = isLeadListFilter(resolvedSearchParams.filter)
    ? resolvedSearchParams.filter
    : "all";
  const activeSort = normalizeLeadListSort(resolvedSearchParams.sort);
  const activePageSize = parsePositiveInteger(resolvedSearchParams.pageSize) ?? 10;
  const activePage = parsePositiveInteger(resolvedSearchParams.page) ?? 1;
  const showArchived =
    parseBooleanSearchParam(resolvedSearchParams.showArchived) ||
    activeFilter === "archived";
  const leadList = await getLeadListViewData({
    filter: activeFilter,
    locale,
    page: activePage,
    pageSize: activePageSize,
    query: resolvedSearchParams.q ?? "",
    showArchived,
    sort: activeSort,
  });
  const resetHref = "/app/leads";
  const resetIsActive =
    leadList.query.length > 0 ||
    leadList.activeFilter !== "all" ||
    leadList.sort !== "last-activity-desc" ||
    leadList.showArchived;
  const archivedToggleHref = buildLeadsHref({
    filter:
      leadList.activeFilter === "archived" && leadList.showArchived
        ? "all"
        : leadList.activeFilter,
    page: 1,
    pageSize: leadList.pageSize,
    query: leadList.query,
    showArchived:
      leadList.activeFilter === "archived" && leadList.showArchived
        ? false
        : !leadList.showArchived,
    sort: leadList.sort,
  });
  const currentListHref = buildLeadsHref({
    filter: leadList.activeFilter,
    page: leadList.page,
    pageSize: leadList.pageSize,
    query: leadList.query,
    showArchived: leadList.showArchived,
    sort: leadList.sort,
  });
  const summaryCards = [
    {
      filter: "all" as LeadListFilter,
      helper: copy.summaryCards.total.helper(leadList.summary.unassignedCount),
      label: copy.summaryCards.total.label,
      value: leadList.summary.totalCount,
    },
    {
      filter: "awaiting-response" as LeadListFilter,
      helper: copy.summaryCards.awaitingResponse.helper(leadList.summary.overdueCount),
      label: copy.summaryCards.awaitingResponse.label,
      value: leadList.summary.awaitingResponseCount,
    },
    {
      filter: "review" as LeadListFilter,
      helper: copy.summaryCards.review.helper,
      label: copy.summaryCards.review.label,
      value: leadList.summary.reviewCount,
    },
    {
      filter: "qualified" as LeadListFilter,
      helper: copy.summaryCards.qualified.helper,
      label: copy.summaryCards.qualified.label,
      value: leadList.summary.qualifiedCount,
    },
  ];
  const filterTabItems = leadListFilters.map((leadListFilter) => ({
    description: leadListFilter.description,
    href: buildLeadsHref({
      filter: leadListFilter.value,
      page: 1,
      pageSize: leadList.pageSize,
      query: leadList.query,
      showArchived:
        leadListFilter.value === "archived"
          ? true
          : leadList.showArchived,
      sort: leadList.sort,
    }),
    label: leadListFilter.label,
    value: leadListFilter.value,
  }));

  return (
    <main lang={getIntlLocaleForLeadsPageLocale(locale)}>
      <PageHeader
        eyebrow={copy.header.eyebrow}
        title={copy.header.title}
        description={copy.header.description}
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link className={secondaryActionClassName} href="/app/inbox">
              {copy.actions.openInbox}
            </Link>
            <Link className={primaryActionClassName} href="/app/leads/new">
              {copy.actions.addLead}
            </Link>
          </div>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((summaryCard) => (
          <Link
            key={summaryCard.label}
            className="block rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)] transition duration-150 hover:-translate-y-0.5 hover:border-[rgba(184,88,51,0.24)] hover:bg-[rgba(255,255,255,0.95)] hover:shadow-[0_24px_50px_rgba(62,43,28,0.1)]"
            href={buildLeadsHref({
              filter: summaryCard.filter,
              page: 1,
              pageSize: leadList.pageSize,
              query: "",
              showArchived: leadList.showArchived,
              sort: leadList.sort,
            })}
            scroll={false}
          >
            <div className="text-sm text-[var(--color-muted)]">{summaryCard.label}</div>
            <div className="mt-2 text-3xl font-semibold">{summaryCard.value}</div>
            <div className="mt-2 text-sm text-[var(--color-muted)]">{summaryCard.helper}</div>
          </Link>
        ))}
      </div>

      <div className="mb-6 rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-5 shadow-[var(--shadow-panel)]">
        <form className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,0.55fr))_auto]" method="get">
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
              {copy.form.search}
            </span>
            <input
              className={filterControlClassName}
              defaultValue={leadList.query}
              name="q"
              placeholder={copy.form.searchPlaceholder}
              type="search"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
              {copy.form.filter}
            </span>
            <select
              className={filterControlClassName}
              defaultValue={leadList.activeFilter}
              name="filter"
            >
              {leadListFilters.map((leadListFilter) => (
                <option key={leadListFilter.value} value={leadListFilter.value}>
                  {leadListFilter.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
              {copy.form.sort}
            </span>
            <select
              className={filterControlClassName}
              defaultValue={leadList.sort}
              name="sort"
            >
              {leadListSortOptions.map((leadListSortOption) => (
                <option key={leadListSortOption.value} value={leadListSortOption.value}>
                  {leadListSortOption.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
              {copy.form.rows}
            </span>
            <select
              className={filterControlClassName}
              defaultValue={String(leadList.pageSize)}
              name="pageSize"
            >
              {pageSizeOptions.map((pageSizeOption) => (
                <option key={pageSizeOption} value={pageSizeOption}>
                  {copy.form.rowsPerPage(pageSizeOption)}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <button className={primaryActionClassName} type="submit">
              {copy.actions.apply}
            </button>
            {resetIsActive ? (
              <Link className={resetActionClassName} href={resetHref}>
                {copy.actions.reset}
              </Link>
            ) : (
              <button
                aria-disabled="true"
                className={resetDisabledClassName}
                disabled
                type="button"
              >
                {copy.actions.reset}
              </button>
            )}
          </div>
        </form>

        <div className="mt-4 flex flex-wrap items-start gap-2">
          <LeadsFilterTabs activeValue={leadList.activeFilter} items={filterTabItems} />

          {leadList.archivedCount > 0 ? (
            <Link
              className={`ml-auto inline-flex items-center gap-3 rounded-full border px-4 py-2 text-sm font-medium transition ${
                leadList.showArchived
                  ? "border-[rgba(184,88,51,0.28)] bg-[rgba(184,88,51,0.12)] text-[var(--color-accent-strong)]"
                  : "border-[var(--color-line)] bg-[rgba(255,255,255,0.88)] text-[var(--color-muted)] hover:border-[rgba(184,88,51,0.18)] hover:bg-[rgba(255,255,255,0.96)] hover:text-[var(--color-ink)]"
              }`}
              href={archivedToggleHref}
              scroll={false}
            >
              <span>{copy.actions.showArchived}</span>
              <span className="rounded-full border border-current/15 px-2 py-0.5 text-xs">
                {leadList.archivedCount}
              </span>
              <span
                aria-hidden="true"
                className={`relative h-6 w-11 rounded-full transition ${
                  leadList.showArchived
                    ? "bg-[rgba(184,88,51,0.22)]"
                    : "bg-[rgba(109,103,93,0.16)]"
                }`}
              >
                <span
                  className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-[0_2px_6px_rgba(30,24,18,0.18)] transition ${
                    leadList.showArchived ? "left-6" : "left-1"
                  }`}
                />
              </span>
            </Link>
          ) : null}
        </div>
      </div>

      {leadList.totalCount === 0 ? (
        leadList.allLeadCount === 0 ? (
          <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-8 shadow-[var(--shadow-panel)]">
            <div className="text-xl font-semibold">{copy.emptyStates.noLeadsTitle}</div>
            <div className="mt-3 max-w-2xl text-sm leading-7 text-[var(--color-muted)]">
              {copy.emptyStates.noLeadsDescription}
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link className={`${primaryActionClassName} px-5`} href="/app/leads/new">
                {copy.actions.addFirstLead}
              </Link>
              <Link className={`${secondaryActionClassName} px-5`} href="/app/inbox">
                {copy.actions.openInboxInstead}
              </Link>
            </div>
          </div>
        ) : !leadList.showArchived && leadList.archivedCount > 0 ? (
          <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 text-sm text-[var(--color-muted)] shadow-[var(--shadow-panel)]">
            {copy.emptyStates.noActiveMatched}
          </div>
        ) : (
          <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 text-sm text-[var(--color-muted)] shadow-[var(--shadow-panel)]">
            {copy.emptyStates.noSearchMatched}
          </div>
        )
      ) : (
        <LeadsPaginationShell
          filter={leadList.activeFilter}
          locale={locale}
          nextHref={buildLeadsHref({
            filter: leadList.activeFilter,
            page: Math.min(leadList.page + 1, leadList.pageCount),
            pageSize: leadList.pageSize,
            query: leadList.query,
            showArchived: leadList.showArchived,
            sort: leadList.sort,
          })}
          page={leadList.page}
          pageCount={leadList.pageCount}
          pageSize={leadList.pageSize}
          previousHref={buildLeadsHref({
            filter: leadList.activeFilter,
            page: Math.max(leadList.page - 1, 1),
            pageSize: leadList.pageSize,
            query: leadList.query,
            showArchived: leadList.showArchived,
            sort: leadList.sort,
          })}
          query={leadList.query}
          showArchived={leadList.showArchived}
          sort={leadList.sort}
          totalCount={leadList.totalCount}
        >
          <div className="relative hidden rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] shadow-[var(--shadow-panel)] md:block">
            <table className="min-w-full table-fixed text-left text-sm">
              <colgroup>
                <col className="w-[22%]" />
                <col className="w-[13%]" />
                <col className="w-[13%]" />
                <col className="w-[13%]" />
                <col className="w-[10%]" />
                <col className="w-[8%]" />
                <col className="w-[8%]" />
                <col className="w-[7%]" />
                <col className="w-[6%]" />
              </colgroup>
              <thead className="border-b border-[var(--color-line)] text-[var(--color-muted)] text-[0.95rem] [font-weight:750]">
                <tr>
                  <SortableHeader
                    currentSort={leadList.sort}
                    href={buildLeadsHref({
                      filter: leadList.activeFilter,
                      page: 1,
                      pageSize: leadList.pageSize,
                      query: leadList.query,
                      showArchived: leadList.showArchived,
                      sort: getNextSortableColumnSort(leadList.sort, "name"),
                    })}
                    label={copy.table.lead}
                    sortColumn="name"
                  />
                  <SortableHeader
                    currentSort={leadList.sort}
                    href={buildLeadsHref({
                      filter: leadList.activeFilter,
                      page: 1,
                      pageSize: leadList.pageSize,
                      query: leadList.query,
                      showArchived: leadList.showArchived,
                      sort: getNextSortableColumnSort(leadList.sort, "property"),
                    })}
                    label={copy.table.property}
                    sortColumn="property"
                  />
                  <SortableHeader
                    currentSort={leadList.sort}
                    href={buildLeadsHref({
                      filter: leadList.activeFilter,
                      page: 1,
                      pageSize: leadList.pageSize,
                      query: leadList.query,
                      showArchived: leadList.showArchived,
                      sort: getNextSortableColumnSort(leadList.sort, "assignee"),
                    })}
                    label={copy.table.assignee}
                    sortColumn="assignee"
                  />
                    <th className={stickyHeaderCellClassName}>{copy.table.timingBudget}</th>
                  <th className={stickyHeaderCellClassName}>{copy.table.status}</th>
                  <th className={stickyHeaderCellClassName}>{copy.table.fit}</th>
                  <th className={stickyHeaderCellClassName}>{copy.table.sla}</th>
                  <SortableHeader
                    currentSort={leadList.sort}
                    href={buildLeadsHref({
                      filter: leadList.activeFilter,
                      page: 1,
                      pageSize: leadList.pageSize,
                      query: leadList.query,
                      showArchived: leadList.showArchived,
                      sort: getNextSortableColumnSort(leadList.sort, "last-activity"),
                    })}
                    label={copy.table.lastActivity}
                    sortColumn="last-activity"
                  />
                  <th className={stickyHeaderCellClassName}>{copy.table.actions}</th>
                </tr>
              </thead>
              <tbody>
                {leadList.leads.map((lead) => (
                  <tr key={lead.id} className={`border-b border-[rgba(28,26,22,0.08)] align-top transition-colors duration-150 last:border-b-0 ${
                    lead.isArchived
                      ? "bg-[rgba(244,238,231,0.95)] hover:bg-[rgba(184,88,51,0.05)]"
                      : "bg-[rgba(255,255,255,0.9)] even:bg-[rgba(255,250,245,0.92)] hover:bg-[rgba(184,88,51,0.08)]"
                  }`}>
                    <td className="px-5 py-4 transition-colors duration-150">
                      <Link
                        className="block cursor-pointer truncate font-medium underline decoration-[var(--color-line)] underline-offset-4"
                        href={buildLeadDetailHref(lead.id, {
                          filter: leadList.activeFilter,
                          page: leadList.page,
                          pageSize: leadList.pageSize,
                          query: leadList.query,
                          showArchived: leadList.showArchived,
                          sort: leadList.sort,
                        })}
                        prefetch={false}
                        title={lead.name}
                      >
                        {lead.name}
                      </Link>
                      <div className="mt-2 truncate text-xs text-[var(--color-muted)]" title={lead.source}>{lead.source}</div>
                      <div className="mt-2 truncate text-xs text-[var(--color-muted)]" title={[lead.email, lead.phone].filter(Boolean).join(" | ") || copy.common.noContactMethodSaved}>
                        {[lead.email, lead.phone].filter(Boolean).join(" | ") || copy.common.noContactMethodSaved}
                      </div>
                    </td>
                    <td className="px-5 py-4 transition-colors duration-150">
                      <div className="truncate" title={lead.property}>{lead.property}</div>
                    </td>
                    <td className="px-5 py-4 transition-colors duration-150">
                      {lead.canAssignOwner ? (
                        <LeadAssigneeQuickSelect
                          action={assignLeadOwnerAction.bind(null, lead.id)}
                          assignedMembershipId={lead.assignedMembershipId}
                          assignmentOptions={lead.assignmentOptions}
                          currentAssigneeLabel={lead.name}
                          locale={locale}
                          redirectTo={currentListHref}
                          variant="table"
                        />
                      ) : (
                        <div className="truncate" title={lead.assignedTo}>{lead.assignedTo}</div>
                      )}
                    </td>
                    <td className="px-5 py-4 text-[var(--color-muted)] transition-colors duration-150">
                      <div className="truncate">{lead.moveInDate}</div>
                      <div className="mt-2 truncate">{lead.budget}</div>
                    </td>
                    <td className="px-5 py-4 transition-colors duration-150">
                      <span className={getStatusChipClassName(lead.statusValue)}>{lead.status}</span>
                    </td>
                    <td className="px-5 py-4 transition-colors duration-150">
                      <span className={getFitChipClassName(lead.fitValue)}>{lead.fit}</span>
                    </td>
                    <td className="px-5 py-4 transition-colors duration-150">
                      {lead.slaSummary ? (
                        <span
                          className={lead.slaSummary.isOverdue ? "text-[var(--color-accent-strong)]" : "text-[var(--color-muted)]"}
                        >
                          {lead.slaSummary.label} · {lead.slaSummary.dueAt}
                        </span>
                      ) : (
                        <span className="text-[var(--color-muted)]">-</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-[var(--color-muted)] transition-colors duration-150">
                      <div className="truncate">{lead.lastActivity}</div>
                    </td>
                    <td className="px-5 py-4 transition-colors duration-150">
                      {lead.canArchive || lead.canUnarchive ? (
                        <LeadLifecycleActionControl
                          archiveLabel={copy.actions.archive}
                          leadId={lead.id}
                          isArchived={lead.isArchived}
                          redirectTo={buildLeadsHref({
                            filter: leadList.activeFilter,
                            page: leadList.page,
                            pageSize: leadList.pageSize,
                            query: leadList.query,
                            showArchived: leadList.showArchived,
                            sort: leadList.sort,
                          })}
                          unarchiveLabel={copy.actions.unarchive}
                        />
                      ) : (
                        <span className="text-xs text-[var(--color-muted)]">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-4 md:hidden">
            {leadList.leads.map((lead) => (
              <div
                key={lead.id}
                className={`rounded-[2rem] border border-[var(--color-line)] p-5 shadow-[var(--shadow-panel)] transition duration-150 ${
                  lead.isArchived
                    ? "bg-[rgba(244,238,231,0.95)]"
                    : "bg-[var(--color-panel)] hover:-translate-y-0.5 hover:border-[rgba(184,88,51,0.32)] hover:bg-[rgba(255,255,255,0.96)] hover:shadow-[0_24px_60px_rgba(30,24,18,0.12)]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link
                      className="text-lg font-semibold underline decoration-[var(--color-line)] underline-offset-4"
                      href={buildLeadDetailHref(lead.id, {
                        filter: leadList.activeFilter,
                        page: leadList.page,
                        pageSize: leadList.pageSize,
                        query: leadList.query,
                        showArchived: leadList.showArchived,
                        sort: leadList.sort,
                      })}
                      prefetch={false}
                    >
                      {lead.name}
                    </Link>
                    <div className="mt-2 text-sm text-[var(--color-muted)]">{lead.source} · {lead.property}</div>
                  </div>
                  <span className={getFitChipClassName(lead.fitValue)}>{lead.fit}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className={getStatusChipClassName(lead.statusValue)}>{lead.status}</span>
                  {lead.slaSummary ? (
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${
                        lead.slaSummary.isOverdue
                          ? "border-[rgba(184,88,51,0.24)] bg-[rgba(184,88,51,0.08)] text-[var(--color-accent-strong)]"
                          : "border-[var(--color-line)] bg-white text-[var(--color-muted)]"
                      }`}
                    >
                      {lead.slaSummary.label} · {lead.slaSummary.dueAt}
                    </span>
                  ) : null}
                </div>
                <div className="mt-4 grid gap-3 text-sm text-[var(--color-muted)] sm:grid-cols-2">
                  <div>
                    <div className="text-xs uppercase tracking-[0.14em]">{copy.mobile.assignee}</div>
                    {lead.canAssignOwner ? (
                      <LeadAssigneeQuickSelect
                        action={assignLeadOwnerAction.bind(null, lead.id)}
                        assignedMembershipId={lead.assignedMembershipId}
                        assignmentOptions={lead.assignmentOptions}
                        className="mt-2"
                        currentAssigneeLabel={lead.name}
                        locale={locale}
                        redirectTo={currentListHref}
                        variant="card"
                      />
                    ) : (
                      <div className="mt-1 text-[var(--color-ink)]">{lead.assignedTo}</div>
                    )}
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.14em]">{copy.mobile.lastActivity}</div>
                    <div className="mt-1 text-[var(--color-ink)]">{lead.lastActivity}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.14em]">{copy.mobile.moveIn}</div>
                    <div className="mt-1 text-[var(--color-ink)]">{lead.moveInDate}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.14em]">{copy.mobile.budget}</div>
                    <div className="mt-1 text-[var(--color-ink)]">{lead.budget}</div>
                  </div>
                </div>
                <div className="mt-4 text-sm text-[var(--color-muted)]">
                  {[lead.email, lead.phone].filter(Boolean).join(" | ") || copy.common.noContactMethodSaved}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    className={compactSecondaryActionClassName}
                    href={buildLeadDetailHref(lead.id, {
                      filter: leadList.activeFilter,
                      page: leadList.page,
                      pageSize: leadList.pageSize,
                      query: leadList.query,
                      showArchived: leadList.showArchived,
                      sort: leadList.sort,
                    })}
                    prefetch={false}
                  >
                    {copy.actions.openLead}
                  </Link>
                  {lead.canArchive || lead.canUnarchive ? (
                    <LeadLifecycleActionControl
                      archiveLabel={copy.actions.archive}
                      leadId={lead.id}
                      isArchived={lead.isArchived}
                      redirectTo={buildLeadsHref({
                        filter: leadList.activeFilter,
                        page: leadList.page,
                        pageSize: leadList.pageSize,
                        query: leadList.query,
                        showArchived: leadList.showArchived,
                        sort: leadList.sort,
                      })}
                      unarchiveLabel={copy.actions.unarchive}
                    />
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </LeadsPaginationShell>
      )}
    </main>
  );
}

function SortableHeader(params: {
  currentSort: LeadListSort;
  href: string;
  label: string;
  sortColumn: SortableLeadColumn;
}) {
  const activeColumn = getSortableColumnFromSort(params.currentSort);
  const isActive = activeColumn === params.sortColumn;
  const activeDirection = isActive ? getSortDirection(params.currentSort) : null;

  return (
    <th className={`${stickyHeaderCellClassName} transition-colors duration-150 hover:bg-[rgba(250,242,234,0.98)] supports-[backdrop-filter]:hover:bg-[rgba(250,242,234,0.92)]`}>
      <LeadsSortLink
        className={`-mx-2 -my-1 inline-flex w-[calc(100%+1rem)] items-center justify-between rounded-xl px-2 py-1 cursor-pointer transition hover:bg-[rgba(184,88,51,0.08)] hover:text-[var(--color-ink)] ${
          isActive ? "text-[var(--color-ink)] underline underline-offset-4" : ""
        }`}
        href={params.href}
      >
        <span className="inline-flex items-center gap-1">
          <span>{params.label}</span>
          {isActive ? (
            <span
              aria-hidden="true"
              className="text-xs text-[var(--color-ink)]"
            >
              {activeDirection === "asc" ? "↑" : "↓"}
            </span>
          ) : null}
        </span>
      </LeadsSortLink>
    </th>
  );
}

function buildLeadsHref(params: {
  filter: LeadListFilter;
  page: number;
  pageSize: number;
  query: string;
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
    filter: LeadListFilter;
    page: number;
    pageSize: number;
    query: string;
    showArchived: boolean;
    sort: LeadListSort;
  },
) {
  const listHref = buildLeadsHref(params);
  const queryString = listHref.split("?")[1] ?? "";

  return queryString.length > 0
    ? `/app/leads/${leadId}?${queryString}`
    : `/app/leads/${leadId}`;
}

function getFitChipClassName(fitValue: string) {
  switch (fitValue) {
    case "PASS":
      return "rounded-full border border-[rgba(39,110,78,0.24)] bg-[rgb(225,244,233)] px-3 py-1 text-xs font-semibold text-[rgb(39,110,78)] shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]";
    case "CAUTION":
      return "rounded-full border border-[rgba(184,88,51,0.26)] bg-[rgb(248,228,214)] px-3 py-1 text-xs font-semibold text-[var(--color-accent-strong)] shadow-[inset_0_1px_0_rgba(255,255,255,0.42)]";
    case "MISMATCH":
      return "rounded-full border border-[rgba(157,60,76,0.22)] bg-[rgb(246,221,227)] px-3 py-1 text-xs font-semibold text-[rgb(157,60,76)] shadow-[inset_0_1px_0_rgba(255,255,255,0.42)]";
    default:
      return "rounded-full border border-[rgba(123,112,97,0.18)] bg-[rgb(239,233,225)] px-3 py-1 text-xs font-semibold text-[rgb(107,98,86)] shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]";
  }
}

function getStatusChipClassName(statusValue: string) {
  switch (statusValue) {
    case "NEW":
    case "AWAITING_RESPONSE":
    case "INCOMPLETE":
      return "rounded-full border border-[rgba(21,94,239,0.38)] bg-[rgba(37,99,235,0.18)] px-3 py-1 text-xs font-semibold text-[rgb(29,78,216)]";
    case "QUALIFIED":
    case "TOUR_SCHEDULED":
    case "APPLICATION_SENT":
      return "rounded-full border border-[rgba(22,101,52,0.34)] bg-[rgba(34,197,94,0.18)] px-3 py-1 text-xs font-semibold text-[rgb(21,128,61)]";
    case "UNDER_REVIEW":
    case "CAUTION":
      return "rounded-full border border-[rgba(180,83,9,0.34)] bg-[rgba(245,158,11,0.18)] px-3 py-1 text-xs font-semibold text-[rgb(180,83,9)]";
    case "DECLINED":
    case "ARCHIVED":
    case "CLOSED":
      return "rounded-full border border-[rgba(71,85,105,0.28)] bg-[rgba(148,163,184,0.18)] px-3 py-1 text-xs font-semibold text-[rgb(71,85,105)]";
    default:
      return "rounded-full border border-[rgba(71,85,105,0.22)] bg-[rgba(241,245,249,0.9)] px-3 py-1 text-xs font-semibold text-[rgb(71,85,105)]";
  }
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
    case "name":
      return "name-asc";
    case "property":
      return "property-asc";
    case "assignee":
      return "assignee-asc";
    case "move-in":
      return "move-in-asc";
    default:
      return isLeadListSort(value) ? value : "last-activity-desc";
  }
}

function getNextSortableColumnSort(
  currentSort: LeadListSort,
  column: SortableLeadColumn,
): LeadListSort {
  const currentColumn = getSortableColumnFromSort(currentSort);
  const currentDirection = getSortDirection(currentSort);

  if (currentColumn === column) {
    return `${column}-${currentDirection === "asc" ? "desc" : "asc"}` as LeadListSort;
  }

  return column === "last-activity" ? "last-activity-desc" : `${column}-asc` as LeadListSort;
}

function getSortableColumnFromSort(sort: LeadListSort): SortableLeadColumn | null {
  if (sort.startsWith("last-activity-")) {
    return "last-activity";
  }

  if (sort.startsWith("name-")) {
    return "name";
  }

  if (sort.startsWith("property-")) {
    return "property";
  }

  if (sort.startsWith("assignee-")) {
    return "assignee";
  }

  return null;
}

function getSortDirection(sort: LeadListSort) {
  return sort.endsWith("-asc") ? "asc" : "desc";
}

function parsePositiveInteger(value: string | undefined) {
  if (!value) {
    return null;
  }

  const parsedValue = Number.parseInt(value, 10);

  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : null;
}

function parseBooleanSearchParam(value: string | undefined) {
  return value === "1" || value === "true" || value === "on";
}

function LeadLifecycleActionControl(params: {
  archiveLabel: string;
  leadId: string;
  isArchived: boolean;
  redirectTo: string;
  unarchiveLabel: string;
}) {
  return (
    <form
      action={(params.isArchived ? unarchiveLeadAction : archiveLeadAction).bind(
        null,
        params.leadId,
      )}
    >
      <input name="redirectTo" type="hidden" value={params.redirectTo} />
      <button className={rowActionButtonClassName} type="submit">
        {params.isArchived ? params.unarchiveLabel : params.archiveLabel}
      </button>
    </form>
  );
}
