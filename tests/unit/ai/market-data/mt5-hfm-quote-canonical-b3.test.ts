/**
 * STEP 1B.3 — monotonic LKG, quoteVersionId, SSE parity, canonical authority.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  buildHfmQuoteVersionId,
  compareHfmQuoteMonotonicity,
  isHfmMonotonicAccept,
} from "../../../../ai/market-data/mt5-hfm/quote-version";
import {
  HfmQuoteService,
  resetHfmQuoteServiceForTests,
} from "../../../../ai/market-data/mt5-hfm/quote-service";
import { resetHfmTrustedBrokerUtcOffsetForTests } from "../../../../ai/market-data/mt5-hfm/quote-timestamp";
import { resetHfmQuoteSubscriptionRegistryForTests } from "../../../../ai/market-data/mt5-hfm/quote-subscriptions";
import {
  quotePayloadForSse,
  envelopeFreshnessFromCanonical,
} from "../../../../ai/market-data/mt5-hfm/sse-distribution";
import { normalizeQuoteContext } from "../../../../ai/market-data/mt5-hfm/analysis/normalizer";
import { buildHfmChartsAnalysisSnapshot } from "../../../../ai/market-data/mt5-hfm/charts-analysis-contract";
import { HFM_QUOTE_PROVIDER } from "../../../../ai/market-data/mt5-hfm/quote-types";
import { HFM_ANALYSIS_PROVIDER } from "../../../../ai/market-data/mt5-hfm/analysis/constants";
import type { HfmCanonicalQuote } from "../../../../ai/market-data/mt5-hfm/quote-types";

const wallNow = () => Math.floor(Date.now() / 1000);

function ingestCtx(over: Record<string, unknown> = {}) {
  const now = wallNow();
  return {
    server: "HFMarketsGlobal-Demo",
    sequence: 100,
    receivedAt: new Date(now * 1000).toISOString(),
    ageSec: 1,
    marketClosed: false,
    terminalRunning: true,
    feedFreshness: "LIVE",
    requireCatalogMatch: false,
    brokerTime: now + 7200,
    gmtTime: now,
    ...over,
  };
}

function rawTick(symbol: string, tickUtc: number, bid: number, ask: number, digits = 5) {
  return {
    symbol,
    bid,
    ask,
    tickTime: tickUtc + 7200,
    tickTimeMs: (tickUtc + 7200) * 1000,
    digits,
    point: digits === 3 ? 0.001 : digits === 2 ? 0.01 : 1e-5,
    acquisitionMethod: "SymbolInfoTick" as const,
  };
}

describe("B3 quoteVersionId + monotonic compare", () => {
  it("builds stable id; changes on new tick or price", () => {
    const base = {
      symbol: "EURUSD",
      quoteTimestampUtc: 1_700_000_000,
      quoteTimestampUtcMs: 1_700_000_000_000,
      sequence: 10,
      bid: 1.1,
      ask: 1.1002,
      digits: 5,
      timestampNormalizationStatus: "NORMALIZED" as const,
    };
    const a = buildHfmQuoteVersionId(base);
    const b = buildHfmQuoteVersionId(base);
    expect(a).toBe(b);
    expect(a).toContain("EURUSD");
    expect(a).toContain("utcMs=");
    const newer = buildHfmQuoteVersionId({ ...base, quoteTimestampUtc: 1_700_000_001, quoteTimestampUtcMs: 1_700_000_001_000 });
    expect(newer).not.toBe(a);
    const price = buildHfmQuoteVersionId({ ...base, bid: 1.1001 });
    expect(price).not.toBe(a);
  });

  it("rejects older trusted tick; accepts newer; duplicate rejected", () => {
    const existing = {
      symbol: "XAUUSD",
      bid: 2000,
      ask: 2000.3,
      digits: 2,
      quoteTimestampUtc: 1_700_000_100,
      quoteTimestampUtcMs: 1_700_000_100_000,
      sequence: 5,
      timestampNormalizationStatus: "NORMALIZED",
      quoteVersionId: null,
    } as unknown as HfmCanonicalQuote;
    existing.quoteVersionId = buildHfmQuoteVersionId(existing);

    const older = {
      ...existing,
      quoteTimestampUtc: 1_700_000_050,
      quoteTimestampUtcMs: 1_700_000_050_000,
      bid: 1999,
      ask: 1999.3,
    } as HfmCanonicalQuote;
    older.quoteVersionId = buildHfmQuoteVersionId(older);
    const rOld = compareHfmQuoteMonotonicity(existing, older);
    expect(rOld.decision).toBe("REJECT_OLDER_TICK");
    expect(isHfmMonotonicAccept(rOld.decision)).toBe(false);

    const newer = {
      ...existing,
      quoteTimestampUtc: 1_700_000_200,
      quoteTimestampUtcMs: 1_700_000_200_000,
      bid: 2001,
      ask: 2001.3,
    } as HfmCanonicalQuote;
    newer.quoteVersionId = buildHfmQuoteVersionId(newer);
    expect(compareHfmQuoteMonotonicity(existing, newer).decision).toBe("ACCEPT_NEWER");

    const dup = { ...existing } as HfmCanonicalQuote;
    expect(compareHfmQuoteMonotonicity(existing, dup).decision).toBe("REJECT_DUPLICATE");
  });

  it("untrusted incoming cannot displace trusted LKG", () => {
    const existing = {
      symbol: "GBPUSD",
      bid: 1.3,
      ask: 1.3002,
      digits: 5,
      quoteTimestampUtc: 1_700_000_100,
      quoteTimestampUtcMs: 1_700_000_100_000,
      sequence: 5,
      timestampNormalizationStatus: "NORMALIZED",
    } as unknown as HfmCanonicalQuote;
    existing.quoteVersionId = buildHfmQuoteVersionId(existing);
    const untrusted = {
      ...existing,
      quoteTimestampUtc: null,
      quoteTimestampUtcMs: null,
      timestampNormalizationStatus: "UNAVAILABLE",
      sequence: 99,
      bid: 1.31,
      ask: 1.3102,
    } as HfmCanonicalQuote;
    untrusted.quoteVersionId = buildHfmQuoteVersionId(untrusted);
    const r = compareHfmQuoteMonotonicity(existing, untrusted);
    expect(r.decision).toBe("REJECT_UNTRUSTED_DISPLACE");
  });

  it("symbols remain isolated in version ids", () => {
    const a = buildHfmQuoteVersionId({
      symbol: "EURUSD",
      quoteTimestampUtc: 100,
      quoteTimestampUtcMs: 100_000,
      sequence: 1,
      bid: 1.1,
      ask: 1.1002,
      digits: 5,
      timestampNormalizationStatus: "NORMALIZED",
    });
    const b = buildHfmQuoteVersionId({
      symbol: "USDJPY",
      quoteTimestampUtc: 100,
      quoteTimestampUtcMs: 100_000,
      sequence: 1,
      bid: 1.1,
      ask: 1.1002,
      digits: 5,
      timestampNormalizationStatus: "NORMALIZED",
    });
    expect(a).not.toBe(b);
  });
});

describe("B3 LKG monotonic ingest", () => {
  beforeEach(() => {
    resetHfmQuoteServiceForTests();
    resetHfmQuoteSubscriptionRegistryForTests();
    resetHfmTrustedBrokerUtcOffsetForTests();
  });

  it("newer replaces; older cannot overwrite; duplicate does not refresh receipt", async () => {
    const svc = new HfmQuoteService();
    const t0 = wallNow() - 10;
    await svc.ingestRawQuotes(
      [rawTick("EURUSD", t0, 1.1, 1.1002)],
      ingestCtx({ sequence: 1, brokerTime: t0 + 7200, gmtTime: t0, receivedAt: new Date(t0 * 1000).toISOString() }),
    );
    const first = svc.getQuote("EURUSD");
    expect(first?.status).toBe("LIVE");
    expect(first?.quoteVersionId).toBeTruthy();
    const firstRecv = first!.receivedAt;
    const firstVid = first!.quoteVersionId;

    const t1 = t0 + 5;
    await svc.ingestRawQuotes(
      [rawTick("EURUSD", t1, 1.101, 1.1012)],
      ingestCtx({
        sequence: 2,
        brokerTime: t1 + 7200,
        gmtTime: t1,
        receivedAt: new Date(t1 * 1000).toISOString(),
      }),
    );
    const second = svc.getQuote("EURUSD");
    expect(second?.bid).toBe(1.101);
    expect(second?.quoteVersionId).not.toBe(firstVid);

    // Older tick must not regress LKG.
    await svc.ingestRawQuotes(
      [rawTick("EURUSD", t0, 1.09, 1.0902)],
      ingestCtx({
        sequence: 3,
        brokerTime: t0 + 7200,
        gmtTime: t0,
        receivedAt: new Date((t1 + 1) * 1000).toISOString(),
      }),
    );
    const afterOld = svc.getQuote("EURUSD");
    expect(afterOld?.bid).toBe(1.101);
    expect(afterOld?.quoteVersionId).toBe(second?.quoteVersionId);

    // Duplicate same tick+prices: preserve LKG (no false receipt refresh).
    await svc.ingestRawQuotes(
      [rawTick("EURUSD", t1, 1.101, 1.1012)],
      ingestCtx({
        sequence: 2,
        brokerTime: t1 + 7200,
        gmtTime: t1,
        receivedAt: new Date((t1 + 30) * 1000).toISOString(),
      }),
    );
    const afterDup = svc.getQuote("EURUSD");
    expect(afterDup?.receivedAt).toBe(second?.receivedAt);
    expect(afterDup?.receivedAt).not.toBe(new Date((t1 + 30) * 1000).toISOString());
    void firstRecv;
  });

  it("bid/ask atomic and four symbols isolated", async () => {
    const svc = new HfmQuoteService();
    const t = wallNow() - 2;
    await svc.ingestRawQuotes(
      [
        rawTick("XAUUSD", t, 2000, 2000.3, 2),
        rawTick("EURUSD", t, 1.1, 1.1002),
        rawTick("GBPUSD", t, 1.3, 1.3002),
        rawTick("USDJPY", t, 150, 150.02, 3),
      ],
      ingestCtx({ sequence: 7, brokerTime: t + 7200, gmtTime: t }),
    );
    for (const s of ["XAUUSD", "EURUSD", "GBPUSD", "USDJPY"]) {
      const q = svc.getQuote(s);
      expect(q?.bid).not.toBeNull();
      expect(q?.ask).not.toBeNull();
      expect(q?.ask! >= q!.bid!).toBe(true);
      expect(q?.quoteVersionId).toContain(s);
    }
    expect(svc.getQuote("EURUSD")?.quoteVersionId).not.toBe(svc.getQuote("GBPUSD")?.quoteVersionId);
  });
});

describe("B3 SSE payload parity", () => {
  it("exposes B1/B2/B3 fields; tickTime remains broker-domain", () => {
    const q = {
      symbol: "EURUSD",
      bid: 1.1,
      ask: 1.1002,
      last: null,
      spread: 0.0002,
      spreadPoints: 20,
      brokerSpreadPoints: null,
      digits: 5,
      point: 1e-5,
      tickSize: null,
      tickVolume: null,
      realVolume: null,
      quoteTimestamp: 1_700_007_200,
      quoteTimestampMs: 1_700_007_200_000,
      quoteTimestampUtc: 1_700_000_000,
      quoteTimestampUtcMs: 1_700_000_000_000,
      brokerUtcOffsetSec: 7200,
      receivedAtUtc: "2023-11-14T22:13:20.000Z",
      receivedAt: "2023-11-14T22:13:20.000Z",
      timestampSource: "mt5_tick",
      timestampNormalizationStatus: "NORMALIZED",
      timestampNormalizationReason: null,
      marketSessionState: "MARKET_OPEN",
      marketSessionReason: "WITHIN_TRADE_WINDOW",
      brokerClockFrozen: false,
      quoteFreshnessStatus: "FRESH_TICK",
      snapshotAgeSec: 1,
      tickAgeSec: 2,
      receiptAgeSec: 1,
      dataQualityStatus: "OK",
      freshnessReason: "TICK_WITHIN_LIVE_WINDOW",
      quoteVersionId: "hfm|EURUSD|test",
      quoteProvenance: "LKG_CACHED",
      status: "LIVE",
      validation: { verdict: "ok", errors: [], warnings: [], catalogMatched: true, catalogVersion: null },
      provider: "HFM_MT5",
      environment: "demo",
      server: null,
      sequence: 1,
      acquisitionMethod: "SymbolInfoTick",
    } as unknown as HfmCanonicalQuote;
    const p = quotePayloadForSse(q);
    expect(p.tickTime).toBe(1_700_007_200);
    expect(p.quoteTimestampUtc).toBe(1_700_000_000);
    expect(p.quoteFreshnessStatus).toBe("FRESH_TICK");
    expect(p.marketSessionState).toBe("MARKET_OPEN");
    expect(p.snapshotAgeSec).toBe(1);
    expect(p.tickAgeSec).toBe(2);
    expect(p.quoteVersionId).toBe("hfm|EURUSD|test");
    expect(envelopeFreshnessFromCanonical(q, "LIVE")).toBe("LIVE");
    expect(
      envelopeFreshnessFromCanonical(
        { ...q, quoteFreshnessStatus: "QUIET_OPEN_MARKET", status: "DELAYED" } as HfmCanonicalQuote,
        "LIVE",
      ),
    ).toBe("STALE");
    expect(
      envelopeFreshnessFromCanonical(
        { ...q, quoteFreshnessStatus: "MT5_DISCONNECTED", status: "ERROR" } as HfmCanonicalQuote,
        "DISCONNECTED",
      ),
    ).toBe("DISCONNECTED");
  });
});

describe("B3 charts + AI context", () => {
  it("charts latestTick keeps broker vs UTC distinct", () => {
    const snap = buildHfmChartsAnalysisSnapshot({
      symbol: "XAUUSD",
      timeframe: "H1",
      historicalCandles: [],
      freshness: "LIVE",
      validationStatus: "ok",
      sourceProvenance: "HFM_MT5",
      latestTick: {
        bid: 2000,
        ask: 2000.3,
        last: null,
        brokerTimestamp: 1_700_007_200,
        quoteTimestampUtc: 1_700_000_000,
        timestampNormalizationStatus: "NORMALIZED",
        quoteFreshnessStatus: "FRESH_TICK",
        quoteVersionId: "hfm|XAUUSD|v1",
        receiveTimestamp: "2023-11-14T22:13:20.000Z",
        acquisition: "SymbolInfoTick",
      },
    });
    expect(snap.tickTimestamp).toBe(1_700_007_200);
    expect(snap.quoteTimestampUtc).toBe(1_700_000_000);
    expect(snap.latestTick?.quoteTimestampUtc).toBe(1_700_000_000);
    expect(snap.latestTick?.brokerTimestamp).not.toBe(snap.latestTick?.quoteTimestampUtc);
  });
});

describe("B3 Forex isolation", () => {
  it("providers remain HFM_MT5 only", () => {
    expect(HFM_QUOTE_PROVIDER).toBe("HFM_MT5");
    expect(HFM_ANALYSIS_PROVIDER).toBe("HFM_MT5");
    expect(HFM_QUOTE_PROVIDER).not.toMatch(/binance|forexconnect/i);
  });
});

describe("B3 AI analysis quote context from canonical LKG", () => {
  beforeEach(() => {
    resetHfmQuoteServiceForTests();
    resetHfmQuoteSubscriptionRegistryForTests();
    resetHfmTrustedBrokerUtcOffsetForTests();
  });

  it("normalizeQuoteContext preserves quoteVersionId + UTC vs broker", async () => {
    const svc = new HfmQuoteService();
    const t = wallNow() - 2;
    const r = await svc.ingestRawQuotes(
      [rawTick("EURUSD", t, 1.1, 1.1002)],
      ingestCtx({ sequence: 42, brokerTime: t + 7200, gmtTime: t }),
    );
    expect(r.published).toHaveLength(1);
    const q = svc.getQuote("EURUSD");
    expect(q?.quoteVersionId).toBeTruthy();
    // Same mapping multi-tf-collector uses.
    const ctx = normalizeQuoteContext({
      symbol: "EURUSD",
      bid: q!.bid,
      ask: q!.ask,
      brokerTimestamp: q!.quoteTimestamp,
      quoteTimestampUtc: q!.quoteTimestampUtc,
      receiveTimestamp: q!.receivedAt,
      freshness: q!.status,
      acquisition: q!.acquisitionMethod,
      marketSessionState: q!.marketSessionState,
      timestampNormalizationStatus: q!.timestampNormalizationStatus,
      snapshotAgeSec: q!.snapshotAgeSec,
      tickAgeSec: q!.tickAgeSec,
      receiptAgeSec: q!.receiptAgeSec,
      quoteFreshnessStatus: q!.quoteFreshnessStatus,
      dataQualityStatus: q!.dataQualityStatus,
      freshnessReason: q!.freshnessReason,
      quoteVersionId: q!.quoteVersionId,
      quoteProvenance: q!.quoteProvenance,
    });
    expect(ctx.quoteVersionId).toBe(q!.quoteVersionId);
    expect(ctx.brokerTimestamp).not.toBe(ctx.quoteTimestampUtc);
    expect(ctx.timestampNormalizationStatus).toBe("NORMALIZED");
    expect(ctx.quoteProvenance).toBe("LKG_CACHED");
  });
});
