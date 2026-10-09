/**
 * Phase 34 — ForexConnect historical candle contracts.
 * Price basis is BID (BidOpen/BidHigh/BidLow/BidClose from ForexConnect.get_history).
 * Never silently convert bid↔mid/ask.
 */
import type { CanonicalTimeframeId } from "../providers/contracts.js";
import type { MarketAssetType } from "../providers/types.js";

export type ForexConnectPriceBasis = "bid";

export interface ForexConnectHistoricalCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  /** SDK Volume when finite and valid; otherwise null (never invented). */
  volume: number | null;
  closed: boolean;
  priceBasis: ForexConnectPriceBasis;
}

export interface SafeForexConnectHistoricalResult {
  ok: boolean;
  provider: "FOREXCONNECT";
  marketType: MarketAssetType;
  providerSymbol: string;
  canonicalSymbol: string;
  displaySymbol: string;
  timeframe: CanonicalTimeframeId;
  periodId: string;
  priceBasis: ForexConnectPriceBasis;
  environment: string;
  environmentLabel: string;
  candles: ForexConnectHistoricalCandle[];
  count: number;
  invalidCandles: number;
  duplicatesRemoved: number;
  fetchedAt: string;
  note: string;
  errorCode: string | null;
  errorMessage: string | null;
  lastHistoricalAt?: string | null;
}
