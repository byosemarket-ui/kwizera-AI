/**
 * Deterministic market structure engine — Phase 38D.
 * Rule-based swings / BOS / CHoCH / zones. No LLM. Not a trade signal.
 */

export const STRUCTURE_SCHEMA_VERSION = "forex-market-structure-v1" as const;

export type StructureProviderId = "BINANCE" | "FXCM" | "FOREXCONNECT";
export type SwingKind = "HIGH" | "LOW";
export type SwingStatus = "PROVISIONAL" | "CONFIRMED";
export type ClassificationLabel = "HH" | "HL" | "LH" | "LL" | "EQUAL_HIGH" | "EQUAL_LOW";
export type TrendState = "BULLISH" | "BEARISH" | "RANGE" | "UNKNOWN";
export type StructureEventType = "BOS" | "CHOCH";
export type StructureEventDirection = "BULLISH" | "BEARISH";
export type StructureEventStatus = "CANDIDATE" | "CONFIRMED";
export type ZoneKind = "SUPPORT" | "RESISTANCE" | "PIVOT";
export type ZoneStatus = "ACTIVE" | "BROKEN" | "STALE";

/** Raw OHLC candle — same shape as PatternCandle (provider-agnostic). */
export interface StructureCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  /** Prefer isClosed; closed is accepted as alias. */
  isClosed?: boolean;
  closed?: boolean;
}

export interface StructureRuleParams {
  swingLeft: number;
  /** Confirmation window — swing at i confirmed only when candles i+1..i+right have CLOSED. */
  swingRight: number;
  /** Relative to price scale for equal high/low ties. */
  equalHighLowEpsilonRel: number;
  /** Break requires close beyond level by this relative buffer (0 = exact). */
  bosBufferRel: number;
  /** When true, wick-only beyond level → CANDIDATE; close beyond → CONFIRMED. */
  requireCloseBeyond: boolean;
  /** Relative tolerance of mid price for grouping swings into zones. */
  zoneToleranceRel: number;
  maxSwings: number;
  maxEvents: number;
  maxZones: number;
  scanBars: number;
  /** Zone unused/broken → STALE after this many bars from last touch. */
  staleZoneBars: number;
  minConfirmedSwingsForTrend: number;
}

export interface StructureDetectionInput {
  provider: StructureProviderId;
  environment?: string | null;
  symbol: string;
  timeframe: string;
  candles: StructureCandle[];
  /** If true, last forming candle may yield PROVISIONAL swings / CANDIDATE events. */
  includeForming?: boolean;
  params?: Partial<StructureRuleParams>;
  priceBasis?: string | null;
}

export interface StructureValidationInfo {
  ok: boolean;
  skippedInvalid: number;
  skippedDuplicates: number;
  warnings: string[];
  insufficientHistory: boolean;
}

export interface StructureSwing {
  id: string;
  kind: SwingKind;
  price: number;
  time: number;
  index: number;
  status: SwingStatus;
  evidence: string[];
}

export interface SwingClassification {
  swingId: string;
  kind: SwingKind;
  label: ClassificationLabel;
  price: number;
  time: number;
  priorSwingId: string;
  priorPrice: number;
  evidence: string[];
}

export interface StructureEvent {
  id: string;
  type: StructureEventType;
  direction: StructureEventDirection;
  status: StructureEventStatus;
  level: number;
  levelTime: number;
  levelSwingId: string;
  breakCandleTime: number;
  breakCandleIndex: number;
  evidence: string[];
  /** Dedup key: `${type}:${direction}:${levelTime}:${breakCandleTime}` */
  eventKey: string;
}

export interface StructureZone {
  id: string;
  kind: ZoneKind;
  low: number;
  high: number;
  mid: number;
  sourceSwingIds: string[];
  touchCount: number;
  lastTouchIndex: number;
  status: ZoneStatus;
  evidence: string[];
}

export interface MarketStructureAnalysisResult {
  schemaVersion: typeof STRUCTURE_SCHEMA_VERSION;
  ruleVersion: string;
  provider: string;
  environment?: string | null;
  symbol: string;
  timeframe: string;
  analyzedAt: number;
  analyzedClosedCount: number;
  formingExcluded: boolean;
  swings: StructureSwing[];
  classifications: SwingClassification[];
  trendState: TrendState;
  events: StructureEvent[];
  zones: StructureZone[];
  validation: StructureValidationInfo;
  warnings: string[];
  note: string;
  parameters: Record<string, number>;
  priceBasis?: string | null;
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
