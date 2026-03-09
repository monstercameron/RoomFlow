"use client";

import Link from "next/link";
import type { ReactNode, SVGProps } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { NotificationCenter } from "@/components/notification-center";
import { LogoutButton } from "@/components/logout-button";
import { ScrollToTopButton } from "@/components/scroll-to-top-button";
import { TaskCenter } from "@/components/task-center";

function ProfileIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" className="h-4.5 w-4.5">
      <path
        d="M12 12.25a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Zm-5.75 6c.45-2.38 2.69-4 5.75-4s5.3 1.62 5.75 4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function ChevronDownIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 20 20" {...props}>
      <path
        d="m5.75 8 4.25 4.25L14.25 8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function SettingsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 20 20" {...props}>
      <path
        d="M8.17 3.68a1.5 1.5 0 0 1 2.66 0l.27.54a1.5 1.5 0 0 0 1.06.79l.6.12a1.5 1.5 0 0 1 1.03 2.24l-.33.52a1.5 1.5 0 0 0 0 1.61l.33.52a1.5 1.5 0 0 1-1.03 2.24l-.6.12a1.5 1.5 0 0 0-1.06.79l-.27.54a1.5 1.5 0 0 1-2.66 0l-.27-.54a1.5 1.5 0 0 0-1.06-.79l-.6-.12a1.5 1.5 0 0 1-1.03-2.24l.33-.52a1.5 1.5 0 0 0 0-1.61l-.33-.52a1.5 1.5 0 0 1 1.03-2.24l.6-.12a1.5 1.5 0 0 0 1.06-.79l.27-.54Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
      <path
        d="M12 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function SecurityIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 20 20" {...props}>
      <path
        d="M10 3.5 5.75 5v3.6c0 3.04 1.8 5.8 4.58 7.03L10 15.8l-.33-.17A7.75 7.75 0 0 1 5.75 8.6V5L10 3.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <path
        d="M8.35 9.85 9.4 10.9l2.35-2.35"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function getUserInitials(params: {
  email: string;
  name?: string | null;
}) {
  const trimmedName = params.name?.trim();

  if (trimmedName) {
    const initials = trimmedName
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("");

    if (initials) {
      return initials;
    }
  }

  const emailLocalPart = params.email.split("@")[0]?.trim() ?? "";

  return emailLocalPart.slice(0, 2).toUpperCase() || "U";
}

export function AppShell({
  children,
  notifications,
  taskCenter,
  userImage,
  userLabel,
  userName,
  userRoleLabel,
  workspaceMetrics,
  workspaceName,
  workspacePlanLabel,
  workspacePlanStatusLabel,
  workspaceSummary,
}: {
  children: ReactNode;
  notifications: {
    items: Array<{
      body: string;
      categoryKey: "all" | "new_leads" | "review_alerts" | "tour_updates" | "other";
      categoryLabel: string;
      createdAtLabel: string;
      href: string | null;
      id: string;
      isUnread: boolean;
      title: string;
      typeLabel: string;
    }>;
    unreadCount: number;
  };
  taskCenter: {
    generalTaskCount: number;
    items: Array<{
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
    }>;
    leadTaskCount: number;
    overdueTaskCount: number;
    totalOpenCount: number;
  };
  userImage?: string | null;
  userLabel: string;
  userName?: string | null;
  userRoleLabel: string;
  workspaceMetrics: {
    activeLeadCount: number;
    propertyCount: number;
    qualifiedLeadCount: number;
  };
  workspaceName: string;
  workspacePlanLabel: string;
  workspacePlanStatusLabel: string;
  workspaceSummary: string;
}) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const accountMenuId = useId();
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const userInitials = getUserInitials({
    email: userLabel,
    name: userName,
  });

  useEffect(() => {
    if (!isAccountMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setIsAccountMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsAccountMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isAccountMenuOpen]);

  return (
    <div
      className="h-screen overflow-hidden bg-transparent text-[var(--color-ink)] md:flex"
    >
      <div
        className="hidden min-w-0 shrink-0 transition-[width,flex-basis] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] md:block md:sticky md:top-0 md:h-screen"
        style={{
          flexBasis: isSidebarCollapsed ? "84px" : "304px",
          width: isSidebarCollapsed ? "84px" : "304px",
        }}
      >
        <AppSidebar
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => {
            setIsSidebarCollapsed((currentValue) => !currentValue);
          }}
        />
      </div>
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto" data-app-scroll-container>
        <div className="px-5 pt-5 md:px-8 md:pt-8">
          <div className="relative z-30 mb-6 flex flex-col gap-4 overflow-visible rounded-3xl border border-[rgba(194,170,145,0.34)] bg-[linear-gradient(135deg,rgba(255,251,246,0.96),rgba(249,241,232,0.98)_52%,rgba(244,231,220,0.96))] px-5 py-4 shadow-[0_24px_60px_rgba(93,64,39,0.1)] backdrop-blur isolate before:absolute before:inset-y-0 before:right-[-8%] before:w-[28rem] before:bg-[radial-gradient(circle_at_center,rgba(184,88,51,0.1),transparent_68%)] before:content-empty lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="text-xs uppercase tracking-[0.25em] text-[rgba(123,101,81,0.95)]">
                Shared-Housing Qualifier
              </div>
              <div className="mt-1 truncate text-lg font-semibold text-[var(--color-ink)]">{workspaceName}</div>
              <div className="mt-1 text-sm text-[rgba(108,91,75,0.92)]">
                {workspaceSummary}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[rgba(110,92,75,0.92)]">
                <Link
                  className="inline-flex items-center gap-2 rounded-2xl border border-[rgba(184,88,51,0.2)] bg-[linear-gradient(180deg,rgba(255,232,220,0.95),rgba(248,220,206,0.96))] px-3 py-2 font-medium text-[var(--color-accent-strong)] shadow-[0_10px_22px_rgba(141,63,33,0.08)] transition-[transform,border-color,background-color,color,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:border-[rgba(184,88,51,0.3)] hover:bg-[linear-gradient(180deg,rgba(255,224,211,1),rgba(244,209,193,1))] hover:shadow-[0_12px_26px_rgba(141,63,33,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(184,88,51,0.24)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-panel)]"
                  href="/app/settings"
                >
                  <span className="font-semibold">{workspacePlanLabel}</span>
                  <span className="text-[rgba(110,92,75,0.92)]">{workspacePlanStatusLabel}</span>
                </Link>
                <Link
                  className="inline-flex items-center gap-2 rounded-2xl border border-[rgba(187,164,137,0.24)] bg-[linear-gradient(180deg,rgba(255,250,244,0.95),rgba(247,239,230,0.98))] px-3 py-2 shadow-[0_8px_18px_rgba(93,64,39,0.06)] transition-[transform,border-color,background-color,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:border-[rgba(184,88,51,0.2)] hover:bg-[linear-gradient(180deg,rgba(255,247,239,1),rgba(244,233,221,1))] hover:shadow-[0_12px_24px_rgba(93,64,39,0.1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(184,88,51,0.24)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-panel)]"
                  href="/app/properties"
                >
                  <span className="font-semibold text-[var(--color-ink)]">{workspaceMetrics.propertyCount}</span>
                  <span>Properties</span>
                </Link>
                <Link
                  className="inline-flex items-center gap-2 rounded-2xl border border-[rgba(198,157,112,0.26)] bg-[linear-gradient(180deg,rgba(255,248,236,0.96),rgba(247,235,214,0.98))] px-3 py-2 shadow-[0_8px_18px_rgba(121,88,37,0.07)] transition-[transform,border-color,background-color,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:border-[rgba(177,128,56,0.28)] hover:bg-[linear-gradient(180deg,rgba(255,244,226,1),rgba(243,227,198,1))] hover:shadow-[0_12px_24px_rgba(121,88,37,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(184,88,51,0.24)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-panel)]"
                  href="/app/leads"
                >
                  <span className="font-semibold text-[var(--color-ink)]">{workspaceMetrics.activeLeadCount}</span>
                  <span>Active leads</span>
                </Link>
                <Link
                  className="inline-flex items-center gap-2 rounded-2xl border border-[rgba(178,146,98,0.28)] bg-[linear-gradient(180deg,rgba(255,244,231,0.96),rgba(243,227,202,0.98))] px-3 py-2 shadow-[0_8px_18px_rgba(117,83,35,0.08)] transition-[transform,border-color,background-color,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:border-[rgba(160,112,42,0.32)] hover:bg-[linear-gradient(180deg,rgba(255,239,221,1),rgba(239,219,187,1))] hover:shadow-[0_12px_24px_rgba(117,83,35,0.13)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(184,88,51,0.24)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-panel)]"
                  href="/app/leads?filter=qualified"
                >
                  <span className="font-semibold text-[var(--color-ink)]">{workspaceMetrics.qualifiedLeadCount}</span>
                  <span>Qualified or tour-ready</span>
                </Link>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 lg:justify-end">
              <TaskCenter
                generalTaskCount={taskCenter.generalTaskCount}
                items={taskCenter.items}
                leadTaskCount={taskCenter.leadTaskCount}
                overdueTaskCount={taskCenter.overdueTaskCount}
                totalOpenCount={taskCenter.totalOpenCount}
              />
              <NotificationCenter
                items={notifications.items}
                unreadCount={notifications.unreadCount}
              />
              <div className="relative z-40" ref={accountMenuRef}>
                <button
                  aria-controls={accountMenuId}
                  aria-expanded={isAccountMenuOpen}
                  aria-haspopup="menu"
                  className="flex min-h-11 max-w-[20rem] min-w-0 items-center gap-3 rounded-2xl border border-[rgba(191,164,139,0.3)] bg-[linear-gradient(180deg,rgba(255,249,243,0.96),rgba(245,234,223,0.98))] px-4 py-2.5 text-left text-sm text-[rgba(108,91,75,0.92)] shadow-[0_14px_30px_rgba(93,64,39,0.09)] transition-[transform,border-color,background-color,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:border-[rgba(184,88,51,0.2)] hover:bg-[linear-gradient(180deg,rgba(255,246,238,1),rgba(242,228,214,1))] hover:shadow-[0_18px_34px_rgba(93,64,39,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(184,88,51,0.3)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-panel)]"
                  onClick={() => {
                    setIsAccountMenuOpen((currentValue) => !currentValue);
                  }}
                  title={userLabel}
                  type="button"
                >
                  <div className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[rgba(28,26,22,0.08)] bg-[linear-gradient(135deg,rgba(184,88,51,0.16),rgba(141,63,33,0.08))] text-[0.72rem] font-semibold text-[var(--color-accent-strong)]">
                    {userImage ? (
                      <img
                        alt={userName ? `${userName} profile photo` : `${userLabel} profile photo`}
                        className="h-full w-full object-cover"
                        referrerPolicy="no-referrer"
                        src={userImage}
                      />
                    ) : userInitials ? (
                      <span>{userInitials}</span>
                    ) : (
                      <span className="text-[var(--color-accent-strong)]">
                        <ProfileIcon />
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    {userName ? (
                      <div className="truncate text-[0.78rem] font-semibold text-[var(--color-ink)]">
                        {userName}
                      </div>
                    ) : null}
                    <div className="truncate font-semibold">{userLabel}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                      <span className="rounded-full bg-[rgba(184,88,51,0.12)] px-2.5 py-1 text-[var(--color-accent-strong)]">
                        {userRoleLabel}
                      </span>
                      {notifications.unreadCount > 0 ? (
                        <span className="rounded-full border border-[var(--color-line)] px-2.5 py-1">
                          {notifications.unreadCount} unread
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <ChevronDownIcon
                    className={`h-4 w-4 shrink-0 text-[var(--color-muted)] transition-transform duration-200 ${
                      isAccountMenuOpen ? "rotate-180" : "rotate-0"
                    }`}
                  />
                </button>

                {isAccountMenuOpen ? (
                  <div
                    className="absolute right-0 top-[calc(100%+0.75rem)] z-[80] w-[min(22rem,calc(100vw-2.5rem))] overflow-hidden rounded-[1.6rem] border border-[rgba(194,170,145,0.34)] bg-[linear-gradient(180deg,rgba(255,251,246,0.98),rgba(246,237,227,0.98))] shadow-[0_24px_54px_rgba(62,43,28,0.16)] backdrop-blur-xl"
                    id={accountMenuId}
                    role="menu"
                  >
                    <div className="border-b border-[var(--color-line)] px-5 py-4">
                      <div className="text-sm font-semibold text-[var(--color-ink)]">Account</div>
                      <div className="mt-1 text-xs text-[var(--color-muted)]">
                        Jump to identity and session settings.
                      </div>
                    </div>
                    <div className="px-3 py-3">
                      <Link
                        className="flex items-start gap-3 rounded-[1.2rem] px-4 py-3 text-sm transition-[transform,background-color] duration-200 ease-out hover:-translate-y-0.5 hover:bg-[rgba(255,255,255,0.72)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(184,88,51,0.22)]"
                        href="/app/settings"
                        onClick={() => {
                          setIsAccountMenuOpen(false);
                        }}
                        role="menuitem"
                      >
                        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-[var(--color-line)] bg-[rgba(255,255,255,0.7)] text-[var(--color-accent-strong)]">
                          <SettingsIcon className="h-4.5 w-4.5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold text-[var(--color-ink)]">Profile and workspace</span>
                          <span className="mt-1 block text-[var(--color-muted)]">Review identity details, role, workspace plan, and billing context.</span>
                        </span>
                      </Link>
                      <Link
                        className="mt-1 flex items-start gap-3 rounded-[1.2rem] px-4 py-3 text-sm transition-[transform,background-color] duration-200 ease-out hover:-translate-y-0.5 hover:bg-[rgba(255,255,255,0.72)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(184,88,51,0.22)]"
                        href="/app/settings/security"
                        onClick={() => {
                          setIsAccountMenuOpen(false);
                        }}
                        role="menuitem"
                      >
                        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-[var(--color-line)] bg-[rgba(255,255,255,0.7)] text-[var(--color-accent-strong)]">
                          <SecurityIcon className="h-4.5 w-4.5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold text-[var(--color-ink)]">Security and sessions</span>
                          <span className="mt-1 block text-[var(--color-muted)]">Manage linked accounts, password access, and active device sessions.</span>
                        </span>
                      </Link>
                    </div>
                  </div>
                ) : null}
              </div>
              <LogoutButton />
            </div>
          </div>
        </div>
        <div className="px-5 pb-5 md:px-8 md:pb-8">
          {children}
        </div>
      </div>
      <ScrollToTopButton />
    </div>
  );
}
