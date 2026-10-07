/**
 * Ultra-compact per-timeframe facts for small-model MTF prompts.
 */
import type { ForexBinanceMarketState } from "../../forex-market-state/types.js";
import type { NormalizedTimeframeId } from "../../market-data/binance/types.js";
import type { MarketDataQualityAssessment } from "../data-quality.js";
import { roleForTimeframe } from "./config.js";
import type { ForexMtfCompactFacts } from "./types.js";

export function compactMtfFacts(
  timeframe: NormalizedTimeframeId,
  state: ForexBinanceMarketState | null,
  quality: MarketDataQualityAssessment | null,
): ForexMtfCompactFacts {
  const role = roleForTimeframe(timeframe);
  if (!state || !quality?.ok) {
    return {
      timeframe,
      role,
      usable: false,
      status: quality?.status ?? "DATA_UNAVAILABLE",
      trend: null,
      momentum: null,
      volatility: null,
      rsi: null,
      ema50: null,
      sma20: null,
      sma50: null,
      structure: null,
      price: null,
      candleOpen: null,
      timestamp: quality?.marketTimestamp ?? null,
      reason: quality?.reason ?? "NO_DATA",
    };
  }

  return {
    timeframe,
    role,
    usable: true,
    status: quality.status,
    trend: state.trend?.direction ?? null,
    momentum: state.momentum?.classification ?? null,
    volatility: state.volatility?.classification ?? null,
    rsi: state.indicators?.rsi14 ?? null,
    ema50: state.indicators?.ema50 ?? null,
    sma20: state.indicators?.sma20 ?? null,
    sma50: state.indicators?.sma50 ?? null,
    structure: state.marketStructure?.structureState ?? null,
    price: state.price?.last ?? null,
    candleOpen: state.candle ? !state.candle.isClosed : null,
    timestamp: quality.marketTimestamp,
  };
}

/** One-line prompt serialization — avoids dumping full MarketState objects. */
export function formatCompactFactsLine(facts: ForexMtfCompactFacts): string {
  if (!facts.usable) {
    return `${facts.timeframe}(${facts.role}): NO_DATA/${facts.status}${facts.reason ? `:${facts.reason}` : ""}`;
  }
  const parts = [
    `${facts.timeframe}(${facts.role})`,
    `trend=${facts.trend ?? "n/a"}`,
    `mom=${facts.momentum ?? "n/a"}`,
    `vol=${facts.volatility ?? "n/a"}`,
    facts.rsi != null ? `rsi=${Number(facts.rsi.toFixed(1))}` : "rsi=n/a",
    facts.structure ? `struct=${facts.structure}` : null,
    facts.candleOpen == null ? null : `forming=${facts.candleOpen}`,
    facts.price != null ? `px=${facts.price}` : null,
  ];
  return parts.filter(Boolean).join(" ");
}
