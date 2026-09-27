/**
 * Phase 18B — novelty, duplicate and contradiction assessment for learned knowledge.
 * Similarity is lexical-semantic (stemmed content terms, a design/media synonym map, phrase bigrams and numeric
 * awareness), compared against the session itself, existing teaching records and the live Knowledge Base as
 * retrieved by the Phase 17 pipeline. Contradictions are detected from opposite polarity on the same topic,
 * conflicting numbers for the same quantity, or conflicting planner guidance. Nothing is silently overwritten.
 */
import type { KnowledgeRecord, NoveltyAssessment, NoveltyClass } from "./training-types.js";

const STOP = new Set(("a an the and or but if then than that this these those of to in on at by for with from as is are was were be been being it its "
  + "into over under about above below up down out off again further once here there when where why how all any both each few more most other some such "
  + "only own same so too very can will just should would could may might must shall do does did doing have has had having i you he she we they them "
  + "their our your his her my me us what which who whom also per via e.g i.e etc").split(/\s+/));

const NEGATION = /\b(never|not|no|don'?t|do not|avoid|without|must not|should not|shouldn'?t|cannot|can'?t|isn'?t|aren'?t|stop|prevent|refrain)\b/i;
const POSITIVE = /\b(always|must|should|use|keep|ensure|make sure|prefer|do)\b/i;

const SYNONYMS: Record<string, string> = {
  colour: "color", colours: "color", hue: "color", typeface: "font", fonts: "font", lettering: "font", text: "text", copy: "text", wording: "text",
  headline: "headline", heading: "headline", title: "headline", cta: "cta", "call-to-action": "cta", button: "cta",
  product: "product", item: "product", merchandise: "product", photo: "image", picture: "image", photograph: "image", img: "image",
  clip: "video", footage: "video", film: "video", movie: "video", shot: "scene", slide: "scene", frame: "scene", scenes: "scene",
  cut: "transition", cuts: "transition", transition: "transition", dissolve: "transition", fade: "fade", music: "audio", soundtrack: "audio", song: "audio", track: "audio",
  beat: "beat", beats: "beat", rhythm: "beat", tempo: "bpm", bpm: "bpm", pace: "pacing", pacing: "pacing", timing: "pacing", duration: "pacing",
  crop: "crop", cropping: "crop", trim: "crop", framing: "framing", composition: "framing", placement: "framing", layout: "layout", spacing: "layout",
  margin: "layout", margins: "layout", whitespace: "layout", padding: "layout", legible: "readable", legibility: "readable", readable: "readable", readability: "readable",
  big: "large", huge: "large", bigger: "large", larger: "large", small: "small", tiny: "small", smaller: "small", zoom: "zoom", "push-in": "zoom", dolly: "zoom",
  begin: "start", beginning: "start", opening: "start", intro: "start", ending: "end", closing: "end", outro: "end", final: "end", last: "end",
};

function stem(word: string): string {
  let w = word;
  if (w.length > 5 && w.endsWith("ing")) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith("ies")) w = `${w.slice(0, -3)}y`;
  else if (w.length > 4 && w.endsWith("ed")) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith("es") && !w.endsWith("ses")) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
  return w;
}

export function terms(text: string): string[] {
  return String(text ?? "").toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .split(/[^a-z0-9%.'-]+/)
    .map((t) => t.replace(/^[.'-]+|[.'-]+$/g, ""))
    .filter((t) => t && !STOP.has(t) && !/^(never|not|no|don't|avoid|always|must|should)$/.test(t))
    .map((t) => SYNONYMS[t] ?? SYNONYMS[t.replace(/s$/, "")] ?? stem(t))
    .filter((t) => t.length > 1);
}

function vector(list: string[]): Map<string, number> {
  const v = new Map<string, number>();
  for (const t of list) v.set(t, (v.get(t) ?? 0) + 1);
  return v;
}

function cosine(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0; let na = 0; let nb = 0;
  for (const [k, x] of a) { na += x * x; const y = b.get(k); if (y) dot += x * y; }
  for (const y of b.values()) nb += y * y;
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

function bigrams(list: string[]): Set<string> {
  const s = new Set<string>();
  for (let i = 1; i < list.length; i += 1) s.add(`${list[i - 1]} ${list[i]}`);
  return s;
}

/** 0..1 lexical-semantic similarity. */
export function similarity(a: string, b: string): number {
  const ta = terms(a); const tb = terms(b);
  if (!ta.length || !tb.length) return 0;
  const cos = cosine(vector(ta), vector(tb));
  const ba = bigrams(ta); const bb = bigrams(tb);
  let inter = 0;
  for (const x of ba) if (bb.has(x)) inter += 1;
  const jac = ba.size + bb.size - inter ? inter / (ba.size + bb.size - inter) : 0;
  return Number((0.75 * cos + 0.25 * jac).toFixed(3));
}

export function polarity(text: string): "NEGATIVE" | "POSITIVE" | "NEUTRAL" {
  if (NEGATION.test(text)) return "NEGATIVE";
  if (POSITIVE.test(text)) return "POSITIVE";
  return "NEUTRAL";
}

/** Numbers with their unit and the two content terms before them, e.g. "3 item" with context "text scene". */
export function quantities(text: string): Array<{ value: number; unit: string; context: string }> {
  const out: Array<{ value: number; unit: string; context: string }> = [];
  const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  const re = /\b(\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:(?!of\b|or\b|and\b|to\b)[a-z-]{2,15}\s+)?(%|percent|ms|milliseconds?|s|sec|seconds?|px|bpm|items?|words?|lines?|scenes?|shots?|frames?|fps|colou?rs?|fonts?)\b/gi;
  for (const m of text.matchAll(re)) {
    const raw = m[1]!.toLowerCase();
    const value = words[raw] ?? Number(raw);
    let unit = m[2]!.toLowerCase().replace(/s$/, "");
    if (unit === "percent") unit = "%";
    if (unit === "sec" || unit === "second") unit = "s";
    if (unit === "millisecond") unit = "ms";
    const before = terms(text.slice(Math.max(0, (m.index ?? 0) - 60), m.index)).slice(-2).join(" ");
    const after = terms(text.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 40)).slice(0, 2).join(" ");
    out.push({ value, unit, context: `${before} ${after}`.trim() });
  }
  return out;
}

export interface ComparisonItem {
  id: string;
  title: string;
  text: string;
  kind: "SESSION" | "DATASET" | "KNOWLEDGE_BASE";
  guidance?: Array<{ key: string; value: number }>;
}

function contradiction(candidate: KnowledgeRecord, item: ComparisonItem, sim: number): string | null {
  for (const g of candidate.suggestedGuidance) {
    const other = item.guidance?.find((x) => x.key === g.key);
    if (other && other.value !== g.value) return `Sets ${g.key} to ${g.value}; "${item.title}" sets ${other.value}.`;
  }
  if (sim < 0.4) return null;
  const pa = polarity(candidate.statement); const pb = polarity(item.text);
  if (pa !== "NEUTRAL" && pb !== "NEUTRAL" && pa !== pb) return `Opposite advice on the same topic as "${item.title}".`;
  const qa = quantities(candidate.statement); const qb = quantities(item.text);
  for (const a of qa) {
    for (const b of qb) {
      if (a.unit === b.unit && a.value !== b.value && a.context && similarity(a.context, b.context) >= 0.5) {
        return `Gives ${a.value}${a.unit === "%" ? "%" : ` ${a.unit}`} where "${item.title}" gives ${b.value}${b.unit === "%" ? "%" : ` ${b.unit}`} for the same quantity.`;
      }
    }
  }
  return null;
}

export const NOVELTY_THRESHOLDS = { duplicate: 0.86, known: 0.68, partial: 0.38, lowConfidence: 0.45 };

/**
 * Assesses one candidate against the comparison pool. The pool must already be scoped (tenant/project) by
 * the caller so private knowledge of other projects is never compared or revealed.
 */
export function assessNovelty(candidate: KnowledgeRecord, pool: ComparisonItem[]): NoveltyAssessment {
  let best: { item: ComparisonItem; sim: number } | null = null;
  let conflict: { item: ComparisonItem; reason: string; sim: number } | null = null;
  const text = `${candidate.title}. ${candidate.statement}`;
  for (const item of pool) {
    const sim = Math.max(similarity(candidate.statement, item.text), similarity(text, `${item.title}. ${item.text}`));
    if (!best || sim > best.sim) best = { item, sim };
    const c = contradiction(candidate, item, sim);
    if (c && (!conflict || sim > conflict.sim)) conflict = { item, reason: c, sim };
  }
  const matched = (m: { item: ComparisonItem } | null) => (m ? { id: m.item.id, title: m.item.title, kind: m.item.kind, excerpt: m.item.text.slice(0, 220) } : null);
  const make = (cls: NoveltyClass, sim: number, m: { item: ComparisonItem } | null, reason: string): NoveltyAssessment => ({ class: cls, similarity: Number(sim.toFixed(3)), method: "LEXICAL_SEMANTIC", matched: matched(m), reason });

  if (candidate.flags.some((f) => f === "INSTRUCTION_LIKE_REMOVED" || f === "SECRET_REDACTED" || f === "DANGEROUS_CODE")) {
    return make("REQUIRES_REVIEW", best?.sim ?? 0, best, `Needs review: ${candidate.flags.join(", ").toLowerCase().replace(/_/g, " ")}.`);
  }
  // A near-identical twin in this session or dataset already carries any conflict review, so the candidate is its duplicate.
  const twin = best && best.sim >= NOVELTY_THRESHOLDS.duplicate && best.item.kind !== "KNOWLEDGE_BASE" && conflict?.item !== best.item;
  if (conflict && !twin) return make("CONTRADICTORY", conflict.sim, conflict, conflict.reason);
  if (best && best.sim >= NOVELTY_THRESHOLDS.duplicate && best.item.kind !== "KNOWLEDGE_BASE") {
    return make("DUPLICATE", best.sim, best, best.item.kind === "SESSION" ? "Same knowledge was extracted from another part of this material." : "Already taught in this dataset.");
  }
  if (best && best.sim >= NOVELTY_THRESHOLDS.known) return make("KNOWN", best.sim, best, "The AI already has equivalent knowledge.");
  if (candidate.confidence < NOVELTY_THRESHOLDS.lowConfidence) return make("LOW_CONFIDENCE", best?.sim ?? 0, best, `Extraction confidence ${candidate.confidence.toFixed(2)} is below ${NOVELTY_THRESHOLDS.lowConfidence}.`);
  if (best && best.sim >= NOVELTY_THRESHOLDS.partial) return make("PARTIALLY_NEW", best.sim, best, "Related knowledge exists; this adds detail or a variation.");
  return make("NEW", best?.sim ?? 0, best, best ? "No equivalent knowledge was found." : "Nothing comparable exists yet.");
}
