import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import {
  extractJsonObjectFromText,
  findLatestAiArtifact,
} from "@/lib/ai-assist";

test("extractJsonObjectFromText reads fenced JSON", () => {
  const parsed = extractJsonObjectFromText("```json\n{\n  \"summary\": \"ready\"\n}\n```");

  assert.deepEqual(parsed, { summary: "ready" });
});

test("findLatestAiArtifact returns the newest ready artifact", () => {
  const parsedArtifact = findLatestAiArtifact({
    auditEvents: [
      {
        createdAt: new Date("2026-03-08T00:00:00.000Z"),
        eventType: "ai_artifact_generated",
        payload: {
          artifactKind: "translation",
          status: "ready",
          payload: {
            language: "Spanish",
            sourceSummary: "Inbound email",
            translatedText: "Hola",
          },
        },
      },
      {
        createdAt: new Date("2026-03-08T01:00:00.000Z"),
        eventType: "ai_artifact_generated",
        payload: {
          artifactKind: "translation",
          status: "ready",
          payload: {
            language: "French",
            sourceSummary: "Inbound email",
            translatedText: "Bonjour",
          },
        },
      },
    ],
    artifactKind: "translation",
    schema: z.object({
      language: z.string(),
      sourceSummary: z.string(),
      translatedText: z.string(),
    }),
  });

  assert.equal(parsedArtifact?.status, "ready");
  assert.equal(parsedArtifact?.data.language, "French");
});

test("findLatestAiArtifact returns failure payloads", () => {
  const parsedArtifact = findLatestAiArtifact({
    auditEvents: [
      {
        createdAt: new Date("2026-03-08T01:00:00.000Z"),
        eventType: "ai_artifact_generated",
        payload: {
          artifactKind: "portfolio_insights",
          status: "failed",
          error: "Missing API key",
        },
      },
    ],
    artifactKind: "portfolio_insights",
    schema: z.object({ summary: z.string() }),
  });

  assert.equal(parsedArtifact?.status, "failed");
  assert.equal(parsedArtifact?.error, "Missing API key");
});
