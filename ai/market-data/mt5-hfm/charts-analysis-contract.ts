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
  brokerTimestamp: number | null;
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
  historicalCandles: HfmChartsAnalysisCandle[];
  currentCandle: HfmChartsAnalysisCandle | null;
  bid: number | null;
  ask: number | null;
  spread: number | null;
  latestTick: HfmChartsAnalysisTick | null;
  tickTimestamp: number | null;
  receiveTimestamp: string | null;
  freshness: HfmChartsAnalysisFreshness;
  validationStatus: HfmChartsAnalysisValidationStatus;
  indicatorDefinitions: HfmChartsAnalysisIndicatorDefinition[];
  sourceIdentity: string;
  sourceProvenance: string;
  placesOrders: false;
  mutatesBroker: false;
  acceptsForExecution: false;
}

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
  validationStatus: HfmChartsAnalysisValidationStatus;
  sourceProvenance: string;
  indicatorDefinitions?: HfmChartsAnalysisIndicatorDefinition[];
}): HfmChartsAnalysisSnapshot {
  const bid = input.bid ?? input.latestTick?.bid ?? null;
  const ask = input.ask ?? input.latestTick?.ask ?? null;
  const spread =
    bid != null && ask != null && Number.isFinite(bid) && Number.isFinite(ask) && ask >= bid
      ? ask - bid
      : null;
  return {
    provider: HFM_CHARTS_ANALYSIS_PROVIDER,
    environment: HFM_CHARTS_ANALYSIS_ENVIRONMENT,
    symbol: input.symbol.toUpperCase(),
    instrumentDescription: input.instrumentDescription ?? null,
    timeframe: input.timeframe,
    historicalCandles: input.historicalCandles,
    currentCandle: input.currentCandle ?? null,
    bid,
    ask,
    spread,
    latestTick: input.latestTick ?? null,
    tickTimestamp: input.latestTick?.brokerTimestamp ?? null,
    receiveTimestamp: input.latestTick?.receiveTimestamp ?? null,
    freshness: input.freshness,
    validationStatus: input.validationStatus,
    indicatorDefinitions: input.indicatorDefinitions ?? [],
    sourceIdentity: "HFM_MT5",
    sourceProvenance: input.sourceProvenance,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
  };
}
