/**
 * Compact MARKET FACTS for small local models — only non-null essentials.
 */
import type { ForexMarketState } from "./types.js";

export function compactMarketFacts(market: ForexMarketState): Record<string, unknown> {
  const sma = Object.fromEntries(
    Object.entries(market.indicators.sma).filter(([, v]) => v != null),
  );
  const ema = Object.fromEntries(
    Object.entries(market.indicators.ema).filter(([, v]) => v != null),
  );
  const macd = market.indicators.macd;
  const bb = market.indicators.bollinger;
  const structure = market.marketStructure;

  return {
    exchange: market.exchange,
    symbol: market.symbol,
    marketType: market.marketType,
    timeframe: market.timeframe,
    timestamp: market.timestamp,
    live: market.live,
    dataSource: market.dataSource,
    price: market.price,
    candle: market.candle,
    trend: market.trend,
    momentum: market.momentum,
    volatility: market.volatility,
    rsi14: market.indicators.rsi,
    sma: Object.keys(sma).length ? sma : undefined,
    ema: Object.keys(ema).length ? ema : undefined,
    macd: macd.macd != null || macd.signal != null || macd.histogram != null ? macd : undefined,
    bollinger: bb.mid != null || bb.upper != null || bb.lower != null ? bb : undefined,
    structure: Object.keys(structure).length ? structure : undefined,
  };
}
