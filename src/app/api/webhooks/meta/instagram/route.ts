import { NextResponse } from "next/server";
import { IntegrationProvider, LeadSourceType, MessageChannel } from "@/generated/prisma/client";
import { parseMessagingChannelIntegrationConfig } from "@/lib/integrations";
import { enqueueWebhookProcessing } from "@/lib/jobs";
import {
  normalizeInboundDirectMessagePayload,
  processNormalizedInboundLead,
} from "@/lib/lead-normalization";
import { prisma } from "@/lib/prisma";
import { verifyIncomingWebhookSignature } from "@/lib/webhook-signature";

function getStringValue(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

async function resolveInstagramConnection(params: {
  recipientIdentifier: string | null;
  verifyToken: string | null;
  workspaceId: string | null;
}) {
  const connections = await prisma.integrationConnection.findMany({
    where: {
      enabled: true,
      provider: IntegrationProvider.INSTAGRAM,
      ...(params.workspaceId ? { workspaceId: params.workspaceId } : {}),
    },
    select: {
      config: true,
      workspaceId: true,
    },
  });

  return (
    connections
      .map((connection) => ({
        config: parseMessagingChannelIntegrationConfig(connection.config),
        workspaceId: connection.workspaceId,
      }))
      .find(({ config }) => {
        if (params.verifyToken && config.verifyToken && config.verifyToken === params.verifyToken) {
          return true;
        }

        if (params.recipientIdentifier && config.senderIdentifier) {
          return config.senderIdentifier === params.recipientIdentifier;
        }

        return !params.recipientIdentifier;
      }) ?? null
  );
}

function extractInstagramMessage(body: Record<string, unknown>) {
  const entries = Array.isArray(body.entry) ? body.entry : [];

  for (const entry of entries) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const messagingEvents = Array.isArray((entry as { messaging?: unknown }).messaging)
      ? ((entry as { messaging: unknown[] }).messaging ?? [])
      : [];

    for (const event of messagingEvents) {
      if (event && typeof event === "object") {
        return event as Record<string, unknown>;
      }
    }
  }

  return body;
}

type InstagramWebhookDependencies = {
  enqueueWebhookProcessing: typeof enqueueWebhookProcessing;
  normalizeInboundDirectMessagePayload: typeof normalizeInboundDirectMessagePayload;
  processNormalizedInboundLead: typeof processNormalizedInboundLead;
  resolveInstagramConnection: typeof resolveInstagramConnection;
  verifyIncomingWebhookSignature: typeof verifyIncomingWebhookSignature;
};

const defaultInstagramWebhookDependencies: InstagramWebhookDependencies = {
  enqueueWebhookProcessing,
  normalizeInboundDirectMessagePayload,
  processNormalizedInboundLead,
  resolveInstagramConnection,
  verifyIncomingWebhookSignature,
};

export async function handleInstagramWebhookGet(
  request: Request,
  dependencies: Pick<InstagramWebhookDependencies, "resolveInstagramConnection"> = defaultInstagramWebhookDependencies,
) {
  const url = new URL(request.url);
  const verifyToken = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const workspaceId = url.searchParams.get("workspaceId");
  const connection = await dependencies.resolveInstagramConnection({
    recipientIdentifier: url.searchParams.get("recipientId"),
    verifyToken,
    workspaceId,
  });

  if (!connection || !verifyToken || connection.config.verifyToken !== verifyToken) {
    return NextResponse.json({ ok: false, error: "Instagram webhook verification failed." }, { status: 403 });
  }

  return new Response(challenge ?? "ok", { status: 200 });
}

export async function handleInstagramWebhookPost(
  request: Request,
  dependencies: InstagramWebhookDependencies = defaultInstagramWebhookDependencies,
) {
  const url = new URL(request.url);
  const rawBody = await request.text();
  const body = (() => {
    try {
      return JSON.parse(rawBody || "{}");
    } catch {
      return {};
    }
  })() as Record<string, unknown>;
  const messageEvent = extractInstagramMessage(body);
  const recipientIdentifier = getStringValue((messageEvent.recipient as { id?: unknown } | undefined)?.id) ?? getStringValue(body.recipientId);
  const workspaceId = getStringValue(url.searchParams.get("workspaceId")) ?? getStringValue(body.workspaceId);
  const connection = await dependencies.resolveInstagramConnection({
    recipientIdentifier,
    verifyToken: null,
    workspaceId,
  });

  if (!connection) {
    return NextResponse.json({ ok: false, error: "Instagram integration not configured." }, { status: 404 });
  }

  const isSignatureValid = dependencies.verifyIncomingWebhookSignature({
    rawBody,
    providedSignature: request.headers.get("x-roomflow-signature"),
    signingSecret: connection.config.verifyToken,
  });

  if (!isSignatureValid) {
    return NextResponse.json({ ok: false, error: "Invalid Instagram webhook signature." }, { status: 401 });
  }

  try {
    const sender = (messageEvent.sender as { id?: unknown } | undefined)?.id;
    const messageBody = getStringValue((messageEvent.message as { text?: unknown } | undefined)?.text)
      ?? getStringValue((messageEvent.postback as { payload?: unknown } | undefined)?.payload)
      ?? getStringValue(body.body)
      ?? "Inbound Instagram message";
    const normalized = dependencies.normalizeInboundDirectMessagePayload({
      workspaceId: connection.workspaceId,
      propertyId: getStringValue(url.searchParams.get("propertyId")) ?? getStringValue(body.propertyId),
      sourceName: connection.config.accountLabel || "Instagram",
      leadSourceType: LeadSourceType.OTHER,
      channel: MessageChannel.INSTAGRAM,
      fromIdentifier: getStringValue(sender) ?? "instagram-user",
      fromName: getStringValue(body.fromName) ?? undefined,
      body: messageBody,
      messageId: getStringValue((messageEvent.message as { mid?: unknown } | undefined)?.mid) ?? getStringValue(body.messageId) ?? undefined,
      threadId: getStringValue((messageEvent.message as { reply_to?: unknown } | undefined)?.reply_to) ?? getStringValue(body.threadId) ?? undefined,
      receivedAt: getStringValue((messageEvent as { timestamp?: unknown }).timestamp) ?? getStringValue(body.receivedAt) ?? undefined,
      metadata: body,
    });

    try {
      const jobId = await dependencies.enqueueWebhookProcessing(normalized);

      return NextResponse.json({ ok: true, queued: true, jobId });
    } catch {
      const result = await dependencies.processNormalizedInboundLead(normalized);

      return NextResponse.json({ ok: true, queued: false, result });
    }
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Invalid Instagram payload." },
      { status: 400 },
    );
  }
}

export async function GET(request: Request) {
  return handleInstagramWebhookGet(request);
}

export async function POST(request: Request) {
  return handleInstagramWebhookPost(request);
}