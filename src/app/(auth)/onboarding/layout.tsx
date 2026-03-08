import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { buildEmailVerificationPagePath } from "@/lib/auth-urls";
import { getCurrentWorkspaceState } from "@/lib/app-data";
import { getServerSession } from "@/lib/session";

export default async function OnboardingLayout({
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
        nextPath: "/onboarding",
      }),
    );
  }

  if (workspaceState.onboardingComplete) {
    redirect("/app");
  }

  return children;
}
