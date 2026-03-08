import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { WorkspaceMembersPanel } from "@/components/workspace-members-panel";
import { getCurrentWorkspaceMembership, getCurrentWorkspaceState } from "@/lib/app-data";
import { prisma } from "@/lib/prisma";
import {
  canMembershipRoleManageWorkspaceInvites,
  getAssignableWorkspaceInviteRoles,
  getWorkspaceInviteStatus,
} from "@/lib/workspace-invites";

export default async function MemberSettingsPage() {
  const workspaceState = await getCurrentWorkspaceState();
  const currentWorkspaceMembership = await getCurrentWorkspaceMembership();
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