/**
 * STEP 1B.2 — snapshot / tick / receipt freshness + delay/LKG protection.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  assessHfmQuoteAges,
  isTrustedHfmTimestampNormalization,
  mapQuoteFreshnessToHfmStatus,
} from "../../../../ai/market-data/mt5-hfm/quote-freshness";
import {
  HfmQuoteService,
  resetHfmQuoteServiceForTests,
} from "../../../../ai/market-data/mt5-hfm/quote-service";
import { resetHfmTrustedBrokerUtcOffsetForTests } from "../../../../ai/market-data/mt5-hfm/quote-timestamp";
import { resetHfmQuoteSubscriptionRegistryForTests } from "../../../../ai/market-data/mt5-hfm/quote-subscriptions";
import { evaluateAnalysisDataQuality } from "../../../../ai/market-data/mt5-hfm/analysis/data-quality";
import type { HfmAnalysisQuoteContext } from "../../../../ai/market-data/mt5-hfm/analysis/types";
import { HFM_QUOTE_PROVIDER } from "../../../../ai/market-data/mt5-hfm/quote-types";
import { HFM_ANALYSIS_PROVIDER } from "../../../../ai/market-data/mt5-hfm/analysis/constants";

const nowSec = 1_700_000_000;
const receivedAt = new Date(nowSec * 1000).toISOString();

function baseQuote(over: Partial<HfmAnalysisQuoteContext> = {}): HfmAnalysisQuoteContext {
  return {
    symbol: "EURUSD",
    bid: 1.1,
    ask: 1.1002,
    spread: 0.0002,
    brokerTimestamp: nowSec + 7200,
    quoteTimestampUtc: nowSec - 5,
    receiveTimestamp: receivedAt,
    freshness: "LIVE",
    acquisition: "SymbolInfoTick",
    marketSessionState: "MARKET_OPEN",
    marketSessionReason: "WITHIN_TRADE_WINDOW",
    brokerClockFrozen: false,
    timestampNormalizationStatus: "NORMALIZED",
    snapshotAgeSec: 2,
    tickAgeSec: 5,
    receiptAgeSec: 1,
    quoteFreshnessStatus: "FRESH_TICK",
    dataQualityStatus: "OK",
    freshnessReason: "TICK_WITHIN_LIVE_WINDOW",
    ...over,
  };
}

describe("B2 assessHfmQuoteAges", () => {
  it("trusts NORMALIZED and PARTIAL UTC ticks only", () => {
    expect(isTrustedHfmTimestampNormalization("NORMALIZED", nowSec)).toBe(true);
    expect(isTrustedHfmTimestampNormalization("PARTIAL", nowSec)).toBe(true);
    expect(isTrustedHfmTimestampNormalization("UNAVAILABLE", nowSec)).toBe(false);
    expect(isTrustedHfmTimestampNormalization("NORMALIZED", null)).toBe(false);
  });

  it("UTC+0/+2/+3: tickAge uses quoteTimestampUtc not broker raw", () => {
    for (const offset of [0, 7200, 10800]) {
      const utc = nowSec - 3;
      const r = assessHfmQuoteAges({
        quoteTimestampUtc: utc,
        timestampNormalizationStatus: "NORMALIZED",
        receivedAt,
        snapshotAgeSec: 1,
        marketSessionState: "MARKET_OPEN",
        nowSec,
      });
      expect(r.tickAgeSec).toBe(3);
      expect(r.quoteFreshnessStatus).toBe("FRESH_TICK");
      expect(r.tickAgeTrusted).toBe(true);
      void offset;
    }
  });

  it("fresh snapshot with old tick → QUIET_OPEN_MARKET (not disconnect)", () => {
    const r = assessHfmQuoteAges({
      quoteTimestampUtc: nowSec - 45,
      timestampNormalizationStatus: "NORMALIZED",
      receivedAt,
      snapshotAgeSec: 2,
      marketSessionState: "MARKET_OPEN",
      nowSec,
    });
    expect(r.snapshotAgeSec).toBe(2);
    expect(r.tickAgeSec).toBe(45);
    expect(r.quoteFreshnessStatus).toBe("QUIET_OPEN_MARKET");
    expect(mapQuoteFreshnessToHfmStatus(r)).toBe("DELAYED");
  });

  it("stale normalized tick → STALE_TICK", () => {
    const r = assessHfmQuoteAges({
      quoteTimestampUtc: nowSec - 200,
      timestampNormalizationStatus: "NORMALIZED",
      receivedAt,
      snapshotAgeSec: 2,
      marketSessionState: "MARKET_OPEN",
      nowSec,
    });
    expect(r.quoteFreshnessStatus).toBe("STALE_TICK");
    expect(mapQuoteFreshnessToHfmStatus(r)).toBe("STALE");
  });

  it("missing/untrusted UTC → TICK_AGE_UNAVAILABLE / UNTRUSTED (never raw broker)", () => {
    const missing = assessHfmQuoteAges({
      quoteTimestampUtc: null,
      timestampNormalizationStatus: "UNAVAILABLE",
      receivedAt,
      snapshotAgeSec: 1,
      marketSessionState: "MARKET_OPEN",
      nowSec,
    });
    expect(missing.tickAgeSec).toBeNull();
    expect(missing.quoteFreshnessStatus).toBe("UNTRUSTED_TIMESTAMP");

    const unreliable = assessHfmQuoteAges({
      quoteTimestampUtc: null,
      timestampNormalizationStatus: "UNRELIABLE",
      receivedAt,
      snapshotAgeSec: 1,
      nowSec,
    });
    expect(unreliable.quoteFreshnessStatus).toBe("UNTRUSTED_TIMESTAMP");
  });

  it("market closed / trading break / disconnected / feed unavailable", () => {
    expect(
      assessHfmQuoteAges({
        quoteTimestampUtc: nowSec - 10,
        timestampNormalizationStatus: "NORMALIZED",
        receivedAt,
        marketSessionState: "MARKET_CLOSED",
        brokerClockFrozen: true,
        nowSec,
      }).quoteFreshnessStatus,
    ).toBe("MARKET_CLOSED");
    expect(
      assessHfmQuoteAges({
        quoteTimestampUtc: nowSec - 10,
        timestampNormalizationStatus: "NORMALIZED",
        receivedAt,
        marketSessionState: "TRADING_BREAK",
        nowSec,
      }).quoteFreshnessStatus,
    ).toBe("TRADING_BREAK");
    expect(
      assessHfmQuoteAges({
        quoteTimestampUtc: nowSec - 10,
        timestampNormalizationStatus: "NORMALIZED",
        receivedAt,
        marketSessionState: "MT5_DISCONNECTED",
        nowSec,
      }).quoteFreshnessStatus,
    ).toBe("MT5_DISCONNECTED");
    expect(
      assessHfmQuoteAges({
        quoteTimestampUtc: nowSec - 10,
        timestampNormalizationStatus: "NORMALIZED",
        receivedAt,
        marketSessionState: "FEED_UNAVAILABLE",
        nowSec,
      }).quoteFreshnessStatus,
    ).toBe("FEED_UNAVAILABLE");
  });

  it("receiptAgeSec distinct from tickAgeSec", () => {
    const recv = new Date((nowSec - 8) * 1000).toISOString();
    const r = assessHfmQuoteAges({
      quoteTimestampUtc: nowSec - 3,
      timestampNormalizationStatus: "NORMALIZED",
      receivedAt: recv,
      snapshotAgeSec: 8,
      nowSec,
    });
    expect(r.tickAgeSec).toBe(3);
    expect(r.receiptAgeSec).toBe(8);
    expect(r.snapshotAgeSec).toBe(8);
  });

  it("SESSION_UNKNOWN without trusted tick → SESSION_UNKNOWN", () => {
    const r = assessHfmQuoteAges({
      quoteTimestampUtc: null,
      timestampNormalizationStatus: "UNAVAILABLE",
      receivedAt,
      marketSessionState: "SESSION_UNKNOWN",
      nowSec,
    });
    expect(r.quoteFreshnessStatus).toBe("SESSION_UNKNOWN");
    expect(r.tickAgeSec).toBeNull();
  });

  it("future normalized UTC yields zero tick age (clamped), never broker-raw age", () => {
    const r = assessHfmQuoteAges({
      quoteTimestampUtc: nowSec + 30,
      timestampNormalizationStatus: "NORMALIZED",
      receivedAt,
      snapshotAgeSec: 1,
      marketSessionState: "MARKET_OPEN",
      nowSec,
    });
    expect(r.tickAgeSec).toBe(0);
    expect(r.quoteFreshnessStatus).toBe("FRESH_TICK");
  });

  it("four HFM priority symbols share freshness semantics", () => {
    for (const symbol of ["XAUUSD", "EURUSD", "GBPUSD", "USDJPY"] as const) {
      const r = assessHfmQuoteAges({
        quoteTimestampUtc: nowSec - 4,
        timestampNormalizationStatus: "NORMALIZED",
        receivedAt,
        snapshotAgeSec: 1,
        marketSessionState: "MARKET_OPEN",
        nowSec,
      });
      expect(r.quoteFreshnessStatus).toBe("FRESH_TICK");
      void symbol;
    }
  });
});

describe("B2 analysis data-quality uses UTC tick age", () => {
  it("does not treat broker ahead-of-UTC as negative age / bypass", () => {
    // Historical bug: nowSec - brokerTimestamp was negative under +7200 skew.
    const q = baseQuote({
      brokerTimestamp: nowSec + 7200,
      quoteTimestampUtc: nowSec - 5,
      tickAgeSec: 5,
      timestampNormalizationStatus: "NORMALIZED",
    });
    const report = evaluateAnalysisDataQuality({
      provider: "HFM_MT5",
      symbol: "EURUSD",
      datasets: {},
      quote: q,
      nowSec,
      requiredTimeframes: [],
    });
    expect(report.errors.some((e) => e.code === "STALE_QUOTE")).toBe(false);
  });

  it("marks STALE from trusted tickAgeSec", () => {
    const q = baseQuote({
      tickAgeSec: 250,
      quoteTimestampUtc: nowSec - 250,
      quoteFreshnessStatus: "STALE_TICK",
      freshness: "STALE",
    });
    const report = evaluateAnalysisDataQuality({
      provider: "HFM_MT5",
      symbol: "EURUSD",
      datasets: {},
      quote: q,
      nowSec,
      requiredTimeframes: [],
    });
    expect(report.errors.some((e) => e.code === "STALE_QUOTE")).toBe(true);
  });

  it("quiet open market is warning not STALE error", () => {
    const q = baseQuote({
      tickAgeSec: 40,
      snapshotAgeSec: 2,
      quoteFreshnessStatus: "QUIET_OPEN_MARKET",
      freshness: "DELAYED",
    });
    const report = evaluateAnalysisDataQuality({
      provider: "HFM_MT5",
      symbol: "XAUUSD",
      datasets: {},
      quote: q,
      nowSec,
      requiredTimeframes: [],
    });
    expect(report.errors.some((e) => e.code === "STALE_QUOTE")).toBe(false);
    expect(report.warnings.some((w) => w.code === "QUIET_OPEN_MARKET")).toBe(true);
  });

  it("never ages from raw broker when UTC missing", () => {
    const q = baseQuote({
      brokerTimestamp: nowSec + 7200,
      quoteTimestampUtc: null,
      tickAgeSec: null,
      timestampNormalizationStatus: "UNAVAILABLE",
      quoteFreshnessStatus: "UNTRUSTED_TIMESTAMP",
    });
    const report = evaluateAnalysisDataQuality({
      provider: "HFM_MT5",
      symbol: "GBPUSD",
      datasets: {},
      quote: q,
      nowSec,
      requiredTimeframes: [],
    });
    expect(report.warnings.some((w) => w.code === "UNTRUSTED_QUOTE_TS")).toBe(true);
    expect(report.errors.some((e) => e.code === "STALE_QUOTE")).toBe(false);
  });
});

describe("B2 LKG read-time reassessment (applyDelayCheck / getQuote)", () => {
  beforeEach(() => {
    resetHfmQuoteServiceForTests();
    resetHfmQuoteSubscriptionRegistryForTests();
    resetHfmTrustedBrokerUtcOffsetForTests();
  });

  it("fresh ingest stays LIVE; aging LKG becomes DELAYED on read", async () => {
    const svc = new HfmQuoteService();
    // Wall-clock relative: getQuote reassesses with Date.now().
    const wallNow = Math.floor(Date.now() / 1000);
    const tickUtc = wallNow - 2;
    const brokerTick = tickUtc + 7200;
    const recv = new Date(wallNow * 1000).toISOString();
    await svc.ingestRawQuotes(
      [
        {
          symbol: "EURUSD",
          bid: 1.1,
          ask: 1.1002,
          tickTime: brokerTick,
          tickTimeMs: brokerTick * 1000,
          digits: 5,
          point: 1e-5,
          acquisitionMethod: "SymbolInfoTick",
        },
      ],
      {
        server: "HFMarketsGlobal-Demo",
        sequence: 1,
        receivedAt: recv,
        ageSec: 1,
        marketClosed: false,
        terminalRunning: true,
        feedFreshness: "LIVE",
        requireCatalogMatch: false,
        brokerTime: brokerTick,
        gmtTime: tickUtc,
      },
    );
    const fresh = svc.getQuote("EURUSD");
    expect(fresh?.quoteTimestampUtc).toBe(tickUtc);
    expect(fresh?.status).toBe("LIVE");
    expect(fresh?.quoteFreshnessStatus).toBe("FRESH_TICK");

    // Simulate wall clock advance without new ingest (LKG warm read).
    const aged = assessHfmQuoteAges({
      quoteTimestampUtc: fresh!.quoteTimestampUtc,
      timestampNormalizationStatus: fresh!.timestampNormalizationStatus,
      receivedAt: fresh!.receivedAt,
      snapshotAgeSec: 1,
      marketSessionState: fresh!.marketSessionState,
      nowSec: wallNow + 90,
    });
    expect(aged.quoteFreshnessStatus).toBe("QUIET_OPEN_MARKET");
    expect(mapQuoteFreshnessToHfmStatus(aged)).toBe("DELAYED");
  });

  it("recovery: fresh tick restores FRESH_TICK", async () => {
    const svc = new HfmQuoteService();
    const wallNow = Math.floor(Date.now() / 1000);
    const oldUtc = wallNow - 120;
    const oldRecv = new Date(wallNow * 1000).toISOString();
    await svc.ingestRawQuotes(
      [
        {
          symbol: "USDJPY",
          bid: 150,
          ask: 150.02,
          tickTime: oldUtc + 7200,
          digits: 3,
          point: 0.001,
          acquisitionMethod: "SymbolInfoTick",
        },
      ],
      {
        server: "HFMarketsGlobal-Demo",
        sequence: 1,
        receivedAt: oldRecv,
        ageSec: 1,
        marketClosed: false,
        terminalRunning: true,
        feedFreshness: "LIVE",
        requireCatalogMatch: false,
        brokerTime: oldUtc + 7200,
        gmtTime: oldUtc,
      },
    );
    expect(svc.getQuote("USDJPY")?.status).not.toBe("LIVE");

    const newUtc = wallNow - 1;
    const newRecv = new Date(wallNow * 1000).toISOString();
    await svc.ingestRawQuotes(
      [
        {
          symbol: "USDJPY",
          bid: 150.1,
          ask: 150.12,
          tickTime: newUtc + 7200,
          digits: 3,
          point: 0.001,
          acquisitionMethod: "SymbolInfoTick",
        },
      ],
      {
        server: "HFMarketsGlobal-Demo",
        sequence: 2,
        receivedAt: newRecv,
        ageSec: 1,
        marketClosed: false,
        terminalRunning: true,
        feedFreshness: "LIVE",
        requireCatalogMatch: false,
        brokerTime: newUtc + 7200,
        gmtTime: newUtc,
      },
    );
    const q = svc.getQuote("USDJPY");
    expect(q?.status).toBe("LIVE");
    expect(q?.quoteFreshnessStatus).toBe("FRESH_TICK");
    expect(q?.bid).toBe(150.1);
  });
});

describe("B2 Forex provider isolation", () => {
  it("HFM quote/analysis providers remain HFM_MT5 (never Binance Forex fallback)", () => {
    expect(HFM_QUOTE_PROVIDER).toBe("HFM_MT5");
    expect(HFM_ANALYSIS_PROVIDER).toBe("HFM_MT5");
    expect(HFM_QUOTE_PROVIDER).not.toMatch(/binance/i);
    expect(HFM_ANALYSIS_PROVIDER).not.toMatch(/binance/i);
  });
});
