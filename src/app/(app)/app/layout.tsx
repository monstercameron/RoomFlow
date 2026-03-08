import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { buildEmailVerificationPagePath } from "@/lib/auth-urls";
import {
  getAppShellData,
  getCurrentWorkspaceState,
  getWorkspaceSwitcherData,
} from "@/lib/app-data";
import { getServerSession } from "@/lib/session";

export default async function OperatorAppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  const workspaceState = await getCurrentWorkspaceState();

  if (!workspaceState.user.emailVerified) {
    redirect(
      buildEmailVerificationPagePath({
        emailAddress: workspaceState.user.email,
        nextPath: "/app",
      }),
    );
  }

  if (!workspaceState.onboardingComplete) {
    redirect("/onboarding");
  }

  const shellData = await getAppShellData();
  const workspaceSwitcherData = await getWorkspaceSwitcherData();

  return (
    <AppShell
      activeWorkspaceId={workspaceSwitcherData.activeWorkspaceId}
      userLabel={session.user.email}
      workspaceOptions={workspaceSwitcherData.workspaces}
      workspaceName={shellData.workspaceName}
      workspaceSummary={shellData.workspaceSummary}
    >
      {children}
    </AppShell>
  );
}
