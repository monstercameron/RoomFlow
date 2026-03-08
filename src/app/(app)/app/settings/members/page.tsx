import Link from "next/link";
import { MembershipRole, WorkspaceCapability } from "@/generated/prisma/client";
import { PageHeader } from "@/components/page-header";
import { WorkspaceMembersPanel } from "@/components/workspace-members-panel";
import { getCurrentWorkspaceMembership, getCurrentWorkspaceState } from "@/lib/app-data";
import { formatAvailabilityWindow, parseAvailabilityWindowConfig } from "@/lib/availability-windows";
import { prisma } from "@/lib/prisma";
import { membershipRoleSupportsPropertyScopes } from "@/lib/property-scopes";
import { workspaceHasCapability } from "@/lib/workspace-plan";
import {
  canMembershipRoleManageWorkspaceInvites,
  getAssignableWorkspaceInviteRoles,
  getWorkspaceInviteStatus,
} from "@/lib/workspace-invites";
import {
  revokeWorkspaceInviteAction,
  updateMemberRoleAction,
  updateMemberSharedTourCoverageAction,
} from "@/app/(app)/app/settings/members/actions";
import {
  updateMemberPropertyScopesAction,
  updateWorkspaceSlaSettingsAction,
} from "@/lib/collaboration-actions";

function formatMembershipRoleLabel(membershipRole: MembershipRole) {
  return membershipRole.charAt(0) + membershipRole.slice(1).toLowerCase();
}

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
      propertyScopes: {
        select: {
          propertyId: true,
        },
      },
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
  const activeProperties = await prisma.property.findMany({
    where: {
      workspaceId: currentWorkspaceMembership.workspaceId,
    },
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
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
  const canManageWorkspaceInvites = canMembershipRoleManageWorkspaceInvites(
    currentWorkspaceMembership.role,
  );
  const assignableRoles = getAssignableWorkspaceInviteRoles(currentWorkspaceMembership.role);

  return (
    <main>
      <PageHeader
        eyebrow="Settings"
        title="Team and workspace access"
        description="Invite teammates, update Org roles, and manage who can work the shared pipeline."
      />

      <WorkspaceMembersPanel
        assignableRoles={assignableRoles}
        canManageWorkspaceInvites={canManageWorkspaceInvites}
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
        <div className="text-xl font-semibold">Role management</div>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--color-muted)]">
          Owners and admins can tune teammate access without leaving the settings flow. Owners can manage admins, managers, and viewers. Admins can manage managers and viewers.
        </p>
        <div className="mt-5 space-y-3">
          {workspaceMemberships.map((workspaceMembership) => {
            const canManageTargetRole = assignableRoles.includes(workspaceMembership.role);

            return (
              <form
                action={updateMemberRoleAction.bind(null, workspaceMembership.id)}
                className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-4"
                key={`${workspaceMembership.id}-role`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{workspaceMembership.user.name}</div>
                    <div className="mt-1 text-sm text-[var(--color-muted)]">
                      {workspaceMembership.user.email}
                    </div>
                    <div className="mt-2 text-sm text-[var(--color-muted)]">
                      Current role: {formatMembershipRoleLabel(workspaceMembership.role)}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="space-y-2 text-sm font-medium">
                      <span>Role</span>
                      <select
                        className="min-w-40 rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                        defaultValue={workspaceMembership.role}
                        disabled={!canManageWorkspaceInvites || !canManageTargetRole}
                        name="membershipRole"
                      >
                        {assignableRoles.map((assignableRole) => (
                          <option key={assignableRole} value={assignableRole}>
                            {formatMembershipRoleLabel(assignableRole)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <input type="hidden" name="redirectTo" value="/app/settings/team?tab=roles" />
                    <button
                      className="rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={!canManageWorkspaceInvites || !canManageTargetRole}
                      type="submit"
                    >
                      Save role
                    </button>
                  </div>
                </div>
                {!canManageTargetRole ? (
                  <div className="mt-3 text-sm text-[var(--color-muted)]">
                    This teammate role can only be managed by a workspace owner.
                  </div>
                ) : null}
              </form>
            );
          })}
        </div>
      </section>

      <section className="mt-6 rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
        <div className="text-xl font-semibold">Invite controls</div>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--color-muted)]">
          Pending invites can be revoked when teammates no longer need access or the requested role changes.
        </p>
        <div className="mt-5 space-y-3">
          {workspaceInvites.length === 0 ? (
            <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm text-[var(--color-muted)]">
              No workspace invites have been issued yet.
            </div>
          ) : (
            workspaceInvites.map((workspaceInvite) => {
              const workspaceInviteStatus = getWorkspaceInviteStatus(workspaceInvite);

              return (
                <form
                  action={revokeWorkspaceInviteAction.bind(null, workspaceInvite.id)}
                  className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-4"
                  key={`${workspaceInvite.id}-revoke`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{workspaceInvite.email}</div>
                      <div className="mt-1 text-sm text-[var(--color-muted)]">
                        {formatMembershipRoleLabel(workspaceInvite.role)} invite sent by {workspaceInvite.invitedByUser.name}
                      </div>
                      <div className="mt-2 text-sm text-[var(--color-muted)] capitalize">
                        Status: {workspaceInviteStatus}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-sm text-[var(--color-muted)]">
                        Expires {workspaceInvite.expiresAt.toLocaleString()}
                      </div>
                      <input type="hidden" name="redirectTo" value="/app/settings/team?tab=invites" />
                      <button
                        className="rounded-2xl border border-[var(--color-line)] px-4 py-3 text-sm font-medium text-[var(--color-accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={!canManageWorkspaceInvites || workspaceInviteStatus !== "pending"}
                        type="submit"
                      >
                        Revoke invite
                      </button>
                    </div>
                  </div>
                </form>
              );
            })
          )}
        </div>
      </section>

      <section className="mt-6 rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
        <div className="text-xl font-semibold">Property scopes</div>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--color-muted)]">
          Limit manager and viewer access to specific properties when different teammates handle different homes. Leaving scopes empty keeps the teammate on full-workspace visibility.
        </p>
        <div className="mt-5 space-y-3">
          {workspaceMemberships.map((workspaceMembership) => {
            const propertyScopeIds = new Set(
              workspaceMembership.propertyScopes.map((propertyScope) => propertyScope.propertyId),
            );

            return (
              <form
                action={updateMemberPropertyScopesAction.bind(null, workspaceMembership.id)}
                className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-4"
                key={`${workspaceMembership.id}-property-scopes`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{workspaceMembership.user.name}</div>
                    <div className="mt-1 text-sm text-[var(--color-muted)]">
                      {workspaceMembership.user.email} · {formatMembershipRoleLabel(workspaceMembership.role)}
                    </div>
                    {!membershipRoleSupportsPropertyScopes(workspaceMembership.role) ? (
                      <div className="mt-2 text-sm text-[var(--color-muted)]">
                        Owners and admins always keep full workspace access.
                      </div>
                    ) : null}
                  </div>
                  <div className="min-w-72 flex-1">
                    {membershipRoleSupportsPropertyScopes(workspaceMembership.role) ? (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {activeProperties.map((property) => (
                          <label
                            className="flex items-center gap-2 rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm"
                            key={`${workspaceMembership.id}-${property.id}`}
                          >
                            <input
                              defaultChecked={propertyScopeIds.has(property.id)}
                              disabled={!canManageWorkspaceInvites}
                              name="propertyIds"
                              type="checkbox"
                              value={property.id}
                            />
                            {property.name}
                          </label>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm text-[var(--color-muted)]">
                        Property scopes are not applied to this teammate role.
                      </div>
                    )}
                  </div>
                </div>
                <input type="hidden" name="redirectTo" value="/app/settings/team?tab=scopes" />
                <button
                  className="mt-4 rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!canManageWorkspaceInvites || !membershipRoleSupportsPropertyScopes(workspaceMembership.role)}
                  type="submit"
                >
                  Save property scopes
                </button>
              </form>
            );
          })}
        </div>
      </section>

      <section className="mt-6 rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
        <div className="text-xl font-semibold">Queue SLAs</div>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--color-muted)]">
          Define how quickly new responses and review items should be handled across the shared team queue.
        </p>
        <form action={updateWorkspaceSlaSettingsAction} className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
          <label className="space-y-2 text-sm font-medium">
            <span>Lead response SLA (minutes)</span>
            <input
              className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
              defaultValue={currentWorkspaceMembership.workspace.leadResponseSlaMinutes}
              min={1}
              name="leadResponseSlaMinutes"
              type="number"
            />
          </label>
          <label className="space-y-2 text-sm font-medium">
            <span>Review SLA (minutes)</span>
            <input
              className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
              defaultValue={currentWorkspaceMembership.workspace.leadReviewSlaMinutes}
              min={1}
              name="leadReviewSlaMinutes"
              type="number"
            />
          </label>
          <div className="flex items-end">
            <input type="hidden" name="redirectTo" value="/app/settings/team?tab=sla" />
            <button
              className="w-full rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!canManageWorkspaceInvites}
              type="submit"
            >
              Save SLA settings
            </button>
          </div>
        </form>
      </section>

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
                      disabled={!canManageWorkspaceInvites}
                      name="sharedTourCoverageEnabled"
                      type="checkbox"
                    />
                    Shared coverage pool
                  </label>
                  <input type="hidden" name="redirectTo" value="/app/settings/team?tab=coverage" />
                  <button
                    className="rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!canManageWorkspaceInvites}
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