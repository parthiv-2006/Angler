import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ZodType } from "zod";
import type { AIProvider } from "./provider";
import type { CreativeDNA, ConceptClustering } from "@/lib/types";
import { creativeDNASchema, conceptClusteringSchema } from "./schemas";
import { ANALYZE_CREATIVE_SYSTEM, buildAnalyzeCreativePrompt } from "./prompts/analyze";
import { CLUSTER_CONCEPTS_SYSTEM, buildClusterConceptsPrompt } from "./prompts/cluster";

const MODEL_DEFAULT = "gemini-2.0-flash";

export class GeminiProvider implements AIProvider {
  private client: GoogleGenerativeAI;

  constructor() {
    this.client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");
  }

  async analyzeCreative(input: {
    imageBase64?: string;
    imageUrl?: string;
    copy?: string;
    metadata?: Record<string, unknown>;
  }): Promise<CreativeDNA> {
    const model = this.client.getGenerativeModel({ model: MODEL_DEFAULT });
    const parts: Parameters<typeof model.generateContent>[0] extends { contents: infer C } ? C : never[] = [];

    const imagePart = input.imageBase64
      ? { inlineData: { mimeType: "image/jpeg" as const, data: input.imageBase64 } }
      : null;

    const textPart = {
      text: `${ANALYZE_CREATIVE_SYSTEM}\n\n${buildAnalyzeCreativePrompt(input.copy, input.metadata)}`,
    };

    const content = imagePart
      ? [{ role: "user", parts: [imagePart, textPart] }]
      : [{ role: "user", parts: [textPart] }];

    void parts; // unused — Gemini content shape differs from the local type annotation above
    const result = await model.generateContent({ contents: content });
    const text = result.response.text();
    return creativeDNASchema.parse(JSON.parse(text));
  }

  async clusterConcepts(dna: CreativeDNA[]): Promise<ConceptClustering> {
    const model = this.client.getGenerativeModel({ model: MODEL_DEFAULT });
    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `${CLUSTER_CONCEPTS_SYSTEM}\n\n${buildClusterConceptsPrompt(dna)}`,
            },
          ],
        },
      ],
    });
    const text = result.response.text();
    return conceptClusteringSchema.parse(JSON.parse(text));
  }

  async generateJSON<T>(args: {
    system: string;
    prompt: string;
    schema: ZodType<T>;
  }): Promise<T> {
    const model = this.client.getGenerativeModel({ model: MODEL_DEFAULT });
    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: `${args.system}\n\n${args.prompt}` }],
        },
      ],
    });
    const text = result.response.text();
    return args.schema.parse(JSON.parse(text));
  }
}
