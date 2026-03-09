import assert from "node:assert/strict";
import test from "node:test";
import { clearMockEmailMessages, listMockEmailMessages, storeMockEmailMessage } from "@/lib/mock-email-service";

test("mock email service stores and clears messages", async () => {
  await clearMockEmailMessages();

  await storeMockEmailMessage({
    from: "noreply@roomflow.local",
    to: ["lead@example.com"],
    subject: "Test subject",
    text: "Test body",
  });

  const storedMessages = await listMockEmailMessages();

  assert.equal(storedMessages.length > 0, true);
  assert.equal(storedMessages[0]?.provider, "mock");
  assert.equal(storedMessages[0]?.subject, "Test subject");

  await clearMockEmailMessages();

  assert.deepEqual(await listMockEmailMessages(), []);
});