import { withRetry } from "@/lib/cache";
import type { EmbeddingInput } from "./input";
import type { EmbeddingProvider } from "./provider";

// Voyage is Anthropic's recommended embeddings partner. The multimodal model embeds
// ad copy and the ad image into one vector space, so an uploaded screenshot counts
// for what it shows, not just what its caption says.
// Docs: https://docs.voyageai.com/reference/multimodal-embeddings-api
const ENDPOINT = "https://api.voyageai.com/v1/multimodalembeddings";
export const VOYAGE_MODEL = "voyage-multimodal-3.5";
// Matryoshka-truncated: half the storage of the 1024 default, so seed vectors stay small
// in the repo and in pgvector, at a negligible cost in retrieval quality.
export const VOYAGE_DIMENSIONS = 512;

// Well under the API's 1,000-input / 320k-token request caps even with images.
const BATCH_SIZE = 32;
const REQUEST_TIMEOUT_MS = 30_000;

type ContentItem = { type: "text"; text: string } | { type: "image_base64"; image_base64: string };

interface VoyageResponse {
  data: { embedding: number[]; index: number }[];
}

export function toVoyageContent(input: EmbeddingInput): ContentItem[] {
  const content: ContentItem[] = [{ type: "text", text: input.text }];
  if (input.imageBase64) {
    const mediaType = input.imageMediaType ?? "image/jpeg";
    content.push({ type: "image_base64", image_base64: `data:${mediaType};base64,${input.imageBase64}` });
  }
  return content;
}

export class VoyageProvider implements EmbeddingProvider {
  readonly model = VOYAGE_MODEL;
  readonly dimensions = VOYAGE_DIMENSIONS;

  constructor(private readonly apiKey: string) {}

  async embed(inputs: EmbeddingInput[]): Promise<number[][]> {
    const vectors: number[][] = [];
    for (let start = 0; start < inputs.length; start += BATCH_SIZE) {
      const batch = inputs.slice(start, start + BATCH_SIZE);
      vectors.push(...(await withRetry(() => this.embedBatch(batch))));
    }
    return vectors;
  }

  private async embedBatch(batch: EmbeddingInput[]): Promise<number[][]> {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        input_type: "document",
        output_dimension: this.dimensions,
        inputs: batch.map((input) => ({ content: toVoyageContent(input) })),
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      // `status` lets withRetry skip retries on permanent 4xx errors.
      throw Object.assign(new Error(`Voyage embeddings failed (${res.status}): ${detail.slice(0, 200)}`), {
        status: res.status,
      });
    }

    const body = (await res.json()) as VoyageResponse;
    if (body.data?.length !== batch.length) {
      throw new Error(`Voyage returned ${body.data?.length ?? 0} embeddings for ${batch.length} inputs`);
    }
    return [...body.data].sort((a, b) => a.index - b.index).map((d) => d.embedding);
  }
}
