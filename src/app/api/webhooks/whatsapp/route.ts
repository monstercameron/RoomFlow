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

function parseWebhookPayload(contentType: string, rawBody: string): Record<string, unknown> {
  if (contentType.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(rawBody).entries());
  }

  try {
    return JSON.parse(rawBody || "{}");
  } catch {
    return {};
  }
}

function getStringValue(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function stripWhatsAppPrefix(value: string | null) {
  return value?.replace(/^whatsapp:/i, "") ?? null;
}

async function resolveWhatsAppConnection(params: { senderIdentifier: string | null; workspaceId: string | null }) {
  const connections = await prisma.integrationConnection.findMany({
    where: {
      enabled: true,
      provider: IntegrationProvider.WHATSAPP,
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
        if (!params.senderIdentifier || !config.senderIdentifier) {
          return true;
        }

        return stripWhatsAppPrefix(config.senderIdentifier) === stripWhatsAppPrefix(params.senderIdentifier);
      }) ?? null
  );
}

type WhatsAppWebhookDependencies = {
  enqueueWebhookProcessing: typeof enqueueWebhookProcessing;
  normalizeInboundDirectMessagePayload: typeof normalizeInboundDirectMessagePayload;
  processNormalizedInboundLead: typeof processNormalizedInboundLead;
  resolveWhatsAppConnection: typeof resolveWhatsAppConnection;
  verifyIncomingWebhookSignature: typeof verifyIncomingWebhookSignature;
};

const defaultWhatsAppWebhookDependencies: WhatsAppWebhookDependencies = {
  enqueueWebhookProcessing,
  normalizeInboundDirectMessagePayload,
  processNormalizedInboundLead,
  resolveWhatsAppConnection,
  verifyIncomingWebhookSignature,
};

export async function handleWhatsAppWebhookPost(
  request: Request,
  dependencies: WhatsAppWebhookDependencies = defaultWhatsAppWebhookDependencies,
) {
  const url = new URL(request.url);
  const contentType = request.headers.get("content-type") ?? "";
  const rawBody = await request.text();
  const body = parseWebhookPayload(contentType, rawBody);
  const workspaceId = getStringValue(url.searchParams.get("workspaceId")) ?? getStringValue(body.workspaceId);
  const senderIdentifier = getStringValue(body.To) ?? getStringValue(body.senderIdentifier);
  const connection = await dependencies.resolveWhatsAppConnection({ senderIdentifier, workspaceId });

  if (!connection) {
    return NextResponse.json({ ok: false, error: "WhatsApp integration not configured." }, { status: 404 });
  }

  const isSignatureValid = dependencies.verifyIncomingWebhookSignature({
    rawBody,
    providedSignature: request.headers.get("x-roomflow-signature"),
    signingSecret: connection.config.verifyToken,
  });

  if (!isSignatureValid) {
    return NextResponse.json({ ok: false, error: "Invalid WhatsApp webhook signature." }, { status: 401 });
  }

  try {
    const normalized = dependencies.normalizeInboundDirectMessagePayload({
      workspaceId: connection.workspaceId,
      propertyId: getStringValue(url.searchParams.get("propertyId")) ?? getStringValue(body.propertyId),
      sourceName: connection.config.accountLabel || "WhatsApp",
      leadSourceType: LeadSourceType.OTHER,
      channel: MessageChannel.WHATSAPP,
      fromIdentifier: stripWhatsAppPrefix(getStringValue(body.From)) ?? "unknown-whatsapp-user",
      fromName: getStringValue(body.ProfileName) ?? getStringValue(body.fromName) ?? undefined,
      body: getStringValue(body.Body) ?? getStringValue(body.body) ?? "Inbound WhatsApp message",
      messageId: getStringValue(body.MessageSid) ?? getStringValue(body.messageId) ?? undefined,
      threadId: getStringValue(body.ConversationSid) ?? getStringValue(body.threadId) ?? undefined,
      receivedAt: getStringValue(body.receivedAt) ?? undefined,
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
      { ok: false, error: error instanceof Error ? error.message : "Invalid WhatsApp payload." },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  return handleWhatsAppWebhookPost(request);
}