import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { WorkspaceInviteAcceptancePanel } from "@/components/workspace-invite-acceptance-panel";
import { getAuthenticatedRedirectPath } from "@/lib/app-data";
import { getServerSession } from "@/lib/session";
import { getWorkspaceInvitePreview } from "@/lib/workspace-invites";

type WorkspaceInvitePageProps = {
  params: Promise<{
    token: string;
  }>;
};

export default async function WorkspaceInvitePage({ params }: WorkspaceInvitePageProps) {
  const session = await getServerSession();
  const resolvedParams = await params;
  const workspaceInvite = await getWorkspaceInvitePreview(resolvedParams.token);

  if (!workspaceInvite) {
    notFound();
  }

  if (
    session?.user.email &&
    workspaceInvite.status === "accepted" &&
    session.user.email.toLowerCase() === workspaceInvite.email
  ) {
    redirect(await getAuthenticatedRedirectPath());
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <div className="w-full max-w-3xl rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-8 shadow-[var(--shadow-panel)] md:p-10">
        <div className="text-xs uppercase tracking-[0.24em] text-[var(--color-muted)]">
          Workspace invite
        </div>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">
          Join {workspaceInvite.workspaceName} on Roomflow.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--color-muted)]">
          {workspaceInvite.invitedByName} invited {workspaceInvite.email} to this workspace. Accept the invite with the matching account to preserve the correct workspace context.
        </p>
        <div className="mt-6 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 text-sm text-[var(--color-muted)]">
          Invite expires {workspaceInvite.expiresAt.toLocaleString("en-US")}. Role: {workspaceInvite.role}.
        </div>
        <WorkspaceInviteAcceptancePanel
          invitedByName={workspaceInvite.invitedByName}
          invitedEmailAddress={workspaceInvite.email}
          inviteStatus={workspaceInvite.status}
          inviteToken={resolvedParams.token}
          membershipRole={workspaceInvite.role}
          signedInEmailAddress={session?.user.email}
          workspaceName={workspaceInvite.workspaceName}
          workspaceOnboardingCompletedAt={
            workspaceInvite.workspaceOnboardingCompletedAt?.toISOString() ?? null
          }
        />
        <div className="mt-4 text-sm text-[var(--color-muted)]">
          Need a different account? {" "}
          <Link className="font-medium text-[var(--color-accent-strong)]" href="/login">
            Return to login
          </Link>
        </div>
      </div>
    </main>
  );
}