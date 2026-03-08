import Link from "next/link";
import { WorkspaceCapability } from "@/generated/prisma/client";
import { PageHeader } from "@/components/page-header";
import { WorkspaceMembersPanel } from "@/components/workspace-members-panel";
import { getCurrentWorkspaceMembership, getCurrentWorkspaceState } from "@/lib/app-data";
import { prisma } from "@/lib/prisma";
import { workspaceHasCapability } from "@/lib/workspace-plan";
import {
  canMembershipRoleManageWorkspaceInvites,
  getAssignableWorkspaceInviteRoles,
  getWorkspaceInviteStatus,
} from "@/lib/workspace-invites";

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