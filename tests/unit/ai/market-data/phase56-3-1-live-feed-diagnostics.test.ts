/**
 * Phase 56.3.1 — live market-data diagnostics (synthetic fixtures).
 * Never presents these as production Offers evidence.
 */
import { describe, expect, it } from "vitest";
import {
  buildLiveFeedDiagnostics,
  classifyLiveFeedBlocker,
  evaluateInstrumentReadiness,
} from "../../../../ai/market-data/instrument-readiness/index.ts";
import { evaluateVerificationQuoteFreshness } from "../../../../ai/forex-ai/automated-trading/quote-freshness.ts";
import { resolveFcFeedStreamState } from "../../../../ai/market-data/forexconnect/stream-state.ts";
import { isGenuineFcOfferEventSource } from "../../../../ai/market-data/forexconnect/live-candle-sync.ts";
import type { MarketInstrument } from "../../../../ai/market-data/providers/types.ts";
import type { AutomatedTradingVerificationResult } from "../../../../ai/forex-ai/automated-trading/verification-types.ts";

function syntheticInstrument(symbol: string): MarketInstrument {
  return {
    provider: "FOREXCONNECT",
    providerSymbol: symbol,
    canonicalSymbol: symbol.replace("/", ""),
    displaySymbol: symbol,
    marketType: "FOREX",
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

function baseVerification(
  overrides: Partial<AutomatedTradingVerificationResult> & {
    market?: Partial<AutomatedTradingVerificationResult["market"]>;
  } = {},
): AutomatedTradingVerificationResult {
  const { market: marketOver, ...rest } = overrides;
  return {
    verifiedAtUtc: "2026-10-21T12:00:00.000Z",
    instrument: { symbol: "XAU/USD", verified: true },
    readiness: {
      environmentVerified: true,
      accountIdentityVerified: true,
      accountMetadataSufficient: true,
      instrumentMetadataVerified: true,
      marketDataHealthVerified: false,
      readyForFutureAnalysis: false,
      readyForTrading: false,
    },
    market: {
      bid: 4100,
      ask: 4100.5,
      feedStatus: "SUBSCRIBED_WAITING",
      updateCount: 0,
      priceChangeAgeMs: null,
      receiptAgeMs: null,
      ...marketOver,
    },
    placesOrders: false,
    acceptsForExecution: false,
    ...rest,
  } as AutomatedTradingVerificationResult;
}

describe("Phase 56.3.1 live feed diagnostics (synthetic)", () => {
  it("classifies no_active_session when catalog-only", () => {
    const c = classifyLiveFeedBlocker({
      sessionActive: false,
      feedStatus: null,
      hasBidAsk: false,
      updateCount: 0,
      historicalOnly: false,
    });
    expect(c.blockerId).toBe("no_active_session");
  });

  it("classifies seeded snapshot vs heartbeat vs stale independently", () => {
    expect(classifyLiveFeedBlocker({
      sessionActive: true,
      feedStatus: "MARKET_INACTIVE",
      hasBidAsk: true,
      updateCount: 0,
      historicalOnly: true,
      eventSource: null,
    }).blockerId).toBe("seeded_snapshot_no_genuine_event");

    expect(classifyLiveFeedBlocker({
      sessionActive: true,
      feedStatus: "NO_RECENT_MARKET_UPDATES",
      hasBidAsk: true,
      updateCount: 2,
      historicalOnly: false,
      eventSource: "offers-callback",
      priceChangeAgeMs: 20_000,
      receiptAgeMs: 200,
    }).blockerId).toBe("heartbeat_only_no_price_change");

    expect(classifyLiveFeedBlocker({
      sessionActive: true,
      feedStatus: "STALE",
      hasBidAsk: true,
      updateCount: 5,
      historicalOnly: false,
      eventSource: "offers-table-diff",
      priceChangeAgeMs: 30_000,
      receiptAgeMs: 30_000,
    }).blockerId).toBe("quote_stale");
  });

  it("keeps XAU and EUR readiness independent (synthetic)", () => {
    const eur = evaluateInstrumentReadiness({
      provider: "FOREXCONNECT",
      instrument: syntheticInstrument("EUR/USD"),
      providerSymbol: "EUR/USD",
      subscriptionRequested: true,
      live: {
        bid: 1.1,
        ask: 1.1002,
        streamState: "LIVE",
        priceChangeAgeMs: 400,
        receiptAgeMs: 300,
        updateCount: 4,
        eventSource: "offers-callback",
        lastPriceChangeAtMs: 1_700_000_000_000,
        lastReceiptAtMs: 1_700_000_000_100,
      },
      nowMs: 1_700_000_000_500,
    });
    const xau = evaluateInstrumentReadiness({
      provider: "FOREXCONNECT",
      instrument: syntheticInstrument("XAU/USD"),
      providerSymbol: "XAU/USD",
      subscriptionRequested: true,
      live: {
        bid: 4100,
        ask: 4100.4,
        streamState: "SUBSCRIBED_WAITING",
        priceChangeAgeMs: null,
        receiptAgeMs: null,
        updateCount: 0,
        historicalOnly: true,
        eventSource: null,
      },
      nowMs: 1_700_000_000_500,
    });
    expect(eur.capabilities.liveFeedReady).toBe(true);
    expect(xau.capabilities.liveFeedReady).toBe(false);
    expect(xau.feedDiagnostics?.blockerId).toBe("seeded_snapshot_no_genuine_event");
    expect(eur.placesOrders).toBe(false);
    expect(xau.acceptsForExecution).toBe(false);
  });

  it("exposes diagnostics when no live session exists", () => {
    const snap = evaluateInstrumentReadiness({
      provider: "FOREXCONNECT",
      instrument: syntheticInstrument("EUR/USD"),
      providerSymbol: "EUR/USD",
      subscriptionRequested: false,
      live: null,
    });
    expect(snap.capabilities.liveFeedReady).toBe(false);
    expect(snap.feedDiagnostics?.sessionActive).toBe(false);
    expect(snap.feedDiagnostics?.blockerId).toBe("no_active_session");
    expect(snap.blockers.some((b) => b.id === "no_active_session")).toBe(true);
  });

  it("LIVE requires genuine event sources only", () => {
    expect(isGenuineFcOfferEventSource("offers-callback")).toBe(true);
    expect(isGenuineFcOfferEventSource("offers-table-diff")).toBe(true);
    expect(isGenuineFcOfferEventSource(null)).toBe(false);
    expect(isGenuineFcOfferEventSource("seed")).toBe(false);
  });

  it("stream-state LIVE only when priceChangeAge within stale window", () => {
    expect(resolveFcFeedStreamState({
      priceChangeAgeMs: 500,
      receiptAgeMs: 400,
      updateCount: 2,
      staleMs: 15_000,
    })).toBe("LIVE");
    expect(resolveFcFeedStreamState({
      priceChangeAgeMs: 20_000,
      receiptAgeMs: 200,
      updateCount: 2,
      staleMs: 15_000,
    })).toBe("NO_RECENT_MARKET_UPDATES");
    expect(resolveFcFeedStreamState({
      priceChangeAgeMs: null,
      receiptAgeMs: null,
      updateCount: 0,
      staleMs: 15_000,
    })).not.toBe("LIVE");
  });

  it("AT FEED_NOT_LIVE when feedStatus is not LIVE; remaps STALE/heartbeat/waiting", () => {
    const notLive = evaluateVerificationQuoteFreshness(baseVerification({
      market: { feedStatus: "MARKET_INACTIVE", updateCount: 0 },
    }), { nowMs: Date.parse("2026-10-21T12:00:01.000Z") });
    expect(notLive.fresh).toBe(false);
    expect(notLive.reasonCode).toBe("FEED_NOT_LIVE");

    const stale = evaluateVerificationQuoteFreshness(baseVerification({
      market: {
        feedStatus: "STALE",
        updateCount: 3,
        priceChangeAgeMs: 20_000,
        receiptAgeMs: 20_000,
      },
    }), { nowMs: Date.parse("2026-10-21T12:00:01.000Z") });
    expect(stale.reasonCode).toBe("QUOTE_AGE_EXCEEDED");

    const heartbeat = evaluateVerificationQuoteFreshness(baseVerification({
      market: {
        feedStatus: "NO_RECENT_MARKET_UPDATES",
        updateCount: 3,
        priceChangeAgeMs: 20_000,
        receiptAgeMs: 200,
      },
    }), { nowMs: Date.parse("2026-10-21T12:00:01.000Z") });
    expect(heartbeat.reasonCode).toBe("HEARTBEAT_ONLY_NO_PRICE_CHANGE");

    const waiting = evaluateVerificationQuoteFreshness(baseVerification({
      market: { feedStatus: "SUBSCRIBING", updateCount: 0 },
    }), { nowMs: Date.parse("2026-10-21T12:00:01.000Z") });
    expect(waiting.reasonCode).toBe("NO_QUOTE_UPDATES");
  });

  it("buildLiveFeedDiagnostics never authorizes execution fields", () => {
    const d = buildLiveFeedDiagnostics({
      sessionActive: true,
      subscriptionRequested: true,
      feedStatus: "LIVE",
      hasBidAsk: true,
      updateCount: 2,
      historicalOnly: false,
      eventSource: "offers-callback",
      priceChangeAgeMs: 100,
      receiptAgeMs: 80,
      lastPriceChangeAtMs: 1_700_000_000_000,
      lastReceiptAtMs: 1_700_000_000_020,
    });
    expect(d.blockerId).toBeNull();
    expect(d.sessionActive).toBe(true);
    expect(d.lastPriceChangeAtUtc).toBe("2023-11-14T22:13:20.000Z");
  });

  it("safety: readiness snapshot keeps placesOrders/acceptsForExecution false", () => {
    const snap = evaluateInstrumentReadiness({
      provider: "FOREXCONNECT",
      instrument: syntheticInstrument("XAU/USD"),
      providerSymbol: "XAU/USD",
      live: {
        bid: 4100,
        ask: 4100.2,
        streamState: "LIVE",
        priceChangeAgeMs: 100,
        receiptAgeMs: 90,
        updateCount: 9,
        eventSource: "offers-table-diff",
      },
    });
    expect(snap.capabilities.liveFeedReady).toBe(true);
    expect(snap.placesOrders).toBe(false);
    expect(snap.acceptsForExecution).toBe(false);
    expect(snap.capabilities.executionAuthorized).toBe(false);
  });
});
