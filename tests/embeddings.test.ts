import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { buildEmbeddingText, dnaToText } from "@/lib/embeddings/input";
import { getEmbeddingProvider } from "@/lib/embeddings/provider";
import { VoyageProvider, toVoyageContent } from "@/lib/embeddings/voyage";
import type { CreativeDNA } from "@/lib/types";

const dna: CreativeDNA = {
  hookType: "question",
  angle: "pain point",
  format: "static image",
  offerFraming: "free quiz",
  ctaStyle: "take the quiz",
  targetPersona: "women 35-55",
  oneLineSummary: "Asks about cravings, pushes a GLP-1 quiz",
};

test("each view produces the expected text", () => {
  assert.equal(buildEmbeddingText("  Tired of cravings?  ", dna, "copy"), "Tired of cravings?");
  assert.equal(buildEmbeddingText("Tired of cravings?", dna, "dna"), dnaToText(dna));
  assert.equal(buildEmbeddingText("Tired of cravings?", dna, "copy+dna"), `Tired of cravings?\n\n${dnaToText(dna)}`);
});

test("empty copy falls back to DNA so no input is ever blank", () => {
  assert.equal(buildEmbeddingText("   ", dna, "copy"), dna.oneLineSummary);
  assert.equal(buildEmbeddingText("", dna, "copy+dna"), dnaToText(dna));
});

test("images are sent as data URLs after the text", () => {
  assert.deepEqual(toVoyageContent({ text: "hi" }), [{ type: "text", text: "hi" }]);
  assert.deepEqual(toVoyageContent({ text: "hi", imageBase64: "QUJD", imageMediaType: "image/png" })[1], {
    type: "image_base64",
    image_base64: "data:image/png;base64,QUJD",
  });
});

const realFetch = globalThis.fetch;
const realKey = process.env.VOYAGE_API_KEY;
afterEach(() => {
  globalThis.fetch = realFetch;
  if (realKey === undefined) delete process.env.VOYAGE_API_KEY;
  else process.env.VOYAGE_API_KEY = realKey;
});

test("no key means no provider, so callers fall back instead of erroring", () => {
  delete process.env.VOYAGE_API_KEY;
  assert.equal(getEmbeddingProvider(), null);
  process.env.VOYAGE_API_KEY = "test-key";
  assert.ok(getEmbeddingProvider());
});

test("batches requests and restores input order from the response index", async () => {
  const requestSizes: number[] = [];
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string) as { inputs: { content: { text: string }[] }[] };
    requestSizes.push(body.inputs.length);
    // Respond out of order to prove the client re-sorts by index.
    const data = body.inputs
      .map((input, index) => ({ index, embedding: [Number(input.content[0].text)] }))
      .reverse();
    return new Response(JSON.stringify({ data }), { status: 200 });
  }) as typeof fetch;

  const inputs = Array.from({ length: 40 }, (_, i) => ({ text: String(i) }));
  const vectors = await new VoyageProvider("k").embed(inputs);

  assert.deepEqual(requestSizes, [32, 8]);
  assert.deepEqual(vectors.map((v) => v[0]), inputs.map((_, i) => i));
});

test("permanent 4xx errors fail fast without retrying", async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return new Response("bad key", { status: 401 });
  }) as typeof fetch;

  await assert.rejects(new VoyageProvider("k").embed([{ text: "x" }]), /401/);
  assert.equal(calls, 1);
});
