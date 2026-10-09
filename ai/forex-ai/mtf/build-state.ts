/**
 * Build multi-timeframe Market State using Phase 18 engine only (no second pipeline).
 * Phase 31: all timeframes for a request must come from the same explicit provider.
 */
import { buildForexMarketState } from "../../forex-market-state/index.js";
import type { ForexBinanceMarketState } from "../../forex-market-state/types.js";
import { parseInterval } from "../../market-data/binance/adapter.js";
import type { BinanceMarketDataService } from "../../market-data/binance/service.js";
import type { NormalizedTimeframeId } from "../../market-data/binance/types.js";
import { getMarketDataService } from "../../market-data/providers/market-data-service.js";
import type { MarketProviderId } from "../../market-data/providers/types.js";
import { assessMarketStateForAnalysis, formatDisplaySymbol } from "../data-quality.js";
import {
  FOREX_MTF_DEFAULT_STACK,
  FOREX_MTF_REQUIRED,
  roleForTimeframe,
  sortTimeframesTopDown,
} from "./config.js";
import { compactMtfFacts } from "./compact.js";
import type { ForexMultiTimeframeMarketState, ForexMtfDataQuality, ForexMtfSlot } from "./types.js";

export function resolveMtfTimeframes(requested?: string[]): {
  ok: true;
  timeframes: NormalizedTimeframeId[];
} | {
  ok: false;
  error: string;
  unsupported: string[];
} {
  const raw = (requested?.length ? requested : FOREX_MTF_DEFAULT_STACK).map((t) => String(t).toLowerCase());
  const unsupported: string[] = [];
  const parsed: NormalizedTimeframeId[] = [];
  for (const tf of raw) {
    const id = parseInterval(tf);
    if (!id) unsupported.push(tf);
    else if (!parsed.includes(id)) parsed.push(id);
  }
  if (unsupported.length) {
    return {
      ok: false,
      error: `Unsupported timeframe(s): ${unsupported.join(", ")}. Supported: 1m,5m,15m,30m,1h,4h,1d,1w.`,
      unsupported,
    };
  }
  if (parsed.length === 0) {
    return { ok: false, error: "At least one timeframe is required.", unsupported: [] };
  }
  return { ok: true, timeframes: sortTimeframesTopDown(parsed) };
}

function aggregateDataQuality(slots: ForexMtfSlot[], required: NormalizedTimeframeId[]): ForexMtfDataQuality {
  const requiredSlots = slots.filter((s) => required.includes(s.timeframe));
  const anyDisconnected = slots.some((s) => s.compact.status === "DISCONNECTED");
  if (anyDisconnected) return "DISCONNECTED";

  const requiredOk = requiredSlots.every((s) => s.compact.usable);
  if (!requiredOk) return "INSUFFICIENT_DATA";

  const anyStale = slots.some((s) => s.compact.status === "STALE_DATA");
  const anyUnusableOptional = slots.some((s) => !s.compact.usable);
  if (anyStale && requiredOk) return "PARTIALLY_STALE";
  if (anyUnusableOptional) return "PARTIALLY_STALE";

  const allLive = slots.filter((s) => s.compact.usable).every((s) => s.compact.status === "LIVE");
  if (allLive) return "COMPLETE_LIVE";
  return "COMPLETE_CONNECTED";
}

export async function buildMultiTimeframeMarketState(input: {
  symbol: string;
  timeframes: NormalizedTimeframeId[];
  binance: BinanceMarketDataService;
  nowMs?: number;
  required?: NormalizedTimeframeId[];
  /** Explicit provider — defaults BINANCE. Never mixes providers across slots. */
  provider?: MarketProviderId;
}): Promise<ForexMultiTimeframeMarketState> {
  const provider: MarketProviderId = input.provider === "FXCM" ? "FXCM" : "BINANCE";
  const symbol = provider === "FXCM"
    ? input.symbol.trim()
    : input.symbol.toUpperCase().replace(/[/_-\s]/g, "");
  const nowMs = input.nowMs ?? Date.now();
  const required = (input.required ?? FOREX_MTF_REQUIRED).filter((tf) =>
    input.timeframes.includes(tf),
  );
  const slots: ForexMtfSlot[] = [];
  const marketData = getMarketDataService();

  for (const timeframe of input.timeframes) {
    let marketState: ForexBinanceMarketState | null = null;
    let quality = null;
    try {
      if (provider === "BINANCE") {
        const series = await input.binance.listKlines({ symbol, timeframe, limit: 300 });
        if (series.symbol !== symbol) {
          throw new Error(`Symbol mismatch: expected ${symbol}, got ${series.symbol}`);
        }
        if (series.timeframe !== timeframe) {
          throw new Error(`Timeframe mismatch: expected ${timeframe}, got ${series.timeframe}`);
        }
        marketState = buildForexMarketState({
          symbol: series.symbol,
          timeframe: series.timeframe,
          candles: series.candles,
          connection: series.candles.length > 0 ? "CONNECTED" : "NO_DATA",
          lastMarketUpdateMs: series.candles.length
            ? series.candles[series.candles.length - 1]!.time * 1000
            : null,
          nowMs,
          provider: "BINANCE",
          marketType: "SPOT",
        });
      } else {
        const series = await marketData.getHistoricalCandles({
          provider: "FXCM",
          symbol,
          timeframe,
          limit: 300,
        });
        if (series.identity.provider !== "FXCM") {
          throw new Error("FXCM MTF refused cross-provider candles.");
        }
        marketState = buildForexMarketState({
          symbol: series.identity.canonicalSymbol,
          timeframe: series.timeframe,
          candles: series.candles.map((c) => ({
            time: c.time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: c.volume ?? 0,
            closed: c.isClosed,
          })),
          connection: series.candles.length > 0 ? "CONNECTED" : "NO_DATA",
          lastMarketUpdateMs: series.candles.length
            ? series.candles[series.candles.length - 1]!.time * 1000
            : null,
          nowMs,
          provider: "FXCM",
          marketType: "FOREX",
          displaySymbol: series.identity.displaySymbol,
          providerSymbol: series.identity.providerSymbol,
          canonicalSymbol: series.identity.canonicalSymbol,
        });
      }
      quality = assessMarketStateForAnalysis(marketState, nowMs);
    } catch (error) {
      quality = {
        ok: false as const,
        code: "DATA_UNAVAILABLE" as const,
        status: "DATA_UNAVAILABLE" as const,
        stale: true,
        marketTimestamp: null,
        reason: error instanceof Error ? error.message : "Failed to load timeframe state",
      };
      marketState = null;
    }

    slots.push({
      timeframe,
      role: roleForTimeframe(timeframe),
      marketState,
      compact: compactMtfFacts(timeframe, marketState, quality),
    });
  }

  const displaySymbol = provider === "BINANCE"
    ? formatDisplaySymbol(symbol)
    : (slots.find((s) => s.marketState)?.marketState?.displaySymbol ?? symbol);

  return {
    symbol: provider === "BINANCE" ? symbol : (slots.find((s) => s.marketState)?.marketState?.canonicalSymbol ?? symbol.replace(/[/_-\s]/g, "").toUpperCase()),
    exchange: provider,
    marketType: provider === "FXCM" ? "FOREX" : "SPOT",
    displaySymbol,
    generatedAt: new Date(nowMs).toISOString(),
    timeframes: input.timeframes,
    required,
    slots,
    dataQuality: aggregateDataQuality(slots, required),
  };
}
