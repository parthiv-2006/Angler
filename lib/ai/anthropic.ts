import Anthropic from "@anthropic-ai/sdk";
import type { ZodType } from "zod";
import type { AIProvider } from "./provider";
import type { CreativeDNA, ConceptClustering } from "@/lib/types";
import { creativeDNASchema, conceptClusteringSchema } from "./schemas";
import { ANALYZE_CREATIVE_SYSTEM, buildAnalyzeCreativePrompt } from "./prompts/analyze";
import { CLUSTER_CONCEPTS_SYSTEM, buildClusterConceptsPrompt } from "./prompts/cluster";

const MODEL_DEFAULT = "claude-sonnet-4-6";

export class AnthropicProvider implements AIProvider {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async analyzeCreative(input: {
    imageBase64?: string;
    imageUrl?: string;
    copy?: string;
    metadata?: Record<string, unknown>;
  }): Promise<CreativeDNA> {
    const content: Anthropic.MessageParam["content"] = [];

    if (input.imageUrl) {
      content.push({
        type: "image",
        source: { type: "url", url: input.imageUrl },
      });
    } else if (input.imageBase64) {
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: "image/jpeg",
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

    const text = message.content.find((b) => b.type === "text")?.text ?? "{}";
    return creativeDNASchema.parse(JSON.parse(text));
  }

  async clusterConcepts(dna: CreativeDNA[]): Promise<ConceptClustering> {
    const message = await this.client.messages.create({
      model: MODEL_DEFAULT,
      max_tokens: 2048,
      system: CLUSTER_CONCEPTS_SYSTEM,
      messages: [
        { role: "user", content: buildClusterConceptsPrompt(dna) },
      ],
    });

    const text = message.content.find((b) => b.type === "text")?.text ?? "{}";
    return conceptClusteringSchema.parse(JSON.parse(text));
  }

  async generateJSON<T>(args: {
    system: string;
    prompt: string;
    schema: ZodType<T>;
  }): Promise<T> {
    const message = await this.client.messages.create({
      model: MODEL_DEFAULT,
      max_tokens: 4096,
      system: args.system,
      messages: [{ role: "user", content: args.prompt }],
    });

    const text = message.content.find((b) => b.type === "text")?.text ?? "{}";
    return args.schema.parse(JSON.parse(text));
  }
}
