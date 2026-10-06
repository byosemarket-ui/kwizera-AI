import { useEffect, useState } from "react";
import {
  createBinanceLiveTickerClient,
  idleLiveTickerSnapshot,
  type LiveTickerClient,
  type LiveTickerSnapshot,
} from "../../../ai/market-data/binance/live-ticker";

let sharedClient: LiveTickerClient | null = null;

function getSharedLiveTickerClient(): LiveTickerClient {
  sharedClient ??= createBinanceLiveTickerClient();
  return sharedClient;
}

export function useBinanceLiveTicker(symbol: string | null): LiveTickerSnapshot {
  const [snapshot, setSnapshot] = useState<LiveTickerSnapshot>(() => idleLiveTickerSnapshot());

  useEffect(() => {
    const client = getSharedLiveTickerClient();
    let frame = 0;
    let pending: LiveTickerSnapshot | null = null;
    const apply = (next: LiveTickerSnapshot) => {
      pending = next;
      if (typeof requestAnimationFrame !== "function") {
        setSnapshot(next);
        return;
      }
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (pending) setSnapshot(pending);
      });
    };
    const stop = client.onChange(apply);
    client.subscribe(symbol);
    return () => {
      stop();
      if (frame && typeof cancelAnimationFrame === "function") cancelAnimationFrame(frame);
    };
  }, [symbol]);

  useEffect(() => () => {
    getSharedLiveTickerClient().disconnect();
  }, []);

  return snapshot;
}
