import { test } from "node:test";
import assert from "node:assert/strict";
import { getSeedAds, getSampleSet, listSeedVerticals, listSampleSets } from "@/lib/cache/seed";

// These run against the real committed seed data, the same files the demo serves.

test("a known seed vertical loads", () => {
  const ads = getSeedAds("weight-loss-supplement");
  assert.ok(ads && ads.length > 0);
});

test("unknown slugs return null", () => {
  assert.equal(getSeedAds("not-a-vertical"), null);
});

test("path-traversal slugs are rejected, not resolved", () => {
  assert.equal(getSampleSet("../weight-loss-supplement"), null);
  assert.equal(getSeedAds("../../package"), null);
  assert.equal(getSeedAds("..%2F..%2Fetc"), null);
  assert.equal(getSeedAds(""), null);
});

test("every listed seed vertical has ads and every listed sample has clustering ids that resolve", () => {
  const verticals = listSeedVerticals();
  assert.ok(verticals.length >= 4);
  for (const v of verticals) assert.ok(v.adCount > 0, `${v.slug} has no ads`);

  for (const s of listSampleSets()) {
    const full = getSampleSet(s.slug);
    assert.ok(full, `${s.slug} did not load`);
    const adIds = new Set(full!.ads.map((a) => a.id));
    for (const cluster of full!.clustering.clusters) {
      for (const id of cluster.adIds) {
        assert.ok(adIds.has(id), `${s.slug}: cluster references unknown ad id ${id}`);
      }
    }
  }
});
