/**
 * Phase 4.18C — Canonical Automated Trading analysis contract.
 * Analysis authority only — never places or authorizes broker orders.
 *
 * Directional field (`direction`) is BUY|SELL|null only.
 * Validity lives in `finalOutcome` (INSUFFICIENT_DATA, STALE_DATA, CONFLICT, NO_TRADE, …).
 * Confidence is ANALYSIS_CONFIDENCE — not a calibrated win probability.
 */
import type { AutomatedTradingEnvironment } from "../types.js";
import type { CandleQualityReport } from "../candle-quality.js";

export const CANONICAL_ANALYSIS_SCHEMA = "kwizera.canonical-analysis.v1" as const;
export const CANONICAL_ANALYSIS_VERSION = "4.18C" as const;
export const ANALYSIS_CONFIDENCE_TYPE = "ANALYSIS_CONFIDENCE" as const;
export const ANALYSIS_CONFIDENCE_MODEL_VERSION = "analysis-confidence.v1" as const;

/** Project TF ids — ForexConnect 1:1 mappings only. */
export type CanonicalTimeframeId =
  | "1m"
  | "5m"
  | "15m"
  | "30m"
  | "1h"
  | "4h"
  | "1d"
  | "1w";

export type ProvenanceKind = "BROKER_MEASURED" | "DETERMINISTIC_COMPUTED" | "AI_INTERPRETED";

export type AnalysisFinalOutcome =
  | "BUY_CANDIDATE"
  | "SELL_CANDIDATE"
  | "NO_TRADE"
  | "CONFLICT"
  | "INSUFFICIENT_DATA"
  | "STALE_DATA";

/** Market direction only — never HOLD/NEUTRAL/WAIT/NO_TRADE. */
export type CanonicalMarketDirection = "BUY" | "SELL";

export type CanonicalMarketInterpretation = "BULLISH" | "BEARISH";

export type AtrMethodId = "SMA_OF_TR" | "WILDER_RMA";

export interface ProvenancedValue<T> {
  value: T;
  provenance: ProvenanceKind;
  sourceComponent: string;
  asOfUtc: string | null;
}

export interface CanonicalCandleRef {
  instrument: string;
  timeframe: CanonicalTimeframeId;
  openTimeSec: number;
  closeTimeSec: number;
  ohlcFingerprint: string;
  closed: true;
}

export interface CanonicalQuoteSnapshot {
  instrument: string;
  bid: number | null;
  ask: number | null;
  quoteFresh: boolean;
  freshnessReasonCode: string | null;
  effectivePriceChangeAgeMs: number | null;
  snapshotFingerprint: string | null;
  evaluatedAtUtc: string;
}

export interface CanonicalIndicatorSet {
  fastSma: ProvenancedValue<number | null>;
  slowSma: ProvenancedValue<number | null>;
  atr: ProvenancedValue<number | null>;
  /** Phase 4.18C: strategy v1 uses SMA of True Range, not Wilder RMA. */
  atrMethod: AtrMethodId;
  atrLength: number;
}

export interface CanonicalDeterministicStrategySlice {
  strategyId: string;
  direction: "BUY" | "SELL" | "NO_TRADE";
  code: string;
  reasons: string[];
  entryPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  confidencePct: number | null;
  closedCandle: CanonicalCandleRef | null;
  atrMethod: AtrMethodId;
}

export interface CanonicalAiInterpretationSlice {
  analysisId: string | null;
  schemaVersion: "at-openai-ta-v1" | null;
  lifecycle: string | null;
  direction: CanonicalMarketDirection | null;
  directionalBias: string | null;
  trendState: string | null;
  trendStrength: string | null;
  mtfAgreement: string | null;
  supportLevels: Array<{
    price: number | null;
    verifiedAgainstSnapshot: boolean;
    provenance: ProvenanceKind;
  }>;
  resistanceLevels: Array<{
    price: number | null;
    verifiedAgainstSnapshot: boolean;
    provenance: ProvenanceKind;
  }>;
  explanation: string | null;
  directionalConfidencePct: number | null;
  placesOrders: false;
}

export interface CanonicalHtfContext {
  primaryTimeframe: CanonicalTimeframeId;
  confirmationTimeframes: CanonicalTimeframeId[];
  perTf: Array<{
    timeframe: CanonicalTimeframeId;
    candleRef: CanonicalCandleRef | null;
    deterministicBias: "BULLISH" | "BEARISH" | "NEUTRAL" | "UNKNOWN";
  }>;
  agreement: "AGREE_BULLISH" | "AGREE_BEARISH" | "CONFLICT" | "INSUFFICIENT" | "UNKNOWN";
}

export interface AnalysisConfidenceFactor {
  id:
    | "trend_alignment"
    | "momentum_evidence"
    | "htf_agreement"
    | "data_quality"
    | "ai_agreement";
  label: string;
  /** Contribution 0–100 before weight; null when unavailable. */
  scorePct: number | null;
  weight: number;
  available: boolean;
  unavailableReason: string | null;
  detail: string;
}

export interface AnalysisConfidenceBreakdown {
  modelVersion: typeof ANALYSIS_CONFIDENCE_MODEL_VERSION;
  confidenceType: typeof ANALYSIS_CONFIDENCE_TYPE;
  factors: AnalysisConfidenceFactor[];
  /** Sum of weights for available factors only. */
  availableWeightSum: number;
  /** Weighted average of available factors; null if none available. */
  weightedScorePct: number | null;
  limitations: string[];
  /** Explicit: not a calibrated win probability. */
  isCalibratedWinProbability: false;
}

export interface CanonicalAnalysisResult {
  schemaVersion: typeof CANONICAL_ANALYSIS_SCHEMA;
  analysisVersion: typeof CANONICAL_ANALYSIS_VERSION;
  analysisId: string;
  environment: AutomatedTradingEnvironment;
  instrument: string;
  provider: "FOREXCONNECT";
  primaryTimeframe: CanonicalTimeframeId;
  analyzedAtUtc: string;
  trigger: "candle_close" | "manual" | "scheduled_poll" | "offers_price_change" | "recovery" | "unit_test";
  evidenceFingerprint: string;
  quote: CanonicalQuoteSnapshot;
  dataQuality: "SUFFICIENT" | "PARTIAL" | "INSUFFICIENT" | "STALE_QUOTE";
  candleQuality: Pick<
    CandleQualityReport,
    "strategyReady" | "blockers" | "closedBars" | "invalidOhlcCount" | "duplicateCount"
  > | null;
  indicators: CanonicalIndicatorSet;
  marketStructure: {
    trendDirection: ProvenancedValue<"BULLISH" | "BEARISH" | "SIDEWAYS" | "UNKNOWN">;
    trendStrength: ProvenancedValue<"STRONG" | "MODERATE" | "WEAK" | "UNKNOWN">;
    momentum: ProvenancedValue<"UP" | "DOWN" | "FLAT" | "UNKNOWN">;
    volatilityRegime: ProvenancedValue<"LOW" | "NORMAL" | "HIGH" | "UNKNOWN">;
  };
  supportResistance: {
    support: ProvenancedValue<number | null>[];
    resistance: ProvenancedValue<number | null>[];
  };
  htf: CanonicalHtfContext | null;
  deterministic: CanonicalDeterministicStrategySlice | null;
  ai: CanonicalAiInterpretationSlice | null;
  /** Validity / reconciliation outcome — not a market direction. */
  finalOutcome: AnalysisFinalOutcome;
  /**
   * Market direction only when finalOutcome is BUY_CANDIDATE or SELL_CANDIDATE.
   * null for STALE_DATA | INSUFFICIENT_DATA | CONFLICT | NO_TRADE.
   */
  direction: CanonicalMarketDirection | null;
  marketInterpretation: CanonicalMarketInterpretation | null;
  confidencePct: number | null;
  confidenceType: typeof ANALYSIS_CONFIDENCE_TYPE;
  confidenceModelVersion: typeof ANALYSIS_CONFIDENCE_MODEL_VERSION;
  confidenceBreakdown: AnalysisConfidenceBreakdown | null;
  confidenceLimitations: string[];
  reconciliationCode: string;
  explanation: string[];
  validationErrors: Array<{ code: string; message: string }>;
  placesOrders: false;
  acceptsForExecution: false;
}

export type ReconciliationCode =
  | "RECON_STALE_QUOTE"
  | "RECON_INSUFFICIENT"
  | "RECON_NO_CROSS_AI_IGNORED"
  | "RECON_DIR_CONFLICT"
  | "RECON_DET_BUY"
  | "RECON_DET_SELL"
  | "RECON_DET_ONLY"
  | "RECON_HTF_CONFLICT"
  | "RECON_INSTRUMENT_MISMATCH"
  | "RECON_TIMEFRAME_MISMATCH";
