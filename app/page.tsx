"use client";

import { useEffect, useState } from "react";
import type { Ad, CreativeDNA, ConceptClustering, AngleBrief, PreflightVerdict } from "@/lib/types";
import { briefToDNA } from "@/lib/ai/briefs";

interface SampleSummary {
  slug: string;
  label: string;
  vertical: string;
  adCount: number;
}

interface PreflightExampleSummary {
  id: string;
  label: string;
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
  uploadedImages: { id: string; fileName: string; previewUrl: string; base64: string }[];
  budget: string;
  clustering: ConceptClustering | null;
  briefs: AngleBrief[];
  briefClustering: ConceptClustering | null;
  // Module 3.5 — pre-flight check on a planned ad
  preflightExamples: PreflightExampleSummary[];
  preflightPasteText: string;
  preflight: { candidateAd: Ad | null; verdict: PreflightVerdict | null } | null;
  loading: boolean;
  loadingStep: string;
  error: string | null;
}

const SEED_VERTICALS = [
  { label: "Weight-Loss Supplement", value: "weight-loss supplement" },
  { label: "Debt Relief", value: "debt relief" },
  { label: "ED Telehealth", value: "ed telehealth" },
];

// Date the seed verticals were last refreshed from the live ad libraries. Shown to
// the judge so cached real data is never mistaken for a live fetch.
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
  sampleSets: [],
  userAds: [],
  selectedSample: null,
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
// found in the current ad set — e.g. a stale reference — are skipped silently).
function evidenceAdvertisers(evidenceAdIds: string[], ads: Ad[]): string {
  const byId = new Map(ads.map((a) => [a.id, a] as const));
  return evidenceAdIds
    .map((id) => byId.get(id)?.advertiser)
    .filter((name): name is string => !!name)
    .join(", ");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function scrollToStep(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
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

type DnaFilter = { angle: string | null; format: string | null; hookType: string | null };
const NO_FILTER: DnaFilter = { angle: null, format: null, hookType: null };

export default function Home() {
  const [state, setState] = useState<AppState>(INITIAL);
  const [dnaFilter, setDnaFilter] = useState<DnaFilter>(NO_FILTER);

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
        briefClustering: null,
        preflightExamples: [],
        preflight: null,
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
          // Synthesize a summary only when we don't already have a seed one (novel verticals).
          generateSummary: state.winnerSummary === null,
          ads: state.ads.slice(0, 15).map((ad) => ({
            id: ad.id,
            coverUrl: ad.coverUrl || undefined,
            copy: ad.copy || undefined,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error ?? "Failed to analyze creatives");
      if (!data.results || data.results.length === 0) {
        return setError("Couldn't extract creative DNA from these ads — try again or pick a different vertical.");
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
        clustering: data.clustering,
        briefs: [],
        briefClustering: null,
        preflightExamples: sample.preflightExamples ?? [],
        preflight: null,
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
        body: JSON.stringify({ adKind: "uploaded", ads: userAds.map((a) => ({ id: a.id, copy: a.copy })) }),
      });
      const dnaData = await dnaRes.json();
      if (!dnaRes.ok) return setError(dnaData.error ?? "Failed to analyze your ads");

      const res = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        clustering: data.clustering,
        briefs: [],
        briefClustering: null,
        preflightExamples: [],
        preflight: null,
        loading: false,
        loadingStep: "",
      }));
    } catch {
      setError("Network error — please try again");
    }
  }

  // Module 3 — score uploaded ad images (live path; needs an AI key + vision).
  async function handleScoreUpload() {
    const images = state.uploadedImages;
    if (images.length < 3) return setError("Upload at least 3 ad images.");
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adKind: "uploaded",
          ads: images.map((img, i) => ({ id: `upload_${i}`, imageBase64: img.base64 })),
        }),
      });
      const dnaData = await dnaRes.json();
      if (!dnaRes.ok) return setError(dnaData.error ?? "Failed to analyze your ads");

      const res = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        clustering: data.clustering,
        briefs: [],
        briefClustering: null,
        preflightExamples: [],
        preflight: null,
        loading: false,
        loadingStep: "",
      }));
    } catch {
      setError("Network error — please try again");
    }
  }

  // Non-blocking "dog food" self-score of a generated brief batch's own
  // diversity — fired after live-path briefs render (seed path already has
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
      // silent — the integrity panel just doesn't render
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
          marketDNA: state.marketDna,
          clustering: state.clustering,
        }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error ?? "Failed to generate angle briefs");
      if (!data.briefs || data.briefs.length === 0) {
        return setError("No angle briefs were generated — please try again.");
      }
      const briefClustering: ConceptClustering | null = data.briefClustering ?? null;
      setState((s) => ({ ...s, briefs: data.briefs, briefClustering, loading: false, loadingStep: "" }));
      if (!briefClustering) void scoreBriefBatch(data.briefs);
    } catch {
      setError("Network error — please try again");
    }
  }

  // Module 3.5 — pre-flight check on a pre-baked example candidate (seed path).
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
      setError("Network error — please try again");
    }
  }

  // Module 3.5 — pre-flight check on pasted ad copy (live path; needs an AI key).
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
        body: JSON.stringify({ adKind: "uploaded", ads: [{ id: candidateId, copy }] }),
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
      setError("Network error — please try again");
    }
  }

  // Module 3.5 — pre-flight check on an uploaded ad image (live path; needs an AI key + vision).
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
      setError("Network error — please try again");
    }
  }

  // One-click guided demo — runs all four modules on a seed vertical, threading
  // each step's result forward locally and scrolling the new section into view.
  async function handleRunFullDemo() {
    const vertical = "weight-loss supplement";
    const slug = slugify(vertical);
    setDnaFilter(NO_FILTER);
    setState((s) => ({ ...INITIAL, sampleSets: s.sampleSets, vertical, loading: true, loadingStep: "Pulling competitor ads…" }));
    try {
      // 1 — Mine
      const mineRes = await fetch("/api/mine", { method: "POST", headers: jsonHeaders, body: JSON.stringify({ vertical }) });
      const mine = await mineRes.json();
      if (!mineRes.ok) return setError(mine.error ?? "Demo failed while mining ads");
      const ads: Ad[] = mine.ads ?? [];
      setState((s) => ({ ...s, ads, winnerSummary: mine.winnerSummary ?? null, fromSeed: !!mine.fromSeed, loadingStep: "Extracting creative DNA…" }));
      await sleep(600);
      scrollToStep("step-ads");

      // 2 — Deconstruct
      const dRes = await fetch("/api/deconstruct", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ vertical, ads: ads.slice(0, 15).map((a) => ({ id: a.id, coverUrl: a.coverUrl || undefined, copy: a.copy || undefined })) }),
      });
      const d = await dRes.json();
      if (!dRes.ok) return setError(d.error ?? "Demo failed while extracting DNA");
      const marketDna: { adId: string; dna: CreativeDNA }[] = d.results ?? [];
      setState((s) => ({ ...s, marketDna, loadingStep: "Scoring your ad set…" }));
      await sleep(600);
      scrollToStep("step-dna");

      // 3 — Score a pre-baked sample ad set
      const sampleSlug = state.sampleSets.find((s) => s.vertical === slug)?.slug ?? "weight-loss-redundant";
      const setRes = await fetch(`/api/samples?slug=${encodeURIComponent(sampleSlug)}`);
      const sample = await setRes.json();
      if (!setRes.ok) return setError(sample.error ?? "Demo failed while loading the sample set");
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
        clustering: score.clustering,
        preflightExamples: sample.preflightExamples ?? [],
        loadingStep: "Generating angle briefs…",
      }));
      await sleep(600);
      scrollToStep("step-score");

      // 4 — Generate angle briefs
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
      if (!demoBriefClustering && demoBriefs.length) void scoreBriefBatch(demoBriefs);
      await sleep(500);
      scrollToStep("step-briefs");
    } catch {
      setError("Network error — please try again");
    }
  }

  function handleCopyBrief(brief: AngleBrief) {
    const evidence = evidenceAdvertisers(brief.evidenceAdIds, state.ads);
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
      evidence ? `Evidence: ${evidence}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    void navigator.clipboard.writeText(text);
  }

  function handleExportCSV() {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
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

  const currentSlug = slugify(state.vertical);
  const relevantSamples = state.sampleSets.filter((s) => s.vertical === currentSlug);
  const samplesToShow = relevantSamples.length ? relevantSamples : state.sampleSets;

  const hasAds = state.ads.length > 0;
  const hasMarketDna = state.marketDna.length > 0;

  // Module 3 derived values — the Entity-ID "collapse" math (Feature A).
  const clustering = state.clustering;
  const adById = new Map(state.userAds.map((a) => [a.id, a] as const));
  const marketAdById = new Map(state.ads.map((a) => [a.id, a] as const));
  const briefIntegrityRatio =
    state.briefClustering && state.briefClustering.nAds > 0
      ? state.briefClustering.kConcepts / state.briefClustering.nAds
      : 0;
  const redundant = clustering ? clustering.nAds - clustering.kConcepts : 0;
  const wastePct = clustering && clustering.nAds > 0 ? Math.round((redundant / clustering.nAds) * 100) : 0;
  const budgetNum = parseFloat(state.budget);
  const estWaste = clustering && !isNaN(budgetNum) && budgetNum > 0 ? Math.round((budgetNum * wastePct) / 100) : null;

  // Distinct angles proven in the market, by frequency (Feature D).
  const marketAngles = (() => {
    const counts = new Map<string, number>();
    state.marketDna.forEach((r) => counts.set(r.dna.angle, (counts.get(r.dna.angle) ?? 0) + 1));
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  })();

  // Filterable creative-DNA view (Feature B1).
  const dnaDims: Record<keyof DnaFilter, string[]> = {
    angle: [...new Set(state.marketDna.map((r) => r.dna.angle))],
    format: [...new Set(state.marketDna.map((r) => r.dna.format))],
    hookType: [...new Set(state.marketDna.map((r) => r.dna.hookType))],
  };
  const filteredDna = state.marketDna.filter(
    (r) =>
      (!dnaFilter.angle || r.dna.angle === dnaFilter.angle) &&
      (!dnaFilter.format || r.dna.format === dnaFilter.format) &&
      (!dnaFilter.hookType || r.dna.hookType === dnaFilter.hookType),
  );
  const dnaFilterActive = !!(dnaFilter.angle || dnaFilter.format || dnaFilter.hookType);

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
        <button
          onClick={handleRunFullDemo}
          disabled={state.loading}
          style={{ ...secondaryBtnStyle(state.loading), marginTop: 12 }}
        >
          ▶ Run the full demo (weight-loss)
        </button>
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
        <section id="step-ads" style={{ marginBottom: 40 }}>
          <div style={sectionHeaderStyle}>
            <Label step="2" text={`${state.ads.length} competitor ads — sorted by run duration`} badge={state.fromSeed ? "instant" : "live"} />
            <button onClick={handleDeconstruct} disabled={state.loading} style={secondaryBtnStyle(state.loading)}>
              {state.loading && state.loadingStep.includes("DNA") ? "Analyzing…" : "Extract DNA →"}
            </button>
          </div>

          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: -4, marginBottom: 8 }}>
            {state.fromSeed
              ? `Real ads from public ad libraries · cached ${SEED_CACHED_DATE}`
              : "Real ads pulled live from the Meta Ad Library"}
          </p>

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
                    {ad.runDays}d running · {sourceLabel(ad.source)}
                  </span>
                </div>
                <p style={{ color: "var(--text-muted)", fontSize: 13, lineHeight: 1.5 }}>{ad.copy}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Step 3: Market DNA (filterable) ──────────────────────────────────── */}
      {hasMarketDna && (
        <section id="step-dna" style={{ marginBottom: 40 }}>
          <Label step="3" text="Creative DNA of the market winners" />

          {/* Filter controls — by angle / format / hook type (Feature B1) */}
          <div style={{ marginBottom: 10 }}>
            {(["angle", "format", "hookType"] as const).map((dim) => (
              <div key={dim} style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 64, textTransform: "capitalize" }}>{dim}</span>
                {dnaDims[dim].map((v) => (
                  <button
                    key={v}
                    onClick={() => setDnaFilter((f) => ({ ...f, [dim]: f[dim] === v ? null : v }))}
                    style={{ ...chipStyle(dnaFilter[dim] === v), padding: "3px 10px", fontSize: 12 }}
                  >
                    {v}
                  </button>
                ))}
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
            Showing {filteredDna.length} of {state.marketDna.length}
            {dnaFilterActive && (
              <button
                onClick={() => setDnaFilter(NO_FILTER)}
                style={{ marginLeft: 8, fontSize: 11, color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}
              >
                clear filters
              </button>
            )}
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {filteredDna.map((r) => (
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

          {samplesToShow.length > 0 ? (
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
          ) : (
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>
              No sample ad sets available right now — paste your own captions below instead.
            </p>
          )}

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

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void handleFilesSelected(e.dataTransfer.files);
            }}
            onClick={() => document.getElementById("upload-input")?.click()}
            style={{
              border: "1px dashed var(--border)",
              borderRadius: 8,
              padding: 20,
              textAlign: "center",
              cursor: "pointer",
              marginBottom: 8,
            }}
          >
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
              Drag &amp; drop real ad screenshots here (min 3, max {MAX_UPLOADED_IMAGES}) — or click to browse
            </p>
            <input
              id="upload-input"
              type="file"
              accept="image/*"
              multiple
              style={{ display: "none" }}
              onChange={(e) => {
                if (e.target.files) void handleFilesSelected(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {state.uploadedImages.length > 0 && (
            <>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                {state.uploadedImages.map((img) => (
                  <div key={img.id} style={{ position: "relative" }}>
                    <img
                      src={img.previewUrl}
                      alt={img.fileName}
                      style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border)" }}
                    />
                    <button
                      onClick={() => handleRemoveUploadedImage(img.id)}
                      style={{
                        position: "absolute",
                        top: -6,
                        right: -6,
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        border: "none",
                        background: "#f87171",
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
                onClick={handleScoreUpload}
                disabled={state.loading || state.uploadedImages.length < 3}
                style={{ ...secondaryBtnStyle(state.loading), marginBottom: 8 }}
              >
                Score uploaded images →
              </button>
            </>
          )}

          {state.userAds.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
                YOUR AD SET ({state.userAds.length} ads)
              </p>
              {state.userAds.map((ad) => (
                <div key={ad.id} style={{ ...cardStyle, padding: "8px 12px" }}>
                  {!ad.copy && ad.coverUrl ? (
                    <img src={ad.coverUrl} alt="" style={{ maxWidth: 120, borderRadius: 6, display: "block" }} />
                  ) : (
                    <p style={{ color: "var(--text-muted)", fontSize: 12, lineHeight: 1.5 }}>{ad.copy}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Step 5: Diversity result ─────────────────────────────────────────── */}
      {clustering && (
        <section id="step-score" style={{ marginBottom: 40 }}>
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
          {clustering.clusters.length === 0 && (
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>
              No distinct concepts were detected in this ad set.
            </p>
          )}
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
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {cluster.adIds.map((id) => {
                      const matchedAd = adById.get(id);
                      if (matchedAd && !matchedAd.copy && matchedAd.coverUrl) {
                        return (
                          <img
                            key={id}
                            src={matchedAd.coverUrl}
                            alt=""
                            style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border)" }}
                          />
                        );
                      }
                      return (
                        <div
                          key={id}
                          style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.45, padding: "7px 11px", borderRadius: 6, background: "var(--bg)", border: "1px solid var(--border)", width: "100%" }}
                        >
                          {matchedAd?.copy ?? id}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Market-vs-you coverage — what's proven vs what you're missing (Feature D) */}
          {(marketAngles.length > 0 || clustering.gaps.length > 0) && (
            <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
              {marketAngles.length > 0 && (
                <div style={{ ...calloutStyle, flex: "1 1 240px" }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", marginBottom: 10 }}>
                    PROVEN IN YOUR MARKET
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {marketAngles.map(([angle, count]) => (
                      <span key={angle} style={{ fontSize: 12, padding: "3px 10px", borderRadius: 9999, border: "1px solid var(--border)", background: "var(--bg)" }}>
                        {angle} <span style={{ color: "var(--text-muted)" }}>×{count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {clustering.gaps.length > 0 && (
                <div style={{ ...calloutStyle, flex: "1 1 240px", borderColor: "rgba(245,158,11,0.3)", background: "rgba(245,158,11,0.06)" }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "#f59e0b", marginBottom: 10 }}>
                    YOU&apos;RE NOT RUNNING — angle gaps
                  </p>
                  <ul style={{ paddingLeft: 16, margin: 0 }}>
                    {clustering.gaps.map((g, i) => (
                      <li key={i} style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 6 }}>{g}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* ── Pre-flight check — test a planned ad before you spend (Feature B) ──── */}
      {clustering && (
        <section style={{ marginBottom: 40 }}>
          <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>
            PRE-FLIGHT CHECK — test a planned ad before you spend
          </p>
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 12 }}>
            Before you spend on a new creative, check whether Meta would treat it as a new
            Entity ID — or silently fold it into a concept you&apos;re already running.
          </p>

          {state.preflightExamples.length > 0 && (
            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              {state.preflightExamples.map((ex) => (
                <button
                  key={ex.id}
                  onClick={() => handlePreflightSeed(ex.id)}
                  disabled={state.loading}
                  style={chipStyle(state.preflight?.candidateAd?.id === ex.id)}
                >
                  {ex.label}
                </button>
              ))}
            </div>
          )}

          <details style={{ marginBottom: 8 }}>
            <summary style={{ fontSize: 13, color: "var(--text-muted)", cursor: "pointer" }}>
              …or test your own planned ad
            </summary>
            <textarea
              value={state.preflightPasteText}
              onChange={(e) => setState((s) => ({ ...s, preflightPasteText: e.target.value }))}
              placeholder="Paste your planned ad caption…"
              rows={3}
              style={{ ...inputStyle, width: "100%", marginTop: 8, fontFamily: "inherit", resize: "vertical" }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <button onClick={handlePreflightPaste} disabled={state.loading} style={secondaryBtnStyle(state.loading)}>
                Check this ad →
              </button>
              <button
                onClick={() => document.getElementById("preflight-upload-input")?.click()}
                disabled={state.loading}
                style={secondaryBtnStyle(state.loading)}
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
                  if (file) void handlePreflightImage(file);
                  e.target.value = "";
                }}
              />
            </div>
          </details>

          {state.preflight?.verdict && (
            <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
              {state.preflight.candidateAd && (
                <div style={{ ...cardStyle, flex: "0 0 160px", padding: "8px 12px" }}>
                  {state.preflight.candidateAd.coverUrl && (
                    <img
                      src={state.preflight.candidateAd.coverUrl}
                      alt=""
                      style={{ width: "100%", borderRadius: 6, display: "block", marginBottom: 8 }}
                    />
                  )}
                  {state.preflight.candidateAd.copy && (
                    <p style={{ color: "var(--text-muted)", fontSize: 12, lineHeight: 1.5 }}>{state.preflight.candidateAd.copy}</p>
                  )}
                </div>
              )}
              <div
                style={{
                  ...calloutStyle,
                  flex: "1 1 320px",
                  borderColor: state.preflight.verdict.verdict === "collapses" ? "rgba(248,113,113,0.4)" : "rgba(16,185,129,0.4)",
                  background: state.preflight.verdict.verdict === "collapses" ? "rgba(248,113,113,0.06)" : "rgba(16,185,129,0.06)",
                }}
              >
                {state.preflight.verdict.verdict === "collapses" ? (
                  <>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "#f87171", marginBottom: 6 }}>
                      ⚠ Collapses into &ldquo;{state.preflight.verdict.collidesWith}&rdquo;
                    </p>
                    <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 10 }}>
                      {state.preflight.verdict.reason} — a wasted auction entry.
                    </p>
                    {state.preflight.verdict.fixes.length > 0 && (
                      <>
                        <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>To earn a new Entity ID:</p>
                        <ul style={{ paddingLeft: 16, margin: 0 }}>
                          {state.preflight.verdict.fixes.map((f, i) => (
                            <li key={i} style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 6 }}>{f}</li>
                          ))}
                        </ul>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "#10b981", marginBottom: 6 }}>
                      ✓ Genuinely new concept — safe to produce
                    </p>
                    <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{state.preflight.verdict.reason}</p>
                  </>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── Step 6: Angle briefs ─────────────────────────────────────────────── */}
      {state.briefs.length > 0 && (
        <section id="step-briefs">
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
                {brief.evidenceAdIds.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 10 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)" }}>EVIDENCE</span>
                    {brief.evidenceAdIds.map((id) => {
                      const ad = marketAdById.get(id);
                      return ad ? <EvidenceChip key={id} ad={ad} /> : null;
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Batch integrity panel — the brief batch's own diversity (Feature A5) */}
          {state.briefClustering && (
            <div
              style={{
                ...calloutStyle,
                marginTop: 16,
                borderColor: briefIntegrityRatio >= 0.9 ? "rgba(16,185,129,0.4)" : "rgba(245,158,11,0.4)",
                background: briefIntegrityRatio >= 0.9 ? "rgba(16,185,129,0.06)" : "rgba(245,158,11,0.06)",
              }}
            >
              <p style={{ fontSize: 13, fontWeight: 600 }}>
                {state.briefClustering.nAds} briefs → {state.briefClustering.kConcepts} distinct concepts
              </p>
              {state.clustering && (
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
                  Your current set: {state.clustering.nAds} ads → {state.clustering.kConcepts} concepts.
                </p>
              )}
            </div>
          )}
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

function EvidenceChip({ ad }: { ad: Ad }) {
  const [imgError, setImgError] = useState(false);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 9px 3px 3px",
        borderRadius: 9999,
        border: "1px solid var(--border)",
        background: "var(--bg)",
      }}
    >
      {ad.coverUrl && !imgError ? (
        <img
          src={ad.coverUrl}
          alt=""
          onError={() => setImgError(true)}
          style={{ width: 32, height: 32, objectFit: "cover", borderRadius: "50%" }}
        />
      ) : (
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--surface)", border: "1px solid var(--border)" }} />
      )}
      <span style={{ fontSize: 11, color: "var(--text)", maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {ad.advertiser}
      </span>
      <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", background: "#10b981", borderRadius: 9999, padding: "1px 7px", whiteSpace: "nowrap" }}>
        {ad.runDays}d
      </span>
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
