import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { MembershipRole } from "@/generated/prisma/client";
import { getCurrentWorkspaceMembership } from "@/lib/app-data";
import { getServerSession } from "@/lib/session";
import { createWorkspaceInvite, WorkspaceInviteError } from "@/lib/workspace-invites";

type CreateWorkspaceInviteRequestBody = {
  email?: string;
  role?: string;
};

function isMembershipRole(value: string): value is MembershipRole {
  return Object.values(MembershipRole).includes(value as MembershipRole);
}

export async function POST(request: Request) {
  const session = await getServerSession();

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

  const currentWorkspaceMembership = await getCurrentWorkspaceMembership();

  try {
    await createWorkspaceInvite({
      invitedEmailAddress,
      invitedRole: requestedRole,
      inviterUserId: session.user.id,
      workspaceId: currentWorkspaceMembership.workspaceId,
    });

    revalidatePath("/app/settings");
    revalidatePath("/app/settings/members");

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