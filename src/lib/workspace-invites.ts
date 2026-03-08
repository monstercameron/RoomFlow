import { createHash, randomBytes } from "node:crypto";
import { MembershipRole } from "@/generated/prisma/client";
import { sendWorkspaceInviteEmail } from "@/lib/auth-email";
import { prisma } from "@/lib/prisma";

const workspaceInviteLifetimeInDays = 7;

export type WorkspaceInviteStatus = "accepted" | "expired" | "pending" | "revoked";

type WorkspaceInviteStatusRecord = {
  acceptedAt: Date | null;
  expiresAt: Date;
  revokedAt: Date | null;
};

export class WorkspaceInviteError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export function normalizeWorkspaceInviteEmailAddress(emailAddress: string) {
  return emailAddress.trim().toLowerCase();
}

export function hashWorkspaceInviteToken(rawInviteToken: string) {
  return createHash("sha256").update(rawInviteToken).digest("hex");
}

export function buildWorkspaceInvitePath(rawInviteToken: string) {
  return `/invite/${encodeURIComponent(rawInviteToken)}`;
}

export function getWorkspaceInviteStatus(
  workspaceInvite: WorkspaceInviteStatusRecord,
  referenceDate = new Date(),
): WorkspaceInviteStatus {
  if (workspaceInvite.acceptedAt) {
    return "accepted";
  }

  if (workspaceInvite.revokedAt) {
    return "revoked";
  }

  if (workspaceInvite.expiresAt.getTime() <= referenceDate.getTime()) {
    return "expired";
  }

  return "pending";
}

export function canMembershipRoleManageWorkspaceInvites(membershipRole: MembershipRole) {
  return membershipRole === MembershipRole.OWNER || membershipRole === MembershipRole.ADMIN;
}

export function getAssignableWorkspaceInviteRoles(
  membershipRole: MembershipRole,
): MembershipRole[] {
  if (membershipRole === MembershipRole.OWNER) {
    return [MembershipRole.ADMIN, MembershipRole.MANAGER, MembershipRole.VIEWER];
  }

  if (membershipRole === MembershipRole.ADMIN) {
    return [MembershipRole.MANAGER, MembershipRole.VIEWER];
  }

  return [];
}

function buildWorkspaceInviteUrl(rawInviteToken: string) {
  const applicationBaseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL ?? "http://127.0.0.1:3001";

  return new URL(buildWorkspaceInvitePath(rawInviteToken), applicationBaseUrl).toString();
}

function createWorkspaceInviteExpiryDate() {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + workspaceInviteLifetimeInDays);
  return expiryDate;
}

export async function createWorkspaceInvite(params: {
  invitedEmailAddress: string;
  invitedRole: MembershipRole;
  inviterUserId: string;
  workspaceId: string;
}) {
  const normalizedInvitedEmailAddress = normalizeWorkspaceInviteEmailAddress(
    params.invitedEmailAddress,
  );

  const rawInviteToken = randomBytes(24).toString("hex");
  const inviteExpiryDate = createWorkspaceInviteExpiryDate();

  const createdWorkspaceInvite = await prisma.$transaction(async (transactionClient) => {
    const inviterMembership = await transactionClient.membership.findUnique({
      where: {
        userId_workspaceId: {
          userId: params.inviterUserId,
          workspaceId: params.workspaceId,
        },
      },
      include: {
        user: true,
        workspace: true,
      },
    });

    if (!inviterMembership) {
      throw new WorkspaceInviteError(
        "INVITER_NOT_FOUND",
        "Authenticated workspace membership is required to send invites.",
      );
    }

    if (!canMembershipRoleManageWorkspaceInvites(inviterMembership.role)) {
      throw new WorkspaceInviteError(
        "INVITE_PERMISSION_DENIED",
        "This workspace role cannot invite teammates.",
      );
    }

    if (!getAssignableWorkspaceInviteRoles(inviterMembership.role).includes(params.invitedRole)) {
      throw new WorkspaceInviteError(
        "INVALID_INVITE_ROLE",
        "This workspace role cannot grant the requested invite role.",
      );
    }

    const existingUser = await transactionClient.user.findUnique({
      where: {
        email: normalizedInvitedEmailAddress,
      },
      select: {
        id: true,
      },
    });

    if (existingUser) {
      const existingMembership = await transactionClient.membership.findUnique({
        where: {
          userId_workspaceId: {
            userId: existingUser.id,
            workspaceId: params.workspaceId,
          },
        },
      });

      if (existingMembership) {
        throw new WorkspaceInviteError(
          "ALREADY_MEMBER",
          "That user already belongs to this workspace.",
        );
      }
    }

    // Any prior pending invite for this workspace/email pair is revoked before a
    // fresh token is issued so only the newest link remains active.
    await transactionClient.workspaceInvite.updateMany({
      where: {
        workspaceId: params.workspaceId,
        email: normalizedInvitedEmailAddress,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return transactionClient.workspaceInvite.create({
      data: {
        email: normalizedInvitedEmailAddress,
        expiresAt: inviteExpiryDate,
        invitedByUserId: params.inviterUserId,
        role: params.invitedRole,
        tokenHash: hashWorkspaceInviteToken(rawInviteToken),
        workspaceId: params.workspaceId,
      },
      include: {
        invitedByUser: {
          select: {
            name: true,
          },
        },
        workspace: {
          select: {
            name: true,
          },
        },
      },
    });
  });

  await sendWorkspaceInviteEmail({
    inviteUrl: buildWorkspaceInviteUrl(rawInviteToken),
    invitedByName: createdWorkspaceInvite.invitedByUser.name,
    recipientEmailAddress: createdWorkspaceInvite.email,
    role: createdWorkspaceInvite.role,
    workspaceName: createdWorkspaceInvite.workspace.name,
  });

  return createdWorkspaceInvite;
}

export async function acceptWorkspaceInvite(params: {
  currentUserEmailAddress: string;
  currentUserId: string;
  rawInviteToken: string;
}) {
  const normalizedCurrentUserEmailAddress = normalizeWorkspaceInviteEmailAddress(
    params.currentUserEmailAddress,
  );
  const workspaceInvite = await prisma.workspaceInvite.findUnique({
    where: {
      tokenHash: hashWorkspaceInviteToken(params.rawInviteToken),
    },
    include: {
      workspace: true,
    },
  });

  if (!workspaceInvite) {
    throw new WorkspaceInviteError("INVITE_NOT_FOUND", "This workspace invite does not exist.");
  }

  const workspaceInviteStatus = getWorkspaceInviteStatus(workspaceInvite);

  if (workspaceInviteStatus === "accepted") {
    return {
      workspace: workspaceInvite.workspace,
    };
  }

  if (workspaceInviteStatus === "revoked") {
    throw new WorkspaceInviteError("INVITE_REVOKED", "This workspace invite has been revoked.");
  }

  if (workspaceInviteStatus === "expired") {
    throw new WorkspaceInviteError("INVITE_EXPIRED", "This workspace invite has expired.");
  }

  if (workspaceInvite.email !== normalizedCurrentUserEmailAddress) {
    throw new WorkspaceInviteError(
      "INVITE_EMAIL_MISMATCH",
      "Sign in with the invited email address before accepting this workspace invite.",
    );
  }

  return prisma.$transaction(async (transactionClient) => {
    const existingMembership = await transactionClient.membership.findUnique({
      where: {
        userId_workspaceId: {
          userId: params.currentUserId,
          workspaceId: workspaceInvite.workspaceId,
        },
      },
    });

    if (!existingMembership) {
      await transactionClient.membership.create({
        data: {
          role: workspaceInvite.role,
          userId: params.currentUserId,
          workspaceId: workspaceInvite.workspaceId,
        },
      });
    }

    await transactionClient.workspaceInvite.update({
      where: {
        id: workspaceInvite.id,
      },
      data: {
        acceptedAt: new Date(),
        acceptedByUserId: params.currentUserId,
      },
    });

    return {
      workspace: workspaceInvite.workspace,
    };
  });
}

export async function getWorkspaceInvitePreview(rawInviteToken: string) {
  const workspaceInvite = await prisma.workspaceInvite.findUnique({
    where: {
      tokenHash: hashWorkspaceInviteToken(rawInviteToken),
    },
    include: {
      invitedByUser: {
        select: {
          name: true,
        },
      },
      workspace: {
        select: {
          id: true,
          name: true,
          onboardingCompletedAt: true,
        },
      },
    },
  });

  if (!workspaceInvite) {
    return null;
  }

  return {
    email: workspaceInvite.email,
    expiresAt: workspaceInvite.expiresAt,
    invitedByName: workspaceInvite.invitedByUser.name,
    role: workspaceInvite.role,
    status: getWorkspaceInviteStatus(workspaceInvite),
    workspaceId: workspaceInvite.workspace.id,
    workspaceName: workspaceInvite.workspace.name,
    workspaceOnboardingCompletedAt: workspaceInvite.workspace.onboardingCompletedAt,
  };
}