"use client";

import { useEffect, useRef, useState, type SVGProps } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { appNav } from "@/lib/navigation";
import { RoomflowLogo } from "@/components/roomflow-logo";

type SidebarIconProps = SVGProps<SVGSVGElement>;

function DashboardIcon(props: SidebarIconProps) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" {...props}>
      <path
        d="M4.75 5.75h6.5v6.5h-6.5zm8 0h6.5v4.5h-6.5zm0 6h6.5v6.5h-6.5zm-8 2h6.5v4.5h-6.5z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function AnalyticsIcon(props: SidebarIconProps) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" {...props}>
      <path
        d="M5.75 18.25V13m6.25 5.25V9m6.25 9.25V5.75M4.75 18.25h14.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function LeadsIcon(props: SidebarIconProps) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" {...props}>
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

function InboxIcon(props: SidebarIconProps) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" {...props}>
      <path
        d="M5.75 7.25h12.5v9.5h-3.5l-1.5 2h-2.5l-1.5-2h-3.5z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function PropertiesIcon(props: SidebarIconProps) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" {...props}>
      <path
        d="M4.75 10.25 12 5l7.25 5.25v8h-4.5v-4.5h-5.5v4.5h-4.5z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function CalendarIcon(props: SidebarIconProps) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" {...props}>
      <path
        d="M7.25 4.75v3m9.5-3v3m-11 2.5h12.5m-12 8v-10.5h12.5v10.5z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M9 13h2.25m1.75 0H15m-6 3h2.25m1.75 0H15"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function TasksIcon(props: SidebarIconProps) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" {...props}>
      <path
        d="m7.5 8.5 1.75 1.75L12.5 7m-5 8 1.75 1.75L12.5 14m3-5h3m-3 7h3M5.75 5.75h12.5v12.5H5.75z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function TemplatesIcon(props: SidebarIconProps) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" {...props}>
      <path
        d="M7.25 6.75h9.5m-9.5 4h9.5m-9.5 4h6.5m-8.5 4.5h12.5v-14.5H5.25z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function WorkflowsIcon(props: SidebarIconProps) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" {...props}>
      <path
        d="M7.25 7.25h3.5v3.5h-3.5zm6 0h3.5v3.5h-3.5zm-6 6h3.5v3.5h-3.5zM10.75 9h2.5m-4.25 6.25V10.75m6-1.75v6.25m0 0h-4.25"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function AuditIcon(props: SidebarIconProps) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" {...props}>
      <path
        d="M12 5.25 6.75 7v4.5c0 3.35 2.07 6.43 5.25 7.5 3.18-1.07 5.25-4.15 5.25-7.5V7z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="m10.25 12 1.25 1.25 2.5-2.75"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function SettingsIcon(props: SidebarIconProps) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" {...props}>
      <path
        d="M12 9.25a2.75 2.75 0 1 0 0 5.5 2.75 2.75 0 0 0 0-5.5Zm7 2.75-1.78-.6a5.78 5.78 0 0 0-.46-1.1l.83-1.68-1.94-1.94-1.68.83c-.35-.19-.72-.34-1.1-.46L12 5l-2.87.75c-.38.12-.75.27-1.1.46l-1.68-.83-1.94 1.94.83 1.68c-.19.35-.34.72-.46 1.1L5 12l.75 2.87c.12.38.27.75.46 1.1l-.83 1.68 1.94 1.94 1.68-.83c.35.19.72.34 1.1.46L12 19l2.87-.75c.38-.12.75-.27 1.1-.46l1.68.83 1.94-1.94-.83-1.68c.19-.35.34-.72.46-1.1z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function CollapseSidebarIcon(props: SidebarIconProps) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" {...props}>
      <path
        d="M14.75 6.75 9.5 12l5.25 5.25"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function ExpandSidebarIcon(props: SidebarIconProps) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" {...props}>
      <path
        d="m9.25 6.75 5.25 5.25-5.25 5.25"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function ScrollHintUpIcon(props: SidebarIconProps) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 16 16" {...props}>
      <path
        d="m4.25 9.75 3.75-3.75 3.75 3.75"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function ScrollHintDownIcon(props: SidebarIconProps) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 16 16" {...props}>
      <path
        d="m4.25 6.25 3.75 3.75 3.75-3.75"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

const navIcons = {
  analytics: AnalyticsIcon,
  audit: AuditIcon,
  calendar: CalendarIcon,
  dashboard: DashboardIcon,
  inbox: InboxIcon,
  leads: LeadsIcon,
  properties: PropertiesIcon,
  settings: SettingsIcon,
  tasks: TasksIcon,
  templates: TemplatesIcon,
  workflows: WorkflowsIcon,
} as const;

export function AppSidebar({
  isCollapsed,
  onToggleCollapse,
}: {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const pathname = usePathname();
  const SidebarToggleIcon = isCollapsed ? ExpandSidebarIcon : CollapseSidebarIcon;
  const navRef = useRef<HTMLElement | null>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  useEffect(() => {
    const navElement = navRef.current;

    if (!navElement) {
      return;
    }

    const updateScrollAffordances = () => {
      const nextCanScrollUp = navElement.scrollTop > 6;
      const nextCanScrollDown =
        navElement.scrollTop + navElement.clientHeight < navElement.scrollHeight - 6;

      setCanScrollUp(nextCanScrollUp);
      setCanScrollDown(nextCanScrollDown);
    };

    updateScrollAffordances();

    navElement.addEventListener("scroll", updateScrollAffordances, { passive: true });

    const resizeObserver = new ResizeObserver(() => {
      updateScrollAffordances();
    });

    resizeObserver.observe(navElement);

    return () => {
      navElement.removeEventListener("scroll", updateScrollAffordances);
      resizeObserver.disconnect();
    };
  }, [isCollapsed]);

  return (
    <aside
      className={`flex h-full w-full min-w-0 flex-col bg-[var(--color-sidebar)] pt-6 pb-5 text-[var(--color-sidebar-ink)] transition-[padding,background-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        isCollapsed ? "overflow-visible" : "overflow-hidden"
      } ${
        isCollapsed ? "px-3" : "px-4"
      }`}
      data-app-sidebar
    >
      <div
        className={`transition-[gap] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isCollapsed ? "flex flex-col items-center gap-3" : "space-y-5"
        }`}
      >
        <div
          aria-hidden={isCollapsed}
          className={`min-w-0 overflow-hidden rounded-[1.75rem] border border-[rgba(248,243,235,0.12)] bg-[rgba(248,243,235,0.06)] transition-[max-height,opacity,transform,padding,background-color,border-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isCollapsed
              ? "max-h-0 -translate-y-2 opacity-0"
              : "max-h-80 translate-y-0 opacity-100 px-4 py-4 delay-75"
          }`}
          data-sidebar-header-copy
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <RoomflowLogo className="h-11 w-11 shrink-0" />
              <div className="text-[0.68rem] uppercase tracking-[0.28em] text-[rgba(248,243,235,0.55)]">
                Roomflow
              </div>
            </div>
            <div className="mt-4 max-w-[15rem] text-[1.7rem] font-semibold leading-[1.02] tracking-[-0.03em] text-white">
              Qualification Ops
            </div>
            <p className="mt-3 max-w-[15rem] text-[0.9rem] leading-6 text-[rgba(248,243,235,0.72)]">
              Shared-housing workflow for sorting inbound inquiries into the next
              correct action.
            </p>
          </div>
        </div>

        {isCollapsed ? (
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-[1.2rem] border border-[rgba(248,243,235,0.14)] bg-[rgba(248,243,235,0.08)] text-sm font-semibold tracking-[0.18em] text-white transition-[transform,opacity,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]">
            <RoomflowLogo className="h-9 w-9" compact />
          </div>
        ) : null}
      </div>

      <div className="relative mt-6 min-h-0 flex-1 overflow-visible">
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-x-0 top-0 z-10 h-12 rounded-t-[1.4rem] bg-[linear-gradient(to_bottom,rgba(15,37,46,0.98),rgba(19,45,56,0.9)_38%,rgba(24,52,63,0.4)_72%,transparent)] transition-opacity duration-200 ease-out ${
            canScrollUp ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="mx-auto mt-2 flex w-fit items-center gap-2 rounded-full border border-[rgba(248,243,235,0.12)] bg-[rgba(248,243,235,0.06)] px-3 py-1 backdrop-blur-sm">
            <span className="h-[3px] w-[3px] rounded-full bg-[rgba(248,243,235,0.58)]" />
            <span className="flex items-center gap-1.5">
              <span className="h-px w-6 rounded-full bg-[rgba(248,243,235,0.3)]" />
              <ScrollHintUpIcon className="h-3.5 w-3.5 text-[rgba(248,243,235,0.72)]" />
              <span className="h-px w-6 rounded-full bg-[rgba(248,243,235,0.3)]" />
            </span>
            <span className="h-[3px] w-[3px] rounded-full bg-[rgba(248,243,235,0.58)]" />
          </div>
        </div>
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 h-12 rounded-b-[1.4rem] bg-[linear-gradient(to_top,rgba(15,37,46,0.99),rgba(19,45,56,0.92)_38%,rgba(24,52,63,0.45)_72%,transparent)] transition-opacity duration-200 ease-out ${
            canScrollDown ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="mx-auto mt-6 flex w-fit items-center gap-2 rounded-full border border-[rgba(248,243,235,0.12)] bg-[rgba(248,243,235,0.06)] px-3 py-1 backdrop-blur-sm">
            <span className="h-[3px] w-[3px] rounded-full bg-[rgba(248,243,235,0.58)]" />
            <span className="flex items-center gap-1.5">
              <span className="h-px w-6 rounded-full bg-[rgba(248,243,235,0.3)]" />
              <ScrollHintDownIcon className="h-3.5 w-3.5 text-[rgba(248,243,235,0.72)]" />
              <span className="h-px w-6 rounded-full bg-[rgba(248,243,235,0.3)]" />
            </span>
            <span className="h-[3px] w-[3px] rounded-full bg-[rgba(248,243,235,0.58)]" />
          </div>
        </div>
        <nav
          ref={navRef}
          className={`min-h-0 h-full scroll-smooth pb-2 [scrollbar-gutter:stable] ${
            isCollapsed ? "flex flex-col items-center gap-2" : "flex flex-col gap-2.5"
          }`}
          style={{
            overflowX: "visible",
            overflowY: "auto",
          }}
          data-sidebar-nav-scroll-container
          id="app-sidebar-navigation"
        >
          {appNav.map((item) => {
          const Icon = navIcons[item.icon as keyof typeof navIcons];
          const isActive =
            pathname === item.href ||
            (item.href !== "/app" && pathname.startsWith(item.href));

          return (
            <Link
              aria-current={isActive ? "page" : undefined}
              aria-label={`${item.label}: ${item.description}`}
              key={item.href}
              href={item.href}
              prefetch={false}
              title={isCollapsed ? item.label : undefined}
              className={`group relative block border transition-[transform,background-color,border-color,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:translate-y-px active:scale-[0.985] ${
                isActive
                  ? "border-[rgba(248,243,235,0.18)] bg-[rgba(248,243,235,0.12)] shadow-[0_14px_28px_rgba(7,16,21,0.18)]"
                  : "border-transparent bg-transparent hover:-translate-y-0.5 hover:border-[rgba(248,243,235,0.12)] hover:bg-[rgba(248,243,235,0.06)] hover:shadow-[0_10px_22px_rgba(7,16,21,0.14)]"
              } ${isCollapsed ? "h-14 w-14 overflow-visible rounded-[1.35rem] px-0 py-0" : "min-h-[5.5rem] w-full overflow-hidden rounded-[1.55rem] px-3 py-3"}`}
            >
              <div
                aria-hidden="true"
                className={`absolute rounded-full bg-[rgba(248,243,235,0.82)] transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  isActive
                    ? "scale-y-100 opacity-100"
                    : "scale-y-50 opacity-0 group-hover:scale-y-75 group-hover:opacity-65"
                } ${isCollapsed ? "left-1.5 inset-y-3 w-1" : "hidden"}`}
              />
              <div
                aria-hidden="true"
                className={`absolute inset-0 bg-[linear-gradient(135deg,rgba(248,243,235,0.1),transparent_55%)] transition-opacity duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                } ${isCollapsed ? "rounded-[1.35rem]" : "rounded-[1.55rem]"}`}
              />
              <div
                className={`relative flex h-full transition-[gap,padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  isCollapsed
                    ? "items-center justify-center"
                    : "items-center gap-3"
                }`}
              >
                {!isCollapsed ? (
                  <div className="flex h-11 w-2 shrink-0 items-center justify-center">
                    <span
                      aria-hidden="true"
                      className={`block h-9 w-[3px] rounded-full bg-[rgba(248,243,235,0.82)] transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                        isActive
                          ? "scale-y-100 opacity-100"
                          : "scale-y-50 opacity-0 group-hover:scale-y-75 group-hover:opacity-65"
                      }`}
                    />
                  </div>
                ) : null}
                <div
                  className={`inline-flex shrink-0 items-center justify-center border transition-[transform,background-color,border-color,color,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04] group-active:scale-[0.98] ${
                    isActive
                      ? "border-[rgba(248,243,235,0.16)] bg-[rgba(248,243,235,0.14)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                      : "border-[rgba(248,243,235,0.1)] bg-[rgba(248,243,235,0.04)] text-[rgba(248,243,235,0.82)] group-hover:border-[rgba(248,243,235,0.16)] group-hover:bg-[rgba(248,243,235,0.08)] group-hover:text-white"
                  } ${isCollapsed ? "h-10 w-10 rounded-[1rem] self-center" : "h-11 w-11 rounded-[1.1rem]"}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                {!isCollapsed ? (
                  <div className="min-w-0 flex-1 pr-1">
                    <div className="truncate text-[1.08rem] font-medium leading-5 text-white transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-0.5">
                      {item.label}
                    </div>
                    <div className="mt-1.5 max-w-[15rem] text-[0.82rem] leading-5 text-[rgba(248,243,235,0.68)] transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:text-[rgba(248,243,235,0.78)]">
                      {item.description}
                    </div>
                  </div>
                ) : null}
                {isCollapsed ? (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute left-full top-1/2 z-40 ml-3 w-56 -translate-y-1/2 translate-x-1 rounded-2xl border border-[rgba(248,243,235,0.16)] bg-[rgba(18,33,41,0.96)] px-4 py-3 text-left opacity-0 shadow-[0_16px_36px_rgba(7,16,21,0.28)] backdrop-blur-md transition-[opacity,transform] duration-200 ease-out group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100"
                  >
                    <div className="text-sm font-semibold text-[rgba(248,243,235,0.96)]">
                      {item.label}
                    </div>
                    <div className="mt-1 text-xs leading-5 text-[rgba(248,243,235,0.72)]">
                      {item.description}
                    </div>
                  </div>
                ) : null}
              </div>
            </Link>
          );
          })}
        </nav>
      </div>

      <div className={`mt-4 shrink-0 ${isCollapsed ? "flex justify-center" : ""}`}>
        <button
          aria-controls="app-sidebar-navigation"
          aria-expanded={!isCollapsed}
          aria-label={isCollapsed ? "Expand menu" : "Collapse menu"}
          className={`group/toggle relative inline-flex h-12 shrink-0 cursor-pointer items-center justify-center rounded-[1.35rem] border border-[rgba(248,243,235,0.14)] bg-[rgba(248,243,235,0.08)] text-[rgba(248,243,235,0.82)] transition-[transform,background-color,color,border-color,box-shadow,width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:border-[rgba(248,243,235,0.22)] hover:bg-[rgba(248,243,235,0.14)] hover:text-white hover:shadow-[0_12px_24px_rgba(7,16,21,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(248,243,235,0.26)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-sidebar)] active:translate-y-px active:scale-95 ${isCollapsed ? "w-12" : "w-full px-1"}`}
          onClick={onToggleCollapse}
          type="button"
        >
          <span className="pointer-events-none absolute inset-0 rounded-[1.35rem] bg-[linear-gradient(135deg,rgba(248,243,235,0.08),transparent_65%)] opacity-0 transition-opacity duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/toggle:opacity-100" />
          <span className={`relative flex w-full items-center ${isCollapsed ? "justify-center" : "justify-between gap-3 px-4"}`}>
            <SidebarToggleIcon className={`h-5 w-5 shrink-0 transition-[transform,color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${isCollapsed ? "translate-x-px group-hover/toggle:translate-x-0.5" : "-translate-x-px group-hover/toggle:-translate-x-0.5"}`} />
            {isCollapsed ? null : (
              <span className="text-sm font-medium text-[rgba(248,243,235,0.88)]">Collapse menu</span>
            )}
          </span>
        </button>
      </div>
    </aside>
  );
}
