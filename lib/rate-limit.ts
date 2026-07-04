import { NextRequest, NextResponse } from "next/server";

// Naive in-memory sliding-window limiter for the routes that spend money
// (AI calls, Apify runs). Serverless instances don't share state, so this is
// best-effort abuse protection; enough to stop a naive loop from draining
// the API budget, generous enough that a judge clicking through the demo
// never sees it. Seed-path short-circuits run before this check.
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 30;

const hits = new Map<string, number[]>();

// Returns a ready-made 429 response when the caller is over budget, or null.
export function rateLimited(req: NextRequest): NextResponse | null {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 10_000) hits.clear(); // bound memory on a long-lived instance

  if (recent.length <= MAX_REQUESTS) return null;
  return NextResponse.json(
    { error: "Too many requests. Please wait a minute and try again." },
    { status: 429 },
  );
}
