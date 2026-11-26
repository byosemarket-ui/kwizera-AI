/**
 * STEP 3C — SSE/REST reconciliation, freshness counts, selection identity,
 * responsive CSS presence, and no screenshot sample data.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { HfmCanonicalQuote } from "../../../ai/market-data/mt5-hfm/quote-types";
import type { HfmQuoteState } from "../../../desktop/forex/hfm-dashboard/types";
import {
  compareQuoteRecency,
  countQuoteAndSubscriptionStatuses,
  hfmSseQuoteToCanonical,
  mergeSseQuotesIntoCanonicalMap,
} from "../../../desktop/forex/hfm-dashboard/market-watch/sse-quote-bridge";
import { mapHfmProviderUiStatus } from "../../../desktop/forex/hfm-dashboard/market-watch/provider-status";

const root = process.cwd();
function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function baseQuote(partial: Partial<HfmCanonicalQuote> & { symbol: string }): HfmCanonicalQuote {
  return {
    provider: "HFM_MT5",
    environment: "demo",
    server: "HFMDemo",
    symbol: partial.symbol,
    bid: 1.1,
    ask: 1.1002,
    last: null,
    spread: 0.0002,
    spreadPoints: 2,
    brokerSpreadPoints: null,
    digits: 5,
    point: 0.00001,
    tickSize: 0.00001,
    tickVolume: 1,
    realVolume: null,
    tickFlags: null,
    quoteTimestamp: 1_700_000_000,
    quoteTimestampMs: 1_700_000_000_000,
    quoteTimestampUtc: null,
    quoteTimestampUtcMs: null,
    brokerUtcOffsetSec: null,
    receivedAtUtc: "2023-11-14T22:13:20.000Z",
    clockSkewSec: null,
    timestampSource: "mt5_tick",
    timestampNormalizationStatus: "UNAVAILABLE",
    timestampNormalizationReason: "TEST_FIXTURE",
    receivedAt: "2023-11-14T22:13:20.000Z",
    sequence: 10,
    status: "LIVE",
    validation: {
      verdict: "ok",
      errors: [],
      warnings: [],
      catalogMatched: true,
      catalogVersion: "t",
    },
    source: "HFM_MT5",
    acquisitionMethod: "SymbolInfoTick",
    previousStatus: null,
    statusReason: null,
    statusChangedAt: null,
    mutatesBroker: false,
    placesOrders: false,
    acceptsForExecution: false,
    ...partial,
  };
}

function sseTick(partial: Partial<HfmQuoteState> & { symbol: string }): HfmQuoteState {
  return {
    symbol: partial.symbol,
    bid: 1.1,
    ask: 1.1002,
    last: null,
    spread: 0.0002,
    digits: 5,
    point: 0.00001,
    tickTime: 1_700_000_000,
    tickVolume: 1,
    sequence: 10,
    receivedAtMs: 1_700_000_000_500,
    freshness: "LIVE",
    status: "LIVE",
    prevMid: null,
    ...partial,
  };
}

describe("STEP 3C quote recency", () => {
  it("prefers higher sequence when both sides expose it", () => {
    expect(
      compareQuoteRecency({ sequence: 12, tickTime: 100 }, { sequence: 11, tickTime: 200 }),
    ).toBeGreaterThan(0);
  });

  it("falls back to broker timestamps when sequence is incomplete", () => {
    expect(
      compareQuoteRecency(
        { sequence: null, tickTime: 200 },
        { sequence: null, tickTime: 100 },
      ),
    ).toBeGreaterThan(0);
  });

  it("does not let a lonely sequence beat a fresher broker timestamp on the other side", () => {
    // One side has sequence only; the other has a newer tick — timestamps decide when
    // both sequences are not available together.
    expect(
      compareQuoteRecency(
        { sequence: 99, tickTime: null, receivedAtMs: 1 },
        { sequence: null, tickTime: 2_000_000_000, receivedAtMs: 2 },
      ),
    ).toBeLessThan(0);
  });
});

describe("STEP 3C SSE/REST merge", () => {
  it("keeps fresher REST when SSE tick is older by sequence", () => {
    const rest = {
      EURUSD: baseQuote({ symbol: "EURUSD", sequence: 20, bid: 1.2, ask: 1.2002 }),
    };
    const sse = {
      EURUSD: sseTick({ symbol: "EURUSD", sequence: 15, bid: 1.1, ask: 1.1002 }),
    };
    const merged = mergeSseQuotesIntoCanonicalMap(rest, sse);
    expect(merged.EURUSD.bid).toBe(1.2);
    expect(merged.EURUSD.sequence).toBe(20);
  });

  it("applies newer SSE over older REST", () => {
    const rest = {
      EURUSD: baseQuote({
        symbol: "EURUSD",
        sequence: 10,
        bid: 1.1,
        ask: 1.1002,
        quoteTimestamp: 1_700_000_000,
      }),
    };
    const sse = {
      EURUSD: sseTick({
        symbol: "EURUSD",
        sequence: 11,
        bid: 1.101,
        ask: 1.1012,
        tickTime: 1_700_000_010,
      }),
    };
    const merged = mergeSseQuotesIntoCanonicalMap(rest, sse);
    expect(merged.EURUSD.bid).toBe(1.101);
    expect(merged.EURUSD.sequence).toBe(11);
  });

  it("maps SSE tick into canonical without inventing zeros", () => {
    const tick = sseTick({ symbol: "XAUUSD", bid: 2650.12, ask: 2650.42, sequence: 3 });
    const canon = hfmSseQuoteToCanonical(tick, null);
    expect(canon?.symbol).toBe("XAUUSD");
    expect(canon?.bid).toBe(2650.12);
    expect(canon?.status).toBe("LIVE");
    expect(canon?.placesOrders).toBe(false);
  });
});

describe("STEP 3C overview counts", () => {
  it("separates LIVE, unquoted catalog rows, and failed subscriptions", () => {
    const counts = countQuoteAndSubscriptionStatuses([
      {
        quote: baseQuote({ symbol: "EURUSD", status: "LIVE" }),
        subscription: { status: "ACTIVE" },
      },
      {
        quote: baseQuote({ symbol: "GBPUSD", status: "STALE" }),
        subscription: { status: "ACTIVE" },
      },
      {
        quote: baseQuote({ symbol: "USDJPY", status: "MARKET_CLOSED" }),
        subscription: { status: "PAUSED" },
      },
      {
        quote: null,
        subscription: null,
      },
      {
        quote: baseQuote({ symbol: "AUDUSD", status: "INVALID" }),
        subscription: { status: "FAILED" },
      },
    ]);
    expect(counts.live).toBe(1);
    expect(counts.stale).toBe(1);
    expect(counts.marketClosed).toBe(1);
    expect(counts.invalid).toBe(1);
    expect(counts.unquoted).toBe(1);
    expect(counts.activeSubscriptions).toBe(2);
    expect(counts.pausedSubscriptions).toBe(1);
    expect(counts.failedSubscriptions).toBe(1);
    expect(counts.subscribedTotal).toBe(4);
  });

  it("does not treat unsubscribed catalog rows as failed live quotes", () => {
    const counts = countQuoteAndSubscriptionStatuses([
      { quote: null, subscription: null },
      { quote: null, subscription: { status: "UNSUBSCRIBED" } },
    ]);
    expect(counts.failedSubscriptions).toBe(0);
    expect(counts.unquoted).toBe(2);
    expect(counts.live).toBe(0);
  });
});

describe("STEP 3C provider status distinctions", () => {
  it("does not treat SSE connected alone as broker connected when terminal is down", () => {
    const status = mapHfmProviderUiStatus({
      sseStatus: "connected",
      connectionState: "disconnected",
      freshness: "DISCONNECTED",
      terminalRunning: false,
      authenticated: true,
    });
    expect(status).toBe("DISCONNECTED");
  });

  it("surfaces auth_required distinctly from disconnect", () => {
    expect(
      mapHfmProviderUiStatus({
        sseStatus: "auth_required",
        connectionState: "waiting",
        freshness: "WAITING_FOR_DATA",
        terminalRunning: null,
        authenticated: null,
      }),
    ).toBe("AUTH_REQUIRED");
  });
});

describe("STEP 3C source integrity", () => {
  it("page marks STEP 3C and keeps REST overlay generation guards", () => {
    const page = read("desktop/forex/hfm-dashboard/market-watch/HfmMarketWatchPage.tsx");
    expect(page).toContain('data-hfm-step="3c"');
    expect(page).toContain("overlayGenRef");
    expect(page).toContain("overlayInFlightRef");
    expect(page).toContain("selectedSymbolRef");
    expect(page).not.toContain("1.08542");
    expect(page).not.toContain("screenshot");
  });

  it("store rejects older sequence ticks", () => {
    const store = read("desktop/forex/hfm-dashboard/hfm-realtime-store.ts");
    expect(store).toContain("sequence < prev.sequence");
    expect(store).toContain("receivedAtMs");
  });

  it("responsive CSS switches to cards under 820px", () => {
    const css = read("desktop/forex/hfm-dashboard/market-watch/hfm-market-watch.css");
    expect(css).toContain(".hfm-mw-inst-cards");
    expect(css).toContain("@media (max-width: 820px)");
    expect(css).toContain('display: flex');
    expect(css).toContain("overflow-x: hidden");
  });

  it("table ships mobile card layout without fabricating prices", () => {
    const table = read(
      "desktop/forex/hfm-dashboard/market-watch/components/HfmInstrumentsTable.tsx",
    );
    expect(table).toContain("hfm-mw-inst-card");
    expect(table).toContain("Unavailable");
    expect(table).not.toContain("1.085");
  });

  it("header keeps SSE / MT5 / agent statuses separate", () => {
    const header = read(
      "desktop/forex/hfm-dashboard/market-watch/components/HfmMarketWatchHeader.tsx",
    );
    expect(header).toContain("SSE connected");
    expect(header).toContain("MT5 online");
    expect(header).toContain("Agent authenticated");
  });
});
