"use client";

import { C, SERIF, SANS, MONO, font, primaryBtn, paperInput } from "./theme";

export interface LogLine {
  text: string;
  tone: "past" | "current" | "done" | "error";
}

export interface VerticalChip {
  label: string;
  value: string;
  active: boolean;
}

const LOG_COLORS: Record<LogLine["tone"], string> = {
  past: C.faint2,
  current: C.ink,
  done: C.green,
  error: C.amber,
};

// Hero / landing: eyebrow, serif headline, vertical input + CTA, quick chips,
// a collage of simulated competitor ad cards, and the "sonar" status band that
// prints real pipeline progress while a run is in flight.
export default function Hero({
  vertical,
  onVerticalChange,
  onCast,
  chips,
  onChipSelect,
  loading,
  log,
  unavailable,
}: {
  vertical: string;
  onVerticalChange: (v: string) => void;
  onCast: () => void;
  chips: VerticalChip[];
  onChipSelect: (value: string) => void;
  loading: boolean;
  log: LogLine[];
  unavailable: string | null;
}) {
  const showBand = log.length > 0;
  const done = !loading && log.some((l) => l.tone === "done");
  return (
    <section
      style={{
        background:
          "radial-gradient(ellipse 55% 46% at 16% 0%, rgba(151,163,214,0.3), transparent), radial-gradient(ellipse 48% 38% at 80% 2%, rgba(219,166,138,0.22), transparent), linear-gradient(180deg, #EFECE3 0%, #F7F5F0 78%)",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "58px 32px 44px",
          display: "grid",
          gridTemplateColumns: "1fr 360px",
          gap: 48,
          alignItems: "center",
        }}
      >
        <div>
          <div style={{ color: C.accent, ...font(500, 11, MONO, { ls: "0.15em" }), marginBottom: 16, animation: "rise 0.6s ease both" }}>
            CREATIVE STRATEGY, FROM EVIDENCE. NOT VIBES.
          </div>
          <h1
            style={{
              color: C.ink,
              ...font(600, 52, SERIF, { lh: 1.08, ls: "-0.014em" }),
              margin: "0 0 14px",
              animation: "rise 0.6s ease 0.08s both",
            }}
          >
            <span style={{ display: "block" }}>Which ads should you</span>
            <span style={{ display: "block" }}>
              make <span style={{ fontStyle: "italic", color: C.accent }}>at all?</span>
            </span>
          </h1>
          <p style={{ color: C.muted, ...font(400, 15, SANS, { lh: 1.65 }), margin: "0 0 26px", maxWidth: 490, animation: "rise 0.6s ease 0.16s both" }}>
            The market already ran your creative test. Angler reads the longest-running competitor ads in your vertical,
            audits your own set for hidden duplicates, and writes the angles you&apos;re missing.
          </p>
          <div style={{ display: "flex", gap: 10, maxWidth: 550, animation: "rise 0.6s ease 0.24s both" }}>
            <input
              value={vertical}
              onChange={(e) => onVerticalChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !loading && vertical.trim() && onCast()}
              placeholder="e.g. weight-loss supplement, debt relief, ED telehealth…"
              className="input-paper"
              style={{ ...paperInput, flex: 1 }}
            />
            <button
              onClick={onCast}
              disabled={loading || !vertical.trim()}
              className="btn-primary"
              style={primaryBtn(loading || !vertical.trim())}
            >
              Cast the line →
            </button>
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 13, flexWrap: "wrap", animation: "rise 0.6s ease 0.3s both" }}>
            {chips.map((chip) => (
              <button
                key={chip.value}
                onClick={() => onChipSelect(chip.value)}
                className="hover-accent"
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  color: chip.active ? C.ink : C.muted,
                  ...font(chip.active ? 500 : 400, 12, SANS),
                  textDecoration: chip.active ? "underline" : "none",
                  textUnderlineOffset: 3,
                  textDecorationColor: C.accent,
                }}
              >
                {chip.label}
              </button>
            ))}
            <span style={{ color: C.faint, ...font(400, 12, SANS) }}>· 4 seeded, live pull for anything else</span>
          </div>
        </div>

        <CardWall />
      </div>

      {/* sonar loading band */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 32px 34px" }}>
        {showBand && (
          <div
            style={{
              border: `1px solid ${C.border}`,
              background: "rgba(255,254,250,0.85)",
              borderRadius: 10,
              padding: "13px 18px",
              display: "flex",
              alignItems: "flex-start",
              gap: 15,
              maxWidth: 760,
              animation: "rise 0.4s ease both",
            }}
          >
            <div style={{ position: "relative", width: 26, height: 26, flexShrink: 0, marginTop: 1 }}>
              {loading && (
                <>
                  <div style={{ position: "absolute", inset: 0, border: `1.5px solid ${C.accent}`, borderRadius: "50%", animation: "ripple 1.6s ease-out infinite" }} />
                  <div style={{ position: "absolute", inset: 0, border: `1.5px solid ${C.accent}`, borderRadius: "50%", animation: "ripple 1.6s ease-out 0.55s infinite" }} />
                </>
              )}
              {done && <div style={{ position: "absolute", inset: 3, border: `1.5px solid ${C.green}`, borderRadius: "50%", opacity: 0.5 }} />}
              <div style={{ position: "absolute", inset: 10, background: done ? C.green : C.accent, borderRadius: "50%" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1 }}>
              {log.map((line, i) => (
                <div key={i} style={{ color: LOG_COLORS[line.tone], ...font(400, 12, MONO, { lh: 1.5 }), animation: "fadein 0.3s ease both" }}>
                  {line.tone === "done" ? "✓" : line.tone === "error" ? "✕" : "›"} {line.text}
                </div>
              ))}
              {loading && <div style={{ color: C.accent, ...font(600, 12, MONO), animation: "blink 0.9s step-end infinite" }}>▌</div>}
            </div>
          </div>
        )}
        {unavailable && (
          <div
            style={{
              border: `1px solid ${C.amberBorder}`,
              background: C.amberBg,
              borderRadius: 10,
              padding: "12px 18px",
              maxWidth: 760,
              marginTop: 10,
            }}
          >
            <p style={{ color: C.amber, ...font(400, 13, SANS, { lh: 1.55 }), margin: 0 }}>{unavailable}</p>
          </div>
        )}
      </div>
    </section>
  );
}

// Collage of rotated, overlapping simulated in-feed ad cards. Copy is drawn from
// real seed-data ads; decorative, not fabricated metrics.
function CardWall() {
  return (
    <div style={{ position: "relative", height: 356, animation: "fadein 0.9s ease 0.2s both" }}>
      <div
        style={{
          position: "absolute",
          top: 4,
          left: 70,
          width: 216,
          background: "#FFF",
          border: `1px solid ${C.border2}`,
          borderRadius: 9,
          padding: "9px 11px",
          transform: "rotate(3deg)",
          filter: "blur(1.6px)",
          opacity: 0.62,
          boxShadow: "0 8px 20px rgba(28,25,23,0.08)",
        }}
      >
        <div style={{ color: "#111", ...font(600, 11, SANS), marginBottom: 4 }}>
          hims <span style={{ color: C.faint2, fontWeight: 400 }}>· Sponsored · 77d</span>
        </div>
        <div style={{ color: "#333", ...font(400, 11, SANS, { lh: 1.4 }) }}>Get Wegovy® with Hims, plus provider-led care…</div>
      </div>
      <div style={{ position: "absolute", top: 44, left: 4, width: 226, transform: "rotate(-3.5deg)" }}>
        <div
          style={{
            background: "#FFF",
            border: `1px solid ${C.border2}`,
            borderRadius: 9,
            padding: "10px 12px",
            boxShadow: "0 10px 26px rgba(28,25,23,0.1)",
            animation: "drift 7s ease-in-out infinite",
          }}
        >
          <div style={{ display: "flex", gap: 7, alignItems: "center", marginBottom: 5 }}>
            <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#7C6455", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", ...font(700, 10, SANS) }}>
              P
            </div>
            <div style={{ color: "#111", ...font(600, 11, SANS) }}>
              Primal Queen <span style={{ color: C.faint2, fontWeight: 400 }}>· 94d</span>
            </div>
          </div>
          <div style={{ color: "#333", ...font(400, 11, SANS, { lh: 1.4 }) }}>
            &ldquo;The female-focused beef organ superfoods made a huge difference…&rdquo;
          </div>
          <div style={{ borderRadius: 5, marginTop: 7, background: "linear-gradient(150deg, #6B4A3A, #8C5E3C)", padding: "10px 11px" }}>
            <div style={{ color: "#F5C97B", ...font(600, 10, MONO, { ls: "0.06em" }), marginBottom: 3 }}>★★★★★ 1,200+ WOMEN</div>
            <div style={{ color: "#FFF7EA", ...font(600, 13, SERIF, { lh: 1.25 }) }}>Organs are the original multivitamin.</div>
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", top: 158, left: 96, width: 240, transform: "rotate(2.2deg)", zIndex: 2 }}>
        <div
          style={{
            background: "#FFF",
            border: `1px solid ${C.border2}`,
            borderRadius: 9,
            padding: "10px 12px",
            boxShadow: "0 12px 30px rgba(28,25,23,0.14)",
            animation: "drift2 8s ease-in-out infinite",
          }}
        >
          <div style={{ display: "flex", gap: 7, alignItems: "center", marginBottom: 5 }}>
            <div style={{ width: 22, height: 22, borderRadius: "50%", background: C.green, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", ...font(700, 10, SANS) }}>
              G
            </div>
            <div style={{ color: "#111", ...font(600, 11, SANS) }}>
              Grow Young Fitness <span style={{ color: C.green, fontWeight: 600 }}>· 418d</span>
            </div>
          </div>
          <div style={{ color: "#333", ...font(400, 11, SANS, { lh: 1.4 }) }}>Gas, Bloating, and 💩 Issues?</div>
          <div style={{ borderRadius: 5, marginTop: 7, background: "linear-gradient(150deg, #2E4A3C, #1F6F54)", padding: "10px 11px" }}>
            <div style={{ color: "#C8E8D8", ...font(600, 9, MONO, { ls: "0.08em" }), marginBottom: 3 }}>GUT-HEALTH DOCTOR EXPLAINS</div>
            <div style={{ color: "#FFFFFF", ...font(600, 13, SERIF, { lh: 1.25 }) }}>3 &ldquo;healthy&rdquo; foods that wreck your gut →</div>
          </div>
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          top: 276,
          left: 26,
          width: 224,
          background: "#FFF",
          border: `1px solid ${C.border2}`,
          borderRadius: 9,
          padding: "9px 11px",
          transform: "rotate(-2deg)",
          boxShadow: "0 8px 22px rgba(28,25,23,0.1)",
        }}
      >
        <div style={{ color: "#111", ...font(600, 11, SANS), marginBottom: 4 }}>
          Wellmedr <span style={{ color: C.faint2, fontWeight: 400 }}>· 63d</span>
        </div>
        <div style={{ color: "#333", ...font(400, 11, SANS, { lh: 1.4 }), marginBottom: 7 }}>
          GLP-1 for $88/mo? YES PLEASE 🙏🔥 No bait-and-switch…
        </div>
        <div style={{ borderRadius: 5, background: "linear-gradient(150deg, #3E5C76, #2C4257)", padding: "8px 11px", display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ color: "#FFFFFF", ...font(700, 16, SANS) }}>$88/mo</span>
          <span style={{ color: "#9FB8CC", ...font(500, 11, SANS), textDecoration: "line-through" }}>$249</span>
          <span style={{ color: "#9FB8CC", ...font(400, 9, MONO), marginLeft: "auto" }}>NO MEMBERSHIP</span>
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          top: 126,
          left: 268,
          width: 100,
          background: "#FFF",
          border: `1px solid ${C.border2}`,
          borderRadius: 9,
          padding: "8px 9px",
          transform: "rotate(5deg)",
          filter: "blur(1px)",
          opacity: 0.68,
          boxShadow: "0 6px 16px rgba(28,25,23,0.08)",
        }}
      >
        <div style={{ color: "#111", ...font(600, 10, SANS) }}>Factor_</div>
        <div style={{ color: "#555", ...font(400, 9, SANS) }}>Sponsored · 128d</div>
      </div>
    </div>
  );
}
