import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { Ad, CreativeDNA } from "@/lib/types";

interface SeedFile {
  vertical: {
    slug: string;
    display_name: string;
    is_seed: boolean;
  };
  ads: Ad[];
  dna: { adId: string; dna: CreativeDNA }[];
  winnerSummary: string;
}

const SEED_DIR = join(process.cwd(), "data", "seed");

function loadSeedFile(slug: string): SeedFile | null {
  const filePath = join(SEED_DIR, `${slug}.json`);
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf-8")) as SeedFile;
}

export function getSeedAds(slug: string): Ad[] | null {
  const seed = loadSeedFile(slug);
  return seed?.ads ?? null;
}

export function getSeedDNA(slug: string): Map<string, CreativeDNA> | null {
  const seed = loadSeedFile(slug);
  if (!seed) return null;
  return new Map(seed.dna.map((entry) => [entry.adId, entry.dna]));
}

export function getSeedWinnerSummary(slug: string): string | null {
  return loadSeedFile(slug)?.winnerSummary ?? null;
}

export function listSeedSlugs(): string[] {
  if (!existsSync(SEED_DIR)) return [];
  const { readdirSync } = require("fs") as typeof import("fs");
  return readdirSync(SEED_DIR)
    .filter((f: string) => f.endsWith(".json"))
    .map((f: string) => f.replace(".json", ""));
}
