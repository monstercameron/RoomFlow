import assert from "node:assert/strict";
import test from "node:test";

import {
  buildOpenAiRealtimeWebSocketUrl,
  extractTextFromRealtimeResponseDoneEvent,
  getOpenAiRealtimeApiKey,
} from "@/lib/openai-realtime";

test("buildOpenAiRealtimeWebSocketUrl encodes the requested model", () => {
  assert.equal(
    buildOpenAiRealtimeWebSocketUrl("gpt-realtime"),
    "wss://api.openai.com/v1/realtime?model=gpt-realtime",
  );
});

test("getOpenAiRealtimeApiKey rejects missing configuration", () => {
  assert.throws(() => getOpenAiRealtimeApiKey({}), /OPENAI_API_KEY is not configured/);
});

test("extractTextFromRealtimeResponseDoneEvent reads text content from output items", () => {
  assert.equal(
    extractTextFromRealtimeResponseDoneEvent({
      type: "response.done",
      response: {
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: "First part. ",
              },
              {
                type: "output_text",
                text: "Second part.",
              },
            ],
          },
        ],
      },
    }),
    "First part. Second part.",
  );
});