import assert from "node:assert/strict";
import test from "node:test";

async function getChannelWebhookRouteModules() {
  process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";

  const [whatsAppRoute, instagramRoute, metaLeadAdsRoute] = await Promise.all([
    import("./whatsapp/route"),
    import("./meta/instagram/route"),
    import("./meta/lead-ads/route"),
  ]);

  return {
    handleInstagramWebhookGet: instagramRoute.handleInstagramWebhookGet,
    handleInstagramWebhookPost: instagramRoute.handleInstagramWebhookPost,
    handleMetaLeadAdsWebhookGet: metaLeadAdsRoute.handleMetaLeadAdsWebhookGet,
    handleMetaLeadAdsWebhookPost: metaLeadAdsRoute.handleMetaLeadAdsWebhookPost,
    handleWhatsAppWebhookPost: whatsAppRoute.handleWhatsAppWebhookPost,
  };
}

test("WhatsApp webhook rejects missing connections and invalid signatures", async () => {
  const { handleWhatsAppWebhookPost } = await getChannelWebhookRouteModules();

  const missingConnectionResponse = await handleWhatsAppWebhookPost(
    new Request("http://localhost/api/webhooks/whatsapp?workspaceId=workspace_1", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-roomflow-signature": "valid",
      },
      body: JSON.stringify({ To: "whatsapp:+15550001111", From: "whatsapp:+15550002222", Body: "Hello" }),
    }),
    {
      enqueueWebhookProcessing: async () => "job_1",
      normalizeInboundDirectMessagePayload: (payload) => payload as never,
      processNormalizedInboundLead: async () => ({ leadId: "lead_1" }) as never,
      resolveWhatsAppConnection: async () => null,
      verifyIncomingWebhookSignature: () => true,
    },
  );
  assert.equal(missingConnectionResponse.status, 404);
  assert.deepEqual(await missingConnectionResponse.json(), {
    ok: false,
    error: "WhatsApp integration not configured.",
  });

  const invalidSignatureResponse = await handleWhatsAppWebhookPost(
    new Request("http://localhost/api/webhooks/whatsapp?workspaceId=workspace_1", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-roomflow-signature": "bad",
      },
      body: JSON.stringify({ To: "whatsapp:+15550001111", From: "whatsapp:+15550002222", Body: "Hello" }),
    }),
    {
      enqueueWebhookProcessing: async () => "job_1",
      normalizeInboundDirectMessagePayload: (payload) => payload as never,
      processNormalizedInboundLead: async () => ({ leadId: "lead_1" }) as never,
      resolveWhatsAppConnection: async () =>
        ({
          workspaceId: "workspace_1",
          config: { accountLabel: "WhatsApp", verifyToken: "secret" },
        }) as never,
      verifyIncomingWebhookSignature: () => false,
    },
  );
  assert.equal(invalidSignatureResponse.status, 401);
  assert.deepEqual(await invalidSignatureResponse.json(), {
    ok: false,
    error: "Invalid WhatsApp webhook signature.",
  });
});

test("WhatsApp webhook parses payloads and falls back to direct processing", async () => {
  const { handleWhatsAppWebhookPost } = await getChannelWebhookRouteModules();
  const normalizedInputs: unknown[] = [];

  const queuedResponse = await handleWhatsAppWebhookPost(
    new Request("http://localhost/api/webhooks/whatsapp?workspaceId=workspace_1&propertyId=property_1", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-roomflow-signature": "valid",
      },
      body: new URLSearchParams({
        To: "whatsapp:+15550001111",
        From: "whatsapp:+15550002222",
        ProfileName: "Jamie Prospect",
        Body: "Is the room still available?",
        MessageSid: "wa_123",
        ConversationSid: "thread_123",
      }).toString(),
    }),
    {
      enqueueWebhookProcessing: async () => "job_whatsapp",
      normalizeInboundDirectMessagePayload: (payload) => {
        normalizedInputs.push(payload);
        return payload as never;
      },
      processNormalizedInboundLead: async () => ({ leadId: "lead_1" }) as never,
      resolveWhatsAppConnection: async () =>
        ({
          workspaceId: "workspace_1",
          config: { accountLabel: "Twilio WhatsApp", verifyToken: "secret" },
        }) as never,
      verifyIncomingWebhookSignature: () => true,
    },
  );

  assert.equal(queuedResponse.status, 200);
  assert.deepEqual(await queuedResponse.json(), {
    ok: true,
    queued: true,
    jobId: "job_whatsapp",
  });
  assert.deepEqual(normalizedInputs[0], {
    workspaceId: "workspace_1",
    propertyId: "property_1",
    sourceName: "Twilio WhatsApp",
    leadSourceType: "OTHER",
    channel: "WHATSAPP",
    fromIdentifier: "+15550002222",
    fromName: "Jamie Prospect",
    body: "Is the room still available?",
    messageId: "wa_123",
    threadId: "thread_123",
    receivedAt: undefined,
    metadata: {
      Body: "Is the room still available?",
      ConversationSid: "thread_123",
      From: "whatsapp:+15550002222",
      MessageSid: "wa_123",
      ProfileName: "Jamie Prospect",
      To: "whatsapp:+15550001111",
    },
  });

  const directResponse = await handleWhatsAppWebhookPost(
    new Request("http://localhost/api/webhooks/whatsapp?workspaceId=workspace_1", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-roomflow-signature": "valid",
      },
      body: JSON.stringify({ senderIdentifier: "whatsapp:+15550001111", From: "whatsapp:+15550002222", body: "Hello again" }),
    }),
    {
      enqueueWebhookProcessing: async () => {
        throw new Error("queue unavailable");
      },
      normalizeInboundDirectMessagePayload: () => ({ workspaceId: "workspace_1" }) as never,
      processNormalizedInboundLead: async () => ({ leadId: "lead_direct" }) as never,
      resolveWhatsAppConnection: async () =>
        ({
          workspaceId: "workspace_1",
          config: { accountLabel: "Twilio WhatsApp", verifyToken: "secret" },
        }) as never,
      verifyIncomingWebhookSignature: () => true,
    },
  );

  assert.equal(directResponse.status, 200);
  assert.deepEqual(await directResponse.json(), {
    ok: true,
    queued: false,
    result: { leadId: "lead_direct" },
  });
});

test("Instagram webhook GET verifies challenge tokens", async () => {
  const { handleInstagramWebhookGet } = await getChannelWebhookRouteModules();

  const failedResponse = await handleInstagramWebhookGet(
    new Request("http://localhost/api/webhooks/meta/instagram?hub.verify_token=bad&hub.challenge=123"),
    {
      resolveInstagramConnection: async () => null,
    },
  );
  assert.equal(failedResponse.status, 403);

  const successResponse = await handleInstagramWebhookGet(
    new Request("http://localhost/api/webhooks/meta/instagram?hub.verify_token=verify-me&hub.challenge=123"),
    {
      resolveInstagramConnection: async () =>
        ({ workspaceId: "workspace_1", config: { verifyToken: "verify-me" } }) as never,
    },
  );
  assert.equal(successResponse.status, 200);
  assert.equal(await successResponse.text(), "123");
});

test("Instagram webhook POST validates signatures and queues normalized messages", async () => {
  const { handleInstagramWebhookPost } = await getChannelWebhookRouteModules();

  const invalidSignatureResponse = await handleInstagramWebhookPost(
    new Request("http://localhost/api/webhooks/meta/instagram?workspaceId=workspace_1", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-roomflow-signature": "bad",
      },
      body: JSON.stringify({ recipientId: "ig_business_1", body: "Hi" }),
    }),
    {
      enqueueWebhookProcessing: async () => "job_ig",
      normalizeInboundDirectMessagePayload: (payload) => payload as never,
      processNormalizedInboundLead: async () => ({ leadId: "lead_ig" }) as never,
      resolveInstagramConnection: async () =>
        ({ workspaceId: "workspace_1", config: { verifyToken: "secret", accountLabel: "Instagram" } }) as never,
      verifyIncomingWebhookSignature: () => false,
    },
  );
  assert.equal(invalidSignatureResponse.status, 401);

  const queueResponse = await handleInstagramWebhookPost(
    new Request("http://localhost/api/webhooks/meta/instagram?workspaceId=workspace_1&propertyId=property_1", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-roomflow-signature": "valid",
      },
      body: JSON.stringify({
        entry: [
          {
            messaging: [
              {
                sender: { id: "ig_user_1" },
                recipient: { id: "ig_business_1" },
                message: { mid: "ig_mid_1", text: "Interested in the room" },
                timestamp: "2026-03-08T00:00:00.000Z",
              },
            ],
          },
        ],
      }),
    }),
    {
      enqueueWebhookProcessing: async () => "job_ig",
      normalizeInboundDirectMessagePayload: (payload) => payload as never,
      processNormalizedInboundLead: async () => ({ leadId: "lead_ig" }) as never,
      resolveInstagramConnection: async () =>
        ({ workspaceId: "workspace_1", config: { verifyToken: "secret", accountLabel: "Instagram" } }) as never,
      verifyIncomingWebhookSignature: () => true,
    },
  );

  assert.equal(queueResponse.status, 200);
  assert.deepEqual(await queueResponse.json(), {
    ok: true,
    queued: true,
    jobId: "job_ig",
  });
});

test("Meta Lead Ads webhook GET verifies challenge tokens", async () => {
  const { handleMetaLeadAdsWebhookGet } = await getChannelWebhookRouteModules();

  const failedResponse = await handleMetaLeadAdsWebhookGet(
    new Request("http://localhost/api/webhooks/meta/lead-ads?hub.verify_token=bad&hub.challenge=321"),
    {
      resolveMetaConnection: async () => null,
    },
  );
  assert.equal(failedResponse.status, 403);

  const successResponse = await handleMetaLeadAdsWebhookGet(
    new Request("http://localhost/api/webhooks/meta/lead-ads?hub.verify_token=verify-meta&hub.challenge=321&pageId=page_1&formId=form_1"),
    {
      resolveMetaConnection: async () =>
        ({ workspaceId: "workspace_1", config: { verifyToken: "verify-meta" } }) as never,
    },
  );
  assert.equal(successResponse.status, 200);
  assert.equal(await successResponse.text(), "321");
});

test("Meta Lead Ads webhook POST validates signatures and maps field data", async () => {
  const { handleMetaLeadAdsWebhookPost } = await getChannelWebhookRouteModules();
  const normalizedInputs: unknown[] = [];

  const invalidSignatureResponse = await handleMetaLeadAdsWebhookPost(
    new Request("http://localhost/api/webhooks/meta/lead-ads?workspaceId=workspace_1", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": "bad",
      },
      body: JSON.stringify({ lead: { page_id: "page_1", form_id: "form_1" } }),
    }),
    {
      enqueueWebhookProcessing: async () => "job_meta",
      normalizeInboundMetaLeadPayload: (payload) => payload as never,
      processNormalizedInboundLead: async () => ({ leadId: "lead_meta" }) as never,
      resolveMetaConnection: async () =>
        ({
          workspaceId: "workspace_1",
          config: { appSecret: "secret", sourceLabel: "Meta Lead Ads", fieldMappings: [] },
        }) as never,
      verifyIncomingWebhookSignature: () => false,
    },
  );
  assert.equal(invalidSignatureResponse.status, 401);

  const queueResponse = await handleMetaLeadAdsWebhookPost(
    new Request("http://localhost/api/webhooks/meta/lead-ads?workspaceId=workspace_1&propertyId=property_1", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": "valid",
      },
      body: JSON.stringify({
        lead: {
          page_id: "page_1",
          form_id: "form_1",
          leadgen_id: "leadgen_1",
          created_time: "2026-03-08T00:00:00.000Z",
          field_data: [
            { name: "full_name", values: ["Avery Mason"] },
            { name: "email", values: ["avery@example.com"] },
            { name: "phone_number", values: ["+15551234567"] },
          ],
        },
      }),
    }),
    {
      enqueueWebhookProcessing: async () => "job_meta",
      normalizeInboundMetaLeadPayload: (payload) => {
        normalizedInputs.push(payload);
        return payload as never;
      },
      processNormalizedInboundLead: async () => ({ leadId: "lead_meta" }) as never,
      resolveMetaConnection: async () =>
        ({
          workspaceId: "workspace_1",
          config: {
            appSecret: "secret",
            sourceLabel: "Meta Lead Ads",
            fieldMappings: [
              { sourceField: "full_name", targetField: "fullName" },
              { sourceField: "email", targetField: "email" },
              { sourceField: "phone_number", targetField: "phone" },
            ],
          },
        }) as never,
      verifyIncomingWebhookSignature: () => true,
    },
  );

  assert.equal(queueResponse.status, 200);
  assert.deepEqual(await queueResponse.json(), {
    ok: true,
    queued: true,
    jobId: "job_meta",
  });
  assert.deepEqual(normalizedInputs[0], {
    workspaceId: "workspace_1",
    propertyId: "property_1",
    sourceName: "Meta Lead Ads",
    fullName: "Avery Mason",
    email: "avery@example.com",
    phone: "+15551234567",
    notes: null,
    submissionId: "leadgen_1",
    submittedAt: "2026-03-08T00:00:00.000Z",
    metadata: {
      lead: {
        page_id: "page_1",
        form_id: "form_1",
        leadgen_id: "leadgen_1",
        created_time: "2026-03-08T00:00:00.000Z",
        field_data: [
          { name: "full_name", values: ["Avery Mason"] },
          { name: "email", values: ["avery@example.com"] },
          { name: "phone_number", values: ["+15551234567"] },
        ],
      },
      fieldDataMap: {
        full_name: "Avery Mason",
        email: "avery@example.com",
        phone_number: "+15551234567",
      },
    },
  });
});