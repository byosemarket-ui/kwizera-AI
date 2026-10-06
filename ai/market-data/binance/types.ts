/**
 * Normalized market-data types for KWIZERA AI STUDIO.
 * Binance raw payloads must be adapted into these shapes before UI use.
 */

export const MARKET_CONNECTION_STATES = [
  "DISCONNECTED",
  "CONNECTING",
  "CONNECTED",
  "RECONNECTING",
  "ERROR",
] as const;

export type MarketConnectionState = (typeof MARKET_CONNECTION_STATES)[number];

export type NormalizedTimeframeId = "1m" | "5m" | "15m" | "30m" | "1h" | "4h" | "1d" | "1w";

export type BinanceMarketStatus =
  | "TRADING"
  | "BREAK"
  | "HALT"
  | "AUCTION_MATCH"
  | "PRE_TRADING"
  | "POST_TRADING"
  | "END_OF_DAY"
  | "UNKNOWN";

export interface NormalizedInstrument {
  venue: "binance-spot";
  symbol: string;
  displaySymbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: "trading" | "break" | "unknown";
}

export interface NormalizedMarket {
  venue: "binance-spot";
  marketType: "spot";
  symbol: string;
  displaySymbol: string;
  displayName: string;
  baseAsset: string;
  quoteAsset: string;
  status: BinanceMarketStatus;
  tradable: boolean;
  permissions: string[];
  source: "binance-spot-public";
}

export interface NormalizedCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closed: boolean;
}

export interface NormalizedTicker {
  instrument: NormalizedInstrument;
  price: number;
  change: number | null;
  changePercent: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
  eventTimeUtc: number;
}

export interface NormalizedSeries {
  instrument: NormalizedInstrument;
  timeframe: NormalizedTimeframeId;
  candles: NormalizedCandle[];
  kind: "live" | "rest-snapshot";
}

export interface MarketConnectionSnapshot {
  state: MarketConnectionState;
  /** True only when a real Binance session is delivering valid market data. Phase 6 never sets this. */
  liveMarketData: boolean;
  websocketActive: boolean;
  restReachable: boolean;
  source: "binance-spot-public";
  environment: "development" | "production";
  restBaseHost: string;
  serverTimeUtc: number | null;
  probedAtUtc: number;
  message: string;
  errorCode: string | null;
  capabilities: {
    ping: boolean;
    exchangeInfo: boolean;
    klines: boolean;
    ticker: boolean;
    websocket: boolean;
    trading: boolean;
  };
}

export const PHASE6_CAPABILITIES = {
  ping: true,
  exchangeInfo: false,
  klines: false,
  ticker: false,
  websocket: false,
  trading: false,
} as const;

export const PHASE7_CAPABILITIES = {
  ping: true,
  exchangeInfo: true,
  klines: false,
  ticker: false,
  websocket: false,
  trading: false,
} as const;

export const PHASE8_CAPABILITIES = {
  ping: true,
  exchangeInfo: true,
  klines: false,
  ticker: true,
  websocket: true,
  trading: false,
} as const;

export const PHASE9_CAPABILITIES = {
  ping: true,
  exchangeInfo: true,
  klines: true,
  ticker: true,
  websocket: true,
  trading: false,
} as const;

export type LiveStreamType = "miniTicker" | "trade" | "kline";

export interface NormalizedLiveTicker {
  venue: "binance-spot";
  symbol: string;
  displaySymbol: string;
  price: number;
  eventTimeUtc: number;
  receivedAtUtc: number;
  source: "binance-spot-public";
  streamType: "miniTicker";
  open: number | null;
  high: number | null;
  low: number | null;
}

export interface LiveTickerSnapshot {
  connectionState: MarketConnectionState;
  liveMarketData: boolean;
  websocketActive: boolean;
  subscribedSymbol: string | null;
  ticker: NormalizedLiveTicker | null;
  message: string;
  errorCode: string | null;
  websocketHost: string | null;
  streamType: "miniTicker";
  source: "binance-spot-public";
}

export interface NormalizedLiveKline {
  venue: "binance-spot";
  symbol: string;
  timeframe: NormalizedTimeframeId;
  candle: NormalizedCandle;
  eventTimeUtc: number;
  receivedAtUtc: number;
  source: "binance-spot-public";
  streamType: "kline";
}

export interface LiveKlineSnapshot {
  connectionState: MarketConnectionState;
  liveMarketData: boolean;
  websocketActive: boolean;
  subscribedSymbol: string | null;
  timeframe: NormalizedTimeframeId | null;
  kline: NormalizedLiveKline | null;
  message: string;
  errorCode: string | null;
  websocketHost: string | null;
  streamType: "kline";
  source: "binance-spot-public";
}
