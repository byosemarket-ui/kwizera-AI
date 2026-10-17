/**
 * Phase 50A — Deterministic bullish directional-confidence score (multi-image).
 * Not a calibrated win probability. Not entry readiness or position-sizing eligibility.
 */
import type { MultiImageCaptureRef, MultiImageMtfReasoning } from "./types.js";

export const BULLISH_SCORE_METHOD = "phase50a-bullish-evidence-v1";
/** Minimum score to retain a model BUY (weak BUY → WAIT). */
export const BULLISH_BUY_MIN_SCORE = 52;
export const DIRECTIONAL_CONFIDENCE_LABEL = "Directional confidence (model estimate)";

export interface BullishScoreInput {
  decision: string;
  marketBias: string;
  mtf: MultiImageMtfReasoning;
  captures: MultiImageCaptureRef[];
  hasAnalysisTimeSnapshot: boolean;
  quoteFreshness: string | null;
  feedHealth: string | null;
  keyEvidence: string[];
  bullishScenario: string;
  bearishScenario: string;
}

export interface BullishScoreResult {
  score: number;
  percent: number;
  method: typeof BULLISH_SCORE_METHOD;
  label: typeof DIRECTIONAL_CONFIDENCE_LABEL;
  components: Array<{ id: string; delta: number; reason: string }>;
  supportsBuy: boolean;
  buyBlockedReason: string | null;
  display: string;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function textLooksBullish(text: string): boolean {
  return /bullish|higher\s+high|higher\s+low|uptrend|break\s+of\s+structure|bos\s+up|reclaim|support\s+hold/i.test(text);
}

function textLooksBearish(text: string): boolean {
  return /bearish|lower\s+high|lower\s+low|downtrend|breakdown|rejection|failed\s+break/i.test(text);
}

/**
 * Deterministic 0–100 bullish evidence score from available structured fields only.
 * Does not invent missing screenshot content.
 */
export function computeBullishDirectionalScore(input: BullishScoreInput): BullishScoreResult {
  const components: BullishScoreResult["components"] = [];
  let score = 42; // neutral baseline — neither bullish nor bearish by default

  const agreement = input.mtf.timeframeAgreement;
  if (agreement === "ALIGNED") {
    score += 18;
    components.push({ id: "mtf_aligned", delta: 18, reason: "Timeframes agree (ALIGNED)." });
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
    score -= 22;
    components.push({ id: "mtf_conflict", delta: -22, reason: "Material multi-timeframe conflict." });
  }

  const htf = input.mtf.higherTimeframeContext ?? "";
  const mid = input.mtf.intermediateStructure ?? "";
  const ltf = input.mtf.lowerTimeframeSetup ?? "";
  if (textLooksBullish(htf)) {
    score += 12;
    components.push({ id: "htf_bullish", delta: 12, reason: "Higher-timeframe context reads bullish." });
  } else if (textLooksBearish(htf)) {
    score -= 12;
    components.push({ id: "htf_bearish", delta: -12, reason: "Higher-timeframe context reads bearish." });
  }
  if (textLooksBullish(mid)) {
    score += 8;
    components.push({ id: "itf_bullish", delta: 8, reason: "Intermediate structure reads bullish." });
  } else if (textLooksBearish(mid)) {
    score -= 8;
    components.push({ id: "itf_bearish", delta: -8, reason: "Intermediate structure reads bearish." });
  }
  if (textLooksBullish(ltf)) {
    score += 7;
    components.push({ id: "ltf_bullish", delta: 7, reason: "Lower-timeframe setup reads bullish." });
  } else if (textLooksBearish(ltf)) {
    score -= 6;
    components.push({ id: "ltf_bearish", delta: -6, reason: "Lower-timeframe setup reads bearish." });
  }

  const bias = String(input.marketBias ?? "").toUpperCase();
  if (bias === "BULLISH") {
    score += 10;
    components.push({ id: "bias_bullish", delta: 10, reason: "Market bias BULLISH." });
  } else if (bias === "BEARISH") {
    score -= 14;
    components.push({ id: "bias_bearish", delta: -14, reason: "Market bias BEARISH." });
  } else if (bias === "UNCERTAIN") {
    score -= 3;
    components.push({ id: "bias_uncertain", delta: -3, reason: "Market bias UNCERTAIN." });
  }

  if (textLooksBullish(input.bullishScenario) || textLooksBullish(input.mtf.bullishScenario ?? "")) {
    score += 6;
    components.push({ id: "bullish_scenario", delta: 6, reason: "Bullish scenario text present." });
  }
  if (textLooksBearish(input.bearishScenario) || textLooksBearish(input.mtf.bearishScenario ?? "")) {
    score -= 5;
    components.push({ id: "bearish_scenario", delta: -5, reason: "Bearish scenario / contradiction present." });
  }
  if (input.mtf.conflictSummary) {
    score -= 8;
    components.push({ id: "conflict_summary", delta: -8, reason: "Explicit conflict summary recorded." });
  }

  const confirmed = input.keyEvidence.filter((e) => /CONFIRMED_BY_DATA/i.test(e)).length;
  const visible = input.keyEvidence.filter((e) => /VISIBLE_IN_IMAGE/i.test(e)).length;
  if (confirmed > 0) {
    const d = Math.min(8, confirmed * 3);
    score += d;
    components.push({ id: "confirmed_evidence", delta: d, reason: `${confirmed} CONFIRMED_BY_DATA evidence item(s).` });
  }
  if (visible > 0) {
    const d = Math.min(6, visible * 2);
    score += d;
    components.push({ id: "visible_evidence", delta: d, reason: `${visible} VISIBLE_IN_IMAGE evidence item(s).` });
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

  score = clamp(Math.round(score), 0, 100);
  const percent = score;

  let buyBlockedReason: string | null = null;
  if (agreement === "CONFLICTING") {
    buyBlockedReason = "Material multi-timeframe conflict — BUY not retained.";
  } else if (percent < BULLISH_BUY_MIN_SCORE) {
    buyBlockedReason =
      `Bullish evidence score ${percent} is below minimum ${BULLISH_BUY_MIN_SCORE} for a BUY directional assessment.`;
  }

  const supportsBuy = buyBlockedReason == null && percent >= BULLISH_BUY_MIN_SCORE;

  return {
    score,
    percent,
    method: BULLISH_SCORE_METHOD,
    label: DIRECTIONAL_CONFIDENCE_LABEL,
    components,
    supportsBuy,
    buyBlockedReason,
    display: `${DIRECTIONAL_CONFIDENCE_LABEL}: ${percent}%`,
  };
}

/**
 * Apply BUY retention policy: keep BUY only when score supports it and MTF is not CONFLICTING.
 * Never upgrades WAIT/SELL/NO_TRADE to BUY.
 */
export function applyBuyDirectionalPolicy(input: {
  decision: string;
  score: BullishScoreResult;
}): { decision: string; changed: boolean; reason: string | null } {
  const d = String(input.decision ?? "").toUpperCase();
  if (d !== "BUY") {
    return { decision: d || "WAIT", changed: false, reason: null };
  }
  if (input.score.supportsBuy) {
    return { decision: "BUY", changed: false, reason: null };
  }
  return {
    decision: "WAIT",
    changed: true,
    reason: input.score.buyBlockedReason ?? "BUY not supported by bullish evidence score.",
  };
}
