import { Resend } from "resend";
import { MembershipRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey || apiKey === "replace-me") {
    return null;
  }

  return new Resend(apiKey);
}

export async function sendOwnerAdminNotificationEmail(params: {
  workspaceId: string;
  subject: string;
  body: string;
}) {
  const resendClient = getResendClient();

  if (!resendClient) {
    return;
  }

  const ownerAndAdminMemberships = await prisma.membership.findMany({
    where: {
      workspaceId: params.workspaceId,
      role: {
        in: [MembershipRole.OWNER, MembershipRole.ADMIN],
      },
    },
    include: {
      user: {
        select: {
          email: true,
        },
      },
    },
  });

  const recipientEmailAddresses = ownerAndAdminMemberships
    .map((membership) => membership.user.email)
    .filter((emailAddress) => emailAddress.length > 0);

  if (recipientEmailAddresses.length === 0) {
    return;
  }

  await resendClient.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "alerts@roomflow.local",
    to: recipientEmailAddresses,
    subject: params.subject,
    text: params.body,
  });
}
