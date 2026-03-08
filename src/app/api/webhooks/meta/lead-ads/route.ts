import { NextResponse } from "next/server";
import { IntegrationProvider } from "@/generated/prisma/client";
import { parseMetaLeadAdsIntegrationConfig } from "@/lib/integrations";
import { enqueueWebhookProcessing } from "@/lib/jobs";
import {
  normalizeInboundMetaLeadPayload,
  processNormalizedInboundLead,
} from "@/lib/lead-normalization";
import { prisma } from "@/lib/prisma";
import { verifyIncomingWebhookSignature } from "@/lib/webhook-signature";

function getStringValue(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function extractLeadValue(body: Record<string, unknown>) {
  const entryList = Array.isArray(body.entry) ? body.entry : [];

  for (const entry of entryList) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const changes = Array.isArray((entry as { changes?: unknown }).changes)
      ? ((entry as { changes: unknown[] }).changes ?? [])
      : [];

    for (const change of changes) {
      if (!change || typeof change !== "object") {
        continue;
      }

      const changeRecord = change as { field?: unknown; value?: unknown };

      if (changeRecord.field === "leadgen" && changeRecord.value && typeof changeRecord.value === "object") {
        return changeRecord.value as Record<string, unknown>;
      }
    }
  }

  if (body.lead && typeof body.lead === "object") {
    return body.lead as Record<string, unknown>;
  }

  return body;
}

function extractFieldDataMap(fieldData: unknown) {
  const dataEntries = Array.isArray(fieldData) ? fieldData : [];

  return Object.fromEntries(
    dataEntries
      .map((entry) => {
        if (!entry || typeof entry !== "object") {
          return null;
        }

        const sourceField = getStringValue((entry as { name?: unknown }).name);
        const values = Array.isArray((entry as { values?: unknown }).values)
          ? ((entry as { values: unknown[] }).values ?? []).filter(
              (value): value is string => typeof value === "string" && value.trim().length > 0,
            )
          : [];

        if (!sourceField || values.length === 0) {
          return null;
        }

        return [sourceField, values.join(" ")];
      })
      .filter((entry): entry is [string, string] => Boolean(entry)),
  );
}

function resolveMappedValue(params: {
  fallbackKeys: string[];
  fieldMappings: Array<{ sourceField: string; targetField: string }>;
  mappedFields: Record<string, string>;
  targetField: string;
}) {
  const explicitMapping = params.fieldMappings.find(
    (fieldMapping) => fieldMapping.targetField === params.targetField,
  );

  if (explicitMapping?.sourceField && params.mappedFields[explicitMapping.sourceField]) {
    return params.mappedFields[explicitMapping.sourceField];
  }

  for (const fallbackKey of params.fallbackKeys) {
    if (params.mappedFields[fallbackKey]) {
      return params.mappedFields[fallbackKey];
    }
  }

  return null;
}

async function resolveMetaConnection(params: {
  formId: string | null;
  pageId: string | null;
  workspaceId: string | null;
}) {
  const connections = await prisma.integrationConnection.findMany({
    where: {
      enabled: true,
      provider: IntegrationProvider.META_LEAD_ADS,
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
        config: parseMetaLeadAdsIntegrationConfig(connection.config),
        workspaceId: connection.workspaceId,
      }))
      .find(({ config }) => {
        if (params.pageId && config.pageId && config.pageId !== params.pageId) {
          return false;
        }

        if (params.formId && config.formId && config.formId !== params.formId) {
          return false;
        }

        return true;
      }) ?? null
  );
}

type MetaLeadAdsWebhookDependencies = {
  enqueueWebhookProcessing: typeof enqueueWebhookProcessing;
  normalizeInboundMetaLeadPayload: typeof normalizeInboundMetaLeadPayload;
  processNormalizedInboundLead: typeof processNormalizedInboundLead;
  resolveMetaConnection: typeof resolveMetaConnection;
  verifyIncomingWebhookSignature: typeof verifyIncomingWebhookSignature;
};

const defaultMetaLeadAdsWebhookDependencies: MetaLeadAdsWebhookDependencies = {
  enqueueWebhookProcessing,
  normalizeInboundMetaLeadPayload,
  processNormalizedInboundLead,
  resolveMetaConnection,
  verifyIncomingWebhookSignature,
};

export async function handleMetaLeadAdsWebhookGet(
  request: Request,
  dependencies: Pick<MetaLeadAdsWebhookDependencies, "resolveMetaConnection"> = defaultMetaLeadAdsWebhookDependencies,
) {
  const url = new URL(request.url);
  const verifyToken = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const workspaceId = url.searchParams.get("workspaceId");
  const pageId = url.searchParams.get("pageId");
  const formId = url.searchParams.get("formId");
  const connection = await dependencies.resolveMetaConnection({ formId, pageId, workspaceId });

  if (!connection || !verifyToken || connection.config.verifyToken !== verifyToken) {
    return NextResponse.json({ ok: false, error: "Meta webhook verification failed." }, { status: 403 });
  }

  return new Response(challenge ?? "ok", { status: 200 });
}

export async function handleMetaLeadAdsWebhookPost(
  request: Request,
  dependencies: MetaLeadAdsWebhookDependencies = defaultMetaLeadAdsWebhookDependencies,
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
  const leadValue = extractLeadValue(body);
  const workspaceId = getStringValue(url.searchParams.get("workspaceId")) ?? getStringValue(body.workspaceId);
  const pageId = getStringValue(leadValue.page_id) ?? getStringValue(body.pageId);
  const formId = getStringValue(leadValue.form_id) ?? getStringValue(body.formId);
  const connection = await dependencies.resolveMetaConnection({ formId, pageId, workspaceId });

  if (!connection) {
    return NextResponse.json({ ok: false, error: "Meta Lead Ads integration not configured for this payload." }, { status: 404 });
  }

  const isSignatureValid = dependencies.verifyIncomingWebhookSignature({
    rawBody,
    providedSignature: request.headers.get("x-hub-signature-256"),
    signingSecret: connection.config.appSecret,
  });

  if (!isSignatureValid) {
    return NextResponse.json({ ok: false, error: "Invalid Meta webhook signature." }, { status: 401 });
  }

  const fieldDataMap = extractFieldDataMap(leadValue.field_data ?? body.field_data);

  try {
    const normalized = dependencies.normalizeInboundMetaLeadPayload({
      workspaceId: connection.workspaceId,
      propertyId: getStringValue(url.searchParams.get("propertyId")) ?? getStringValue(body.propertyId),
      sourceName: connection.config.sourceLabel,
      fullName:
        resolveMappedValue({
          fallbackKeys: ["full_name", "name", "first_name"],
          fieldMappings: connection.config.fieldMappings,
          mappedFields: fieldDataMap,
          targetField: "fullName",
        }) ?? getStringValue(body.fullName),
      email:
        resolveMappedValue({
          fallbackKeys: ["email", "email_address"],
          fieldMappings: connection.config.fieldMappings,
          mappedFields: fieldDataMap,
          targetField: "email",
        }) ?? getStringValue(body.email),
      phone:
        resolveMappedValue({
          fallbackKeys: ["phone_number", "phone"],
          fieldMappings: connection.config.fieldMappings,
          mappedFields: fieldDataMap,
          targetField: "phone",
        }) ?? getStringValue(body.phone),
      notes:
        resolveMappedValue({
          fallbackKeys: ["notes", "message", "move_in_timeline"],
          fieldMappings: connection.config.fieldMappings,
          mappedFields: fieldDataMap,
          targetField: "notes",
        }) ?? getStringValue(body.notes),
      submissionId: getStringValue(leadValue.leadgen_id) ?? getStringValue(body.leadgen_id),
      submittedAt: getStringValue(leadValue.created_time) ?? getStringValue(body.created_time) ?? undefined,
      metadata: {
        ...body,
        fieldDataMap,
      },
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
      { ok: false, error: error instanceof Error ? error.message : "Invalid Meta lead payload." },
      { status: 400 },
    );
  }
}

export async function GET(request: Request) {
  return handleMetaLeadAdsWebhookGet(request);
}

export async function POST(request: Request) {
  return handleMetaLeadAdsWebhookPost(request);
}