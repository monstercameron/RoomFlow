"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { LogoutButton } from "@/components/logout-button";
import { ScrollToTopButton } from "@/components/scroll-to-top-button";

export function AppShell({
  children,
  userLabel,
  workspaceName,
  workspaceSummary,
}: {
  children: ReactNode;
  userLabel: string;
  workspaceName: string;
  workspaceSummary: string;
}) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

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
          <div className="mb-6 flex items-center justify-between rounded-3xl border border-[var(--color-line)] bg-[var(--color-panel)] px-5 py-4 shadow-[var(--shadow-panel)] backdrop-blur">
            <div>
              <div className="text-xs uppercase tracking-[0.25em] text-[var(--color-muted)]">
                Shared-Housing Qualifier
              </div>
              <div className="mt-1 text-lg font-semibold">{workspaceName}</div>
              <div className="mt-1 text-sm text-[var(--color-muted)]">
                {workspaceSummary}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-full border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-2 text-sm text-[var(--color-muted)]">
                {userLabel}
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
