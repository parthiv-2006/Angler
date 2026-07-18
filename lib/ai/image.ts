// Resolves an ad's cover-image URL into inline base64 for vision analysis.
//
// Ad-library CDNs (fbcdn in particular) refuse requests from non-browser
// agents, so model providers that fetch image URLs themselves (Anthropic's
// `type: "url"` source) get a 403 and fail the whole API call. Fetching here
// with browser-like headers and passing bytes inline works for every provider.

const FETCH_TIMEOUT_MS = 8_000;
const MAX_IMAGE_BYTES = 4_000_000; // stay under provider inline-image limits

const ALLOWED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export type ImageMediaType = (typeof ALLOWED_MEDIA_TYPES)[number];

export interface FetchedImage {
  base64: string;
  mediaType: ImageMediaType;
}

// Best-effort: returns null on any failure (blocked, expired, oversized,
// non-image) so callers can degrade to text-only analysis instead of erroring.
export async function fetchImageAsBase64(url: string): Promise<FetchedImage | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;

    const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    const mediaType = ALLOWED_MEDIA_TYPES.find((t) => t === contentType);
    if (!mediaType) return null;

    const bytes = await res.arrayBuffer();
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) return null;

    return { base64: Buffer.from(bytes).toString("base64"), mediaType };
  } catch {
    return null;
  }
}
