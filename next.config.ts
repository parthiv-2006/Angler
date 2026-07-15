import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The seed/sample JSON under data/ is read at runtime via readFileSync with a
  // slug-built path (data/seed/${slug}.json), which Next's file tracer can't
  // detect statically. Without this, the files are absent from the Vercel
  // serverless bundle: getSeedAds() returns null in prod, /api/mine yields zero
  // ads, and /api/deconstruct then 400s ("Invalid request") on an empty batch.
  // Force the whole data dir into every function's trace (~320KB, negligible).
  outputFileTracingIncludes: {
    "/**": ["./data/**/*"],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.tiktok.com" },
      { protocol: "https", hostname: "**.fbcdn.net" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
