/**
 * Phase 31 — Unified Market Data Layer (Binance + FXCM).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildForexMarketState, toForexAiMarketState } from "../../../../ai/forex-market-state/index.ts";
import {
  buildMarketIdentity,
  candleIdentityKey,
  marketDataCacheKey,
  marketIdentityKey,
  normalizeCanonicalSymbol,
  parseMarketProviderId,
} from "../../../../ai/market-data/providers/identity.ts";
import {
  createMarketInstrumentRegistry,
} from "../../../../ai/market-data/providers/instrument-registry.ts";
import {
  createMarketDataService,
  MarketDataRoutingError,
  resetMarketDataServiceForTests,
} from "../../../../ai/market-data/providers/market-data-service.ts";
import {
  createMarketDataProviderRegistry,
  FXCM_PHASE31_CAPABILITIES,
  MARKET_PROVIDERS,
  parseCanonicalTimeframe,
  requireExplicitProvider,
  resolveMarketProviderForSymbol,
} from "../../../../ai/market-data/providers/index.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

const sampleCandles = [
  { time: 1_700_000_000, open: 100, high: 101, low: 99, close: 100.5, volume: 10, closed: true },
  { time: 1_700_000_900, open: 100.5, high: 102, low: 100, close: 101, volume: 12, closed: false },
];

describe("Forex Phase 31 — Unified Market Data Layer", () => {
  it("1-4 provider registry registers BINANCE and FXCM", async () => {
    expect(MARKET_PROVIDERS).toEqual(["BINANCE", "FXCM"]);
    const registry = createMarketDataProviderRegistry({
      env: { KWIZERA_FXCM_ENABLED: "0", KWIZERA_BINANCE_PUBLIC_ENABLED: "1" },
    });
    expect(registry.listProviderIds()).toEqual(["BINANCE", "FXCM"]);
    expect(registry.getProvider("BINANCE")).toBeTruthy();
    expect(registry.getProvider("FXCM")).toBeTruthy();
    const snap = await registry.snapshot();
    expect(snap.providers.map((p) => p.info.provider).sort()).toEqual(["BINANCE", "FXCM"]);
  });

  it("5-9 market identity keeps provider + marketType + symbol", () => {
    const binance = buildMarketIdentity({
      provider: "BINANCE",
      marketType: "CRYPTO",
      providerSymbol: "BTCUSDT",
      displaySymbol: "BTC/USDT",
    });
    const fxcm = buildMarketIdentity({
      provider: "FXCM",
      marketType: "FOREX",
      providerSymbol: "EUR/USD",
      canonicalSymbol: "EURUSD",
      displaySymbol: "EUR/USD",
      environment: "demo",
    });
    expect(binance.canonicalSymbol).toBe("BTCUSDT");
    expect(fxcm.canonicalSymbol).toBe("EURUSD");
    expect(marketIdentityKey(binance)).toBe("BINANCE:CRYPTO:BTCUSDT");
    expect(marketIdentityKey(fxcm)).toContain("FXCM:FOREX:EURUSD");
    expect(marketIdentityKey(binance)).not.toBe(marketIdentityKey({
      provider: "FXCM",
      marketType: "FOREX",
      symbol: "EURUSD",
    }));
    expect(normalizeCanonicalSymbol("EUR/USD")).toBe("EURUSD");
    expect(parseMarketProviderId("fxcm")).toBe("FXCM");
  });

  it("10-12 quote/candle/timeframe contracts", () => {
    expect(parseCanonicalTimeframe("15m")).toBe("15m");
    expect(parseCanonicalTimeframe("15M")).toBe("15m");
    expect(parseCanonicalTimeframe("3m")).toBeNull();
    const candleKey = candleIdentityKey({
      provider: "FXCM",
      marketType: "FOREX",
      symbol: "EURUSD",
      timeframe: "15m",
      time: 1_700_000_000,
    });
    expect(candleKey).toContain("FXCM:FOREX:EURUSD:15m:1700000000");
    expect(FXCM_PHASE31_CAPABILITIES.liveCandles).toBe(true);
    expect(FXCM_PHASE31_CAPABILITIES.trading).toBe(false);
  });

  it("13-16 routing requires provider and never falls back", async () => {
    resetMarketDataServiceForTests();
    const service = createMarketDataService({
      env: { KWIZERA_FXCM_ENABLED: "0", KWIZERA_BINANCE_PUBLIC_ENABLED: "0" },
    });
    expect(requireExplicitProvider(null).ok).toBe(false);
    expect(requireExplicitProvider("FXCM")).toEqual({ ok: true, provider: "FXCM" });
    await expect(service.getHistoricalCandles({
      provider: "UNKNOWN",
      symbol: "EURUSD",
      timeframe: "15m",
    })).rejects.toBeInstanceOf(MarketDataRoutingError);

    // FXCM unavailable must not become Binance.
    await expect(service.getHistoricalCandles({
      provider: "FXCM",
      symbol: "EUR/USD",
      timeframe: "15m",
    })).rejects.toSatisfy((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      return /FXCM|disabled|not configured|unavailable/i.test(message)
        || (err instanceof MarketDataRoutingError);
    });
  });

  it("17-21 instrument registry + cache isolation + collision", () => {
    const registry = createMarketInstrumentRegistry();
    registry.upsert({
      provider: "BINANCE",
      providerSymbol: "EURUSDC",
      canonicalSymbol: "EURUSDC",
      displaySymbol: "EUR/USDC",
      marketType: "CRYPTO",
      baseAsset: "EUR",
      quoteAsset: "USDC",
      status: "available",
      capabilities: { ...FXCM_PHASE31_CAPABILITIES, liveCandles: true },
      metadata: {},
    });
    registry.upsert({
      provider: "FXCM",
      providerSymbol: "EUR/USD",
      canonicalSymbol: "EURUSD",
      displaySymbol: "EUR/USD",
      marketType: "FOREX",
      baseAsset: "EUR",
      quoteAsset: "USD",
      status: "available",
      capabilities: { ...FXCM_PHASE31_CAPABILITIES },
      metadata: {},
    });
    expect(registry.findByCanonical("BINANCE", "EURUSDC")?.provider).toBe("BINANCE");
    expect(registry.findByCanonical("FXCM", "EURUSD")?.provider).toBe("FXCM");
    expect(registry.findByCanonical("BINANCE", "EURUSD")).toBeNull();
    expect(registry.listByProvider("FXCM")).toHaveLength(1);
    expect(registry.listByMarketType("FOREX")).toHaveLength(1);

    const binanceCache = marketDataCacheKey({
      provider: "BINANCE",
      marketType: "CRYPTO",
      symbol: "EURUSDC",
      timeframe: "15m",
      kind: "historical",
    });
    const fxcmCache = marketDataCacheKey({
      provider: "FXCM",
      marketType: "FOREX",
      symbol: "EURUSD",
      timeframe: "15m",
      kind: "historical",
      environment: "demo",
    });
    expect(binanceCache).not.toBe(fxcmCache);
    expect(fxcmCache).toContain("FXCM");
    expect(fxcmCache).toContain("DEMO");
  });

  it("22-24 connection/data-quality/provider health surface", async () => {
    const service = createMarketDataService({
      env: { KWIZERA_FXCM_ENABLED: "0" },
    });
    const health = await service.getProviderHealth();
    expect(health.some((h) => h.provider === "BINANCE")).toBe(true);
    expect(health.some((h) => h.provider === "FXCM")).toBe(true);
    const fxcm = health.find((h) => h.provider === "FXCM")!;
    expect(fxcm.capabilities.trading).toBe(false);
    expect(fxcm.capabilities.liveCandles).toBe(true);
  });

  it("25-30 Market State provider isolation + AI bridge", () => {
    const binanceState = buildForexMarketState({
      symbol: "BTCUSDT",
      timeframe: "15m",
      candles: sampleCandles,
      connection: "LIVE",
      provider: "BINANCE",
      marketType: "SPOT",
      lastMarketUpdateMs: Date.now(),
    });
    const fxcmState = buildForexMarketState({
      symbol: "EUR/USD",
      timeframe: "15m",
      candles: sampleCandles,
      connection: "LIVE",
      provider: "FXCM",
      marketType: "FOREX",
      displaySymbol: "EUR/USD",
      providerSymbol: "EUR/USD",
      lastMarketUpdateMs: Date.now(),
    });
    expect(binanceState.provider).toBe("BINANCE");
    expect(binanceState.exchange).toBe("BINANCE");
    expect(binanceState.dataSource).toBe("binance-spot");
    expect(fxcmState.provider).toBe("FXCM");
    expect(fxcmState.exchange).toBe("FXCM");
    expect(fxcmState.marketType).toBe("FOREX");
    expect(fxcmState.dataSource).toBe("fxcm-mid");
    expect(fxcmState.symbol).toBe("EURUSD");

    const aiFxcm = toForexAiMarketState(fxcmState);
    expect(aiFxcm.exchange).toBe("FXCM");
    expect(aiFxcm.dataSource).toBe("fxcm-mid");
    expect(aiFxcm.marketType).toBe("FOREX");

    const aiBinance = toForexAiMarketState(binanceState);
    expect(aiBinance.exchange).toBe("BINANCE");
    expect(aiBinance.dataSource).toBe("binance-spot");
  });

  it("31-35 no fake data / no secrets / surface wiring", () => {
    const serviceSrc = read("ai/market-data/providers/market-data-service.ts");
    expect(serviceSrc).not.toMatch(/Math\.random/);
    expect(serviceSrc).not.toMatch(/fakeCandles|mockPrice|simulatedPrice/);
    expect(serviceSrc).toMatch(/Never silently falls back|never falls back|No cross-provider fallback|never fall back/i);

    const apiSrc = read("dev/server/forex-market-data-api.ts");
    expect(apiSrc).toContain("/api/forex/market-data/status");
    expect(apiSrc).toContain("/api/forex/market-data/instruments");
    expect(apiSrc).toContain("/api/forex/market-data/candles");
    expect(apiSrc).not.toMatch(/FXCM_PASSWORD|ACCESS_TOKEN|Bearer /);

    const marketsSrc = read("desktop/forex/ForexMarketsPage.tsx");
    expect(marketsSrc).toContain("data-provider-filter");
    expect(marketsSrc).toContain("FXCM");

    const watchlistSrc = read("desktop/forex/market-data/session-watchlist.ts");
    expect(watchlistSrc).toContain("kwizera-forex-watchlist-v2");
    expect(watchlistSrc).toContain("provider");

    const chartSrc = read("desktop/forex/chart/ForexChartWorkspace.tsx");
    expect(chartSrc).toContain('provider: "FXCM"');
    expect(chartSrc).toContain("data-fx-provider");

    expect(resolveMarketProviderForSymbol("BTCUSDT")).toBe("BINANCE");
    expect(resolveMarketProviderForSymbol("EUR/USD", "FXCM")).toBe("FXCM");
    expect(resolveMarketProviderForSymbol("EURUSDC", "BINANCE")).toBe("BINANCE");
  });

  it("36-39 server index wires unified API; index exports service", () => {
    const indexSrc = read("dev/server/index.ts");
    expect(indexSrc).toContain("handleForexMarketDataApi");
    const barrel = read("ai/market-data/providers/index.ts");
    expect(barrel).toContain("market-data-service");
    expect(barrel).toContain("instrument-registry");
    expect(barrel).toContain("contracts");
  });
});
