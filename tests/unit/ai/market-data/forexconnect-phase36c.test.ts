/**
 * Phase 36C — ForexConnect market data end-to-end wiring (mocked; not live SDK proof).
 * Covers profile-session historical access, symbol identity, UI provider labels, and no fabrication.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createForexConnectBridge } from "../../../../ai/market-data/forexconnect/client.ts";
import { ForexConnectMarketDataError } from "../../../../ai/market-data/forexconnect/errors.ts";
import {
  normalizeForexConnectHistoryRows,
} from "../../../../ai/market-data/forexconnect/historical-normalize.ts";
import {
  applyFcBidPriceToCandles,
  FOREXCONNECT_STALE_MS,
  normalizeFcOfferQuote,
} from "../../../../ai/market-data/forexconnect/live-candle-sync.ts";
import { createMarketDataService } from "../../../../ai/market-data/providers/market-data-service.ts";
import { createMarketDataProviderRegistry } from "../../../../ai/market-data/providers/registry.ts";
import { parseSelectedMarket } from "../../../../desktop/forex/market-data/selected-market.ts";
import { identityFromSelectedMarket } from "../../../../desktop/forex/market-data/cross-module-consistency.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

/** Enabled sidecar, no env username/password — Admin profile session path. */
const PROFILE_SESSION_ENV = {
  KWIZERA_FOREXCONNECT_ENABLED: "1",
  KWIZERA_FOREXCONNECT_ENVIRONMENT: "demo",
};

function connectedStatus(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    provider: "FOREXCONNECT",
    status: "CONNECTED",
    enabled: true,
    configured: true,
    environment: "demo",
    environmentLabel: "DEMO",
    usernameConfigured: false,
    passwordConfigured: false,
    trading: "DISABLED",
    historicalCapable: true,
    priceBasis: "bid",
    instrumentCount: 516,
    ...overrides,
  };
}

describe("Phase 36C profile-session historical candles", () => {
  it("allows getHistoricalCandles when sidecar is CONNECTED without env credentials", async () => {
    const calls: string[] = [];
    const bridge = createForexConnectBridge({
      env: PROFILE_SESSION_ENV,
      fetchImpl: async (input) => {
        const url = String(input);
        calls.push(url);
        if (url.includes("/status")) {
          return {
            ok: true,
            status: 200,
            json: async () => connectedStatus(),
          } as Response;
        }
        if (url.includes("/candles")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              ok: true,
              provider: "FOREXCONNECT",
              providerSymbol: "AUD/CNH",
              canonicalSymbol: "AUDCNH",
              displaySymbol: "AUD/CNH",
              periodId: "H1",
              environment: "demo",
              candles: [
                {
                  Date: "2026-10-10T12:00:00Z",
                  BidOpen: 4.7,
                  BidHigh: 4.72,
                  BidLow: 4.69,
                  BidClose: 4.71,
                  Volume: 10,
                },
                {
                  Date: "2026-10-10T13:00:00Z",
                  BidOpen: 4.71,
                  BidHigh: 4.73,
                  BidLow: 4.70,
                  BidClose: 4.72,
                  Volume: 12,
                },
              ],
              fetchedAt: "2026-10-10T14:00:00.000Z",
            }),
          } as Response;
        }
        throw new Error(`unexpected fetch ${url}`);
      },
    });

    const result = await bridge.getHistoricalCandles({
      symbol: "AUD/CNH",
      timeframe: "1h",
      limit: 20,
    });
    expect(result.ok).toBe(true);
    expect(result.provider).toBe("FOREXCONNECT");
    expect(result.environment).toBe("demo");
    expect(result.environmentLabel).toBe("DEMO");
    expect(result.priceBasis).toBe("bid");
    expect(result.count).toBe(2);
    expect(result.candles[0]!.time).toBeLessThan(result.candles[1]!.time);
    expect(result.lastHistoricalAt).toBeTruthy();
    expect(calls.some((u) => u.includes("/candles"))).toBe(true);
  });

  it("surfaces empty history truthfully without fabricating candles", async () => {
    const bridge = createForexConnectBridge({
      env: PROFILE_SESSION_ENV,
      fetchImpl: async (input) => {
        const url = String(input);
        if (url.includes("/status")) {
          return {
            ok: true,
            status: 200,
            json: async () => connectedStatus(),
          } as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            providerSymbol: "EUR/USD",
            candles: [],
            fetchedAt: "2026-10-10T14:00:00.000Z",
          }),
        } as Response;
      },
    });
    const result = await bridge.getHistoricalCandles({
      symbol: "EUR/USD",
      timeframe: "1h",
      limit: 20,
    });
    expect(result.ok).toBe(true);
    expect(result.count).toBe(0);
    expect(result.candles).toEqual([]);
  });

  it("rejects historical when session is not CONNECTED", async () => {
    const bridge = createForexConnectBridge({
      env: PROFILE_SESSION_ENV,
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          ...connectedStatus(),
          status: "DISCONNECTED",
          errorCode: "FOREXCONNECT_DISCONNECTED",
          errorMessage: "Not connected.",
        }),
      }) as Response,
    });
    await expect(
      bridge.getHistoricalCandles({ symbol: "EUR/USD", timeframe: "1h" }),
    ).rejects.toBeInstanceOf(ForexConnectMarketDataError);
  });

  it("preserves FOREXCONNECT provider identity through unified MarketDataService", async () => {
    const registry = createMarketDataProviderRegistry({
      env: {
        ...PROFILE_SESSION_ENV,
        KWIZERA_FOREXCONNECT_SIDECAR_URL: "http://127.0.0.1:5179",
      },
      fetchImpl: async (input) => {
        const url = String(input);
        if (url.includes("/status")) {
          return {
            ok: true,
            status: 200,
            json: async () => connectedStatus(),
          } as Response;
        }
        if (url.includes("/candles")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              ok: true,
              provider: "FOREXCONNECT",
              providerSymbol: "AUD/CNH",
              canonicalSymbol: "AUDCNH",
              displaySymbol: "AUD/CNH",
              periodId: "H1",
              environment: "demo",
              candles: [
                {
                  Date: "2026-10-10T12:00:00Z",
                  BidOpen: 4.7,
                  BidHigh: 4.72,
                  BidLow: 4.69,
                  BidClose: 4.71,
                  Volume: 10,
                },
              ],
              fetchedAt: "2026-10-10T14:00:00.000Z",
            }),
          } as Response;
        }
        throw new Error(`unexpected fetch ${url}`);
      },
    });
    const service = createMarketDataService({ registry });
    const series = await service.getHistoricalCandles({
      provider: "FOREXCONNECT",
      symbol: "AUD/CNH",
      timeframe: "1h",
      marketType: "FOREX",
      limit: 10,
    });
    expect(series.source).toBe("FOREXCONNECT");
    expect(series.identity.provider).toBe("FOREXCONNECT");
    expect(String(series.identity.environment ?? "")).toMatch(/demo/i);
    expect(series.candles.length).toBe(1);
    expect(series.candles[0]!.close).toBe(4.71);
  });
});

describe("Phase 36C symbol mapping and missing instruments", () => {
  it("parses Charts URL provider=FOREXCONNECT without collapsing to FXCM or unsupported", () => {
    const selected = parseSelectedMarket("AUD/CNH", "FOREXCONNECT");
    expect(selected).not.toBeNull();
    expect(selected!.venue).toBe("forexconnect");
    expect(selected!.provider).toBe("FOREXCONNECT");
    expect(selected!.symbol).toBe("AUD/CNH");
    const identity = identityFromSelectedMarket(selected!, "1h");
    expect(identity.provider).toBe("FOREXCONNECT");
    expect(identity.marketType).toBe("FOREX");
  });

  it("does not invent candles for empty or invalid history rows", () => {
    const empty = normalizeForexConnectHistoryRows([], "1h");
    expect(empty.candles).toEqual([]);
    expect(empty.invalidCandles).toBe(0);
    const bad = normalizeForexConnectHistoryRows([
      { Date: "bad", BidOpen: 1, BidHigh: 0.5, BidLow: 0.4, BidClose: 0.9 },
    ], "1h");
    expect(bad.candles).toEqual([]);
    expect(bad.invalidCandles).toBeGreaterThan(0);
  });
});

describe("Phase 36C Offers freshness and no fabricated ticks", () => {
  it("increments forming candles only from real bid quote events", () => {
    const q = normalizeFcOfferQuote({
      providerSymbol: "AUD/CNH",
      bid: 4.71,
      ask: 4.712,
    });
    expect(q).not.toBeNull();
    const t0 = Date.parse("2026-10-10T12:00:00Z");
    const identity = {
      marketType: "FOREX" as const,
      providerSymbol: "AUD/CNH",
      canonicalSymbol: "AUDCNH",
      timeframe: "1h" as const,
    };
    const applied = applyFcBidPriceToCandles([], q!.candlePrice, t0, identity, t0);
    expect(applied.applied).toBe(true);
    expect(applied.candles).toHaveLength(1);
    expect(FOREXCONNECT_STALE_MS).toBeGreaterThan(0);
  });

  it("client source no longer gates candles on env username/password alone", () => {
    const client = read("ai/market-data/forexconnect/client.ts");
    expect(client).toContain("Trust sidecar CONNECTED");
    expect(client).not.toMatch(
      /getHistoricalCandles[\s\S]{0,800}FOREXCONNECT_NOT_CONFIGURED[\s\S]{0,200}usernameConfigured/,
    );
  });
});

describe("Phase 36C DEMO session restore after restart", () => {
  it("exposes maybeRestoreDemoSession and never auto-activates LIVE", () => {
    const session = read("ai/market-data/forexconnect/session.ts");
    expect(session).toContain("maybeRestoreDemoSession");
    expect(session).toContain('service.activate("demo"');
    expect(session).toContain("never auto-login LIVE");
    expect(session).not.toMatch(/activate\(\s*["']live["']/);
  });
});

describe("Phase 36C Charts / Admin UI provider identity", () => {
  it("SelectedMarketBar and Chart workspace label ForexConnect as connected venue", () => {
    const bar = read("desktop/forex/SelectedMarketBar.tsx");
    expect(bar).toContain('selected.venue === "forexconnect"');
    expect(bar).toContain("ForexConnect");
    expect(bar).not.toMatch(/forexconnect[\s\S]{0,80}not connected/);

    const chart = read("desktop/forex/chart/ForexChartWorkspace.tsx");
    expect(chart).toContain("forexConnectSelected");
    expect(chart).toContain("Price basis: bid");
    expect(chart).toContain("Authenticated · waiting for fresh quotes");

    const admin = read("desktop/forex-admin/ForexAdminForexConnectPage.tsx");
    expect(admin).toContain("data-fc-next-action");
    expect(admin).toContain("Offers updates:");
    expect(admin).toContain("AUTHENTICATED_IDLE");
  });

  it("Binance Spot path remains distinct (no FOREXCONNECT fallback)", () => {
    const service = read("ai/market-data/providers/market-data-service.ts");
    expect(service).toContain("never fall back to Binance or FXCM Socket REST");
    expect(service).toContain('providerId === "BINANCE"');
    const markets = read("desktop/forex/ForexMarketsPage.tsx");
    expect(markets).toContain('provider: "BINANCE"');
    expect(markets).toContain('provider: "FOREXCONNECT"');
  });
});
