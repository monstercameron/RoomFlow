import { NextResponse } from "next/server";
import { enqueueWebhookProcessing } from "@/lib/jobs";
import {
  normalizeInboundSmsPayload,
  processNormalizedInboundLead,
} from "@/lib/lead-normalization";

async function readPayload(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const formData = await request.formData();

    return Object.fromEntries(formData.entries());
  }

  return request.json().catch(() => ({}));
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const body = await readPayload(request);
  const workspaceId =
    url.searchParams.get("workspaceId") ??
    (typeof body.workspaceId === "string" ? body.workspaceId : null);
  const propertyId =
    url.searchParams.get("propertyId") ??
    (typeof body.propertyId === "string" ? body.propertyId : null);

  try {
    const normalized = normalizeInboundSmsPayload({
      workspaceId,
      propertyId,
      sourceName:
        typeof body.sourceName === "string" ? body.sourceName : "Inbound SMS",
      fromPhone:
        typeof body.fromPhone === "string"
          ? body.fromPhone
          : typeof body.From === "string"
            ? body.From
            : "",
      fromName:
        typeof body.fromName === "string"
          ? body.fromName
          : typeof body.ProfileName === "string"
            ? body.ProfileName
            : undefined,
      body:
        typeof body.body === "string"
          ? body.body
          : typeof body.Body === "string"
            ? body.Body
            : "",
      messageId:
        typeof body.messageId === "string"
          ? body.messageId
          : typeof body.MessageSid === "string"
            ? body.MessageSid
            : undefined,
      threadId:
        typeof body.threadId === "string"
          ? body.threadId
          : typeof body.ConversationSid === "string"
            ? body.ConversationSid
            : undefined,
      metadata: body,
    });

    try {
      const jobId = await enqueueWebhookProcessing(normalized);

      return NextResponse.json({
        ok: true,
        queued: true,
        jobId,
      });
    } catch {
      const result = await processNormalizedInboundLead(normalized);

      return NextResponse.json({
        ok: true,
        queued: false,
        result,
      });
    }
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Invalid SMS webhook payload.",
      },
      { status: 400 },
    );
  }
}
