import { useCallback, useEffect, useState } from "react";
import {
  fetchBinanceMarkets,
  type BinanceMarketsLoadState,
  type BinanceMarketsResult,
} from "./studio-binance-client";

let catalogCache: BinanceMarketsResult | null = null;

export function useBinanceMarkets(): {
  result: BinanceMarketsResult;
  refresh: () => void;
} {
  const [result, setResult] = useState<BinanceMarketsResult>(
    catalogCache ?? {
      state: "loading",
      markets: [],
      message: "Loading Binance markets...",
      restBaseHost: null,
      fetchedAtUtc: null,
    },
  );

  const load = useCallback((refresh = false) => {
    if (!refresh && catalogCache?.state === "ready") {
      setResult(catalogCache);
      return;
    }
    setResult((current) => ({
      ...current,
      state: "loading" as BinanceMarketsLoadState,
      message: "Loading Binance markets...",
    }));
    void fetchBinanceMarkets({ refresh }).then((next) => {
      catalogCache = next.state === "ready" ? next : catalogCache && !refresh ? catalogCache : next;
      setResult(next);
    });
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  return { result, refresh: () => load(true) };
}
