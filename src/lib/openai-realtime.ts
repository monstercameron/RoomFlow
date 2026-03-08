import { randomUUID } from "node:crypto";

import WebSocket, { type RawData } from "ws";

type RealtimeObjectRecord = Record<string, unknown>;

export type OpenAiRealtimeServerEvent = RealtimeObjectRecord & {
  type: string;
};

type OpenAiRealtimeResponseResult = {
  text: string;
  response: RealtimeObjectRecord | null;
  finalEvent: OpenAiRealtimeServerEvent;
};

type RunOpenAiRealtimeTextPromptParams = {
  prompt: string;
  instructions?: string;
  model?: string;
  timeoutMs?: number;
  metadata?: Record<string, string>;
  onEvent?: (event: OpenAiRealtimeServerEvent) => void;
};

const defaultRealtimeModel = "gpt-realtime";
const defaultRealtimeTimeoutMs = 30_000;
const defaultRealtimeInstructions =
  "You are assisting Roomflow operators. Respond concisely, clearly, and only with the requested text.";

function isObjectRecord(value: unknown): value is RealtimeObjectRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function decodeRealtimeRawData(message: RawData) {
  if (typeof message === "string") {
    return message;
  }

  if (message instanceof ArrayBuffer) {
    return Buffer.from(message).toString("utf8");
  }

  if (Array.isArray(message)) {
    return Buffer.concat(message).toString("utf8");
  }

  return message.toString("utf8");
}

export function getOpenAiRealtimeApiKey(
  environmentVariables: Record<string, string | undefined> = process.env,
) {
  const apiKey = environmentVariables.OPENAI_API_KEY?.trim();

  if (!apiKey || apiKey === "replace-me") {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  return apiKey;
}

export function buildOpenAiRealtimeWebSocketUrl(model = defaultRealtimeModel) {
  const normalizedModel = model.trim();

  if (!normalizedModel) {
    throw new Error("An OpenAI Realtime model is required.");
  }

  return `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(normalizedModel)}`;
}

function buildSessionUpdateEvent(instructions: string) {
  return {
    event_id: randomUUID(),
    type: "session.update",
    session: {
      type: "realtime",
      instructions,
      output_modalities: ["text"],
    },
  };
}

function buildConversationItemCreateEvent(prompt: string) {
  return {
    event_id: randomUUID(),
    type: "conversation.item.create",
    item: {
      type: "message",
      role: "user",
      content: [
        {
          type: "input_text",
          text: prompt,
        },
      ],
    },
  };
}

function buildResponseCreateEvent(metadata?: Record<string, string>) {
  return {
    event_id: randomUUID(),
    type: "response.create",
    response: {
      output_modalities: ["text"],
      ...(metadata ? { metadata } : {}),
    },
  };
}

function extractTextFromContentPart(contentPart: unknown) {
  if (!isObjectRecord(contentPart)) {
    return "";
  }

  if (typeof contentPart.text === "string") {
    return contentPart.text;
  }

  if (typeof contentPart.transcript === "string") {
    return contentPart.transcript;
  }

  return "";
}

export function extractTextFromRealtimeResponseDoneEvent(event: unknown) {
  if (!isObjectRecord(event)) {
    return "";
  }

  const response = event.response;

  if (!isObjectRecord(response) || !Array.isArray(response.output)) {
    return "";
  }

  const textParts: string[] = [];

  for (const outputItem of response.output) {
    if (!isObjectRecord(outputItem)) {
      continue;
    }

    if (typeof outputItem.text === "string") {
      textParts.push(outputItem.text);
    }

    if (Array.isArray(outputItem.content)) {
      for (const contentPart of outputItem.content) {
        const textPart = extractTextFromContentPart(contentPart);

        if (textPart) {
          textParts.push(textPart);
        }
      }
    }
  }

  return textParts.join("").trim();
}

function formatRealtimeError(event: OpenAiRealtimeServerEvent) {
  const code = typeof event.code === "string" ? event.code : null;
  const message = typeof event.message === "string" ? event.message : "Unknown error.";
  const eventId = typeof event.event_id === "string" ? event.event_id : null;

  return [
    "OpenAI Realtime API error",
    code ? `(${code})` : null,
    `: ${message}`,
    eventId ? ` [event_id=${eventId}]` : null,
  ]
    .filter(Boolean)
    .join("");
}

export async function runOpenAiRealtimeTextPrompt(
  params: RunOpenAiRealtimeTextPromptParams,
): Promise<OpenAiRealtimeResponseResult> {
  const prompt = params.prompt.trim();

  if (!prompt) {
    throw new Error("A prompt is required for the OpenAI Realtime request.");
  }

  const apiKey = getOpenAiRealtimeApiKey();
  const url = buildOpenAiRealtimeWebSocketUrl(params.model ?? defaultRealtimeModel);
  const instructions =
    params.instructions?.trim() || defaultRealtimeInstructions;
  const timeoutMs = params.timeoutMs ?? defaultRealtimeTimeoutMs;

  return new Promise<OpenAiRealtimeResponseResult>((resolve, reject) => {
    const websocket = new WebSocket(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    let didFinish = false;
    let collectedText = "";

    const timeoutHandle = setTimeout(() => {
      finishWithError(new Error(`OpenAI Realtime request timed out after ${timeoutMs}ms.`));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timeoutHandle);
      websocket.removeAllListeners();

      if (
        websocket.readyState === WebSocket.OPEN ||
        websocket.readyState === WebSocket.CONNECTING
      ) {
        websocket.close();
      }
    }

    function finishWithError(error: Error) {
      if (didFinish) {
        return;
      }

      didFinish = true;
      cleanup();
      reject(error);
    }

    function finishWithSuccess(result: OpenAiRealtimeResponseResult) {
      if (didFinish) {
        return;
      }

      didFinish = true;
      cleanup();
      resolve(result);
    }

    websocket.on("open", () => {
      websocket.send(JSON.stringify(buildSessionUpdateEvent(instructions)));
      websocket.send(JSON.stringify(buildConversationItemCreateEvent(prompt)));
      websocket.send(JSON.stringify(buildResponseCreateEvent(params.metadata)));
    });

    websocket.on("message", (message: RawData) => {
      let parsedEvent: OpenAiRealtimeServerEvent;

      try {
        parsedEvent = JSON.parse(
          decodeRealtimeRawData(message),
        ) as OpenAiRealtimeServerEvent;
      } catch (error) {
        finishWithError(
          error instanceof Error
            ? error
            : new Error("Failed to parse OpenAI Realtime server event."),
        );
        return;
      }

      params.onEvent?.(parsedEvent);

      if (parsedEvent.type === "error") {
        finishWithError(new Error(formatRealtimeError(parsedEvent)));
        return;
      }

      if (
        parsedEvent.type === "response.output_text.delta" &&
        typeof parsedEvent.delta === "string"
      ) {
        collectedText += parsedEvent.delta;
        return;
      }

      if (parsedEvent.type === "response.done") {
        const response = isObjectRecord(parsedEvent.response)
          ? parsedEvent.response
          : null;
        const responseStatus =
          response && typeof response.status === "string" ? response.status : null;

        if (responseStatus && responseStatus !== "completed") {
          finishWithError(
            new Error(
              `OpenAI Realtime response finished with status ${responseStatus}.`,
            ),
          );
          return;
        }

        finishWithSuccess({
          text: collectedText || extractTextFromRealtimeResponseDoneEvent(parsedEvent),
          response,
          finalEvent: parsedEvent,
        });
      }
    });

    websocket.on("error", (error: Error) => {
      finishWithError(error instanceof Error ? error : new Error("OpenAI Realtime socket error."));
    });

    websocket.on("close", (code: number, reasonBuffer: Buffer) => {
      if (didFinish) {
        return;
      }

      const reason = reasonBuffer.toString();
      finishWithError(
        new Error(
          reason
            ? `OpenAI Realtime socket closed before completion (${code}): ${reason}`
            : `OpenAI Realtime socket closed before completion (${code}).`,
        ),
      );
    });
  });
}