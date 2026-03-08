import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type SignupPreflightDependencies = {
  findUserByEmail: (email: string) => Promise<{ id: string } | null>;
};

const defaultSignupPreflightDependencies: SignupPreflightDependencies = {
  findUserByEmail: (email) =>
    prisma.user.findUnique({
      where: { email },
      select: { id: true },
    }),
};

export async function handleSignupPreflightPost(
  request: Request,
  dependencies: SignupPreflightDependencies = defaultSignupPreflightDependencies,
) {
  const payload = (await request.json().catch(() => null)) as { email?: string } | null;
  const normalizedEmail = payload?.email?.trim().toLowerCase() ?? "";

  if (!normalizedEmail) {
    return NextResponse.json({ message: "Email is required." }, { status: 400 });
  }

  const existingUser = await dependencies.findUserByEmail(normalizedEmail);

  return NextResponse.json({ exists: Boolean(existingUser) });
}

export async function POST(request: Request) {
  return handleSignupPreflightPost(request);
}