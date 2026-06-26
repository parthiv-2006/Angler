"use client";

import { useState } from "react";
import type { Ad, CreativeDNA, ConceptClustering, AngleBrief } from "@/lib/types";

type Step = "mine" | "deconstruct" | "score" | "generate";

interface AppState {
  vertical: string;
  ads: Ad[];
  dnaResults: { adId: string; dna: CreativeDNA }[];
  clustering: ConceptClustering | null;
  briefs: AngleBrief[];
  step: Step;
  loading: boolean;
  error: string | null;
}

const SEED_VERTICALS = ["weight-loss supplement", "debt relief", "ED telehealth"];

export default function Home() {
  const [state, setState] = useState<AppState>({
    vertical: "",
    ads: [],
    dnaResults: [],
    clustering: null,
    briefs: [],
    step: "mine",
    loading: false,
    error: null,
  });

  async function handleMine() {
    setState((s) => ({ ...s, loading: true, error: null }));

    const res = await fetch("/api/mine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vertical: state.vertical }),
    });

    const data = await res.json();

    if (!res.ok) {
      setState((s) => ({ ...s, loading: false, error: data.error }));
      return;
    }

    setState((s) => ({ ...s, ads: data.ads, step: "deconstruct", loading: false }));
  }

  async function handleDeconstruct() {
    setState((s) => ({ ...s, loading: true, error: null }));

    const res = await fetch("/api/deconstruct", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ads: state.ads.slice(0, 15).map((ad) => ({
          id: ad.id,
          coverUrl: ad.coverUrl,
          copy: ad.copy,
        })),
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setState((s) => ({ ...s, loading: false, error: data.error }));
      return;
    }

    setState((s) => ({ ...s, dnaResults: data.results, step: "score", loading: false }));
  }

  async function handleScore() {
    setState((s) => ({ ...s, loading: true, error: null }));

    const res = await fetch("/api/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dna: state.dnaResults.map((r) => r.dna) }),
    });

    const data = await res.json();

    if (!res.ok) {
      setState((s) => ({ ...s, loading: false, error: data.error }));
      return;
    }

    setState((s) => ({ ...s, clustering: data.clustering, step: "generate", loading: false }));
  }

  async function handleGenerate() {
    if (!state.clustering) return;
    setState((s) => ({ ...s, loading: true, error: null }));

    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vertical: state.vertical,
        winnerSummary: "",
        marketDNA: state.dnaResults.map((r) => r.dna),
        clustering: state.clustering,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setState((s) => ({ ...s, loading: false, error: data.error }));
      return;
    }

    setState((s) => ({ ...s, briefs: data.briefs, loading: false }));
  }

  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "48px 24px" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Creative Strategist</h1>
      <p style={{ color: "var(--text-muted)", marginBottom: 40 }}>
        Find what&apos;s winning in your vertical → score your ad diversity → generate new angles.
      </p>

      {/* Step 1 — Mine */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>1. Enter a vertical</h2>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          {SEED_VERTICALS.map((v) => (
            <button
              key={v}
              onClick={() => setState((s) => ({ ...s, vertical: v }))}
              style={{
                padding: "4px 12px",
                borderRadius: 9999,
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "var(--text-muted)",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              {v}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={state.vertical}
            onChange={(e) => setState((s) => ({ ...s, vertical: e.target.value }))}
            placeholder="e.g. weight-loss supplement"
            style={{
              flex: 1,
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--text)",
              fontSize: 15,
            }}
          />
          <button
            onClick={handleMine}
            disabled={state.loading || !state.vertical}
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              border: "none",
              background: "var(--accent)",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {state.loading && state.step === "mine" ? "Searching…" : "Find Ads"}
          </button>
        </div>
      </section>

      {state.error && (
        <p style={{ color: "#f87171", marginBottom: 24 }}>{state.error}</p>
      )}

      {/* Ads list */}
      {state.ads.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600 }}>
              2. Competitor ads — {state.ads.length} found
            </h2>
            <button
              onClick={handleDeconstruct}
              disabled={state.loading}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "none",
                background: "var(--accent)",
                color: "#fff",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              {state.loading && state.step === "deconstruct" ? "Analyzing…" : "Analyze DNA"}
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {state.ads.slice(0, 10).map((ad) => (
              <div
                key={ad.id}
                style={{
                  padding: 16,
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--surface)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{ad.advertiser}</span>
                  <span style={{ color: "var(--accent)", fontSize: 13 }}>Running {ad.runDays}d</span>
                </div>
                <p style={{ color: "var(--text-muted)", fontSize: 13 }}>{ad.copy}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* DNA results */}
      {state.dnaResults.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600 }}>3. Creative DNA</h2>
            <button
              onClick={handleScore}
              disabled={state.loading}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "none",
                background: "var(--accent)",
                color: "#fff",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              {state.loading && state.step === "score" ? "Scoring…" : "Score Diversity"}
            </button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {state.dnaResults.map((r) => (
              <div
                key={r.adId}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--surface)",
                  fontSize: 13,
                }}
              >
                <span style={{ color: "var(--accent)" }}>{r.dna.angle}</span>
                {" · "}
                <span style={{ color: "var(--text-muted)" }}>{r.dna.format}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Clustering */}
      {state.clustering && (
        <section style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600 }}>
              4. Diversity — {state.clustering.nAds} ads → {state.clustering.kConcepts} concepts
            </h2>
            <button
              onClick={handleGenerate}
              disabled={state.loading}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "none",
                background: "var(--accent)",
                color: "#fff",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              {state.loading && state.step === "generate" ? "Generating…" : "Generate Angles"}
            </button>
          </div>
          {state.clustering.gaps.length > 0 && (
            <div style={{ padding: 16, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)" }}>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Angle gaps:</p>
              <ul style={{ paddingLeft: 20, fontSize: 13, color: "var(--text-muted)" }}>
                {state.clustering.gaps.map((g, i) => <li key={i}>{g}</li>)}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Angle briefs */}
      {state.briefs.length > 0 && (
        <section>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
            5. Angle briefs — {state.briefs.length} generated
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {state.briefs.map((brief, i) => (
              <div
                key={i}
                style={{
                  padding: 16,
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--surface)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontWeight: 600 }}>{brief.angleName}</span>
                  <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
                    #{brief.priority} · {brief.emotionalDriver}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>{brief.whyNow}</p>
                <p style={{ fontSize: 14, fontStyle: "italic", marginBottom: 8 }}>&ldquo;{brief.hookLine}&rdquo;</p>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  <span>Meta: {brief.variants.meta}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
