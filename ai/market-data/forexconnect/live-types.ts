/**
 * Phase 35 — ForexConnect live quote / forming-candle contracts.
 * Candle OHLC price basis remains BID (matches Phase 34 get_history).
 * Quote payloads may also expose ask and derived mid for display — never mix bases in candles.
 */
import type { CanonicalTimeframeId } from "../providers/contracts.js";
import type { MarketAssetType } from "../providers/types.js";

export type ForexConnectLiveStreamState =
  | "DISABLED"
  | "NOT_CONFIGURED"
  | "DISCONNECTED"
  | "SUBSCRIBING"
  | "SUBSCRIBED_WAITING"
  | "MARKET_INACTIVE"
  | "LIVE"
  | "STALE"
  | "ERROR"
  | "SERVICE_UNAVAILABLE";

export interface ForexConnectLiveQuote {
  provider: "FOREXCONNECT";
  providerSymbol: string;
  canonicalSymbol: string;
  displaySymbol: string;
  bid: number | null;
  ask: number | null;
  /** Derived (bid+ask)/2 only when both valid; not used for candle OHLC. */
  mid: number | null;
  /** Candle aggregation price — always bid when bid is valid. */
  candlePrice: number | null;
  priceBasis: "bid";
  sourceTimestampMs: number | null;
  receivedAtMs: number;
  offerId?: string | null;
}

export interface ForexConnectLiveCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
  closed: boolean;
  priceBasis: "bid";
  provider: "FOREXCONNECT";
  marketType: MarketAssetType;
  providerSymbol: string;
  canonicalSymbol: string;
  timeframe: CanonicalTimeframeId;
}

export interface SafeForexConnectLiveSeries {
  ok: boolean;
  provider: "FOREXCONNECT";
  marketType: MarketAssetType;
  providerSymbol: string;
  canonicalSymbol: string;
  displaySymbol: string;
  timeframe: CanonicalTimeframeId;
  priceBasis: "bid";
  environment: string;
  environmentLabel: string;
  mode: "HISTORICAL" | "LIVE" | "HISTORICAL_LIVE";
  streamState: ForexConnectLiveStreamState;
  candles: ForexConnectLiveCandle[];
  forming: ForexConnectLiveCandle | null;
  count: number;
  lastQuoteAt: string | null;
  lastQuoteAgeMs: number | null;
  updateCount: number;
  note: string;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface ForexConnectStreamDiagnostics {
  callbackRegistered: boolean;
  callbackInvocations: number;
  callbackAccepted: number;
  callbackFiltered: number;
  callbackNoBid: number;
  callbackParseFailures: number;
  pollCycles: number;
  pollChanges: number;
  lastCallbackAt: string | null;
  lastPollChangeAt: string | null;
  offersPollerActive: boolean;
}

export interface ForexConnectStreamStatus {
  ok: boolean;
  provider: "FOREXCONNECT";
  sessionStatus: string;
  streamState: ForexConnectLiveStreamState;
  offersListenerActive: boolean;
  offersPollerActive?: boolean;
  callbackRegistered?: boolean;
  subscriptionCount: number;
  subscriptions: string[];
  maxSubscriptions: number;
  lastQuoteAt: string | null;
  lastQuoteAgeMs: number | null;
  lastStreamError: string | null;
  updateCount: number;
  lastEventSource?: string | null;
  diagnostics?: ForexConnectStreamDiagnostics | null;
  priceBasis: "bid";
  trading: "DISABLED";
  note?: string;
}
