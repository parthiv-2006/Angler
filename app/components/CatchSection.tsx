"use client";

import type { Ref } from "react";
import type { Ad, CreativeDNA } from "@/lib/types";
import Section from "./Section";
import { C, SERIF, SANS, MONO, font, jumpLink, avatarBg, firstLine, hashStr, CREATIVE_BGS, kickerFor } from "./theme";

// Nº1 — The Catch: ranked ledger of the longest-running market ads, a desk-note
// pull quote (winner summary), and a sticky simulated in-feed preview of the
// clicked row.
export default function CatchSection({
  innerRef,
  ads,
  dnaById,
  selected,
  onSelect,
  winnerSummary,
  fromSeed,
  cachedDate,
  sourcesLabel,
  extractLabel,
  onExtract,
  extractDisabled,
}: {
  innerRef: Ref<HTMLElement>;
  ads: Ad[];
  dnaById: Map<string, CreativeDNA>;
  selected: number;
  onSelect: (i: number) => void;
  winnerSummary: string | null;
  fromSeed: boolean;
  cachedDate: string;
  sourcesLabel: string;
  extractLabel: string;
  onExtract: () => void;
  extractDisabled: boolean;
}) {
  const maxDays = Math.max(...ads.map((a) => a.runDays), 1);
  const sel = ads[selected] ?? ads[0];
  const selDna = sel ? dnaById.get(sel.id) : undefined;
  const provenance = fromSeed ? `cached ${cachedDate}` : "pulled live";

  return (
    <Section
      num="Nº1"
      id="step-ads"
      innerRef={innerRef}
      title="THE CATCH — MARKET WINNERS"
      meta={`${ads.length} real ads · ${sourcesLabel} · ranked by days live · ${provenance}`}
      action={
        <button onClick={onExtract} disabled={extractDisabled} className="hover-underline" style={jumpLink}>
          {extractLabel}
        </button>
      }
      padding="54px 32px 46px"
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 330px", gap: 32, alignItems: "start", paddingTop: 6 }}>
        {/* ledger */}
        <div>
          {ads.map((ad, i) => (
            <div
              key={ad.id}
              onClick={() => onSelect(i)}
              className="ledger-row"
              style={{
                display: "grid",
                gridTemplateColumns: "34px 148px 1fr 128px",
                gap: 12,
                padding: "11px 8px",
                margin: "0 -8px",
                borderBottom: `1px solid ${C.border3}`,
                alignItems: "center",
                cursor: "pointer",
                borderRadius: 6,
                background: i === selected ? "rgba(194,65,12,0.06)" : "transparent",
                opacity: 0,
                animation: `rise 0.45s ease ${(i * 0.05).toFixed(2)}s forwards`,
              }}
            >
              <span style={{ color: C.faint, ...font(400, 12, MONO) }}>{String(i + 1).padStart(2, "0")}</span>
              <span style={{ color: C.ink, ...font(600, 13, SANS), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {ad.advertiser}
              </span>
              <span style={{ color: C.ink2, ...font(400, 14, SERIF), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {firstLine(ad.copy, 96)}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                <div
                  style={{
                    width: Math.max(6, Math.round((ad.runDays / maxDays) * 72)),
                    height: 10,
                    background: `repeating-linear-gradient(90deg, ${i < 3 ? C.green : "#B9B2A2"} 0 2px, transparent 2px 6px)`,
                  }}
                />
                <span style={{ color: i < 3 ? C.green : C.ink, ...font(600, 13, MONO), minWidth: 42, textAlign: "right" }}>
                  {ad.runDays}d
                </span>
              </div>
            </div>
          ))}

          {/* desk note */}
          {winnerSummary && (
            <div style={{ marginTop: 20, borderLeft: `3px solid ${C.accent}`, padding: "4px 0 4px 18px" }}>
              <div style={{ color: C.accent, ...font(500, 10, MONO, { ls: "0.14em" }), marginBottom: 6 }}>
                DESK NOTE — WHAT&apos;S WINNING &amp; WHY
              </div>
              <p style={{ color: C.ink2, ...font(400, 15, SERIF, { lh: 1.65, italic: true }), margin: 0, maxWidth: 640 }}>
                {winnerSummary}
              </p>
            </div>
          )}
        </div>

        {/* sticky in-feed preview */}
        {sel && (
          <div style={{ position: "sticky", top: 84 }}>
            <div
              style={{
                background: "#FFF",
                border: `1px solid ${C.border2}`,
                borderRadius: 11,
                overflow: "hidden",
                boxShadow: "0 14px 34px rgba(28,25,23,0.12)",
                transform: "rotate(0.8deg)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 13px" }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: avatarBg(sel.advertiser),
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    ...font(700, 13, SANS),
                  }}
                >
                  {sel.advertiser.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <div style={{ color: "#111", ...font(600, 12, SANS) }}>{sel.advertiser}</div>
                  <div style={{ color: C.faint2, ...font(400, 10, SANS) }}>Sponsored · {sel.runDays} days live</div>
                </div>
                <span style={{ marginLeft: "auto", color: "#C2C0B4", ...font(700, 14, SANS, { ls: "0.1em" }) }}>···</span>
              </div>
              <div style={{ padding: "0 13px 10px", color: "#222", ...font(400, 12, SANS, { lh: 1.5 }), whiteSpace: "pre-line" }}>
                {firstLine(sel.copy, 220)}
              </div>
              <div
                style={{
                  background: CREATIVE_BGS[hashStr(sel.id) % CREATIVE_BGS.length],
                  padding: "20px 16px",
                  minHeight: 96,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  gap: 5,
                }}
              >
                <div style={{ color: "rgba(255,255,255,0.72)", ...font(600, 9, MONO, { ls: "0.1em" }) }}>{kickerFor(selDna?.hookType)}</div>
                <div style={{ color: "#FFFFFF", ...font(600, 16, SERIF, { lh: 1.3 }) }}>{firstLine(sel.copy, 64)}</div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 13px", background: "#F4F1E9" }}>
                <span style={{ color: C.body, ...font(500, 10, SANS, { ls: "0.04em" }) }}>
                  {sel.advertiser.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 18)}.COM
                </span>
                <span style={{ background: C.border2, color: "#111", ...font(600, 11, SANS), borderRadius: 5, padding: "4px 11px" }}>
                  Learn more
                </span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 10, justifyContent: "center", flexWrap: "wrap" }}>
              {[`angle: ${selDna?.angle ?? "—"}`, `format: ${selDna?.format ?? "—"}`, `hook: ${selDna?.hookType ?? "—"}`].map((label) => (
                <span
                  key={label}
                  style={{ color: C.muted, border: `1px solid ${C.border}`, background: C.card, ...font(500, 10, MONO), borderRadius: 999, padding: "3px 10px" }}
                >
                  {label}
                </span>
              ))}
            </div>
            <p style={{ color: C.faint, ...font(400, 11, SANS), textAlign: "center", margin: "8px 0 0" }}>
              click a row to preview it in-feed
            </p>
          </div>
        )}
      </div>
    </Section>
  );
}
