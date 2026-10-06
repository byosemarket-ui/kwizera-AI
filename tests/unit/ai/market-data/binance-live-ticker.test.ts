import { afterEach, describe, expect, it, vi } from "vitest";
import { buildMiniTickerUrl, normalizeBinanceMiniTicker } from "../../../../ai/market-data/binance/adapter.ts";
import { BINANCE_DEFAULT_WS_BASE, resolveBinancePublicConfig } from "../../../../ai/market-data/binance/config.ts";
import { createBinanceLiveTickerClient, type WebSocketLike } from "../../../../ai/market-data/binance/live-ticker.ts";

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

  push(symbol: string, price: string, extra: Record<string, unknown> = {}): void {
    this.emit("message", {
      data: JSON.stringify({ e: "24hrMiniTicker", E: 1_700_000_000_000, s: symbol, c: price, o: "1", h: "2", l: "0.5", ...extra }),
    });
  }

  close(code = 1000): void {
    this.readyState = 3;
    FakeSocket.open = FakeSocket.open.filter((item) => item !== this);
    this.emit("close", { code });
  }
}

afterEach(() => {
  FakeSocket.open = [];
  vi.useRealTimers();
});

describe("Binance Phase 8 miniTicker adapter", () => {
  it("normalizes miniTicker payloads and rejects malformed values", () => {
    const tick = normalizeBinanceMiniTicker({
      e: "24hrMiniTicker",
      E: 1_700_000_000_000,
      s: "BTCUSDT",
      c: "65000.12",
      o: "64000",
      h: "66000",
      l: "63000",
    }, "BTCUSDT", 1_800_000_000_000);
    expect(tick?.symbol).toBe("BTCUSDT");
    expect(tick?.price).toBe(65000.12);
    expect(tick?.streamType).toBe("miniTicker");
    expect(tick?.source).toBe("binance-spot-public");
    expect(normalizeBinanceMiniTicker({ e: "24hrMiniTicker", E: 1, s: "ETHUSDT", c: "1" }, "BTCUSDT")).toBeNull();
    expect(normalizeBinanceMiniTicker({ e: "24hrMiniTicker", E: 1, s: "BTCUSDT", c: "NaN" })).toBeNull();
    expect(normalizeBinanceMiniTicker({ e: "trade", E: 1, s: "BTCUSDT", c: "1" })).toBeNull();
    expect(buildMiniTickerUrl(BINANCE_DEFAULT_WS_BASE, "btcusdt")).toBe("wss://stream.binance.com:9443/ws/btcusdt@miniTicker");
  });
});

describe("Binance Phase 8 live ticker client", () => {
  it("becomes LIVE only after a valid tick for the subscribed symbol", () => {
    const client = createBinanceLiveTickerClient({
      env: { KWIZERA_BINANCE_ENABLED: "1" },
      webSocketCtor: FakeSocket as unknown as new (url: string) => WebSocketLike,
    });
    client.subscribe("BTCUSDT");
    expect(client.getSnapshot().connectionState).toBe("CONNECTING");
    expect(client.getSnapshot().liveMarketData).toBe(false);
    FakeSocket.open[0]?.open();
    expect(client.getSnapshot().connectionState).toBe("CONNECTED");
    expect(client.getSnapshot().liveMarketData).toBe(false);
    expect(client.getSnapshot().message).toContain("Waiting for live Binance data");
    FakeSocket.open[0]?.push("BTCUSDT", "70123.45");
    expect(client.getSnapshot().liveMarketData).toBe(true);
    expect(client.getSnapshot().ticker?.price).toBe(70123.45);
    expect(client.getSnapshot().ticker?.symbol).toBe("BTCUSDT");
  });

  it("ignores ticks for the previous symbol after switching and keeps a single socket", () => {
    const client = createBinanceLiveTickerClient({
      env: { KWIZERA_BINANCE_ENABLED: "1" },
      webSocketCtor: FakeSocket as unknown as new (url: string) => WebSocketLike,
    });
    client.subscribe("BTCUSDT");
    const first = FakeSocket.open[0];
    first?.open();
    first?.push("BTCUSDT", "70000");
    client.subscribe("ETHUSDT");
    expect(FakeSocket.open).toHaveLength(1);
    expect(FakeSocket.open[0]).not.toBe(first);
    FakeSocket.open[0]?.open();
    first?.push("BTCUSDT", "99999");
    expect(client.getSnapshot().ticker).toBeNull();
    FakeSocket.open[0]?.push("ETHUSDT", "3500.5");
    expect(client.getSnapshot().ticker?.symbol).toBe("ETHUSDT");
    expect(client.getSnapshot().ticker?.price).toBe(3500.5);
    client.subscribe("ETHUSDT");
    expect(FakeSocket.open).toHaveLength(1);
  });

  it("leaves LIVE on unexpected close and reconnects with backoff", () => {
    vi.useFakeTimers();
    const client = createBinanceLiveTickerClient({
      env: { KWIZERA_BINANCE_ENABLED: "1" },
      webSocketCtor: FakeSocket as unknown as new (url: string) => WebSocketLike,
    });
    client.subscribe("SOLUSDT");
    FakeSocket.open[0]?.open();
    FakeSocket.open[0]?.push("SOLUSDT", "180");
    expect(client.getSnapshot().liveMarketData).toBe(true);
    FakeSocket.open[0]?.close(1006);
    expect(client.getSnapshot().liveMarketData).toBe(false);
    expect(client.getSnapshot().connectionState).toBe("RECONNECTING");
    vi.advanceTimersByTime(1000);
    expect(FakeSocket.open[0]?.url).toContain("solusdt@miniTicker");
    FakeSocket.open[0]?.open();
    FakeSocket.open[0]?.push("SOLUSDT", "181");
    expect(client.getSnapshot().liveMarketData).toBe(true);
    client.disconnect();
    expect(client.getSnapshot().connectionState).toBe("DISCONNECTED");
    expect(client.getSnapshot().liveMarketData).toBe(false);
  });

  it("rejects localhost WebSocket bases in production", () => {
    const config = resolveBinancePublicConfig({
      KWIZERA_ENV: "production",
      KWIZERA_BINANCE_WS_BASE: "ws://localhost:9443",
    });
    expect(config.websocketBaseUrl).toBe(BINANCE_DEFAULT_WS_BASE);
    expect(config.websocketFallbackUrls.every((url) => url.startsWith("wss://"))).toBe(true);
  });

  it("clears LIVE when ticks become stale", () => {
    vi.useFakeTimers();
    let now = 1_700_000_000_000;
    const client = createBinanceLiveTickerClient({
      env: { KWIZERA_BINANCE_ENABLED: "1" },
      webSocketCtor: FakeSocket as unknown as new (url: string) => WebSocketLike,
      now: () => now,
    });
    client.subscribe("BTCUSDT");
    FakeSocket.open[0]?.open();
    FakeSocket.open[0]?.push("BTCUSDT", "70000");
    expect(client.getSnapshot().liveMarketData).toBe(true);
    now += 31_000;
    vi.advanceTimersByTime(5_000);
    expect(client.getSnapshot().liveMarketData).toBe(false);
    client.disconnect();
  });
});
