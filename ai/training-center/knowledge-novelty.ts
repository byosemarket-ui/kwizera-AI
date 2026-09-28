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

export interface PatternRef {
  family: string;
  parameters: Record<string, unknown>;
}

export interface ComparisonItem {
  id: string;
  title: string;
  text: string;
  kind: "SESSION" | "DATASET" | "KNOWLEDGE_BASE";
  guidance?: Array<{ key: string; value: number }>;
  /** Phase 18D — structured creative pattern carried by the item (compared structurally, not lexically). */
  pattern?: PatternRef | null;
  /** The item's knowledge statement alone (without provenance text), used to recognise an extension of it. */
  statement?: string;
}

/** The parameters that make two patterns of one family the same creative choice (numbers bucketed). */
const SIGNATURE_KEYS: Record<string, string[]> = {
  TRANSITION: ["transition", "position"], CAMERA: ["movement", "role"], HOOK: ["movement", "subjectVisible", "textPresent"],
  REVEAL: ["transition", "movement"], SHOWCASE: ["movement"], CTA: ["textBand"], PACING: ["sceneCount", "meanShotSec", "rule", "direction"],
  TYPOGRAPHY_TIMING: ["band"], AUDIO_SYNC: ["alignTo"], STORYTELLING: ["sequence"], MUSIC_TEMPO: ["bpm", "energyLevel"],
  MUSIC_STRUCTURE: ["sequence"], LAYOUT: ["subjectPlacement", "textSafeSide"], TYPOGRAPHY_LAYOUT: ["headlinePosition", "ctaBand", "textSide"],
  COLOR_CONTRAST: ["contrastClass"], CREATIVE_PROFILE: ["signature"],
};

function bucket(key: string, v: unknown): string {
  if (typeof v !== "number") return String(v ?? "");
  if (key === "bpm") return String(Math.round(v / 5) * 5);
  if (key === "meanShotSec") return String(Math.round(v * 2) / 2);
  return String(Math.round(v * 100) / 100);
}

export function patternSignature(p: PatternRef): string {
  const params = p.parameters ?? {};
  const derived: Record<string, unknown> = { ...params };
  if (p.family === "AUDIO_SYNC" && derived.alignTo === undefined) {
    const on = Number(params.onBeatRatio ?? 0);
    derived.alignTo = Number(params.downbeatRatio ?? 0) >= 0.5 ? "DOWNBEAT" : on >= 0.6 ? "BEAT" : "FREE";
  }
  return `${p.family}:${(SIGNATURE_KEYS[p.family] ?? []).map((k) => `${k}=${bucket(k, derived[k])}`).join("|")}`;
}

const storySteps = (p: PatternRef): string[] =>
  String(p.parameters?.sequence ?? "").split(">").map((s) => s.trim().toUpperCase()).filter(Boolean).map((s) => (s === "REVEAL" ? "PRODUCT_REVEAL" : s));

/** Stated rules that cannot both hold: the same scene followed by different ones, or opposite energy→pacing directions. */
export function ruleConflict(a: PatternRef, b: PatternRef): boolean {
  const pa = a.parameters ?? {}; const pb = b.parameters ?? {};
  if (a.family !== b.family) return false;
  if (a.family === "STORYTELLING" && pa.after !== undefined && pa.next !== undefined && pb.after !== undefined && pb.next !== undefined) {
    const norm = (v: unknown) => (String(v).toUpperCase() === "REVEAL" ? "PRODUCT_REVEAL" : String(v).toUpperCase());
    return norm(pa.after) === norm(pb.after) && norm(pa.next) !== norm(pb.next);
  }
  if (a.family === "PACING" && pa.rule === "ENERGY_PACING" && pb.rule === "ENERGY_PACING") return pa.direction !== pb.direction;
  return false;
}

/** True when a's story order contains b's order as consecutive steps and adds at least one more. */
export function extendsSequence(a: PatternRef, b: PatternRef): boolean {
  const sa = storySteps(a); const sb = storySteps(b);
  if (sb.length < 2 || sa.length <= sb.length) return false;
  for (let i = 0; i + sb.length <= sa.length; i += 1) if (sb.every((s, j) => sa[i + j] === s)) return true;
  return false;
}

function numericClose(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  for (const [k, v] of Object.entries(a)) {
    const w = b[k];
    if (typeof v !== "number" || typeof w !== "number") continue;
    const scale = Math.max(Math.abs(v), Math.abs(w), 1e-6);
    if (Math.abs(v - w) / scale > 0.15) return false;
  }
  return true;
}

/**
 * Words that say WHEN advice applies. Advice for different contexts ("calm" vs "high-energy") is a contextual
 * variation to keep side by side, not a contradiction.
 */
const CONTEXT_GROUPS: Array<{ id: string; re: RegExp }> = [
  { id: "calm", re: /\b(calm|relaxed|relaxing|slow|gentle|soft|quiet|serene|elegant|luxury|luxurious|premium|minimal(?:ist)?)\b/i },
  { id: "energetic", re: /\b(high[- ]energy|energetic|upbeat|fast[- ]paced|fast|dynamic|hype|intense|aggressive|punchy|sporty)\b/i },
  { id: "vertical", re: /\b(vertical|9:16|portrait|tiktok|reels?|shorts)\b/i },
  { id: "horizontal", re: /\b(horizontal|16:9|landscape|widescreen|youtube)\b/i },
  { id: "square", re: /\b(square|1:1)\b/i },
  { id: "short-form", re: /\b(short[- ]form|under \d+ ?s(?:econds)?|15[- ]second|short videos?)\b/i },
  { id: "long-form", re: /\b(long[- ]form|long videos?)\b/i },
  { id: "dark", re: /\b(dark|night|low[- ]key|moody)\b/i },
  { id: "bright", re: /\b(bright|light background|high[- ]key|white background)\b/i },
];
const OPPOSED: Array<[string, string]> = [["calm", "energetic"], ["vertical", "horizontal"], ["vertical", "square"], ["horizontal", "square"], ["short-form", "long-form"], ["dark", "bright"]];

export function contexts(text: string): string[] {
  return CONTEXT_GROUPS.filter((g) => g.re.test(text)).map((g) => g.id);
}

/** Non-null when the two statements apply to different contexts (e.g. calm vs high-energy videos). */
export function contextualVariation(a: string, b: string): { mine: string[]; theirs: string[] } | null {
  const ca = contexts(a); const cb = contexts(b);
  if (!ca.length || !cb.length) return null;
  const differs = OPPOSED.some(([x, y]) => (ca.includes(x) && cb.includes(y) && !ca.includes(y)) || (ca.includes(y) && cb.includes(x) && !ca.includes(x)));
  return differs ? { mine: ca, theirs: cb } : null;
}

/** The context a rule was stated for: a leading "For luxury jewelry, …" or the "(for luxury jewelry)" suffix of a pattern description. */
export function statedScope(text: string): string | null {
  const m = /^\s*(?:for|in|on|with)\s+([^,]{3,60}),/i.exec(text) ?? /\(for ([^)]{3,60})\)\s*\.?\s*$/i.exec(text);
  return m?.[1]?.trim().toLowerCase().replace(/\s+/g, " ") ?? null;
}

function contradiction(candidate: KnowledgeRecord, item: ComparisonItem, sim: number): string | null {
  for (const g of candidate.suggestedGuidance) {
    const other = item.guidance?.find((x) => x.key === g.key);
    if (other && other.value !== g.value) return `Sets ${g.key} to ${g.value}; "${item.title}" sets ${other.value}.`;
  }
  if (sim < 0.4) return null;
  if (contextualVariation(candidate.statement, item.text)) return null;
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
  const ownPattern = candidate.structuredData?.creativePattern as PatternRef | undefined;
  if (ownPattern && typeof ownPattern === "object" && ownPattern.family) {
    const structural = assessPattern(candidate, ownPattern, pool);
    if (structural) return structural;
    pool = pool.filter((p) => !p.pattern);
  }
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
  const variation = best && best.sim >= NOVELTY_THRESHOLDS.partial ? contextualVariation(candidate.statement, best.item.text) : null;
  if (variation && candidate.confidence >= NOVELTY_THRESHOLDS.lowConfidence) {
    return make("PARTIALLY_NEW", best!.sim, best, `Contextual variation: this applies to ${variation.mine.join("/")} content, "${best!.item.title.slice(0, 80)}" to ${variation.theirs.join("/")}; both are kept with their context.`);
  }
  if (best?.item.statement && best.item.kind !== "KNOWLEDGE_BASE" && best.sim >= NOVELTY_THRESHOLDS.partial
    && enrichesStatement(best.item.statement, candidate.canonicalStatement || candidate.statement)) {
    return make("PARTIALLY_NEW", best.sim, best, `Extends "${best.item.title.slice(0, 80)}" with new detail; committing enriches that record and keeps its previous wording.`);
  }
  if (best && best.sim >= NOVELTY_THRESHOLDS.duplicate && best.item.kind !== "KNOWLEDGE_BASE") {
    return make("DUPLICATE", best.sim, best, best.item.kind === "SESSION" ? "Same knowledge was extracted from another part of this material." : "Already taught in this dataset.");
  }
  if (best && best.sim >= NOVELTY_THRESHOLDS.known) return make("KNOWN", best.sim, best, "The AI already has equivalent knowledge.");
  if (candidate.confidence < NOVELTY_THRESHOLDS.lowConfidence) return make("LOW_CONFIDENCE", best?.sim ?? 0, best, `Extraction confidence ${candidate.confidence.toFixed(2)} is below ${NOVELTY_THRESHOLDS.lowConfidence}.`);
  if (best && best.sim >= NOVELTY_THRESHOLDS.partial) return make("PARTIALLY_NEW", best.sim, best, "Related knowledge exists; this adds detail or a variation.");
  return make("NEW", best?.sim ?? 0, best, best ? "No equivalent knowledge was found." : "Nothing comparable exists yet.");
}

/**
 * Creative patterns are compared by family and the parameters that define the creative choice, so "push-in on the
 * hook" and "pull-out on the hook" are different patterns even though their descriptions read alike. Returns null
 * when no pattern of the same family is known (the caller then compares the text).
 */
function assessPattern(candidate: KnowledgeRecord, own: PatternRef, pool: ComparisonItem[]): NoveltyAssessment | null {
  const sameFamily = pool.filter((p) => p.pattern && p.pattern.family === own.family);
  if (!sameFamily.length) return null;
  const sig = patternSignature(own);
  const make = (cls: NoveltyClass, item: ComparisonItem | null, sim: number, reason: string): NoveltyAssessment => ({
    class: cls, similarity: sim, method: "STRUCTURAL_PATTERN", reason,
    matched: item ? { id: item.id, title: item.title, kind: item.kind, excerpt: item.text.slice(0, 220) } : null,
  });
  if (candidate.flags.some((f) => f === "INSTRUCTION_LIKE_REMOVED" || f === "SECRET_REDACTED")) return make("REQUIRES_REVIEW", null, 0, `Needs review: ${candidate.flags.join(", ").toLowerCase().replace(/_/g, " ")}.`);
  const order = (k: ComparisonItem["kind"]) => (k === "SESSION" ? 0 : k === "DATASET" ? 1 : 2);
  const family = own.family.toLowerCase().replace(/_/g, " ");
  const conflict = sameFamily.find((p) => ruleConflict(own, p.pattern!));
  if (conflict) {
    const mine = statedScope(candidate.statement) ?? statedScope(candidate.canonicalStatement ?? "");
    const theirs = statedScope(conflict.statement ?? "") ?? statedScope(conflict.text);
    const variation = mine !== theirs && (mine || theirs)
      ? { mine: [mine ?? "general"], theirs: [theirs ?? "general"] }
      : contextualVariation(candidate.canonicalStatement || candidate.statement, conflict.statement ?? conflict.text);
    return variation
      ? make("PARTIALLY_NEW", conflict, 0.7, `Contextual variation of "${conflict.title.slice(0, 80)}" (${variation.mine.join(", ")} vs ${variation.theirs.join(", ")}); both stay available for their own context.`)
      : make("REQUIRES_REVIEW", conflict, 0.8, `Contradicts the learned ${family} rule "${conflict.title.slice(0, 80)}"; it is not activated automatically.`);
  }
  const extended = own.family === "STORYTELLING" ? sameFamily.find((p) => extendsSequence(own, p.pattern!)) : undefined;
  if (extended) return make("PARTIALLY_NEW", extended, 0.75, `Extends the learned story order "${extended.title.slice(0, 80)}" with more steps; the earlier order stays intact.`);
  const same = sameFamily.filter((p) => patternSignature(p.pattern!) === sig).sort((a, b) => order(a.kind) - order(b.kind));
  if (same.length) {
    const exact = same.find((p) => numericClose(own.parameters ?? {}, p.pattern!.parameters ?? {}));
    if (exact) return make("DUPLICATE", exact, 1, exact.kind === "SESSION" ? `Same ${family} pattern was measured elsewhere in this material.` : `The same ${family} pattern is already learned ("${exact.title.slice(0, 80)}").`);
    return make("KNOWN", same[0]!, 0.9, `The same ${family} choice is already learned ("${same[0]!.title.slice(0, 80)}"); only measured values differ, so it supports the existing pattern.`);
  }
  if (candidate.confidence < NOVELTY_THRESHOLDS.lowConfidence) return make("LOW_CONFIDENCE", sameFamily[0]!, 0.5, `Measurement confidence ${candidate.confidence.toFixed(2)} is below ${NOVELTY_THRESHOLDS.lowConfidence}.`);
  return make("NEW", sameFamily[0]!, 0.5, `New ${family} variation; ${sameFamily.length} other ${family} pattern(s) are known and stay available, so planners can vary between them.`);
}

/**
 * True when the new statement keeps everything the existing one says and adds to it (e.g. "Keep the product
 * centred" → "Keep the product centred while leaving text-safe space on the right").
 */
export function enrichesStatement(existing: string, next: string): boolean {
  const a = new Set(terms(existing));
  const b = new Set(terms(next));
  if (a.size < 2 || b.size <= a.size) return false;
  let kept = 0;
  for (const t of a) if (b.has(t)) kept += 1;
  return kept / a.size >= 0.8 && polarity(existing) === polarity(next) && !contextualVariation(existing, next);
}
