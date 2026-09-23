import type { EmbeddingInput } from "./input";

export interface EmbeddingProvider {
  readonly model: string;
  readonly dimensions: number;
  // Returns one vector per input, in input order.
  embed(inputs: EmbeddingInput[]): Promise<number[][]>;
}

// Embeddings are optional: without a key the scorer falls back to the LLM-only path,
// and the seed path uses precomputed vectors, so the demo still needs no credentials.
export function getEmbeddingProvider(): EmbeddingProvider | null {
  const apiKey = process.env.VOYAGE_API_KEY?.trim();
  if (!apiKey) return null;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { VoyageProvider } = require("./voyage") as {
    VoyageProvider: new (apiKey: string) => EmbeddingProvider;
  };
  return new VoyageProvider(apiKey);
}
