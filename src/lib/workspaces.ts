import { prisma } from "@/lib/prisma";
import { MembershipRole } from "@/generated/prisma/client";
import { getDefaultCapabilitiesForWorkspacePlan } from "@/lib/workspace-plan";
import { WorkspacePlanStatus, WorkspacePlanType } from "@/generated/prisma/client";

export const activeWorkspaceCookieName = "roomflow_active_workspace_id";

type WorkspaceUser = {
  id: string;
  email: string;
  name?: string | null;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function buildWorkspaceName(user: WorkspaceUser) {
  const fallback = user.email.split("@")[0] || "Operator";
  const label = user.name?.trim() || fallback;

  return `${label} Workspace`;
}

function buildWorkspaceSlug(user: WorkspaceUser) {
  const fallback = user.email.split("@")[0] || "workspace";
  const base = slugify(user.name?.trim() || fallback) || "workspace";

  return `${base.slice(0, 32)}-${user.id.slice(-6)}`;
}

export async function ensureWorkspaceForUser(
  user: WorkspaceUser,
  options?: {
    planType?: WorkspacePlanType;
  },
) {
  const membership = await prisma.membership.findFirst({
    where: {
      userId: user.id,
    },
    include: {
      workspace: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (membership) {
    return membership.workspace;
  }

  const workspaceName = buildWorkspaceName(user);
  const workspaceSlug = buildWorkspaceSlug(user);
  const workspacePlanType = options?.planType ?? WorkspacePlanType.PERSONAL;

  return prisma.$transaction(async (tx) => {
    const workspace = await tx.workspace.upsert({
      where: {
        slug: workspaceSlug,
      },
      update: {
        enabledCapabilities: getDefaultCapabilitiesForWorkspacePlan(workspacePlanType),
        name: workspaceName,
        planType: workspacePlanType,
      },
      create: {
        billingOwnerUserId: user.id,
        enabledCapabilities: getDefaultCapabilitiesForWorkspacePlan(workspacePlanType),
        name: workspaceName,
        planStatus: WorkspacePlanStatus.TRIAL,
        planType: workspacePlanType,
        slug: workspaceSlug,
      },
    });

    await tx.membership.upsert({
      where: {
        userId_workspaceId: {
          userId: user.id,
          workspaceId: workspace.id,
        },
      },
      update: {},
      create: {
        userId: user.id,
        workspaceId: workspace.id,
        role: MembershipRole.OWNER,
      },
    });

    return workspace;
  });
}
