import { useEffect, useState } from "react";
import {
  createBinanceLiveKlineClient,
  idleLiveKlineSnapshot,
  type LiveKlineClient,
} from "../../../ai/market-data/binance/live-kline";
import type { LiveKlineSnapshot } from "../../../ai/market-data/binance/types";
import type { ChartTimeframeId } from "../chart/types";

let sharedClient: LiveKlineClient | null = null;
let consumerCount = 0;

function getSharedLiveKlineClient(): LiveKlineClient {
  sharedClient ??= createBinanceLiveKlineClient();
  return sharedClient;
}

export function useBinanceLiveKline(symbol: string | null, timeframe: ChartTimeframeId): LiveKlineSnapshot {
  const [snapshot, setSnapshot] = useState<LiveKlineSnapshot>(() => idleLiveKlineSnapshot());

  useEffect(() => {
    const client = getSharedLiveKlineClient();
    consumerCount += 1;
    return () => {
      consumerCount = Math.max(0, consumerCount - 1);
      if (consumerCount === 0) client.subscribe(null, null);
    };
  }, []);

  useEffect(() => {
    const client = getSharedLiveKlineClient();
    let frame = 0;
    let pending: LiveKlineSnapshot | null = null;
    const apply = (next: LiveKlineSnapshot) => {
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
    // Clear immediately so a previous symbol/timeframe cannot paint one stale LIVE frame.
    setSnapshot(idleLiveKlineSnapshot(symbol ? "Connecting to Binance..." : "Disconnected"));
    const stop = client.onChange(apply);
    client.subscribe(symbol, symbol ? timeframe : null);
    return () => {
      stop();
      if (frame && typeof cancelAnimationFrame === "function") cancelAnimationFrame(frame);
    };
  }, [symbol, timeframe]);

  return snapshot;
}
