"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { appNav } from "@/lib/navigation";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";

export function AppSidebar({
  activeWorkspaceId,
  workspaceOptions,
  workspaceName,
  workspaceSummary,
}: {
  activeWorkspaceId: string;
  workspaceOptions: Array<{
    membershipRole: string;
    workspaceId: string;
    workspaceName: string;
    workspaceSlug: string;
  }>;
  workspaceName: string;
  workspaceSummary: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full flex-col bg-[var(--color-sidebar)] px-6 py-8 text-[var(--color-sidebar-ink)]">
      <div className="space-y-3">
        <div className="text-xs uppercase tracking-[0.3em] text-[rgba(248,243,235,0.55)]">
          Roomflow
        </div>
        <div className="text-2xl font-semibold">Qualification Ops</div>
        <p className="max-w-xs text-sm text-[rgba(248,243,235,0.7)]">
          Shared-housing workflow for sorting inbound inquiries into the next
          correct action.
        </p>
      </div>

      <nav className="mt-10 flex flex-col gap-2">
        {appNav.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/app" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              className={`rounded-2xl border px-4 py-3 transition ${
                isActive
                  ? "border-[rgba(248,243,235,0.18)] bg-[rgba(248,243,235,0.12)]"
                  : "border-transparent bg-transparent hover:border-[rgba(248,243,235,0.12)] hover:bg-[rgba(248,243,235,0.06)]"
              }`}
            >
              <div className="font-medium">{item.label}</div>
              <div className="mt-1 text-xs text-[rgba(248,243,235,0.62)]">
                {item.description}
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto rounded-3xl border border-[rgba(248,243,235,0.14)] bg-[rgba(248,243,235,0.08)] p-4">
        <div className="text-xs uppercase tracking-[0.24em] text-[rgba(248,243,235,0.55)]">
          Workspace
        </div>
        <div className="mt-2 text-lg font-semibold">{workspaceName}</div>
        <div className="mt-1 text-sm text-[rgba(248,243,235,0.7)]">
          {workspaceSummary}
        </div>
        <div className="mt-4">
          <WorkspaceSwitcher
            activeWorkspaceId={activeWorkspaceId}
            workspaceOptions={workspaceOptions}
          />
        </div>
      </div>
    </aside>
  );
}
