/**
 * Phase 30 — FXCM live candle hook.
 * Subscribes server-side sync session; polls for OHLC updates (no raw FXCM events in browser).
 */
import { useEffect, useRef, useState } from "react";
import type { ChartTimeframeId } from "../chart/types";
import {
  fetchFxcmLiveCandleSeries,
  subscribeFxcmLiveCandles,
  unsubscribeFxcmLiveCandles,
  type FxcmLiveCandleSeriesResult,
} from "./studio-fxcm-live-candles-client";

const POLL_MS = 1000;

function idle(symbol: string | null, timeframe: ChartTimeframeId): FxcmLiveCandleSeriesResult {
  return {
    state: symbol ? "loading" : "empty",
    symbol,
    providerSymbol: null,
    displaySymbol: null,
    timeframe,
    candles: [],
    forming: null,
    mode: null,
    live: false,
    streamState: null,
    priceBasis: null,
    message: symbol ? "Loading FXCM candles…" : "No FXCM selection.",
    qualityStatus: null,
    lastQuoteAt: null,
  };
}

export function useFxcmLiveCandles(
  symbol: string | null,
  timeframe: ChartTimeframeId,
): FxcmLiveCandleSeriesResult & { refresh: () => void } {
  const [result, setResult] = useState<FxcmLiveCandleSeriesResult>(() => idle(symbol, timeframe));
  const generation = useRef(0);
  const activeKey = useRef<string | null>(null);

  useEffect(() => {
    const gen = ++generation.current;
    if (!symbol) {
      setResult(idle(null, timeframe));
      return;
    }

    const key = `${symbol}:${timeframe}`;
    activeKey.current = key;
    setResult(idle(symbol, timeframe));

    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    void (async () => {
      const subscribed = await subscribeFxcmLiveCandles({ symbol, timeframe });
      if (cancelled || gen !== generation.current) {
        await unsubscribeFxcmLiveCandles({ symbol, timeframe });
        return;
      }
      setResult(subscribed);

      pollTimer = setInterval(() => {
        void fetchFxcmLiveCandleSeries({ symbol, timeframe }).then((next) => {
          if (cancelled || gen !== generation.current || !next) return;
          setResult(next);
        });
      }, POLL_MS);
    })();

    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
      if (activeKey.current === key) {
        void unsubscribeFxcmLiveCandles({ symbol, timeframe });
        activeKey.current = null;
      }
    };
  }, [symbol, timeframe]);

  const refresh = () => {
    if (!symbol) return;
    void fetchFxcmLiveCandleSeries({ symbol, timeframe }).then((next) => {
      if (next) setResult(next);
    });
  };

  return { ...result, refresh };
}
