// Models are prompted for "raw JSON only," but occasionally wrap output in
// markdown fences or add a stray sentence. Parsing the raw string directly would
// throw and burn the retry budget. This helper tolerates both before JSON.parse.

export function parseModelJSON(text: string): unknown {
  let t = text.trim();

  // Strip a surrounding ```json ... ``` (or bare ```) fence if present.
  const fenced = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) t = fenced[1].trim();

  // Slice to the outermost JSON object/array in case of leading/trailing prose.
  const starts = [t.indexOf("{"), t.indexOf("[")].filter((i) => i !== -1);
  const start = starts.length ? Math.min(...starts) : -1;
  const end = Math.max(t.lastIndexOf("}"), t.lastIndexOf("]"));
  if (start !== -1 && end > start) t = t.slice(start, end + 1);

  return JSON.parse(t);
}
