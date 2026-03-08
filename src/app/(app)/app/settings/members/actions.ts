"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { WorkspaceCapability } from "@/generated/prisma/client";
import { getCurrentWorkspaceMembership, getCurrentWorkspaceState } from "@/lib/app-data";
import { prisma } from "@/lib/prisma";
import { workspaceHasCapability } from "@/lib/workspace-plan";
import { canMembershipRoleManageWorkspaceInvites } from "@/lib/workspace-invites";

export async function updateMemberSharedTourCoverageAction(
  membershipId: string,
  formData: FormData,
) {
  const currentWorkspaceMembership = await getCurrentWorkspaceMembership();
  const workspaceState = await getCurrentWorkspaceState();
  const redirectTargetValue = formData.get("redirectTo");
  const sharedTourCoverageEnabled = formData.get("sharedTourCoverageEnabled") === "on";

  if (
    !workspaceHasCapability(
      currentWorkspaceMembership.workspace.enabledCapabilities,
      WorkspaceCapability.ORG_MEMBERS,
    )
  ) {
    throw new Error("Shared tour coverage is only available on Org workspaces.");
  }

  if (!canMembershipRoleManageWorkspaceInvites(currentWorkspaceMembership.role)) {
    throw new Error("Only workspace owners and admins can manage shared tour coverage.");
  }

  const targetMembership = await prisma.membership.findFirst({
    where: {
      id: membershipId,
      workspaceId: currentWorkspaceMembership.workspaceId,
    },
    include: {
      user: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!targetMembership) {
    throw new Error("Workspace member not found.");
  }

  await prisma.membership.update({
    where: {
      id: targetMembership.id,
    },
    data: {
      sharedTourCoverageEnabled,
    },
  });

  await prisma.auditEvent.create({
    data: {
      workspaceId: currentWorkspaceMembership.workspaceId,
      actorUserId: workspaceState.user.id,
      eventType: "workspace_member_shared_tour_coverage_updated",
      payload: {
        membershipId: targetMembership.id,
        memberName: targetMembership.user.name,
        sharedTourCoverageEnabled,
      },
    },
  });

  revalidatePath("/app/settings/integrations");
  revalidatePath("/app/settings/members");
  revalidatePath("/app/leads");

  const redirectTarget =
    typeof redirectTargetValue === "string" && redirectTargetValue.length > 0
      ? redirectTargetValue
      : "/app/settings/members";

  redirect(redirectTarget);
}