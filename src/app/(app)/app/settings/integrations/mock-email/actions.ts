"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  getConfiguredEmailDeliveryClient,
  getConfiguredEmailDeliveryProvider,
  getConfiguredSenderEmailAddress,
} from "@/lib/email-delivery";
import { clearMockEmailMessages } from "@/lib/mock-email-service";
import { getCurrentWorkspaceState } from "@/lib/app-data";

const mockInboxPath = "/app/settings/integrations/mock-email";

export async function clearMockEmailInboxAction() {
  await getCurrentWorkspaceState();
  await clearMockEmailMessages();
  revalidatePath(mockInboxPath);
  redirect(`${mockInboxPath}?status=cleared`);
}

export async function sendMockEmailProbeAction(formData: FormData) {
  await getCurrentWorkspaceState();

  if (getConfiguredEmailDeliveryProvider() !== "mock") {
    redirect(`${mockInboxPath}?error=Mock+email+provider+is+not+active.`);
  }

  const recipientEmailAddress = `${formData.get("recipientEmailAddress") ?? ""}`.trim();
  const subject = `${formData.get("subject") ?? ""}`.trim();
  const text = `${formData.get("text") ?? ""}`.trim();
  const senderEmailAddress = getConfiguredSenderEmailAddress();
  const emailDeliveryClient = getConfiguredEmailDeliveryClient();

  if (!recipientEmailAddress || !subject || !text) {
    redirect(`${mockInboxPath}?error=Recipient%2C+subject%2C+and+body+are+required.`);
  }

  if (!senderEmailAddress || !emailDeliveryClient) {
    redirect(`${mockInboxPath}?error=Mock+email+delivery+is+not+configured.`);
  }

  await emailDeliveryClient.sendTextEmail({
    from: senderEmailAddress,
    to: [recipientEmailAddress],
    subject,
    text,
  });

  revalidatePath(mockInboxPath);
  redirect(`${mockInboxPath}?status=sent`);
}