/**
 * Provider-aware candle hook for Charts / TA / Market State.
 * Historical + live baseline from unified MarketDataService.
 * Binance forming-candle overlays may still use the existing browser kline WS
 * (server unified path returns HISTORICAL baseline for Binance live mode).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChartTimeframeId } from "../chart/types";
import type { MarketProviderId } from "../../../ai/market-data/providers/types";
import {
  fetchUnifiedCandleSeries,
  type UnifiedCandlesResult,
} from "./studio-unified-candles-client";

const FXCM_POLL_MS = 1000;

function idle(
  provider: MarketProviderId | null,
  symbol: string | null,
  timeframe: ChartTimeframeId,
): UnifiedCandlesResult {
  return {
    state: symbol ? "loading" : "empty",
    provider,
    symbol,
    displaySymbol: null,
    timeframe,
    candles: [],
    forming: null,
    connectionState: null,
    dataQuality: null,
    sourceMode: null,
    live: false,
    message: symbol ? "Loading candles…" : "No market selected.",
    errorCode: null,
    lastQuoteAt: null,
    dataSource: "unified-market-data",
  };
}

export function useUnifiedCandles(
  provider: MarketProviderId | null,
  symbol: string | null,
  timeframe: ChartTimeframeId,
  options?: { marketType?: string | null },
): UnifiedCandlesResult & { refresh: () => void } {
  const marketType = options?.marketType ?? (provider === "FXCM" ? "FOREX" : provider === "BINANCE" ? "CRYPTO" : null);
  const [result, setResult] = useState<UnifiedCandlesResult>(() => idle(provider, symbol, timeframe));
  const generation = useRef(0);

  const load = useCallback(async (
    nextProvider: MarketProviderId,
    nextSymbol: string,
    nextTimeframe: ChartTimeframeId,
    opts?: { soft?: boolean; refresh?: boolean },
  ) => {
    const gen = generation.current;
    if (!opts?.soft) {
      setResult(idle(nextProvider, nextSymbol, nextTimeframe));
    }
    // FXCM: live mode starts server sync session. Binance: historical baseline
    // (browser WS still overlays forming candle in Charts).
    const mode = nextProvider === "FXCM" ? "live" : "historical";
    const next = await fetchUnifiedCandleSeries({
      provider: nextProvider,
      symbol: nextSymbol,
      timeframe: nextTimeframe,
      mode,
      marketType,
      refresh: opts?.refresh,
    });
    if (gen !== generation.current) return;
    setResult(next);
  }, [marketType]);

  useEffect(() => {
    const gen = ++generation.current;
    if (!provider || !symbol) {
      setResult(idle(provider, symbol, timeframe));
      return;
    }

    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    void load(provider, symbol, timeframe).then(() => {
      if (cancelled || gen !== generation.current) return;
      // Poll FXCM live series so forming candle updates without inventing ticks.
      if (provider === "FXCM") {
        pollTimer = setInterval(() => {
          void fetchUnifiedCandleSeries({
            provider,
            symbol,
            timeframe,
            mode: "live",
            marketType,
          }).then((next) => {
            if (cancelled || gen !== generation.current) return;
            setResult(next);
          });
        }, FXCM_POLL_MS);
      }
    });

    return () => {
      cancelled = true;
      generation.current += 1;
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [provider, symbol, timeframe, marketType, load]);

  const refresh = useCallback(() => {
    if (!provider || !symbol) return;
    void load(provider, symbol, timeframe, { soft: true, refresh: true });
  }, [load, provider, symbol, timeframe]);

  return { ...result, refresh };
}
