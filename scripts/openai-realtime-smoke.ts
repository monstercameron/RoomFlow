import "dotenv/config";

import { runOpenAiRealtimeTextPrompt } from "@/lib/openai-realtime";

async function main() {
  const prompt = process.argv.slice(2).join(" ").trim();
  const finalPrompt =
    prompt ||
    "Write a two-sentence follow-up message to a shared-housing lead who asked if the room is still available.";

  let wroteStreamingText = false;

  const result = await runOpenAiRealtimeTextPrompt({
    prompt: finalPrompt,
    metadata: {
      source: "roomflow-realtime-smoke",
    },
    onEvent(event) {
      if (
        event.type === "response.output_text.delta" &&
        typeof event.delta === "string"
      ) {
        wroteStreamingText = true;
        process.stdout.write(event.delta);
      }
    },
  });

  if (wroteStreamingText) {
    process.stdout.write("\n");
    return;
  }

  console.log(result.text);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});