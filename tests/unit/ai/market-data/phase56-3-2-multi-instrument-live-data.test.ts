/**
 * Phase 56.3.2 — multi-instrument live data isolation (synthetic fixtures).
 * Not production Offers evidence.
 */
import { describe, expect, it } from "vitest";
import {
  evaluateInstrumentReadiness,
  summarizeInstrumentReadinessCatalog,
  classifyLiveFeedBlocker,
} from "../../../../ai/market-data/instrument-readiness/index.ts";
import {
  normalizeCanonicalSymbol,
  marketIdentityKey,
  marketDataCacheKey,
  candleIdentityKey,
} from "../../../../ai/market-data/providers/identity.ts";
import { normalizeFcOfferQuote, isGenuineFcOfferEventSource } from "../../../../ai/market-data/forexconnect/live-candle-sync.ts";
import { resolveFcFeedStreamState } from "../../../../ai/market-data/forexconnect/stream-state.ts";
import { resolveForexConnectLiveTimeframe } from "../../../../ai/market-data/forexconnect/timeframes.ts";
import {
  AT_INSTRUMENT_ALLOWLIST,
  isInstrumentAllowlisted,
} from "../../../../ai/forex-ai/automated-trading/simulation-risk/allowlist.ts";
import type { MarketInstrument } from "../../../../ai/market-data/providers/types.ts";

function synth(
  symbol: string,
  marketType: MarketInstrument["marketType"] = "FOREX",
): MarketInstrument {
  return {
    provider: "FOREXCONNECT",
    providerSymbol: symbol,
    canonicalSymbol: normalizeCanonicalSymbol(symbol),
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

function liveQuote(partial: {
  bid: number;
  ask: number;
  updateCount?: number;
  priceChangeAgeMs?: number | null;
  receiptAgeMs?: number | null;
  streamState?: string;
  eventSource?: string | null;
  historicalOnly?: boolean;
}) {
  return {
    bid: partial.bid,
    ask: partial.ask,
    streamState: partial.streamState ?? "LIVE",
    priceChangeAgeMs: partial.priceChangeAgeMs ?? 400,
    receiptAgeMs: partial.receiptAgeMs ?? 300,
    updateCount: partial.updateCount ?? 3,
    eventSource: partial.eventSource === undefined ? "offers-callback" : partial.eventSource,
    historicalOnly: partial.historicalOnly ?? false,
    lastPriceChangeAtMs: 1_700_000_000_000,
    lastReceiptAtMs: 1_700_000_000_100,
  };
}

describe("Phase 56.3.2 multi-instrument live data (synthetic)", () => {
  it("normalizes aliases and keeps provider-aware identity keys isolated", () => {
    expect(normalizeCanonicalSymbol("XAU/USD")).toBe("XAUUSD");
    expect(normalizeCanonicalSymbol("eur-usd")).toBe("EURUSD");
    expect(normalizeCanonicalSymbol("XAG USD")).toBe("XAGUSD");
    const xau = marketIdentityKey({
      provider: "FOREXCONNECT",
      marketType: "COMMODITY",
      canonicalSymbol: "XAU/USD",
    });
    const eur = marketIdentityKey({
      provider: "FOREXCONNECT",
      marketType: "FOREX",
      canonicalSymbol: "EUR/USD",
    });
    expect(xau).not.toBe(eur);
    expect(marketDataCacheKey({
      provider: "FOREXCONNECT",
      marketType: "FOREX",
      symbol: "EUR/USD",
      timeframe: "1m",
      kind: "live-candles",
    })).toContain("FOREXCONNECT:FOREX:EURUSD:1m");
    expect(candleIdentityKey({
      provider: "FOREXCONNECT",
      marketType: "FOREX",
      symbol: "EUR/USD",
      timeframe: "15m",
      time: 1_700_000_000,
    })).toMatch(/:15m:1700000000$/);
  });

  it("XAU and EUR independently reach LIVE when each has genuine fresh updates", () => {
    const xau = evaluateInstrumentReadiness({
      provider: "FOREXCONNECT",
      instrument: synth("XAU/USD", "COMMODITY"),
      providerSymbol: "XAU/USD",
      subscriptionRequested: true,
      live: liveQuote({ bid: 4100, ask: 4100.3 }),
      nowMs: 1_700_000_000_500,
    });
    const eur = evaluateInstrumentReadiness({
      provider: "FOREXCONNECT",
      instrument: synth("EUR/USD"),
      providerSymbol: "EUR/USD",
      subscriptionRequested: true,
      live: liveQuote({ bid: 1.1, ask: 1.1002, eventSource: "offers-table-diff" }),
      nowMs: 1_700_000_000_500,
    });
    expect(xau.capabilities.liveFeedReady).toBe(true);
    expect(eur.capabilities.liveFeedReady).toBe(true);
    expect(xau.placesOrders).toBe(false);
    expect(eur.acceptsForExecution).toBe(false);
  });

  it("one LIVE instrument never marks a blocked peer LIVE", () => {
    const xauLive = evaluateInstrumentReadiness({
      provider: "FOREXCONNECT",
      instrument: synth("XAU/USD", "COMMODITY"),
      providerSymbol: "XAU/USD",
      live: liveQuote({ bid: 4100, ask: 4100.2 }),
    });
    const eurBlocked = evaluateInstrumentReadiness({
      provider: "FOREXCONNECT",
      instrument: synth("EUR/USD"),
      providerSymbol: "EUR/USD",
      live: {
        bid: 1.1,
        ask: 1.1001,
        streamState: "MARKET_INACTIVE",
        priceChangeAgeMs: null,
        receiptAgeMs: 200,
        updateCount: 0,
        historicalOnly: true,
        eventSource: null,
      },
    });
    const summary = summarizeInstrumentReadinessCatalog({
      provider: "FOREXCONNECT",
      snapshots: [xauLive, eurBlocked],
    });
    expect(summary.liveFeedReadyCount).toBe(1);
    expect(summary.liveReadySymbols).toEqual(["XAU/USD"]);
    expect(summary.blockedSymbols).toEqual([
      { symbol: "EUR/USD", blockerId: "seeded_snapshot_no_genuine_event" },
    ]);
    expect(summary.placesOrders).toBe(false);
    expect(summary.acceptsForExecution).toBe(false);
    expect(summary.notes.some((n) => /never marks peers READY/i.test(n))).toBe(true);
  });

  it("unknown / undiscovered instruments fail closed", () => {
    const snap = evaluateInstrumentReadiness({
      provider: "FOREXCONNECT",
      instrument: null,
      providerSymbol: "FAKE/XYZ",
      live: null,
    });
    expect(snap.capabilities.discovered).toBe(false);
    expect(snap.capabilities.liveFeedReady).toBe(false);
    expect(snap.overall).toBe("UNAVAILABLE");
    expect(classifyLiveFeedBlocker({
      sessionActive: false,
      feedStatus: null,
      hasBidAsk: false,
      updateCount: 0,
      historicalOnly: false,
    }).blockerId).toBe("no_active_session");
  });

  it("rejects missing/invalid bid-ask and stale/heartbeat feeds", () => {
    expect(evaluateInstrumentReadiness({
      provider: "FOREXCONNECT",
      instrument: synth("GBP/USD"),
      providerSymbol: "GBP/USD",
      live: { bid: null, ask: 1.2, streamState: "LIVE", updateCount: 2, priceChangeAgeMs: 100, receiptAgeMs: 50 },
    }).feedDiagnostics?.blockerId).toBe("quote_missing");

    expect(evaluateInstrumentReadiness({
      provider: "FOREXCONNECT",
      instrument: synth("GBP/USD"),
      providerSymbol: "GBP/USD",
      live: liveQuote({
        bid: 1.25,
        ask: 1.2502,
        streamState: "STALE",
        priceChangeAgeMs: 30_000,
        receiptAgeMs: 30_000,
        updateCount: 4,
      }),
    }).capabilities.liveFeedReady).toBe(false);

    expect(resolveFcFeedStreamState({
      priceChangeAgeMs: 20_000,
      receiptAgeMs: 100,
      updateCount: 5,
    })).toBe("NO_RECENT_MARKET_UPDATES");
  });

  it("normalizes timestamp units (seconds vs ms) without inventing LIVE", () => {
    const sec = normalizeFcOfferQuote({
      providerSymbol: "EUR/USD",
      bid: 1.1,
      ask: 1.1002,
      sourceTimestampMs: 1_700_000_000,
      receivedAtMs: 1_700_000_001,
      eventSource: "offers-callback",
    }, 1_700_000_001_000);
    expect(sec?.sourceTimestampMs).toBe(1_700_000_000_000);
    expect(sec?.receivedAtMs).toBe(1_700_000_001_000);

    const ms = normalizeFcOfferQuote({
      providerSymbol: "XAU/USD",
      bid: 4000,
      ask: 4000.5,
      sourceTimestampMs: 1_700_000_000_500,
      receivedAt: 1_700_000_000_600,
      eventSource: "offers-table-diff",
    });
    expect(ms?.sourceTimestampMs).toBe(1_700_000_000_500);
    expect(isGenuineFcOfferEventSource(ms?.eventSource)).toBe(true);
    expect(isGenuineFcOfferEventSource(null)).toBe(false);
  });

  it("duplicate same-price receipts do not create LIVE without price change age", () => {
    expect(resolveFcFeedStreamState({
      priceChangeAgeMs: null,
      receiptAgeMs: 200,
      updateCount: 0,
    })).not.toBe("LIVE");
    expect(resolveFcFeedStreamState({
      priceChangeAgeMs: 500,
      receiptAgeMs: 200,
      updateCount: 2,
    })).toBe("LIVE");
  });

  it("timeframe aliases stay project-id based for live sessions", () => {
    expect(resolveForexConnectLiveTimeframe("m1")).toBe("1m");
    expect(resolveForexConnectLiveTimeframe("H1")).toBe("1h");
    expect(resolveForexConnectLiveTimeframe("15m")).toBe("15m");
  });

  it("readiness stays blocked until genuine updates exist", () => {
    const waiting = evaluateInstrumentReadiness({
      provider: "FOREXCONNECT",
      instrument: synth("US30", "INDEX"),
      providerSymbol: "US30",
      subscriptionRequested: true,
      live: {
        bid: 42000,
        ask: 42001,
        streamState: "SUBSCRIBED_WAITING",
        updateCount: 0,
        priceChangeAgeMs: null,
        receiptAgeMs: null,
        historicalOnly: true,
        eventSource: null,
      },
    });
    expect(waiting.capabilities.liveFeedReady).toBe(false);
    expect(waiting.feedDiagnostics?.blockerId).toBe("seeded_snapshot_no_genuine_event");
  });

  it("market-data discovery ≠ execution allowlist (XAU-only for AT)", () => {
    expect(isInstrumentAllowlisted("XAU/USD")).toBe(true);
    expect(isInstrumentAllowlisted("EUR/USD")).toBe(false);
    expect(isInstrumentAllowlisted("XAG/USD")).toBe(false);
    expect(isInstrumentAllowlisted("US30")).toBe(false);
    expect(AT_INSTRUMENT_ALLOWLIST).toEqual(["XAU/USD", "XAUUSD"]);
    const eurLive = evaluateInstrumentReadiness({
      provider: "FOREXCONNECT",
      instrument: synth("EUR/USD"),
      providerSymbol: "EUR/USD",
      live: liveQuote({ bid: 1.1, ask: 1.1001 }),
    });
    expect(eurLive.capabilities.liveFeedReady).toBe(true);
    expect(eurLive.capabilities.executionAuthorized).toBe(false);
  });

  it("catalog summary never claims global LIVE when only a subset is ready", () => {
    const snaps = ["XAU/USD", "EUR/USD", "XAG/USD"].map((sym, i) =>
      evaluateInstrumentReadiness({
        provider: "FOREXCONNECT",
        instrument: synth(sym, sym.startsWith("X") ? "COMMODITY" : "FOREX"),
        providerSymbol: sym,
        live: i === 0
          ? liveQuote({ bid: 4100, ask: 4100.2 })
          : {
              bid: 1,
              ask: 1.01,
              streamState: "STALE",
              updateCount: 2,
              priceChangeAgeMs: 40_000,
              receiptAgeMs: 40_000,
              eventSource: "offers-callback",
            },
      }));
    const summary = summarizeInstrumentReadinessCatalog({
      provider: "FOREXCONNECT",
      snapshots: snaps,
    });
    expect(summary.phase).toBe("56.3.2");
    expect(summary.liveReadySymbols).toEqual(["XAU/USD"]);
    expect(summary.liveFeedReadyCount).toBe(1);
    expect(summary.blockedOrUnreadyCount).toBe(2);
    expect(summary.notes.some((n) => /liveReadySymbols/i.test(n))).toBe(true);
  });
});
