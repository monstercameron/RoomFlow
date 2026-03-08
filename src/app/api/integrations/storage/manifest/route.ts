import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { IntegrationProvider } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import {
  buildStorageManifestPreview,
  parseS3CompatibleIntegrationConfig,
} from "@/lib/integrations";
import { prisma } from "@/lib/prisma";
import { activeWorkspaceCookieName, ensureWorkspaceForUser } from "@/lib/workspaces";

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

type StorageManifestRouteDependencies = {
  buildStorageManifestPreview: typeof buildStorageManifestPreview;
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
  parseS3CompatibleIntegrationConfig: typeof parseS3CompatibleIntegrationConfig;
};

const defaultStorageManifestRouteDependencies: StorageManifestRouteDependencies = {
  buildStorageManifestPreview,
  cookies,
  getActiveWorkspace,
  getSession: auth.api.getSession,
  headers,
  integrationConnectionFindUnique: prisma.integrationConnection.findUnique.bind(prisma.integrationConnection),
  parseS3CompatibleIntegrationConfig,
};

export async function handleStorageManifestGet(
  request: Request,
  dependencies: StorageManifestRouteDependencies = defaultStorageManifestRouteDependencies,
) {
  const session = await dependencies.getSession({
    headers: await dependencies.headers(),
  });

  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const requestUrl = new URL(request.url);
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
        provider: IntegrationProvider.S3_COMPATIBLE,
      },
    },
    select: {
      config: true,
      enabled: true,
    },
  });

  const config = dependencies.parseS3CompatibleIntegrationConfig(integrationConnection?.config);

  return NextResponse.json({
    bucket: config.bucket,
    enabled: integrationConnection?.enabled ?? false,
    endpointUrl: config.endpointUrl,
    preview: dependencies.buildStorageManifestPreview({
      basePath: config.basePath,
      workspaceSlug: membership.workspace.slug,
    }),
    region: config.region,
  });
}

export async function GET(request: Request) {
  return handleStorageManifestGet(request);
}