import { describe, it } from "node:test";
import assert from "node:assert";
import { parseDeliveryStatus, serializeDeliveryStatus } from "./delivery-status";

describe("delivery-status utilities", () => {
  it("should successfully serialize and parse delivery status", () => {
    const payload = {
      state: "received" as const,
      provider: "twilio",
      retryCount: 0,
      updatedAt: "2026-03-07T12:00:00Z"
    };

    const serialized = serializeDeliveryStatus(payload);
    const parsed = parseDeliveryStatus(serialized);

    assert.equal(parsed?.state, "received");
    assert.equal(parsed?.provider, "twilio");
    assert.equal(parsed?.retryCount, 0);
    assert.equal(parsed?.updatedAt, "2026-03-07T12:00:00Z");
  });

  it("should handle null or undefined gracefully on parse", () => {
    assert.equal(parseDeliveryStatus(null), null);
    assert.equal(parseDeliveryStatus(undefined), null);
  });

  it("should return fallback payload on malformed JSON string", () => {
    const parsed = parseDeliveryStatus("not valid json");
    assert.notEqual(parsed, null);
    assert.equal(parsed?.state, "sent");
  });
});
