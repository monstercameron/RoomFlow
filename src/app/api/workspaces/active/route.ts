import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { activeWorkspaceCookieName } from "@/lib/workspaces";

type WorkspaceSelectionRequestBody = {
  workspaceId?: string;
};

export async function POST(request: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const requestBody = (await request.json().catch(() => null)) as WorkspaceSelectionRequestBody | null;
  const workspaceId = requestBody?.workspaceId;

  if (!workspaceId) {
    return NextResponse.json({ message: "Workspace selection is required." }, { status: 400 });
  }

  const membership = await prisma.membership.findFirst({
    where: {
      userId: session.user.id,
      workspaceId,
    },
  });

  if (!membership) {
    return NextResponse.json({ message: "Workspace access not found." }, { status: 403 });
  }

  const cookieStore = await cookies();

  cookieStore.set(activeWorkspaceCookieName, workspaceId, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
  });

  return NextResponse.json({ status: true });
}