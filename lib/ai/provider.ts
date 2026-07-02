import type { ZodType } from "zod";
import type { CreativeDNA, ConceptClustering } from "@/lib/types";

export interface AIProvider {
  analyzeCreative(input: {
    imageBase64?: string;
    imageUrl?: string;
    copy?: string;
    metadata?: Record<string, unknown>;
  }): Promise<CreativeDNA>;

  // `dna` is the user's own ad set to cluster, tagged with each ad's real id so the
  // model can echo it back in `adIds` instead of inventing placeholder ids. `marketDNA`
  // (the mined winners from Modules 1–2) grounds the gap analysis in what's winning.
  clusterConcepts(
    dna: { adId: string; dna: CreativeDNA }[],
    marketDNA?: CreativeDNA[],
  ): Promise<ConceptClustering>;

  generateJSON<T>(args: {
    system: string;
    prompt: string;
    schema: ZodType<T>;
  }): Promise<T>;
}

export function getProvider(): AIProvider {
  // Tolerate stray whitespace / inline `# comment` baked into the env value:
  // .env files don't strip `# ...` after a value, so take the first token only.
  const provider = (process.env.AI_PROVIDER ?? "anthropic").trim().split(/\s/)[0];

  if (provider === "gemini") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { GeminiProvider } = require("./gemini") as {
      GeminiProvider: new () => AIProvider;
    };
    return new GeminiProvider();
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { AnthropicProvider } = require("./anthropic") as {
    AnthropicProvider: new () => AIProvider;
  };
  return new AnthropicProvider();
}
