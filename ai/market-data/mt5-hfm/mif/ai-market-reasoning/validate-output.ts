/**
 * Phase 5E Step 3 — schema + evidence grounding validation for AI output.
 * Rejects invented evidence IDs, prices as execution levels, fabricated probabilities.
 */
import type { MifAiReasoningContext, MifAiScenario, MifAiValidatedReasoningOutput } from "./types.js";

const SCENARIO_STATUS = new Set([
  "ACTIVE",
  "DEVELOPING",
  "WAITING_FOR_CONFIRMATION",
  "CONFIRMED",
  "INVALIDATED",
  "LOW_EVIDENCE",
  "BLOCKED",
]);
const SUPPORT = new Set([
  "HIGH_EVIDENCE_SUPPORT",
  "MODERATE_EVIDENCE_SUPPORT",
  "LOW_EVIDENCE_SUPPORT",
  "INSUFFICIENT_EVIDENCE",
  "CONFLICTED",
  "UNAVAILABLE",
]);
const CLAIM = new Set([
  "OBSERVED_FACT",
  "ENGINE_DERIVED",
  "HISTORICAL_STATISTICAL",
  "AI_INTERPRETATION",
  "HYPOTHESIS",
  "UNKNOWN",
]);
const PRICE_CTX = new Set([
  "AVAILABLE_FROM_SOURCE",
  "LEVELS_NOT_PROVIDED",
  "STALE",
  "NOT_APPLICABLE",
]);

function isObj(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x ?? "")).filter(Boolean);
}

function parseJsonObject(raw: string): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isObj(parsed)) return { ok: false, error: "model_output_not_object" };
    return { ok: true, value: parsed };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "json_parse_error" };
  }
}

function sourceLevelSet(ctx: MifAiReasoningContext): Set<string> {
  const levels = ctx.structuredLevels;
  const out = new Set<string>();
  if (!levels) return out;
  for (const v of [levels.entryPrice, levels.targetPrice, levels.invalidationPrice]) {
    if (typeof v === "number" && Number.isFinite(v)) out.add(String(v));
  }
  return out;
}

function hasStructuredSourceLevels(ctx: MifAiReasoningContext): boolean {
  return Boolean(ctx.structuredLevels?.hasAnyFinite);
}

/**
 * Ground priceContextStatus against structured source levels.
 * Never invents prices; downgrades unsupported AVAILABLE_FROM_SOURCE claims.
 */
export function groundPriceContextStatus(
  claimed: string,
  ctx: MifAiReasoningContext,
  side: "BULLISH" | "BEARISH",
  notes: string[],
  errors: string[],
): MifAiScenario["priceContextStatus"] {
  let status = claimed.toUpperCase();
  if (!PRICE_CTX.has(status)) {
    errors.push(`scenario.${side}.invalid_priceContextStatus=${status}`);
    status = "LEVELS_NOT_PROVIDED";
  }

  const hasLevels = hasStructuredSourceLevels(ctx);
  const allowedNums = sourceLevelSet(ctx);

  if (status === "AVAILABLE_FROM_SOURCE" && !hasLevels) {
    errors.push(`scenario.${side}.price_available_without_structured_levels`);
    status = "LEVELS_NOT_PROVIDED";
  }

  // Reject numeric prices in notes that are not present in structured source levels
  for (const n of notes) {
    const matches = n.matchAll(/(?:entry|target|tp|invalidation|sl|stop)\s*[=:]\s*(-?\d+(?:\.\d+)?)/gi);
    for (const m of matches) {
      const num = m[1]!;
      if (!allowedNums.has(num)) {
        errors.push(`scenario.${side}.invented_price_in_notes=${num}`);
      }
    }
  }

  return (PRICE_CTX.has(status) ? status : "LEVELS_NOT_PROVIDED") as MifAiScenario["priceContextStatus"];
}

function validateScenario(
  side: "BULLISH" | "BEARISH",
  raw: unknown,
  allowedEvidence: Set<string>,
  ctx: MifAiReasoningContext,
  errors: string[],
): MifAiScenario {
  const o = isObj(raw) ? raw : {};
  const status = asString(o.status, "LOW_EVIDENCE").toUpperCase();
  if (!SCENARIO_STATUS.has(status)) {
    errors.push(`scenario.${side}.invalid_status=${status}`);
  }
  const supporting = asStringArray(o.supportingEvidenceRefs);
  const contradicting = asStringArray(o.contradictingEvidenceRefs);
  for (const id of [...supporting, ...contradicting]) {
    if (!allowedEvidence.has(id)) {
      errors.push(`scenario.${side}.unknown_evidence_ref=${id}`);
    }
  }
  const claimKinds = asStringArray(o.claimKinds).map((c) => c.toUpperCase());
  for (const c of claimKinds) {
    if (!CLAIM.has(c)) errors.push(`scenario.${side}.invalid_claimKind=${c}`);
  }
  const notes = asStringArray(o.priceContextNotes);
  for (const n of notes) {
    if (/execute\s+(buy|sell)|submit\s+order|lot\s*size|market\s+order/i.test(n)) {
      errors.push(`scenario.${side}.execution_instruction_rejected`);
    }
  }

  const priceContextStatus = groundPriceContextStatus(
    asString(o.priceContextStatus, "LEVELS_NOT_PROVIDED"),
    ctx,
    side,
    notes,
    errors,
  );

  let finalStatus = SCENARIO_STATUS.has(status) ? (status as MifAiScenario["status"]) : "LOW_EVIDENCE";
  // CONFIRMED requires at least one supporting CLOSED-capable evidence ref that exists
  if (finalStatus === "CONFIRMED" && supporting.length === 0) {
    errors.push(`scenario.${side}.confirmed_without_supporting_evidence`);
    finalStatus = "WAITING_FOR_CONFIRMATION";
  }

  return {
    side,
    status: finalStatus,
    summary: asString(o.summary, `${side} scenario not detailed`),
    supportingEvidenceRefs: supporting.filter((id) => allowedEvidence.has(id)),
    contradictingEvidenceRefs: contradicting.filter((id) => allowedEvidence.has(id)),
    missingEvidence: asStringArray(o.missingEvidence),
    confirmationConditions: asStringArray(o.confirmationConditions),
    invalidationConditions: asStringArray(o.invalidationConditions),
    claimKinds: claimKinds.filter((c) => CLAIM.has(c)) as MifAiScenario["claimKinds"],
    priceContextStatus,
    priceContextNotes: notes,
  };
}

/**
 * Validate and ground model JSON against context.
 * Returns output + errors. Caller decides SUCCESS vs EVIDENCE_VALIDATION_FAILED.
 */
export function validateAndGroundMifAiReasoningOutput(
  rawContent: string,
  ctx: MifAiReasoningContext,
): {
  ok: boolean;
  output: MifAiValidatedReasoningOutput | null;
  errors: string[];
} {
  const errors: string[] = [];
  const parsed = parseJsonObject(rawContent);
  if (!parsed.ok) {
    return { ok: false, output: null, errors: [parsed.error] };
  }
  const o = parsed.value;
  const allowed = new Set(ctx.availableEvidenceIds);

  const requiredStrings = [
    "marketOverview",
    "higherTimeframeAnalysis",
    "intermediateTimeframeAnalysis",
    "lowerTimeframeAnalysis",
    "marketStructureAnalysis",
    "marketRegimeAnalysis",
    "liquidityAnalysis",
    "momentumAnalysis",
    "displacementAnalysis",
    "patternAnalysis",
    "opportunityAnalysis",
    "rankingInterpretation",
    "probabilityInterpretation",
    "evidenceSummary",
    "scenarioComparison",
    "reasoningConclusion",
  ] as const;

  for (const k of requiredStrings) {
    if (typeof o[k] !== "string" || !String(o[k]).trim()) {
      errors.push(`missing_or_empty=${k}`);
    }
  }

  const cited = asStringArray(o.citedEvidenceRefs);
  for (const id of cited) {
    if (!allowed.has(id)) errors.push(`cited_unknown_evidence=${id}`);
  }

  // Probability semantics
  const probText = asString(o.probabilityInterpretation).toLowerCase();
  if (ctx.probability?.probability == null) {
    if (/\b0%|\b0\.0+\b|probability\s*(is|=)\s*0\b/i.test(probText) && /win|success|target/i.test(probText)) {
      errors.push("null_probability_misrepresented_as_zero");
    }
  } else {
    // If model invents a different numeric probability, flag
    const claimed = probText.match(/probability[^0-9]{0,12}(0?\.\d+|1(?:\.0+)?|\d{1,2}%)/i);
    if (claimed) {
      let n = claimed[1]!;
      let val = n.endsWith("%") ? Number(n.replace("%", "")) / 100 : Number(n);
      if (Number.isFinite(val) && Math.abs(val - ctx.probability.probability) > 0.051) {
        errors.push(
          `probability_mismatch_model=${val}_source=${ctx.probability.probability}`,
        );
      }
    }
  }

  // Ranking must not be called probability (allow explicit negation: "not win probability")
  const rankText = asString(o.rankingInterpretation).toLowerCase();
  if (
    /ranking\s*score\s+(is|equals|=|:)\s*(the\s+)?(win\s*prob|probability\s+of\s+success)/i.test(
      rankText,
    ) &&
    !/\bnot\b.{0,40}(win\s*prob|probability\s+of\s+success)/i.test(rankText)
  ) {
    errors.push("ranking_score_labeled_as_win_probability");
  }

  const support = asString(o.evidenceSupportStatus, "UNAVAILABLE").toUpperCase();
  if (!SUPPORT.has(support)) errors.push(`invalid_evidenceSupportStatus=${support}`);

  const bullish = validateScenario("BULLISH", o.bullishScenario, allowed, ctx, errors);
  const bearish = validateScenario("BEARISH", o.bearishScenario, allowed, ctx, errors);

  // Invented absolute prices in conclusion (heuristic)
  const conclusion = asString(o.reasoningConclusion);
  if (/enter\s+at\s+\d|stop\s*loss\s*=\s*\d|take\s*profit\s*=\s*\d/i.test(conclusion)) {
    errors.push("invented_execution_price_language");
  }

  const output: MifAiValidatedReasoningOutput = {
    marketOverview: asString(o.marketOverview, "Not provided"),
    higherTimeframeAnalysis: asString(o.higherTimeframeAnalysis, "Not provided"),
    intermediateTimeframeAnalysis: asString(o.intermediateTimeframeAnalysis, "Not provided"),
    lowerTimeframeAnalysis: asString(o.lowerTimeframeAnalysis, "Not provided"),
    marketStructureAnalysis: asString(o.marketStructureAnalysis, "Not provided"),
    marketRegimeAnalysis: asString(o.marketRegimeAnalysis, "Not provided"),
    liquidityAnalysis: asString(o.liquidityAnalysis, "Not provided"),
    momentumAnalysis: asString(o.momentumAnalysis, "Not provided"),
    displacementAnalysis: asString(o.displacementAnalysis, "Not provided"),
    patternAnalysis: asString(o.patternAnalysis, "Not provided"),
    opportunityAnalysis: asString(o.opportunityAnalysis, "Not provided"),
    rankingInterpretation: asString(o.rankingInterpretation, "Not provided"),
    probabilityInterpretation: asString(o.probabilityInterpretation, "Not provided"),
    evidenceSummary: asString(o.evidenceSummary, "Not provided"),
    bullishScenario: bullish,
    bearishScenario: bearish,
    scenarioComparison: asString(o.scenarioComparison, "Not provided"),
    confirmationConditions: asStringArray(o.confirmationConditions),
    invalidationConditions: asStringArray(o.invalidationConditions),
    missingInformation: asStringArray(o.missingInformation),
    contradictions: asStringArray(o.contradictions),
    reasoningConclusion: conclusion || "Not provided",
    reasoningLimitations: asStringArray(o.reasoningLimitations),
    evidenceSupportStatus: SUPPORT.has(support)
      ? (support as MifAiValidatedReasoningOutput["evidenceSupportStatus"])
      : "UNAVAILABLE",
    citedEvidenceRefs: cited.filter((id) => allowed.has(id)),
  };

  // Hard fail classes
  const hard = errors.some((e) =>
    /unknown_evidence|invented_execution|invented_price|price_available_without_structured|null_probability_misrepresented|ranking_score_labeled|probability_mismatch|execution_instruction/
      .test(e),
  );
  const missingRequired = errors.some((e) => e.startsWith("missing_or_empty="));
  const ok = !hard && !missingRequired && parsed.ok;

  return { ok, output, errors };
}

export function tryParseModelJson(raw: string): ReturnType<typeof parseJsonObject> {
  return parseJsonObject(raw);
}
