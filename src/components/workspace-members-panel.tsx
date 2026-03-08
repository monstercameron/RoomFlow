"use client";

import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";
import type { MembershipRole } from "@/generated/prisma/client";

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatMembershipRoleLabel(membershipRole: MembershipRole) {
  return membershipRole.charAt(0) + membershipRole.slice(1).toLowerCase();
}

function formatTimestamp(timestampValue: string) {
  return dateTimeFormatter.format(new Date(timestampValue));
}

export function WorkspaceMembersPanel(props: {
  assignableRoles: MembershipRole[];
  canManageWorkspaceInvites: boolean;
  currentMembershipRole: MembershipRole;
  members: Array<{
    createdAt: string;
    emailAddress: string;
    membershipRole: MembershipRole;
    name: string;
  }>;
  workspaceInvites: Array<{
    createdAt: string;
    emailAddress: string;
    expiresAt: string;
    invitedByName: string;
    membershipRole: MembershipRole;
    status: "accepted" | "expired" | "pending" | "revoked";
  }>;
}) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [invitedEmailAddress, setInvitedEmailAddress] = useState("");
  const [selectedInviteRole, setSelectedInviteRole] = useState<MembershipRole>(
    props.assignableRoles[0] ?? "VIEWER",
  );
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);

  async function submitWorkspaceInvite() {
    setIsSubmittingInvite(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const createInviteResponse = await fetch("/api/workspace-invites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: invitedEmailAddress,
          role: selectedInviteRole,
        }),
      });

      if (!createInviteResponse.ok) {
        const errorPayload = (await createInviteResponse.json().catch(() => null)) as {
          message?: string;
        } | null;

        setErrorMessage(errorPayload?.message ?? "Unable to send that workspace invite.");
        return;
      }

      setInvitedEmailAddress("");
      setSuccessMessage(
        "Workspace invite sent. In local development, check the server log if no email provider is configured.",
      );
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setErrorMessage("Network error. Could not reach the server.");
    } finally {
      setIsSubmittingInvite(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
        <div className="text-xl font-semibold">Current workspace members</div>
        <p className="mt-2 text-sm leading-7 text-[var(--color-muted)]">
          The active workspace is currently scoped to {props.members.length} teammate
          {props.members.length === 1 ? "" : "s"}. Your role is {formatMembershipRoleLabel(props.currentMembershipRole)}.
        </p>
        <div className="mt-5 space-y-3">
          {props.members.map((workspaceMember) => (
            <div
              className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-4"
              key={`${workspaceMember.emailAddress}-${workspaceMember.createdAt}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{workspaceMember.name}</div>
                  <div className="mt-1 text-sm text-[var(--color-muted)]">
                    {workspaceMember.emailAddress}
                  </div>
                </div>
                <div className="text-right text-sm text-[var(--color-muted)]">
                  <div>{formatMembershipRoleLabel(workspaceMember.membershipRole)}</div>
                  <div className="mt-1">Joined {formatTimestamp(workspaceMember.createdAt)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
        <div className="text-xl font-semibold">Pending and recent invites</div>
        <p className="mt-2 text-sm leading-7 text-[var(--color-muted)]">
          Workspace invites preserve the workspace context so teammates can join through an existing or newly created account.
        </p>

        {props.canManageWorkspaceInvites ? (
          <form
            className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_auto]"
            onSubmit={(submitEvent) => {
              submitEvent.preventDefault();
              void submitWorkspaceInvite();
            }}
          >
            <label className="space-y-2">
              <span className="text-sm font-medium">Email</span>
              <input
                className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                onChange={(changeEvent) => setInvitedEmailAddress(changeEvent.target.value)}
                placeholder="teammate@roomflow.app"
                type="email"
                value={invitedEmailAddress}
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Role</span>
              <select
                className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                onChange={(changeEvent) => {
                  setSelectedInviteRole(changeEvent.target.value as MembershipRole);
                }}
                value={selectedInviteRole}
              >
                {props.assignableRoles.map((assignableRole) => (
                  <option key={assignableRole} value={assignableRole}>
                    {formatMembershipRoleLabel(assignableRole)}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="rounded-2xl bg-[var(--color-accent)] px-4 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 md:self-end"
              disabled={isSubmittingInvite || props.assignableRoles.length === 0}
              type="submit"
            >
              {isSubmittingInvite ? "Sending invite..." : "Send invite"}
            </button>
          </form>
        ) : (
          <div className="mt-5 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm text-[var(--color-muted)]">
            Only workspace owners and admins can send teammate invites.
          </div>
        )}

        {errorMessage ? (
          <div className="mt-4 rounded-2xl border border-[rgba(184,88,51,0.25)] bg-[rgba(184,88,51,0.08)] px-4 py-3 text-sm text-[var(--color-accent-strong)]">
            {errorMessage}
          </div>
        ) : null}
        {successMessage ? (
          <div className="mt-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm text-[var(--color-muted)]">
            {successMessage}
          </div>
        ) : null}

        <div className="mt-5 space-y-3">
          {props.workspaceInvites.length === 0 ? (
            <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm text-[var(--color-muted)]">
              No workspace invites have been issued yet.
            </div>
          ) : (
            props.workspaceInvites.map((workspaceInvite) => (
              <div
                className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-4"
                key={`${workspaceInvite.emailAddress}-${workspaceInvite.createdAt}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{workspaceInvite.emailAddress}</div>
                    <div className="mt-1 text-sm text-[var(--color-muted)]">
                      {formatMembershipRoleLabel(workspaceInvite.membershipRole)} invite sent by {workspaceInvite.invitedByName}
                    </div>
                  </div>
                  <div className="text-right text-sm text-[var(--color-muted)]">
                    <div className="capitalize">{workspaceInvite.status}</div>
                    <div className="mt-1">Expires {formatTimestamp(workspaceInvite.expiresAt)}</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}