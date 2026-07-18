"use client";

import { useEffect, useRef, useState } from "react";
import type { Ad, CreativeDNA, ConceptClustering, AngleBrief, PreflightVerdict } from "@/lib/types";
import { briefToDNA } from "@/lib/ai/briefs";
import Nav from "./components/Nav";
import Hero, { type LogLine } from "./components/Hero";
import CatchSection from "./components/CatchSection";
import DnaSection, { type DnaFilter } from "./components/DnaSection";
import AuditSection, { type SampleSummary, type PreflightExampleSummary } from "./components/AuditSection";
import BriefsSection from "./components/BriefsSection";
import { C, MONO, SANS, font } from "./components/theme";

interface AppState {
  vertical: string;
  ads: Ad[];
  winnerSummary: string | null;
  fromSeed: boolean;
  unavailable: string | null;
  marketDna: { adId: string; dna: CreativeDNA }[];
  selectedAd: number;
  // Module 3: the user's own ad set
  sampleSets: SampleSummary[];
  userAds: Ad[];
  selectedSample: string | null;
  sampleLabel: string | null;
  pasteText: string;
  uploadedImages: { id: string; fileName: string; previewUrl: string; base64: string }[];
  budget: string;
  clustering: ConceptClustering | null;
  briefs: AngleBrief[];
  briefClustering: ConceptClustering | null;
  // Module 3.5: pre-flight check on a planned ad
  preflightExamples: PreflightExampleSummary[];
  preflightPasteText: string;
  preflight: { candidateAd: Ad | null; verdict: PreflightVerdict | null } | null;
  loading: boolean;
  loadingStep: string;
  error: string | null;
}

const SEED_VERTICALS = [
  { label: "weight-loss", value: "weight-loss supplement" },
  { label: "debt relief", value: "debt relief" },
  { label: "ED telehealth", value: "ed telehealth" },
  { label: "investing newsletter", value: "investing newsletter" },
];

// Date the seed verticals were last refreshed from the live ad libraries. Shown in
// the UI so cached real data is never mistaken for a live fetch.
const SEED_CACHED_DATE = "June 2026";

// Clean display names for the truthful `ad.source` provenance tag.
const SOURCE_LABELS: Record<string, string> = {
  facebook_ad_library: "Meta Ad Library",
  tiktok_creative_center: "TikTok Creative Center",
  uploaded: "Your ad",
  planned: "Planned ad",
};

function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source.replace(/_/g, " ");
}

const INITIAL: AppState = {
  vertical: "",
  ads: [],
  winnerSummary: null,
  fromSeed: false,
  unavailable: null,
  marketDna: [],
  selectedAd: 0,
  sampleSets: [],
  userAds: [],
  selectedSample: null,
  sampleLabel: null,
  pasteText: "",
  uploadedImages: [],
  budget: "",
  clustering: null,
  briefs: [],
  briefClustering: null,
  preflightExamples: [],
  preflightPasteText: "",
  preflight: null,
  loading: false,
  loadingStep: "",
  error: null,
};

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// Resolves a brief's evidenceAdIds to advertiser names for export/copy (ids not
// found in the current ad set, e.g. a stale reference, are skipped silently).
function evidenceAdvertisers(evidenceAdIds: string[], ads: Ad[]): string {
  const byId = new Map(ads.map((a) => [a.id, a] as const));
  return evidenceAdIds
    .map((id) => byId.get(id)?.advertiser)
    .filter((name): name is string => !!name)
    .join(", ");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// /api/deconstruct caps `copy` at 10k chars (security bound); some real
// library ads carry longer stories, so trim before sending or the batch 400s.
const MAX_COPY_CHARS = 10_000;
const trimCopy = (copy: string) => copy.slice(0, MAX_COPY_CHARS);

// Scrolls a section under the sticky nav (~60px tall).
function scrollToStep(id: string) {
  const el = document.getElementById(id);
  if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 70, behavior: "smooth" });
}
const jsonHeaders = { "Content-Type": "application/json" };

const MAX_UPLOAD_DIMENSION = 1024;
const MAX_UPLOADED_IMAGES = 10;

// Resizes/re-encodes an image client-side so upload payloads stay well under
// Vercel's ~4.5MB Route Handler body limit, regardless of the source file size.
function compressImage(file: File): Promise<{ base64: string; previewUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Failed to load image"));
      img.onload = () => {
        const scale = Math.min(1, MAX_UPLOAD_DIMENSION / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas not supported"));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const previewUrl = canvas.toDataURL("image/jpeg", 0.8);
        resolve({ base64: previewUrl.split(",")[1] ?? "", previewUrl });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

const NO_FILTER: DnaFilter = { angle: null, format: null, hookType: null };

export default function Home() {
  const [state, setState] = useState<AppState>(INITIAL);
  const [dnaFilter, setDnaFilter] = useState<DnaFilter>(NO_FILTER);
  const [log, setLog] = useState<LogLine[]>([]);
  const [progress, setProgress] = useState(0);
  const [activeNav, setActiveNav] = useState(-1);
  const [marksOn, setMarksOn] = useState(false);
  const [countT, setCountT] = useState(0);

  const catchRef = useRef<HTMLElement | null>(null);
  const dnaRef = useRef<HTMLElement | null>(null);
  const auditRef = useRef<HTMLElement | null>(null);
  const briefsRef = useRef<HTMLElement | null>(null);
  const auditStarted = useRef(false);

  // ── Sonar-band log ────────────────────────────────────────────────────
  function pushLog(text: string) {
    setLog((l) => [...l.map((x) => (x.tone === "current" ? { ...x, tone: "past" as const } : x)), { text, tone: "current" }]);
  }
  function doneLog(text: string) {
    setLog((l) => [...l.map((x) => (x.tone === "current" ? { ...x, tone: "past" as const } : x)), { text, tone: "done" }]);
  }

  useEffect(() => {
    fetch("/api/samples")
      .then((r) => r.json())
      .then((d) => {
        const samples: SampleSummary[] = d.samples ?? [];
        setState((s) => ({ ...s, sampleSets: samples }));

        // Replay a shared seed-report link (?v=<slug>&s=<sampleSlug>). Unknown
        // values are ignored entirely; a URL param must never trigger a live scrape.
        const params = new URLSearchParams(window.location.search);
        const vParam = params.get("v");
        if (!vParam) return;
        const seed = SEED_VERTICALS.find((sv) => slugify(sv.value) === vParam);
        if (!seed) return;
        const sParam = params.get("s");
        const validSample = sParam && samples.some((sm) => sm.slug === sParam) ? sParam : null;
        void runSeedDemo(seed.value, validSample);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Scroll spy: page progress + active section (rAF-throttled) ────────
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const doc = document.documentElement;
        const max = doc.scrollHeight - window.innerHeight;
        setProgress(max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0);
        let active = -1;
        [catchRef, dnaRef, auditRef, briefsRef].forEach((r, i) => {
          if (r.current && r.current.getBoundingClientRect().top < window.innerHeight * 0.45) active = i;
        });
        setActiveNav(active);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // ── Audit reveal: hand-drawn marks + N→K count-up, once per scoring, the
  // first time Nº3 scrolls into view (18% threshold, 9s fallback) ─────────
  const clustering = state.clustering;
  useEffect(() => {
    auditStarted.current = false;
    setMarksOn(false);
    setCountT(0);
    if (!clustering) return;

    let rafId = 0;
    const start = () => {
      if (auditStarted.current) return;
      auditStarted.current = true;
      obs.disconnect();
      clearTimeout(fallback);
      setMarksOn(true);
      const t0 = performance.now();
      const dur = 1200;
      const tick = (now: number) => {
        const x = Math.min(1, (now - t0) / dur);
        setCountT(1 - Math.pow(1 - x, 3));
        if (x < 1) rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
    };
    const obs = new IntersectionObserver((entries) => entries.forEach((e) => e.isIntersecting && start()), { threshold: 0.18 });
    if (auditRef.current) obs.observe(auditRef.current);
    const fallback = setTimeout(start, 9000);
    return () => {
      obs.disconnect();
      clearTimeout(fallback);
      cancelAnimationFrame(rafId);
    };
  }, [clustering]);

  function setLoading(step: string) {
    setState((s) => ({ ...s, loading: true, error: null, loadingStep: step }));
  }
  function setError(error: string) {
    setState((s) => ({ ...s, loading: false, loadingStep: "", error }));
    setLog((l) => (l.length && l.some((x) => x.tone === "current") ? [...l.map((x) => (x.tone === "current" ? { ...x, tone: "past" as const } : x)), { text: error, tone: "error" as const }] : l));
  }

  // ── Module 1: mine a vertical (seed or live) ──────────────────────────
  async function handleMine() {
    setLog([]);
    pushLog(`casting into ${state.vertical.trim()}…`);
    setLoading("Pulling competitor ads…");
    try {
      const res = await fetch("/api/mine", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ vertical: state.vertical }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error ?? "Something went wrong");
      const ads: Ad[] = data.ads ?? [];
      setState((s) => ({
        ...s,
        ads,
        winnerSummary: data.winnerSummary ?? null,
        fromSeed: !!data.fromSeed,
        unavailable: data.unavailable ? data.message : null,
        marketDna: [],
        selectedAd: 0,
        userAds: [],
        selectedSample: null,
        sampleLabel: null,
        clustering: null,
        briefs: [],
        briefClustering: null,
        preflightExamples: [],
        preflight: null,
        loading: false,
        loadingStep: "",
        error: null,
      }));
      setDnaFilter(NO_FILTER);
      if (ads.length) {
        const maxDays = Math.max(...ads.map((a) => a.runDays));
        pushLog(`${ads.length} ads hooked · longest runner ${maxDays} days`);
        doneLog("done. extract the DNA below to read why they win");
        setTimeout(() => scrollToStep("step-ads"), 150);
      }
    } catch {
      setError("Network error. Please try again");
    }
  }

  // ── Module 2: creative-DNA extraction ─────────────────────────────────
  // Live-mined ads can be video-only (no copy, no cover image); the server
  // rejects any batch containing an ad with nothing to analyze, so keep only
  // analyzable ads before taking the top 15.
  function analyzableAds(ads: Ad[]) {
    return ads
      .filter((ad) => ad.copy || ad.coverUrl)
      .slice(0, 15)
      .map((ad) => ({
        id: ad.id,
        coverUrl: ad.coverUrl || undefined,
        copy: ad.copy ? trimCopy(ad.copy) : undefined,
      }));
  }

  async function handleDeconstruct() {
    const ads = analyzableAds(state.ads);
    if (ads.length === 0) {
      return setError("These ads have no copy or images to analyze. Try a different vertical.");
    }
    setLoading("Extracting creative DNA…");
    try {
      const res = await fetch("/api/deconstruct", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({
          vertical: state.vertical,
          // Synthesize a summary only when we don't already have a seed one (novel verticals).
          generateSummary: state.winnerSummary === null,
          ads,
        }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error ?? "Failed to analyze creatives");
      if (!data.results || data.results.length === 0) {
        return setError("Couldn't extract creative DNA from these ads. Try again or pick a different vertical.");
      }
      setState((s) => ({
        ...s,
        marketDna: data.results,
        winnerSummary: data.winnerSummary ?? s.winnerSummary,
        clustering: null,
        briefs: [],
        briefClustering: null,
        preflightExamples: [],
        preflight: null,
        loading: false,
        loadingStep: "",
      }));
      setTimeout(() => scrollToStep("step-dna"), 150);
    } catch {
      setError("Network error. Please try again");
    }
  }

  // ── Module 3: score a pre-baked sample ad set (instant, seed path) ────
  async function handleScoreSample(slug: string) {
    setLoading("Scoring your ad set…");
    try {
      const setRes = await fetch(`/api/samples?slug=${encodeURIComponent(slug)}`);
      const sample = await setRes.json();
      if (!setRes.ok) return setError(sample.error ?? "Couldn't load sample set");

      const res = await fetch("/api/score", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({
          sampleSetId: slug,
          dna: sample.dna,
          marketDNA: state.marketDna.map((r) => r.dna),
        }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error ?? "Failed to score diversity");
      setState((s) => ({
        ...s,
        userAds: sample.ads,
        selectedSample: slug,
        sampleLabel: sample.label ?? slug,
        clustering: data.clustering,
        briefs: [],
        briefClustering: null,
        preflightExamples: sample.preflightExamples ?? [],
        preflight: null,
        loading: false,
        loadingStep: "",
      }));
    } catch {
      setError("Network error. Please try again");
    }
  }

  // ── Module 3: score pasted ad copy (live path; needs an AI key) ───────
  async function handleScorePaste() {
    const lines = state.pasteText.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length < 3) return setError("Paste at least 3 ad captions (one per line).");
    history.replaceState(null, "", location.pathname);
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
        headers: jsonHeaders,
        body: JSON.stringify({ adKind: "uploaded", ads: userAds.map((a) => ({ id: a.id, copy: trimCopy(a.copy) })) }),
      });
      const dnaData = await dnaRes.json();
      if (!dnaRes.ok) return setError(dnaData.error ?? "Failed to analyze your ads");

      const res = await fetch("/api/score", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({
          dna: dnaData.results,
          marketDNA: state.marketDna.map((r) => r.dna),
        }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error ?? "Failed to score diversity");
      setState((s) => ({
        ...s,
        userAds,
        selectedSample: null,
        sampleLabel: "your pasted captions",
        clustering: data.clustering,
        briefs: [],
        briefClustering: null,
        preflightExamples: [],
        preflight: null,
        loading: false,
        loadingStep: "",
      }));
    } catch {
      setError("Network error. Please try again");
    }
  }

  // ── Module 3: score uploaded ad images (live path; needs an AI key + vision) ─
  async function handleScoreUpload() {
    const images = state.uploadedImages;
    if (images.length < 3) return setError("Upload at least 3 ad images.");
    history.replaceState(null, "", location.pathname);
    setLoading("Analyzing your ad creative…");
    try {
      const userAds: Ad[] = images.map((img, i) => ({
        id: `upload_${i}`,
        source: "uploaded",
        advertiser: "Your Ad Set",
        coverUrl: img.previewUrl,
        copy: "",
        firstSeen: "",
        lastSeen: "",
        runDays: 0,
        rawMetrics: {},
      }));

      const dnaRes = await fetch("/api/deconstruct", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({
          adKind: "uploaded",
          ads: images.map((img, i) => ({ id: `upload_${i}`, imageBase64: img.base64 })),
        }),
      });
      const dnaData = await dnaRes.json();
      if (!dnaRes.ok) return setError(dnaData.error ?? "Failed to analyze your ads");

      const res = await fetch("/api/score", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({
          dna: dnaData.results,
          marketDNA: state.marketDna.map((r) => r.dna),
        }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error ?? "Failed to score diversity");
      setState((s) => ({
        ...s,
        userAds,
        selectedSample: null,
        sampleLabel: "your uploaded screenshots",
        clustering: data.clustering,
        briefs: [],
        briefClustering: null,
        preflightExamples: [],
        preflight: null,
        loading: false,
        loadingStep: "",
      }));
    } catch {
      setError("Network error. Please try again");
    }
  }

  // Non-blocking "dog food" self-score of a generated brief batch's own
  // diversity, fired after live-path briefs render (seed path already has
  // briefClustering baked in). Failure is silent: never block or error the demo.
  async function scoreBriefBatch(briefs: AngleBrief[]) {
    try {
      const res = await fetch("/api/score", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ dna: briefs.map(briefToDNA) }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.clustering) setState((s) => ({ ...s, briefClustering: data.clustering }));
    } catch {
      // silent: the integrity panel just doesn't render
    }
  }

  // ── Module 4: generate angle briefs ───────────────────────────────────
  async function handleGenerate() {
    if (!state.clustering) return;
    setLoading("Generating angle briefs…");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({
          vertical: state.vertical,
          winnerSummary: state.winnerSummary ?? "",
          marketDNA: state.marketDna,
          clustering: state.clustering,
        }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error ?? "Failed to generate angle briefs");
      if (!data.briefs || data.briefs.length === 0) {
        return setError("No angle briefs were generated. Please try again.");
      }
      const briefClustering: ConceptClustering | null = data.briefClustering ?? null;
      setState((s) => ({ ...s, briefs: data.briefs, briefClustering, loading: false, loadingStep: "" }));
      if (!briefClustering) void scoreBriefBatch(data.briefs);
      setTimeout(() => scrollToStep("step-briefs"), 150);
    } catch {
      setError("Network error. Please try again");
    }
  }

  // ── Module 3.5: pre-flight checks ─────────────────────────────────────
  async function handlePreflightSeed(exampleId: string) {
    if (!state.selectedSample) return;
    setLoading("Running pre-flight check…");
    try {
      const res = await fetch("/api/preflight", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ sampleSetId: state.selectedSample, candidateId: exampleId }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error ?? "Pre-flight check failed");
      setState((s) => ({
        ...s,
        preflight: { candidateAd: data.ad ?? null, verdict: data.verdict },
        loading: false,
        loadingStep: "",
      }));
    } catch {
      setError("Network error. Please try again");
    }
  }

  async function handlePreflightPaste() {
    if (!state.clustering) return;
    const copy = state.preflightPasteText.trim();
    if (!copy) return setError("Paste an ad caption to check.");
    setLoading("Analyzing your planned ad…");
    try {
      const candidateId = `preflight_${Date.now()}`;
      const dnaRes = await fetch("/api/deconstruct", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ adKind: "uploaded", ads: [{ id: candidateId, copy: trimCopy(copy) }] }),
      });
      const dnaData = await dnaRes.json();
      if (!dnaRes.ok || !dnaData.results?.[0]) return setError(dnaData.error ?? "Failed to analyze your planned ad");

      const res = await fetch("/api/preflight", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ clustering: state.clustering, candidate: dnaData.results[0].dna }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error ?? "Pre-flight check failed");

      const candidateAd: Ad = {
        id: candidateId,
        source: "planned",
        advertiser: "Your planned ad",
        coverUrl: "",
        copy,
        firstSeen: "",
        lastSeen: "",
        runDays: 0,
        rawMetrics: {},
      };
      setState((s) => ({ ...s, preflight: { candidateAd, verdict: data.verdict }, loading: false, loadingStep: "" }));
    } catch {
      setError("Network error. Please try again");
    }
  }

  async function handlePreflightImage(file: File) {
    if (!state.clustering) return;
    setLoading("Analyzing your planned ad…");
    try {
      const { base64, previewUrl } = await compressImage(file);
      const candidateId = `preflight_${Date.now()}`;
      const dnaRes = await fetch("/api/deconstruct", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ adKind: "uploaded", ads: [{ id: candidateId, imageBase64: base64 }] }),
      });
      const dnaData = await dnaRes.json();
      if (!dnaRes.ok || !dnaData.results?.[0]) return setError(dnaData.error ?? "Failed to analyze your planned ad");

      const res = await fetch("/api/preflight", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ clustering: state.clustering, candidate: dnaData.results[0].dna }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error ?? "Pre-flight check failed");

      const candidateAd: Ad = {
        id: candidateId,
        source: "planned",
        advertiser: "Your planned ad",
        coverUrl: previewUrl,
        copy: "",
        firstSeen: "",
        lastSeen: "",
        runDays: 0,
        rawMetrics: {},
      };
      setState((s) => ({ ...s, preflight: { candidateAd, verdict: data.verdict }, loading: false, loadingStep: "" }));
    } catch {
      setError("Network error. Please try again");
    }
  }

  // Runs all four modules on a seed vertical, threading each step's result forward
  // locally and printing real progress into the sonar band. Used by the "15-second
  // demo" button, the hero CTA on seed verticals, and shared-link replay on mount.
  // sampleSlug is resolved fresh from the API rather than component state, since a
  // mount-time replay races the sampleSets fetch.
  async function runSeedDemo(verticalValue: string, sampleSlugParam: string | null) {
    const vertical = verticalValue;
    const slug = slugify(vertical);
    setDnaFilter(NO_FILTER);
    setLog([]);
    setState((s) => ({ ...INITIAL, sampleSets: s.sampleSets, vertical, loading: true, loadingStep: "Pulling competitor ads…" }));
    pushLog(`casting into ${vertical}…`);
    try {
      // 1. Mine
      const mineRes = await fetch("/api/mine", { method: "POST", headers: jsonHeaders, body: JSON.stringify({ vertical }) });
      const mine = await mineRes.json();
      if (!mineRes.ok) return setError(mine.error ?? "Demo failed while mining ads");
      const ads: Ad[] = mine.ads ?? [];
      setState((s) => ({ ...s, ads, winnerSummary: mine.winnerSummary ?? null, fromSeed: !!mine.fromSeed, loadingStep: "Extracting creative DNA…" }));
      if (ads.length) pushLog(`${ads.length} ads hooked · longest runner ${Math.max(...ads.map((a) => a.runDays))} days`);
      await sleep(600);
      scrollToStep("step-ads");

      // 2. Deconstruct
      pushLog("extracting creative DNA · hooks, angles, formats, offers");
      const dRes = await fetch("/api/deconstruct", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ vertical, ads: analyzableAds(ads) }),
      });
      const d = await dRes.json();
      if (!dRes.ok) return setError(d.error ?? "Demo failed while extracting DNA");
      const marketDna: { adId: string; dna: CreativeDNA }[] = d.results ?? [];
      setState((s) => ({ ...s, marketDna, loadingStep: "Scoring your ad set…" }));
      await sleep(600);

      // 3. Score a pre-baked sample ad set
      let sampleSlug = sampleSlugParam;
      if (!sampleSlug) {
        const samplesRes = await fetch("/api/samples");
        const samplesData = await samplesRes.json();
        const samples: SampleSummary[] = samplesData.samples ?? [];
        sampleSlug = samples.find((sm) => sm.vertical === slug)?.slug ?? "weight-loss-redundant";
      }
      const setRes = await fetch(`/api/samples?slug=${encodeURIComponent(sampleSlug)}`);
      const sample = await setRes.json();
      if (!setRes.ok) return setError(sample.error ?? "Demo failed while loading the sample set");
      pushLog(`reading your ad set · ${(sample.ads ?? []).length} ads`);
      const scoreRes = await fetch("/api/score", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ sampleSetId: sampleSlug, dna: sample.dna, marketDNA: marketDna.map((r) => r.dna) }),
      });
      const score = await scoreRes.json();
      if (!scoreRes.ok) return setError(score.error ?? "Demo failed while scoring diversity");
      setState((s) => ({
        ...s,
        userAds: sample.ads,
        selectedSample: sampleSlug,
        sampleLabel: sample.label ?? sampleSlug,
        clustering: score.clustering,
        preflightExamples: sample.preflightExamples ?? [],
        loadingStep: "Generating angle briefs…",
      }));
      if (score.clustering?.gaps) pushLog(`surfacing angle gaps · ${score.clustering.gaps.length} found`);
      await sleep(600);

      // 4. Generate angle briefs
      const gRes = await fetch("/api/generate", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ vertical, winnerSummary: mine.winnerSummary ?? "", marketDNA: marketDna, clustering: score.clustering }),
      });
      const g = await gRes.json();
      if (!gRes.ok) return setError(g.error ?? "Demo failed while generating angles");
      const demoBriefs: AngleBrief[] = g.briefs ?? [];
      const demoBriefClustering: ConceptClustering | null = g.briefClustering ?? null;
      setState((s) => ({ ...s, briefs: demoBriefs, briefClustering: demoBriefClustering, loading: false, loadingStep: "" }));
      doneLog("done. everything below is from the public record");
      if (!demoBriefClustering && demoBriefs.length) void scoreBriefBatch(demoBriefs);
      await sleep(500);

      // Make the report replayable: encode the seed vertical + sample slug in the URL.
      history.replaceState(null, "", `?v=${slug}&s=${sampleSlug}`);
    } catch {
      setError("Network error. Please try again");
    }
  }

  // Hero CTA: seed verticals get the instant full demo; anything else is a live pull.
  function handleCast() {
    const v = state.vertical.trim();
    if (!v || state.loading) return;
    const seed = SEED_VERTICALS.find((sv) => slugify(sv.value) === slugify(v));
    if (seed) void runSeedDemo(seed.value, null);
    else void handleMine();
  }

  // Nav demo button: re-runs nothing if results already exist, just reels back up.
  function handleDemoButton() {
    if (state.loading) return;
    if (state.ads.length) {
      scrollToStep("step-ads");
      return;
    }
    void runSeedDemo("weight-loss supplement", null);
  }

  function copyBriefText(brief: AngleBrief): string {
    const evidence = evidenceAdvertisers(brief.evidenceAdIds, state.ads);
    return [
      `Angle: ${brief.angleName}`,
      `Driver: ${brief.emotionalDriver}`,
      `Why now: ${brief.whyNow}`,
      `Hook: ${brief.hookLine}`,
      `Format: ${brief.formatRecommendation}`,
      `Persona: ${brief.targetPersona}`,
      `Meta: ${brief.variants.meta}`,
      `TikTok: ${brief.variants.tiktok}`,
      `Native: ${brief.variants.native}`,
      evidence ? `Evidence: ${evidence}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  function handleExportCSV() {
    // Quote-escape, and neutralize spreadsheet formula injection: model-generated
    // copy starting with = + - @ would otherwise execute when opened in Excel.
    const esc = (v: string) => `"${(/^[=+\-@\t\r]/.test(v) ? `'${v}` : v).replace(/"/g, '""')}"`;
    const headers = ["Priority", "Angle Name", "Emotional Driver", "Why Now", "Hook Line", "Format", "Persona", "Meta Copy", "TikTok Copy", "Native Copy", "Evidence"];
    const rows = [...state.briefs]
      .sort((a, b) => a.priority - b.priority)
      .map((b) => [b.priority, b.angleName, b.emotionalDriver, b.whyNow, b.hookLine, b.formatRecommendation, b.targetPersona, b.variants.meta, b.variants.tiktok, b.variants.native, evidenceAdvertisers(b.evidenceAdIds, state.ads)]
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

  function handleExportJSON() {
    const adById = new Map(state.ads.map((a) => [a.id, a] as const));
    const payload = {
      tool: "angler",
      vertical: state.vertical,
      generatedAt: new Date().toISOString(),
      briefs: [...state.briefs]
        .sort((a, b) => a.priority - b.priority)
        .map((b) => ({
          priority: b.priority,
          angleName: b.angleName,
          emotionalDriver: b.emotionalDriver,
          whyNow: b.whyNow,
          hookLine: b.hookLine,
          formatRecommendation: b.formatRecommendation,
          targetPersona: b.targetPersona,
          variants: { meta: b.variants.meta, tiktok: b.variants.tiktok, native: b.variants.native },
          evidence: b.evidenceAdIds
            .map((id) => adById.get(id))
            .filter((ad): ad is Ad => !!ad)
            .map((ad) => ({ advertiser: ad.advertiser, runDays: ad.runDays })),
        })),
      ...(state.briefClustering
        ? { batchIntegrity: { briefs: state.briefClustering.nAds, distinctConcepts: state.briefClustering.kConcepts } }
        : {}),
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `angle-briefs-${slugify(state.vertical) || "export"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleFilesSelected(files: FileList | File[]) {
    const remaining = MAX_UPLOADED_IMAGES - state.uploadedImages.length;
    const toProcess = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, Math.max(0, remaining));
    if (toProcess.length === 0) return;
    const compressed = await Promise.all(
      toProcess.map(async (file) => {
        const { base64, previewUrl } = await compressImage(file);
        return { id: `${Date.now()}_${Math.random().toString(36).slice(2)}`, fileName: file.name, previewUrl, base64 };
      }),
    );
    setState((s) => ({ ...s, uploadedImages: [...s.uploadedImages, ...compressed].slice(0, MAX_UPLOADED_IMAGES) }));
  }

  function handleRemoveUploadedImage(id: string) {
    setState((s) => ({ ...s, uploadedImages: s.uploadedImages.filter((img) => img.id !== id) }));
  }

  // ── Derived values ─────────────────────────────────────────────────────
  const currentSlug = slugify(state.vertical);
  const relevantSamples = state.sampleSets.filter((s) => s.vertical === currentSlug);
  const samplesToShow = relevantSamples.length ? relevantSamples : state.sampleSets;

  const hasAds = state.ads.length > 0;
  const hasMarketDna = state.marketDna.length > 0;

  const sortedAds = [...state.ads].sort((a, b) => b.runDays - a.runDays);
  const dnaById = new Map(state.marketDna.map((r) => [r.adId, r.dna] as const));
  const marketAdById = new Map(state.ads.map((a) => [a.id, a] as const));
  const sourcesLabel = [...new Set(state.ads.map((a) => sourceLabel(a.source)))].join(" + ") || "public ad libraries";

  // Distinct angles proven in the market, by frequency.
  const marketAngles = (() => {
    const counts = new Map<string, number>();
    state.marketDna.forEach((r) => counts.set(r.dna.angle, (counts.get(r.dna.angle) ?? 0) + 1));
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  })();

  // Only reached client-side (clustering is set by user interaction), so
  // window/location are safe here.
  const shareUrl =
    clustering && state.fromSeed && state.selectedSample
      ? `${location.origin}${location.pathname}?v=${currentSlug}&s=${state.selectedSample}`
      : null;

  const navSections = [
    { label: "1 · The catch", enabled: hasAds, ref: catchRef, id: "step-ads" },
    { label: "2 · DNA", enabled: hasMarketDna, ref: dnaRef, id: "step-dna" },
    { label: "3 · Audit", enabled: hasMarketDna, ref: auditRef, id: "step-score" },
    { label: "4 · Angles", enabled: state.briefs.length > 0, ref: briefsRef, id: "step-briefs" },
  ].map((s, i) => ({
    label: s.label,
    enabled: s.enabled,
    active: s.enabled && activeNav === i,
    onClick: () => s.enabled && scrollToStep(s.id),
  }));

  return (
    <>
      {/* paper grain */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 60,
          opacity: 0.5,
          backgroundImage:
            "url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22240%22 height=%22240%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%222%22/%3E%3CfeColorMatrix values=%220 0 0 0 0.11 0 0 0 0 0.1 0 0 0 0 0.09 0 0 0 0.05 0%22/%3E%3C/filter%3E%3Crect width=%22240%22 height=%22240%22 filter=%22url(%23n)%22/%3E%3C/svg%3E')",
        }}
      />

      <Nav sections={navSections} progress={progress} onDemo={handleDemoButton} demoDisabled={state.loading} />

      <Hero
        vertical={state.vertical}
        onVerticalChange={(v) => setState((s) => ({ ...s, vertical: v }))}
        onCast={handleCast}
        chips={SEED_VERTICALS.map((v) => ({ label: v.label, value: v.value, active: state.vertical === v.value }))}
        onChipSelect={(value) => setState((s) => ({ ...s, vertical: value }))}
        loading={state.loading}
        log={log}
        unavailable={state.unavailable}
      />

      {hasAds && (
        <CatchSection
          innerRef={catchRef}
          ads={sortedAds}
          dnaById={dnaById}
          selected={state.selectedAd}
          onSelect={(i) => setState((s) => ({ ...s, selectedAd: i }))}
          winnerSummary={state.winnerSummary}
          fromSeed={state.fromSeed}
          cachedDate={SEED_CACHED_DATE}
          sourcesLabel={sourcesLabel}
          extractLabel={
            hasMarketDna ? "Extract DNA ↓" : state.loading && state.loadingStep.includes("DNA") ? "Analyzing…" : "Extract DNA →"
          }
          onExtract={() => (hasMarketDna ? scrollToStep("step-dna") : void handleDeconstruct())}
          extractDisabled={state.loading}
        />
      )}

      {hasMarketDna && (
        <DnaSection
          innerRef={dnaRef}
          marketDna={state.marketDna}
          adById={marketAdById}
          filter={dnaFilter}
          onToggle={(dim, v) => setDnaFilter((f) => ({ ...f, [dim]: f[dim] === v ? null : v }))}
          onClear={() => setDnaFilter(NO_FILTER)}
        />
      )}

      {hasMarketDna && (
        <AuditSection
          innerRef={auditRef}
          loading={state.loading}
          loadingStep={state.loadingStep}
          samples={samplesToShow}
          selectedSample={state.selectedSample}
          onScoreSample={(slug) => void handleScoreSample(slug)}
          pasteText={state.pasteText}
          onPasteText={(v) => setState((s) => ({ ...s, pasteText: v }))}
          onScorePaste={() => void handleScorePaste()}
          uploadedImages={state.uploadedImages}
          onFilesSelected={handleFilesSelected}
          onRemoveImage={handleRemoveUploadedImage}
          onScoreUpload={() => void handleScoreUpload()}
          maxImages={MAX_UPLOADED_IMAGES}
          sampleLabel={state.sampleLabel}
          userAds={state.userAds}
          clustering={clustering}
          marksOn={marksOn}
          countT={countT}
          budget={state.budget}
          onBudget={(v) => setState((s) => ({ ...s, budget: v }))}
          marketAngles={marketAngles}
          shareUrl={shareUrl}
          preflightExamples={state.preflightExamples}
          preflight={state.preflight}
          onPreflightSeed={(id) => void handlePreflightSeed(id)}
          preflightPasteText={state.preflightPasteText}
          onPreflightPasteText={(v) => setState((s) => ({ ...s, preflightPasteText: v }))}
          onPreflightPaste={() => void handlePreflightPaste()}
          onPreflightImage={(file) => void handlePreflightImage(file)}
          onGenerate={() => void handleGenerate()}
          hasBriefs={state.briefs.length > 0}
        />
      )}

      {state.briefs.length > 0 && (
        <BriefsSection
          innerRef={briefsRef}
          briefs={state.briefs}
          marketAdById={marketAdById}
          clustering={clustering}
          briefClustering={state.briefClustering}
          onExportCSV={handleExportCSV}
          onExportJSON={handleExportJSON}
          copyBriefText={copyBriefText}
        />
      )}

      {/* status pill: progress + errors for operations run after the initial cast */}
      {((state.loading && hasAds) || state.error) && (
        <div
          style={{
            position: "fixed",
            bottom: 18,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 70,
            background: state.error ? C.amberBg : "rgba(28,25,23,0.92)",
            color: state.error ? C.amber : C.paper,
            border: state.error ? `1px solid ${C.amberBorder}` : "none",
            borderRadius: 999,
            padding: "9px 18px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            boxShadow: "0 8px 24px rgba(28,25,23,0.2)",
            maxWidth: "min(90vw, 640px)",
          }}
        >
          {state.loading && !state.error && (
            <span style={{ position: "relative", width: 14, height: 14, flexShrink: 0 }}>
              <span style={{ position: "absolute", inset: 0, border: `1.5px solid ${C.paper}`, borderRadius: "50%", animation: "ripple 1.6s ease-out infinite" }} />
              <span style={{ position: "absolute", inset: 5, background: C.paper, borderRadius: "50%" }} />
            </span>
          )}
          <span style={{ ...font(500, 12, state.error ? SANS : MONO) }}>{state.error ?? state.loadingStep}</span>
          {state.error && (
            <button
              onClick={() => setState((s) => ({ ...s, error: null }))}
              aria-label="Dismiss error"
              style={{ background: "none", border: "none", color: C.amber, cursor: "pointer", ...font(700, 13, SANS), padding: 0 }}
            >
              ×
            </button>
          )}
        </div>
      )}
    </>
  );
}
