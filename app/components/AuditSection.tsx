"use client";

import { useState, type Ref } from "react";
import type { Ad, ConceptClustering, PreflightVerdict } from "@/lib/types";
import Section from "./Section";
import { C, SERIF, SANS, MONO, font, pillChip, primaryBtn, outlineBtn, firstLine } from "./theme";

export interface SampleSummary {
  slug: string;
  label: string;
  vertical: string;
  adCount: number;
}

export interface PreflightExampleSummary {
  id: string;
  label: string;
}

export interface UploadedImage {
  id: string;
  fileName: string;
  previewUrl: string;
  base64: string;
}

// Nº3 — The Entity-ID Audit: load-your-ad-set controls (sample sets, pasted
// captions, uploaded screenshots), the marginalia N→K headline with hand-drawn
// SVG annotations, the dark "ink plate" with the count-up + merge diagram and
// budget-waste estimate, cluster cards beside the sticky gaps list, and the
// pre-flight check for a planned ad.
export default function AuditSection(props: {
  innerRef: Ref<HTMLElement>;
  loading: boolean;
  loadingStep: string;
  // controls
  samples: SampleSummary[];
  selectedSample: string | null;
  onScoreSample: (slug: string) => void;
  pasteText: string;
  onPasteText: (v: string) => void;
  onScorePaste: () => void;
  uploadedImages: UploadedImage[];
  onFilesSelected: (files: FileList | File[]) => void;
  onRemoveImage: (id: string) => void;
  onScoreUpload: () => void;
  maxImages: number;
  // results
  sampleLabel: string | null;
  userAds: Ad[];
  clustering: ConceptClustering | null;
  marksOn: boolean;
  countT: number;
  budget: string;
  onBudget: (v: string) => void;
  marketAngles: [string, number][];
  shareUrl: string | null;
  // pre-flight
  preflightExamples: PreflightExampleSummary[];
  preflight: { candidateAd: Ad | null; verdict: PreflightVerdict | null } | null;
  onPreflightSeed: (id: string) => void;
  preflightPasteText: string;
  onPreflightPasteText: (v: string) => void;
  onPreflightPaste: () => void;
  onPreflightImage: (file: File) => void;
  // generate
  onGenerate: () => void;
  hasBriefs: boolean;
}) {
  const { clustering, userAds, loading } = props;
  const dupIds = new Set<string>();
  clustering?.clusters.forEach((c) => {
    if (c.adIds.length > 1) c.adIds.forEach((id) => dupIds.add(id));
  });
  const adById = new Map(userAds.map((a) => [a.id, a] as const));

  return (
    <Section
      num="Nº3"
      id="step-score"
      innerRef={props.innerRef}
      title="THE ENTITY-ID AUDIT — YOUR SET, AS ANDROMEDA SEES IT"
      meta={
        clustering && props.sampleLabel
          ? `loaded: ${props.sampleLabel}`
          : "load a sample, paste captions, or upload screenshots"
      }
      action={props.shareUrl ? <ShareLinkButton url={props.shareUrl} /> : undefined}
      padding="30px 32px 54px"
    >
      <Controls {...props} />

      {clustering && (
        <>
          <Marginalia clustering={clustering} marksOn={props.marksOn} />
          <AdStrip userAds={userAds} dupIds={dupIds} />
          <InkPlate
            clustering={clustering}
            userAds={userAds}
            dupIds={dupIds}
            marksOn={props.marksOn}
            countT={props.countT}
            budget={props.budget}
            onBudget={props.onBudget}
          />
          <ClustersAndGaps clustering={clustering} adById={adById} userAds={userAds} marketAngles={props.marketAngles} />
          <Preflight {...props} />
          <div style={{ marginTop: 30, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <button onClick={props.onGenerate} disabled={loading} className="btn-primary" style={primaryBtn(loading)}>
              {loading && props.loadingStep.includes("angle")
                ? "Writing angle briefs…"
                : props.hasBriefs
                  ? "Regenerate the angle briefs →"
                  : "Write the missing angles →"}
            </button>
            <span style={{ color: C.muted, ...font(400, 12, SANS) }}>every brief will cite the live ad that proves it</span>
          </div>
        </>
      )}
    </Section>
  );
}

// ── Load-your-ad-set controls ───────────────────────────────────────────

function Controls(props: {
  loading: boolean;
  loadingStep: string;
  samples: SampleSummary[];
  selectedSample: string | null;
  onScoreSample: (slug: string) => void;
  pasteText: string;
  onPasteText: (v: string) => void;
  onScorePaste: () => void;
  uploadedImages: UploadedImage[];
  onFilesSelected: (files: FileList | File[]) => void;
  onRemoveImage: (id: string) => void;
  onScoreUpload: () => void;
  maxImages: number;
}) {
  const { loading } = props;
  return (
    <div
      style={{
        margin: "20px 0 24px",
        border: "1px dashed #C9C2B2",
        borderRadius: 12,
        padding: "18px 22px",
        background: "rgba(255,254,250,0.6)",
      }}
    >
      <div style={{ color: C.ink, ...font(600, 12, MONO, { ls: "0.12em" }), marginBottom: 4 }}>LOAD YOUR AD SET</div>
      <p style={{ color: C.muted, ...font(400, 12, SANS, { lh: 1.55 }), margin: "0 0 12px" }}>
        See how many concepts Meta&apos;s algorithm really sees in your ads — and which proven angles you&apos;re missing.
      </p>

      {props.samples.length > 0 ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {props.samples.map((s) => (
            <button
              key={s.slug}
              onClick={() => props.onScoreSample(s.slug)}
              disabled={loading}
              className="hover-border-accent"
              style={pillChip(props.selectedSample === s.slug)}
            >
              {s.label}
            </button>
          ))}
          <span style={{ color: C.faint, ...font(400, 12, SANS), alignSelf: "center" }}>…or bring your own ↓</span>
        </div>
      ) : (
        <p style={{ color: C.muted, ...font(400, 12, SANS), margin: "0 0 12px" }}>
          No sample ad sets available right now — paste your own captions or upload screenshots instead.
        </p>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignItems: "stretch" }}>
        {/* paste captions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <textarea
            value={props.pasteText}
            onChange={(e) => props.onPasteText(e.target.value)}
            placeholder="One ad caption per line (min 3)…"
            rows={4}
            className="input-paper"
            style={{
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              background: C.card,
              color: C.ink,
              ...font(400, 13, SANS, { lh: 1.5 }),
              padding: "10px 13px",
              outline: "none",
              resize: "vertical",
            }}
          />
          <button
            onClick={props.onScorePaste}
            disabled={loading}
            className="btn-outline"
            style={{ ...outlineBtn(loading), alignSelf: "flex-start" }}
          >
            Score pasted captions →
          </button>
        </div>

        {/* upload screenshots */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void props.onFilesSelected(e.dataTransfer.files);
            }}
            onClick={() => document.getElementById("upload-input")?.click()}
            style={{
              border: `1px dashed ${C.border}`,
              borderRadius: 8,
              padding: "16px 14px",
              textAlign: "center",
              cursor: "pointer",
              background: C.card,
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <p style={{ color: C.muted, ...font(400, 12, SANS, { lh: 1.5 }), margin: 0 }}>
              Drag &amp; drop real ad screenshots (min 3, max {props.maxImages}) — or click to browse
            </p>
            <input
              id="upload-input"
              type="file"
              accept="image/*"
              multiple
              style={{ display: "none" }}
              onChange={(e) => {
                if (e.target.files) void props.onFilesSelected(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
          {props.uploadedImages.length > 0 && (
            <>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {props.uploadedImages.map((img) => (
                  <div key={img.id} style={{ position: "relative" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.previewUrl}
                      alt={img.fileName}
                      style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 6, border: `1px solid ${C.border2}` }}
                    />
                    <button
                      onClick={() => props.onRemoveImage(img.id)}
                      aria-label={`Remove ${img.fileName}`}
                      style={{
                        position: "absolute",
                        top: -6,
                        right: -6,
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        border: "none",
                        background: C.amber,
                        color: "#fff",
                        fontSize: 11,
                        lineHeight: "18px",
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={props.onScoreUpload}
                disabled={loading || props.uploadedImages.length < 3}
                className="btn-outline"
                style={{ ...outlineBtn(loading || props.uploadedImages.length < 3), alignSelf: "flex-start" }}
              >
                Score uploaded images →
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Marginalia headline with hand-drawn annotations ─────────────────────

function Marginalia({ clustering, marksOn }: { clustering: ConceptClustering; marksOn: boolean }) {
  return (
    <p style={{ color: C.ink, ...font(600, 31, SERIF, { lh: 1.35 }), margin: "0 0 24px", maxWidth: 760 }}>
      You run{" "}
      <span style={{ position: "relative", display: "inline-block" }}>
        {clustering.nAds} ads
        {marksOn && (
          <svg width="100%" height="9" viewBox="0 0 90 8" preserveAspectRatio="none" style={{ position: "absolute", left: 0, bottom: -7, overflow: "visible" }}>
            <path
              d="M2 5 C 25 2, 55 7, 88 3"
              stroke={C.accent}
              strokeWidth="2.4"
              fill="none"
              strokeLinecap="round"
              pathLength={1}
              style={{ strokeDasharray: 1, strokeDashoffset: 1, animation: "drawline 0.5s ease 0.5s forwards" }}
            />
          </svg>
        )}
      </span>
      . Meta sees{" "}
      <span style={{ position: "relative", display: "inline-block", padding: "0 6px" }}>
        {clustering.kConcepts}
        {marksOn && (
          <svg width="54" height="54" viewBox="0 0 52 52" fill="none" style={{ position: "absolute", left: -12, top: -6, overflow: "visible" }}>
            <path
              d="M26 4 C 42 3, 50 10, 49 24 C 48 40, 38 48, 24 48 C 9 48, 2 39, 3 25 C 4 12, 13 5, 27 5"
              stroke={C.accent}
              strokeWidth="2.2"
              fill="none"
              strokeLinecap="round"
              transform="rotate(-3 26 26)"
              pathLength={1}
              style={{ strokeDasharray: 1, strokeDashoffset: 1, animation: "drawline 0.7s ease 0.9s forwards" }}
            />
          </svg>
        )}
      </span>{" "}
      concepts. <span style={{ color: C.muted, fontWeight: 400, fontStyle: "italic" }}>One ad buys you nothing.</span>
    </p>
  );
}

// ── User ad-set strip ───────────────────────────────────────────────────

function AdStrip({ userAds, dupIds }: { userAds: Ad[]; dupIds: Set<string> }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
      {userAds.map((ad, i) => {
        const dup = dupIds.has(ad.id);
        const isImage = !ad.copy && !!ad.coverUrl;
        return (
          <div
            key={ad.id}
            style={{
              flex: "1 1 220px",
              maxWidth: 280,
              border: `1px solid ${dup ? C.amberBorder : C.border2}`,
              background: dup ? C.amberBg : C.card,
              borderRadius: 7,
              padding: "9px 11px",
            }}
          >
            <div style={{ display: "flex", gap: 6, alignItems: "baseline", marginBottom: 3 }}>
              <span style={{ color: C.faint, ...font(500, 9, MONO) }}>AD {String(i + 1).padStart(2, "0")}</span>
              {dup && <span style={{ color: C.amber, ...font(600, 9, MONO), marginLeft: "auto" }}>⚠ COLLAPSES</span>}
            </div>
            {isImage ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={ad.coverUrl} alt="" style={{ width: "100%", maxHeight: 96, objectFit: "cover", borderRadius: 5, display: "block" }} />
            ) : (
              <div
                style={{
                  color: C.ink2,
                  ...font(400, 11, SANS, { lh: 1.45 }),
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {firstLine(ad.copy, 120)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Ink plate: N-in → K-out count-up, waste pill, budget input, merge diagram ─

function InkPlate({
  clustering,
  userAds,
  dupIds,
  marksOn,
  countT,
  budget,
  onBudget,
}: {
  clustering: ConceptClustering;
  userAds: Ad[];
  dupIds: Set<string>;
  marksOn: boolean;
  countT: number;
  budget: string;
  onBudget: (v: string) => void;
}) {
  const redundant = clustering.nAds - clustering.kConcepts;
  const wastePct = clustering.nAds > 0 ? Math.round((redundant / clustering.nAds) * 100) : 0;
  const budgetNum = parseFloat(budget);
  const waste = !isNaN(budgetNum) && budgetNum > 0 ? Math.round((budgetNum * wastePct) / 100) : null;
  const collapsedCluster = clustering.clusters.find((c) => c.adIds.length > 1);

  return (
    <div
      style={{
        background: "linear-gradient(155deg, #232038 0%, #2B2647 55%, #221F36 100%)",
        border: "1px solid #3B3560",
        borderRadius: 16,
        padding: "30px 34px",
        boxShadow: "0 18px 44px rgba(35,32,56,0.26)",
        display: "grid",
        gridTemplateColumns: "1fr 350px",
        gap: 36,
        alignItems: "center",
      }}
    >
      <div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 13, flexWrap: "wrap" }}>
          <span style={{ color: "#F2F0FA", ...font(600, 72, SERIF, { lh: 1 }) }}>{Math.round(clustering.nAds * countT)}</span>
          <span style={{ color: "#8B86A8", ...font(400, 19, SERIF, { italic: true }) }}>ads in</span>
          <span
            style={{
              background: "linear-gradient(120deg, #A99AFF, #D3C6FF)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              ...font(600, 72, SERIF, { lh: 1 }),
            }}
          >
            {Math.round(clustering.kConcepts * countT)}
          </span>
          <span style={{ color: "#8B86A8", ...font(400, 19, SERIF, { italic: true }) }}>concepts out</span>
          <span
            style={{
              marginLeft: "auto",
              color: C.amberFill,
              border: "1px solid rgba(251,191,36,0.4)",
              background: "rgba(251,191,36,0.08)",
              ...font(600, 11, MONO),
              borderRadius: 999,
              padding: "4px 12px",
            }}
          >
            {redundant} WASTED {redundant === 1 ? "ENTRY" : "ENTRIES"} · {wastePct}%
          </span>
        </div>
        <p style={{ color: "#A5A1BC", ...font(400, 13, SANS, { lh: 1.65 }), margin: "15px 0 0", maxWidth: 460 }}>
          {collapsedCluster
            ? `Your ${collapsedCluster.adIds.length} ads on "${collapsedCluster.concept}" share one Entity ID — Meta enters them in the auction as a single creative. The extra ${collapsedCluster.adIds.length - 1 === 1 ? "one is a wasted entry" : "ones are wasted entries"} every day they run.`
            : "Every ad earns its own Entity ID — no wasted auction entries in this set."}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 16, flexWrap: "wrap" }}>
          <span style={{ color: "#8B86A8", ...font(400, 11, MONO) }}>MONTHLY TEST BUDGET $</span>
          <input
            value={budget}
            onChange={(e) => onBudget(e.target.value)}
            placeholder="10000"
            inputMode="numeric"
            className="input-plate"
            style={{
              width: 92,
              border: "1px solid #4B4478",
              borderRadius: 6,
              background: "rgba(255,255,255,0.05)",
              color: "#F2F0FA",
              ...font(500, 13, MONO),
              padding: "6px 10px",
              outline: "none",
            }}
          />
          {waste !== null && waste > 0 && (
            <span style={{ color: C.amberFill, ...font(600, 13, MONO) }}>
              ≈ ${waste.toLocaleString()}/mo babysits a duplicate
            </span>
          )}
        </div>
      </div>
      <div style={{ width: 350, height: 184 }}>{marksOn && <MergeDiagram clustering={clustering} userAds={userAds} dupIds={dupIds} />}</div>
    </div>
  );
}

// SVG merge diagram: a dot per user ad on the left, bezier lines converging
// into one slot per concept on the right; amber = part of a duplicate cluster.
function MergeDiagram({ clustering, userAds, dupIds }: { clustering: ConceptClustering; userAds: Ad[]; dupIds: Set<string> }) {
  const H = 184;
  const shownAds = userAds.slice(0, 12);
  const n = shownAds.length;
  const k = Math.max(clustering.clusters.length, 1);
  const rowY = shownAds.map((_, i) => (n === 1 ? H / 2 : 14 + i * ((H - 28) / (n - 1))));
  const slotY = Array.from({ length: k }, (_, i) => (k === 1 ? H / 2 - 6 : 10 + i * ((H - 34) / (k - 1))));

  const clusterOfAd = new Map<string, number>();
  clustering.clusters.forEach((c, ci) => c.adIds.forEach((id) => clusterOfAd.set(id, ci)));
  const links = shownAds.map((ad, i) => ({
    i,
    slot: Math.min(clusterOfAd.get(ad.id) ?? i, k - 1),
    dup: dupIds.has(ad.id),
  }));
  const dupSlots = new Set(links.filter((l) => l.dup).map((l) => l.slot));

  return (
    <svg width="350" height="184" viewBox="0 0 350 184" fill="none">
      {links.map((l, i) => {
        const y1 = rowY[i];
        const y2 = slotY[l.slot] + 6;
        return (
          <path
            key={i}
            d={`M18 ${y1} C 140 ${y1}, 200 ${y2}, 318 ${y2}`}
            stroke={l.dup ? C.amberFill : "#4B4478"}
            strokeWidth={l.dup ? 1.6 : 1.3}
            pathLength={1}
            style={{ strokeDasharray: 1, strokeDashoffset: 1, animation: `drawline 0.9s ease ${(0.15 + i * 0.09).toFixed(2)}s forwards` }}
          />
        );
      })}
      {links.map((l, i) => (
        <circle key={i} cx="18" cy={rowY[i]} r="4.5" fill={l.dup ? C.amberFill : "#8B86A8"} />
      ))}
      {slotY.map((y, i) => (
        <rect key={i} x="318" y={y} width="13" height="13" rx="3" fill={dupSlots.has(i) ? "#4A3E12" : "#332D56"} stroke={dupSlots.has(i) ? C.amberFill : "#57509A"} />
      ))}
      <text x="18" y="8" fill="#8B86A8" fontSize="8" fontFamily="var(--font-mono), monospace" letterSpacing="1">
        YOUR ADS
      </text>
      <text x="284" y="8" fill="#8B86A8" fontSize="8" fontFamily="var(--font-mono), monospace" letterSpacing="1">
        ENTITY IDS
      </text>
    </svg>
  );
}

// ── Cluster cards + sticky "angles you're not running" ─────────────────

function ClustersAndGaps({
  clustering,
  adById,
  userAds,
  marketAngles,
}: {
  clustering: ConceptClustering;
  adById: Map<string, Ad>;
  userAds: Ad[];
  marketAngles: [string, number][];
}) {
  const adLabel = (id: string) => {
    const idx = userAds.findIndex((a) => a.id === id);
    return idx >= 0 ? `AD ${String(idx + 1).padStart(2, "0")}` : id;
  };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 330px", gap: 26, marginTop: 26, alignItems: "start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        <div style={{ color: C.faint, ...font(500, 10, MONO, { ls: "0.12em" }) }}>
          HOW YOUR {clustering.nAds} ADS GROUP INTO {clustering.kConcepts} CONCEPTS
        </div>
        {clustering.clusters.length === 0 && (
          <p style={{ color: C.muted, ...font(400, 13, SANS), margin: 0 }}>No distinct concepts were detected in this ad set.</p>
        )}
        {clustering.clusters.map((c, i) => {
          const collapsed = c.adIds.length > 1;
          const imageAds = c.adIds.map((id) => adById.get(id)).filter((a): a is Ad => !!a && !a.copy && !!a.coverUrl);
          return (
            <div
              key={i}
              style={{
                border: `1px solid ${collapsed ? C.amberBorder : C.border2}`,
                background: collapsed ? C.amberBg : C.card,
                borderLeft: `3px solid ${collapsed ? C.amber : "#C9C2B2"}`,
                borderRadius: 8,
                padding: "12px 15px",
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                <span style={{ color: C.ink, ...font(600, 13, SANS) }}>{c.concept}</span>
                {collapsed && (
                  <span style={{ color: "#FFF", background: C.amber, ...font(700, 10, MONO), borderRadius: 999, padding: "2px 9px", whiteSpace: "nowrap" }}>
                    {c.adIds.length}× COLLAPSED
                  </span>
                )}
                <span style={{ marginLeft: "auto", color: C.faint, ...font(400, 11, MONO) }}>{c.adIds.map(adLabel).join(" + ")}</span>
              </div>
              <p style={{ color: C.muted, ...font(400, 12, SANS, { lh: 1.55 }), margin: "5px 0 0" }}>{c.reason}</p>
              {imageAds.length > 0 && (
                <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                  {imageAds.map((a) => (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img key={a.id} src={a.coverUrl} alt="" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 5, border: `1px solid ${C.border2}` }} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div
        style={{
          position: "sticky",
          top: 84,
          border: `1px solid ${C.border}`,
          background: C.card,
          borderRadius: 10,
          padding: "18px 20px",
          boxShadow: `3px 3px 0 ${C.border3}`,
        }}
      >
        <div style={{ color: C.accent, ...font(600, 11, MONO, { ls: "0.12em" }), marginBottom: 12 }}>
          PROVEN ANGLES YOU&apos;RE NOT RUNNING
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {clustering.gaps.length === 0 && (
            <span style={{ color: C.muted, ...font(400, 12, SANS) }}>No gaps found — this set covers the market&apos;s proven angles.</span>
          )}
          {clustering.gaps.map((g, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ color: C.accent, ...font(600, 12, MONO), flexShrink: 0, paddingTop: 1 }}>0{i + 1}</span>
              <span style={{ color: C.ink2, ...font(400, 12, SANS, { lh: 1.5 }) }}>{g}</span>
            </div>
          ))}
        </div>
        {marketAngles.length > 0 && (
          <div style={{ borderTop: `1px solid ${C.border4}`, marginTop: 14, paddingTop: 12, display: "flex", flexWrap: "wrap", gap: 5 }}>
            {marketAngles.map(([angle, count]) => (
              <span key={angle} style={{ color: C.body, border: `1px solid ${C.border3}`, ...font(500, 10, MONO), borderRadius: 999, padding: "3px 9px" }}>
                {angle} ×{count}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Pre-flight check ────────────────────────────────────────────────────

function Preflight(props: {
  loading: boolean;
  preflightExamples: PreflightExampleSummary[];
  preflight: { candidateAd: Ad | null; verdict: PreflightVerdict | null } | null;
  onPreflightSeed: (id: string) => void;
  preflightPasteText: string;
  onPreflightPasteText: (v: string) => void;
  onPreflightPaste: () => void;
  onPreflightImage: (file: File) => void;
}) {
  const verdict = props.preflight?.verdict ?? null;
  const candidate = props.preflight?.candidateAd ?? null;
  const collapses = verdict?.verdict === "collapses";

  return (
    <div style={{ marginTop: 30, border: "1px dashed #C9C2B2", borderRadius: 12, padding: "20px 24px", background: "rgba(255,254,250,0.6)" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <span style={{ color: C.ink, ...font(600, 12, MONO, { ls: "0.12em" }) }}>PRE-FLIGHT — TEST A PLANNED AD BEFORE YOU SPEND</span>
        <span style={{ color: C.muted, ...font(400, 12, SANS) }}>
          would Meta give it a new Entity ID, or fold it into something you already run?
        </span>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {props.preflightExamples.map((ex) => (
          <button
            key={ex.id}
            onClick={() => props.onPreflightSeed(ex.id)}
            disabled={props.loading}
            className="hover-border-accent"
            style={pillChip(candidate?.id === ex.id)}
          >
            {ex.label}
          </button>
        ))}
        <span style={{ color: C.faint, ...font(400, 12, SANS), alignSelf: "center" }}>…or paste your own caption</span>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: verdict ? 16 : 0 }}>
        <textarea
          value={props.preflightPasteText}
          onChange={(e) => props.onPreflightPasteText(e.target.value)}
          placeholder="Paste your planned ad caption…"
          rows={2}
          className="input-paper"
          style={{
            flex: "1 1 320px",
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            background: C.card,
            color: C.ink,
            ...font(400, 13, SANS, { lh: 1.5 }),
            padding: "9px 13px",
            outline: "none",
            resize: "vertical",
          }}
        />
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <button onClick={props.onPreflightPaste} disabled={props.loading} className="btn-outline" style={outlineBtn(props.loading)}>
            Check this ad →
          </button>
          <button
            onClick={() => document.getElementById("preflight-upload-input")?.click()}
            disabled={props.loading}
            className="btn-outline"
            style={outlineBtn(props.loading)}
          >
            …or upload a screenshot
          </button>
          <input
            id="preflight-upload-input"
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void props.onPreflightImage(file);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {verdict && (
        <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 16, alignItems: "start" }}>
          <div
            style={{
              border: `1px solid ${C.border2}`,
              background: "#FFF",
              borderRadius: 8,
              padding: "11px 13px",
              transform: "rotate(-0.8deg)",
              boxShadow: "0 6px 16px rgba(28,25,23,0.08)",
            }}
          >
            <div style={{ color: C.faint2, ...font(400, 9, MONO, { ls: "0.1em" }), marginBottom: 5 }}>PLANNED AD</div>
            {candidate?.coverUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={candidate.coverUrl} alt="" style={{ width: "100%", borderRadius: 5, display: "block" }} />
            ) : (
              <div style={{ color: "#333", ...font(400, 11, SANS, { lh: 1.5 }), whiteSpace: "pre-line" }}>
                {firstLine(candidate?.copy ?? "", 240)}
              </div>
            )}
          </div>
          <div
            style={{
              border: `1px solid ${collapses ? C.amberBorder : C.greenBorder}`,
              background: collapses ? C.amberBg : C.greenBg,
              borderRadius: 8,
              padding: "14px 18px",
            }}
          >
            <div style={{ color: collapses ? C.amber : C.green, ...font(700, 14, SANS), marginBottom: 5 }}>
              {collapses ? `⚠ Collapses into "${verdict.collidesWith}"` : "✓ Genuinely new concept — safe to produce"}
            </div>
            <p style={{ color: C.body, ...font(400, 13, SANS, { lh: 1.55 }), margin: 0 }}>{verdict.reason}</p>
            {collapses && verdict.fixes.length > 0 && (
              <>
                <div style={{ color: C.faint, ...font(500, 10, MONO, { ls: "0.1em" }), margin: "10px 0 5px" }}>TO EARN A NEW ENTITY ID</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {verdict.fixes.map((f, i) => (
                    <div key={i} style={{ display: "flex", gap: 8 }}>
                      <span style={{ color: C.accent, ...font(600, 12, MONO) }}>→</span>
                      <span style={{ color: C.ink2, ...font(400, 12, SANS, { lh: 1.5 }) }}>{f}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Share link ──────────────────────────────────────────────────────────

function ShareLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        void navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="hover-underline"
      style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: copied ? C.green : C.accent, ...font(600, 12, SANS), padding: 0 }}
    >
      {copied ? "✓ link copied" : "copy share link"}
    </button>
  );
}
