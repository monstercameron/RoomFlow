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

type CookieStoreLike = {
  set: (name: string, value: string, options: { httpOnly: boolean; path: string; sameSite: "lax" }) => void;
};

type AcceptWorkspaceInviteRouteDependencies = {
  acceptWorkspaceInvite: typeof acceptWorkspaceInvite;
  buildEmailVerificationPagePath: typeof buildEmailVerificationPagePath;
  cookies: typeof cookies;
  getServerSession: typeof getServerSession;
  revalidatePath: typeof revalidatePath;
};

const defaultAcceptWorkspaceInviteRouteDependencies: AcceptWorkspaceInviteRouteDependencies = {
  acceptWorkspaceInvite,
  buildEmailVerificationPagePath,
  cookies,
  getServerSession,
  revalidatePath,
};

export async function handleAcceptWorkspaceInvitePost(
  request: Request,
  dependencies: AcceptWorkspaceInviteRouteDependencies = defaultAcceptWorkspaceInviteRouteDependencies,
) {
  const session = await dependencies.getServerSession();

  if (!session?.user.id || !session.user.email) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const requestBody = (await request.json().catch(() => null)) as AcceptWorkspaceInviteRequestBody | null;
  const rawInviteToken = requestBody?.token?.trim();

  if (!rawInviteToken) {
    return NextResponse.json({ message: "Invite token is required." }, { status: 400 });
  }

  try {
    const acceptedWorkspaceInvite = await dependencies.acceptWorkspaceInvite({
      currentUserEmailAddress: session.user.email,
      currentUserId: session.user.id,
      rawInviteToken,
    });
    const nextPath = acceptedWorkspaceInvite.workspace.onboardingCompletedAt ? "/app" : "/onboarding";
    const redirectPath = session.user.emailVerified
      ? nextPath
      : dependencies.buildEmailVerificationPagePath({
          emailAddress: session.user.email,
          nextPath,
        });
    const cookieStore = (await dependencies.cookies()) as CookieStoreLike;

    cookieStore.set(activeWorkspaceCookieName, acceptedWorkspaceInvite.workspace.id, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
    });

    dependencies.revalidatePath("/app");
    dependencies.revalidatePath("/app/settings");
    dependencies.revalidatePath("/app/settings/members");

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

export async function POST(request: Request) {
  return handleAcceptWorkspaceInvitePost(request);
}