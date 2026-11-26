/**
 * STEP 2 — Charts → AI Analysis data contract (HFM_MT5 only).
 * Not an Analysis implementation. No signals / orders / confidence fields.
 */

export const HFM_CHARTS_ANALYSIS_PROVIDER = "HFM_MT5" as const;
export const HFM_CHARTS_ANALYSIS_ENVIRONMENT = "demo" as const;

export type HfmChartsAnalysisFreshness =
  | "LIVE"
  | "DELAYED"
  | "STALE"
  | "MARKET_CLOSED"
  | "NO_QUOTE"
  | "NO_HISTORY"
  | "INCOMPLETE"
  | "INVALID"
  | "WAITING_FOR_DATA"
  | "DISCONNECTED"
  | "RECONNECTING"
  | "ERROR"
  | "DATA_UNAVAILABLE";

export type HfmChartsAnalysisValidationStatus =
  | "ok"
  | "partial"
  | "rejected"
  | "unavailable";

/** Closed or forming OHLC bar from HFM CopyRates / live aggregation (unix seconds). */
export interface HfmChartsAnalysisCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  tickVolume: number | null;
  realVolume: number | null;
  spread: number | null;
  closed?: boolean;
  provenance?: "native" | "derived" | "cached" | "live_aggregate";
}

export interface HfmChartsAnalysisTick {
  bid: number;
  ask: number;
  last: number | null;
  /** Broker-domain tick seconds — NOT UTC. */
  brokerTimestamp: number | null;
  /** Trusted UTC tick seconds when normalization succeeded. */
  quoteTimestampUtc?: number | null;
  quoteTimestampUtcMs?: number | null;
  brokerUtcOffsetSec?: number | null;
  timestampNormalizationStatus?: string | null;
  marketSessionState?: string | null;
  quoteFreshnessStatus?: string | null;
  tickAgeSec?: number | null;
  snapshotAgeSec?: number | null;
  receiptAgeSec?: number | null;
  dataQualityStatus?: string | null;
  freshnessReason?: string | null;
  quoteVersionId?: string | null;
  quoteProvenance?: string | null;
  receiveTimestamp: string | null;
  acquisition: string;
}

export interface HfmChartsAnalysisIndicatorDefinition {
  id: string;
  name: string;
  parameters: Record<string, number | string | boolean>;
}

/**
 * Snapshot the Charts engine will eventually expose to Analysis.
 * Multiple timeframes may be requested independently by Analysis.
 */
export interface HfmChartsAnalysisSnapshot {
  provider: typeof HFM_CHARTS_ANALYSIS_PROVIDER;
  environment: typeof HFM_CHARTS_ANALYSIS_ENVIRONMENT;
  symbol: string;
  instrumentDescription: string | null;
  timeframe: string;
  /** True when timeframe is outside the verified live set (M1–D1). */
  unsupportedTimeframe: boolean;
  historicalCandles: HfmChartsAnalysisCandle[];
  currentCandle: HfmChartsAnalysisCandle | null;
  bid: number | null;
  ask: number | null;
  spread: number | null;
  latestTick: HfmChartsAnalysisTick | null;
  /** Legacy alias of latestTick.brokerTimestamp (broker-domain — NOT UTC). */
  tickTimestamp: number | null;
  /** Trusted UTC tick when available. */
  quoteTimestampUtc: number | null;
  receiveTimestamp: string | null;
  freshness: HfmChartsAnalysisFreshness;
  connectionStatus: string;
  validationStatus: HfmChartsAnalysisValidationStatus;
  indicatorDefinitions: HfmChartsAnalysisIndicatorDefinition[];
  /** Optional last computed indicator values for the forming tip (read-only). */
  indicatorValues: Array<{ id: string; name: string; value: number | null }>;
  sourceIdentity: string;
  sourceProvenance: string;
  /** Analysis may request any timeframe independently of the visible chart. */
  analysisMayRequestIndependentTimeframe: true;
  placesOrders: false;
  mutatesBroker: false;
  acceptsForExecution: false;
}

const VERIFIED_LIVE = new Set(["M1", "M5", "M15", "M30", "H1", "H4", "D1"]);

/** Builder used by STEP 3/Analysis consumers — no signals. */
export function buildHfmChartsAnalysisSnapshot(input: {
  symbol: string;
  instrumentDescription?: string | null;
  timeframe: string;
  historicalCandles: HfmChartsAnalysisCandle[];
  currentCandle?: HfmChartsAnalysisCandle | null;
  bid?: number | null;
  ask?: number | null;
  latestTick?: HfmChartsAnalysisTick | null;
  freshness: HfmChartsAnalysisFreshness;
  connectionStatus?: string;
  validationStatus: HfmChartsAnalysisValidationStatus;
  sourceProvenance: string;
  indicatorDefinitions?: HfmChartsAnalysisIndicatorDefinition[];
  indicatorValues?: Array<{ id: string; name: string; value: number | null }>;
}): HfmChartsAnalysisSnapshot {
  const bid = input.bid ?? input.latestTick?.bid ?? null;
  const ask = input.ask ?? input.latestTick?.ask ?? null;
  let spread: number | null = null;
  if (bid != null && ask != null && Number.isFinite(bid) && Number.isFinite(ask) && ask >= bid) {
    // Prefer rounded display-safe spread in the contract (digits ≈ 5 fallback).
    spread = Math.round((ask - bid) * 1e10) / 1e10;
  }
  const tf = input.timeframe.toUpperCase();
  return {
    provider: HFM_CHARTS_ANALYSIS_PROVIDER,
    environment: HFM_CHARTS_ANALYSIS_ENVIRONMENT,
    symbol: input.symbol.toUpperCase(),
    instrumentDescription: input.instrumentDescription ?? null,
    timeframe: input.timeframe,
    unsupportedTimeframe: !VERIFIED_LIVE.has(tf),
    historicalCandles: input.historicalCandles,
    currentCandle: input.currentCandle ?? null,
    bid,
    ask,
    spread,
    latestTick: input.latestTick ?? null,
    tickTimestamp: input.latestTick?.brokerTimestamp ?? null,
    quoteTimestampUtc: input.latestTick?.quoteTimestampUtc ?? null,
    receiveTimestamp: input.latestTick?.receiveTimestamp ?? null,
    freshness: input.freshness,
    connectionStatus: input.connectionStatus ?? input.freshness,
    validationStatus: input.validationStatus,
    indicatorDefinitions: input.indicatorDefinitions ?? [],
    indicatorValues: input.indicatorValues ?? [],
    sourceIdentity: "HFM_MT5",
    sourceProvenance: input.sourceProvenance,
    analysisMayRequestIndependentTimeframe: true,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
  };
}
