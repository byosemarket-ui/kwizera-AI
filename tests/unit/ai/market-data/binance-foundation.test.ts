import { describe, expect, it, vi } from "vitest";
import { normalizeBinanceKline, normalizeBinanceKlines, normalizeBinanceTicker24h, toBinanceSymbol } from "../../../ai/market-data/binance/adapter.ts";
import { BINANCE_DEFAULT_REST_BASE, resolveBinancePublicConfig } from "../../../ai/market-data/binance/config.ts";
import { publicConnectionLabel, snapshotForState } from "../../../ai/market-data/binance/connection.ts";
import { BinanceMarketDataError } from "../../../ai/market-data/binance/errors.ts";
import { createBinanceMarketDataService } from "../../../ai/market-data/binance/service.ts";
import { fetchBinanceConnectionStatus } from "../../../desktop/forex/market-data/studio-binance-client.ts";

describe("Binance Phase 6 configuration", () => {
  it("uses official HTTPS Binance hosts and rejects localhost in production", () => {
    const production = resolveBinancePublicConfig({
      KWIZERA_ENV: "production",
      KWIZERA_BINANCE_REST_BASE: "http://127.0.0.1:8787",
      KWIZERA_BINANCE_WS_BASE: "ws://localhost:9443",
    });
    expect(production.restBaseUrl).toBe(BINANCE_DEFAULT_REST_BASE);
    expect(production.restBaseHost).toBe("api.binance.com");
    expect(production.websocketBaseUrl.startsWith("wss://")).toBe(true);
    expect(production.usedOfficialFallback).toBe(true);
    expect(production.environment).toBe("production");
  });

  it("does not read private API credentials from the environment", () => {
    const config = resolveBinancePublicConfig({
      BINANCE_API_KEY: "should-never-be-used",
      BINANCE_API_SECRET: "should-never-be-used",
    });
    expect(JSON.stringify(config)).not.toContain("should-never-be-used");
    expect(JSON.stringify(config)).not.toMatch(/apiKey|apiSecret/i);
  });
});

describe("Binance Phase 6 adapter", () => {
  it("normalizes klines and tickers without leaking raw Binance keys into the candle shape", () => {
    const candle = normalizeBinanceKline([
      1_700_000_000_000,
      "100",
      "110",
      "90",
      "105",
      "12.5",
      1_700_000_060_000,
    ]);
    expect(candle).toEqual({
      time: 1_700_000_000,
      open: 100,
      high: 110,
      low: 90,
      close: 105,
      volume: 12.5,
      closed: true,
    });
    expect(toBinanceSymbol("btc/usdt")).toBe("BTCUSDT");
    const ticker = normalizeBinanceTicker24h({
      symbol: "ETHUSDT",
      lastPrice: "2500.5",
      priceChange: "10",
      priceChangePercent: "0.4",
      highPrice: "2510",
      lowPrice: "2480",
      volume: "1000",
      closeTime: 1_700_000_000_000,
    });
    expect(ticker.instrument.displaySymbol).toBe("ETH/USDT");
    expect(ticker.instrument.venue).toBe("binance-spot");
    expect(ticker.price).toBe(2500.5);
    expect(() => normalizeBinanceKlines({ not: "array" })).toThrow(BinanceMarketDataError);
  });
});

describe("Binance Phase 6 service probe", () => {
  it("marks CONNECTED without live market data after a successful public ping", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/v3/ping")) return new Response("{}", { status: 200 });
      if (url.endsWith("/api/v3/time")) return new Response(JSON.stringify({ serverTime: 1_700_000_000_000 }), { status: 200 });
      return new Response("nope", { status: 404 });
    });
    const service = createBinanceMarketDataService({
      env: { KWIZERA_ENV: "production", KWIZERA_BINANCE_ENABLED: "1" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const snapshot = await service.probePublicRest();
    expect(snapshot.state).toBe("CONNECTED");
    expect(snapshot.liveMarketData).toBe(false);
    expect(snapshot.websocketActive).toBe(false);
    expect(snapshot.restReachable).toBe(true);
    expect(snapshot.serverTimeUtc).toBe(1_700_000_000_000);
    expect(publicConnectionLabel(snapshot)).toBe("Binance public API reachable");
    expect(snapshot.message).toContain("not streaming");
  });

  it("surfaces ERROR without claiming live data when Binance is unreachable", async () => {
    const service = createBinanceMarketDataService({
      env: { KWIZERA_BINANCE_ENABLED: "1" },
      fetchImpl: (async () => {
        throw new Error("network down");
      }) as typeof fetch,
    });
    const snapshot = await service.probePublicRest();
    expect(snapshot.state).toBe("ERROR");
    expect(snapshot.liveMarketData).toBe(false);
    expect(snapshot.errorCode).toBe("BINANCE_NETWORK");
  });
});

describe("Binance Phase 6 studio client", () => {
  it("calls the same-origin Studio status route and never treats ping as live", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe("/api/forex/binance/status");
      return new Response(JSON.stringify({
        ok: true,
        snapshot: snapshotForState(resolveBinancePublicConfig({ KWIZERA_ENV: "production" }), "CONNECTED", {
          restReachable: true,
          message: "Binance public API reachable. Live market data is not streaming.",
        }),
      }), { status: 200 });
    });
    const snapshot = await fetchBinanceConnectionStatus(fetchImpl as unknown as typeof fetch);
    expect(snapshot.state).toBe("CONNECTED");
    expect(snapshot.liveMarketData).toBe(false);
  });
});
