import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeApifyAd, sortByRunDays, type ApifyRawAd } from "@/lib/sources/normalize";
import type { Ad } from "@/lib/types";

const DAY = 24 * 60 * 60;

function rawAd(overrides: Partial<ApifyRawAd> = {}): ApifyRawAd {
  return {
    ad_archive_id: "123",
    page_name: "Acme",
    is_active: true,
    start_date: Math.floor(Date.now() / 1000) - 10 * DAY,
    snapshot: { body: { text: "Lose weight fast with this one trick" } },
    ...overrides,
  };
}

test("normalizes an active ad with runDays measured to now", () => {
  const ad = normalizeApifyAd(rawAd());
  assert.equal(ad.id, "fb_123");
  assert.equal(ad.advertiser, "Acme");
  assert.equal(ad.copy, "Lose weight fast with this one trick");
  assert.equal(ad.runDays, 10);
});

test("skips dynamic-creative placeholder copy", () => {
  const ad = normalizeApifyAd(
    rawAd({ snapshot: { body: { text: "{{product.brand}}" }, title: "Real title" } }),
  );
  assert.equal(ad.copy, "Real title");
});

test("ads without an archive id get distinct content-derived ids", () => {
  const a = normalizeApifyAd(rawAd({ ad_archive_id: undefined }));
  const b = normalizeApifyAd(
    rawAd({ ad_archive_id: undefined, snapshot: { body: { text: "A different ad entirely" } } }),
  );
  assert.match(a.id, /^fb_noid_/);
  assert.notEqual(a.id, b.id);
});

test("same content without archive id yields a stable id", () => {
  const a = normalizeApifyAd(rawAd({ ad_archive_id: undefined }));
  const b = normalizeApifyAd(rawAd({ ad_archive_id: undefined }));
  assert.equal(a.id, b.id);
});

test("runDays never goes negative", () => {
  const ad = normalizeApifyAd(
    rawAd({ is_active: false, start_date: 100 * DAY, end_date: 99 * DAY }),
  );
  assert.equal(ad.runDays, 0);
});

test("sortByRunDays sorts descending without mutating the input", () => {
  const ads = [{ runDays: 1 }, { runDays: 9 }, { runDays: 5 }] as Ad[];
  const sorted = sortByRunDays(ads);
  assert.deepEqual(sorted.map((a) => a.runDays), [9, 5, 1]);
  assert.deepEqual(ads.map((a) => a.runDays), [1, 9, 5]);
});
