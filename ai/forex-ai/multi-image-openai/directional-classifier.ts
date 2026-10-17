/**
 * Phase 50B — Binary BUY/SELL directional classification for multi-image analysis.
 *
 * Method: phase50b-binary-evidence-v1
 * - Compute independent bullish and bearish evidence scores (0–100) from structured fields.
 * - Select the stronger direction. Never return WAIT/UNCERTAIN/NO_TRADE as the directional decision
 *   for a completed valid classification.
 * - Directional confidence reflects evidence strength and margin — not a calibrated win probability,
 *   not target-hit probability, not entry readiness, not risk eligibility.
 */
import {
  DIRECTIONAL_CONFIDENCE_LABEL,
  computeBullishDirectionalScore,
  type BullishScoreInput,
  type BullishScoreResult,
} from "./bullish-score.js";
import type { MultiImageCaptureRef, MultiImageMtfReasoning } from "./types.js";

export const BINARY_DIRECTION_METHOD = "phase50b-binary-evidence-v1";
export { DIRECTIONAL_CONFIDENCE_LABEL };

export type BinaryDirection = "BUY" | "SELL";

export interface BearishScoreResult {
  score: number;
  percent: number;
  method: "phase50b-bearish-evidence-v1";
  components: Array<{ id: string; delta: number; reason: string }>;
}

export interface BinaryDirectionalResult {
  direction: BinaryDirection;
  directionalConfidencePercent: number;
  directionalConfidenceLabel: typeof DIRECTIONAL_CONFIDENCE_LABEL;
  scoreMethod: typeof BINARY_DIRECTION_METHOD;
  bullishScore: number;
  bearishScore: number;
  margin: number;
  confidenceBand: "LOW" | "MODERATE" | "HIGH";
  supportingEvidence: string[];
  contradictingEvidence: string[];
  components: Array<{ id: string; delta: number; reason: string }>;
  modelDecisionBeforePolicy: string;
  tieBreakNote: string | null;
  lowConfidenceNote: string | null;
  entryReadiness: "NOT_CONFIRMED";
  imagesSubmittedAsImageUrl: true;
  display: string;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function textLooksBullish(text: string): boolean {
  return /bullish|higher\s+high|higher\s+low|uptrend|break\s+of\s+structure|bos\s+up|reclaim|support\s+hold/i.test(text);
}

function textLooksBearish(text: string): boolean {
  return /bearish|lower\s+high|lower\s+low|downtrend|breakdown|rejection|failed\s+break/i.test(text);
}

/**
 * Deterministic bearish evidence score — mirror of bullish scoring axes (not 100 − bullish).
 * Avoids double-counting by scoring bearish cues independently.
 */
export function computeBearishDirectionalScore(input: BullishScoreInput): BearishScoreResult {
  const components: BearishScoreResult["components"] = [];
  let score = 42;

  const agreement = input.mtf.timeframeAgreement;
  if (agreement === "ALIGNED") {
    // Alignment helps whichever side the structure text supports; modest base for bearish path.
    score += 6;
    components.push({ id: "mtf_aligned_base", delta: 6, reason: "Timeframes agree (ALIGNED) — structure text decides side." });
  } else if (agreement === "MIXED") {
    score += 6;
    components.push({ id: "mtf_mixed", delta: 6, reason: "Timeframes partially agree (MIXED)." });
  } else if (agreement === "SINGLE_TIMEFRAME") {
    score += 4;
    components.push({ id: "mtf_single", delta: 4, reason: "Single timeframe only — limited confirmation." });
  } else if (agreement === "INSUFFICIENT") {
    score -= 4;
    components.push({ id: "mtf_insufficient", delta: -4, reason: "MTF agreement insufficient." });
  } else if (agreement === "CONFLICTING") {
    score -= 10;
    components.push({ id: "mtf_conflict", delta: -10, reason: "Material multi-timeframe conflict reduces directional clarity." });
  }

  const htf = input.mtf.higherTimeframeContext ?? "";
  const mid = input.mtf.intermediateStructure ?? "";
  const ltf = input.mtf.lowerTimeframeSetup ?? "";
  if (textLooksBearish(htf)) {
    score += 12;
    components.push({ id: "htf_bearish", delta: 12, reason: "Higher-timeframe context reads bearish." });
  } else if (textLooksBullish(htf)) {
    score -= 12;
    components.push({ id: "htf_bullish_against", delta: -12, reason: "Higher-timeframe context reads bullish (against SELL)." });
  }
  if (textLooksBearish(mid)) {
    score += 8;
    components.push({ id: "itf_bearish", delta: 8, reason: "Intermediate structure reads bearish." });
  } else if (textLooksBullish(mid)) {
    score -= 8;
    components.push({ id: "itf_bullish_against", delta: -8, reason: "Intermediate structure reads bullish (against SELL)." });
  }
  if (textLooksBearish(ltf)) {
    score += 7;
    components.push({ id: "ltf_bearish", delta: 7, reason: "Lower-timeframe setup reads bearish." });
  } else if (textLooksBullish(ltf)) {
    score -= 6;
    components.push({ id: "ltf_bullish_against", delta: -6, reason: "Lower-timeframe setup reads bullish (against SELL)." });
  }

  const bias = String(input.marketBias ?? "").toUpperCase();
  if (bias === "BEARISH") {
    score += 10;
    components.push({ id: "bias_bearish", delta: 10, reason: "Market bias BEARISH." });
  } else if (bias === "BULLISH") {
    score -= 14;
    components.push({ id: "bias_bullish_against", delta: -14, reason: "Market bias BULLISH (against SELL)." });
  } else if (bias === "UNCERTAIN" || bias === "NEUTRAL") {
    score -= 3;
    components.push({ id: "bias_uncertain", delta: -3, reason: `Market bias ${bias || "UNCERTAIN"}.` });
  }

  if (textLooksBearish(input.bearishScenario) || textLooksBearish(input.mtf.bearishScenario ?? "")) {
    score += 6;
    components.push({ id: "bearish_scenario", delta: 6, reason: "Bearish scenario text present." });
  }
  if (textLooksBullish(input.bullishScenario) || textLooksBullish(input.mtf.bullishScenario ?? "")) {
    score -= 5;
    components.push({ id: "bullish_scenario_against", delta: -5, reason: "Bullish scenario present (contradiction for SELL)." });
  }
  if (input.mtf.conflictSummary) {
    score -= 8;
    components.push({ id: "conflict_summary", delta: -8, reason: "Explicit conflict summary recorded." });
  }

  const confirmed = input.keyEvidence.filter((e) => /CONFIRMED_BY_DATA/i.test(e)).length;
  const visible = input.keyEvidence.filter((e) => /VISIBLE_IN_IMAGE/i.test(e)).length;
  const bearishEvidence = input.keyEvidence.filter((e) => textLooksBearish(e)).length;
  if (confirmed > 0) {
    const d = Math.min(6, confirmed * 2);
    score += d;
    components.push({ id: "confirmed_evidence", delta: d, reason: `${confirmed} CONFIRMED_BY_DATA item(s).` });
  }
  if (visible > 0) {
    const d = Math.min(5, visible * 2);
    score += d;
    components.push({ id: "visible_evidence", delta: d, reason: `${visible} VISIBLE_IN_IMAGE item(s).` });
  }
  if (bearishEvidence > 0) {
    const d = Math.min(8, bearishEvidence * 3);
    score += d;
    components.push({ id: "bearish_key_evidence", delta: d, reason: `${bearishEvidence} bearish-leaning key evidence item(s).` });
  }

  if (input.hasAnalysisTimeSnapshot) {
    score += 8;
    components.push({ id: "analysis_snapshot", delta: 8, reason: "ANALYSIS_TIME immutable snapshot linked." });
  } else {
    score -= 6;
    components.push({ id: "no_analysis_snapshot", delta: -6, reason: "No ANALYSIS_TIME snapshot — capture metadata + images only." });
  }

  const feeds = input.captures.map((c) => String(c.quote.feedHealth ?? "").toUpperCase());
  const liveish = feeds.some((f) => f === "LIVE");
  const staleish = feeds.some((f) =>
    f === "STALE" || f === "NO_RECENT_MARKET_UPDATES" || f === "MARKET_INACTIVE" || f === "UNAVAILABLE"
  );
  if (liveish) {
    score += 5;
    components.push({ id: "feed_live", delta: 5, reason: "At least one capture marked LIVE feed." });
  } else if (staleish) {
    score -= 7;
    components.push({ id: "feed_stale", delta: -7, reason: "Capture feed stale/inactive/unavailable." });
  }

  const qf = String(input.quoteFreshness ?? input.feedHealth ?? "").toUpperCase();
  if (qf === "STALE" || qf === "STALE_DATA") {
    score -= 10;
    components.push({ id: "analysis_stale", delta: -10, reason: "ANALYSIS_TIME quote freshness STALE." });
  }

  if (input.mtf.roster.sameTimeframeDuplicates && input.mtf.roster.distinctTimeframes.length <= 1) {
    score -= 6;
    components.push({
      id: "same_tf_only",
      delta: -6,
      reason: "Multiple same-timeframe images are not independent MTF confirmation.",
    });
  }

  if (input.mtf.missingEvidence.length >= 2) {
    score -= 5;
    components.push({ id: "missing_evidence", delta: -5, reason: "Multiple missing-evidence items listed." });
  }

  score = clamp(score, 0, 100);
  return {
    score,
    percent: score,
    method: "phase50b-bearish-evidence-v1",
    components,
  };
}

function pickSupporting(
  direction: BinaryDirection,
  keyEvidence: string[],
  mtf: MultiImageMtfReasoning,
  bullishScenario: string,
  bearishScenario: string,
): { supporting: string[]; contradicting: string[] } {
  const bullishBits = [
    ...keyEvidence.filter((e) => textLooksBullish(e)),
    mtf.higherTimeframeContext && textLooksBullish(mtf.higherTimeframeContext) ? mtf.higherTimeframeContext : null,
    mtf.intermediateStructure && textLooksBullish(mtf.intermediateStructure) ? mtf.intermediateStructure : null,
    mtf.lowerTimeframeSetup && textLooksBullish(mtf.lowerTimeframeSetup) ? mtf.lowerTimeframeSetup : null,
    bullishScenario || mtf.bullishScenario,
  ].filter((x): x is string => Boolean(x));

  const bearishBits = [
    ...keyEvidence.filter((e) => textLooksBearish(e)),
    mtf.higherTimeframeContext && textLooksBearish(mtf.higherTimeframeContext) ? mtf.higherTimeframeContext : null,
    mtf.intermediateStructure && textLooksBearish(mtf.intermediateStructure) ? mtf.intermediateStructure : null,
    mtf.lowerTimeframeSetup && textLooksBearish(mtf.lowerTimeframeSetup) ? mtf.lowerTimeframeSetup : null,
    bearishScenario || mtf.bearishScenario,
  ].filter((x): x is string => Boolean(x));

  if (direction === "BUY") {
    return {
      supporting: bullishBits.slice(0, 6),
      contradicting: bearishBits.slice(0, 6),
    };
  }
  return {
    supporting: bearishBits.slice(0, 6),
    contradicting: bullishBits.slice(0, 6),
  };
}

function confidenceBand(percent: number, margin: number): "LOW" | "MODERATE" | "HIGH" {
  if (percent < 55 || margin < 6) return "LOW";
  if (percent < 70 || margin < 14) return "MODERATE";
  return "HIGH";
}

/**
 * Compare bullish vs bearish scores and return exactly BUY or SELL for a completed valid analysis.
 * Does not invent evidence. Does not randomize. Tie-break uses model BUY/SELL, then marketBias, then slight bullish lean only when scores are identically tied after those checks is avoided — uses structure text count instead.
 */
export function applyBinaryDirectionalClassification(input: {
  modelDecision: string;
  marketBias: string;
  bullish: BullishScoreResult;
  bearish: BearishScoreResult;
  mtf: MultiImageMtfReasoning;
  keyEvidence: string[];
  bullishScenario: string;
  bearishScenario: string;
  captures: MultiImageCaptureRef[];
}): BinaryDirectionalResult {
  const bullishScore = input.bullish.percent;
  const bearishScore = input.bearish.percent;
  const model = String(input.modelDecision ?? "").toUpperCase();
  const bias = String(input.marketBias ?? "").toUpperCase();

  let direction: BinaryDirection;
  let tieBreakNote: string | null = null;

  if (bullishScore > bearishScore) {
    direction = "BUY";
  } else if (bearishScore > bullishScore) {
    direction = "SELL";
  } else if (model === "BUY" || model === "SELL") {
    direction = model;
    tieBreakNote = `Equal evidence scores (${bullishScore}/${bearishScore}); used model decision ${model}.`;
  } else if (bias === "BULLISH") {
    direction = "BUY";
    tieBreakNote = `Equal evidence scores; marketBias BULLISH used as tie-break.`;
  } else if (bias === "BEARISH") {
    direction = "SELL";
    tieBreakNote = `Equal evidence scores; marketBias BEARISH used as tie-break.`;
  } else {
    const bullishTexts = [
      input.mtf.higherTimeframeContext,
      input.mtf.intermediateStructure,
      input.mtf.lowerTimeframeSetup,
      input.bullishScenario,
    ].filter((t) => t && textLooksBullish(t)).length;
    const bearishTexts = [
      input.mtf.higherTimeframeContext,
      input.mtf.intermediateStructure,
      input.mtf.lowerTimeframeSetup,
      input.bearishScenario,
    ].filter((t) => t && textLooksBearish(t)).length;
    if (bearishTexts > bullishTexts) {
      direction = "SELL";
      tieBreakNote = "Equal numeric scores; more bearish structure/scenario text cues.";
    } else if (bullishTexts > bearishTexts) {
      direction = "BUY";
      tieBreakNote = "Equal numeric scores; more bullish structure/scenario text cues.";
    } else {
      // Last resort for a completed valid analysis with fully tied cues: prefer the model's
      // non-WAIT lean is unavailable — use SELL/BUY from capture feed of relative scenario length.
      const bLen = (input.bearishScenario || input.mtf.bearishScenario || "").length;
      const uLen = (input.bullishScenario || input.mtf.bullishScenario || "").length;
      direction = bLen >= uLen ? "SELL" : "BUY";
      tieBreakNote =
        "Equal scores and cues; selected direction from longer scenario text (not random). "
        + "Confidence remains low.";
    }
  }

  const margin = Math.abs(bullishScore - bearishScore);
  const winning = direction === "BUY" ? bullishScore : bearishScore;
  // Confidence = winning score, reduced when the margin is thin (mixed/weak comparison).
  let directionalConfidencePercent = winning;
  if (margin < 4) {
    directionalConfidencePercent = Math.min(directionalConfidencePercent, 48);
  } else if (margin < 8) {
    directionalConfidencePercent = Math.min(directionalConfidencePercent, 56);
  } else if (margin < 14) {
    directionalConfidencePercent = Math.min(
      directionalConfidencePercent,
      clamp(winning - (14 - margin), 40, winning),
    );
  }
  directionalConfidencePercent = clamp(directionalConfidencePercent, 0, 100);

  const band = confidenceBand(directionalConfidencePercent, margin);
  const { supporting, contradicting } = pickSupporting(
    direction,
    input.keyEvidence,
    input.mtf,
    input.bullishScenario,
    input.bearishScenario,
  );

  const lowConfidenceNote = band === "LOW"
    ? "Low directional confidence — lean only; not entry-ready and not a verified live trade signal."
    : null;

  const components = [
    ...input.bullish.components.map((c) => ({ ...c, id: `bullish:${c.id}` })),
    ...input.bearish.components.map((c) => ({ ...c, id: `bearish:${c.id}` })),
  ];

  return {
    direction,
    directionalConfidencePercent,
    directionalConfidenceLabel: DIRECTIONAL_CONFIDENCE_LABEL,
    scoreMethod: BINARY_DIRECTION_METHOD,
    bullishScore,
    bearishScore,
    margin,
    confidenceBand: band,
    supportingEvidence: supporting,
    contradictingEvidence: contradicting,
    components,
    modelDecisionBeforePolicy: model || "UNKNOWN",
    tieBreakNote,
    lowConfidenceNote,
    entryReadiness: "NOT_CONFIRMED",
    imagesSubmittedAsImageUrl: true,
    display:
      `${DIRECTIONAL_CONFIDENCE_LABEL}: ${directionalConfidencePercent}% `
      + `(${BINARY_DIRECTION_METHOD}; bullish ${bullishScore} vs bearish ${bearishScore})`,
  };
}

/** True when a completed multi-image run has enough material to classify (not a hard input error). */
export function canCompleteDirectionalClassification(input: {
  captures: MultiImageCaptureRef[];
  imageCount: number;
  analysisStatus: string;
  analysisError: string | null | undefined;
}): { ok: boolean; error?: string } {
  if (input.analysisStatus === "failed" || input.analysisError) {
    return { ok: false, error: input.analysisError ?? "Analysis failed — directional classification not produced." };
  }
  if (!input.captures.length) {
    return { ok: false, error: "No captures available for directional classification." };
  }
  if (input.imageCount < 1) {
    return { ok: false, error: "No chart images were submitted — directional classification requires image evidence." };
  }
  return { ok: true };
}

export function buildBinaryScoreInput(partial: BullishScoreInput): BullishScoreInput {
  return partial;
}
