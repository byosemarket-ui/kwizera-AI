/**
 * Phase 28 — FXCM historical candle contracts (safe / public shapes).
 */
import type { MarketAssetType } from "../providers/types.js";
import type { FxcmEnvironment } from "./config.js";
import type { FxcmPeriodId, FxcmSupportedProjectTimeframe } from "./timeframes.js";

export type FxcmHistoricalQualityStatus = "VALID" | "PARTIAL" | "INVALID" | "NO_DATA";

export type FxcmHistoricalGapKind = "UNEXPECTED_DATA_GAP" | "EXPECTED_SESSION_GAP";

export interface FxcmHistoricalGap {
  kind: FxcmHistoricalGapKind;
  gapStart: string;
  gapEnd: string;
  expectedIntervalMs: number;
  missingCandlesEstimate: number;
}

export interface FxcmHistoricalCandle {
  /** Epoch seconds UTC — same unit as Binance NormalizedCandle.time */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  /** FXCM returns tick quantity, not traded volume — null when absent. */
  volume: null;
  tickQty: number | null;
  /** Historical completed bars are closed; forming bar (if present) is false. */
  closed: boolean;
  /** Mid OHLC from official bid/ask fields — documented price basis. */
  priceBasis: "mid";
}

export interface FxcmHistoricalQuality {
  status: FxcmHistoricalQualityStatus;
  candleCount: number;
  firstTimestamp: string | null;
  lastTimestamp: string | null;
  duplicatesRemoved: number;
  invalidCandles: number;
  gaps: FxcmHistoricalGap[];
  source: "FXCM" | "CACHE";
  providerSource: "FXCM";
  mode: "HISTORICAL";
}

export interface FxcmHistoricalRequest {
  symbol: string;
  timeframe: string;
  startTimeMs?: number | null;
  endTimeMs?: number | null;
  limit?: number | null;
  refresh?: boolean;
  signal?: AbortSignal;
}

export interface SafeFxcmHistoricalResult {
  provider: "FXCM";
  environment: FxcmEnvironment;
  environmentLabel: "FXCM DEMO" | "FXCM REAL";
  marketType: MarketAssetType;
  symbol: string;
  canonicalSymbol: string;
  providerSymbol: string;
  displaySymbol: string;
  timeframe: FxcmSupportedProjectTimeframe;
  providerPeriod: FxcmPeriodId;
  source: "FXCM" | "CACHE";
  providerSource: "FXCM";
  mode: "HISTORICAL";
  liveStream: "NOT_ENABLED_YET";
  trading: "DISABLED";
  fetchedAt: string;
  startTime: string | null;
  endTime: string | null;
  count: number;
  candles: FxcmHistoricalCandle[];
  quality: FxcmHistoricalQuality;
  offerId: number | null;
  mappingStatus: string;
  note: string;
  errorCode: string | null;
  errorMessage: string | null;
}
