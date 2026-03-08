import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { getCurrentWorkspaceState } from "@/lib/app-data";

export default async function SettingsPage() {
  const workspaceState = await getCurrentWorkspaceState();

  return (
    <main>
      <PageHeader
        eyebrow="Settings"
        title="Operator and workspace settings"
        description="The settings area now carries the minimum account, workspace, and integration context needed for the single-operator v1 flow."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
          <div className="text-xl font-semibold">Profile</div>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-[var(--color-muted)]">Name</dt>
              <dd className="mt-1 font-medium">{workspaceState.user.name}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-muted)]">Email</dt>
              <dd className="mt-1 font-medium">{workspaceState.user.email}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-muted)]">Role</dt>
              <dd className="mt-1 font-medium">{workspaceState.membership.role}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
          <div className="text-xl font-semibold">Workspace</div>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-[var(--color-muted)]">Workspace name</dt>
              <dd className="mt-1 font-medium">{workspaceState.workspace.name}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-muted)]">Slug</dt>
              <dd className="mt-1 font-medium">{workspaceState.workspace.slug}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-muted)]">Onboarding</dt>
              <dd className="mt-1 font-medium">
                {workspaceState.onboardingComplete ? "Complete" : "In progress"}
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
          <div className="text-xl font-semibold">Integrations</div>
          <p className="mt-3 text-sm leading-7 text-[var(--color-muted)]">
            Email, SMS, webhook, and CSV import placeholders now live on a
            dedicated route.
          </p>
          <Link
            className="mt-5 inline-flex rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white"
            href="/app/settings/integrations"
          >
            Open integrations
          </Link>
        </div>

        <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
          <div className="text-xl font-semibold">Security</div>
          <p className="mt-3 text-sm leading-7 text-[var(--color-muted)]">
            Review active devices, revoke stale sessions, and close the current
            operator session from one place.
          </p>
          <Link
            className="mt-5 inline-flex rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white"
            href="/app/settings/security"
          >
            Open security
          </Link>
        </div>
      </div>
    </main>
  );
}
