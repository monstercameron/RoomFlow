import assert from "node:assert/strict";
import test from "node:test";

async function getIntegrationRouteModules() {
  process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";

  const [listingFeedRoute, storageManifestRoute, csvExportRoute] = await Promise.all([
    import("./integrations/listing-feed/route"),
    import("./integrations/storage/manifest/route"),
    import("./integrations/csv-export/route"),
  ]);

  return {
    handleCsvExportGet: csvExportRoute.handleCsvExportGet,
    handleListingFeedGet: listingFeedRoute.handleListingFeedGet,
    handleStorageManifestGet: storageManifestRoute.handleStorageManifestGet,
  };
}

function createCookieStore(preferredWorkspaceId: string | null) {
  return {
    get(name: string) {
      if (name !== "roomflow_active_workspace_id" || !preferredWorkspaceId) {
        return undefined;
      }

      return { value: preferredWorkspaceId };
    },
  };
}

test("listing feed route enforces auth and provider validation", async () => {
  const { handleListingFeedGet } = await getIntegrationRouteModules();

  const unauthorizedResponse = await handleListingFeedGet(
    new Request("http://localhost/api/integrations/listing-feed?provider=zillow"),
    {
      buildListingFeedPayload: () => ({}) as never,
      cookies: async () => createCookieStore(null) as never,
      getActiveWorkspace: async () => null,
      getSession: async () => null,
      headers: async () => new Headers(),
      integrationConnectionFindUnique: async () => null,
      parseListingFeedIntegrationConfig: () => ({
        destinationName: null,
        destinationPath: null,
        feedLabel: "Listing feed",
        format: "json",
        includeOnlyActiveProperties: true,
      }),
      propertyFindMany: async () => [],
    },
  );
  assert.equal(unauthorizedResponse.status, 401);
  assert.deepEqual(await unauthorizedResponse.json(), { message: "Unauthorized" });

  const invalidProviderResponse = await handleListingFeedGet(
    new Request("http://localhost/api/integrations/listing-feed?provider=invalid"),
    {
      buildListingFeedPayload: () => ({}) as never,
      cookies: async () => createCookieStore(null) as never,
      getActiveWorkspace: async () => null,
      getSession: async () => ({ user: { id: "user_1", email: "owner@roomflow.local" } }) as never,
      headers: async () => new Headers(),
      integrationConnectionFindUnique: async () => null,
      parseListingFeedIntegrationConfig: () => ({
        destinationName: null,
        destinationPath: null,
        feedLabel: "Listing feed",
        format: "json",
        includeOnlyActiveProperties: true,
      }),
      propertyFindMany: async () => [],
    },
  );
  assert.equal(invalidProviderResponse.status, 400);
  assert.deepEqual(await invalidProviderResponse.json(), {
    message: "Valid provider is required.",
  });
});

test("listing feed route enforces workspace access and shapes successful payloads", async () => {
  const { handleListingFeedGet } = await getIntegrationRouteModules();
  let propertyQuery: unknown = null;

  const forbiddenResponse = await handleListingFeedGet(
    new Request("http://localhost/api/integrations/listing-feed?provider=zillow&workspaceId=workspace_2"),
    {
      buildListingFeedPayload: () => ({}) as never,
      cookies: async () => createCookieStore("workspace_2") as never,
      getActiveWorkspace: async () => null,
      getSession: async () => ({ user: { id: "user_1", email: "owner@roomflow.local" } }) as never,
      headers: async () => new Headers(),
      integrationConnectionFindUnique: async () => null,
      parseListingFeedIntegrationConfig: () => ({
        destinationName: null,
        destinationPath: null,
        feedLabel: "Listing feed",
        format: "json",
        includeOnlyActiveProperties: true,
      }),
      propertyFindMany: async () => [],
    },
  );
  assert.equal(forbiddenResponse.status, 403);
  assert.deepEqual(await forbiddenResponse.json(), {
    message: "Workspace access not found.",
  });

  const successResponse = await handleListingFeedGet(
    new Request("http://localhost/api/integrations/listing-feed?provider=zillow"),
    {
      buildListingFeedPayload: ({ feedLabel, providerLabel, properties, workspaceName, workspaceSlug }) => ({
        feedLabel,
        providerLabel,
        propertyCount: properties.length,
        workspaceName,
        workspaceSlug,
      }) as never,
      cookies: async () => createCookieStore("workspace_1") as never,
      getActiveWorkspace: async () =>
        ({
          workspaceId: "workspace_1",
          workspace: { name: "Roomflow Ops", slug: "roomflow-ops" },
        }) as never,
      getSession: async () => ({ user: { id: "user_1", email: "owner@roomflow.local" } }) as never,
      headers: async () => new Headers(),
      integrationConnectionFindUnique: async () =>
        ({ config: { includeOnlyActiveProperties: true, feedLabel: "Zillow sync" }, enabled: true }) as never,
      parseListingFeedIntegrationConfig: (config) =>
        ({
          destinationName: "Zillow",
          destinationPath: "https://partner.example.com/feed",
          feedLabel: (config as { feedLabel?: string }).feedLabel ?? "Listing feed",
          format: "json",
          includeOnlyActiveProperties: true,
        }) as never,
      propertyFindMany: async (query) => {
        propertyQuery = query;
        return [
          {
            id: "property_1",
            name: "Maple House",
            lifecycleStatus: "ACTIVE",
            updatedAt: new Date("2026-03-08T00:00:00.000Z"),
            addressLine1: "123 Maple St",
            listingSourceExternalId: null,
            listingSourceUrl: null,
            locality: "Seattle",
            parkingAvailable: true,
            petsAllowed: false,
            rentableRoomCount: 4,
            schedulingUrl: null,
            sharedBathroomCount: 2,
            smokingAllowed: false,
          },
        ] as never;
      },
    },
  );

  assert.equal(successResponse.status, 200);
  assert.deepEqual(propertyQuery, {
    where: {
      workspaceId: "workspace_1",
      lifecycleStatus: "ACTIVE",
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
  assert.deepEqual(await successResponse.json(), {
    destinationName: "Zillow",
    destinationPath: "https://partner.example.com/feed",
    enabled: true,
    payload: {
      feedLabel: "Zillow sync",
      providerLabel: "Zillow",
      propertyCount: 1,
      workspaceName: "Roomflow Ops",
      workspaceSlug: "roomflow-ops",
    },
  });
});

test("storage manifest route enforces auth and returns manifest data", async () => {
  const { handleStorageManifestGet } = await getIntegrationRouteModules();

  const unauthorizedResponse = await handleStorageManifestGet(
    new Request("http://localhost/api/integrations/storage/manifest"),
    {
      buildStorageManifestPreview: () => [] as never,
      cookies: async () => createCookieStore(null) as never,
      getActiveWorkspace: async () => null,
      getSession: async () => null,
      headers: async () => new Headers(),
      integrationConnectionFindUnique: async () => null,
      parseS3CompatibleIntegrationConfig: () => ({
        accessKeyIdHint: null,
        basePath: "roomflow",
        bucket: null,
        endpointUrl: null,
        region: null,
        secretAccessKeyHint: null,
      }),
    },
  );
  assert.equal(unauthorizedResponse.status, 401);

  const successResponse = await handleStorageManifestGet(
    new Request("http://localhost/api/integrations/storage/manifest"),
    {
      buildStorageManifestPreview: ({ basePath, workspaceSlug }) =>
        [`${basePath}/${workspaceSlug}/exports/leads.csv`] as never,
      cookies: async () => createCookieStore("workspace_1") as never,
      getActiveWorkspace: async () =>
        ({
          workspaceId: "workspace_1",
          workspace: { slug: "roomflow-ops" },
        }) as never,
      getSession: async () => ({ user: { id: "user_1", email: "owner@roomflow.local" } }) as never,
      headers: async () => new Headers(),
      integrationConnectionFindUnique: async () =>
        ({
          config: {
            basePath: "exports",
            bucket: "roomflow-assets",
            endpointUrl: "https://s3.example.com",
            region: "us-east-1",
          },
          enabled: true,
        }) as never,
      parseS3CompatibleIntegrationConfig: (config) =>
        ({
          accessKeyIdHint: null,
          basePath: (config as { basePath?: string }).basePath ?? "roomflow",
          bucket: (config as { bucket?: string }).bucket ?? null,
          endpointUrl: (config as { endpointUrl?: string }).endpointUrl ?? null,
          region: (config as { region?: string }).region ?? null,
          secretAccessKeyHint: null,
        }) as never,
    },
  );

  assert.equal(successResponse.status, 200);
  assert.deepEqual(await successResponse.json(), {
    bucket: "roomflow-assets",
    enabled: true,
    endpointUrl: "https://s3.example.com",
    preview: ["exports/roomflow-ops/exports/leads.csv"],
    region: "us-east-1",
  });
});

test("csv export route enforces auth, dataset validation, and workspace checks", async () => {
  const { handleCsvExportGet } = await getIntegrationRouteModules();

  const unauthorizedResponse = await handleCsvExportGet(
    new Request("http://localhost/api/integrations/csv-export?dataset=leads"),
    {
      auditEventFindMany: async () => [] as never,
      buildCsvDocument: () => "",
      buildCsvExportFileName: () => "file.csv",
      cookies: async () => createCookieStore(null) as never,
      extractAuditEventChannel: () => "",
      extractAuditEventReason: () => "",
      formatCsvExportTimestamp: () => "",
      getActiveWorkspace: async () => null,
      getSession: async () => null,
      headers: async () => new Headers(),
      isCsvExportDataset: () => true,
      leadFindMany: async () => [] as never,
      messageFindMany: async () => [] as never,
      serializeAuditEventPayloadSummary: () => "",
    },
  );
  assert.equal(unauthorizedResponse.status, 401);

  const invalidDatasetResponse = await handleCsvExportGet(
    new Request("http://localhost/api/integrations/csv-export?dataset=invalid"),
    {
      auditEventFindMany: async () => [] as never,
      buildCsvDocument: () => "",
      buildCsvExportFileName: () => "file.csv",
      cookies: async () => createCookieStore(null) as never,
      extractAuditEventChannel: () => "",
      extractAuditEventReason: () => "",
      formatCsvExportTimestamp: () => "",
      getActiveWorkspace: async () => null,
      getSession: async () => ({ user: { id: "user_1", email: "owner@roomflow.local" } }) as never,
      headers: async () => new Headers(),
      isCsvExportDataset: () => false,
      leadFindMany: async () => [] as never,
      messageFindMany: async () => [] as never,
      serializeAuditEventPayloadSummary: () => "",
    },
  );
  assert.equal(invalidDatasetResponse.status, 400);
  assert.deepEqual(await invalidDatasetResponse.json(), {
    message: "Valid dataset query parameter is required.",
  });

  const forbiddenResponse = await handleCsvExportGet(
    new Request("http://localhost/api/integrations/csv-export?dataset=leads&workspaceId=workspace_2"),
    {
      auditEventFindMany: async () => [] as never,
      buildCsvDocument: () => "",
      buildCsvExportFileName: () => "file.csv",
      cookies: async () => createCookieStore("workspace_1") as never,
      extractAuditEventChannel: () => "",
      extractAuditEventReason: () => "",
      formatCsvExportTimestamp: () => "",
      getActiveWorkspace: async () =>
        ({ workspaceId: "workspace_1", workspace: { slug: "roomflow-ops" } }) as never,
      getSession: async () => ({ user: { id: "user_1", email: "owner@roomflow.local" } }) as never,
      headers: async () => new Headers(),
      isCsvExportDataset: () => true,
      leadFindMany: async () => [] as never,
      messageFindMany: async () => [] as never,
      serializeAuditEventPayloadSummary: () => "",
    },
  );
  assert.equal(forbiddenResponse.status, 403);
  assert.deepEqual(await forbiddenResponse.json(), {
    message: "Workspace access not found.",
  });
});

test("csv export route returns lead CSV documents with download headers", async () => {
  const { handleCsvExportGet } = await getIntegrationRouteModules();

  const response = await handleCsvExportGet(
    new Request("http://localhost/api/integrations/csv-export?dataset=leads"),
    {
      auditEventFindMany: async () => [] as never,
      buildCsvDocument: ({ headers, rows }) =>
        `${headers.join(",")}\n${rows.map((row) => row.join(",")).join("\n")}`,
      buildCsvExportFileName: ({ dataset, workspaceSlug }) =>
        `${workspaceSlug}-${dataset}.csv`,
      cookies: async () => createCookieStore("workspace_1") as never,
      extractAuditEventChannel: () => "",
      extractAuditEventReason: () => "",
      formatCsvExportTimestamp: (value) =>
        value instanceof Date ? value.toISOString() : "",
      getActiveWorkspace: async () =>
        ({ workspaceId: "workspace_1", workspace: { slug: "roomflow-ops" } }) as never,
      getSession: async () => ({ user: { id: "user_1", email: "owner@roomflow.local" } }) as never,
      headers: async () => new Headers(),
      isCsvExportDataset: (dataset) => dataset === "leads",
      leadFindMany: async () =>
        [
          {
            id: "lead_1",
            createdAt: new Date("2026-03-08T00:00:00.000Z"),
            updatedAt: new Date("2026-03-08T01:00:00.000Z"),
            fullName: "Avery Mason",
            email: "avery@example.com",
            phone: "+15551234567",
            status: "QUALIFIED",
            fitResult: "PASS",
            property: { name: "Maple House" },
            leadSource: { name: "Zillow", type: "WEB_FORM" },
            preferredContactChannel: "EMAIL",
            moveInDate: null,
            monthlyBudget: 1200,
            stayLengthMonths: 12,
            workStatus: "EMPLOYED",
            lastActivityAt: new Date("2026-03-08T02:00:00.000Z"),
            notes: "Qualified lead",
          },
        ] as never,
      messageFindMany: async () => [] as never,
      serializeAuditEventPayloadSummary: () => "",
    },
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "text/csv; charset=utf-8");
  assert.equal(
    response.headers.get("Content-Disposition"),
    'attachment; filename="roomflow-ops-leads.csv"',
  );
  assert.match(await response.text(), /leadId,createdAt,updatedAt,fullName,email,phone,status/);
  assert.match(await handleCsvExportGet(
    new Request("http://localhost/api/integrations/csv-export?dataset=activity"),
    {
      auditEventFindMany: async () =>
        [
          {
            id: "event_1",
            createdAt: new Date("2026-03-08T03:00:00.000Z"),
            eventType: "lead.created",
            actorType: "USER",
            actorUser: { name: "Owner", email: "owner@roomflow.local" },
            leadId: "lead_1",
            lead: { fullName: "Avery Mason" },
            property: { name: "Maple House" },
            payload: { channel: "SMS", reason: "Initial contact" },
          },
        ] as never,
      buildCsvDocument: ({ headers, rows }) =>
        `${headers.join(",")}\n${rows.map((row) => row.join(",")).join("\n")}`,
      buildCsvExportFileName: ({ dataset, workspaceSlug }) => `${workspaceSlug}-${dataset}.csv`,
      cookies: async () => createCookieStore("workspace_1") as never,
      extractAuditEventChannel: (payload) => (payload as { channel?: string }).channel ?? "",
      extractAuditEventReason: (payload) => (payload as { reason?: string }).reason ?? "",
      formatCsvExportTimestamp: (value) => (value instanceof Date ? value.toISOString() : ""),
      getActiveWorkspace: async () =>
        ({ workspaceId: "workspace_1", workspace: { slug: "roomflow-ops" } }) as never,
      getSession: async () => ({ user: { id: "user_1", email: "owner@roomflow.local" } }) as never,
      headers: async () => new Headers(),
      isCsvExportDataset: (dataset) => dataset === "activity",
      leadFindMany: async () => [] as never,
      messageFindMany: async () => [] as never,
      serializeAuditEventPayloadSummary: (payload) => JSON.stringify(payload),
    },
  ).then((activityResponse) => activityResponse.text()), /eventId,createdAt,eventType,actorType/);
});