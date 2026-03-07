import { NextResponse } from "next/server";
import { enqueueWebhookProcessing } from "@/lib/jobs";
import {
  normalizeInboundEmailPayload,
  processNormalizedInboundLead,
} from "@/lib/lead-normalization";
import { verifyIncomingWebhookSignature } from "@/lib/webhook-signature";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const rawBody = await request.text();
  const body = (() => {
    try {
      return JSON.parse(rawBody || "{}");
    } catch {
      return {};
    }
  })();
  const isSignatureValid = verifyIncomingWebhookSignature({
    rawBody,
    providedSignature: request.headers.get("x-roomflow-signature"),
    signingSecret: process.env.INBOUND_WEBHOOK_SIGNING_SECRET,
  });

  if (!isSignatureValid) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid webhook signature.",
      },
      { status: 401 },
    );
  }

  const workspaceId =
    url.searchParams.get("workspaceId") ?? body.workspaceId ?? null;
  const propertyId =
    url.searchParams.get("propertyId") ?? body.propertyId ?? null;

  try {
    const normalized = normalizeInboundEmailPayload({
      ...body,
      workspaceId,
      propertyId,
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
        error: error instanceof Error ? error.message : "Invalid email webhook payload.",
      },
      { status: 400 },
    );
  }
}
