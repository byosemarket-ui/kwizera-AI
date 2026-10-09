/**
 * Provider-aware Market State Engine — Phases 18 + 31.
 * Consumes validated candles from the unified market-data layer (Binance or FXCM).
 * Does not invent market values. Same engine — provider identity retained.
 */
import { toDisplaySymbol } from "../market-data/binance/adapter.js";
import { normalizeCanonicalSymbol } from "../market-data/providers/identity.js";
import type { NormalizedTimeframeId } from "../market-data/binance/types.js";
import {
  calculateATR,
  calculateBollingerBands,
  calculateEMA,
  calculateMACD,
  calculateRSI,
  calculateSMA,
  lastValue,
} from "../../desktop/forex/chart/indicators.js";
import { sanitizeCandles } from "../../desktop/forex/chart/validate-candles.js";
import {
  classifyMomentum,
  classifyTrend,
  classifyVolatility,
  classifyVolume,
  classifyVolumeDirection,
  staleLimitMs,
  VOLUME_LOOKBACK,
} from "./classifications.js";
import {
  FOREX_MARKET_STATE_VERSION,
  type BuildMarketStateInput,
  type ForexBinanceMarketState,
  type ForexMarketStateProvider,
  type ForexMarketType,
  type MarketStateCandle,
  type MarketStateIndicators,
} from "./types.js";

const TIMEFRAME_MINUTES: Record<NormalizedTimeframeId, number> = {
  "1m": 1,
  "5m": 5,
  "15m": 15,
  "30m": 30,
  "1h": 60,
  "4h": 240,
  "1d": 1440,
  "1w": 10080,
};

function timeframeMinutes(timeframe: NormalizedTimeframeId): number {
  return TIMEFRAME_MINUTES[timeframe] ?? 60;
}

function resolveProvider(input: BuildMarketStateInput): ForexMarketStateProvider {
  return input.provider === "FXCM" ? "FXCM" : "BINANCE";
}

function resolveMarketType(provider: ForexMarketStateProvider, input: BuildMarketStateInput): ForexMarketType {
  if (input.marketType) return input.marketType;
  return provider === "FXCM" ? "FOREX" : "SPOT";
}

function assertSymbol(symbol: string, provider: ForexMarketStateProvider): string {
  const compact = normalizeCanonicalSymbol(symbol);
  if (provider === "FXCM") {
    if (!/^[A-Z0-9]{4,30}$/.test(compact)) {
      throw new Error("Invalid FXCM symbol for market state.");
    }
    return compact;
  }
  if (!/^[A-Z0-9]{4,30}$/.test(compact)) {
    throw new Error("Invalid Binance symbol for market state.");
  }
  return compact;
}

function dataSourceFor(provider: ForexMarketStateProvider): ForexBinanceMarketState["dataSource"] {
  return provider === "FXCM" ? "fxcm-mid" : "binance-spot";
}

function buildBasicStructure(
  candles: Array<{ high: number; low: number; close: number }>,
  trendDirection: "BULLISH" | "BEARISH" | "NEUTRAL",
): ForexBinanceMarketState["marketStructure"] {
  if (candles.length < 20) {
    return {
      trend: "UNKNOWN",
      lastSwingHigh: null,
      lastSwingLow: null,
      structureState: "INSUFFICIENT_DATA",
    };
  }
  const window = candles.slice(-20);
  let lastSwingHigh = window[0]!.high;
  let lastSwingLow = window[0]!.low;
  for (const candle of window) {
    if (candle.high > lastSwingHigh) lastSwingHigh = candle.high;
    if (candle.low < lastSwingLow) lastSwingLow = candle.low;
  }
  return {
    trend: trendDirection,
    lastSwingHigh,
    lastSwingLow,
    structureState: "BASIC_SWINGS",
  };
}

function emptyInvalidState(
  symbol: string,
  timeframe: NormalizedTimeframeId,
  connection: BuildMarketStateInput["connection"],
  reason: string,
  nowMs: number,
  provider: ForexMarketStateProvider,
  marketType: ForexMarketType,
  candleCount = 0,
  displaySymbol?: string,
): ForexBinanceMarketState {
  const display = displaySymbol
    ?? (provider === "BINANCE" ? toDisplaySymbol(symbol) : symbol);
  return {
    version: FOREX_MARKET_STATE_VERSION,
    provider,
    exchange: provider,
    symbol,
    displaySymbol: display,
    providerSymbol: symbol,
    canonicalSymbol: normalizeCanonicalSymbol(symbol),
    marketType,
    timeframe,
    candleOpenTime: null,
    candleCloseTime: null,
    lastMarketUpdate: null,
    stateGeneratedAt: nowMs,
    price: null,
    candle: null,
    volume: null,
    volatility: null,
    trend: null,
    momentum: null,
    indicators: null,
    marketStructure: {
      trend: "UNKNOWN",
      lastSwingHigh: null,
      lastSwingLow: null,
      structureState: "INSUFFICIENT_DATA",
    },
    supportResistance: null,
    supportResistanceReason: "INSUFFICIENT_DATA",
    dataQuality: {
      connection,
      lastUpdate: null,
      stale: connection !== "LIVE",
      candleCount,
      valid: false,
      reason,
    },
    dataSource: dataSourceFor(provider),
  };
}

/** Build authoritative Market State from a validated candle series (any registered provider). */
export function buildForexMarketState(input: BuildMarketStateInput): ForexBinanceMarketState {
  const nowMs = input.nowMs ?? Date.now();
  const provider = resolveProvider(input);
  const marketType = resolveMarketType(provider, input);
  let symbol: string;
  try {
    symbol = assertSymbol(input.symbol, provider);
  } catch {
    return emptyInvalidState(
      "INVALID",
      input.timeframe,
      input.connection,
      "INVALID_SYMBOL",
      nowMs,
      provider,
      marketType,
    );
  }

  const sanitized = sanitizeCandles(input.candles.map((candle) => ({
    time: candle.time,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume ?? 0,
    closed: candle.closed,
  })));

  if (sanitized.length === 0) {
    return emptyInvalidState(
      symbol,
      input.timeframe,
      input.connection,
      "NO_VALID_CANDLES",
      nowMs,
      provider,
      marketType,
      0,
      input.displaySymbol,
    );
  }

  const minutes = timeframeMinutes(input.timeframe);
  const last = sanitized[sanitized.length - 1]!;
  const previousCandle = sanitized.length > 1 ? sanitized[sanitized.length - 2]! : null;

  const openTime = last.time;
  const closeTime = last.time + minutes * 60;
  const candle: MarketStateCandle = {
    open: last.open,
    high: last.high,
    low: last.low,
    close: last.close,
    volume: last.volume ?? 0,
    openTime,
    closeTime,
    isClosed: last.closed === true,
  };

  const absoluteChange = previousCandle ? last.close - previousCandle.close : null;
  const percentageChange = previousCandle && previousCandle.close !== 0
    ? ((last.close - previousCandle.close) / previousCandle.close) * 100
    : null;

  const volumeWindow = sanitized.slice(-VOLUME_LOOKBACK);
  const volumes = volumeWindow.map((item) => item.volume ?? 0);
  const averageVolume = volumes.length
    ? volumes.reduce((sum, value) => sum + value, 0) / volumes.length
    : null;
  const relativeRatio = averageVolume && averageVolume > 0
    ? candle.volume / averageVolume
    : null;
  const previousVolume = sanitized.length > 1 ? (sanitized[sanitized.length - 2]!.volume ?? null) : null;

  const sma20 = lastValue(calculateSMA(sanitized, 20));
  const sma50 = lastValue(calculateSMA(sanitized, 50));
  const ema50 = lastValue(calculateEMA(sanitized, 50));
  const rsi14 = lastValue(calculateRSI(sanitized, 14));
  const macdSeries = calculateMACD(sanitized, 12, 26, 9);
  const macdValue = lastValue(macdSeries.macd);
  const macdSignal = lastValue(macdSeries.signal);
  const macdHist = macdSeries.histogram.length
    ? macdSeries.histogram[macdSeries.histogram.length - 1]!.value
    : null;
  const bb = calculateBollingerBands(sanitized, 20, 2);
  const bbMid = lastValue(bb.middle);
  const bbUpper = lastValue(bb.upper);
  const bbLower = lastValue(bb.lower);
  const bbWidthPct = bbMid && bbUpper != null && bbLower != null && bbMid !== 0
    ? ((bbUpper - bbLower) / bbMid) * 100
    : null;
  const atr14 = lastValue(calculateATR(sanitized, 14));
  const atrPercent = atr14 != null && last.close > 0 ? (atr14 / last.close) * 100 : null;

  const trend = classifyTrend({ close: last.close, ema50, sma20, sma50 });
  const momentumClass = classifyMomentum(rsi14, macdHist);

  const indicators: MarketStateIndicators = {
    sma20,
    sma50,
    ema50,
    rsi14,
    macd: { value: macdValue, signal: macdSignal, histogram: macdHist },
    bollinger: { mid: bbMid, upper: bbUpper, lower: bbLower, widthPct: bbWidthPct },
    atr14,
  };

  const lastUpdate = input.lastMarketUpdateMs ?? (openTime * 1000);
  const stale = input.connection !== "LIVE"
    || (lastUpdate != null && nowMs - lastUpdate > staleLimitMs(minutes));

  const displaySymbol = input.displaySymbol
    ?? (provider === "BINANCE" ? toDisplaySymbol(symbol) : (input.providerSymbol ?? symbol));
  const providerSymbol = input.providerSymbol ?? (provider === "BINANCE" ? symbol : displaySymbol);
  const canonicalSymbol = input.canonicalSymbol ?? symbol;

  return {
    version: FOREX_MARKET_STATE_VERSION,
    provider,
    exchange: provider,
    symbol,
    displaySymbol,
    providerSymbol,
    canonicalSymbol,
    marketType,
    timeframe: input.timeframe,
    candleOpenTime: openTime,
    candleCloseTime: closeTime,
    lastMarketUpdate: lastUpdate,
    stateGeneratedAt: nowMs,
    price: {
      last: last.close,
      open: last.open,
      high: last.high,
      low: last.low,
      close: last.close,
      absoluteChange,
      percentageChange,
      changeReference: previousCandle ? "PREVIOUS_CLOSED_CANDLE" : "NONE",
    },
    candle,
    volume: {
      current: candle.volume,
      average: averageVolume,
      relativeRatio,
      classification: classifyVolume(relativeRatio),
      direction: classifyVolumeDirection(candle.volume, previousVolume),
      lookback: VOLUME_LOOKBACK,
    },
    volatility: {
      atr: atr14,
      atrPercent,
      classification: classifyVolatility(atrPercent),
      period: 14,
    },
    trend: {
      direction: trend.direction,
      strength: trend.strength,
      priceVsEma50: trend.priceVsEma50,
      sma20VsSma50: trend.sma20VsSma50,
    },
    momentum: {
      rsi: rsi14,
      macd: { value: macdValue, signal: macdSignal, histogram: macdHist },
      classification: momentumClass,
    },
    indicators,
    marketStructure: buildBasicStructure(sanitized, trend.direction),
    supportResistance: null,
    supportResistanceReason: "MANUAL_ONLY",
    dataQuality: {
      connection: stale && input.connection === "LIVE" ? "DISCONNECTED" : input.connection,
      lastUpdate,
      stale,
      candleCount: sanitized.length,
      valid: true,
      reason: stale ? "STALE_OR_NOT_LIVE" : undefined,
    },
    dataSource: dataSourceFor(provider),
  };
}
