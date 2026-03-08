import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  buildCsvDocument,
  buildCsvExportFileName,
  extractAuditEventChannel,
  extractAuditEventReason,
  formatCsvExportTimestamp,
  isCsvExportDataset,
  serializeAuditEventPayloadSummary,
} from "@/lib/integrations";
import { activeWorkspaceCookieName, ensureWorkspaceForUser } from "@/lib/workspaces";

type CsvExportDatasetValue = Parameters<typeof buildCsvExportFileName>[0]["dataset"];
type AuditPayloadValue = Parameters<typeof extractAuditEventChannel>[0];

async function getActiveWorkspace(params: {
  preferredWorkspaceId: string | null;
  user: {
    email?: string | null;
    id: string;
    name?: string | null;
  };
}) {
  await ensureWorkspaceForUser({
    email: params.user.email ?? `${params.user.id}@example.com`,
    id: params.user.id,
    name: params.user.name,
  });

  const memberships = await prisma.membership.findMany({
    where: {
      userId: params.user.id,
    },
    include: {
      workspace: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  const membership =
    memberships.find((entry) => entry.workspaceId === params.preferredWorkspaceId) ?? memberships[0];

  return membership ?? null;
}

type CsvExportRouteDependencies = {
  auditEventFindMany: (args: {
    where: {
      workspaceId: string;
    };
    include: {
      actorUser: true;
      lead: true;
      property: true;
    };
    orderBy: {
      createdAt: "desc";
    };
  }) => Promise<
    Array<{
      id: string;
      createdAt: Date;
      eventType: string;
      actorType: string;
      actorUser: { name: string | null; email: string | null } | null;
      leadId: string | null;
      lead: { fullName: string | null } | null;
      property: { name: string } | null;
      payload: AuditPayloadValue;
    }>
  >;
  buildCsvDocument: typeof buildCsvDocument;
  buildCsvExportFileName: typeof buildCsvExportFileName;
  cookies: typeof cookies;
  extractAuditEventChannel: typeof extractAuditEventChannel;
  extractAuditEventReason: typeof extractAuditEventReason;
  formatCsvExportTimestamp: typeof formatCsvExportTimestamp;
  getActiveWorkspace: (
    params: Parameters<typeof getActiveWorkspace>[0],
  ) => Promise<Awaited<ReturnType<typeof getActiveWorkspace>> | null>;
  getSession: (params: { headers: Awaited<ReturnType<typeof headers>> }) => ReturnType<typeof auth.api.getSession>;
  headers: typeof headers;
  isCsvExportDataset: (value: string) => boolean;
  leadFindMany: (args: {
    where: {
      workspaceId: string;
    };
    include: {
      leadSource: true;
      property: true;
    };
    orderBy: {
      createdAt: "desc";
    };
  }) => Promise<
    Array<{
      id: string;
      createdAt: Date;
      updatedAt: Date;
      fullName: string;
      email: string | null;
      phone: string | null;
      status: string;
      fitResult: string;
      property: { name: string } | null;
      leadSource: { name: string; type: string } | null;
      preferredContactChannel: string | null;
      moveInDate: Date | null;
      monthlyBudget: number | null;
      stayLengthMonths: number | null;
      workStatus: string | null;
      lastActivityAt: Date | null;
      notes: string | null;
    }>
  >;
  messageFindMany: (args: {
    where: {
      conversation: {
        lead: {
          workspaceId: string;
        };
      };
    };
    include: {
      conversation: {
        include: {
          lead: {
            include: {
              property: true;
            };
          };
        };
      };
    };
    orderBy: {
      createdAt: "desc";
    };
  }) => Promise<
    Array<{
      id: string;
      createdAt: Date;
      sentAt: Date | null;
      receivedAt: Date | null;
      conversationId: string;
      conversation: {
        lead: {
          id: string;
          fullName: string;
          email: string | null;
          property: { name: string } | null;
        };
      };
      direction: string;
      origin: string;
      channel: string;
      subject: string | null;
      body: string;
      deliveryStatus: string | null;
      externalMessageId: string | null;
      externalThreadId: string | null;
    }>
  >;
  serializeAuditEventPayloadSummary: typeof serializeAuditEventPayloadSummary;
};

const defaultCsvExportRouteDependencies: CsvExportRouteDependencies = {
  auditEventFindMany: prisma.auditEvent.findMany.bind(prisma.auditEvent),
  buildCsvDocument,
  buildCsvExportFileName,
  cookies,
  extractAuditEventChannel,
  extractAuditEventReason,
  formatCsvExportTimestamp,
  getActiveWorkspace,
  getSession: auth.api.getSession,
  headers,
  isCsvExportDataset,
  leadFindMany: prisma.lead.findMany.bind(prisma.lead),
  messageFindMany: prisma.message.findMany.bind(prisma.message),
  serializeAuditEventPayloadSummary,
};

export async function handleCsvExportGet(
  request: Request,
  dependencies: CsvExportRouteDependencies = defaultCsvExportRouteDependencies,
) {
  const session = await dependencies.getSession({
    headers: await dependencies.headers(),
  });

  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const requestUrl = new URL(request.url);
  const dataset = requestUrl.searchParams.get("dataset");

  if (!dataset || !dependencies.isCsvExportDataset(dataset)) {
    return NextResponse.json(
      { message: "Valid dataset query parameter is required." },
      { status: 400 },
    );
  }

  const exportDataset = dataset as CsvExportDatasetValue;

  const cookieStore = await dependencies.cookies();
  const requestedWorkspaceId = requestUrl.searchParams.get("workspaceId");
  const membership = await dependencies.getActiveWorkspace({
    preferredWorkspaceId:
      requestedWorkspaceId ?? cookieStore.get(activeWorkspaceCookieName)?.value ?? null,
    user: session.user,
  });

  if (!membership) {
    return NextResponse.json({ message: "Workspace access not found." }, { status: 403 });
  }

  if (requestedWorkspaceId && requestedWorkspaceId !== membership.workspaceId) {
    return NextResponse.json({ message: "Workspace access not found." }, { status: 403 });
  }

  if (dataset === "leads") {
    const leads = await dependencies.leadFindMany({
      where: {
        workspaceId: membership.workspaceId,
      },
      include: {
        leadSource: true,
        property: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    const csvDocument = dependencies.buildCsvDocument({
      headers: [
        "leadId",
        "createdAt",
        "updatedAt",
        "fullName",
        "email",
        "phone",
        "status",
        "fitResult",
        "propertyName",
        "leadSourceName",
        "leadSourceType",
        "preferredContactChannel",
        "moveInDate",
        "monthlyBudget",
        "stayLengthMonths",
        "workStatus",
        "lastActivityAt",
        "notes",
      ],
      rows: leads.map((lead) => [
        lead.id,
        dependencies.formatCsvExportTimestamp(lead.createdAt),
        dependencies.formatCsvExportTimestamp(lead.updatedAt),
        lead.fullName,
        lead.email,
        lead.phone,
        lead.status,
        lead.fitResult,
        lead.property?.name ?? "",
        lead.leadSource?.name ?? "",
        lead.leadSource?.type ?? "",
        lead.preferredContactChannel ?? "",
        dependencies.formatCsvExportTimestamp(lead.moveInDate),
        lead.monthlyBudget,
        lead.stayLengthMonths,
        lead.workStatus,
        dependencies.formatCsvExportTimestamp(lead.lastActivityAt),
        lead.notes,
      ]),
    });

    return new Response(csvDocument, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="${dependencies.buildCsvExportFileName({ dataset: exportDataset, workspaceSlug: membership.workspace.slug })}"`,
        "Content-Type": "text/csv; charset=utf-8",
      },
      status: 200,
    });
  }

  if (dataset === "messages") {
    const messages = await dependencies.messageFindMany({
      where: {
        conversation: {
          lead: {
            workspaceId: membership.workspaceId,
          },
        },
      },
      include: {
        conversation: {
          include: {
            lead: {
              include: {
                property: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    const csvDocument = dependencies.buildCsvDocument({
      headers: [
        "messageId",
        "createdAt",
        "sentAt",
        "receivedAt",
        "conversationId",
        "leadId",
        "leadFullName",
        "leadEmail",
        "propertyName",
        "direction",
        "origin",
        "channel",
        "subject",
        "body",
        "deliveryStatus",
        "externalMessageId",
        "externalThreadId",
      ],
      rows: messages.map((message) => [
        message.id,
        dependencies.formatCsvExportTimestamp(message.createdAt),
        dependencies.formatCsvExportTimestamp(message.sentAt),
        dependencies.formatCsvExportTimestamp(message.receivedAt),
        message.conversationId,
        message.conversation.lead.id,
        message.conversation.lead.fullName,
        message.conversation.lead.email,
        message.conversation.lead.property?.name ?? "",
        message.direction,
        message.origin,
        message.channel,
        message.subject,
        message.body,
        message.deliveryStatus,
        message.externalMessageId,
        message.externalThreadId,
      ]),
    });

    return new Response(csvDocument, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="${dependencies.buildCsvExportFileName({ dataset: exportDataset, workspaceSlug: membership.workspace.slug })}"`,
        "Content-Type": "text/csv; charset=utf-8",
      },
      status: 200,
    });
  }

  const auditEvents = await dependencies.auditEventFindMany({
    where: {
      workspaceId: membership.workspaceId,
    },
    include: {
      actorUser: true,
      lead: true,
      property: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
  const csvDocument = dependencies.buildCsvDocument({
    headers: [
      "eventId",
      "createdAt",
      "eventType",
      "actorType",
      "actorName",
      "actorEmail",
      "leadId",
      "leadFullName",
      "propertyName",
      "channel",
      "reason",
      "payloadJson",
    ],
    rows: auditEvents.map((event) => [
      event.id,
      dependencies.formatCsvExportTimestamp(event.createdAt),
      event.eventType,
      event.actorType,
      event.actorUser?.name ?? "",
      event.actorUser?.email ?? "",
      event.leadId,
      event.lead?.fullName ?? "",
      event.property?.name ?? "",
      dependencies.extractAuditEventChannel(event.payload),
      dependencies.extractAuditEventReason(event.payload),
      dependencies.serializeAuditEventPayloadSummary(event.payload),
    ]),
  });

  return new Response(csvDocument, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${dependencies.buildCsvExportFileName({ dataset: exportDataset, workspaceSlug: membership.workspace.slug })}"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
    status: 200,
  });
}

export async function GET(request: Request) {
  return handleCsvExportGet(request);
}