import type { ReactNode } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { LogoutButton } from "@/components/logout-button";

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
  return (
    <div className="min-h-screen bg-transparent text-[var(--color-ink)] md:grid md:grid-cols-[280px_1fr]">
      <div className="hidden md:block md:sticky md:top-0 md:h-screen">
        <AppSidebar
          workspaceName={workspaceName}
          workspaceSummary={workspaceSummary}
        />
      </div>
      <div className="flex min-h-screen flex-col">
        <div className="px-5 py-5 md:px-8 md:py-8">
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
        <div className="flex-1 overflow-y-auto px-5 pb-5 md:px-8 md:pb-8">
          {children}
        </div>
      </div>
    </div>
  );
}
