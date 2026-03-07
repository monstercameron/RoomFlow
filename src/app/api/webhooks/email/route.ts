import { NextResponse } from "next/server";
import { enqueueWebhookProcessing } from "@/lib/jobs";
import {
  normalizeInboundEmailPayload,
  processNormalizedInboundLead,
} from "@/lib/lead-normalization";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const body = await request.json().catch(() => ({}));
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
