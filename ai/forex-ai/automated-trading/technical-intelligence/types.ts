/**
 * Phase 4.18F.3 — Technical intelligence types for AT analysis.
 * Analysis/signal-validation only. Never places or mutates broker orders.
 */

export const TECH_INTEL_SCHEMA = "kwizera.at-technical-intelligence.v1" as const;
export const INDICATOR_ENGINE_VERSION = "at-indicators.v1" as const;
export const SIGNAL_VALIDATION_VERSION = "at-signal-validation.v1" as const;

export type IndicatorQuality =
  | "VALID"
  | "INSUFFICIENT_DATA"
  | "STALE"
  | "INVALID_INPUT"
  | "UNAVAILABLE";

export type TrendStateIntel =
  | "BULLISH"
  | "BEARISH"
  | "RANGING"
  | "MIXED"
  | "UNKNOWN";

export type MomentumStateIntel =
  | "BULLISH_MOMENTUM"
  | "BEARISH_MOMENTUM"
  | "WEAK_MOMENTUM"
  | "MIXED_MOMENTUM"
  | "UNKNOWN";

export type VolatilityStateIntel =
  | "LOW"
  | "NORMAL"
  | "HIGH"
  | "EXTREME"
  | "UNKNOWN";

export type SignalValidationOutcome =
  | "BUY_CANDIDATE"
  | "SELL_CANDIDATE"
  | "NO_TRADE"
  | "CONFLICT"
  | "INSUFFICIENT_DATA"
  | "STALE_DATA";

export interface IndicatorRecord<T = number | null> {
  instrument: string;
  timeframe: string;
  name: string;
  parameters: Record<string, number | string>;
  value: T;
  previousValue?: number | null;
  method: string;
  engineVersion: typeof INDICATOR_ENGINE_VERSION;
  candleTimestampSec: number | null;
  calculatedAtMs: number;
  inputCandleCount: number;
  dataFreshness: "FRESH" | "STALE" | "UNKNOWN";
  quality: IndicatorQuality;
  note?: string;
}

export interface MovingAverageBundle {
  sma9: IndicatorRecord;
  sma21: IndicatorRecord;
  sma50: IndicatorRecord;
  sma200: IndicatorRecord;
  ema9: IndicatorRecord;
  ema21: IndicatorRecord;
  ema50: IndicatorRecord;
  ema200: IndicatorRecord;
  priceVsSma21: "ABOVE" | "BELOW" | "AT" | "UNKNOWN";
  sma9VsSma21: "ABOVE" | "BELOW" | "AT" | "UNKNOWN";
  sma9Slope: "UP" | "DOWN" | "FLAT" | "UNKNOWN";
  crossover: "BULLISH_CROSS" | "BEARISH_CROSS" | "NONE" | "UNKNOWN";
}

export interface RsiBundle {
  rsi14: IndicatorRecord;
  zone: "OVERBOUGHT" | "OVERSOLD" | "NEUTRAL" | "UNKNOWN";
  momentum: "RISING" | "FALLING" | "FLAT" | "UNKNOWN";
  /** Divergence only when swing evidence is present; otherwise UNAVAILABLE. */
  divergence: "BULLISH" | "BEARISH" | "NONE" | "UNAVAILABLE";
}

export interface MacdBundle {
  macd: IndicatorRecord;
  signal: IndicatorRecord;
  histogram: IndicatorRecord;
  cross: "BULLISH_CROSS" | "BEARISH_CROSS" | "NONE" | "UNKNOWN";
  histogramMomentum: "EXPANDING_BULL" | "EXPANDING_BEAR" | "CONTRACTING" | "UNKNOWN";
}

export interface BollingerBundle {
  middle: IndicatorRecord;
  upper: IndicatorRecord;
  lower: IndicatorRecord;
  bandwidth: IndicatorRecord;
  pricePosition: "ABOVE_UPPER" | "BELOW_LOWER" | "INSIDE" | "AT_MIDDLE" | "UNKNOWN";
  volatilityRegime: "EXPANSION" | "CONTRACTION" | "UNKNOWN";
}

export interface AtrBundle {
  atr: IndicatorRecord;
  atrPctOfPrice: IndicatorRecord;
  method: "SMA_OF_TR";
  volatilityClass: VolatilityStateIntel;
}

export interface AdxBundle {
  adx: IndicatorRecord;
  plusDi: IndicatorRecord;
  minusDi: IndicatorRecord;
  trendStrength: "ABSENT" | "WEAK" | "MODERATE" | "STRONG" | "UNKNOWN";
}

export interface IndicatorSuite {
  schemaVersion: typeof TECH_INTEL_SCHEMA;
  engineVersion: typeof INDICATOR_ENGINE_VERSION;
  instrument: string;
  timeframe: string;
  closedCandleCount: number;
  lastClosedCandleSec: number | null;
  calculatedAtMs: number;
  movingAverages: MovingAverageBundle;
  rsi: RsiBundle;
  macd: MacdBundle;
  bollinger: BollingerBundle;
  atr: AtrBundle;
  adx: AdxBundle;
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
}

export interface StructureIntelSummary {
  trendState: string;
  confirmedSwings: number;
  provisionalSwings: number;
  classifications: Array<{ label: string; kind: string; price: number; time: number }>;
  events: Array<{
    type: string;
    direction: string;
    status: string;
    level: number;
    breakCandleTime: number;
  }>;
  zones: Array<{ kind: string; mid: number; status: string }>;
  rangeHigh: number | null;
  rangeLow: number | null;
  method: string;
  quality: IndicatorQuality;
  note: string;
}

export interface MarketConditionRecord {
  schemaVersion: typeof TECH_INTEL_SCHEMA;
  instrument: string;
  timeframe: string;
  trend: TrendStateIntel;
  momentum: MomentumStateIntel;
  volatility: VolatilityStateIntel;
  trendEvidence: string[];
  momentumEvidence: string[];
  volatilityEvidence: string[];
  insufficient: boolean;
  stale: boolean;
  calculatedAtMs: number;
}

export interface SignalValidationRecord {
  schemaVersion: typeof TECH_INTEL_SCHEMA;
  validationVersion: typeof SIGNAL_VALIDATION_VERSION;
  instrument: string;
  timeframe: string;
  outcome: SignalValidationOutcome;
  strategyDirection: "BUY" | "SELL" | "NO_TRADE" | null;
  strategyCode: string | null;
  indicatorAgreement: "SUPPORTS" | "CONFLICTS" | "NEUTRAL" | "UNKNOWN";
  structureAgreement: "SUPPORTS" | "CONFLICTS" | "NEUTRAL" | "UNKNOWN";
  trendAlignment: "ALIGNED" | "OPPOSED" | "NEUTRAL" | "UNKNOWN";
  momentumConfirmation: "CONFIRMED" | "OPPOSED" | "WEAK" | "UNKNOWN";
  volatilityCondition: VolatilityStateIntel;
  dataQuality: IndicatorQuality;
  rejectionReasons: string[];
  supportReasons: string[];
  confidenceType: "ANALYSIS_CONFIDENCE";
  isCalibratedWinProbability: false;
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
  calculatedAtMs: number;
}
