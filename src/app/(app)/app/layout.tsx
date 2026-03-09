import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { buildEmailVerificationPagePath } from "@/lib/auth-urls";
import {
  getAppShellData,
  getCurrentWorkspaceState,
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

  return (
    <AppShell
      notifications={shellData.notifications}
      taskCenter={shellData.taskCenter}
      userImage={session.user.image ?? null}
      userLabel={session.user.email}
      userName={session.user.name ?? null}
      userRoleLabel={shellData.userRoleLabel}
      workspaceMetrics={shellData.workspaceMetrics}
      workspaceName={shellData.workspaceName}
      workspacePlanLabel={shellData.workspacePlanLabel}
      workspacePlanStatusLabel={shellData.workspacePlanStatusLabel}
      workspaceSummary={shellData.workspaceSummary}
    >
      {children}
    </AppShell>
  );
}
