import { useCallback, useEffect, useRef, useState } from "react";
import { fetchBinanceKlinesSeries, type BinanceKlinesResult } from "./studio-binance-client";
import type { ChartTimeframeId } from "../chart/types";

export function useBinanceKlines(symbol: string | null, timeframe: ChartTimeframeId): BinanceKlinesResult & {
  refresh: () => void;
} {
  const [result, setResult] = useState<BinanceKlinesResult>({
    state: symbol ? "loading" : "empty",
    symbol,
    timeframe,
    candles: [],
    message: symbol ? "Loading Binance market data..." : "No Binance candle data available.",
  });
  const requestId = useRef(0);

  const load = useCallback((nextSymbol: string | null, nextTimeframe: ChartTimeframeId, opts?: { soft?: boolean }) => {
    if (!nextSymbol) {
      requestId.current += 1;
      setResult({
        state: "empty",
        symbol: null,
        timeframe: nextTimeframe,
        candles: [],
        message: "No Binance candle data available.",
      });
      return;
    }
    const id = ++requestId.current;
    if (!opts?.soft) {
      setResult({
        state: "loading",
        symbol: nextSymbol,
        timeframe: nextTimeframe,
        candles: [],
        message: "Loading Binance market data...",
      });
    }
    void fetchBinanceKlinesSeries({ symbol: nextSymbol, timeframe: nextTimeframe }).then((next) => {
      if (id !== requestId.current) return;
      setResult(next);
    });
  }, []);

  useEffect(() => {
    load(symbol, timeframe, { soft: false });
    return () => {
      requestId.current += 1;
    };
  }, [symbol, timeframe, load]);

  const refresh = useCallback(() => {
    load(symbol, timeframe, { soft: true });
  }, [load, symbol, timeframe]);

  return { ...result, refresh };
}
