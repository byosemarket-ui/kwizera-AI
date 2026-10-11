/**
 * Validate / sanitize model claims against the evidence pack.
 * Strips unsupported knowledge citations and neutralizes invented pattern names.
 * Never invents SL/TP/entry — decision engines remain source of truth for those.
 */
import type { ForexAiAnalysis, ForexAiScenario } from "../types.js";
import type { ForexDecisionAnalysis } from "../decision/types.js";
import type { ForexMtfAiAnalysis } from "../mtf/types.js";
import type { ForexAiEvidencePack } from "./types.js";

/** Known candlestick pattern display names / ids from Phase 38C. */
const KNOWN_PATTERN_TOKENS = [
  "doji",
  "hammer",
  "shooting star",
  "shooting_star",
  "bullish engulfing",
  "bearish engulfing",
  "bullish_engulfing",
  "bearish_engulfing",
  "morning star",
  "evening star",
  "morning_star",
  "evening_star",
] as const;

function allowedKnowledgeKeys(pack: ForexAiEvidencePack): {
  titles: Set<string>;
  docIds: Set<string>;
  chunkIds: Set<string>;
  pairs: Set<string>;
} {
  const titles = new Set<string>();
  const docIds = new Set<string>();
  const chunkIds = new Set<string>();
  const pairs = new Set<string>();
  for (const k of pack.knowledge) {
    titles.add(k.title.toLowerCase());
    docIds.add(k.documentId.toLowerCase());
    chunkIds.add(k.chunkId.toLowerCase());
    pairs.add(`${k.documentId}:${k.chunkId}`.toLowerCase());
  }
  return { titles, docIds, chunkIds, pairs };
}

function allowedPatternTokens(pack: ForexAiEvidencePack): Set<string> {
  const set = new Set<string>();
  for (const p of pack.patterns.detections) {
    set.add(p.id.toLowerCase());
    set.add(p.name.toLowerCase());
    set.add(p.name.toLowerCase().replace(/\s+/g, "_"));
  }
  return set;
}

function citesUnknownKnowledge(
  text: string,
  allowed: ReturnType<typeof allowedKnowledgeKeys>,
): boolean {
  if (!text || allowed.pairs.size === 0 && !/\b(knowledge|document|chunk|cite|citation|source)\b/i.test(text)) {
    // If pack has no knowledge, still check for invented doc/chunk ids shaped like refs.
    if (allowed.pairs.size === 0) {
      return /knowledge:[a-z0-9_-]+:[a-z0-9_-]+/i.test(text)
        || /\bdoc(?:ument)?[-_:][a-z0-9_-]{4,}/i.test(text)
        || /\bchunk[-_:][a-z0-9_-]{4,}/i.test(text);
    }
  }

  // Explicit knowledge:doc:chunk refs
  const idRefs = text.match(/knowledge:([a-zA-Z0-9_-]+):([a-zA-Z0-9_-]+)/g) ?? [];
  for (const ref of idRefs) {
    const key = ref.replace(/^knowledge:/i, "").toLowerCase();
    if (!allowed.pairs.has(key)) return true;
  }

  // Title mentions when model says "according to …" / "per knowledge …"
  const citeMatch = text.match(
    /(?:according to|per|from|citing|knowledge(?:\s+source)?)\s+[«"']?([A-Za-z0-9][^«"'.;,]{2,80})/i,
  );
  if (citeMatch?.[1]) {
    const title = citeMatch[1].trim().toLowerCase();
    if (allowed.titles.size > 0 && ![...allowed.titles].some((t) => title.includes(t) || t.includes(title))) {
      return true;
    }
    if (allowed.titles.size === 0) return true;
  }

  return false;
}

function inventsUnsupportedPattern(
  text: string,
  allowed: Set<string>,
): string | null {
  const lower = text.toLowerCase();
  for (const token of KNOWN_PATTERN_TOKENS) {
    if (!lower.includes(token)) continue;
    const normalized = token.replace(/\s+/g, "_");
    const inPack = allowed.has(token) || allowed.has(normalized)
      || [...allowed].some((a) => a.includes(token) || token.includes(a));
    if (!inPack) return token;
  }
  return null;
}

function neutralizePatternMentions(text: string, invented: string): string {
  const re = new RegExp(invented.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
  return text.replace(re, "unsupported-pattern-claim");
}

function stripKnowledgeCiteLine(text: string): string {
  return text
    .replace(/knowledge:[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+/g, "[unsupported-knowledge-ref]")
    .replace(
      /(?:according to|per|from|citing|knowledge(?:\s+source)?)\s+[«"']?[A-Za-z0-9][^«"'.;,]{2,80}/gi,
      "[unsupported knowledge citation removed]",
    );
}

function sanitizeTextField(
  text: string,
  pack: ForexAiEvidencePack,
  stripped: string[],
): string {
  let next = text;
  const allowedK = allowedKnowledgeKeys(pack);
  if (citesUnknownKnowledge(next, allowedK)) {
    stripped.push(`unsupported-knowledge:${next.slice(0, 80)}`);
    next = stripKnowledgeCiteLine(next);
  }
  const allowedP = allowedPatternTokens(pack);
  const invented = inventsUnsupportedPattern(next, allowedP);
  if (invented) {
    stripped.push(`unsupported-pattern:${invented}`);
    next = neutralizePatternMentions(next, invented);
  }
  return next;
}

function sanitizeScenario(
  scenario: ForexAiScenario,
  pack: ForexAiEvidencePack,
  stripped: string[],
): ForexAiScenario {
  return {
    ...scenario,
    reasoning: sanitizeTextField(scenario.reasoning, pack, stripped),
    conditions: scenario.conditions.map((c) => sanitizeTextField(c, pack, stripped)),
    confirmation: scenario.confirmation.map((c) => sanitizeTextField(c, pack, stripped)),
    invalidation: scenario.invalidation.map((c) => sanitizeTextField(c, pack, stripped)),
    supportingFacts: scenario.supportingFacts?.map((c) => sanitizeTextField(c, pack, stripped)),
  };
}

export function sanitizeAnalysisAgainstEvidence(
  analysis: ForexAiAnalysis,
  pack: ForexAiEvidencePack,
): { analysis: ForexAiAnalysis; strippedClaims: string[] } {
  const strippedClaims: string[] = [];
  const next: ForexAiAnalysis = {
    ...analysis,
    summary: sanitizeTextField(analysis.summary, pack, strippedClaims),
    reasoning: sanitizeTextField(analysis.reasoning, pack, strippedClaims),
    observedFacts: analysis.observedFacts.map((f) => sanitizeTextField(f, pack, strippedClaims)),
    scenarios: analysis.scenarios.map((s) => sanitizeScenario(s, pack, strippedClaims)),
    limitations: [...analysis.limitations],
  };

  const patternStrips = strippedClaims.filter((c) => c.startsWith("unsupported-pattern:"));
  if (patternStrips.length) {
    next.limitations = [
      ...next.limitations,
      "Model cited candlestick pattern(s) not present in DETECTOR_EVIDENCE; unsupported pattern claims neutralized.",
    ].filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 16);

    // Neutralize summary/observedFacts already done; ensure trend-like bullish invent from empty pack is limited
    if (pack.patterns.detections.length === 0 && pack.insufficientHistory) {
      if (/bullish|bearish/i.test(next.summary) && /pattern|doji|hammer|engulf/i.test(next.summary)) {
        next.summary = "Detector evidence insufficient — pattern-based directional claims withheld.";
      }
    }
  }

  const knowledgeStrips = strippedClaims.filter((c) => c.startsWith("unsupported-knowledge:"));
  if (knowledgeStrips.length) {
    next.limitations = [
      ...next.limitations,
      "Model cited knowledge titles/ids not present in the evidence pack; unsupported citations removed.",
    ].filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 16);
  }

  next.evidencePack = pack;
  next.evidenceSchemaVersion = pack.schemaVersion;

  return { analysis: next, strippedClaims };
}

/** Sanitize decision AI interpretation against evidence (leave SL/TP/entry untouched). */
export function sanitizeDecisionAgainstEvidence(
  analysis: ForexDecisionAnalysis,
  pack: ForexAiEvidencePack,
): { analysis: ForexDecisionAnalysis; strippedClaims: string[] } {
  const strippedClaims: string[] = [];
  const next: ForexDecisionAnalysis = {
    ...analysis,
    aiInterpretation: analysis.aiInterpretation
      ? sanitizeTextField(analysis.aiInterpretation, pack, strippedClaims)
      : null,
    limitations: [...analysis.limitations],
    evidencePack: pack,
    evidenceSchemaVersion: pack.schemaVersion,
  };

  if (strippedClaims.some((c) => c.startsWith("unsupported-knowledge:"))) {
    next.limitations.push(
      "Model cited knowledge not in DETECTOR_EVIDENCE / KNOWLEDGE_IDS; unsupported citations removed.",
    );
  }
  if (strippedClaims.some((c) => c.startsWith("unsupported-pattern:"))) {
    next.limitations.push(
      "Model cited pattern(s) absent from detector evidence; unsupported claims neutralized.",
    );
  }
  next.limitations = next.limitations.filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 16);
  return { analysis: next, strippedClaims };
}

/** Light sanitize for MTF narrative fields. */
export function sanitizeMtfAgainstEvidence(
  analysis: ForexMtfAiAnalysis,
  pack: ForexAiEvidencePack,
): { analysis: ForexMtfAiAnalysis; strippedClaims: string[] } {
  const strippedClaims: string[] = [];
  const next: ForexMtfAiAnalysis = {
    ...analysis,
    scenarios: analysis.scenarios.map((s) => ({
      ...s,
      reasoning: sanitizeTextField(s.reasoning, pack, strippedClaims),
    })),
    timeframeAnalysis: analysis.timeframeAnalysis.map((t) => ({
      ...t,
      interpretation: sanitizeTextField(t.interpretation, pack, strippedClaims),
    })),
    limitations: [...analysis.limitations],
    evidencePack: pack,
    evidenceSchemaVersion: pack.schemaVersion,
  };
  if (strippedClaims.length) {
    next.limitations.push(
      "Some model claims were stripped because they were not grounded in DETECTOR_EVIDENCE.",
    );
    next.limitations = next.limitations.filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 16);
  }
  return { analysis: next, strippedClaims };
}
