"use client";

import { useEffect, useState } from "react";
import type { Ad, CreativeDNA, ConceptClustering, AngleBrief } from "@/lib/types";

interface SampleSummary {
  slug: string;
  label: string;
  vertical: string;
  adCount: number;
}

interface AppState {
  vertical: string;
  ads: Ad[];
  winnerSummary: string | null;
  fromSeed: boolean;
  unavailable: string | null;
  marketDna: { adId: string; dna: CreativeDNA }[];
  // Module 3 — the user's own ad set
  sampleSets: SampleSummary[];
  userAds: Ad[];
  selectedSample: string | null;
  pasteText: string;
  budget: string;
  clustering: ConceptClustering | null;
  briefs: AngleBrief[];
  loading: boolean;
  loadingStep: string;
  error: string | null;
}

const SEED_VERTICALS = [
  { label: "Weight-Loss Supplement", value: "weight-loss supplement" },
  { label: "Debt Relief", value: "debt relief" },
  { label: "ED Telehealth", value: "ed telehealth" },
];

const INITIAL: AppState = {
  vertical: "",
  ads: [],
  winnerSummary: null,
  fromSeed: false,
  unavailable: null,
  marketDna: [],
  sampleSets: [],
  userAds: [],
  selectedSample: null,
  pasteText: "",
  budget: "",
  clustering: null,
  briefs: [],
  loading: false,
  loadingStep: "",
  error: null,
};

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default function Home() {
  const [state, setState] = useState<AppState>(INITIAL);

  useEffect(() => {
    fetch("/api/samples")
      .then((r) => r.json())
      .then((d) => setState((s) => ({ ...s, sampleSets: d.samples ?? [] })))
      .catch(() => {});
  }, []);

  function setLoading(step: string) {
    setState((s) => ({ ...s, loading: true, error: null, loadingStep: step }));
  }
  function setError(error: string) {
    setState((s) => ({ ...s, loading: false, loadingStep: "", error }));
  }

  async function handleMine() {
    setLoading("Pulling competitor ads…");
    try {
      const res = await fetch("/api/mine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vertical: state.vertical }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error ?? "Something went wrong");
      setState((s) => ({
        ...s,
        ads: data.ads ?? [],
        winnerSummary: data.winnerSummary ?? null,
        fromSeed: !!data.fromSeed,
        unavailable: data.unavailable ? data.message : null,
        marketDna: [],
        userAds: [],
        selectedSample: null,
        clustering: null,
        briefs: [],
        loading: false,
        loadingStep: "",
        error: null,
      }));
    } catch {
      setError("Network error — please try again");
    }
  }

  async function handleDeconstruct() {
    setLoading("Extracting creative DNA…");
    try {
      const res = await fetch("/api/deconstruct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vertical: state.vertical,
          ads: state.ads.slice(0, 15).map((ad) => ({
            id: ad.id,
            coverUrl: ad.coverUrl || undefined,
            copy: ad.copy || undefined,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error ?? "Failed to analyze creatives");
      setState((s) => ({ ...s, marketDna: data.results, clustering: null, briefs: [], loading: false, loadingStep: "" }));
    } catch {
      setError("Network error — please try again");
    }
  }

  // Module 3 — score a pre-baked sample ad set (instant, seed path).
  async function handleScoreSample(slug: string) {
    setLoading("Scoring your ad set…");
    try {
      const setRes = await fetch(`/api/samples?slug=${encodeURIComponent(slug)}`);
      const sample = await setRes.json();
      if (!setRes.ok) return setError(sample.error ?? "Couldn't load sample set");

      const res = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sampleSetId: slug,
          dna: sample.dna.map((d: { dna: CreativeDNA }) => d.dna),
          marketDNA: state.marketDna.map((r) => r.dna),
        }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error ?? "Failed to score diversity");
      setState((s) => ({
        ...s,
        userAds: sample.ads,
        selectedSample: slug,
        clustering: data.clustering,
        briefs: [],
        loading: false,
        loadingStep: "",
      }));
    } catch {
      setError("Network error — please try again");
    }
  }

  // Module 3 — score pasted ad copy (live path; needs an AI key).
  async function handleScorePaste() {
    const lines = state.pasteText.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length < 3) return setError("Paste at least 3 ad captions (one per line).");
    setLoading("Analyzing & scoring your ad set…");
    try {
      const userAds: Ad[] = lines.map((copy, i) => ({
        id: `paste_${i}`,
        source: "uploaded",
        advertiser: "Your Ad Set",
        coverUrl: "",
        copy,
        firstSeen: "",
        lastSeen: "",
        runDays: 0,
        rawMetrics: {},
      }));

      const dnaRes = await fetch("/api/deconstruct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ads: userAds.map((a) => ({ id: a.id, copy: a.copy })) }),
      });
      const dnaData = await dnaRes.json();
      if (!dnaRes.ok) return setError(dnaData.error ?? "Failed to analyze your ads");

      const res = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dna: dnaData.results.map((r: { dna: CreativeDNA }) => r.dna),
          marketDNA: state.marketDna.map((r) => r.dna),
        }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error ?? "Failed to score diversity");
      setState((s) => ({
        ...s,
        userAds,
        selectedSample: null,
        clustering: data.clustering,
        briefs: [],
        loading: false,
        loadingStep: "",
      }));
    } catch {
      setError("Network error — please try again");
    }
  }

  async function handleGenerate() {
    if (!state.clustering) return;
    setLoading("Generating angle briefs…");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vertical: state.vertical,
          winnerSummary: state.winnerSummary ?? "",
          marketDNA: state.marketDna.map((r) => r.dna),
          clustering: state.clustering,
        }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error ?? "Failed to generate angle briefs");
      setState((s) => ({ ...s, briefs: data.briefs, loading: false, loadingStep: "" }));
    } catch {
      setError("Network error — please try again");
    }
  }

  function handleCopyBrief(brief: AngleBrief) {
    const text = [
      `Angle: ${brief.angleName}`,
      `Driver: ${brief.emotionalDriver}`,
      `Why now: ${brief.whyNow}`,
      `Hook: ${brief.hookLine}`,
      `Format: ${brief.formatRecommendation}`,
      `Persona: ${brief.targetPersona}`,
      `Meta: ${brief.variants.meta}`,
      `TikTok: ${brief.variants.tiktok}`,
      `Native: ${brief.variants.native}`,
    ].join("\n");
    void navigator.clipboard.writeText(text);
  }

  function handleExportCSV() {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const headers = ["Priority", "Angle Name", "Emotional Driver", "Why Now", "Hook Line", "Format", "Persona", "Meta Copy", "TikTok Copy", "Native Copy"];
    const rows = [...state.briefs]
      .sort((a, b) => a.priority - b.priority)
      .map((b) => [b.priority, b.angleName, b.emotionalDriver, b.whyNow, b.hookLine, b.formatRecommendation, b.targetPersona, b.variants.meta, b.variants.tiktok, b.variants.native]
        .map((v) => esc(String(v)))
        .join(","));
    const csv = [headers.map((h) => esc(h)).join(","), ...rows].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `angle-briefs-${slugify(state.vertical) || "export"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const currentSlug = slugify(state.vertical);
  const relevantSamples = state.sampleSets.filter((s) => s.vertical === currentSlug);
  const samplesToShow = relevantSamples.length ? relevantSamples : state.sampleSets;

  const hasAds = state.ads.length > 0;
  const hasMarketDna = state.marketDna.length > 0;

  // Module 3 derived values — the Entity-ID "collapse" math (Feature A).
  const clustering = state.clustering;
  const adById = new Map(state.userAds.map((a) => [a.id, a] as const));
  const redundant = clustering ? clustering.nAds - clustering.kConcepts : 0;
  const wastePct = clustering && clustering.nAds > 0 ? Math.round((redundant / clustering.nAds) * 100) : 0;
  const budgetNum = parseFloat(state.budget);
  const estWaste = clustering && !isNaN(budgetNum) && budgetNum > 0 ? Math.round((budgetNum * wastePct) / 100) : null;

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "48px 24px" }}>
      <header style={{ marginBottom: 48 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.5px", marginBottom: 6 }}>
          Creative Strategist
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
          Reads what&apos;s winning in your vertical → scores your ad diversity → generates new angles.
        </p>
      </header>

      {/* ── Step 1: Mine ───────────────────────────────────────────────────── */}
      <section style={{ marginBottom: 40 }}>
        <Label step="1" text="Enter a vertical or offer" />
        <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
          {SEED_VERTICALS.map((v) => (
            <button
              key={v.value}
              onClick={() => setState((s) => ({ ...s, vertical: v.value }))}
              style={chipStyle(state.vertical === v.value)}
            >
              {v.label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={state.vertical}
            onChange={(e) => setState((s) => ({ ...s, vertical: e.target.value }))}
            onKeyDown={(e) => e.key === "Enter" && !state.loading && state.vertical && handleMine()}
            placeholder="e.g. weight-loss supplement, debt relief, ED telehealth…"
            style={inputStyle}
          />
          <button onClick={handleMine} disabled={state.loading || !state.vertical.trim()} style={primaryBtnStyle(state.loading)}>
            {state.loading && state.loadingStep.includes("Pulling") ? "Searching…" : "Find Ads"}
          </button>
        </div>
      </section>

      {state.error && <p style={{ color: "#f87171", marginBottom: 24, fontSize: 14 }}>{state.error}</p>}
      {state.unavailable && (
        <div style={{ ...calloutStyle, marginBottom: 24, borderColor: "rgba(245,158,11,0.4)", background: "rgba(245,158,11,0.06)" }}>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{state.unavailable}</p>
        </div>
      )}
      {state.loading && <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 24 }}>{state.loadingStep}</p>}

      {/* ── Step 2: Ads + winner summary ────────────────────────────────────── */}
      {hasAds && (
        <section style={{ marginBottom: 40 }}>
          <div style={sectionHeaderStyle}>
            <Label step="2" text={`${state.ads.length} competitor ads — sorted by run duration`} badge={state.fromSeed ? "instant" : "live"} />
            <button onClick={handleDeconstruct} disabled={state.loading} style={secondaryBtnStyle(state.loading)}>
              {state.loading && state.loadingStep.includes("DNA") ? "Analyzing…" : "Extract DNA →"}
            </button>
          </div>

          {state.winnerSummary && (
            <div style={calloutStyle}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", marginBottom: 6 }}>WHAT&apos;S WINNING &amp; WHY</p>
              <p style={{ fontSize: 13, lineHeight: 1.7, color: "var(--text-muted)" }}>{state.winnerSummary}</p>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
            {state.ads.map((ad) => (
              <div key={ad.id} style={cardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{ad.advertiser}</span>
                  <span style={{ color: "var(--accent)", fontSize: 12, fontWeight: 600 }}>
                    {ad.runDays}d running · {ad.source.replace(/_/g, " ")}
                  </span>
                </div>
                <p style={{ color: "var(--text-muted)", fontSize: 13, lineHeight: 1.5 }}>{ad.copy}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Step 3: Market DNA ───────────────────────────────────────────────── */}
      {hasMarketDna && (
        <section style={{ marginBottom: 40 }}>
          <Label step="3" text="Creative DNA of the market winners" />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {state.marketDna.map((r) => (
              <div key={r.adId} style={{ ...cardStyle, padding: "8px 12px" }}>
                <span style={{ color: "var(--accent)", fontSize: 12, fontWeight: 600 }}>{r.dna.angle}</span>
                <span style={{ color: "var(--border)", margin: "0 6px" }}>·</span>
                <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{r.dna.format}</span>
                <span style={{ color: "var(--border)", margin: "0 6px" }}>·</span>
                <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{r.dna.hookType}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Step 4: Score YOUR ad set ────────────────────────────────────────── */}
      {hasMarketDna && (
        <section style={{ marginBottom: 40 }}>
          <Label step="4" text="Score your own ad set for hidden redundancy" />
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 12 }}>
            Load a sample ad set (or paste your own captions) to see how many concepts Meta&apos;s
            algorithm really sees — and which proven angles you&apos;re missing.
          </p>

          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            {samplesToShow.map((sample) => (
              <button
                key={sample.slug}
                onClick={() => handleScoreSample(sample.slug)}
                disabled={state.loading}
                style={chipStyle(state.selectedSample === sample.slug)}
              >
                {sample.label}
              </button>
            ))}
          </div>

          <details style={{ marginBottom: 8 }}>
            <summary style={{ fontSize: 13, color: "var(--text-muted)", cursor: "pointer" }}>
              …or paste your own ad captions
            </summary>
            <textarea
              value={state.pasteText}
              onChange={(e) => setState((s) => ({ ...s, pasteText: e.target.value }))}
              placeholder={"One ad caption per line (min 3)…"}
              rows={4}
              style={{ ...inputStyle, width: "100%", marginTop: 8, fontFamily: "inherit", resize: "vertical" }}
            />
            <button onClick={handleScorePaste} disabled={state.loading} style={{ ...secondaryBtnStyle(state.loading), marginTop: 8 }}>
              Score pasted ads →
            </button>
          </details>

          {state.userAds.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
                YOUR AD SET ({state.userAds.length} ads)
              </p>
              {state.userAds.map((ad) => (
                <div key={ad.id} style={{ ...cardStyle, padding: "8px 12px" }}>
                  <p style={{ color: "var(--text-muted)", fontSize: 12, lineHeight: 1.5 }}>{ad.copy}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Step 5: Diversity result ─────────────────────────────────────────── */}
      {clustering && (
        <section style={{ marginBottom: 40 }}>
          <div style={sectionHeaderStyle}>
            <Label step="5" text={`Meta likely sees these ${clustering.nAds} ads as ${clustering.kConcepts} concepts`} />
            <button onClick={handleGenerate} disabled={state.loading} style={primaryBtnStyle(state.loading)}>
              {state.loading && state.loadingStep.includes("angle") ? "Generating…" : "Generate Angles →"}
            </button>
          </div>

          {/* Waste headline — the Entity-ID collapse, quantified (Feature A1) */}
          <div style={{ ...calloutStyle, borderColor: "rgba(245,158,11,0.4)", background: "rgba(245,158,11,0.06)", marginBottom: 16 }}>
            <p style={{ fontSize: 14, lineHeight: 1.6 }}>
              You&apos;re managing <strong>{clustering.nAds} ads</strong>, but Meta&apos;s Andromeda likely reads them as{" "}
              <strong>{clustering.kConcepts} distinct concepts</strong> —{" "}
              <strong style={{ color: "#f59e0b" }}>
                {redundant} {redundant === 1 ? "is a redundant duplicate" : "are redundant duplicates"}
              </strong>{" "}
              (~{wastePct}% of your creative-testing effort is wasted auction entries).
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Monthly creative-test budget ($):</span>
              <input
                value={state.budget}
                onChange={(e) => setState((s) => ({ ...s, budget: e.target.value }))}
                placeholder="e.g. 10000"
                inputMode="numeric"
                style={{ ...inputStyle, flex: "none", width: 130, padding: "6px 10px" }}
              />
              {estWaste !== null && (
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  ≈ <span style={{ color: "#f59e0b" }}>${estWaste.toLocaleString()}/mo</span> managing redundant creative{" "}
                  <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(estimated)</span>
                </span>
              )}
            </div>
          </div>

          {/* Visual collapse — N ad cards grouping into K concept buckets (Feature A2) */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {clustering.clusters.map((cluster, i) => {
              const color = BUCKET_COLORS[i % BUCKET_COLORS.length];
              return (
                <div key={i} style={{ ...cardStyle, borderColor: color, borderLeft: `3px solid ${color}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <p style={{ fontWeight: 600, fontSize: 13, color }}>{cluster.concept}</p>
                    {cluster.adIds.length > 1 && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: color, borderRadius: 9999, padding: "2px 9px", whiteSpace: "nowrap" }}>
                        {cluster.adIds.length}× collapsed
                      </span>
                    )}
                  </div>
                  <p style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 10 }}>{cluster.reason}</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {cluster.adIds.map((id) => (
                      <div key={id} style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.45, padding: "7px 11px", borderRadius: 6, background: "var(--bg)", border: "1px solid var(--border)" }}>
                        {adById.get(id)?.copy ?? id}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {clustering.gaps.length > 0 && (
            <div style={{ ...calloutStyle, marginTop: 16, borderColor: "rgba(245,158,11,0.3)", background: "rgba(245,158,11,0.06)" }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#f59e0b", marginBottom: 8 }}>
                ANGLE GAPS — proven market angles you&apos;re not running
              </p>
              <ul style={{ paddingLeft: 16, margin: 0 }}>
                {clustering.gaps.map((g, i) => (
                  <li key={i} style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 4 }}>{g}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* ── Step 6: Angle briefs ─────────────────────────────────────────────── */}
      {state.briefs.length > 0 && (
        <section>
          <div style={sectionHeaderStyle}>
            <Label step="6" text={`${state.briefs.length} prioritized angle briefs`} />
            <button onClick={handleExportCSV} style={secondaryBtnStyle(false)}>
              Export CSV
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[...state.briefs].sort((a, b) => a.priority - b.priority).map((brief, i) => (
              <div key={i} style={cardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{brief.angleName}</span>
                    <span style={{ color: "var(--text-muted)", fontSize: 12, marginLeft: 10 }}>
                      #{brief.priority} · {brief.emotionalDriver}
                    </span>
                  </div>
                  <button
                    onClick={() => handleCopyBrief(brief)}
                    style={{ fontSize: 11, color: "var(--text-muted)", background: "none", border: "1px solid var(--border)", borderRadius: 4, padding: "3px 8px", cursor: "pointer" }}
                  >
                    Copy
                  </button>
                </div>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>{brief.whyNow}</p>
                <p style={{ fontSize: 14, fontStyle: "italic", marginBottom: 10 }}>&ldquo;{brief.hookLine}&rdquo;</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <CopyVariant platform="Meta" copy={brief.variants.meta} />
                  <CopyVariant platform="TikTok" copy={brief.variants.tiktok} />
                  <CopyVariant platform="Native" copy={brief.variants.native} />
                </div>
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
                  Format: {brief.formatRecommendation} · Persona: {brief.targetPersona}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Label({ step, text, badge }: { step: string; text: string; badge?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
      <span style={{ background: "var(--accent)", color: "#fff", borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
        {step}
      </span>
      <span style={{ fontWeight: 600, fontSize: 15 }}>{text}</span>
      {badge && (
        <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 9999, background: badge === "instant" ? "#10b981" : "#6366f1", color: "#fff", fontWeight: 600 }}>
          {badge}
        </span>
      )}
    </div>
  );
}

function CopyVariant({ platform, copy }: { platform: string; copy: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    void navigator.clipboard.writeText(copy);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", minWidth: 44, paddingTop: 1 }}>{platform}</span>
      <span style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.4, flex: 1 }}>{copy}</span>
      <button
        onClick={handleCopy}
        style={{ fontSize: 11, color: copied ? "#10b981" : "var(--text-muted)", background: "none", border: "1px solid var(--border)", borderRadius: 4, padding: "2px 7px", cursor: "pointer", flexShrink: 0, transition: "color 0.15s" }}
      >
        {copied ? "✓" : "Copy"}
      </button>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

// Distinct hues for the concept buckets in Step 5 (cycled by index).
const BUCKET_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ec4899", "#06b6d4", "#a855f7"];

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: 14,
  outline: "none",
};

function chipStyle(active: boolean): React.CSSProperties {
  return {
    padding: "5px 13px",
    borderRadius: 9999,
    border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
    background: active ? "rgba(99,102,241,0.15)" : "var(--surface)",
    color: active ? "var(--accent)" : "var(--text-muted)",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: active ? 600 : 400,
  };
}

function primaryBtnStyle(loading: boolean): React.CSSProperties {
  return {
    padding: "10px 20px",
    borderRadius: 8,
    border: "none",
    background: loading ? "#4338ca" : "var(--accent)",
    color: "#fff",
    fontWeight: 600,
    cursor: loading ? "not-allowed" : "pointer",
    fontSize: 14,
    whiteSpace: "nowrap",
  };
}

function secondaryBtnStyle(loading: boolean): React.CSSProperties {
  return {
    padding: "7px 14px",
    borderRadius: 8,
    border: "1px solid var(--accent)",
    background: "transparent",
    color: "var(--accent)",
    fontWeight: 600,
    cursor: loading ? "not-allowed" : "pointer",
    fontSize: 13,
    whiteSpace: "nowrap",
  };
}

const cardStyle: React.CSSProperties = {
  padding: 16,
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface)",
};

const calloutStyle: React.CSSProperties = {
  padding: 16,
  borderRadius: 8,
  border: "1px solid rgba(99,102,241,0.3)",
  background: "rgba(99,102,241,0.06)",
};

const sectionHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 12,
};
