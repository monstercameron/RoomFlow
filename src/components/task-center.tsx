"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type SVGProps } from "react";

type TaskCenterItem = {
  assignedTo: string;
  dueAtLabel: string;
  href: string;
  id: string;
  isGeneralTask: boolean;
  isLeadTask: boolean;
  isOverdue: boolean;
  leadName: string | null;
  propertyName: string | null;
  statusLabel: string;
  title: string;
};

function ChecklistIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" {...props}>
      <path
        d="M9 7.25h8M9 12h8m-8 4.75h8M5.25 7.25h.01M5.25 12h.01M5.25 16.75h.01"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

export function TaskCenter({
  generalTaskCount,
  items,
  leadTaskCount,
  overdueTaskCount,
  totalOpenCount,
}: {
  generalTaskCount: number;
  items: TaskCenterItem[];
  leadTaskCount: number;
  overdueTaskCount: number;
  totalOpenCount: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const generalItems = items.filter((item) => item.isGeneralTask);
  const leadItems = items.filter((item) => item.isLeadTask);
  const badgeLabel = totalOpenCount > 99 ? "99+" : String(totalOpenCount);

  return (
    <div className="relative z-40" ref={rootRef}>
      <button
        aria-controls={panelId}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={totalOpenCount > 0 ? `Tasks, ${totalOpenCount} open` : "Tasks"}
        className="group relative inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[rgba(191,164,139,0.3)] bg-[linear-gradient(180deg,rgba(255,249,243,0.96),rgba(244,232,220,0.98))] text-[rgba(108,91,75,0.92)] shadow-[0_14px_30px_rgba(93,64,39,0.08)] transition-[transform,border-color,background-color,color,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:border-[rgba(184,88,51,0.22)] hover:bg-[linear-gradient(180deg,rgba(255,245,237,1),rgba(241,226,212,1))] hover:text-[var(--color-ink)] hover:shadow-[0_18px_34px_rgba(93,64,39,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(184,88,51,0.3)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-panel)] active:translate-y-px"
        onClick={() => {
          setIsOpen((currentValue) => !currentValue);
        }}
        type="button"
      >
        <ChecklistIcon className="h-5 w-5" />
        {totalOpenCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-[var(--color-accent)] px-1.5 py-0.5 text-[0.68rem] font-semibold leading-none text-white shadow-[0_8px_18px_rgba(184,88,51,0.28)]">
            {badgeLabel}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div
          className="absolute right-0 top-[calc(100%+0.75rem)] z-[80] w-[min(26rem,calc(100vw-2.5rem))] overflow-hidden rounded-[1.6rem] border border-[rgba(194,170,145,0.34)] bg-[linear-gradient(180deg,rgba(255,251,246,0.98),rgba(246,237,227,0.98))] shadow-[0_24px_54px_rgba(62,43,28,0.16)] backdrop-blur-xl"
          id={panelId}
          role="dialog"
        >
          <div className="border-b border-[var(--color-line)] px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-[var(--color-ink)]">Tasks</div>
                <div className="mt-1 text-xs text-[var(--color-muted)]">
                  {totalOpenCount > 0 ? `${totalOpenCount} active tasks in queue` : "No open tasks right now"}
                </div>
              </div>
              <Link
                className="text-xs font-medium text-[var(--color-accent-strong)] underline decoration-transparent underline-offset-4 transition-colors hover:decoration-current"
                href="/app/tasks"
                onClick={() => {
                  setIsOpen(false);
                }}
              >
                Open task queue
              </Link>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-[rgba(184,88,51,0.16)] bg-[rgba(184,88,51,0.08)] px-3 py-1 font-medium text-[var(--color-accent-strong)]">
                {generalTaskCount} general
              </span>
              <span className="rounded-full border border-[rgba(176,129,56,0.18)] bg-[rgba(176,129,56,0.09)] px-3 py-1 font-medium text-[rgba(121,88,37,0.95)]">
                {leadTaskCount} lead-linked
              </span>
              {overdueTaskCount > 0 ? (
                <span className="rounded-full border border-[rgba(170,58,32,0.18)] bg-[rgba(170,58,32,0.08)] px-3 py-1 font-medium text-[#8f2f1c]">
                  {overdueTaskCount} overdue
                </span>
              ) : null}
            </div>
          </div>

          <div className="max-h-[26rem] overflow-y-auto px-3 py-3">
            {items.length === 0 ? (
              <div className="rounded-[1.3rem] border border-dashed border-[rgba(194,170,145,0.4)] bg-[rgba(255,255,255,0.46)] px-4 py-5 text-sm text-[var(--color-muted)]">
                No active tasks. New workspace tasks and lead follow-ups will show up here.
              </div>
            ) : (
              <div className="space-y-4">
                {generalItems.length > 0 ? (
                  <div>
                    <div className="px-2 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">
                      General tasks
                    </div>
                    <div className="mt-2 space-y-2">
                      {generalItems.map((item) => (
                        <Link
                          className="block rounded-[1.25rem] border border-[rgba(194,170,145,0.26)] bg-[rgba(255,255,255,0.62)] px-4 py-3 transition-[transform,border-color,background-color,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:border-[rgba(184,88,51,0.18)] hover:bg-[rgba(255,255,255,0.84)] hover:shadow-[0_10px_22px_rgba(93,64,39,0.08)]"
                          href={item.href}
                          key={item.id}
                          onClick={() => {
                            setIsOpen(false);
                          }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-semibold text-[var(--color-ink)]">{item.title}</div>
                              <div className="mt-1 text-xs text-[var(--color-muted)]">
                                {item.assignedTo} · {item.dueAtLabel !== "Not set" ? `Due ${item.dueAtLabel}` : "No due date"}
                              </div>
                              {item.propertyName ? (
                                <div className="mt-1 text-xs text-[var(--color-muted)]">Property: {item.propertyName}</div>
                              ) : null}
                            </div>
                            <div className="shrink-0 text-right">
                              <div className="rounded-full border border-[var(--color-line)] px-2.5 py-1 text-[0.66rem] font-medium text-[var(--color-muted)]">
                                {item.statusLabel}
                              </div>
                              {item.isOverdue ? (
                                <div className="mt-2 text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-[#8f2f1c]">
                                  Overdue
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null}

                {leadItems.length > 0 ? (
                  <div>
                    <div className="px-2 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">
                      Lead tasks
                    </div>
                    <div className="mt-2 space-y-2">
                      {leadItems.map((item) => (
                        <Link
                          className="block rounded-[1.25rem] border border-[rgba(186,152,110,0.26)] bg-[rgba(255,248,239,0.72)] px-4 py-3 transition-[transform,border-color,background-color,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:border-[rgba(176,129,56,0.24)] hover:bg-[rgba(255,244,230,0.88)] hover:shadow-[0_10px_22px_rgba(117,83,35,0.08)]"
                          href={item.href}
                          key={item.id}
                          onClick={() => {
                            setIsOpen(false);
                          }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-semibold text-[var(--color-ink)]">{item.title}</div>
                              <div className="mt-1 text-xs text-[rgba(110,92,75,0.92)]">
                                {item.leadName ? `Lead: ${item.leadName}` : "Lead-linked task"}
                              </div>
                              <div className="mt-1 text-xs text-[var(--color-muted)]">
                                {item.assignedTo} · {item.dueAtLabel !== "Not set" ? `Due ${item.dueAtLabel}` : "No due date"}
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <div className="rounded-full border border-[var(--color-line)] px-2.5 py-1 text-[0.66rem] font-medium text-[var(--color-muted)]">
                                {item.statusLabel}
                              </div>
                              {item.isOverdue ? (
                                <div className="mt-2 text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-[#8f2f1c]">
                                  Overdue
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
