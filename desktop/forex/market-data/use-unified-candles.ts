/**
 * Provider-aware candle hook for Charts / TA / Market State.
 * Historical + live baseline from unified MarketDataService.
 * Binance forming-candle overlays may still use the existing browser kline WS
 * (server unified path returns HISTORICAL baseline for Binance live mode).
 *
 * Phase 41 — resume immediately on remount/visibility; do not wait for the first
 * load before arming the live poller; keep last good series on soft network errors.
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
    streamDiagnostics: null,
  };
}

function sameSeriesKey(
  a: { provider: MarketProviderId | null; symbol: string | null; timeframe: string },
  provider: MarketProviderId,
  symbol: string,
  timeframe: ChartTimeframeId,
): boolean {
  return a.provider === provider && a.symbol === symbol && a.timeframe === timeframe;
}

export function useUnifiedCandles(
  provider: MarketProviderId | null,
  symbol: string | null,
  timeframe: ChartTimeframeId,
  options?: { marketType?: string | null },
): UnifiedCandlesResult & { refresh: () => void } {
  const marketType = options?.marketType
    ?? (provider === "FXCM" || provider === "FOREXCONNECT"
      ? "FOREX"
      : provider === "BINANCE" ? "CRYPTO" : null);
  const [result, setResult] = useState<UnifiedCandlesResult>(() => idle(provider, symbol, timeframe));
  const generation = useRef(0);
  const resultRef = useRef(result);
  resultRef.current = result;

  const applySeries = useCallback((next: UnifiedCandlesResult, soft: boolean) => {
    if (soft && (next.state === "error" || next.state === "unavailable")) {
      const prev = resultRef.current;
      if (
        prev.candles.length > 0
        && prev.provider === next.provider
        && prev.symbol === next.symbol
        && prev.timeframe === next.timeframe
      ) {
        setResult({
          ...prev,
          state: prev.live || String(prev.connectionState ?? "").toUpperCase() === "LIVE"
            ? "stale"
            : prev.state,
          live: false,
          connectionState: String(prev.connectionState ?? "").toUpperCase() === "LIVE"
            ? "STALE"
            : prev.connectionState,
          dataQuality: "STALE",
          message: next.message || prev.message,
          errorCode: next.errorCode,
        });
        return;
      }
    }
    setResult(next);
  }, []);

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
    const mode = nextProvider === "FXCM" || nextProvider === "FOREXCONNECT" ? "live" : "historical";
    const next = await fetchUnifiedCandleSeries({
      provider: nextProvider,
      symbol: nextSymbol,
      timeframe: nextTimeframe,
      mode,
      marketType,
      refresh: opts?.refresh,
    });
    if (gen !== generation.current) return;
    applySeries(next, Boolean(opts?.soft));
  }, [marketType, applySeries]);

  useEffect(() => {
    const gen = ++generation.current;
    if (!provider || !symbol) {
      setResult(idle(provider, symbol, timeframe));
      return;
    }

    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;
    const liveProvider = provider === "FXCM" || provider === "FOREXCONNECT";

    // Soft remount: keep last candles visible while reconnecting to server state.
    const prev = resultRef.current;
    const softRemount = sameSeriesKey(prev, provider, symbol, timeframe) && prev.candles.length > 0;
    void load(provider, symbol, timeframe, { soft: softRemount });

    const pollOnce = () => {
      if (cancelled || gen !== generation.current) return;
      void fetchUnifiedCandleSeries({
        provider,
        symbol,
        timeframe,
        mode: "live",
        marketType,
      }).then((next) => {
        if (cancelled || gen !== generation.current) return;
        applySeries(next, true);
      });
    };

    if (liveProvider) {
      // Arm poller immediately — do not wait for the first historical/live bootstrap.
      pollTimer = setInterval(pollOnce, FXCM_POLL_MS);
    }

    const onVisible = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        pollOnce();
      }
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisible);
    }
    if (typeof window !== "undefined") {
      window.addEventListener("focus", onVisible);
    }

    return () => {
      cancelled = true;
      generation.current += 1;
      if (pollTimer) clearInterval(pollTimer);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisible);
      }
      if (typeof window !== "undefined") {
        window.removeEventListener("focus", onVisible);
      }
    };
  }, [provider, symbol, timeframe, marketType, load, applySeries]);

  const refresh = useCallback(() => {
    if (!provider || !symbol) return;
    void load(provider, symbol, timeframe, { soft: true, refresh: true });
  }, [load, provider, symbol, timeframe]);

  return { ...result, refresh };
}
