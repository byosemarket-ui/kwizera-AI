/**
 * Phase 4.18C — Analysis Confidence Score (ANALYSIS_CONFIDENCE).
 *
 * NOT a calibrated win probability. NOT a guarantee of profit or accuracy.
 * Future calibratedProbabilityPct may be added after backtesting — reserved, unused here.
 *
 * Model analysis-confidence.v1
 * ----------------------------
 * Weighted average over *available* factors only. Missing factors are excluded
 * (never treated as agreement). If no factors are available → confidencePct null.
 *
 * Factors & weights (sum of defaults = 1.0):
 *   trend_alignment   0.30  — |fastSma − slowSma| / ATR, capped (needs both SMAs + ATR)
 *   momentum_evidence 0.20  — deterministic BUY/SELL present (cross occurred)
 *   htf_agreement     0.20  — HTF agreement vs primary direction; CONFLICT lowers score;
 *                             INSUFFICIENT/UNKNOWN/missing → unavailable
 *   data_quality      0.15  — strategyReady + quoteFresh
 *   ai_agreement      0.15  — AI agrees with deterministic direction; disagree lowers;
 *                             AI unavailable → unavailable (does not invent agreement)
 *
 * Stale / insufficient / conflict / NO_TRADE outcomes must not receive a score
 * (caller skips this function or passes allowScore=false).
 */
import {
  ANALYSIS_CONFIDENCE_MODEL_VERSION,
  ANALYSIS_CONFIDENCE_TYPE,
  type AnalysisConfidenceBreakdown,
  type AnalysisConfidenceFactor,
  type AnalysisFinalOutcome,
  type CanonicalAiInterpretationSlice,
  type CanonicalDeterministicStrategySlice,
  type CanonicalHtfContext,
  type CanonicalIndicatorSet,
  type CanonicalMarketDirection,
  type CanonicalQuoteSnapshot,
} from "./canonical-analysis.types.js";

/** Reserved extension point — unused until calibration exists. */
export type CalibratedProbabilityPct = number | null;

export const CONFIDENCE_WEIGHTS = {
  trend_alignment: 0.3,
  momentum_evidence: 0.2,
  htf_agreement: 0.2,
  data_quality: 0.15,
  ai_agreement: 0.15,
} as const;

export interface CalculateAnalysisConfidenceInput {
  finalOutcome: AnalysisFinalOutcome;
  direction: CanonicalMarketDirection | null;
  indicators: CanonicalIndicatorSet;
  deterministic: CanonicalDeterministicStrategySlice | null;
  ai: CanonicalAiInterpretationSlice | null;
  htf: CanonicalHtfContext | null;
  quote: CanonicalQuoteSnapshot;
  candleStrategyReady: boolean | null;
}

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n * 10) / 10));
}

function trendAlignmentScore(
  indicators: CanonicalIndicatorSet,
): AnalysisConfidenceFactor {
  const w = CONFIDENCE_WEIGHTS.trend_alignment;
  const fast = indicators.fastSma.value;
  const slow = indicators.slowSma.value;
  const atr = indicators.atr.value;
  if (
    fast == null
    || slow == null
    || atr == null
    || !Number.isFinite(fast)
    || !Number.isFinite(slow)
    || !Number.isFinite(atr)
    || atr <= 0
  ) {
    return {
      id: "trend_alignment",
      label: "Trend alignment (SMA sep / ATR)",
      scorePct: null,
      weight: w,
      available: false,
      unavailableReason: "fastSma, slowSma, and positive ATR required",
      detail: "Unavailable — missing SMA or ATR (SMA_OF_TR).",
    };
  }
  const sep = Math.abs(fast - slow);
  // sep/ATR of 0 → ~40; 1.0 → ~80; ≥1.5 → 100 (deterministic, capped)
  const raw = 40 + Math.min(1.5, sep / atr) * 40;
  return {
    id: "trend_alignment",
    label: "Trend alignment (SMA sep / ATR)",
    scorePct: clampPct(raw),
    weight: w,
    available: true,
    unavailableReason: null,
    detail: `|SMA9−SMA21|=${sep.toFixed(6)}, ATR(SMA_OF_TR)=${atr.toFixed(6)}, ratio=${(sep / atr).toFixed(4)}`,
  };
}

function momentumScore(
  direction: CanonicalMarketDirection | null,
  deterministic: CanonicalDeterministicStrategySlice | null,
): AnalysisConfidenceFactor {
  const w = CONFIDENCE_WEIGHTS.momentum_evidence;
  if (!deterministic || direction == null) {
    return {
      id: "momentum_evidence",
      label: "Momentum evidence (SMA cross)",
      scorePct: null,
      weight: w,
      available: false,
      unavailableReason: "No deterministic directional cross",
      detail: "Unavailable.",
    };
  }
  if (deterministic.direction !== direction) {
    return {
      id: "momentum_evidence",
      label: "Momentum evidence (SMA cross)",
      scorePct: null,
      weight: w,
      available: false,
      unavailableReason: "Deterministic direction mismatch",
      detail: "Unavailable.",
    };
  }
  // Cross codes get high momentum; generic BUY/SELL still count
  const strong =
    deterministic.code === "BUY_SMA_CROSS" || deterministic.code === "SELL_SMA_CROSS";
  return {
    id: "momentum_evidence",
    label: "Momentum evidence (SMA cross)",
    scorePct: strong ? 85 : 70,
    weight: w,
    available: true,
    unavailableReason: null,
    detail: `Deterministic ${deterministic.direction} (${deterministic.code}).`,
  };
}

function htfScore(
  direction: CanonicalMarketDirection | null,
  htf: CanonicalHtfContext | null,
): AnalysisConfidenceFactor {
  const w = CONFIDENCE_WEIGHTS.htf_agreement;
  if (!htf || htf.agreement === "INSUFFICIENT" || htf.agreement === "UNKNOWN") {
    return {
      id: "htf_agreement",
      label: "Higher-timeframe agreement",
      scorePct: null,
      weight: w,
      available: false,
      unavailableReason: htf
        ? `HTF agreement=${htf.agreement}`
        : "HTF context not provided",
      detail: "Unavailable — missing HTF evidence is not treated as agreement.",
    };
  }
  if (htf.agreement === "CONFLICT") {
    return {
      id: "htf_agreement",
      label: "Higher-timeframe agreement",
      scorePct: 15,
      weight: w,
      available: true,
      unavailableReason: null,
      detail: "HTF CONFLICT vs primary — lowers confidence.",
    };
  }
  if (direction == null) {
    return {
      id: "htf_agreement",
      label: "Higher-timeframe agreement",
      scorePct: null,
      weight: w,
      available: false,
      unavailableReason: "No primary direction",
      detail: "Unavailable.",
    };
  }
  const wantBull = direction === "BUY";
  const agrees =
    (wantBull && htf.agreement === "AGREE_BULLISH")
    || (!wantBull && htf.agreement === "AGREE_BEARISH");
  return {
    id: "htf_agreement",
    label: "Higher-timeframe agreement",
    scorePct: agrees ? 90 : 35,
    weight: w,
    available: true,
    unavailableReason: null,
    detail: `HTF ${htf.agreement} vs primary ${direction}.`,
  };
}

function dataQualityScore(
  quote: CanonicalQuoteSnapshot,
  candleStrategyReady: boolean | null,
): AnalysisConfidenceFactor {
  const w = CONFIDENCE_WEIGHTS.data_quality;
  if (candleStrategyReady == null) {
    return {
      id: "data_quality",
      label: "Data quality (candles + quote)",
      scorePct: null,
      weight: w,
      available: false,
      unavailableReason: "Candle quality not supplied",
      detail: "Unavailable.",
    };
  }
  let score = 50;
  const parts: string[] = [];
  if (candleStrategyReady) {
    score += 25;
    parts.push("strategyReady");
  } else {
    score -= 20;
    parts.push("!strategyReady");
  }
  if (quote.quoteFresh) {
    score += 25;
    parts.push("quoteFresh");
  } else {
    score -= 30;
    parts.push("!quoteFresh");
  }
  return {
    id: "data_quality",
    label: "Data quality (candles + quote)",
    scorePct: clampPct(score),
    weight: w,
    available: true,
    unavailableReason: null,
    detail: parts.join(", "),
  };
}

function aiAgreementScore(
  direction: CanonicalMarketDirection | null,
  ai: CanonicalAiInterpretationSlice | null,
): AnalysisConfidenceFactor {
  const w = CONFIDENCE_WEIGHTS.ai_agreement;
  if (!ai || ai.direction == null) {
    return {
      id: "ai_agreement",
      label: "AI agreement",
      scorePct: null,
      weight: w,
      available: false,
      unavailableReason: ai ? "AI direction not valid" : "AI unavailable",
      detail: "Unavailable — AI absence does not count as agreement.",
    };
  }
  if (direction == null) {
    return {
      id: "ai_agreement",
      label: "AI agreement",
      scorePct: null,
      weight: w,
      available: false,
      unavailableReason: "No deterministic direction to compare",
      detail: "Unavailable.",
    };
  }
  const agrees = ai.direction === direction;
  return {
    id: "ai_agreement",
    label: "AI agreement",
    scorePct: agrees ? 88 : 20,
    weight: w,
    available: true,
    unavailableReason: null,
    detail: agrees
      ? `AI ${ai.direction} agrees with deterministic ${direction}.`
      : `AI ${ai.direction} disagrees with deterministic ${direction}.`,
  };
}

/**
 * Pure, deterministic confidence calculation.
 * Returns null confidencePct when outcome is not a directional candidate
 * or when no scoring factors are available.
 */
export function calculateAnalysisConfidence(
  input: CalculateAnalysisConfidenceInput,
): {
  confidencePct: number | null;
  breakdown: AnalysisConfidenceBreakdown;
  limitations: string[];
} {
  const limitations: string[] = [
    "ANALYSIS_CONFIDENCE is explainable evidence strength — NOT a calibrated win probability.",
    "Score must not authorize orders or bypass risk controls.",
  ];

  const blocked =
    input.finalOutcome === "STALE_DATA"
    || input.finalOutcome === "INSUFFICIENT_DATA"
    || input.finalOutcome === "CONFLICT"
    || input.finalOutcome === "NO_TRADE"
    || input.direction == null;

  if (blocked) {
    limitations.push(
      `No directional confidence for finalOutcome=${input.finalOutcome}.`,
    );
    return {
      confidencePct: null,
      breakdown: {
        modelVersion: ANALYSIS_CONFIDENCE_MODEL_VERSION,
        confidenceType: ANALYSIS_CONFIDENCE_TYPE,
        factors: [],
        availableWeightSum: 0,
        weightedScorePct: null,
        limitations: [...limitations],
        isCalibratedWinProbability: false,
      },
      limitations,
    };
  }

  const factors: AnalysisConfidenceFactor[] = [
    trendAlignmentScore(input.indicators),
    momentumScore(input.direction, input.deterministic),
    htfScore(input.direction, input.htf),
    dataQualityScore(input.quote, input.candleStrategyReady),
    aiAgreementScore(input.direction, input.ai),
  ];

  let weightSum = 0;
  let acc = 0;
  for (const f of factors) {
    if (!f.available || f.scorePct == null) continue;
    weightSum += f.weight;
    acc += f.scorePct * f.weight;
  }

  if (weightSum <= 0) {
    limitations.push("No confidence factors available — score null.");
    return {
      confidencePct: null,
      breakdown: {
        modelVersion: ANALYSIS_CONFIDENCE_MODEL_VERSION,
        confidenceType: ANALYSIS_CONFIDENCE_TYPE,
        factors,
        availableWeightSum: 0,
        weightedScorePct: null,
        limitations: [...limitations],
        isCalibratedWinProbability: false,
      },
      limitations,
    };
  }

  const weighted = clampPct(acc / weightSum);
  const unavailable = factors.filter((f) => !f.available).map((f) => f.id);
  if (unavailable.length) {
    limitations.push(`Unavailable factors excluded: ${unavailable.join(", ")}.`);
  }

  return {
    confidencePct: weighted,
    breakdown: {
      modelVersion: ANALYSIS_CONFIDENCE_MODEL_VERSION,
      confidenceType: ANALYSIS_CONFIDENCE_TYPE,
      factors,
      availableWeightSum: Math.round(weightSum * 1000) / 1000,
      weightedScorePct: weighted,
      limitations: [...limitations],
      isCalibratedWinProbability: false,
    },
    limitations,
  };
}
