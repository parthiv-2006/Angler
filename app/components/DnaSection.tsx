"use client";

import type { Ref } from "react";
import type { Ad, CreativeDNA } from "@/lib/types";
import Section from "./Section";
import { C, SANS, MONO, font, pillChip } from "./theme";

export type DnaFilter = { angle: string | null; format: string | null; hookType: string | null };

const DIMS: [keyof DnaFilter, string][] = [
  ["angle", "ANGLE"],
  ["format", "FORMAT"],
  ["hookType", "HOOK"],
];

// Nº2 — Creative DNA: three rows of toggle-pill filters (AND across dimensions)
// over a 3-column grid of per-ad DNA cards. The fourth (blue) tag shows the
// ad's offer framing — the schema's nearest analogue to the design's "emotion".
export default function DnaSection({
  innerRef,
  marketDna,
  adById,
  filter,
  onToggle,
  onClear,
}: {
  innerRef: Ref<HTMLElement>;
  marketDna: { adId: string; dna: CreativeDNA }[];
  adById: Map<string, Ad>;
  filter: DnaFilter;
  onToggle: (dim: keyof DnaFilter, value: string) => void;
  onClear: () => void;
}) {
  const filtered = marketDna.filter(
    (r) =>
      (!filter.angle || r.dna.angle === filter.angle) &&
      (!filter.format || r.dna.format === filter.format) &&
      (!filter.hookType || r.dna.hookType === filter.hookType),
  );
  const filterActive = !!(filter.angle || filter.format || filter.hookType);

  return (
    <Section
      num="Nº2"
      id="step-dna"
      innerRef={innerRef}
      title="CREATIVE DNA — WHY THE WINNERS WIN"
      meta="every ad deconstructed: hook · angle · format · offer framing"
      action={
        <span style={{ marginLeft: "auto", color: C.muted, ...font(400, 12, SANS) }}>
          showing {filtered.length} of {marketDna.length}
          {filterActive && (
            <button
              onClick={onClear}
              className="hover-underline"
              style={{ background: "none", border: "none", cursor: "pointer", color: C.accent, ...font(600, 12, SANS), padding: "0 0 0 8px" }}
            >
              clear ×
            </button>
          )}
        </span>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 7, padding: "16px 0 14px" }}>
        {DIMS.map(([dim, label]) => (
          <div key={dim} style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
            <span style={{ color: C.faint, ...font(500, 10, MONO, { ls: "0.1em" }), minWidth: 74 }}>{label}</span>
            {[...new Set(marketDna.map((r) => r.dna[dim]))].map((v) => (
              <button key={v} onClick={() => onToggle(dim, v)} className="hover-border-accent" style={pillChip(filter[dim] === v)}>
                {v}
              </button>
            ))}
          </div>
        ))}
      </div>
      {filtered.length === 0 ? (
        <p style={{ color: C.muted, ...font(400, 13, SANS), margin: 0 }}>No ads match this filter combination.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {filtered.map((r) => {
            const ad = adById.get(r.adId);
            const days = ad?.runDays ?? 0;
            return (
              <div
                key={r.adId}
                className="dna-card"
                style={{
                  border: `1px solid ${C.border2}`,
                  background: C.card,
                  borderRadius: 8,
                  padding: "12px 14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ color: C.ink, ...font(600, 12, SANS), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {ad?.advertiser ?? "—"}
                  </span>
                  <span style={{ marginLeft: "auto", color: days >= 150 ? C.green : C.faint, ...font(600, 11, MONO) }}>
                    {ad ? `${days}d` : ""}
                  </span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  <Tag color={C.accent} bg="rgba(194,65,12,0.07)">{r.dna.angle}</Tag>
                  <Tag color={C.body} bg="rgba(28,25,23,0.05)">{r.dna.format}</Tag>
                  <Tag color={C.body} bg="rgba(28,25,23,0.05)">{r.dna.hookType}</Tag>
                  <Tag color={C.blue} bg="rgba(62,92,118,0.08)">{r.dna.offerFraming}</Tag>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}

function Tag({ color, bg, children }: { color: string; bg: string; children: React.ReactNode }) {
  return (
    <span style={{ color, background: bg, ...font(500, 10, MONO), borderRadius: 4, padding: "2px 7px" }}>{children}</span>
  );
}
