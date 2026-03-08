import assert from "node:assert/strict";
import test from "node:test";

async function getWebhookRouteHandlers() {
  process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";

  const [{ handleEmailWebhookPost }, { handleSmsWebhookPost }] = await Promise.all([
    import("./email/route"),
    import("./sms/route"),
  ]);

  return {
    handleEmailWebhookPost,
    handleSmsWebhookPost,
  };
}

test("email webhook rejects invalid signatures before normalization", async () => {
  const { handleEmailWebhookPost } = await getWebhookRouteHandlers();
  let normalizeCalled = false;
  const response = await handleEmailWebhookPost(
    new Request("http://localhost/api/webhooks/email?workspaceId=workspace_1", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-roomflow-signature": "bad-signature",
      },
      body: JSON.stringify({
        fromEmail: "prospect@example.com",
        subject: "Interested",
        body: "Is the room available?",
      }),
    }),
    {
      enqueueWebhookProcessing: async () => "job_1",
      normalizeInboundEmailPayload: () => {
        normalizeCalled = true;
        return {
          workspaceId: "workspace_1",
        } as never;
      },
      processNormalizedInboundLead: async () => ({ leadId: "lead_1" }) as never,
      verifyIncomingWebhookSignature: () => false,
    },
  );

  assert.equal(response.status, 401);
  assert.equal(normalizeCalled, false);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: "Invalid webhook signature.",
  });
});

test("email webhook queues normalized payloads when enqueue succeeds", async () => {
  const { handleEmailWebhookPost } = await getWebhookRouteHandlers();
  const capturedPayloads: unknown[] = [];
  const response = await handleEmailWebhookPost(
    new Request("http://localhost/api/webhooks/email?workspaceId=workspace_1&propertyId=property_1", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-roomflow-signature": "valid-signature",
      },
      body: JSON.stringify({
        fromEmail: "prospect@example.com",
        subject: "Interested",
        body: "Is the room available?",
      }),
    }),
    {
      enqueueWebhookProcessing: async (payload) => {
        capturedPayloads.push(payload);
        return "job_queued";
      },
      normalizeInboundEmailPayload: (payload) => payload as never,
      processNormalizedInboundLead: async () => ({ leadId: "lead_1" }) as never,
      verifyIncomingWebhookSignature: () => true,
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(capturedPayloads, [
    {
      fromEmail: "prospect@example.com",
      subject: "Interested",
      body: "Is the room available?",
      workspaceId: "workspace_1",
      propertyId: "property_1",
    },
  ]);
  assert.deepEqual(await response.json(), {
    ok: true,
    queued: true,
    jobId: "job_queued",
  });
});

test("email webhook falls back to direct processing when enqueue fails", async () => {
  const { handleEmailWebhookPost } = await getWebhookRouteHandlers();
  let processedPayload: unknown = null;
  const normalizedPayload = {
    workspaceId: "workspace_1",
    propertyId: null,
    email: "prospect@example.com",
  };
  const response = await handleEmailWebhookPost(
    new Request("http://localhost/api/webhooks/email?workspaceId=workspace_1", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-roomflow-signature": "valid-signature",
      },
      body: JSON.stringify({ fromEmail: "prospect@example.com", body: "Hello" }),
    }),
    {
      enqueueWebhookProcessing: async () => {
        throw new Error("queue offline");
      },
      normalizeInboundEmailPayload: () => normalizedPayload as never,
      processNormalizedInboundLead: async (payload) => {
        processedPayload = payload;
        return { leadId: "lead_processed" } as never;
      },
      verifyIncomingWebhookSignature: () => true,
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(processedPayload, normalizedPayload);
  assert.deepEqual(await response.json(), {
    ok: true,
    queued: false,
    result: {
      leadId: "lead_processed",
    },
  });
});

test("email webhook returns 400 for normalization failures", async () => {
  const { handleEmailWebhookPost } = await getWebhookRouteHandlers();
  const response = await handleEmailWebhookPost(
    new Request("http://localhost/api/webhooks/email?workspaceId=workspace_1", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-roomflow-signature": "valid-signature",
      },
      body: JSON.stringify({}),
    }),
    {
      enqueueWebhookProcessing: async () => "job_1",
      normalizeInboundEmailPayload: () => {
        throw new Error("Email address is required.");
      },
      processNormalizedInboundLead: async () => ({ leadId: "lead_1" }) as never,
      verifyIncomingWebhookSignature: () => true,
    },
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: "Email address is required.",
  });
});

test("sms webhook parses form-encoded payloads and queues normalized messages", async () => {
  const { handleSmsWebhookPost } = await getWebhookRouteHandlers();
  const capturedPayloads: unknown[] = [];
  const response = await handleSmsWebhookPost(
    new Request("http://localhost/api/webhooks/sms?workspaceId=workspace_2&propertyId=property_2", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-roomflow-signature": "valid-signature",
      },
      body: new URLSearchParams({
        From: "+15551234567",
        ProfileName: "Avery Mason",
        Body: "Is parking included?",
        MessageSid: "sms_123",
        ConversationSid: "thread_123",
      }).toString(),
    }),
    {
      enqueueWebhookProcessing: async (payload) => {
        capturedPayloads.push(payload);
        return "job_sms";
      },
      normalizeInboundSmsPayload: (payload) => payload as never,
      processNormalizedInboundLead: async () => ({ leadId: "lead_2" }) as never,
      verifyIncomingWebhookSignature: () => true,
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(capturedPayloads, [
    {
      workspaceId: "workspace_2",
      propertyId: "property_2",
      sourceName: "Inbound SMS",
      fromPhone: "+15551234567",
      fromName: "Avery Mason",
      body: "Is parking included?",
      messageId: "sms_123",
      threadId: "thread_123",
      metadata: {
        Body: "Is parking included?",
        ConversationSid: "thread_123",
        From: "+15551234567",
        MessageSid: "sms_123",
        ProfileName: "Avery Mason",
      },
    },
  ]);
  assert.deepEqual(await response.json(), {
    ok: true,
    queued: true,
    jobId: "job_sms",
  });
});

test("sms webhook falls back to direct processing when enqueue fails", async () => {
  const { handleSmsWebhookPost } = await getWebhookRouteHandlers();
  let processedPayload: unknown = null;
  const normalizedPayload = {
    workspaceId: "workspace_2",
    phone: "+15551234567",
  };
  const response = await handleSmsWebhookPost(
    new Request("http://localhost/api/webhooks/sms?workspaceId=workspace_2", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-roomflow-signature": "valid-signature",
      },
      body: JSON.stringify({
        fromPhone: "+15551234567",
        body: "Need move-in details",
      }),
    }),
    {
      enqueueWebhookProcessing: async () => {
        throw new Error("queue offline");
      },
      normalizeInboundSmsPayload: () => normalizedPayload as never,
      processNormalizedInboundLead: async (payload) => {
        processedPayload = payload;
        return { leadId: "lead_sms" } as never;
      },
      verifyIncomingWebhookSignature: () => true,
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(processedPayload, normalizedPayload);
  assert.deepEqual(await response.json(), {
    ok: true,
    queued: false,
    result: {
      leadId: "lead_sms",
    },
  });
});

test("sms webhook rejects invalid signatures before normalization", async () => {
  const { handleSmsWebhookPost } = await getWebhookRouteHandlers();
  let normalizeCalled = false;
  const response = await handleSmsWebhookPost(
    new Request("http://localhost/api/webhooks/sms?workspaceId=workspace_2", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-roomflow-signature": "bad-signature",
      },
      body: JSON.stringify({
        fromPhone: "+15551234567",
        body: "Hello",
      }),
    }),
    {
      enqueueWebhookProcessing: async () => "job_sms",
      normalizeInboundSmsPayload: () => {
        normalizeCalled = true;
        return {
          workspaceId: "workspace_2",
        } as never;
      },
      processNormalizedInboundLead: async () => ({ leadId: "lead_sms" }) as never,
      verifyIncomingWebhookSignature: () => false,
    },
  );

  assert.equal(response.status, 401);
  assert.equal(normalizeCalled, false);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: "Invalid webhook signature.",
  });
});

test("sms webhook returns 400 for normalization failures", async () => {
  const { handleSmsWebhookPost } = await getWebhookRouteHandlers();
  const response = await handleSmsWebhookPost(
    new Request("http://localhost/api/webhooks/sms?workspaceId=workspace_2", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-roomflow-signature": "valid-signature",
      },
      body: JSON.stringify({ body: "Missing sender" }),
    }),
    {
      enqueueWebhookProcessing: async () => "job_sms",
      normalizeInboundSmsPayload: () => {
        throw new Error("A from phone number is required.");
      },
      processNormalizedInboundLead: async () => ({ leadId: "lead_sms" }) as never,
      verifyIncomingWebhookSignature: () => true,
    },
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: "A from phone number is required.",
  });
});