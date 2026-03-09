"use client";

import { useRouter } from "next/navigation";
import { getLeadsPageCopy, type LeadsPageLocale } from "@/lib/leads-page-i18n";
import {
  useMemo,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";

const secondaryActionClassName =
  "inline-flex h-10 cursor-pointer items-center justify-center rounded-xl border border-[rgba(28,26,22,0.1)] bg-white px-4 text-sm font-medium text-[var(--color-ink)] shadow-[0_6px_18px_rgba(62,43,28,0.06)] transition-colors duration-150 hover:border-[rgba(184,88,51,0.22)] hover:bg-[rgba(255,250,243,0.96)]";

const primaryActionClassName =
  "inline-flex h-10 cursor-pointer items-center justify-center rounded-xl border border-[rgba(184,88,51,0.24)] bg-[var(--color-accent)] px-4 text-sm font-medium text-white shadow-[0_10px_24px_rgba(141,63,33,0.22)] transition-colors duration-150 hover:bg-[var(--color-accent-strong)]";

export function LeadsPaginationShell(props: {
  children: ReactNode;
  filter: string;
  locale: LeadsPageLocale;
  nextHref: string;
  page: number;
  pageCount: number;
  pageSize: number;
  previousHref: string;
  query: string;
  showArchived: boolean;
  sort: string;
  totalCount: number;
}) {
  const copy = getLeadsPageCopy(props.locale);
  const router = useRouter();
  const listTopReference = useRef<HTMLDivElement | null>(null);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [pageInputValue, setPageInputValue] = useState(String(props.page));
  const [isPending, startTransition] = useTransition();
  const hasPreviousPage = props.page > 1;
  const hasNextPage = props.page < props.pageCount;

  function scrollListToTop(behavior: ScrollBehavior) {
    const scrollContainer = document.querySelector<HTMLElement>(
      "[data-app-scroll-container]",
    );
    const listTopNode = listTopReference.current;

    if (scrollContainer && listTopNode) {
      const containerRect = scrollContainer.getBoundingClientRect();
      const targetRect = listTopNode.getBoundingClientRect();
      const top = scrollContainer.scrollTop + targetRect.top - containerRect.top;

      scrollContainer.scrollTo({
        top: Math.max(0, top),
        behavior,
      });
      return;
    }

    listTopNode?.scrollIntoView({
      behavior,
      block: "start",
    });
  }

  const quickJumpPages = useMemo(() => {
    const candidates = new Set<number>([
      1,
      Math.max(1, props.page - 10),
      Math.max(1, props.page - 5),
      Math.max(1, props.page - 1),
      props.page,
      Math.min(props.pageCount, props.page + 1),
      Math.min(props.pageCount, props.page + 5),
      Math.min(props.pageCount, props.page + 10),
      props.pageCount,
    ]);

    return [...candidates].filter((page) => page >= 1 && page <= props.pageCount).sort((left, right) => left - right);
  }, [props.page, props.pageCount]);

  useEffect(() => {
    if (!isPending && pendingHref) {
      scrollListToTop("auto");
      setPendingHref(null);
    }
  }, [isPending, pendingHref, props.page]);

  useEffect(() => {
    setPageInputValue(String(props.page));
  }, [props.page]);

  function buildPageHref(page: number) {
    const searchParameters = new URLSearchParams();

    if (props.filter !== "all") {
      searchParameters.set("filter", props.filter);
    }

    if (page > 1) {
      searchParameters.set("page", String(page));
    }

    if (props.pageSize !== 10) {
      searchParameters.set("pageSize", String(props.pageSize));
    }

    if (props.query.trim().length > 0) {
      searchParameters.set("q", props.query.trim());
    }

    if (props.showArchived) {
      searchParameters.set("showArchived", "1");
    }

    if (props.sort !== "last-activity-desc") {
      searchParameters.set("sort", props.sort);
    }

    const queryString = searchParameters.toString();

    return queryString.length > 0 ? `/app/leads?${queryString}` : "/app/leads";
  }

  function navigateToPage(href: string) {
    setPendingHref(href);
    scrollListToTop("smooth");
    startTransition(() => {
      router.push(href, { scroll: false });
    });
  }

  function handleManualJump() {
    const parsedPage = Number.parseInt(pageInputValue, 10);

    if (!Number.isFinite(parsedPage)) {
      setPageInputValue(String(props.page));
      return;
    }

    const clampedPage = Math.min(Math.max(parsedPage, 1), props.pageCount);

    setPageInputValue(String(clampedPage));

    if (clampedPage === props.page) {
      return;
    }

    navigateToPage(buildPageHref(clampedPage));
  }

  return (
    <div>
      <div id="leads-list-top" ref={listTopReference} />
      <div className="relative">
        {props.children}
        {isPending && pendingHref ? (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-start justify-center rounded-[2rem] bg-[rgba(248,243,235,0.62)] px-4 py-6 backdrop-blur-[2px]">
            <div className="flex items-center gap-3 rounded-2xl border border-[var(--color-line)] bg-[rgba(255,255,255,0.96)] px-4 py-3 text-sm font-medium text-[var(--color-muted)] shadow-[var(--shadow-panel)]">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-line)] border-t-[var(--color-accent)]" />
              {copy.pagination.loadingNextPage}
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-4 border-t border-[rgba(184,88,51,0.14)] pt-4">
        <div className="flex flex-wrap items-center justify-center gap-3 rounded-xl border border-[rgba(184,88,51,0.12)] bg-[linear-gradient(180deg,rgba(255,250,244,0.98),rgba(255,247,239,0.94))] px-4 py-3 text-center shadow-[0_10px_28px_rgba(62,43,28,0.06)] md:justify-between md:text-left md:px-5">
          <div className="rounded-full border border-[rgba(184,88,51,0.16)] bg-[rgba(184,88,51,0.08)] px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-accent-strong)]">
            {copy.pagination.pageOf(props.page, props.pageCount)}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 text-sm font-medium text-[var(--color-muted)] md:justify-start">
            <span>{copy.pagination.matchingLeads(props.totalCount)}</span>
            <div className="hidden h-4 w-px bg-[rgba(184,88,51,0.14)] sm:block" />
            <label className="flex items-center gap-2 rounded-full border border-[rgba(184,88,51,0.12)] bg-[rgba(255,255,255,0.74)] px-2 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
              <span>{copy.pagination.quickJump}</span>
              <select
                className="rounded-full border border-[rgba(184,88,51,0.14)] bg-[rgb(250,244,238)] px-3 py-1 text-sm font-medium normal-case text-[var(--color-ink)] outline-none transition focus:border-[rgba(184,88,51,0.28)]"
                disabled={isPending}
                onChange={(event) => {
                  const targetPage = Number.parseInt(event.target.value, 10);

                  if (!Number.isFinite(targetPage) || targetPage === props.page) {
                    return;
                  }

                  navigateToPage(buildPageHref(targetPage));
                }}
                value={String(props.page)}
              >
                {quickJumpPages.map((page) => (
                  <option key={page} value={page}>
                    {copy.pagination.pageOption(page)}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-2 rounded-full border border-[rgba(184,88,51,0.12)] bg-[rgba(255,255,255,0.74)] px-2 py-1">
              <span className="pl-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                {copy.pagination.goTo}
              </span>
              <input
                className="h-9 w-18 rounded-full border border-[rgba(184,88,51,0.14)] bg-[rgb(250,244,238)] px-3 text-sm font-medium text-[var(--color-ink)] outline-none transition focus:border-[rgba(184,88,51,0.28)]"
                disabled={isPending}
                inputMode="numeric"
                max={props.pageCount}
                min={1}
                onChange={(event) => setPageInputValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleManualJump();
                  }
                }}
                type="number"
                value={pageInputValue}
              />
              <button
                className={secondaryActionClassName}
                disabled={isPending}
                onClick={handleManualJump}
                type="button"
              >
                {copy.pagination.go}
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 md:justify-end">
          <button
            aria-disabled={!hasPreviousPage}
            className={`${secondaryActionClassName} ${
              hasPreviousPage
                ? ""
                : "pointer-events-none border-[rgba(28,26,22,0.08)] bg-[rgba(255,250,243,0.82)] text-[var(--color-muted)] shadow-none hover:border-[rgba(28,26,22,0.08)] hover:bg-[rgba(255,250,243,0.82)]"
            }`}
            disabled={!hasPreviousPage || isPending}
            onClick={() => navigateToPage(props.previousHref)}
            type="button"
          >
            {copy.pagination.previous}
          </button>
          <button
            aria-disabled={!hasNextPage}
            className={`${hasNextPage ? primaryActionClassName : secondaryActionClassName} ${
              hasNextPage
                ? ""
                : "pointer-events-none border-[rgba(28,26,22,0.08)] bg-[rgba(255,250,243,0.82)] text-[var(--color-muted)] shadow-none hover:border-[rgba(28,26,22,0.08)] hover:bg-[rgba(255,250,243,0.82)]"
            }`}
            disabled={!hasNextPage || isPending}
            onClick={() => navigateToPage(props.nextHref)}
            type="button"
          >
            {copy.pagination.next}
          </button>
          </div>
        </div>
      </div>
    </div>
  );
}