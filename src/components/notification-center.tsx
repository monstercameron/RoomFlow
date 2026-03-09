"use client";

import { useEffect, useId, useRef, useState, useTransition, type SVGProps } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  markAllHeaderNotificationsRead,
  markHeaderNotificationRead,
} from "@/app/(app)/app/notification-center-actions";

type NotificationFilterKey = "all" | "new_leads" | "review_alerts" | "tour_updates" | "other";

type NotificationCenterItem = {
  body: string;
  categoryKey: NotificationFilterKey;
  categoryLabel: string;
  createdAtLabel: string;
  href: string | null;
  id: string;
  isUnread: boolean;
  title: string;
  typeLabel: string;
};

function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 16 16" {...props}>
      <path
        d="m3.75 8.25 2.5 2.5 6-6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function BellIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" {...props}>
      <path
        d="M12 5.75a4.25 4.25 0 0 0-4.25 4.25v2.18c0 .9-.28 1.78-.81 2.52L5.75 16.5h12.5l-1.19-1.8a4.5 4.5 0 0 1-.81-2.52V10A4.25 4.25 0 0 0 12 5.75Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M9.75 18a2.25 2.25 0 0 0 4.5 0"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

export function NotificationCenter({
  items,
  unreadCount,
}: {
  items: NotificationCenterItem[];
  unreadCount: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<NotificationFilterKey>("all");
  const [isPending, startTransition] = useTransition();
  const panelId = useId();
  const router = useRouter();
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

  const unreadBadgeLabel = unreadCount > 99 ? "99+" : String(unreadCount);
  const availableFilters = [
    { key: "all", label: "All" },
    ...Array.from(
      new Map(
        items
          .filter((item) => item.categoryKey !== "all")
          .map((item) => [item.categoryKey, { key: item.categoryKey, label: item.categoryLabel }]),
      ).values(),
    ),
  ] as Array<{ key: NotificationFilterKey; label: string }>;
  const filteredItems =
    activeFilter === "all"
      ? items
      : items.filter((item) => item.categoryKey === activeFilter);
  const unreadItems = filteredItems.filter((item) => item.isUnread);
  const earlierItems = filteredItems.filter((item) => !item.isUnread);

  const renderNotificationRow = (item: NotificationCenterItem) => {
    const body = (
      <>
        <div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${item.isUnread ? "bg-[var(--color-accent)] opacity-80" : "bg-[rgba(28,26,22,0.16)]"}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[0.68rem] uppercase tracking-[0.18em] text-[var(--color-muted)]">
            <span>{item.typeLabel}</span>
            <span className="h-1 w-1 rounded-full bg-[rgba(28,26,22,0.18)]" />
            <span className="tracking-normal normal-case">{item.createdAtLabel}</span>
          </div>
          <div className="mt-1 text-sm font-semibold leading-5 text-[var(--color-ink)]">
            {item.title}
          </div>
          <div className="mt-1 text-sm leading-5 text-[var(--color-muted)]">
            {item.body}
          </div>
        </div>
      </>
    );

    const containerClasses = `group flex items-start gap-3 rounded-[1.3rem] border px-4 py-3 transition-[transform,border-color,background-color,box-shadow] duration-200 ease-out ${
      item.isUnread
        ? "border-[rgba(184,88,51,0.18)] bg-[rgba(184,88,51,0.08)]"
        : "border-transparent bg-transparent"
    }`;

    return (
      <div className={containerClasses} key={item.id}>
        {item.href ? (
          <Link
            className="flex min-w-0 flex-1 items-start gap-3 rounded-[1rem] pr-2 hover:-translate-y-0.5"
            href={item.href}
            onClick={() => {
              if (item.isUnread) {
                startTransition(async () => {
                  await markHeaderNotificationRead(item.id);
                });
              }
              setIsOpen(false);
            }}
          >
            {body}
          </Link>
        ) : (
          <div className="flex min-w-0 flex-1 items-start gap-3 pr-2">{body}</div>
        )}
        {item.isUnread ? (
          <button
            aria-label={`Mark ${item.title} as read`}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[rgba(28,26,22,0.1)] bg-white text-[var(--color-muted)] transition-[transform,border-color,background-color,color] duration-200 ease-out hover:-translate-y-0.5 hover:border-[rgba(28,26,22,0.18)] hover:text-[var(--color-ink)] disabled:cursor-wait disabled:opacity-50"
            disabled={isPending}
            onClick={() => {
              startTransition(async () => {
                await markHeaderNotificationRead(item.id);
                router.refresh();
              });
            }}
            type="button"
          >
            <CheckIcon className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    );
  };

  return (
    <div className="relative z-40" ref={rootRef}>
      <button
        aria-controls={panelId}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        className="group relative inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[rgba(191,164,139,0.3)] bg-[linear-gradient(180deg,rgba(255,249,243,0.96),rgba(244,232,220,0.98))] text-[rgba(108,91,75,0.92)] shadow-[0_14px_30px_rgba(93,64,39,0.08)] transition-[transform,border-color,background-color,color,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:border-[rgba(184,88,51,0.22)] hover:bg-[linear-gradient(180deg,rgba(255,245,237,1),rgba(241,226,212,1))] hover:text-[var(--color-ink)] hover:shadow-[0_18px_34px_rgba(93,64,39,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(184,88,51,0.3)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-panel)] active:translate-y-px"
        onClick={() => {
          setIsOpen((currentValue) => !currentValue);
        }}
        type="button"
      >
        <BellIcon className="h-5 w-5" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-[var(--color-accent)] px-1.5 py-0.5 text-[0.68rem] font-semibold leading-none text-white shadow-[0_8px_18px_rgba(184,88,51,0.28)]">
            {unreadBadgeLabel}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div
          className="absolute right-0 top-[calc(100%+0.75rem)] z-[80] w-[min(24rem,calc(100vw-2.5rem))] overflow-hidden rounded-[1.6rem] border border-[var(--color-line)] bg-[rgba(255,250,243,0.94)] shadow-[0_24px_54px_rgba(62,43,28,0.16)] backdrop-blur-xl"
          id={panelId}
          role="dialog"
        >
          <div className="border-b border-[var(--color-line)] px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-[var(--color-ink)]">Notifications</div>
                <div className="mt-1 text-xs text-[var(--color-muted)]">
                  {unreadCount > 0 ? `${unreadCount} unread updates` : "All caught up"}
                </div>
              </div>
              <Link
                className="text-xs font-medium text-[var(--color-accent-strong)] underline decoration-transparent underline-offset-4 transition-colors hover:decoration-current"
                href="/app/inbox"
                onClick={() => {
                  setIsOpen(false);
                }}
              >
                Open inbox
              </Link>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {availableFilters.map((filter) => (
                <button
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-[border-color,background-color,color] duration-200 ease-out ${
                    activeFilter === filter.key
                      ? "border-[rgba(184,88,51,0.2)] bg-[rgba(184,88,51,0.1)] text-[var(--color-accent-strong)]"
                      : "border-[var(--color-line)] bg-[rgba(255,255,255,0.55)] text-[var(--color-muted)] hover:border-[rgba(28,26,22,0.16)] hover:text-[var(--color-ink)]"
                  }`}
                  key={filter.key}
                  onClick={() => {
                    setActiveFilter(filter.key);
                  }}
                  type="button"
                >
                  {filter.label}
                </button>
              ))}
              {unreadCount > 0 ? (
                <button
                  className="ml-auto text-xs font-medium text-[var(--color-accent-strong)] transition-opacity hover:opacity-80 disabled:cursor-wait disabled:opacity-50"
                  disabled={isPending}
                  onClick={() => {
                    startTransition(async () => {
                      await markAllHeaderNotificationsRead();
                      router.refresh();
                    });
                  }}
                  type="button"
                >
                  Mark all as read
                </button>
              ) : null}
            </div>
          </div>

          {items.length === 0 ? (
            <div className="px-5 py-8 text-sm text-[var(--color-muted)]">
              No notifications yet for this workspace.
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="px-5 py-8 text-sm text-[var(--color-muted)]">
              No notifications match this filter.
            </div>
          ) : (
            <div className="max-h-[26rem] overflow-y-auto px-3 py-3">
              <div className="flex flex-col gap-4">
                {unreadItems.length > 0 ? (
                  <div>
                    <div className="px-2 pb-2 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[var(--color-muted)]">
                      Unread
                    </div>
                    <div className="flex flex-col gap-2">{unreadItems.map(renderNotificationRow)}</div>
                  </div>
                ) : null}
                {earlierItems.length > 0 ? (
                  <div>
                    <div className="px-2 pb-2 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[var(--color-muted)]">
                      Earlier
                    </div>
                    <div className="flex flex-col gap-2">{earlierItems.map(renderNotificationRow)}</div>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}