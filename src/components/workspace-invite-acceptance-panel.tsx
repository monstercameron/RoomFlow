"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";
import type { MembershipRole } from "@/generated/prisma/client";
import { buildAuthEntryPagePath } from "@/lib/auth-urls";
import { LogoutButton } from "@/components/logout-button";

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

export function WorkspaceInviteAcceptancePanel(props: {
  invitedEmailAddress: string;
  invitedByName: string;
  inviteStatus: "accepted" | "expired" | "pending" | "revoked";
  inviteToken: string;
  membershipRole: MembershipRole;
  signedInEmailAddress?: string | null;
  workspaceName: string;
  workspaceOnboardingCompletedAt?: string | null;
}) {
  const router = useRouter();
  const callbackPath = `/invite/${encodeURIComponent(props.inviteToken)}`;
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAcceptingInvite, setIsAcceptingInvite] = useState(false);
  const signedInEmailMatchesInvite =
    props.signedInEmailAddress?.trim().toLowerCase() === props.invitedEmailAddress;

  async function acceptWorkspaceInvite() {
    setIsAcceptingInvite(true);
    setErrorMessage(null);

    try {
      const acceptInviteResponse = await fetch("/api/workspace-invites/accept", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: props.inviteToken,
        }),
      });

      if (!acceptInviteResponse.ok) {
        const errorPayload = (await acceptInviteResponse.json().catch(() => null)) as {
          message?: string;
        } | null;

        setErrorMessage(errorPayload?.message ?? "Unable to accept this workspace invite.");
        return;
      }

      const successPayload = (await acceptInviteResponse.json()) as {
        redirectPath: string;
      };

      window.location.assign(successPayload.redirectPath);
    } catch {
      setErrorMessage("Network error. Could not reach the server.");
    } finally {
      setIsAcceptingInvite(false);
      startTransition(() => {
        router.refresh();
      });
    }
  }

  if (props.inviteStatus !== "pending") {
    return (
      <div className="mt-8 space-y-4">
        <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm text-[var(--color-muted)]">
          {props.inviteStatus === "accepted"
            ? "This invite has already been accepted. If you already joined the workspace, continue into the app."
            : props.inviteStatus === "expired"
              ? "This invite expired. Ask a workspace owner or admin to send a new link."
              : "This invite has been revoked. Ask a workspace owner or admin for a fresh invite if you still need access."}
        </div>
        <Link
          className="inline-flex rounded-2xl bg-[var(--color-accent)] px-4 py-3 font-medium text-white"
          href={props.workspaceOnboardingCompletedAt ? "/app" : "/onboarding"}
        >
          Open Roomflow
        </Link>
      </div>
    );
  }

  if (!props.signedInEmailAddress) {
    const loginPath = buildAuthEntryPagePath({
      callbackPath,
      emailAddress: props.invitedEmailAddress,
      entryPath: "/login",
      inviteToken: props.inviteToken,
    });
    const signupPath = buildAuthEntryPagePath({
      callbackPath,
      emailAddress: props.invitedEmailAddress,
      entryPath: "/signup",
      inviteToken: props.inviteToken,
    });

    return (
      <div className="mt-8 space-y-4">
        <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm text-[var(--color-muted)]">
          Sign in or create an account with {props.invitedEmailAddress} to accept this workspace invite.
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link
            className="inline-flex w-full justify-center rounded-2xl bg-[var(--color-accent)] px-4 py-3 font-medium text-white sm:w-auto"
            href={loginPath}
          >
            Log in to accept
          </Link>
          <Link
            className="inline-flex w-full justify-center rounded-2xl border border-[var(--color-line)] px-4 py-3 font-medium text-[var(--color-accent-strong)] sm:w-auto"
            href={signupPath}
          >
            Create account to accept
          </Link>
        </div>
      </div>
    );
  }

  if (!signedInEmailMatchesInvite) {
    const switchAccountPath = buildAuthEntryPagePath({
      callbackPath,
      emailAddress: props.invitedEmailAddress,
      entryPath: "/login",
      inviteToken: props.inviteToken,
    });

    return (
      <div className="mt-8 space-y-4">
        <div className="rounded-2xl border border-[rgba(184,88,51,0.25)] bg-[rgba(184,88,51,0.08)] px-4 py-3 text-sm text-[var(--color-accent-strong)]">
          You are signed in as {props.signedInEmailAddress}, but this invite belongs to {props.invitedEmailAddress}.
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <LogoutButton />
          <Link
            className="inline-flex w-full justify-center rounded-2xl border border-[var(--color-line)] px-4 py-3 font-medium text-[var(--color-accent-strong)] sm:w-auto"
            href={switchAccountPath}
          >
            Switch accounts
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-4">
      <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm text-[var(--color-muted)]">
        You are signed in with the invited email address and can join this workspace now.
      </div>
      {errorMessage ? (
        <div className="rounded-2xl border border-[rgba(184,88,51,0.25)] bg-[rgba(184,88,51,0.08)] px-4 py-3 text-sm text-[var(--color-accent-strong)]">
          {errorMessage}
        </div>
      ) : null}
      <button
        className="w-full rounded-2xl bg-[var(--color-accent)] px-4 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isAcceptingInvite}
        onClick={() => {
          void acceptWorkspaceInvite();
        }}
        type="button"
      >
        {isAcceptingInvite ? "Joining workspace..." : "Accept workspace invite"}
      </button>
      <div className="text-sm text-[var(--color-muted)]">
        Invitation role: {formatMembershipRoleLabel(props.membershipRole)}. Invite email: {props.invitedEmailAddress}. 
        Invited by {props.invitedByName}.
      </div>
    </div>
  );
}