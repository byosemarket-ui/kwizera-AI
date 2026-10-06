import { useCallback, useEffect, useState } from "react";
import type { MarketConnectionSnapshot } from "../../../ai/market-data/binance/types";
import { disconnectedSnapshot } from "../../../ai/market-data/binance/connection";
import { resolveBinancePublicConfig } from "../../../ai/market-data/binance/config";
import { fetchBinanceConnectionStatus } from "./studio-binance-client";

const initial: MarketConnectionSnapshot = {
  ...disconnectedSnapshot(resolveBinancePublicConfig({ KWIZERA_ENV: "development" })),
  state: "CONNECTING",
  message: "Checking Binance public API…",
};

export function useBinanceConnectionStatus(): {
  snapshot: MarketConnectionSnapshot;
  retry: () => void;
} {
  const [snapshot, setSnapshot] = useState<MarketConnectionSnapshot>(initial);

  const load = useCallback(() => {
    setSnapshot((current) => ({
      ...current,
      state: current.state === "CONNECTED" ? "RECONNECTING" : "CONNECTING",
      liveMarketData: false,
      message: "Checking Binance public API…",
    }));
    void fetchBinanceConnectionStatus().then(setSnapshot);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { snapshot, retry: load };
}
