# Diversity Engine v2: measured, deterministic concept clustering

> Status: in progress (started 2026-09-23). Supersedes the "embeddings + cosine is a
> documented fast-follow" note in `docs/ARCHITECTURE.md`.

## Problem

Module 3's core claim ("these 8 ads are really 3 concepts to Meta") is a single LLM
call. It is non-deterministic (two runs can disagree), unmeasured (no ground truth), and
expensive relative to what it does. Nothing in the repo can answer "how do you know the
score is right?"

## Target design

```
user ads ──► embed (Voyage voyage-multimodal-3.5: copy + DNA text + image when present)
         ──► cosine similarity matrix
         ──► average-linkage agglomerative clustering, similarity threshold τ   (deterministic, pure TS)
         ──► Claude names each cluster + explains why (one call; cannot change membership)
         ──► gaps vs market DNA (unchanged prompt, now fed deterministic clusters)
```

- **Membership is math, explanation is LLM.** The model can no longer move an ad between
  clusters, so the score is reproducible for a given input and τ.
- **Voyage** is Anthropic's recommended embeddings partner; multimodal means uploaded
  screenshots are embedded as images, not just their extracted text. Seed vectors are
  text-only: the seed ads' signed fbcdn cover URLs expired in June 2026 (0 of 53 load).
- **pgvector** (Supabase) caches embeddings by content hash, so re-scoring is free.
- **Seed path stays zero-credential:** seed/sample embeddings are precomputed offline into
  `data/seed/embeddings/*.json`, so the demo still needs no keys.

## Evaluation (the point of the whole feature)

- **Ground truth = human partitions.** For each of the 4 seed verticals (10–15 market ads)
  and 4 sample sets (8 ads), a human groups ads into "same concept to Meta" buckets
  (`data/eval/labels/*.json`). 85 ads → 445 labelled pairs. Labelling is blind: the tool
  shows copy and format only, never the model's clusters. Labels are written by a human
  only; LLM output is never used as ground truth (hard rule 2: no fabricated data).
- **Systems compared:** LLM-only (current), embeddings-only for each text view
  (`copy`, `dna`, `copy+dna`), and hybrid.
- **Metrics:** pairwise precision / recall / F1 on the "same concept" class, Adjusted Rand
  Index, run-to-run stability (same input twice → identical partition?), cost and latency.
- **τ is tuned with leave-one-set-out cross-validation** so the reported number is not
  fit on the data it is scored on.
- `npm run eval` prints the table; results are committed to `data/eval/results.json` and
  surfaced in the README and UI.

## Commit plan

1. `docs:` this plan
2. `feat(diversity):` cosine similarity + agglomerative clustering (`lib/diversity/cluster.ts`) + tests
3. `feat(diversity):` pairwise P/R/F1 + ARI metrics (`lib/diversity/metrics.ts`) + tests
4. `feat(embeddings):` provider interface + Voyage multimodal client + input builder + tests
5. `chore(seed):` offline script to precompute seed/sample embeddings  ← needs `VOYAGE_API_KEY`
6. `feat(eval):` label format + local labelling page + `npm run eval` harness with LOSO τ tuning
7. `feat(db):` migration 004: pgvector `ad_embeddings` cache keyed by content hash
8. `feat(ai):` cluster-naming prompt (names/explains fixed clusters, cannot move ads)
9. `feat(score):` hybrid path in `/api/score` (seed embeddings first, live embed second)
10. `feat(ui):` similarity heatmap + "agrees with human labels X%" stat in No.3
11. `docs:` ARCHITECTURE / CODEMAP / README / memory updated with measured results
