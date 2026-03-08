import Link from "next/link";
import { WorkspaceCapability } from "@/generated/prisma/client";
import { PageHeader } from "@/components/page-header";
import { WorkspaceMembersPanel } from "@/components/workspace-members-panel";
import { getCurrentWorkspaceMembership, getCurrentWorkspaceState } from "@/lib/app-data";
import { formatAvailabilityWindow, parseAvailabilityWindowConfig } from "@/lib/availability-windows";
import { prisma } from "@/lib/prisma";
import { workspaceHasCapability } from "@/lib/workspace-plan";
import {
  canMembershipRoleManageWorkspaceInvites,
  getAssignableWorkspaceInviteRoles,
  getWorkspaceInviteStatus,
} from "@/lib/workspace-invites";
import { updateMemberSharedTourCoverageAction } from "@/app/(app)/app/settings/members/actions";

export default async function MemberSettingsPage() {
  const workspaceState = await getCurrentWorkspaceState();
  const currentWorkspaceMembership = await getCurrentWorkspaceMembership();

  if (
    !workspaceHasCapability(
      currentWorkspaceMembership.workspace.enabledCapabilities,
      WorkspaceCapability.ORG_MEMBERS,
    )
  ) {
    return (
      <main>
        <PageHeader
          eyebrow="Settings"
          title="Members and workspace access"
          description="Member management is reserved for workspaces with Org teammate controls enabled."
        />

        <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
          <div className="text-xl font-semibold">Org workspace required</div>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--color-muted)]">
            This workspace is currently on the Personal package, so teammate invites and shared access controls are unavailable here.
          </p>
          <Link
            className="mt-5 inline-flex rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white"
            href="/app/settings?upgrade=org-members"
          >
            See Org upgrade details
          </Link>
        </div>
      </main>
    );
  }

  const workspaceMemberships = await prisma.membership.findMany({
    where: {
      workspaceId: currentWorkspaceMembership.workspaceId,
    },
    include: {
      user: {
        select: {
          email: true,
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });
  const workspaceInvites = await prisma.workspaceInvite.findMany({
    where: {
      workspaceId: currentWorkspaceMembership.workspaceId,
    },
    include: {
      invitedByUser: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 12,
  });

  return (
    <main>
      <PageHeader
        eyebrow="Settings"
        title="Members and workspace access"
        description="Invite teammates into the current workspace, review recent invites, and confirm who has access to the pipeline."
      />

      <WorkspaceMembersPanel
        assignableRoles={getAssignableWorkspaceInviteRoles(currentWorkspaceMembership.role)}
        canManageWorkspaceInvites={canMembershipRoleManageWorkspaceInvites(
          currentWorkspaceMembership.role,
        )}
        currentMembershipRole={currentWorkspaceMembership.role}
        members={workspaceMemberships.map((workspaceMembership) => ({
          createdAt: workspaceMembership.createdAt.toISOString(),
          emailAddress: workspaceMembership.user.email,
          membershipRole: workspaceMembership.role,
          name: workspaceMembership.user.name,
        }))}
        workspaceInvites={workspaceInvites.map((workspaceInvite) => ({
          createdAt: workspaceInvite.createdAt.toISOString(),
          emailAddress: workspaceInvite.email,
          expiresAt: workspaceInvite.expiresAt.toISOString(),
          invitedByName: workspaceInvite.invitedByUser.name,
          membershipRole: workspaceInvite.role,
          status: getWorkspaceInviteStatus(workspaceInvite),
        }))}
      />

      <section className="mt-6 rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
        <div className="text-xl font-semibold">Shared tour coverage</div>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--color-muted)]">
          Shared coverage determines which teammates can receive manual team assignments and round-robin tour distribution. Individual operators still control their own availability windows from the integrations page.
        </p>
        <div className="mt-5 space-y-3">
          {workspaceMemberships.map((workspaceMembership) => (
            <form
              action={updateMemberSharedTourCoverageAction.bind(null, workspaceMembership.id)}
              className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-4"
              key={`${workspaceMembership.id}-coverage`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{workspaceMembership.user.name}</div>
                  <div className="mt-1 text-sm text-[var(--color-muted)]">
                    {workspaceMembership.user.email} · {workspaceMembership.role.toLowerCase()}
                  </div>
                  <div className="mt-2 text-sm text-[var(--color-muted)]">
                    Availability: {formatAvailabilityWindow(parseAvailabilityWindowConfig(workspaceMembership.schedulingAvailability))}
                  </div>
                  <div className="mt-1 text-sm text-[var(--color-muted)]">
                    Last assignment: {workspaceMembership.lastTourAssignedAt ? workspaceMembership.lastTourAssignedAt.toLocaleString() : "Not assigned yet"}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      defaultChecked={workspaceMembership.sharedTourCoverageEnabled}
                      disabled={!canMembershipRoleManageWorkspaceInvites(currentWorkspaceMembership.role)}
                      name="sharedTourCoverageEnabled"
                      type="checkbox"
                    />
                    Shared coverage pool
                  </label>
                  <input type="hidden" name="redirectTo" value="/app/settings/members" />
                  <button
                    className="rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!canMembershipRoleManageWorkspaceInvites(currentWorkspaceMembership.role)}
                    type="submit"
                  >
                    Save
                  </button>
                </div>
              </div>
            </form>
          ))}
        </div>
      </section>

      <div className="mt-6 text-sm text-[var(--color-muted)]">
        Need account-level security instead? {" "}
        <Link className="font-medium text-[var(--color-accent-strong)]" href="/app/settings/security">
          Open security
        </Link>
        . Active workspace: {workspaceState.workspace.name}.
      </div>
    </main>
  );
}