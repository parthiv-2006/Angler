import { NextResponse } from "next/server";

// Global daily cap on metered requests (live scrapes + AI calls). The per-IP
// limiter in lib/rate-limit.ts stops a single caller from looping; this bounds
// the site's total worst-case spend per day across all callers. Seed paths are
// never metered. The counter lives in Supabase (migration 003) so every
// serverless instance shares one budget.
const DEFAULT_CAP = 150; // ~25 full live reports/day at ~6 metered requests each

function dailyCap(): number {
  const parsed = Number(process.env.LIVE_DAILY_CAP);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_CAP;
}

// Fallback when Supabase is absent or unreachable: a per-instance counter.
// Best-effort only (instances don't share state), but still bounds a runaway
// loop the same way the in-memory rate limiter does.
let localDay = "";
let localCount = 0;

function underLocalCap(cap: number): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== localDay) {
    localDay = today;
    localCount = 0;
  }
  localCount += 1;
  return localCount <= cap;
}

export const BUDGET_MESSAGE =
  "Today's live-analysis budget is used up. The seeded verticals (Weight-Loss, Debt Relief, ED Telehealth, Investing Newsletter) still run instantly - or come back tomorrow.";

// Counts this request against today's global budget and returns whether it is
// allowed to proceed. Call only on branches that spend money.
export async function underDailyCap(): Promise<boolean> {
  const cap = dailyCap();

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return underLocalCap(cap);
  }

  try {
    const { getDbClient } = await import("@/lib/db/client");
    const { data, error } = await getDbClient().rpc("increment_live_usage", { cap });
    if (error) throw error;
    return data === true;
  } catch (err) {
    // Fail open onto the local counter: a broken budget check should degrade to
    // best-effort protection, not take the live path down with it.
    console.error("[budget] daily-cap check failed:", err);
    return underLocalCap(cap);
  }
}

// Ready-made 429 for spend routes that are over the daily budget.
export function budgetExceeded(): NextResponse {
  return NextResponse.json({ error: BUDGET_MESSAGE }, { status: 429 });
}
