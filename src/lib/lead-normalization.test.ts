import assert from "node:assert/strict";
import test from "node:test";
import { LeadSourceType, MessageChannel } from "@/generated/prisma/client";

async function getLeadNormalizationModule() {
  process.env.DATABASE_URL ??=
    "postgresql://postgres:postgres@localhost:5432/template1";

  return import("./lead-normalization");
}

test("normalizeInboundWebFormPayload maps email-backed submissions to WEB_FORM and EMAIL", async () => {
  const { normalizeInboundWebFormPayload } = await getLeadNormalizationModule();

  const normalizedPayload = normalizeInboundWebFormPayload({
    workspaceId: "workspace_123",
    fullName: "Jordan Lane",
    email: "Jordan@example.com",
    message: "Interested in the room.",
    submissionId: "form_1",
  });

  assert.equal(normalizedPayload.leadSourceType, LeadSourceType.WEB_FORM);
  assert.equal(normalizedPayload.channel, MessageChannel.EMAIL);
  assert.equal(normalizedPayload.email, "jordan@example.com");
  assert.equal(normalizedPayload.externalMessageId, "form_1");
  assert.equal(normalizedPayload.body, "Interested in the room.");
});

test("normalizeInboundEmailPayload persists external ids for replay handling", async () => {
  const { normalizeInboundEmailPayload } = await getLeadNormalizationModule();

  const normalizedPayload = normalizeInboundEmailPayload({
    workspaceId: "workspace_email",
    fromEmail: "prospect@example.com",
    subject: "Room inquiry",
    body: "Is this still available?",
    messageId: "email_msg_1001",
    threadId: "email_thread_42",
  });

  assert.equal(normalizedPayload.leadSourceType, LeadSourceType.EMAIL);
  assert.equal(normalizedPayload.channel, MessageChannel.EMAIL);
  assert.equal(normalizedPayload.externalMessageId, "email_msg_1001");
  assert.equal(normalizedPayload.externalThreadId, "email_thread_42");
});

test("normalizeInboundSmsPayload persists external ids for replay handling", async () => {
  const { normalizeInboundSmsPayload } = await getLeadNormalizationModule();

  const normalizedPayload = normalizeInboundSmsPayload({
    workspaceId: "workspace_sms",
    fromPhone: "+1 (401) 555-7788",
    body: "I am interested in the room.",
    messageId: "sms_msg_55",
    threadId: "sms_thread_9",
  });

  assert.equal(normalizedPayload.leadSourceType, LeadSourceType.SMS);
  assert.equal(normalizedPayload.channel, MessageChannel.SMS);
  assert.equal(normalizedPayload.externalMessageId, "sms_msg_55");
  assert.equal(normalizedPayload.externalThreadId, "sms_thread_9");
});

test("normalizeInboundWebFormPayload maps phone-only submissions to SMS channel", async () => {
  const { normalizeInboundWebFormPayload } = await getLeadNormalizationModule();

  const normalizedPayload = normalizeInboundWebFormPayload({
    workspaceId: "workspace_456",
    fullName: "Taylor Quinn",
    phone: "+1 (401) 555-0001",
    body: "Phone contact only.",
  });

  assert.equal(normalizedPayload.leadSourceType, LeadSourceType.WEB_FORM);
  assert.equal(normalizedPayload.channel, MessageChannel.SMS);
  assert.equal(normalizedPayload.phone, "+14015550001");
});

test("normalizeInboundCsvImportPayload maps rows to CSV_IMPORT with internal-note channel", async () => {
  const { normalizeInboundCsvImportPayload } = await getLeadNormalizationModule();

  const normalizedPayload = normalizeInboundCsvImportPayload({
    workspaceId: "workspace_789",
    fullName: "Alex Rivera",
    email: "alex.rivera@example.com",
    notes: "Imported from March intake spreadsheet.",
    rowId: "csv_row_44",
  });

  assert.equal(normalizedPayload.leadSourceType, LeadSourceType.CSV_IMPORT);
  assert.equal(normalizedPayload.channel, MessageChannel.INTERNAL_NOTE);
  assert.equal(normalizedPayload.email, "alex.rivera@example.com");
  assert.equal(
    normalizedPayload.body,
    "Imported from March intake spreadsheet.",
  );
  assert.equal(normalizedPayload.externalMessageId, "csv_row_44");
});

test("normalizeInboundWebFormPayload keeps explicit international numbers in E.164 format", async () => {
  const { normalizeInboundWebFormPayload } = await getLeadNormalizationModule();

  const normalizedPayload = normalizeInboundWebFormPayload({
    workspaceId: "workspace_111",
    fullName: "Casey Rowan",
    phone: "+44 20 7946 0018",
    body: "International contact provided.",
  });

  assert.equal(normalizedPayload.phone, "+442079460018");
  assert.equal(normalizedPayload.channel, MessageChannel.SMS);
});

test("resolveInboundOptOutDirective recognizes stop and start directives", async () => {
  const { resolveInboundOptOutDirective } = await getLeadNormalizationModule();

  assert.equal(resolveInboundOptOutDirective("STOP"), "opt_out");
  assert.equal(resolveInboundOptOutDirective("unsubscribe"), "opt_out");
  assert.equal(resolveInboundOptOutDirective("START"), "opt_in");
  assert.equal(resolveInboundOptOutDirective("hello there"), null);
});
