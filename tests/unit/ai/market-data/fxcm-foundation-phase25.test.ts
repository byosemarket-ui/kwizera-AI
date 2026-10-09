/**
 * Phase 25 — FXCM market-data provider foundation tests.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  resolveFxcmConfig,
  FXCM_PHASE25_CAPABILITIES,
  FXCM_OFFICIAL_DEMO_REST_BASE,
  FXCM_OFFICIAL_REAL_REST_BASE,
} from "../../../../ai/market-data/fxcm/config.ts";
import {
  mapFxcmInstrumentList,
  toCanonicalFxcmSymbol,
  toDisplayFxcmSymbol,
  emptyNormalizedQuote,
  mapFxcmInstrumentType,
} from "../../../../ai/market-data/fxcm/instrument-mapper.ts";
import { parseEngineIoSid, assertFxcmTradingDisabled } from "../../../../ai/market-data/fxcm/client.ts";
import { createFxcmMarketDataProvider } from "../../../../ai/market-data/fxcm/provider.ts";
import { FxcmMarketDataError, userFacingFxcmError } from "../../../../ai/market-data/fxcm/errors.ts";
import {
  createMarketDataProviderRegistry,
  resolveMarketProviderForSymbol,
  marketIdentityKey,
  MARKET_PROVIDERS,
} from "../../../../ai/market-data/providers/index.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("Forex Phase 25 — FXCM market data foundation", () => {
  it("A/B provider registration + registry", async () => {
    expect(MARKET_PROVIDERS).toContain("BINANCE");
    expect(MARKET_PROVIDERS).toContain("FXCM");
    const registry = createMarketDataProviderRegistry({
      env: { KWIZERA_FXCM_ENABLED: "0" },
    });
    expect(registry.listProviderIds()).toEqual(["BINANCE", "FXCM", "FOREXCONNECT"]);
    expect(registry.getProvider("FXCM")).toBeTruthy();
    const snap = await registry.snapshot();
    expect(snap.providers.some((p) => p.info.provider === "BINANCE")).toBe(true);
    expect(snap.providers.some((p) => p.info.provider === "FXCM")).toBe(true);
  });

  it("C/D/E/F/G configuration validation demo/real/missing/invalid", () => {
    const demo = resolveFxcmConfig({
      KWIZERA_FXCM_ENABLED: "1",
      KWIZERA_FXCM_ENVIRONMENT: "demo",
      KWIZERA_FXCM_ACCESS_TOKEN: "abcdef0123456789abcdef0123456789",
    });
    expect(demo.environment).toBe("demo");
    expect(demo.environmentLabel).toBe("FXCM DEMO");
    expect(demo.restBaseUrl).toBe(FXCM_OFFICIAL_DEMO_REST_BASE);
    expect(demo.accessTokenConfigured).toBe(true);

    const real = resolveFxcmConfig({
      KWIZERA_FXCM_ENABLED: "1",
      KWIZERA_FXCM_ENVIRONMENT: "real",
      KWIZERA_FXCM_ACCESS_TOKEN: "abcdef0123456789abcdef0123456789",
    });
    expect(real.environment).toBe("real");
    expect(real.environmentLabel).toBe("FXCM REAL");
    expect(real.restBaseUrl).toBe(FXCM_OFFICIAL_REAL_REST_BASE);

    const missing = resolveFxcmConfig({ KWIZERA_FXCM_ENABLED: "1" });
    expect(missing.accessTokenConfigured).toBe(false);

    // Arbitrary URL override rejected — official hosts only
    const hijack = resolveFxcmConfig({
      KWIZERA_FXCM_ENABLED: "1",
      KWIZERA_FXCM_ENVIRONMENT: "demo",
      KWIZERA_FXCM_REST_BASE: "https://evil.example.com",
    });
    expect(hijack.restBaseUrl).toBe(FXCM_OFFICIAL_DEMO_REST_BASE);
  });

  it("H provider health states", async () => {
    const disabled = createFxcmMarketDataProvider({ env: { KWIZERA_FXCM_ENABLED: "0" } });
    const h1 = await disabled.healthCheck();
    expect(h1.status).toBe("DISABLED");
    expect(h1.liveStreamEnabled).toBe(false);
    expect(h1.tradingEnabled).toBe(false);

    const notCfg = createFxcmMarketDataProvider({
      env: { KWIZERA_FXCM_ENABLED: "1", KWIZERA_FXCM_ENVIRONMENT: "demo" },
    });
    const h2 = await notCfg.healthCheck();
    expect(h2.status).toBe("NOT_CONFIGURED");
    expect(h2.environmentLabel).toBe("FXCM DEMO");
  });

  it("I/J/K/L/M/N instrument mapping + identity + duplicates", () => {
    const list = mapFxcmInstrumentList({
      response: { executed: true },
      data: {
        instrument: [
          { symbol: "EUR/USD", visible: true, order: 1, instrumentType: 1 },
          { symbol: "EUR/USD", visible: true, order: 1, instrumentType: 1 },
          { symbol: "XAU/USD", visible: true, order: 2, instrumentType: 5 },
        ],
      },
    });
    expect(list).toHaveLength(2);
    expect(list[0]!.provider).toBe("FXCM");
    expect(list[0]!.providerSymbol).toBe("EUR/USD");
    expect(list[0]!.canonicalSymbol).toBe("EURUSD");
    expect(list[0]!.displaySymbol).toBe("EUR/USD");
    expect(list[0]!.marketType).toBe("FOREX");
    expect(list[1]!.marketType).toBe("COMMODITY");
    expect(toCanonicalFxcmSymbol("EUR/USD")).toBe("EURUSD");
    expect(toDisplayFxcmSymbol("EUR/USD")).toBe("EUR/USD");
    expect(mapFxcmInstrumentType(2, "US30")).toBe("INDEX");
    expect(marketIdentityKey({
      provider: "FXCM",
      marketType: "FOREX",
      symbol: "EURUSD",
    })).not.toBe(marketIdentityKey({
      provider: "BINANCE",
      marketType: "CRYPTO",
      symbol: "BTCUSDT",
    }));
  });

  it("O/P/Q normalized quote contract never fabricates prices", () => {
    const inst = mapFxcmInstrumentList([{ symbol: "EUR/USD", instrumentType: 1 }])[0]!;
    const quote = emptyNormalizedQuote(inst);
    expect(quote.bid).toBeNull();
    expect(quote.ask).toBeNull();
    expect(quote.mid).toBeNull();
    expect(quote.last).toBeNull();
    expect(quote.dataQuality).toBe("NO_DATA");
    expect(quote.providerTimestamp).toBeNull();
    expect(Number.isFinite(Date.parse(quote.normalizedTimestamp))).toBe(true);
  });

  it("R error normalization + sid parse", () => {
    const err = new FxcmMarketDataError("FXCM_AUTHENTICATION_FAILED", "bad");
    expect(userFacingFxcmError(err).code).toBe("FXCM_AUTHENTICATION_FAILED");
    const sid = parseEngineIoSid('97:0{"sid":"HHGqC3Gao2ENa5tNAAEu","upgrades":["websocket"]}');
    expect(sid).toBe("HHGqC3Gao2ENa5tNAAEu");
    expect(() => assertFxcmTradingDisabled("open_trade")).toThrow(/disabled/i);
  });

  it("S/T no credentials in frontend or logs helpers", () => {
    const adminApi = read("desktop/forex-admin/api.ts");
    const pages = read("desktop/forex-admin/ForexAdminPages.tsx");
    const intel = read("desktop/forex-admin/ForexAdminIntelligencePages.tsx");
    for (const src of [adminApi, pages, intel]) {
      expect(src).not.toContain("KWIZERA_FXCM_ACCESS_TOKEN");
      expect(src).not.toContain("FXCM_ACCESS_TOKEN");
      expect(src).not.toMatch(/api-demo\.fxcm\.com\/.*token/i);
    }
    const provider = read("ai/market-data/fxcm/provider.ts");
    expect(provider).not.toContain("console.info(token");
    expect(provider).not.toMatch(/console\.(info|log|error|warn)\([^)]*token/i);
    // Health logs must never include the raw token field
    expect(provider).toContain('console.info("[fxcm] health"');
    expect(provider).not.toContain("authorizationHeader");
  });

  it("U/V no trading methods / no fake market data in production modules", () => {
    const files = [
      "ai/market-data/fxcm/provider.ts",
      "ai/market-data/fxcm/client.ts",
      "ai/market-data/fxcm/config.ts",
      "dev/server/forex-providers-api.ts",
    ];
    const banned = [
      "placeOrder", "createOrder", "open_trade", "close_trade",
      "fakePrice", "mockPrice", "demoPrice", "simulatedPrice",
      "hardcodedFxPrice", "fakeFXCM", "mockQuote", "Math.random",
    ];
    for (const file of files) {
      const src = read(file);
      for (const token of banned) {
        expect(src).not.toContain(token);
      }
    }
    expect(FXCM_PHASE25_CAPABILITIES.trading).toBe(false);
    expect(FXCM_PHASE25_CAPABILITIES.liveQuotes).toBe(false);
    expect(FXCM_PHASE25_CAPABILITIES.streamingQuotes).toBe(false);
    // Phase 25 constant remains historical-off; Phase 28 enables candles on the live provider.
    expect(FXCM_PHASE25_CAPABILITIES.candles).toBe(false);
  });

  it("routing: BTCUSDT→BINANCE, EUR/USD→FXCM", () => {
    expect(resolveMarketProviderForSymbol("BTCUSDT")).toBe("BINANCE");
    expect(resolveMarketProviderForSymbol("EUR/USD")).toBe("FXCM");
    expect(resolveMarketProviderForSymbol("EURUSD")).toBe("FXCM");
    expect(resolveMarketProviderForSymbol("ETHUSDT", "BINANCE")).toBe("BINANCE");
    expect(resolveMarketProviderForSymbol("BTCUSDT", "FXCM")).toBe("FXCM"); // explicit wins
  });

  it("wires API + admin surfaces without second shell", () => {
    const index = read("dev/server/index.ts");
    const api = read("dev/server/forex-providers-api.ts");
    const routes = read("desktop/forex-admin/forex-admin-routes.ts");
    expect(index).toContain("handleForexProvidersApi");
    expect(api).toContain("/api/forex/providers");
    expect(api).toContain("/api/forex/providers/fxcm/status");
    expect(api).toContain("/api/forex/providers/fxcm/instruments");
    expect(api).not.toContain("open_trade");
    expect(routes).toContain("/admin/forex");
    expect(routes).not.toContain("/forex-ai-admin");
  });

  it("authenticated health uses mocked FXCM handshake + instruments", async () => {
    const token = "abcdef0123456789abcdef0123456789token";
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/socket.io/")) {
        return new Response('97:0{"sid":"TestSid123","upgrades":[]}', { status: 200 });
      }
      if (url.includes("/trading/get_instruments")) {
        return new Response(JSON.stringify({
          response: { executed: true },
          data: { instrument: [{ symbol: "EUR/USD", visible: true, order: 1, instrumentType: 1 }] },
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response("not found", { status: 404 });
    }) as typeof fetch;

    const provider = createFxcmMarketDataProvider({
      env: {
        KWIZERA_FXCM_ENABLED: "1",
        KWIZERA_FXCM_ENVIRONMENT: "demo",
        KWIZERA_FXCM_ACCESS_TOKEN: token,
      },
      fetchImpl,
    });
    const health = await provider.healthCheck();
    expect(health.status).toBe("CONNECTED");
    expect(health.authenticated).toBe(true);
    expect(health.liveStreamEnabled).toBe(false);
    expect(health.environmentLabel).toBe("FXCM DEMO");
    const instruments = await provider.listInstruments();
    expect(instruments[0]?.canonicalSymbol).toBe("EURUSD");
  });
});
