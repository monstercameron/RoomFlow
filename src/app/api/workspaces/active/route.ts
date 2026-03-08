import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { activeWorkspaceCookieName } from "@/lib/workspaces";

type WorkspaceSelectionRequestBody = {
  workspaceId?: string;
};

type CookieStoreLike = {
  set: (name: string, value: string, options: { httpOnly: boolean; path: string; sameSite: "lax" }) => void;
};

type ActiveWorkspaceRouteDependencies = {
  cookies: typeof cookies;
  getSession: (params: { headers: Awaited<ReturnType<typeof headers>> }) => ReturnType<typeof auth.api.getSession>;
  headers: typeof headers;
  membershipFindFirst: (args: {
    where: {
      userId: string;
      workspaceId: string;
    };
  }) => Promise<{ id: string } | null>;
};

const defaultActiveWorkspaceRouteDependencies: ActiveWorkspaceRouteDependencies = {
  cookies,
  getSession: auth.api.getSession,
  headers,
  membershipFindFirst: prisma.membership.findFirst.bind(prisma.membership),
};

export async function handleActiveWorkspacePost(
  request: Request,
  dependencies: ActiveWorkspaceRouteDependencies = defaultActiveWorkspaceRouteDependencies,
) {
  const session = await dependencies.getSession({
    headers: await dependencies.headers(),
  });

  if (!session?.user.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const requestBody = (await request.json().catch(() => null)) as WorkspaceSelectionRequestBody | null;
  const workspaceId = requestBody?.workspaceId;

  if (!workspaceId) {
    return NextResponse.json({ message: "Workspace selection is required." }, { status: 400 });
  }

  const membership = await dependencies.membershipFindFirst({
    where: {
      userId: session.user.id,
      workspaceId,
    },
  });

  if (!membership) {
    return NextResponse.json({ message: "Workspace access not found." }, { status: 403 });
  }

  const cookieStore = (await dependencies.cookies()) as CookieStoreLike;

  cookieStore.set(activeWorkspaceCookieName, workspaceId, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
  });

  return NextResponse.json({ status: true });
}

export async function POST(request: Request) {
  return handleActiveWorkspacePost(request);
}