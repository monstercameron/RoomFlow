import { prisma } from "@/lib/prisma";
import { MembershipRole } from "@/generated/prisma/client";

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

export async function ensureWorkspaceForUser(user: WorkspaceUser) {
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

  return prisma.$transaction(async (tx) => {
    const workspace = await tx.workspace.upsert({
      where: {
        slug: workspaceSlug,
      },
      update: {
        name: workspaceName,
      },
      create: {
        name: workspaceName,
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
