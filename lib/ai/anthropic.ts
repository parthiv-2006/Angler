import Anthropic from "@anthropic-ai/sdk";
import type { ZodType } from "zod";
import type { AIProvider } from "./provider";
import type { CreativeDNA, ConceptClustering } from "@/lib/types";
import { creativeDNASchema, conceptClusteringSchema } from "./schemas";
import { parseModelJSON } from "./json";
import { ANALYZE_CREATIVE_SYSTEM, buildAnalyzeCreativePrompt } from "./prompts/analyze";
import { CLUSTER_CONCEPTS_SYSTEM, buildClusterConceptsPrompt } from "./prompts/cluster";

const MODEL_DEFAULT = "claude-sonnet-4-6";

// A response cut off at the max_tokens ceiling is truncated JSON that will
// never parse; retrying is deterministic waste. status 400 makes withRetry
// fail fast instead of burning two more full generations.
function assertNotTruncated(message: Anthropic.Message): void {
  if (message.stop_reason === "max_tokens") {
    throw Object.assign(
      new Error(`Anthropic response truncated at max_tokens (model ${message.model})`),
      { status: 400 },
    );
  }
}

export class AnthropicProvider implements AIProvider {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async analyzeCreative(input: {
    imageBase64?: string;
    imageMediaType?: string;
    copy?: string;
    metadata?: Record<string, unknown>;
  }): Promise<CreativeDNA> {
    const content: Anthropic.MessageParam["content"] = [];

    if (input.imageBase64) {
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: (input.imageMediaType ??
            "image/jpeg") as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
          data: input.imageBase64,
        },
      });
    }

    content.push({
      type: "text",
      text: buildAnalyzeCreativePrompt(input.copy, input.metadata),
    });

    const message = await this.client.messages.create({
      model: MODEL_DEFAULT,
      max_tokens: 1024,
      system: ANALYZE_CREATIVE_SYSTEM,
      messages: [{ role: "user", content }],
    });

    assertNotTruncated(message);
    const text = message.content.find((b) => b.type === "text")?.text ?? "{}";
    return creativeDNASchema.parse(parseModelJSON(text));
  }

  async clusterConcepts(
    dna: { adId: string; dna: CreativeDNA }[],
    marketDNA?: CreativeDNA[],
  ): Promise<ConceptClustering> {
    const message = await this.client.messages.create({
      model: MODEL_DEFAULT,
      // Ceiling, not a target: clustering a full 20-ad set must not truncate.
      max_tokens: 8192,
      system: CLUSTER_CONCEPTS_SYSTEM,
      messages: [
        { role: "user", content: buildClusterConceptsPrompt(dna, marketDNA) },
      ],
    });

    assertNotTruncated(message);
    const text = message.content.find((b) => b.type === "text")?.text ?? "{}";
    return conceptClusteringSchema.parse(parseModelJSON(text));
  }

  async generateJSON<T>(args: {
    system: string;
    prompt: string;
    schema: ZodType<T>;
  }): Promise<T> {
    const message = await this.client.messages.create({
      model: MODEL_DEFAULT,
      // Ceiling, not a target: a 10-brief batch with 3 platform variants each
      // overflows 4096 tokens, truncating the JSON so parsing fails on every
      // withRetry attempt and the route 500s.
      max_tokens: 16384,
      system: args.system,
      messages: [{ role: "user", content: args.prompt }],
    });

    assertNotTruncated(message);
    const text = message.content.find((b) => b.type === "text")?.text ?? "{}";
    return args.schema.parse(parseModelJSON(text));
  }
}
