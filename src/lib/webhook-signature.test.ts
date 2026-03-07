import assert from "node:assert/strict";
import test from "node:test";
import {
  buildWebhookSignature,
  verifyIncomingWebhookSignature,
} from "./webhook-signature";

test("verifyIncomingWebhookSignature validates HMAC signatures", () => {
  const rawBody = JSON.stringify({ hello: "world" });
  const signingSecret = "secret123";
  const signature = buildWebhookSignature(rawBody, signingSecret);

  assert.equal(
    verifyIncomingWebhookSignature({
      rawBody,
      providedSignature: signature,
      signingSecret,
    }),
    true,
  );
  assert.equal(
    verifyIncomingWebhookSignature({
      rawBody,
      providedSignature: "bad-signature",
      signingSecret,
    }),
    false,
  );
});

test("verifyIncomingWebhookSignature allows unsigned mode when secret is missing", () => {
  assert.equal(
    verifyIncomingWebhookSignature({
      rawBody: "{}",
      providedSignature: null,
      signingSecret: undefined,
    }),
    true,
  );
});
