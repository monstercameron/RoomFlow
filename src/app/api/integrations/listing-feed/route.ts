import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCurrentWorkspaceMembership } from "@/lib/app-data";
import {
  buildListingFeedPayload,
  parseListingFeedIntegrationConfig,
} from "@/lib/integrations";
import { prisma } from "@/lib/prisma";
import { activeWorkspaceCookieName, ensureWorkspaceForUser } from "@/lib/workspaces";
import { IntegrationProvider, PropertyLifecycleStatus } from "@/generated/prisma/client";

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

  return memberships.find((entry) => entry.workspaceId === params.preferredWorkspaceId) ?? memberships[0] ?? null;
}

function resolveProvider(providerValue: string | null) {
  if (providerValue === "zillow") {
    return IntegrationProvider.ZILLOW;
  }

  if (providerValue === "apartments-com") {
    return IntegrationProvider.APARTMENTS_COM;
  }

  return null;
}

type ListingFeedRouteDependencies = {
  buildListingFeedPayload: typeof buildListingFeedPayload;
  cookies: typeof cookies;
  getActiveWorkspace: (
    params: Parameters<typeof getActiveWorkspace>[0],
  ) => Promise<Awaited<ReturnType<typeof getActiveWorkspace>> | null>;
  getSession: (params: { headers: Awaited<ReturnType<typeof headers>> }) => ReturnType<typeof auth.api.getSession>;
  headers: typeof headers;
  integrationConnectionFindUnique: (args: {
    where: {
      workspaceId_provider: {
        workspaceId: string;
        provider: IntegrationProvider;
      };
    };
    select: {
      config: true;
      enabled: true;
    };
  }) => Promise<{ config: unknown; enabled: boolean } | null>;
  parseListingFeedIntegrationConfig: typeof parseListingFeedIntegrationConfig;
  propertyFindMany: (args: {
    where: {
      workspaceId: string;
      lifecycleStatus?: PropertyLifecycleStatus;
    };
    select: {
      addressLine1: true;
      id: true;
      lifecycleStatus: true;
      listingSourceExternalId: true;
      listingSourceUrl: true;
      locality: true;
      name: true;
      parkingAvailable: true;
      petsAllowed: true;
      rentableRoomCount: true;
      schedulingUrl: true;
      sharedBathroomCount: true;
      smokingAllowed: true;
      updatedAt: true;
    };
    orderBy: {
      updatedAt: "desc";
    };
  }) => Promise<
    Array<{
      addressLine1: string | null;
      id: string;
      lifecycleStatus: string;
      listingSourceExternalId: string | null;
      listingSourceUrl: string | null;
      locality: string | null;
      name: string;
      parkingAvailable: boolean;
      petsAllowed: boolean;
      rentableRoomCount: number | null;
      schedulingUrl: string | null;
      sharedBathroomCount: number | null;
      smokingAllowed: boolean;
      updatedAt: Date;
    }>
  >;
};

const defaultListingFeedRouteDependencies: ListingFeedRouteDependencies = {
  buildListingFeedPayload,
  cookies,
  getActiveWorkspace,
  getSession: auth.api.getSession,
  headers,
  integrationConnectionFindUnique: prisma.integrationConnection.findUnique.bind(prisma.integrationConnection),
  parseListingFeedIntegrationConfig,
  propertyFindMany: prisma.property.findMany.bind(prisma.property),
};

export async function handleListingFeedGet(
  request: Request,
  dependencies: ListingFeedRouteDependencies = defaultListingFeedRouteDependencies,
) {
  const session = await dependencies.getSession({
    headers: await dependencies.headers(),
  });

  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const requestUrl = new URL(request.url);
  const provider = resolveProvider(requestUrl.searchParams.get("provider"));

  if (!provider) {
    return NextResponse.json({ message: "Valid provider is required." }, { status: 400 });
  }

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

  const integrationConnection = await dependencies.integrationConnectionFindUnique({
    where: {
      workspaceId_provider: {
        workspaceId: membership.workspaceId,
        provider,
      },
    },
    select: {
      config: true,
      enabled: true,
    },
  });

  const config = dependencies.parseListingFeedIntegrationConfig(integrationConnection?.config);
  const properties = await dependencies.propertyFindMany({
    where: {
      workspaceId: membership.workspaceId,
      ...(config.includeOnlyActiveProperties ? { lifecycleStatus: PropertyLifecycleStatus.ACTIVE } : {}),
    },
    select: {
      addressLine1: true,
      id: true,
      lifecycleStatus: true,
      listingSourceExternalId: true,
      listingSourceUrl: true,
      locality: true,
      name: true,
      parkingAvailable: true,
      petsAllowed: true,
      rentableRoomCount: true,
      schedulingUrl: true,
      sharedBathroomCount: true,
      smokingAllowed: true,
      updatedAt: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
  const payload = dependencies.buildListingFeedPayload({
    feedLabel: config.feedLabel,
    properties,
    providerLabel: provider === IntegrationProvider.ZILLOW ? "Zillow" : "Apartments.com",
    workspaceName: membership.workspace.name,
    workspaceSlug: membership.workspace.slug,
  });

  return NextResponse.json({
    destinationName: config.destinationName,
    destinationPath: config.destinationPath,
    enabled: integrationConnection?.enabled ?? false,
    payload,
  });
}

export async function GET(request: Request) {
  return handleListingFeedGet(request);
}