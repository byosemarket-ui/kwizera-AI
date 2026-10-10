/**
 * Phase 34 — ForexConnect historical candles (mocked sidecar; not proof of live FXCM).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  createForexConnectBridge,
  assertNoSecretsInForexConnectPayload,
} from "../../../../ai/market-data/forexconnect/client.ts";
import { ForexConnectMarketDataError } from "../../../../ai/market-data/forexconnect/errors.ts";
import {
  normalizeForexConnectHistoryRow,
  normalizeForexConnectHistoryRows,
  validateOhlc,
} from "../../../../ai/market-data/forexconnect/historical-normalize.ts";
import {
  FOREXCONNECT_SUPPORTED_PROJECT_TIMEFRAMES,
  toForexConnectPeriodId,
  isForexConnectSupportedTimeframe,
} from "../../../../ai/market-data/forexconnect/timeframes.ts";
import { createMarketDataService } from "../../../../ai/market-data/providers/market-data-service.ts";
import { createMarketDataProviderRegistry } from "../../../../ai/market-data/providers/registry.ts";
import { parseMarketProviderId } from "../../../../ai/market-data/providers/identity.ts";
import { requireExplicitProvider } from "../../../../ai/market-data/providers/routing.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

const ENABLED_ENV = {
  KWIZERA_FOREXCONNECT_ENABLED: "1",
  KWIZERA_FOREXCONNECT_USERNAME: "demo",
  KWIZERA_FOREXCONNECT_PASSWORD: "demo-pass-1234",
  KWIZERA_FOREXCONNECT_ENVIRONMENT: "demo",
};

function connectedStatus() {
  return {
    ok: true,
    provider: "FOREXCONNECT",
    status: "CONNECTED",
    enabled: true,
    configured: true,
    environment: "demo",
    environmentLabel: "FXCM DEMO",
    usernameConfigured: true,
    passwordConfigured: true,
    trading: "DISABLED",
    historicalCapable: true,
    priceBasis: "bid",
  };
}

describe("Phase 34 ForexConnect timeframe mapping", () => {
  it("maps project timeframes 1:1 to SDK periods", () => {
    expect(toForexConnectPeriodId("1m")).toBe("m1");
    expect(toForexConnectPeriodId("1h")).toBe("H1");
    expect(toForexConnectPeriodId("4h")).toBe("H4");
    expect(toForexConnectPeriodId("1d")).toBe("D1");
    expect(toForexConnectPeriodId("1w")).toBe("W1");
    expect(isForexConnectSupportedTimeframe("2h")).toBe(false);
    expect(toForexConnectPeriodId("2h")).toBeNull();
    expect(FOREXCONNECT_SUPPORTED_PROJECT_TIMEFRAMES).toContain("15m");
  });
});

describe("Phase 34 candle normalization", () => {
  it("normalizes bid OHLC and preserves volume when supplied", () => {
    const candle = normalizeForexConnectHistoryRow({
      Date: "2026-01-01T12:00:00Z",
      BidOpen: 1.1,
      BidHigh: 1.2,
      BidLow: 1.05,
      BidClose: 1.15,
      Volume: 42,
    }, { timeframeMs: 3_600_000, nowMs: Date.parse("2026-01-01T14:00:00Z") });
    expect(candle).not.toBeNull();
    expect(candle!.priceBasis).toBe("bid");
    expect(candle!.open).toBe(1.1);
    expect(candle!.high).toBe(1.2);
    expect(candle!.low).toBe(1.05);
    expect(candle!.close).toBe(1.15);
    expect(candle!.volume).toBe(42);
    expect(candle!.closed).toBe(true);
  });

  it("rejects malformed OHLC and does not invent volume", () => {
    expect(validateOhlc(1, 0.5, 0.4, 0.9)).toBe(false);
    expect(normalizeForexConnectHistoryRow({
      Date: "2026-01-01T12:00:00Z",
      BidOpen: 1.1,
      BidHigh: 1.0,
      BidLow: 1.05,
      BidClose: 1.08,
    })).toBeNull();
    const noVol = normalizeForexConnectHistoryRow({
      Date: "2026-01-01T12:00:00Z",
      BidOpen: 1.1,
      BidHigh: 1.2,
      BidLow: 1.0,
      BidClose: 1.15,
    });
    expect(noVol!.volume).toBeNull();
  });

  it("sorts, dedupes, and keeps empty authentic lists empty", () => {
    const { candles, invalidCandles, duplicatesRemoved } = normalizeForexConnectHistoryRows([
      { Date: "2026-01-01T13:00:00Z", BidOpen: 1, BidHigh: 2, BidLow: 0.5, BidClose: 1.5, Volume: 1 },
      { Date: "2026-01-01T12:00:00Z", BidOpen: 1, BidHigh: 2, BidLow: 0.5, BidClose: 1.5, Volume: 1 },
      { Date: "2026-01-01T12:00:00Z", BidOpen: 1.1, BidHigh: 2, BidLow: 0.5, BidClose: 1.5, Volume: 2 },
      { bad: true },
    ], "1h", Date.parse("2026-01-02T00:00:00Z"));
    expect(invalidCandles).toBe(1);
    expect(duplicatesRemoved).toBe(1);
    expect(candles.map((c) => c.time)).toEqual([
      Date.parse("2026-01-01T12:00:00Z") / 1000,
      Date.parse("2026-01-01T13:00:00Z") / 1000,
    ]);
    expect(normalizeForexConnectHistoryRows([], "1h").candles).toEqual([]);
  });
});

describe("Phase 34 bridge historical path (mocked)", () => {
  it("rejects disabled / unconfigured / unsupported timeframe", async () => {
    const disabled = createForexConnectBridge({
      env: { KWIZERA_FOREXCONNECT_ENABLED: "0" },
      fetchImpl: (async () => { throw new Error("no"); }) as typeof fetch,
    });
    await expect(disabled.getHistoricalCandles({ symbol: "EUR/USD", timeframe: "1h" }))
      .rejects.toMatchObject({ code: "FOREXCONNECT_DISABLED" });

    const unconfigured = createForexConnectBridge({
      env: { KWIZERA_FOREXCONNECT_ENABLED: "1" },
      fetchImpl: (async () => { throw new Error("no"); }) as typeof fetch,
    });
    await expect(unconfigured.getHistoricalCandles({ symbol: "EUR/USD", timeframe: "1h" }))
      .rejects.toMatchObject({ code: "FOREXCONNECT_NOT_CONFIGURED" });

    const badTf = createForexConnectBridge({
      env: ENABLED_ENV,
      fetchImpl: (async () => new Response(JSON.stringify(connectedStatus()), { status: 200 })) as typeof fetch,
    });
    await expect(badTf.getHistoricalCandles({ symbol: "EUR/USD", timeframe: "2h" }))
      .rejects.toMatchObject({ code: "FOREXCONNECT_UNSUPPORTED_TIMEFRAME" });
  });

  it("returns normalized candles from mocked sidecar and redacts secrets", async () => {
    const bridge = createForexConnectBridge({
      env: ENABLED_ENV,
      fetchImpl: (async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/status")) {
          return new Response(JSON.stringify(connectedStatus()), { status: 200 });
        }
        if (url.includes("/candles")) {
          return new Response(JSON.stringify({
            ok: true,
            provider: "FOREXCONNECT",
            providerSymbol: "EUR/USD",
            canonicalSymbol: "EURUSD",
            displaySymbol: "EUR/USD",
            timeframe: "1h",
            periodId: "H1",
            priceBasis: "bid",
            candles: [{
              Date: "2026-01-01T12:00:00Z",
              BidOpen: 1.1,
              BidHigh: 1.2,
              BidLow: 1.05,
              BidClose: 1.15,
              Volume: 10,
            }],
            count: 1,
            fetchedAt: "2026-01-01T12:05:00Z",
          }), { status: 200 });
        }
        return new Response("{}", { status: 404 });
      }) as typeof fetch,
    });
    const result = await bridge.getHistoricalCandles({ symbol: "EUR/USD", timeframe: "1h", limit: 20 });
    expect(result.ok).toBe(true);
    expect(result.provider).toBe("FOREXCONNECT");
    expect(result.priceBasis).toBe("bid");
    expect(result.periodId).toBe("H1");
    expect(result.candles).toHaveLength(1);
    expect(result.candles[0]!.open).toBe(1.1);
    assertNoSecretsInForexConnectPayload(result, ENABLED_ENV);
  });

  it("surfaces sidecar timeout / auth failure as explicit errors", async () => {
    const down = createForexConnectBridge({
      env: ENABLED_ENV,
      fetchImpl: (async (input: RequestInfo | URL) => {
        if (String(input).includes("/status")) {
          return new Response(JSON.stringify(connectedStatus()), { status: 200 });
        }
        throw new Error("connect ECONNREFUSED");
      }) as typeof fetch,
    });
    await expect(down.getHistoricalCandles({ symbol: "EUR/USD", timeframe: "1h" }))
      .rejects.toBeInstanceOf(ForexConnectMarketDataError);

    const auth = createForexConnectBridge({
      env: ENABLED_ENV,
      fetchImpl: (async () => new Response(JSON.stringify({
        ...connectedStatus(),
        status: "AUTHENTICATION_FAILED",
        errorCode: "FOREXCONNECT_AUTHENTICATION_FAILED",
      }), { status: 200 })) as typeof fetch,
    });
    await expect(auth.getHistoricalCandles({ symbol: "EUR/USD", timeframe: "1h" }))
      .rejects.toMatchObject({ code: "FOREXCONNECT_AUTHENTICATION_FAILED" });
  });
});

describe("Phase 34 unified provider routing", () => {
  it("recognizes FOREXCONNECT identity and never confuses with FXCM/BINANCE", () => {
    expect(parseMarketProviderId("FOREXCONNECT")).toBe("FOREXCONNECT");
    expect(requireExplicitProvider("FOREXCONNECT")).toEqual({ ok: true, provider: "FOREXCONNECT" });
    const registry = createMarketDataProviderRegistry({ env: ENABLED_ENV });
    expect(registry.listProviderIds()).toContain("FOREXCONNECT");
    expect(registry.getProvider("FOREXCONNECT")).not.toBeNull();
    expect(registry.getFxcm().getProviderInfo().provider).toBe("FXCM");
    expect(registry.getForexConnect().getProviderInfo().provider).toBe("FOREXCONNECT");
  });

  it("routes unified historical FOREXCONNECT requests to the FC bridge (mock)", async () => {
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/status")) {
        return new Response(JSON.stringify(connectedStatus()), { status: 200 });
      }
      if (url.includes("/candles")) {
        return new Response(JSON.stringify({
          ok: true,
          providerSymbol: "EUR/USD",
          canonicalSymbol: "EURUSD",
          displaySymbol: "EUR/USD",
          periodId: "H1",
          candles: [{
            Date: "2026-01-01T12:00:00Z",
            BidOpen: 1.1,
            BidHigh: 1.2,
            BidLow: 1.05,
            BidClose: 1.15,
            Volume: null,
          }],
        }), { status: 200 });
      }
      return new Response("{}", { status: 404 });
    }) as typeof fetch;

    const service = createMarketDataService({
      env: ENABLED_ENV,
      fetchImpl,
      registry: createMarketDataProviderRegistry({ env: ENABLED_ENV, fetchImpl }),
    });
    const series = await service.getHistoricalCandles({
      provider: "FOREXCONNECT",
      symbol: "EUR/USD",
      timeframe: "1h",
      limit: 10,
    });
    expect(series.source).toBe("FOREXCONNECT");
    expect(series.identity.provider).toBe("FOREXCONNECT");
    expect(series.candles[0]?.provider).toBe("FOREXCONNECT");
    expect(series.candles[0]?.source).toBe("FOREXCONNECT");
    expect(series.count).toBe(1);
  });

  it("keeps FOREXCONNECT disabled errors explicit (no Binance fallback)", async () => {
    const service = createMarketDataService({
      env: { KWIZERA_FOREXCONNECT_ENABLED: "0" },
      fetchImpl: (async () => {
        throw new Error("should not call sidecar or Binance for disabled FC");
      }) as typeof fetch,
    });
    await expect(service.getHistoricalCandles({
      provider: "FOREXCONNECT",
      symbol: "EUR/USD",
      timeframe: "1h",
    })).rejects.toMatchObject({ code: "FOREXCONNECT_DISABLED" });
  });
});

describe("Phase 34 file/route presence", () => {
  it("exposes candles routes and Admin historical diagnostics", () => {
    const api = read("dev/server/forexconnect-api.ts");
    const sidecar = read("services/forexconnect-sidecar/server.py");
    const page = read("desktop/forex-admin/ForexAdminForexConnectPage.tsx");
    const charts = read("desktop/forex/chart/ForexChartWorkspace.tsx");
    expect(api).toContain("/api/forex/providers/forexconnect/candles");
    expect(sidecar).toContain("get_history");
    expect(sidecar).toContain("/candles");
    expect(page).toContain("Load history");
    expect(page).toContain("ForexConnect Accounts");
    expect(charts).toContain("FOREXCONNECT");
    expect(charts).toContain("forexconnect-bid");
  });
});
