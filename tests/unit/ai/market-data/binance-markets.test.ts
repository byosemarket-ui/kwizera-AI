import { describe, expect, it } from "vitest";
import {
  filterBinanceMarkets,
  normalizeBinanceExchangeInfo,
  normalizeBinanceSpotMarket,
} from "../../../../ai/market-data/binance/adapter.ts";
import { createBinanceMarketDataService } from "../../../../ai/market-data/binance/service.ts";
import { fetchBinanceMarkets } from "../../../../desktop/forex/market-data/studio-binance-client.ts";
import { parseSelectedMarket } from "../../../../desktop/forex/market-data/selected-market.ts";

const sampleInfo = {
  symbols: [
    { symbol: "BTCUSDT", baseAsset: "BTC", quoteAsset: "USDT", status: "TRADING", permissions: ["SPOT"], isSpotTradingAllowed: true },
    { symbol: "ETHUSDT", baseAsset: "ETH", quoteAsset: "USDT", status: "BREAK", permissions: ["SPOT"], isSpotTradingAllowed: true },
    { symbol: "SOLUSDT", baseAsset: "SOL", quoteAsset: "USDT", status: "TRADING", permissions: ["SPOT"], isSpotTradingAllowed: true },
    { symbol: "BTCUSDT", baseAsset: "BTC", quoteAsset: "USDT", status: "TRADING", permissions: ["SPOT"], isSpotTradingAllowed: true },
    { symbol: "ETHBTC", baseAsset: "ETH", quoteAsset: "BTC", status: "TRADING", permissions: ["SPOT"], isSpotTradingAllowed: true },
    { symbol: "BTCUSDC", baseAsset: "BTC", quoteAsset: "USDC", status: "HALT", permissions: ["SPOT"], isSpotTradingAllowed: true },
    { symbol: "BAD", baseAsset: "", quoteAsset: "USDT", status: "TRADING", permissions: ["SPOT"] },
    { symbol: "FUTURESX", baseAsset: "X", quoteAsset: "USDT", status: "TRADING", permissions: ["FUTURES"], isSpotTradingAllowed: false },
  ],
};

describe("Binance Phase 7 market discovery", () => {
  it("normalizes Spot exchangeInfo and drops malformed, duplicate, and non-spot rows", () => {
    const markets = normalizeBinanceExchangeInfo(sampleInfo);
    expect(markets.map((item) => item.symbol)).toEqual(["BTCUSDT", "ETHBTC", "SOLUSDT", "BTCUSDC", "ETHUSDT"]);
    expect(normalizeBinanceSpotMarket(sampleInfo.symbols[0])?.displaySymbol).toBe("BTC/USDT");
    expect(markets.find((item) => item.symbol === "ETHUSDT")?.tradable).toBe(false);
    expect(markets.find((item) => item.symbol === "ETHUSDT")?.status).toBe("BREAK");
    expect(markets.find((item) => item.symbol === "BTCUSDC")?.status).toBe("HALT");
    expect(markets.every((item) => item.marketType === "spot" && item.venue === "binance-spot")).toBe(true);
    expect(() => normalizeBinanceExchangeInfo({ not: "symbols" })).toThrow(/Exchange information/);
  });

  it("filters locally by query, quote, and trading status", () => {
    const markets = normalizeBinanceExchangeInfo(sampleInfo);
    expect(filterBinanceMarkets(markets, { query: "btc" }).map((item) => item.symbol)).toEqual(["BTCUSDT", "ETHBTC", "BTCUSDC"]);
    expect(filterBinanceMarkets(markets, { query: "USDT" }).every((item) => item.quoteAsset === "USDT" || item.symbol.includes("USDT"))).toBe(true);
    expect(filterBinanceMarkets(markets, { query: "BTCUSDT" }).map((item) => item.symbol)).toEqual(["BTCUSDT"]);
    expect(filterBinanceMarkets(markets, { quoteAsset: "USDT", tradable: "trading" }).map((item) => item.symbol)).toEqual(["BTCUSDT", "SOLUSDT"]);
    expect(filterBinanceMarkets(markets, { query: "ZZZNOPE" })).toEqual([]);
    expect(filterBinanceMarkets(markets, { query: "" }).length).toBe(markets.length);
  });

  it("caches exchangeInfo and does not treat discovery as live prices", async () => {
    let calls = 0;
    const fetchImpl = (async (input: RequestInfo | URL) => {
      calls += 1;
      const url = String(input);
      expect(url).toContain("/api/v3/exchangeInfo");
      return new Response(JSON.stringify(sampleInfo), { status: 200 });
    }) as typeof fetch;
    const service = createBinanceMarketDataService({
      env: { KWIZERA_ENV: "production", KWIZERA_BINANCE_ENABLED: "1" },
      fetchImpl,
    });
    const first = await service.listSpotMarkets();
    const second = await service.listSpotMarkets();
    expect(first.markets.some((item) => item.symbol === "BTCUSDT")).toBe(true);
    expect(second.cached).toBe(true);
    expect(calls).toBe(1);
    expect(service.getSnapshot().liveMarketData).toBe(false);
    expect(await service.findSpotMarket("eth/usdt")).toMatchObject({ symbol: "ETHUSDT", status: "BREAK" });
    expect(await service.findSpotMarket("NOPEUSDT")).toBeNull();
  });
});

describe("Binance Phase 7 selected market", () => {
  it("parses compact Binance symbols separately from unsupported traditional Forex pairs", () => {
    expect(parseSelectedMarket("EURUSD")).toEqual({ venue: "unsupported", symbol: "EUR/USD", displaySymbol: "EUR/USD" });
    expect(parseSelectedMarket("EUR/USD")).toEqual({ venue: "unsupported", symbol: "EUR/USD", displaySymbol: "EUR/USD" });
    expect(parseSelectedMarket("btcusdt")).toEqual({
      venue: "binance-spot",
      symbol: "BTCUSDT",
      displaySymbol: "BTC/USDT",
      provider: "BINANCE",
    });
    expect(parseSelectedMarket("EURUSDC")).toEqual({
      venue: "binance-spot",
      symbol: "EURUSDC",
      displaySymbol: "EUR/USDC",
      provider: "BINANCE",
    });
    expect(parseSelectedMarket("!!!")).toBeNull();
    expect(parseSelectedMarket("")).toBeNull();
  });
});

describe("Binance Phase 7 studio markets client", () => {
  it("loads normalized markets from the same-origin Studio route", async () => {
    const markets = normalizeBinanceExchangeInfo(sampleInfo);
    const fetchImpl = (async (input: RequestInfo | URL) => {
      expect(String(input)).toBe("/api/forex/binance/markets");
      return new Response(JSON.stringify({
        ok: true,
        markets,
        restBaseHost: "api.binance.com",
        fetchedAtUtc: 1,
        liveMarketData: false,
      }), { status: 200 });
    }) as typeof fetch;
    const result = await fetchBinanceMarkets({ fetchImpl });
    expect(result.state).toBe("ready");
    expect(result.markets[0]?.symbol).toBe("BTCUSDT");
    expect(result.message).toContain("Prices are not included");
  });

  it("maps disabled and invalid payloads to explicit UI states", async () => {
    const disabled = await fetchBinanceMarkets({
      fetchImpl: (async () => new Response(JSON.stringify({
        ok: false,
        error: { code: "BINANCE_DISABLED", message: "off" },
      }), { status: 503 })) as typeof fetch,
    });
    expect(disabled.state).toBe("disconnected");
    expect(disabled.message).toBe("Binance market service unavailable.");
    const invalid = await fetchBinanceMarkets({
      fetchImpl: (async () => new Response(JSON.stringify({ ok: true, markets: [{ symbol: 1 }] }), { status: 200 })) as typeof fetch,
    });
    expect(invalid.state).toBe("empty");
  });
});
