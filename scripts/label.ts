/**
 * Local labelling tool for the diversity eval ground truth.
 *
 *   npm run label        # then open http://localhost:4455
 *
 * Shows each seed ad set's ads and lets a person assign every ad a group letter:
 * same letter = "Meta would treat these as the same concept". Saves to
 * data/eval/labels/<slug>.json. Labelling is blind: the page shows ad copy and format
 * only, never the model's clusters, so labels are not anchored on what is being scored.
 * Ads are shown in a fixed shuffled order so the seed file's ordering gives no hints.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { listClusterableSets } from "@/lib/cache/seed";
import { LABELS_DIR, labelFileSchema, validateAgainstIds } from "@/lib/diversity/labels";

const PORT = 4455;

// Deterministic shuffle (mulberry32 seeded from the slug) so reloads keep the order.
function shuffled<T>(items: T[], seedText: string): T[] {
  let seed = [...seedText].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const random = () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const sets = listClusterableSets().map((set) => ({
  slug: set.slug,
  kind: set.kind,
  ads: shuffled(set.items, set.slug).map((item) => ({ adId: item.adId, copy: item.copy, format: item.dna.format })),
}));

function send(res: ServerResponse, status: number, body: string, type = "application/json") {
  res.writeHead(status, { "Content-Type": type });
  res.end(body);
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf-8");
}

const labelPath = (slug: string) => join(LABELS_DIR, `${slug}.json`);

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  if (req.method === "GET" && url.pathname === "/") return send(res, 200, PAGE, "text/html; charset=utf-8");

  if (req.method === "GET" && url.pathname === "/api/sets") {
    const withStatus = sets.map((s) => ({ ...s, labelled: existsSync(labelPath(s.slug)) }));
    return send(res, 200, JSON.stringify(withStatus));
  }

  const match = url.pathname.match(/^\/api\/labels\/([a-z0-9-]+)$/);
  const set = match && sets.find((s) => s.slug === match[1]);
  if (match && !set) return send(res, 404, JSON.stringify({ error: "unknown set" }));

  if (set && req.method === "GET") {
    const path = labelPath(set.slug);
    return send(res, 200, existsSync(path) ? readFileSync(path, "utf-8") : "null");
  }

  if (set && req.method === "POST") {
    let body: unknown;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return send(res, 400, JSON.stringify({ error: "invalid JSON" }));
    }
    const parsed = labelFileSchema.safeParse({ ...(body as object), slug: set.slug, labeledAt: new Date().toISOString() });
    if (!parsed.success) return send(res, 400, JSON.stringify({ error: parsed.error.issues[0]?.message }));
    const problem = validateAgainstIds(parsed.data, set.ads.map((a) => a.adId));
    if (problem) return send(res, 400, JSON.stringify({ error: problem }));
    mkdirSync(LABELS_DIR, { recursive: true });
    writeFileSync(labelPath(set.slug), JSON.stringify(parsed.data, null, 2) + "\n");
    return send(res, 200, JSON.stringify({ ok: true }));
  }

  send(res, 404, JSON.stringify({ error: "not found" }));
});

server.listen(PORT, () => console.log(`Labelling tool: http://localhost:${PORT}`));

const PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Angler labelling</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body { font: 15px/1.45 system-ui, sans-serif; margin: 0; background: #f6f3ec; color: #1c1b19; }
  header { padding: 16px 24px; border-bottom: 1px solid #d9d3c5; background: #fffdf8; position: sticky; top: 0; z-index: 1; }
  h1 { font-size: 18px; margin: 0 0 6px; }
  .guide { color: #5b574f; max-width: 900px; margin: 0; }
  .bar { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-top: 10px; }
  select, input, button { font: inherit; padding: 6px 10px; border: 1px solid #bdb6a6; border-radius: 6px; background: #fff; }
  button { background: #1c1b19; color: #fff; cursor: pointer; }
  main { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; padding: 20px 24px; }
  .card { background: #fff; border: 2px solid #e4dfd3; border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
  .copy { white-space: pre-wrap; max-height: 220px; overflow: auto; }
  .meta { display: flex; justify-content: space-between; align-items: center; color: #6d685e; font-size: 13px; }
  .group { width: 56px; text-align: center; text-transform: uppercase; font-weight: 700; }
  #status { font-weight: 600; }
</style></head><body>
<header>
  <h1>Concept labelling (blind)</h1>
  <p class="guide">Give every ad a group letter. Use the <b>same letter</b> when Meta would likely treat the ads as
  <b>one concept</b>: same core hook, angle and promise, even if the wording differs. Use a <b>different letter</b> when the
  idea itself is different. Don't try to match any expected count: a set can be all one letter or all different.</p>
  <div class="bar">
    <select id="set"></select>
    <input id="labeler" placeholder="Your name" size="14">
    <button id="save">Save labels</button>
    <span id="status"></span>
  </div>
</header>
<main id="ads"></main>
<script>
const COLORS = ["#e8f0ff","#ffeede","#e4f7e9","#fbe4f1","#fff6cf","#e9e4ff","#dff6f6","#f3e9dc","#ffe1e1","#eef2d8"];
let sets = [];
const $ = (id) => document.getElementById(id);
const tint = (letter) => letter ? COLORS[(letter.charCodeAt(0) - 65) % COLORS.length] : "#fff";

async function loadSets(selected) {
  sets = await (await fetch("/api/sets")).json();
  $("set").innerHTML = sets.map((s) =>
    '<option value="' + s.slug + '">' + (s.labelled ? "✓ " : "· ") + s.slug + " (" + s.kind + ", " + s.ads.length + " ads)</option>").join("");
  if (selected) $("set").value = selected;
  await render();
}

async function render() {
  const set = sets.find((s) => s.slug === $("set").value);
  const existing = await (await fetch("/api/labels/" + set.slug)).json();
  const letterOf = {};
  if (existing) {
    $("labeler").value = $("labeler").value || existing.labeler;
    existing.groups.forEach((g, i) => g.forEach((id) => (letterOf[id] = String.fromCharCode(65 + i))));
  }
  $("ads").innerHTML = set.ads.map((ad, i) =>
    '<div class="card" data-id="' + ad.adId + '">' +
      '<div class="meta"><span>#' + (i + 1) + " · " + escapeHtml(ad.format) + '</span>' +
      '<input class="group" maxlength="1" value="' + (letterOf[ad.adId] || "") + '"></div>' +
      '<div class="copy">' + escapeHtml(ad.copy) + "</div></div>").join("");
  document.querySelectorAll(".card").forEach(paint);
  $("status").textContent = existing ? "Loaded saved labels" : "";
}

function paint(card) {
  const input = card.querySelector(".group");
  input.value = input.value.toUpperCase().replace(/[^A-Z]/g, "");
  card.style.background = tint(input.value);
}

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

$("ads").addEventListener("input", (e) => paint(e.target.closest(".card")));
$("set").addEventListener("change", render);
$("save").addEventListener("click", async () => {
  const byLetter = {};
  for (const card of document.querySelectorAll(".card")) {
    const letter = card.querySelector(".group").value;
    if (!letter) { $("status").textContent = "Every ad needs a letter."; return; }
    (byLetter[letter] ||= []).push(card.dataset.id);
  }
  const res = await fetch("/api/labels/" + $("set").value, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ labeler: $("labeler").value.trim(), groups: Object.values(byLetter) }),
  });
  const body = await res.json();
  $("status").textContent = res.ok ? "Saved ✓" : "Error: " + body.error;
  if (res.ok) await loadSets($("set").value);
});

loadSets();
</script></body></html>`;
