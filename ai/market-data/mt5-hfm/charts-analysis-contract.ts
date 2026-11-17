/**
 * STEP 1 — future Charts → AI Analysis data contract (HFM_MT5 only).
 * Not an Analysis implementation. No signals / orders / confidence fields.
 */

export const HFM_CHARTS_ANALYSIS_PROVIDER = "HFM_MT5" as const;
export const HFM_CHARTS_ANALYSIS_ENVIRONMENT = "demo" as const;

export type HfmChartsAnalysisFreshness =
  | "LIVE"
  | "STALE"
  | "MARKET_CLOSED"
  | "WAITING_FOR_DATA"
  | "DISCONNECTED"
  | "DATA_UNAVAILABLE";

export type HfmChartsAnalysisValidationStatus =
  | "ok"
  | "partial"
  | "rejected"
  | "unavailable";

/** Closed OHLC bar from HFM CopyRates (unix seconds). */
export interface HfmChartsAnalysisCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  tickVolume: number | null;
  realVolume: number | null;
  spread: number | null;
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
  tickTimestamp: number | null;
  receiveTimestamp: string | null;
  freshness: HfmChartsAnalysisFreshness;
  validationStatus: HfmChartsAnalysisValidationStatus;
  indicatorDefinitions: HfmChartsAnalysisIndicatorDefinition[];
  sourceIdentity: string;
  placesOrders: false;
  mutatesBroker: false;
  acceptsForExecution: false;
}
