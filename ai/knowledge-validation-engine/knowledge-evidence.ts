/**
 * Phase 17 — Knowledge validation evidence, prompt-injection screening and contradiction detection.
 * Validation here checks provenance and extraction quality; it never claims the content is factually true.
 */
import type { SourceTrust } from "../knowledge-retrieval-engine/knowledge-taxonomy.js";

export type KnowledgeValidationStatus = "VALIDATED" | "NEEDS_REVIEW" | "REJECTED";

export interface KnowledgeValidationEvidence {
  status: KnowledgeValidationStatus;
  checks: {
    extractionQuality: "OK" | "LOW";
    provenance: "COMPLETE" | "PARTIAL";
    instructionLikeText: number;
    duplicate: boolean;
  };
  reasons: string[];
  /** Always NOT_PERFORMED: the pipeline extracts and screens content, it does not fact-check it. */
  factualVerification: "NOT_PERFORMED";
  validatedAt: string;
}

const INJECTION_PATTERNS: Array<{ id: string; re: RegExp }> = [
  { id: "ignore-instructions", re: /\b(ignore|disregard|forget|override)\b[^.\n]{0,40}\b(previous|prior|above|all|system|earlier)\b[^.\n]{0,20}\b(instructions?|prompts?|rules?|messages?)\b/i },
  { id: "role-hijack", re: /\byou are now\b|\bact as (an? )?(system|developer|admin)\b|\bnew instructions?\s*:/i },
  { id: "system-prompt", re: /\b(system|developer) (prompt|message|instructions?)\b/i },
  { id: "chat-markup", re: /<\|?(im_start|im_end|system|assistant|user)\|?>|^\s*(system|assistant|developer)\s*:/im },
  { id: "exfiltration", re: /\b(reveal|print|send|leak|exfiltrate)\b[^.\n]{0,40}\b(api[ _-]?keys?|secrets?|passwords?|credentials?|tokens?|env(ironment)? variables?)\b/i },
  { id: "command-exec", re: /\b(run|execute)\s+(this |the following )?(command|shell|powershell|bash|script)\b|\brm\s+-rf\b|\bcurl\s+[^\s]+\s*\|\s*(sh|bash)\b/i },
  { id: "tool-call", re: /"(tool|function)_?call"\s*:|\bcall the (tool|function)\b/i },
  { id: "script-tag", re: /<\/?script\b/i },
];

export function detectInstructionLikeText(text: string): string[] {
  return INJECTION_PATTERNS.filter((p) => p.re.test(text)).map((p) => p.id);
}

/**
 * Makes untrusted source text safe to place inside a prompt as quoted reference data:
 * strips chat/role markup, control characters and fences, and redacts instruction-like sentences.
 */
export function neutralizeUntrustedText(text: string, maxChars = 1_200): string {
  let out = String(text ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/<\|?(im_start|im_end|system|assistant|user)\|?>/gi, "")
    .replace(/```+/g, "'''")
    .replace(/<\/?(script|style|iframe)[^>]*>/gi, "")
    .replace(/^\s*(system|assistant|developer|user)\s*:/gim, "");
  out = out
    .split(/(?<=[.!?\n])\s+/)
    .map((sentence) => (detectInstructionLikeText(sentence).length ? "[instruction-like text removed]" : sentence))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return out.length > maxChars ? `${out.slice(0, maxChars - 1).trimEnd()}…` : out;
}

export function extractionQuality(text: string): "OK" | "LOW" {
  const compact = text.replace(/\s+/g, "");
  if (compact.length < 60) return "LOW";
  const letters = (compact.match(/\p{L}/gu) ?? []).length;
  if (letters / compact.length < 0.55) return "LOW";
  if (/(.)\1{12,}/.test(compact)) return "LOW";
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 10) return "LOW";
  return "OK";
}

export function validateKnowledgeChunk(input: {
  text: string;
  provenance: { sourceId?: string; title?: string; url?: string | null; retrievedAt?: string; sourceType?: string };
  duplicate?: boolean;
  now?: Date;
}): KnowledgeValidationEvidence {
  const reasons: string[] = [];
  const quality = extractionQuality(input.text);
  const injection = detectInstructionLikeText(input.text);
  const provenanceComplete = Boolean(input.provenance.sourceId && input.provenance.title && input.provenance.retrievedAt && input.provenance.sourceType);
  if (quality === "LOW") reasons.push("Extracted text is too short or noisy to be useful.");
  if (!provenanceComplete) reasons.push("Source provenance is incomplete.");
  if (injection.length) reasons.push(`Instruction-like text detected (${injection.join(", ")}); content is data only.`);
  if (input.duplicate) reasons.push("Content duplicates existing knowledge; linked instead of stored again.");
  let status: KnowledgeValidationStatus = "VALIDATED";
  if (!provenanceComplete || quality === "LOW") status = "REJECTED";
  else if (injection.length) status = "NEEDS_REVIEW";
  return {
    status,
    checks: {
      extractionQuality: quality,
      provenance: provenanceComplete ? "COMPLETE" : "PARTIAL",
      instructionLikeText: injection.length,
      duplicate: Boolean(input.duplicate),
    },
    reasons,
    factualVerification: "NOT_PERFORMED",
    validatedAt: (input.now ?? new Date()).toISOString(),
  };
}

/** Structured, bounded parameter a knowledge item can suggest to a planner (e.g. audio.fadeOutSec = 2). */
export interface KnowledgeGuidance {
  key: string;
  value: number | string | boolean;
  note?: string;
}

export interface GuidanceCandidate {
  itemId: string;
  sourceId: string;
  title: string;
  trust: SourceTrust;
  publicationDate?: string | null;
  supersedes?: string[];
  guidance: KnowledgeGuidance[];
}

export interface KnowledgeDisagreement {
  key: string;
  positions: Array<{ value: KnowledgeGuidance["value"]; itemId: string; sourceId: string; title: string; trust: SourceTrust; publicationDate?: string | null }>;
  resolution: "HIGHER_AUTHORITY" | "SUPERSEDED" | "UNRESOLVED";
  note: string;
}

const AUTHORITY: Record<SourceTrust, number> = { TRUSTED: 4, VERIFIED: 3, UNVERIFIED: 2, LOW_CONFIDENCE: 1, REJECTED: 0 };

/** Finds guidance keys where sources give different values. Nothing is silently picked. */
export function detectDisagreements(candidates: GuidanceCandidate[]): KnowledgeDisagreement[] {
  const byKey = new Map<string, KnowledgeDisagreement["positions"]>();
  for (const candidate of candidates) {
    for (const g of candidate.guidance) {
      const list = byKey.get(g.key) ?? [];
      list.push({
        value: g.value,
        itemId: candidate.itemId,
        sourceId: candidate.sourceId,
        title: candidate.title,
        trust: candidate.trust,
        publicationDate: candidate.publicationDate ?? null,
      });
      byKey.set(g.key, list);
    }
  }
  const superseded = new Set(candidates.flatMap((c) => c.supersedes ?? []));
  const out: KnowledgeDisagreement[] = [];
  for (const [key, positions] of byKey) {
    const values = new Set(positions.map((p) => JSON.stringify(p.value)));
    if (values.size < 2) continue;
    const live = positions.filter((p) => !superseded.has(p.sourceId));
    const liveValues = new Set(live.map((p) => JSON.stringify(p.value)));
    if (live.length && liveValues.size === 1) {
      out.push({ key, positions, resolution: "SUPERSEDED", note: "One source explicitly supersedes the other." });
      continue;
    }
    const top = Math.max(...live.map((p) => AUTHORITY[p.trust]));
    const topValues = new Set(live.filter((p) => AUTHORITY[p.trust] === top).map((p) => JSON.stringify(p.value)));
    out.push(topValues.size === 1
      ? { key, positions, resolution: "HIGHER_AUTHORITY", note: "Sources disagree; the higher-trust source is preferred and the disagreement is kept." }
      : { key, positions, resolution: "UNRESOLVED", note: "Equally trusted sources disagree; the system default is used." });
  }
  return out;
}

export interface GuidanceSpec {
  key: string;
  min?: number;
  max?: number;
  default: number | string | boolean;
}

export interface ResolvedGuidance {
  key: string;
  value: number | string | boolean;
  basis: "KNOWLEDGE" | "DEFAULT" | "DISPUTED_DEFAULT";
  sourceItemIds: string[];
  clamped: boolean;
}

/**
 * Resolves guidance for planners. Only VERIFIED/TRUSTED items may steer a planner; values are clamped to the
 * planner's own safe range so knowledge never overrides rendering or measurement constraints.
 */
export function resolveGuidance(candidates: GuidanceCandidate[], specs: GuidanceSpec[]): { values: ResolvedGuidance[]; disagreements: KnowledgeDisagreement[] } {
  const eligible = candidates.filter((c) => c.trust === "TRUSTED" || c.trust === "VERIFIED");
  const disagreements = detectDisagreements(eligible);
  const superseded = new Set(eligible.flatMap((c) => c.supersedes ?? []));
  const values = specs.map<ResolvedGuidance>((spec) => {
    const positions = eligible
      .filter((c) => !superseded.has(c.sourceId))
      .flatMap((c) => c.guidance.filter((g) => g.key === spec.key).map((g) => ({ c, g })));
    if (!positions.length) return { key: spec.key, value: spec.default, basis: "DEFAULT", sourceItemIds: [], clamped: false };
    const top = Math.max(...positions.map((p) => AUTHORITY[p.c.trust]));
    const best = positions.filter((p) => AUTHORITY[p.c.trust] === top);
    const distinct = new Set(best.map((p) => JSON.stringify(p.g.value)));
    if (distinct.size > 1) {
      return { key: spec.key, value: spec.default, basis: "DISPUTED_DEFAULT", sourceItemIds: best.map((p) => p.c.itemId), clamped: false };
    }
    let value = best[0].g.value;
    let clamped = false;
    if (typeof spec.default === "number") {
      const n = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(n)) return { key: spec.key, value: spec.default, basis: "DEFAULT", sourceItemIds: [], clamped: false };
      const bounded = Math.min(spec.max ?? n, Math.max(spec.min ?? n, n));
      clamped = bounded !== n;
      value = bounded;
    } else if (typeof value !== typeof spec.default) {
      return { key: spec.key, value: spec.default, basis: "DEFAULT", sourceItemIds: [], clamped: false };
    }
    return { key: spec.key, value, basis: "KNOWLEDGE", sourceItemIds: best.map((p) => p.c.itemId), clamped };
  });
  return { values, disagreements };
}
