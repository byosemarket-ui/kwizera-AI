/**
 * Phase 56.2.8 — market-agnostic per-instrument readiness (synthetic fixtures).
 */
import { describe, expect, it } from "vitest";
import {
  evaluateInstrumentReadiness,
  resolveInstrumentFreshnessPolicy,
  summarizeInstrumentReadinessCatalog,
} from "../../../../ai/market-data/instrument-readiness/index.ts";
import { resolveForexConnectLiveTimeframe } from "../../../../ai/market-data/forexconnect/timeframes.ts";
import type { MarketInstrument } from "../../../../ai/market-data/providers/types.ts";

function syntheticInstrument(
  symbol: string,
  marketType: MarketInstrument["marketType"] = "FOREX",
): MarketInstrument {
  return {
    provider: "FOREXCONNECT",
    providerSymbol: symbol,
    canonicalSymbol: symbol.replace("/", ""),
    displaySymbol: symbol,
    marketType,
    baseAsset: symbol.split("/")[0] ?? null,
    quoteAsset: symbol.split("/")[1] ?? null,
    status: "available",
    capabilities: {
      instruments: true,
      liveQuotes: true,
      streamingQuotes: true,
      historicalPrices: true,
      candles: true,
      liveCandles: true,
      trading: false,
    },
    metadata: { synthetic: true },
  };
}

describe("Phase 56.2.8 instrument readiness (synthetic)", () => {
  it("normalizes ForexConnect timeframe aliases m1 → 1m", () => {
    expect(resolveForexConnectLiveTimeframe("m1")).toBe("1m");
    expect(resolveForexConnectLiveTimeframe("m5")).toBe("5m");
    expect(resolveForexConnectLiveTimeframe("5m")).toBe("5m");
    expect(resolveForexConnectLiveTimeframe("H1")).toBe("1h");
    expect(resolveForexConnectLiveTimeframe("", "15m")).toBe("15m");
    expect(resolveForexConnectLiveTimeframe("nope")).toBe("1m");
  });

  it("documents freshness policy source (15s default)", () => {
    const policy = resolveInstrumentFreshnessPolicy({
      provider: "FOREXCONNECT",
      marketType: "FOREX",
    });
    expect(policy.quoteStaleMs).toBe(15_000);
    expect(policy.source).toContain("FOREXCONNECT");
    expect(policy.rationale.length).toBeGreaterThan(20);
  });

  it("marks LIVE quote READY without authorizing execution", () => {
    const snap = evaluateInstrumentReadiness({
      provider: "FOREXCONNECT",
      instrument: syntheticInstrument("EUR/USD"),
      providerSymbol: "EUR/USD",
      live: {
        bid: 1.1,
        ask: 1.1002,
        streamState: "LIVE",
        priceChangeAgeMs: 500,
        receiptAgeMs: 400,
        updateCount: 3,
      },
      historicalCapability: true,
      nowMs: 1_700_000_000_000,
    });
    expect(snap.capabilities.liveFeedReady).toBe(true);
    expect(snap.capabilities.simulationReady).toBe(true);
    expect(snap.capabilities.executionAuthorized).toBe(false);
    expect(snap.placesOrders).toBe(false);
    expect(snap.acceptsForExecution).toBe(false);
    expect(snap.overall).toBe("READY");
  });

  it("keeps seeded/historical bid-ask from looking LIVE", () => {
    const snap = evaluateInstrumentReadiness({
      provider: "FOREXCONNECT",
      instrument: syntheticInstrument("XAU/USD", "COMMODITY"),
      providerSymbol: "XAU/USD",
      live: {
        bid: 4000,
        ask: 4000.5,
        streamState: "SUBSCRIBED_WAITING",
        priceChangeAgeMs: null,
        receiptAgeMs: null,
        updateCount: 0,
        historicalOnly: true,
      },
      historicalCapability: true,
    });
    expect(snap.capabilities.liveFeedReady).toBe(false);
    expect(snap.quote?.historicalOnly).toBe(true);
    expect(snap.blockers.some((b) => b.id === "quote_not_live" || b.id === "historical_without_live")).toBe(true);
  });

  it("evaluates instruments independently — LIVE peer does not rescue STALE peer", () => {
    const eur = evaluateInstrumentReadiness({
      provider: "FOREXCONNECT",
      instrument: syntheticInstrument("EUR/USD"),
      providerSymbol: "EUR/USD",
      live: {
        bid: 1.1,
        ask: 1.1001,
        streamState: "LIVE",
        priceChangeAgeMs: 200,
        receiptAgeMs: 100,
        updateCount: 5,
      },
    });
    const xau = evaluateInstrumentReadiness({
      provider: "FOREXCONNECT",
      instrument: syntheticInstrument("XAU/USD", "COMMODITY"),
      providerSymbol: "XAU/USD",
      live: {
        bid: 4100,
        ask: 4100.4,
        streamState: "STALE",
        priceChangeAgeMs: 60_000,
        receiptAgeMs: 60_000,
        updateCount: 2,
      },
    });
    expect(eur.capabilities.liveFeedReady).toBe(true);
    expect(xau.capabilities.liveFeedReady).toBe(false);
    expect(xau.overall).toBe("STALE");

    const catalog = summarizeInstrumentReadinessCatalog({
      provider: "FOREXCONNECT",
      snapshots: [eur, xau],
    });
    expect(catalog.liveFeedReadyCount).toBe(1);
    expect(catalog.blockedOrUnreadyCount).toBe(1);
    expect(catalog.placesOrders).toBe(false);
  });

  it("reports UNAVAILABLE when instrument is not in the catalog", () => {
    const snap = evaluateInstrumentReadiness({
      provider: "BINANCE",
      instrument: null,
      providerSymbol: "FAKE/PAIR",
      live: null,
    });
    expect(snap.overall).toBe("UNAVAILABLE");
    expect(snap.capabilities.discovered).toBe(false);
    expect(snap.capabilities.executionAuthorized).toBe(false);
  });

  it("maps NO_RECENT_MARKET_UPDATES to PARTIALLY_READY (not READY)", () => {
    const snap = evaluateInstrumentReadiness({
      provider: "FOREXCONNECT",
      instrument: syntheticInstrument("GBP/USD"),
      providerSymbol: "GBP/USD",
      live: {
        bid: 1.25,
        ask: 1.2502,
        streamState: "NO_RECENT_MARKET_UPDATES",
        priceChangeAgeMs: 20_000,
        receiptAgeMs: 500,
        updateCount: 4,
      },
    });
    expect(snap.capabilities.liveFeedReady).toBe(false);
    expect(snap.quote?.freshnessStatus).toBe("PARTIALLY_READY");
  });
});
