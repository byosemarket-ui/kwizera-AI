import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchFxcmHistoricalSeries,
  type FxcmHistoricalSeriesResult,
} from "./studio-fxcm-historical-client";
import type { ChartTimeframeId } from "../chart/types";

export function useFxcmHistoricalKlines(
  symbol: string | null,
  timeframe: ChartTimeframeId,
): FxcmHistoricalSeriesResult & { refresh: () => void } {
  const [result, setResult] = useState<FxcmHistoricalSeriesResult>({
    state: symbol ? "loading" : "empty",
    symbol,
    providerSymbol: null,
    timeframe,
    candles: [],
    source: null,
    mode: "HISTORICAL",
    message: symbol ? "Loading FXCM historical candles…" : "No FXCM historical selection.",
    qualityStatus: null,
  });
  const requestId = useRef(0);

  const load = useCallback((nextSymbol: string | null, nextTimeframe: ChartTimeframeId) => {
    if (!nextSymbol) {
      requestId.current += 1;
      setResult({
        state: "empty",
        symbol: null,
        providerSymbol: null,
        timeframe: nextTimeframe,
        candles: [],
        source: null,
        mode: "HISTORICAL",
        message: "No FXCM historical selection.",
        qualityStatus: null,
      });
      return;
    }
    const id = ++requestId.current;
    setResult((prev) => ({
      ...prev,
      state: "loading",
      symbol: nextSymbol,
      timeframe: nextTimeframe,
      message: "Loading FXCM historical candles…",
    }));
    void fetchFxcmHistoricalSeries({ symbol: nextSymbol, timeframe: nextTimeframe }).then((next) => {
      if (id !== requestId.current) return;
      setResult(next);
    });
  }, []);

  useEffect(() => {
    load(symbol, timeframe);
    return () => {
      requestId.current += 1;
    };
  }, [symbol, timeframe, load]);

  const refresh = useCallback(() => {
    load(symbol, timeframe);
  }, [load, symbol, timeframe]);

  return { ...result, refresh };
}
