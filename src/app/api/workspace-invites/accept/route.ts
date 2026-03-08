import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { buildEmailVerificationPagePath } from "@/lib/auth-urls";
import { getServerSession } from "@/lib/session";
import { activeWorkspaceCookieName } from "@/lib/workspaces";
import { acceptWorkspaceInvite, WorkspaceInviteError } from "@/lib/workspace-invites";

type AcceptWorkspaceInviteRequestBody = {
  token?: string;
};

export async function POST(request: Request) {
  const session = await getServerSession();

  if (!session?.user.id || !session.user.email) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const requestBody = (await request.json().catch(() => null)) as AcceptWorkspaceInviteRequestBody | null;
  const rawInviteToken = requestBody?.token?.trim();

  if (!rawInviteToken) {
    return NextResponse.json({ message: "Invite token is required." }, { status: 400 });
  }

  try {
    const acceptedWorkspaceInvite = await acceptWorkspaceInvite({
      currentUserEmailAddress: session.user.email,
      currentUserId: session.user.id,
      rawInviteToken,
    });
    const nextPath = acceptedWorkspaceInvite.workspace.onboardingCompletedAt ? "/app" : "/onboarding";
    const redirectPath = session.user.emailVerified
      ? nextPath
      : buildEmailVerificationPagePath({
          emailAddress: session.user.email,
          nextPath,
        });
    const cookieStore = await cookies();

    cookieStore.set(activeWorkspaceCookieName, acceptedWorkspaceInvite.workspace.id, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
    });

    revalidatePath("/app");
    revalidatePath("/app/settings");
    revalidatePath("/app/settings/members");

    return NextResponse.json({ redirectPath });
  } catch (error) {
    if (error instanceof WorkspaceInviteError) {
      const statusCode =
        error.code === "INVITE_EMAIL_MISMATCH"
          ? 403
          : error.code === "INVITE_NOT_FOUND"
            ? 404
            : 400;

      return NextResponse.json({ message: error.message }, { status: statusCode });
    }

    return NextResponse.json({ message: "Unable to accept workspace invite." }, { status: 500 });
  }
}