import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { MembershipRole, WorkspaceCapability } from "@/generated/prisma/client";
import { getCurrentWorkspaceMembership } from "@/lib/app-data";
import { workspaceHasCapability } from "@/lib/workspace-plan";
import { getServerSession } from "@/lib/session";
import { createWorkspaceInvite, WorkspaceInviteError } from "@/lib/workspace-invites";

type CreateWorkspaceInviteRequestBody = {
  email?: string;
  role?: string;
};

function isMembershipRole(value: string): value is MembershipRole {
  return Object.values(MembershipRole).includes(value as MembershipRole);
}

type CreateWorkspaceInviteRouteDependencies = {
  createWorkspaceInvite: typeof createWorkspaceInvite;
  getCurrentWorkspaceMembership: typeof getCurrentWorkspaceMembership;
  getServerSession: typeof getServerSession;
  revalidatePath: typeof revalidatePath;
  workspaceHasCapability: typeof workspaceHasCapability;
};

const defaultCreateWorkspaceInviteRouteDependencies: CreateWorkspaceInviteRouteDependencies = {
  createWorkspaceInvite,
  getCurrentWorkspaceMembership,
  getServerSession,
  revalidatePath,
  workspaceHasCapability,
};

export async function handleCreateWorkspaceInvitePost(
  request: Request,
  dependencies: CreateWorkspaceInviteRouteDependencies = defaultCreateWorkspaceInviteRouteDependencies,
) {
  const session = await dependencies.getServerSession();

  if (!session?.user.id || !session.user.email) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const requestBody = (await request.json().catch(() => null)) as CreateWorkspaceInviteRequestBody | null;
  const invitedEmailAddress = requestBody?.email?.trim();
  const requestedRole = requestBody?.role?.trim();

  if (!invitedEmailAddress) {
    return NextResponse.json({ message: "Invite email is required." }, { status: 400 });
  }

  if (!requestedRole || !isMembershipRole(requestedRole)) {
    return NextResponse.json({ message: "A valid workspace role is required." }, { status: 400 });
  }

  const currentWorkspaceMembership = await dependencies.getCurrentWorkspaceMembership();

  if (
    !dependencies.workspaceHasCapability(
      currentWorkspaceMembership.workspace.enabledCapabilities,
      WorkspaceCapability.ORG_MEMBERS,
    )
  ) {
    return NextResponse.json(
      {
        message: "Teammate invites require an Org workspace package.",
        requiredCapability: WorkspaceCapability.ORG_MEMBERS,
        upgradePath: "/app/settings?upgrade=org-members",
      },
      { status: 403 },
    );
  }

  try {
    await dependencies.createWorkspaceInvite({
      invitedEmailAddress,
      invitedRole: requestedRole,
      inviterUserId: session.user.id,
      workspaceId: currentWorkspaceMembership.workspaceId,
    });

    dependencies.revalidatePath("/app/settings");
    dependencies.revalidatePath("/app/settings/members");

    return NextResponse.json({ status: true });
  } catch (error) {
    if (error instanceof WorkspaceInviteError) {
      const statusCode =
        error.code === "INVITE_PERMISSION_DENIED"
          ? 403
          : error.code === "ALREADY_MEMBER"
            ? 409
            : 400;

      return NextResponse.json({ message: error.message }, { status: statusCode });
    }

    return NextResponse.json({ message: "Unable to create workspace invite." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return handleCreateWorkspaceInvitePost(request);
}