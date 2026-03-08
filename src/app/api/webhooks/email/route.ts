import { NextResponse } from "next/server";
import { enqueueWebhookProcessing } from "@/lib/jobs";
import {
  normalizeInboundEmailPayload,
  processNormalizedInboundLead,
} from "@/lib/lead-normalization";
import { verifyIncomingWebhookSignature } from "@/lib/webhook-signature";

type EmailWebhookDependencies = {
  enqueueWebhookProcessing: typeof enqueueWebhookProcessing;
  normalizeInboundEmailPayload: typeof normalizeInboundEmailPayload;
  processNormalizedInboundLead: typeof processNormalizedInboundLead;
  verifyIncomingWebhookSignature: typeof verifyIncomingWebhookSignature;
};

const defaultEmailWebhookDependencies: EmailWebhookDependencies = {
  enqueueWebhookProcessing,
  normalizeInboundEmailPayload,
  processNormalizedInboundLead,
  verifyIncomingWebhookSignature,
};

export async function handleEmailWebhookPost(
  request: Request,
  dependencies: EmailWebhookDependencies = defaultEmailWebhookDependencies,
) {
  const url = new URL(request.url);
  const rawBody = await request.text();
  const body = (() => {
    try {
      return JSON.parse(rawBody || "{}");
    } catch {
      return {};
    }
  })();
  const isSignatureValid = dependencies.verifyIncomingWebhookSignature({
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
    const normalized = dependencies.normalizeInboundEmailPayload({
      ...body,
      workspaceId,
      propertyId,
    });

    try {
      const jobId = await dependencies.enqueueWebhookProcessing(normalized);

      return NextResponse.json({
        ok: true,
        queued: true,
        jobId,
      });
    } catch {
      const result = await dependencies.processNormalizedInboundLead(normalized);

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

export async function POST(request: Request) {
  return handleEmailWebhookPost(request);
}
