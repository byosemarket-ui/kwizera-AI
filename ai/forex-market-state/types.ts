/**
 * Provider-aware Market State — Phases 18 + 31.
 * Facts only. AI reasoning consumes this later; never invent market numbers.
 * Same engine for BINANCE and FXCM — provider identity is always retained.
 */

import type { NormalizedTimeframeId } from "../market-data/binance/types.js";
import type { MarketProviderId } from "../market-data/providers/types.js";

export const FOREX_MARKET_STATE_VERSION = "forex-market-state-v1";

/** Mirrors desktop live-market-status — kept here to avoid ai→desktop imports. */
export type MarketStateConnection =
  | "CONNECTING"
  | "CONNECTED"
  | "LIVE"
  | "RECONNECTING"
  | "DISCONNECTED"
  | "ERROR"
  | "NO_DATA";

export type ForexMarketStateProvider = MarketProviderId;
export type ForexMarketType = "SPOT" | "CRYPTO" | "FOREX" | "CFD" | "COMMODITY" | "INDEX" | "OTHER";
export type TrendDirection = "BULLISH" | "BEARISH" | "NEUTRAL";
export type TrendStrength = "STRONG" | "MODERATE" | "WEAK" | "UNKNOWN";
export type MomentumClassification = "STRONG" | "POSITIVE" | "NEUTRAL" | "NEGATIVE" | "WEAK";
export type VolatilityClassification = "LOW" | "NORMAL" | "HIGH" | "EXTREME" | "UNKNOWN";
export type VolumeClassification = "ABOVE_AVERAGE" | "AVERAGE" | "BELOW_AVERAGE" | "UNKNOWN";
export type VolumeDirection = "INCREASING" | "DECREASING" | "STABLE" | "UNKNOWN";

export interface MarketStateCandle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  /** Unix seconds — candle open. */
  openTime: number;
  /** Unix seconds — interval end (open + timeframe). */
  closeTime: number;
  isClosed: boolean;
}

export interface MarketStatePrice {
  last: number;
  open: number;
  high: number;
  low: number;
  close: number;
  /** Absolute change vs previous closed candle close. */
  absoluteChange: number | null;
  /** Percent change vs previous closed candle close. */
  percentageChange: number | null;
  /** Reference used for change: previous closed candle close. */
  changeReference: "PREVIOUS_CLOSED_CANDLE" | "NONE";
}

export interface MarketStateVolume {
  current: number;
  average: number | null;
  relativeRatio: number | null;
  classification: VolumeClassification;
  direction: VolumeDirection;
  lookback: number;
}

export interface MarketStateVolatility {
  atr: number | null;
  atrPercent: number | null;
  classification: VolatilityClassification;
  period: number;
}

export interface MarketStateTrend {
  direction: TrendDirection;
  strength: TrendStrength;
  priceVsEma50: "ABOVE" | "BELOW" | "UNKNOWN";
  sma20VsSma50: "ABOVE" | "BELOW" | "UNKNOWN" | "EQUAL";
}

export interface MarketStateMomentum {
  rsi: number | null;
  macd: {
    value: number | null;
    signal: number | null;
    histogram: number | null;
  };
  classification: MomentumClassification;
}

export interface MarketStateIndicators {
  sma20: number | null;
  sma50: number | null;
  ema50: number | null;
  rsi14: number | null;
  macd: {
    value: number | null;
    signal: number | null;
    histogram: number | null;
  };
  bollinger: {
    mid: number | null;
    upper: number | null;
    lower: number | null;
    widthPct: number | null;
  };
  atr14: number | null;
}

export interface MarketStateStructure {
  trend: TrendDirection | "UNKNOWN";
  lastSwingHigh: number | null;
  lastSwingLow: number | null;
  structureState: "INSUFFICIENT_DATA" | "BASIC_SWINGS";
}

export interface MarketStateDataQuality {
  connection: MarketStateConnection;
  /** Market event time in ms UTC when known. */
  lastUpdate: number | null;
  stale: boolean;
  candleCount: number;
  valid: boolean;
  reason?: string;
}

/**
 * Authoritative structured market facts for one provider+symbol+timeframe.
 * `exchange` mirrors `provider` for Phase 17–22 AI contract compatibility.
 */
export interface ForexBinanceMarketState {
  version: typeof FOREX_MARKET_STATE_VERSION;
  /** Authoritative provider identity (Phase 31). */
  provider: ForexMarketStateProvider;
  /** Alias of provider — kept for AI / Decision consumers. */
  exchange: ForexMarketStateProvider;
  symbol: string;
  displaySymbol: string;
  providerSymbol: string;
  canonicalSymbol: string;
  marketType: ForexMarketType;
  timeframe: NormalizedTimeframeId;
  candleOpenTime: number | null;
  candleCloseTime: number | null;
  lastMarketUpdate: number | null;
  stateGeneratedAt: number;
  price: MarketStatePrice | null;
  candle: MarketStateCandle | null;
  volume: MarketStateVolume | null;
  volatility: MarketStateVolatility | null;
  trend: MarketStateTrend | null;
  momentum: MarketStateMomentum | null;
  indicators: MarketStateIndicators | null;
  marketStructure: MarketStateStructure | null;
  supportResistance: null;
  supportResistanceReason: "MANUAL_ONLY" | "INSUFFICIENT_DATA";
  dataQuality: MarketStateDataQuality;
  dataSource: "binance-spot" | "fxcm-mid" | "forexconnect-bid" | "none";
}

/** @deprecated Alias — use ForexBinanceMarketState (provider-aware). */
export type ForexMarketStateSnapshot = ForexBinanceMarketState;

export interface ForexMarketStateSet {
  version: typeof FOREX_MARKET_STATE_VERSION;
  provider: ForexMarketStateProvider;
  exchange: ForexMarketStateProvider;
  symbol: string;
  displaySymbol: string;
  states: Partial<Record<NormalizedTimeframeId, ForexBinanceMarketState>>;
}

export interface BuildMarketStateInput {
  symbol: string;
  timeframe: NormalizedTimeframeId;
  candles: Array<{
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
    closed?: boolean;
  }>;
  connection: MarketStateConnection;
  /** Market event time ms when available. */
  lastMarketUpdateMs?: number | null;
  nowMs?: number;
  /** Explicit provider — defaults to BINANCE for legacy callers. */
  provider?: ForexMarketStateProvider;
  marketType?: ForexMarketType;
  displaySymbol?: string;
  providerSymbol?: string;
  canonicalSymbol?: string;
}
