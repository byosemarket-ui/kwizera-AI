import { useEffect, useState } from "react";
import { fetchBinanceKlinesSeries, type BinanceKlinesResult } from "./studio-binance-client";
import type { ChartTimeframeId } from "../chart/types";

export function useBinanceKlines(symbol: string | null, timeframe: ChartTimeframeId): BinanceKlinesResult {
  const [result, setResult] = useState<BinanceKlinesResult>({
    state: symbol ? "loading" : "empty",
    symbol,
    timeframe,
    candles: [],
    message: symbol ? "Loading Binance market data..." : "No Binance candle data available.",
  });

  useEffect(() => {
    if (!symbol) {
      setResult({
        state: "empty",
        symbol: null,
        timeframe,
        candles: [],
        message: "No Binance candle data available.",
      });
      return;
    }
    let cancelled = false;
    setResult({
      state: "loading",
      symbol,
      timeframe,
      candles: [],
      message: "Loading Binance market data...",
    });
    void fetchBinanceKlinesSeries({ symbol, timeframe }).then((next) => {
      if (!cancelled) setResult(next);
    });
    return () => {
      cancelled = true;
    };
  }, [symbol, timeframe]);

  return result;
}
