"use client";

import { useRef, useState, type Ref } from "react";
import type { Ad, AngleBrief, ConceptClustering } from "@/lib/types";
import Section from "./Section";
import { C, SERIF, SANS, MONO, font, outlineBtn, avatarBg } from "./theme";

const PLATFORMS = [
  ["meta", "Meta"],
  ["tiktok", "TikTok"],
  ["native", "Native"],
] as const;

type Platform = (typeof PLATFORMS)[number][0];

// Nº4 — Next Angles to Run: 2-column grid of brutalist-shadow brief cards with
// per-card platform tabs, copy buttons, and evidence chips citing the real ads
// that justify each angle; the integrity-check strip holds the tool to its own
// duplication test; footer credits the public data sources.
export default function BriefsSection({
  innerRef,
  briefs,
  marketAdById,
  clustering,
  briefClustering,
  onExportCSV,
  onExportJSON,
  copyBriefText,
}: {
  innerRef: Ref<HTMLElement>;
  briefs: AngleBrief[];
  marketAdById: Map<string, Ad>;
  clustering: ConceptClustering | null;
  briefClustering: ConceptClustering | null;
  onExportCSV: () => void;
  onExportJSON: () => void;
  copyBriefText: (brief: AngleBrief) => string;
}) {
  const [platformSel, setPlatformSel] = useState<Record<number, Platform>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function copy(text: string, key: string) {
    void navigator.clipboard.writeText(text);
    setCopiedKey(key);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopiedKey(null), 1400);
  }

  const sorted = [...briefs].sort((a, b) => a.priority - b.priority);

  return (
    <Section
      num="Nº4"
      id="step-briefs"
      innerRef={innerRef}
      title={`NEXT ANGLES TO RUN — ${briefs.length} PRIORITIZED BRIEFS`}
      meta="every brief cites the live ad that proves it · CSV for bulk sheets · JSON for the production pipeline"
      action={
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button onClick={onExportCSV} className="btn-outline" style={outlineBtn(false)}>
            Export CSV
          </button>
          <button onClick={onExportJSON} className="btn-outline" style={outlineBtn(false)}>
            Production JSON
          </button>
        </div>
      }
      padding="30px 32px 70px"
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 18 }}>
        {sorted.map((b, i) => {
          const selP: Platform = platformSel[i] ?? "meta";
          const evidence = b.evidenceAdIds
            .map((id) => marketAdById.get(id))
            .filter((ad): ad is Ad => !!ad)
            .slice(0, 2);
          return (
            <div
              key={i}
              className="brief-card"
              style={{
                border: `1px solid ${C.border}`,
                background: C.card,
                borderRadius: 9,
                padding: "17px 19px",
                boxShadow: `3px 3px 0 ${C.border3}`,
                display: "flex",
                flexDirection: "column",
                gap: 9,
                transition: "box-shadow 0.15s ease, transform 0.15s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span style={{ color: C.paper, background: b.priority <= 3 ? C.accent : C.body, ...font(700, 11, MONO), borderRadius: 3, padding: "2px 8px" }}>
                  P{b.priority}
                </span>
                <span style={{ color: C.ink, ...font(600, 16, SERIF) }}>{b.angleName}</span>
                <button
                  onClick={() => copy(copyBriefText(b), `b${i}`)}
                  className="hover-border-accent"
                  style={{
                    marginLeft: "auto",
                    background: "none",
                    border: `1px solid ${C.border3}`,
                    color: copiedKey === `b${i}` ? C.green : C.faint,
                    borderRadius: 5,
                    padding: "3px 10px",
                    ...font(600, 10, MONO),
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {copiedKey === `b${i}` ? "COPIED ✓" : "COPY BRIEF"}
                </button>
              </div>
              <p style={{ color: C.muted, ...font(400, 12, SANS, { lh: 1.5 }), margin: 0 }}>{b.whyNow}</p>
              <p style={{ color: C.ink2, ...font(400, 14, SERIF, { lh: 1.5, italic: true }), margin: 0 }}>&ldquo;{b.hookLine}&rdquo;</p>
              <div style={{ display: "flex", gap: 4, borderTop: `1px solid ${C.border4}`, paddingTop: 9 }}>
                {PLATFORMS.map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setPlatformSel((s) => ({ ...s, [i]: k }))}
                    className="hover-accent"
                    style={{
                      background: selP === k ? "rgba(28,25,23,0.07)" : "transparent",
                      border: "none",
                      color: selP === k ? C.ink : C.faint,
                      borderRadius: 5,
                      padding: "4px 12px",
                      ...font(selP === k ? 600 : 400, 11, SANS),
                      cursor: "pointer",
                    }}
                  >
                    {label}
                  </button>
                ))}
                <button
                  onClick={() => copy(b.variants[selP], `v${i}`)}
                  className="hover-accent"
                  style={{
                    marginLeft: "auto",
                    background: "none",
                    border: "none",
                    color: copiedKey === `v${i}` ? C.green : C.faint,
                    ...font(600, 10, MONO),
                    cursor: "pointer",
                  }}
                >
                  {copiedKey === `v${i}` ? "COPIED ✓" : "COPY ⧉"}
                </button>
              </div>
              <p style={{ color: "#333", ...font(400, 12, SANS, { lh: 1.55 }), margin: 0, background: "rgba(28,25,23,0.03)", borderRadius: 6, padding: "9px 12px" }}>
                {b.variants[selP]}
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ color: C.faint, ...font(500, 9, MONO, { ls: "0.1em" }) }}>EVIDENCE</span>
                {evidence.map((ad) => (
                  <EvidenceChip key={ad.id} ad={ad} />
                ))}
                <span style={{ marginLeft: "auto", color: C.faint, ...font(400, 10, SANS) }}>
                  {b.formatRecommendation} · {b.targetPersona}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* integrity check strip */}
      {briefClustering && (
        <div
          style={{
            marginTop: 22,
            border: `1px solid ${C.greenBorder}`,
            background: C.greenBg,
            borderRadius: 9,
            padding: "14px 20px",
            display: "flex",
            alignItems: "baseline",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <span style={{ color: C.green, ...font(700, 13, MONO) }}>INTEGRITY CHECK</span>
          <span style={{ color: C.ink, ...font(600, 14, SANS) }}>
            {briefClustering.nAds} briefs → {briefClustering.kConcepts} distinct concepts by our own scorer.
          </span>
          {clustering && (
            <span style={{ color: C.muted, ...font(400, 13, SANS) }}>
              Your current set: {clustering.nAds} ads → {clustering.kConcepts}. We hold ourselves to the same test.
            </span>
          )}
        </div>
      )}

      {/* footer */}
      <div style={{ marginTop: 40, borderTop: `1px solid ${C.border}`, paddingTop: 16, display: "flex", gap: 18, flexWrap: "wrap" }}>
        <span style={{ color: C.faint, ...font(400, 11, MONO) }}>ANGLER · longevity is the honest proxy for ROI</span>
        <span style={{ color: C.faint, ...font(400, 11, MONO) }}>sources: Meta Ad Library · TikTok Creative Center</span>
        <span style={{ marginLeft: "auto", color: C.faint, ...font(400, 11, MONO) }}>
          no login · no ad-account connection · public data only
        </span>
      </div>
    </Section>
  );
}

// Evidence chip: real creative thumbnail when the ad has one, hashed-color
// initial avatar otherwise.
function EvidenceChip({ ad }: { ad: Ad }) {
  const [imgError, setImgError] = useState(false);
  const showImg = !!ad.coverUrl && !imgError;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, border: `1px solid ${C.border3}`, background: "#FFF", borderRadius: 999, padding: "2px 9px 2px 3px" }}>
      {showImg ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={ad.coverUrl} alt="" onError={() => setImgError(true)} style={{ width: 16, height: 16, objectFit: "cover", borderRadius: "50%" }} />
      ) : (
        <span
          style={{
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: avatarBg(ad.advertiser),
            color: "#fff",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            ...font(700, 8, SANS),
          }}
        >
          {ad.advertiser.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span style={{ color: C.body, ...font(500, 10, SANS) }}>
        {ad.advertiser.length > 16 ? `${ad.advertiser.slice(0, 15)}…` : ad.advertiser}
      </span>
      <span style={{ color: C.green, ...font(600, 10, MONO) }}>{ad.runDays}d</span>
    </span>
  );
}
