/**
 * Adapt Market State → Phase 17 ForexMarketState for AI consumption.
 * Provider identity is preserved; raw provider events are never forwarded.
 */
import type { ForexMarketState } from "../forex-ai/types.js";
import { emptyForexMarketState } from "../forex-ai/types.js";
import type { ForexBinanceMarketState } from "./types.js";

export function toForexAiMarketState(state: ForexBinanceMarketState): ForexMarketState {
  const exchange = state.provider === "FXCM" ? "FXCM" : "BINANCE";
  const marketType = state.provider === "FXCM"
    ? (state.marketType === "SPOT" || state.marketType === "CRYPTO" ? "FOREX" : state.marketType)
    : "SPOT";
  const dataSource = state.dataSource === "fxcm-mid"
    ? "fxcm-mid"
    : state.dataSource === "binance-spot"
      ? "binance-spot"
      : "none";

  if (!state.dataQuality.valid || !state.candle || !state.price) {
    return emptyForexMarketState({
      symbol: state.symbol,
      timeframe: state.timeframe,
      exchange,
      marketType: marketType === "CRYPTO" ? "SPOT" : marketType as ForexMarketState["marketType"],
      dataSource: "none",
      live: false,
      timestamp: null,
    });
  }

  return emptyForexMarketState({
    symbol: state.symbol,
    timeframe: state.timeframe,
    exchange,
    marketType: marketType === "CRYPTO" ? "SPOT" : marketType as ForexMarketState["marketType"],
    dataSource,
    live: state.dataQuality.connection === "LIVE" && !state.dataQuality.stale,
    timestamp: state.lastMarketUpdate != null
      ? new Date(state.lastMarketUpdate).toISOString()
      : null,
    price: state.price.last,
    candle: {
      open: state.candle.open,
      high: state.candle.high,
      low: state.candle.low,
      close: state.candle.close,
      volume: state.candle.volume,
    },
    trend: state.trend?.direction ?? null,
    momentum: state.momentum?.classification ?? null,
    volatility: state.volatility?.classification ?? null,
    indicators: {
      sma: {
        "20": state.indicators?.sma20 ?? null,
        "50": state.indicators?.sma50 ?? null,
      },
      ema: {
        "50": state.indicators?.ema50 ?? null,
      },
      rsi: state.indicators?.rsi14 ?? null,
      macd: {
        macd: state.indicators?.macd.value ?? null,
        signal: state.indicators?.macd.signal ?? null,
        histogram: state.indicators?.macd.histogram ?? null,
      },
      bollinger: {
        mid: state.indicators?.bollinger.mid ?? null,
        upper: state.indicators?.bollinger.upper ?? null,
        lower: state.indicators?.bollinger.lower ?? null,
        widthPct: state.indicators?.bollinger.widthPct ?? null,
      },
    },
    marketStructure: state.marketStructure
      ? {
          trend: state.marketStructure.trend,
          lastSwingHigh: state.marketStructure.lastSwingHigh,
          lastSwingLow: state.marketStructure.lastSwingLow,
          structureState: state.marketStructure.structureState,
        }
      : {},
    supportResistance: {
      support: [],
      resistance: [],
    },
  });
}
