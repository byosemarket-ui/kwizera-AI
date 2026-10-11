/**
 * Deterministic candlestick pattern detection — Phase 38C.
 * Rule-based geometry only. No LLM. Not a trade signal.
 */

export const PATTERN_SCHEMA_VERSION = "forex-candlestick-patterns-v1" as const;
export const PATTERN_FAMILY = "CANDLESTICK" as const;

export type PatternProviderId = "BINANCE" | "FXCM" | "FOREXCONNECT";
export type PatternDirection = "BULLISH" | "BEARISH" | "NEUTRAL";
export type PatternStatus = "CANDIDATE" | "CONFIRMED" | "INVALID";

/** Raw OHLC candle accepted by the detector (provider-agnostic). */
export interface PatternCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  /** Prefer isClosed; closed is accepted as alias. */
  isClosed?: boolean;
  closed?: boolean;
}

export interface PatternRuleParams {
  dojiBodyMaxRatio: number;
  hammerBodyMaxRatio: number;
  hammerLowerWickMinRatio: number;
  hammerUpperWickMaxRatio: number;
  shootingStarBodyMaxRatio: number;
  shootingStarUpperWickMinRatio: number;
  shootingStarLowerWickMaxRatio: number;
  engulfingMinBodyRatio: number;
  starMiddleBodyMaxRatio: number;
  /** Soft star gap/penetration: middle small between opposites OR close in gap zone. */
  starGapOrPenetrationFactor: number;
  /** Relative floor — treat range <= this * max(|o|,|c|,|h|,|l|,1) as zero-range. */
  minRangeEpsilon: number;
  /** Lookback of closed bars to scan for pattern endings. */
  scanBars: number;
  /** Cap detections returned (newest first). */
  maxDetections: number;
}

export interface PatternDetectionInput {
  provider: PatternProviderId;
  environment?: string | null;
  symbol: string;
  timeframe: string;
  candles: PatternCandle[];
  /** If true, last candle may be forming — never CONFIRM on incomplete. */
  includeForming?: boolean;
  params?: Partial<PatternRuleParams>;
  priceBasis?: string | null;
}

export interface PatternValidationInfo {
  ok: boolean;
  skippedInvalid: number;
  skippedDuplicates: number;
  warnings: string[];
  insufficientHistory: boolean;
}

export interface CandlestickPatternDetection {
  patternId: string;
  patternName: string;
  patternFamily: typeof PATTERN_FAMILY;
  direction: PatternDirection;
  status: PatternStatus;
  provider: string;
  environment?: string | null;
  symbol: string;
  timeframe: string;
  candleStartTime: number;
  candleEndTime: number;
  candleTimes: number[];
  ruleVersion: string;
  parameters: Record<string, number>;
  evidence: string[];
  confirmationRequirement: string;
  invalidationCondition: string;
  warnings: string[];
  priceBasis?: string | null;
}

export interface PatternAnalysisResult {
  schemaVersion: typeof PATTERN_SCHEMA_VERSION;
  ruleVersion: string;
  provider: string;
  symbol: string;
  timeframe: string;
  detections: CandlestickPatternDetection[];
  validation: PatternValidationInfo;
  analyzedClosedCount: number;
  formingExcluded: boolean;
  note: string;
}

/** Minimal UnifiedCandle-compatible shape for fromUnifiedCandles. */
export interface UnifiedCandleLike {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  isClosed?: boolean;
  closed?: boolean;
}
