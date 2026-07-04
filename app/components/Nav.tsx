"use client";

import { C, SERIF, SANS, MONO, font } from "./theme";

export interface NavSection {
  label: string;
  enabled: boolean;
  active: boolean;
  onClick: () => void;
}

// Sticky header with the "reel-in" scroll-progress bar: a fishhook icon rides
// the leading edge of the fill, themed to the Angler name.
export default function Nav({
  sections,
  progress,
  onDemo,
  demoDisabled,
}: {
  sections: NavSection[];
  progress: number;
  onDemo: () => void;
  demoDisabled: boolean;
}) {
  const pct = `${Math.round(progress * 100)}%`;
  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(247,245,240,0.92)",
        backdropFilter: "blur(8px)",
        borderBottom: `1px solid ${C.border}`,
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", gap: 14, padding: "13px 32px" }}>
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M12 2v11a5 5 0 0 1-10 0v-1" stroke={C.accent} strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="12" cy="2.6" r="1.8" fill={C.accent} />
        </svg>
        <span style={{ color: C.ink, ...font(600, 17, SERIF, { ls: "0.01em" }) }}>Angler</span>
        <div style={{ display: "flex", gap: 4, marginLeft: 18 }}>
          {sections.map((s) => (
            <button
              key={s.label}
              onClick={s.onClick}
              disabled={!s.enabled}
              className={s.enabled ? "hover-accent" : undefined}
              style={{
                background: "none",
                border: "none",
                cursor: s.enabled ? "pointer" : "default",
                padding: "4px 10px",
                color: !s.enabled ? C.disabled : s.active ? C.accent : C.body,
                ...font(s.active ? 600 : 500, 12, SANS),
                borderBottom: `2px solid ${s.active ? C.accent : "transparent"}`,
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
        <span style={{ marginLeft: "auto", color: C.faint, ...font(400, 10, MONO, { ls: "0.08em" }) }}>
          REAL AD-LIBRARY EVIDENCE · NO LOGIN
        </span>
        <button
          onClick={onDemo}
          disabled={demoDisabled}
          className="btn-dark"
          style={{
            background: C.ink,
            color: C.paper,
            border: "none",
            borderRadius: 6,
            padding: "8px 16px",
            ...font(600, 12, SANS),
            cursor: demoDisabled ? "not-allowed" : "pointer",
            opacity: demoDisabled ? 0.7 : 1,
          }}
        >
          ▶ 15-second demo
        </button>
      </div>
      <div style={{ position: "relative", height: 3, background: "rgba(28,25,23,0.07)" }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: pct, background: C.accent, transition: "width 0.15s linear" }} />
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
          style={{ position: "absolute", left: `calc(${pct} - 6px)`, top: -5, transform: "rotate(90deg)", transition: "left 0.15s linear" }}
        >
          <path d="M12 2v11a5 5 0 0 1-10 0v-1" stroke={C.accent} strokeWidth="3" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}
