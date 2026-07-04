import type { CSSProperties } from "react";

// Design tokens for the "Angler" paper theme.

export const SERIF = "var(--font-serif), 'Source Serif 4', Georgia, serif";
export const SANS = "var(--font-sans), 'IBM Plex Sans', sans-serif";
export const MONO = "var(--font-mono), 'IBM Plex Mono', monospace";

export const C = {
  paper: "#F7F5F0",
  paper2: "#EFECE3",
  card: "#FFFEFA",
  ink: "#1C1917",
  ink2: "#443F35",
  body: "#55503F",
  muted: "#6B655A",
  faint: "#938D80",
  faint2: "#8A8578",
  accent: "#C2410C",
  accentHover: "#A33509",
  accentShadow: "#8C2E08",
  accentTint: "rgba(194,65,12,0.07)",
  green: "#1F6F54",
  greenBg: "#F0F6F1",
  greenBorder: "#CFE0D5",
  amber: "#B45309",
  amberFill: "#FBBF24",
  amberBg: "#FBF4E4",
  amberBorder: "#E5C08F",
  blue: "#3E5C76",
  border: "#DED8CA",
  border2: "#E2DDD2",
  border3: "#E5E0D5",
  border4: "#EEE9DD",
  disabled: "#C9C2B2",
} as const;

export function font(
  weight: number,
  sizePx: number,
  family: string,
  opts: { lh?: number | string; italic?: boolean; ls?: string } = {},
): CSSProperties {
  return {
    fontFamily: family,
    fontWeight: weight,
    fontSize: sizePx,
    ...(opts.lh !== undefined ? { lineHeight: opts.lh } : {}),
    ...(opts.italic ? { fontStyle: "italic" } : {}),
    ...(opts.ls ? { letterSpacing: opts.ls } : {}),
  };
}

// Advertiser-avatar palette, hashed per name (stable across renders).
const AVATAR_PALETTE = ["#1F6F54", "#C2410C", "#7C6455", "#3E5C76", "#8C5E3C", "#5B5E4A", "#6E4A6B"];

export function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function avatarBg(name: string): string {
  return AVATAR_PALETTE[hashStr(name) % AVATAR_PALETTE.length];
}

export function firstLine(s: string, n: number): string {
  const t = (s || "").split("\n")[0];
  return t.length > n ? t.slice(0, n).trimEnd() + "…" : t;
}

// Simulated in-feed creative panel backgrounds, hashed per ad id.
export const CREATIVE_BGS = [
  "linear-gradient(150deg, #2E4A3C, #1F6F54)",
  "linear-gradient(150deg, #6B4A3A, #8C5E3C)",
  "linear-gradient(150deg, #3E5C76, #2C4257)",
  "linear-gradient(150deg, #5C3A56, #6E4A6B)",
  "linear-gradient(150deg, #4A4633, #5B5E4A)",
];

export const KICKERS: Record<string, string> = {
  testimonial: "REAL CUSTOMER STORY",
  ugc_review: "POSTED 2 DAYS AGO",
  question: "ASK YOURSELF",
  stat: "THE NUMBERS",
  problem_agitation: "SOUND FAMILIAR?",
  curiosity: "MOST PEOPLE MISS THIS",
  offer: "LIMITED WINDOW",
  founder_story: "FROM THE FOUNDER",
};

export function kickerFor(hookType: string | undefined): string {
  if (!hookType) return "SPONSORED";
  return KICKERS[hookType] ?? hookType.replace(/_/g, " ").toUpperCase();
}

// ── Shared style fragments ──────────────────────────────────────────────

export const watermark: CSSProperties = {
  position: "absolute",
  top: 0,
  right: 28,
  color: "rgba(28,25,23,0.05)",
  ...font(600, 170, SERIF, { lh: 0.8 }),
  pointerEvents: "none",
  userSelect: "none",
};

export const headerRule: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: 12,
  borderBottom: `2px solid ${C.ink}`,
  paddingBottom: 10,
  flexWrap: "wrap",
};

export const sectionTitle: CSSProperties = {
  color: C.ink,
  ...font(600, 13, MONO, { ls: "0.12em" }),
};

export const sectionMeta: CSSProperties = {
  color: C.muted,
  ...font(400, 12, SANS),
};

export const jumpLink: CSSProperties = {
  marginLeft: "auto",
  background: "none",
  border: "none",
  cursor: "pointer",
  color: C.accent,
  ...font(600, 12, SANS),
  padding: 0,
};

export function pillChip(active: boolean): CSSProperties {
  return {
    padding: "4px 12px",
    borderRadius: 999,
    border: `1px solid ${active ? C.accent : C.border}`,
    background: active ? "rgba(194,65,12,0.08)" : C.card,
    color: active ? C.accent : C.body,
    cursor: "pointer",
    ...font(active ? 600 : 400, 12, SANS),
  };
}

export function primaryBtn(loading: boolean): CSSProperties {
  return {
    background: C.accent,
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "12px 22px",
    ...font(600, 14, SANS),
    cursor: loading ? "not-allowed" : "pointer",
    boxShadow: `0 2px 0 ${C.accentShadow}`,
    whiteSpace: "nowrap",
    opacity: loading ? 0.7 : 1,
  };
}

export function outlineBtn(loading: boolean): CSSProperties {
  return {
    background: "none",
    border: `1px solid ${C.ink}`,
    color: C.ink,
    borderRadius: 6,
    padding: "6px 14px",
    ...font(600, 12, SANS),
    cursor: loading ? "not-allowed" : "pointer",
    whiteSpace: "nowrap",
    opacity: loading ? 0.6 : 1,
  };
}

export const paperInput: CSSProperties = {
  border: "1px solid #B9B2A2",
  borderRadius: 8,
  background: C.card,
  color: C.ink,
  ...font(400, 15, SANS),
  padding: "12px 16px",
  outline: "none",
  boxShadow: "inset 0 1px 3px rgba(28,25,23,0.05)",
};
