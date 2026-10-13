/**
 * Deterministic comparison of independent Local AI and OpenAI results.
 * Does not ask either model to judge the other; does not fabricate consensus.
 */
import type {
  DeterministicComparison,
  LocalProviderOutcome,
  OpenAiProviderOutcome,
} from "./types.js";
import type { LocalAiDecision } from "../snapshot-local/types.js";

function normEvidence(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const t = String(raw ?? "").trim().toLowerCase().replace(/\s+/g, " ");
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(String(raw).trim());
  }
  return out;
}

function evidenceKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function buildDeterministicComparison(
  local: LocalProviderOutcome,
  openai: OpenAiProviderOutcome,
): DeterministicComparison {
  const localFailed = !local.ok || !local.analysis;
  const openaiFailed = !openai.ok || !openai.analysis;

  const localDecision: LocalAiDecision | null = local.analysis?.decision ?? null;
  const openaiDecision: LocalAiDecision | null = openai.analysis?.decision ?? null;
  const localBias = local.analysis?.marketBias ?? null;
  const openaiBias = openai.analysis?.marketBias ?? null;
  const localConfidence = local.analysis?.confidence ?? null;
  const openaiConfidence = openai.analysis?.confidence ?? null;

  const localEv = normEvidence(local.analysis?.keyEvidence ?? []);
  const openaiEv = normEvidence(openai.analysis?.keyEvidence ?? []);
  const openaiKeys = new Set(openaiEv.map(evidenceKey));
  const localKeys = new Set(localEv.map(evidenceKey));

  const sharedEvidence = localEv.filter((e) => openaiKeys.has(evidenceKey(e)));
  const localOnlyEvidence = localEv.filter((e) => !openaiKeys.has(evidenceKey(e)));
  const openaiOnlyEvidence = openaiEv.filter((e) => !localKeys.has(evidenceKey(e)));

  const warnings: string[] = [];
  const limitations: string[] = [];

  if (localFailed) {
    warnings.push(`Local AI failed: ${local.error || local.code}`);
  } else if (local.analysis) {
    warnings.push(...(local.analysis.warnings ?? []).slice(0, 3));
    limitations.push(...(local.analysis.limitations ?? []).slice(0, 3));
  }
  if (openaiFailed) {
    warnings.push(`OpenAI failed: ${openai.error || openai.code}`);
  } else if (openai.analysis) {
    warnings.push(...(openai.analysis.warnings ?? []).slice(0, 3));
    limitations.push(...(openai.analysis.limitations ?? []).slice(0, 3));
  }

  const decisionsAgree =
    !localFailed
    && !openaiFailed
    && localDecision != null
    && openaiDecision != null
    && localDecision === openaiDecision;

  const biasAgree =
    !localFailed
    && !openaiFailed
    && localBias != null
    && openaiBias != null
    && localBias.toLowerCase() === openaiBias.toLowerCase();

  const confidenceComparable =
    !localFailed
    && !openaiFailed
    && localConfidence != null
    && openaiConfidence != null
    && localConfidence.trim().length > 0
    && openaiConfidence.trim().length > 0;

  let note: string;
  if (localFailed && openaiFailed) {
    note = "Both providers failed. Original analyses were not created or completed.";
  } else if (localFailed) {
    note = "Partial success: OpenAI completed; Local AI failed. No consensus is inferred.";
  } else if (openaiFailed) {
    note = "Partial success: Local AI completed; OpenAI failed. No consensus is inferred.";
  } else if (decisionsAgree) {
    note = `Both providers independently decided ${localDecision}. This is agreement, not a merged trade signal.`;
  } else {
    note =
      `Providers disagree: Local AI=${localDecision}, OpenAI=${openaiDecision}. `
      + "Disagreement is shown as-is; no averaged recommendation is produced.";
  }

  return {
    decisionsAgree,
    localDecision,
    openaiDecision,
    biasAgree,
    localBias,
    openaiBias,
    sharedEvidence,
    localOnlyEvidence,
    openaiOnlyEvidence,
    confidenceComparable,
    localConfidence,
    openaiConfidence,
    warnings: warnings.slice(0, 8),
    limitations: [...new Set(limitations)].slice(0, 6),
    localFailed,
    openaiFailed,
    note,
  };
}
