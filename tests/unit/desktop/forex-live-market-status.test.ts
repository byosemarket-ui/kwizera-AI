import { describe, expect, it } from "vitest";
import {
  liveMarketStatusLabel,
  resolveKlineUiStatus,
  resolveTickerUiStatus,
  tickerMatchesSelection,
} from "../../../desktop/forex/market-data/live-market-status.ts";
import { idleLiveTickerSnapshot } from "../../../ai/market-data/binance/live-ticker.ts";
import { idleLiveKlineSnapshot } from "../../../ai/market-data/binance/live-kline.ts";

describe("Forex Phase 10 live market status", () => {
  it("requires matching symbol before LIVE for ticker snapshots", () => {
    const snapshot = {
      ...idleLiveTickerSnapshot(),
      connectionState: "CONNECTED" as const,
      liveMarketData: true,
      websocketActive: true,
      subscribedSymbol: "BTCUSDT",
      ticker: {
        venue: "binance-spot" as const,
        symbol: "BTCUSDT",
        displaySymbol: "BTC/USDT",
        price: 70000,
        eventTimeUtc: 1,
        receivedAtUtc: 1,
        source: "binance-spot-public" as const,
        streamType: "miniTicker" as const,
        open: null,
        high: null,
        low: null,
      },
    };
    expect(resolveTickerUiStatus(snapshot, "BTCUSDT")).toBe("LIVE");
    expect(resolveTickerUiStatus(snapshot, "ETHUSDT")).toBe("CONNECTING");
    expect(tickerMatchesSelection(snapshot, "ETHUSDT")).toBe(false);
    expect(liveMarketStatusLabel("RECONNECTING")).toBe("Reconnecting to Binance...");
  });

  it("requires history ready and matching kline before LIVE", () => {
    const idle = idleLiveKlineSnapshot();
    expect(resolveKlineUiStatus(idle, "BTCUSDT", "1h", false)).toBe("CONNECTING");
    const live = {
      ...idle,
      connectionState: "CONNECTED" as const,
      liveMarketData: true,
      websocketActive: true,
      subscribedSymbol: "BTCUSDT",
      timeframe: "1h" as const,
      kline: {
        venue: "binance-spot" as const,
        symbol: "BTCUSDT",
        timeframe: "1h" as const,
        candle: { time: 1, open: 1, high: 2, low: 0.5, close: 1.5, volume: 1, closed: false },
        eventTimeUtc: 1,
        receivedAtUtc: 1,
        source: "binance-spot-public" as const,
        streamType: "kline" as const,
      },
    };
    expect(resolveKlineUiStatus(live, "BTCUSDT", "1h", true)).toBe("LIVE");
    expect(resolveKlineUiStatus(live, "BTCUSDT", "15m", true)).toBe("CONNECTED");
    expect(resolveKlineUiStatus(live, "ETHUSDT", "1h", true)).toBe("CONNECTED");
  });
});
