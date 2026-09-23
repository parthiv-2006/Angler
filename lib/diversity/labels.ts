// Human ground-truth labels for the diversity eval. One file per ad set in
// data/eval/labels/<slug>.json, written by the local labelling tool (npm run label).
// Labels are only ever written by a person; model output is never ground truth.

import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import { z } from "zod";

export const LABELS_DIR = join(process.cwd(), "data", "eval", "labels");

export const labelFileSchema = z.object({
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  labeler: z.string().min(1).max(100),
  labeledAt: z.string(),
  groups: z.array(z.array(z.string().min(1)).min(1)).min(1),
});

export type LabelFile = z.infer<typeof labelFileSchema>;

// A label file is only usable if it partitions exactly the set's ad ids.
export function validateAgainstIds(label: LabelFile, ids: string[]): string | null {
  const labelled = label.groups.flat();
  if (new Set(labelled).size !== labelled.length) return "an ad appears in more than one group";
  const expected = new Set(ids);
  const missing = ids.filter((id) => !labelled.includes(id));
  const unknown = labelled.filter((id) => !expected.has(id));
  if (missing.length) return `unlabelled ads: ${missing.join(", ")}`;
  if (unknown.length) return `unknown ads: ${unknown.join(", ")}`;
  return null;
}

export function loadLabels(): LabelFile[] {
  if (!existsSync(LABELS_DIR)) return [];
  return readdirSync(LABELS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => labelFileSchema.parse(JSON.parse(readFileSync(join(LABELS_DIR, f), "utf-8"))));
}
