import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyLiveKline,
  buildKlineUrl,
  klineStreamName,
  normalizeBinanceKline,
  normalizeBinanceKlineEvent,
  normalizeBinanceKlines,
} from "../../../../ai/market-data/binance/adapter.ts";
import { BINANCE_DEFAULT_WS_BASE } from "../../../../ai/market-data/binance/config.ts";
import { createBinanceLiveKlineClient } from "../../../../ai/market-data/binance/live-kline.ts";
import type { WebSocketLike } from "../../../../ai/market-data/binance/live-ticker.ts";
import { createBinanceMarketDataService } from "../../../../ai/market-data/binance/service.ts";

class FakeSocket implements WebSocketLike {
  static open: FakeSocket[] = [];
  readyState = 0;
  readonly url: string;
  private readonly listeners = new Map<string, Array<(event: { data?: unknown; code?: number }) => void>>();

  constructor(url: string) {
    this.url = url;
    FakeSocket.open.push(this);
  }

  addEventListener(type: string, listener: (event: { data?: unknown; code?: number }) => void): void {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }

  emit(type: string, event: { data?: unknown; code?: number } = {}): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }

  open(): void {
    this.readyState = 1;
    this.emit("open");
  }

  push(payload: Record<string, unknown>): void {
    this.emit("message", { data: JSON.stringify(payload) });
  }

  close(code = 1000): void {
    this.readyState = 3;
    FakeSocket.open = FakeSocket.open.filter((item) => item !== this);
    this.emit("close", { code });
  }
}

function klineEvent(symbol: string, interval: string, closed: boolean, extra: Record<string, unknown> = {}) {
  return {
    e: "kline",
    E: 1_700_000_000_500,
    s: symbol,
    k: {
      t: 1_700_000_000_000,
      T: 1_700_000_059_999,
      s: symbol,
      i: interval,
      o: "100",
      h: "110",
      l: "90",
      c: "105",
      v: "12.5",
      x: closed,
      ...extra,
    },
  };
}

afterEach(() => {
  FakeSocket.open = [];
  vi.useRealTimers();
});

describe("Binance Phase 9 kline adapter", () => {
  it("maps stream names and ignores malformed or mismatched kline events", () => {
    expect(klineStreamName("BTCUSDT", "1h")).toBe("btcusdt@kline_1h");
    expect(buildKlineUrl(BINANCE_DEFAULT_WS_BASE, "BTCUSDT", "1m")).toBe("wss://stream.binance.com:9443/ws/btcusdt@kline_1m");
    const live = normalizeBinanceKlineEvent(klineEvent("BTCUSDT", "1m", false), "BTCUSDT", "1m");
    expect(live?.symbol).toBe("BTCUSDT");
    expect(live?.timeframe).toBe("1m");
    expect(live?.candle.closed).toBe(false);
    expect(live?.candle.close).toBe(105);
    expect(normalizeBinanceKlineEvent(klineEvent("ETHUSDT", "1m", false), "BTCUSDT", "1m")).toBeNull();
    expect(normalizeBinanceKlineEvent(klineEvent("BTCUSDT", "5m", false), "BTCUSDT", "1m")).toBeNull();
    expect(normalizeBinanceKlineEvent(klineEvent("BTCUSDT", "1m", false, { h: "80" }), "BTCUSDT", "1m")).toBeNull();
    expect(normalizeBinanceKlineEvent({ e: "24hrMiniTicker", s: "BTCUSDT", c: "1" }, "BTCUSDT", "1m")).toBeNull();
  });

  it("updates the forming candle in place and appends only after a later open time", () => {
    const first = normalizeBinanceKline([1_700_000_000_000, "100", "110", "90", "105", "1", 1_700_000_059_999]);
    const forming = { ...first, close: 106, high: 111, closed: false };
    const next = normalizeBinanceKline([1_700_000_060_000, "106", "107", "105", "106.5", "2", 1_700_000_119_999]);
    const replaced = applyLiveKline([first], forming);
    expect(replaced).toHaveLength(1);
    expect(replaced[0]?.close).toBe(106);
    const appended = applyLiveKline(replaced, next);
    expect(appended).toHaveLength(2);
    expect(appended[1]?.time).toBe(next.time);
    expect(applyLiveKline(appended, first)).toHaveLength(2);
  });

  it("drops duplicate timestamps and invalid OHLC rows from historical lists", () => {
    const candles = normalizeBinanceKlines([
      [1_700_000_000_000, "100", "110", "90", "105", "1", 1_700_000_059_999],
      [1_700_000_000_000, "100", "110", "90", "105", "1", 1_700_000_059_999],
      [1_700_000_120_000, "10", "9", "8", "9", "1", 1_700_000_179_999],
      [1_700_000_060_000, "105", "108", "104", "107", "2", 1_700_000_119_999],
    ]);
    expect(candles.map((item) => item.time)).toEqual([1_700_000_000, 1_700_000_060]);
  });
});

describe("Binance Phase 9 live kline client", () => {
  it("becomes LIVE only after a valid kline for the subscribed symbol and timeframe", () => {
    const client = createBinanceLiveKlineClient({
      env: { KWIZERA_BINANCE_ENABLED: "1" },
      webSocketCtor: FakeSocket as unknown as new (url: string) => WebSocketLike,
    });
    client.subscribe("BTCUSDT", "1m");
    expect(client.getSnapshot().connectionState).toBe("CONNECTING");
    expect(client.getSnapshot().liveMarketData).toBe(false);
    FakeSocket.open[0]?.open();
    expect(client.getSnapshot().connectionState).toBe("CONNECTED");
    expect(client.getSnapshot().liveMarketData).toBe(false);
    FakeSocket.open[0]?.push(klineEvent("BTCUSDT", "1m", false));
    expect(client.getSnapshot().liveMarketData).toBe(true);
    expect(client.getSnapshot().kline?.candle.closed).toBe(false);
    expect(client.getSnapshot().message).toBe("Live Binance data");
  });

  it("does not mix streams when switching symbol or timeframe", () => {
    const client = createBinanceLiveKlineClient({
      env: { KWIZERA_BINANCE_ENABLED: "1" },
      webSocketCtor: FakeSocket as unknown as new (url: string) => WebSocketLike,
    });
    client.subscribe("BTCUSDT", "1m");
    const first = FakeSocket.open[0];
    first?.open();
    first?.push(klineEvent("BTCUSDT", "1m", false));
    client.subscribe("ETHUSDT", "5m");
    expect(FakeSocket.open).toHaveLength(1);
    expect(FakeSocket.open[0]?.url).toContain("ethusdt@kline_5m");
    FakeSocket.open[0]?.open();
    first?.push(klineEvent("BTCUSDT", "1m", true));
    expect(client.getSnapshot().kline).toBeNull();
    FakeSocket.open[0]?.push({
      e: "kline",
      E: 1_700_000_000_500,
      s: "ETHUSDT",
      k: {
        t: 1_700_000_000_000,
        T: 1_700_000_299_999,
        s: "ETHUSDT",
        i: "5m",
        o: "3000",
        h: "3010",
        l: "2990",
        c: "3005",
        v: "40",
        x: false,
      },
    });
    expect(client.getSnapshot().kline?.symbol).toBe("ETHUSDT");
    expect(client.getSnapshot().kline?.timeframe).toBe("5m");
  });

  it("leaves LIVE on unexpected close and reconnects", () => {
    vi.useFakeTimers();
    const client = createBinanceLiveKlineClient({
      env: { KWIZERA_BINANCE_ENABLED: "1" },
      webSocketCtor: FakeSocket as unknown as new (url: string) => WebSocketLike,
    });
    client.subscribe("SOLUSDT", "15m");
    FakeSocket.open[0]?.open();
    FakeSocket.open[0]?.push({
      e: "kline",
      E: 1_700_000_000_500,
      s: "SOLUSDT",
      k: {
        t: 1_700_000_000_000,
        T: 1_700_000_899_999,
        s: "SOLUSDT",
        i: "15m",
        o: "180",
        h: "181",
        l: "179",
        c: "180.5",
        v: "9",
        x: false,
      },
    });
    expect(client.getSnapshot().liveMarketData).toBe(true);
    FakeSocket.open[0]?.close(1006);
    expect(client.getSnapshot().liveMarketData).toBe(false);
    expect(client.getSnapshot().connectionState).toBe("RECONNECTING");
    vi.advanceTimersByTime(1000);
    expect(FakeSocket.open[0]?.url).toContain("solusdt@kline_15m");
    client.disconnect();
  });
});

describe("Binance Phase 9 REST klines", () => {
  it("requests official klines for the selected interval", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      expect(url).toContain("/api/v3/klines?symbol=BTCUSDT&interval=1h");
      return new Response(JSON.stringify([
        [1_700_000_000_000, "100", "110", "90", "105", "1", 1_700_000_059_999],
      ]), { status: 200 });
    });
    const service = createBinanceMarketDataService({
      env: { KWIZERA_ENV: "production", KWIZERA_BINANCE_ENABLED: "1" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const result = await service.listKlines({ symbol: "BTCUSDT", timeframe: "1h", limit: 300 });
    expect(result.symbol).toBe("BTCUSDT");
    expect(result.timeframe).toBe("1h");
    expect(result.candles).toHaveLength(1);
    expect(result.candles[0]?.close).toBe(105);
  });
});
