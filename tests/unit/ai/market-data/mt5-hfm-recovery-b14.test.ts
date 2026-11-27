/**
 * STEP 1B.4 — Recovery state accuracy, poll outcomes, session preservation,
 * sequence-reset ordering, and Quote Service / recovery integration.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  classifyFailedPoll,
  classifySuccessfulIngestPoll,
} from "../../../../ai/market-data/mt5-hfm/poll-outcome";
import {
  HfmRecoveryEngine,
  resetHfmRecoveryEngineForTests,
} from "../../../../ai/market-data/mt5-hfm/recovery-engine";
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
  HfmSymbolFreshnessEngine,
  HFM_MARKET_SESSION_OBSERVATION_MAX_AGE_MS,
  resetHfmSymbolFreshnessEngineForTests,
} from "../../../../ai/market-data/mt5-hfm/symbol-freshness";
import {
  quotePayloadForSse,
  envelopeFreshnessFromCanonical,
} from "../../../../ai/market-data/mt5-hfm/sse-distribution";
import { buildHfmChartsAnalysisSnapshot } from "../../../../ai/market-data/mt5-hfm/charts-analysis-contract";
import { normalizeQuoteContext } from "../../../../ai/market-data/mt5-hfm/analysis/normalizer";
import { HFM_QUOTE_PROVIDER } from "../../../../ai/market-data/mt5-hfm/quote-types";
import { HFM_ANALYSIS_PROVIDER } from "../../../../ai/market-data/mt5-hfm/analysis/constants";
import { MT5_HFM_SSE_EVENT_TYPES } from "../../../../ai/market-data/mt5-hfm/event-contract";
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

function trustedQuote(over: Partial<HfmCanonicalQuote> & { symbol: string }): HfmCanonicalQuote {
  const q = {
    symbol: over.symbol,
    bid: over.bid ?? 1.1,
    ask: over.ask ?? 1.1002,
    digits: over.digits ?? 5,
    quoteTimestampUtc: over.quoteTimestampUtc ?? 1_700_000_100,
    quoteTimestampUtcMs: over.quoteTimestampUtcMs ?? 1_700_000_100_000,
    sequence: over.sequence ?? 10,
    timestampNormalizationStatus: over.timestampNormalizationStatus ?? "NORMALIZED",
    ...over,
  } as unknown as HfmCanonicalQuote;
  q.quoteVersionId = buildHfmQuoteVersionId(q);
  return q;
}

describe("B1.4 poll outcome semantics", () => {
  it("classifies new quotes, no-change, partial, empty, invalid, and failures", () => {
    expect(
      classifySuccessfulIngestPoll({
        rawQuoteCount: 4,
        published: 2,
        rejected: 0,
        skippedStaleOrDuplicate: 2,
        expectedSymbolCount: 4,
        symbolsInSnapshot: 4,
        lkgCountBeforeIngest: 4,
        terminalRunning: true,
        feedDisconnected: false,
      }).kind,
    ).toBe("VALID_WITH_NEW_QUOTES");

    expect(
      classifySuccessfulIngestPoll({
        rawQuoteCount: 4,
        published: 0,
        rejected: 0,
        skippedStaleOrDuplicate: 4,
        expectedSymbolCount: 4,
        symbolsInSnapshot: 4,
        lkgCountBeforeIngest: 4,
        terminalRunning: true,
        feedDisconnected: false,
      }),
    ).toMatchObject({ kind: "VALID_NO_CHANGE", validQuoteObserved: true, transportOk: true });

    expect(
      classifySuccessfulIngestPoll({
        rawQuoteCount: 2,
        published: 0,
        rejected: 0,
        skippedStaleOrDuplicate: 2,
        expectedSymbolCount: 4,
        symbolsInSnapshot: 2,
        lkgCountBeforeIngest: 4,
        terminalRunning: true,
        feedDisconnected: false,
      }).kind,
    ).toBe("VALID_PARTIAL_SNAPSHOT");

    expect(
      classifySuccessfulIngestPoll({
        rawQuoteCount: 0,
        published: 0,
        rejected: 0,
        skippedStaleOrDuplicate: 0,
        expectedSymbolCount: 4,
        symbolsInSnapshot: 0,
        lkgCountBeforeIngest: 0,
        terminalRunning: true,
        feedDisconnected: false,
      }),
    ).toMatchObject({ kind: "EMPTY_OR_UNCONFIRMED", validQuoteObserved: false });

    expect(
      classifySuccessfulIngestPoll({
        rawQuoteCount: 3,
        published: 0,
        rejected: 3,
        skippedStaleOrDuplicate: 0,
        expectedSymbolCount: 3,
        symbolsInSnapshot: 3,
        lkgCountBeforeIngest: 0,
        terminalRunning: true,
        feedDisconnected: false,
      }).kind,
    ).toBe("SNAPSHOT_INVALID");

    expect(classifyFailedPoll("AGENT_TIMEOUT").kind).toBe("POLL_FAILED");
    expect(classifyFailedPoll("AGENT_UNAVAILABLE")).toMatchObject({
      kind: "POLL_FAILED",
      transportOk: false,
      validQuoteObserved: false,
    });
  });
});

describe("B1.4 recovery-state transitions", () => {
  beforeEach(() => {
    resetHfmRecoveryEngineForTests();
  });

  it("healthy no-change stays healthy and does not inflate successfulRecoveries", () => {
    const eng = new HfmRecoveryEngine();
    expect(eng.getState().status).toBe("HEALTHY");
    for (let i = 0; i < 5; i++) {
      eng.completeAttempt({
        ok: true,
        stage: "quotes_validated",
        validQuoteObserved: true,
        transportOk: true,
        terminalRunning: true,
        pollOutcome: "VALID_NO_CHANGE",
      });
    }
    expect(eng.getState().status).toBe("HEALTHY");
    expect(eng.getState().reason).toBe("HEALTHY_NO_CHANGE");
    expect(eng.metrics().successfulRecoveries).toBe(0);
    expect(eng.getHistory().filter((h) => h.type === "recovery.completed")).toHaveLength(0);
  });

  it("does not flap DEGRADED/RECOVERED on repeated no-change after healthy", () => {
    const eng = new HfmRecoveryEngine();
    const types: string[] = [];
    eng.onEvent((e) => types.push(e.type));
    eng.completeAttempt({
      ok: true,
      validQuoteObserved: true,
      transportOk: true,
      terminalRunning: true,
      pollOutcome: "VALID_WITH_NEW_QUOTES",
    });
    eng.completeAttempt({
      ok: true,
      validQuoteObserved: true,
      transportOk: true,
      terminalRunning: true,
      pollOutcome: "VALID_NO_CHANGE",
    });
    expect(types.filter((t) => t === "recovery.completed")).toHaveLength(0);
    expect(eng.getState().status).toBe("HEALTHY");
  });

  it("degraded → valid recovery snapshot emits one completed and increments once", () => {
    const eng = new HfmRecoveryEngine();
    eng.markDegraded("POLL_FAILED");
    expect(eng.getState().status).toBe("DEGRADED");
    eng.begin("POLL_FAILED", "transport_check");
    eng.completeAttempt({
      ok: true,
      stage: "quotes_validated",
      validQuoteObserved: true,
      transportOk: true,
      terminalRunning: true,
      pollOutcome: "VALID_WITH_NEW_QUOTES",
    });
    expect(eng.getState().status).toBe("HEALTHY");
    expect(eng.metrics().successfulRecoveries).toBe(1);

    // Subsequent no-change must not increment again.
    eng.completeAttempt({
      ok: true,
      validQuoteObserved: true,
      transportOk: true,
      terminalRunning: true,
      pollOutcome: "VALID_NO_CHANGE",
    });
    expect(eng.metrics().successfulRecoveries).toBe(1);
  });

  it("empty/unconfirmed keeps DEGRADED without progress spam", () => {
    const eng = new HfmRecoveryEngine();
    eng.markDegraded("empty");
    const types: string[] = [];
    eng.onEvent((e) => types.push(`${e.type}:${e.reason}`));
    eng.completeAttempt({
      ok: true,
      transportOk: true,
      terminalRunning: true,
      validQuoteObserved: false,
      pollOutcome: "EMPTY_OR_UNCONFIRMED",
    });
    eng.completeAttempt({
      ok: true,
      transportOk: true,
      terminalRunning: true,
      validQuoteObserved: false,
      pollOutcome: "EMPTY_OR_UNCONFIRMED",
    });
    expect(eng.getState().status).toBe("DEGRADED");
    expect(eng.getState().reason).toBe("CONNECTED_WITHOUT_VALID_QUOTE");
    expect(types.filter((t) => t.includes("CONNECTED_WITHOUT_VALID_QUOTE"))).toHaveLength(1);
  });

  it("transport health and market freshness remain separate concepts", () => {
    const outcome = classifySuccessfulIngestPoll({
      rawQuoteCount: 1,
      published: 0,
      rejected: 0,
      skippedStaleOrDuplicate: 1,
      expectedSymbolCount: 1,
      symbolsInSnapshot: 1,
      lkgCountBeforeIngest: 1,
      terminalRunning: true,
      feedDisconnected: false,
    });
    expect(outcome.transportOk).toBe(true);
    expect(outcome.validQuoteObserved).toBe(true);
    expect(outcome.kind).toBe("VALID_NO_CHANGE");
    // Transport OK does not claim tick freshness — that remains B2/Quote Service.
  });
});

describe("B1.4 market-session preservation", () => {
  beforeEach(() => {
    resetHfmSymbolFreshnessEngineForTests();
  });

  it("preserves MARKET_CLOSED observation when transport fails", () => {
    const eng = new HfmSymbolFreshnessEngine({ marketClosedMaxAgeMs: 60_000 });
    const t0 = Date.now();
    eng.setConnectivity({ transportOk: true, terminalRunning: true, marketClosed: true, nowMs: t0 });
    eng.noteValidQuote({
      symbol: "EURUSD",
      receivedAt: new Date(t0).toISOString(),
      tickTimestamp: Math.floor(t0 / 1000),
      category: "FOREX",
    });
    eng.recompute("EURUSD", { nowMs: t0 });
    expect(eng.get("EURUSD")?.freshnessStatus).toBe("MARKET_CLOSED");

    // Poll failure: omit marketClosed — must not invent open.
    eng.setConnectivity({ transportOk: false, terminalRunning: true, nowMs: t0 + 5_000 });
    const obs = eng.getMarketSessionObservation(t0 + 5_000);
    expect(obs.marketClosed).toBe(true);
    expect(obs.provenance).toBe("preserved");
    expect(obs.authoritative).toBe(true);
    expect(obs.observedAt).toBe(new Date(t0).toISOString());
    // Symbol freshness prefers transport failure over inventing open.
    eng.recompute("EURUSD", { nowMs: t0 + 5_000 });
    expect(eng.get("EURUSD")?.freshnessStatus).toBe("TRANSPORT_UNAVAILABLE");
  });

  it("MARKET_OPEN + poll failure does not infer market closure", () => {
    const eng = new HfmSymbolFreshnessEngine();
    const t0 = Date.now();
    eng.setConnectivity({ transportOk: true, terminalRunning: true, marketClosed: false, nowMs: t0 });
    eng.setConnectivity({ transportOk: false, terminalRunning: true, nowMs: t0 + 1000 });
    const obs = eng.getMarketSessionObservation(t0 + 1000);
    expect(obs.marketClosed).toBe(false);
    expect(obs.provenance).toBe("preserved");
  });

  it("MT5 disconnect remains distinct from market closure", () => {
    const eng = new HfmSymbolFreshnessEngine();
    const t0 = Date.now();
    eng.setConnectivity({
      transportOk: true,
      terminalRunning: false,
      marketClosed: false,
      nowMs: t0,
    });
    eng.noteValidQuote({
      symbol: "XAUUSD",
      receivedAt: new Date(t0).toISOString(),
      tickTimestamp: Math.floor(t0 / 1000),
      category: "METALS",
    });
    expect(eng.get("XAUUSD")?.freshnessStatus).toBe("TERMINAL_DISCONNECTED");
  });

  it("expired session observation is non-authoritative", () => {
    const eng = new HfmSymbolFreshnessEngine({
      marketClosedMaxAgeMs: HFM_MARKET_SESSION_OBSERVATION_MAX_AGE_MS,
    });
    const t0 = Date.now();
    eng.setConnectivity({ marketClosed: true, transportOk: true, nowMs: t0 });
    const expired = eng.getMarketSessionObservation(t0 + HFM_MARKET_SESSION_OBSERVATION_MAX_AGE_MS + 1);
    expect(expired.authoritative).toBe(false);
    expect(expired.provenance).toBe("expired");
    expect(expired.marketClosed).toBeNull();
  });

  it("preserved session does not make an old quote LIVE via freshness engine", () => {
    const eng = new HfmSymbolFreshnessEngine();
    const t0 = Date.now();
    eng.setConnectivity({ transportOk: true, terminalRunning: true, marketClosed: true, nowMs: t0 });
    eng.noteValidQuote({
      symbol: "GBPUSD",
      receivedAt: new Date(t0 - 600_000).toISOString(),
      tickTimestamp: Math.floor((t0 - 600_000) / 1000),
      category: "FOREX",
    });
    eng.recompute("GBPUSD", { nowMs: t0 });
    expect(eng.get("GBPUSD")?.freshnessStatus).toBe("MARKET_CLOSED");
    eng.setConnectivity({ transportOk: false, nowMs: t0 + 1000 });
    eng.recompute("GBPUSD", { nowMs: t0 + 1000 });
    expect(eng.get("GBPUSD")?.freshnessStatus).not.toBe("FRESH");
    expect(eng.getMarketSessionObservation(t0 + 1000).marketClosed).toBe(true);
  });
});

describe("B1.4 sequence reset and monotonicity", () => {
  it("same-process increasing / duplicate / older / newer trusted UTC", () => {
    const existing = trustedQuote({ symbol: "EURUSD", sequence: 50 });
    const newer = trustedQuote({
      symbol: "EURUSD",
      sequence: 51,
      quoteTimestampUtc: 1_700_000_200,
      quoteTimestampUtcMs: 1_700_000_200_000,
      bid: 1.11,
      ask: 1.1102,
    });
    expect(compareHfmQuoteMonotonicity(existing, newer).decision).toBe("ACCEPT_NEWER");

    const dup = trustedQuote({ symbol: "EURUSD", sequence: 50 });
    expect(compareHfmQuoteMonotonicity(existing, dup).decision).toBe("REJECT_DUPLICATE");

    const older = trustedQuote({
      symbol: "EURUSD",
      sequence: 99,
      quoteTimestampUtc: 1_700_000_050,
      quoteTimestampUtcMs: 1_700_000_050_000,
    });
    expect(compareHfmQuoteMonotonicity(existing, older).decision).toBe("REJECT_OLDER_TICK");
  });

  it("trusted newer UTC with lower sequence is accepted", () => {
    const existing = trustedQuote({ symbol: "USDJPY", sequence: 500, bid: 150, ask: 150.01, digits: 3 });
    const newerLowerSeq = trustedQuote({
      symbol: "USDJPY",
      sequence: 1,
      quoteTimestampUtc: 1_700_000_500,
      quoteTimestampUtcMs: 1_700_000_500_000,
      bid: 150.2,
      ask: 150.21,
      digits: 3,
    });
    const r = compareHfmQuoteMonotonicity(existing, newerLowerSeq);
    expect(r.decision).toBe("ACCEPT_NEWER");
    expect(r.reason).toBe("TRUSTED_UTC_NEWER");
  });

  it("sequence regression with untrusted timestamps is REJECT_INCOMPARABLE", () => {
    const existing = {
      symbol: "XAUUSD",
      bid: 2000,
      ask: 2000.3,
      digits: 2,
      sequence: 200,
      quoteTimestampUtc: null,
      quoteTimestampUtcMs: null,
      timestampNormalizationStatus: "UNAVAILABLE",
    } as unknown as HfmCanonicalQuote;
    existing.quoteVersionId = buildHfmQuoteVersionId(existing);

    const reset = {
      ...existing,
      sequence: 1,
      bid: 2001,
      ask: 2001.3,
    } as HfmCanonicalQuote;
    reset.quoteVersionId = buildHfmQuoteVersionId(reset);
    const r = compareHfmQuoteMonotonicity(existing, reset);
    expect(r.decision).toBe("REJECT_INCOMPARABLE");
    expect(r.reason).toBe("SNAPSHOT_SEQ_REGRESSION_OR_RESET_PRESERVE_LKG");
    expect(isHfmMonotonicAccept(r.decision)).toBe(false);
  });

  it("untrusted cannot displace trusted; trusted displaces untrusted LKG", () => {
    const trusted = trustedQuote({ symbol: "GBPUSD" });
    const untrusted = trustedQuote({
      symbol: "GBPUSD",
      sequence: 999,
      timestampNormalizationStatus: "UNAVAILABLE",
      quoteTimestampUtc: null,
      quoteTimestampUtcMs: null,
      bid: 1.32,
      ask: 1.3202,
    });
    untrusted.timestampNormalizationStatus = "UNAVAILABLE" as never;
    untrusted.quoteTimestampUtc = null as never;
    untrusted.quoteTimestampUtcMs = null as never;
    untrusted.quoteVersionId = buildHfmQuoteVersionId(untrusted);
    expect(compareHfmQuoteMonotonicity(trusted, untrusted).decision).toBe("REJECT_UNTRUSTED_DISPLACE");

    const recovered = trustedQuote({
      symbol: "GBPUSD",
      quoteTimestampUtc: 1_700_000_300,
      quoteTimestampUtcMs: 1_700_000_300_000,
      bid: 1.33,
      ask: 1.3302,
    });
    expect(compareHfmQuoteMonotonicity(untrusted, recovered).decision).toBe("ACCEPT_NEWER");
  });

  it("missing timestamp / incomparable preserves LKG", () => {
    const existing = trustedQuote({
      symbol: "EURUSD",
      timestampNormalizationStatus: "UNAVAILABLE",
      quoteTimestampUtc: null,
      quoteTimestampUtcMs: null,
      sequence: null as never,
    });
    existing.timestampNormalizationStatus = "UNAVAILABLE" as never;
    existing.quoteTimestampUtc = null as never;
    existing.quoteTimestampUtcMs = null as never;
    existing.sequence = null as never;
    existing.quoteVersionId = buildHfmQuoteVersionId(existing);
    const incoming = { ...existing, bid: 1.2, ask: 1.2002 } as HfmCanonicalQuote;
    incoming.quoteVersionId = buildHfmQuoteVersionId(incoming);
    expect(compareHfmQuoteMonotonicity(existing, incoming).decision).toBe("REJECT_INCOMPARABLE");
  });
});

describe("B1.4 Quote Service recovery integration", () => {
  beforeEach(() => {
    resetHfmQuoteServiceForTests();
    resetHfmQuoteSubscriptionRegistryForTests();
    resetHfmTrustedBrokerUtcOffsetForTests();
    resetHfmRecoveryEngineForTests();
    resetHfmSymbolFreshnessEngineForTests();
  });

  it("duplicate snapshot does not refresh tick/receipt age; recovery accepts newer", async () => {
    const svc = new HfmQuoteService();
    const t0 = wallNow() - 20;
    await svc.ingestRawQuotes(
      [rawTick("EURUSD", t0, 1.1, 1.1002)],
      ingestCtx({
        sequence: 10,
        brokerTime: t0 + 7200,
        gmtTime: t0,
        receivedAt: new Date(t0 * 1000).toISOString(),
      }),
    );
    const first = svc.getQuote("EURUSD")!;
    const firstRecv = first.receivedAt;
    const firstVid = first.quoteVersionId;

    const dup = await svc.ingestRawQuotes(
      [rawTick("EURUSD", t0, 1.1, 1.1002)],
      ingestCtx({
        sequence: 11,
        brokerTime: t0 + 7200,
        gmtTime: t0,
        receivedAt: new Date((t0 + 5) * 1000).toISOString(),
      }),
    );
    expect(dup.published).toHaveLength(0);
    expect(dup.skippedStaleOrDuplicate).toBeGreaterThanOrEqual(1);
    expect(svc.getQuote("EURUSD")!.receivedAt).toBe(firstRecv);
    expect(svc.getQuote("EURUSD")!.quoteVersionId).toBe(firstVid);

    const outcome = classifySuccessfulIngestPoll({
      rawQuoteCount: 1,
      published: dup.published.length,
      rejected: dup.rejected.length,
      skippedStaleOrDuplicate: dup.skippedStaleOrDuplicate,
      expectedSymbolCount: 1,
      symbolsInSnapshot: 1,
      lkgCountBeforeIngest: 1,
      terminalRunning: true,
      feedDisconnected: false,
    });
    expect(outcome.kind).toBe("VALID_NO_CHANGE");

    const eng = new HfmRecoveryEngine();
    eng.completeAttempt({
      ok: true,
      validQuoteObserved: outcome.validQuoteObserved,
      transportOk: true,
      terminalRunning: true,
      pollOutcome: outcome.kind,
    });
    expect(eng.metrics().successfulRecoveries).toBe(0);

    const t1 = t0 + 10;
    const newer = await svc.ingestRawQuotes(
      [rawTick("EURUSD", t1, 1.101, 1.1012)],
      ingestCtx({
        sequence: 12,
        brokerTime: t1 + 7200,
        gmtTime: t1,
        receivedAt: new Date(t1 * 1000).toISOString(),
      }),
    );
    expect(newer.published).toHaveLength(1);
    expect(svc.getQuote("EURUSD")!.quoteVersionId).not.toBe(firstVid);
  });

  it("Core restart empty LKG accepts first quote; older cannot overwrite", async () => {
    const svc = new HfmQuoteService();
    expect(svc.countLkgQuotes()).toBe(0);
    const t0 = wallNow() - 5;
    await svc.ingestRawQuotes(
      [rawTick("XAUUSD", t0, 2650, 2650.3, 2)],
      ingestCtx({ sequence: 1, brokerTime: t0 + 7200, gmtTime: t0 }),
    );
    expect(svc.countLkgQuotes()).toBe(1);
    const vid = svc.getQuote("XAUUSD")!.quoteVersionId;
    const older = t0 - 30;
    await svc.ingestRawQuotes(
      [rawTick("XAUUSD", older, 2640, 2640.3, 2)],
      ingestCtx({ sequence: 2, brokerTime: older + 7200, gmtTime: older }),
    );
    expect(svc.getQuote("XAUUSD")!.quoteVersionId).toBe(vid);
  });

  it("per-symbol: one recovers while another stays missing; no cross contamination", async () => {
    const svc = new HfmQuoteService();
    const t0 = wallNow() - 8;
    await svc.ingestRawQuotes(
      [
        rawTick("EURUSD", t0, 1.1, 1.1002),
        rawTick("GBPUSD", t0, 1.3, 1.3002),
        rawTick("USDJPY", t0, 150.1, 150.12, 3),
        rawTick("XAUUSD", t0, 2650, 2650.3, 2),
      ],
      ingestCtx({ sequence: 1, brokerTime: t0 + 7200, gmtTime: t0 }),
    );
    expect(svc.countLkgQuotes()).toBe(4);
    const eurusdVid = svc.getQuote("EURUSD")!.quoteVersionId;
    const gbpusdVid = svc.getQuote("GBPUSD")!.quoteVersionId;

    const t1 = t0 + 5;
    // Partial snapshot: only EURUSD + XAUUSD
    const partial = await svc.ingestRawQuotes(
      [
        rawTick("EURUSD", t1, 1.105, 1.1052),
        rawTick("XAUUSD", t1, 2651, 2651.3, 2),
      ],
      ingestCtx({ sequence: 2, brokerTime: t1 + 7200, gmtTime: t1 }),
    );
    expect(partial.published.map((q) => q.symbol).sort()).toEqual(["EURUSD", "XAUUSD"]);
    expect(svc.getQuote("EURUSD")!.quoteVersionId).not.toBe(eurusdVid);
    expect(svc.getQuote("GBPUSD")!.quoteVersionId).toBe(gbpusdVid);
    expect(svc.getQuote("USDJPY")!.bid).toBeCloseTo(150.1, 2);

    const outcome = classifySuccessfulIngestPoll({
      rawQuoteCount: 2,
      published: partial.published.length,
      rejected: partial.rejected.length,
      skippedStaleOrDuplicate: partial.skippedStaleOrDuplicate,
      expectedSymbolCount: 4,
      symbolsInSnapshot: 2,
      lkgCountBeforeIngest: 4,
      terminalRunning: true,
      feedDisconnected: false,
    });
    expect(outcome.kind).toBe("VALID_PARTIAL_SNAPSHOT");
    expect(outcome.validQuoteObserved).toBe(true);
  });

  it("trusted newer after sequence reset is accepted by ingest", async () => {
    const svc = new HfmQuoteService();
    const t0 = wallNow() - 15;
    await svc.ingestRawQuotes(
      [rawTick("EURUSD", t0, 1.1, 1.1002)],
      ingestCtx({ sequence: 500, brokerTime: t0 + 7200, gmtTime: t0 }),
    );
    const t1 = t0 + 10;
    // Simulate agent restart: sequence resets to 1 but tick is newer trusted UTC.
    const r = await svc.ingestRawQuotes(
      [rawTick("EURUSD", t1, 1.12, 1.1202)],
      ingestCtx({ sequence: 1, brokerTime: t1 + 7200, gmtTime: t1 }),
    );
    expect(r.published).toHaveLength(1);
    expect(svc.getQuote("EURUSD")!.bid).toBeCloseTo(1.12, 4);
  });
});

describe("B1.4 downstream regression contracts", () => {
  beforeEach(() => {
    resetHfmQuoteServiceForTests();
    resetHfmQuoteSubscriptionRegistryForTests();
    resetHfmTrustedBrokerUtcOffsetForTests();
  });

  it("SSE payload/envelope preserve freshness; recovery event type exists; no feed_state flood type", async () => {
    expect(MT5_HFM_SSE_EVENT_TYPES).toContain("recovery");
    expect(MT5_HFM_SSE_EVENT_TYPES).toContain("heartbeat");
    expect(MT5_HFM_SSE_EVENT_TYPES).toContain("freshness");
    expect(MT5_HFM_SSE_EVENT_TYPES).not.toContain("feed_state");

    const svc = new HfmQuoteService();
    const t0 = wallNow() - 3;
    await svc.ingestRawQuotes(
      [rawTick("EURUSD", t0, 1.1, 1.1002)],
      ingestCtx({ sequence: 3, brokerTime: t0 + 7200, gmtTime: t0 }),
    );
    const q = svc.getQuote("EURUSD")!;
    const payload = quotePayloadForSse(q);
    expect(payload.provider).toBe(HFM_QUOTE_PROVIDER);
    expect(payload.quoteVersionId).toBe(q.quoteVersionId);
    expect(envelopeFreshnessFromCanonical(q, "LIVE")).toBeTruthy();
  });

  it("chart + AI normalizer reflect canonical provider and freshness fields", async () => {
    const svc = new HfmQuoteService();
    const t0 = wallNow() - 2;
    await svc.ingestRawQuotes(
      [rawTick("XAUUSD", t0, 2650, 2650.3, 2)],
      ingestCtx({ sequence: 7, brokerTime: t0 + 7200, gmtTime: t0 }),
    );
    const q = svc.getQuote("XAUUSD")!;
    const chart = buildHfmChartsAnalysisSnapshot({
      symbol: "XAUUSD",
      timeframe: "M15",
      historicalCandles: [],
      freshness: "LIVE",
      validationStatus: "ok",
      sourceProvenance: "HFM_MT5",
      latestTick: {
        bid: q.bid,
        ask: q.ask,
        last: null,
        brokerTimestamp: q.quoteTimestamp,
        quoteTimestampUtc: q.quoteTimestampUtc,
        timestampNormalizationStatus: q.timestampNormalizationStatus,
        quoteFreshnessStatus: q.quoteFreshnessStatus,
        quoteVersionId: q.quoteVersionId,
        receiveTimestamp: q.receivedAt,
        acquisition: q.acquisitionMethod,
      },
    });
    expect(chart.quoteTimestampUtc).toBe(q.quoteTimestampUtc);
    const normalized = normalizeQuoteContext({
      symbol: "XAUUSD",
      bid: q.bid,
      ask: q.ask,
      brokerTimestamp: q.quoteTimestamp,
      quoteTimestampUtc: q.quoteTimestampUtc,
      receiveTimestamp: q.receivedAt,
      freshness: q.status,
      acquisition: q.acquisitionMethod,
      marketSessionState: q.marketSessionState,
      timestampNormalizationStatus: q.timestampNormalizationStatus,
      snapshotAgeSec: q.snapshotAgeSec,
      tickAgeSec: q.tickAgeSec,
      receiptAgeSec: q.receiptAgeSec,
      quoteFreshnessStatus: q.quoteFreshnessStatus,
      dataQualityStatus: q.dataQualityStatus,
      freshnessReason: q.freshnessReason,
      quoteVersionId: q.quoteVersionId,
      quoteProvenance: q.quoteProvenance,
    });
    expect(normalized.quoteVersionId).toBe(q.quoteVersionId);
    expect(HFM_QUOTE_PROVIDER).toBe("HFM_MT5");
    expect(HFM_ANALYSIS_PROVIDER).toBe("HFM_MT5");
    const blob = JSON.stringify({ chart, normalized, q });
    expect(blob.toLowerCase()).not.toMatch(/binance/);
    expect(blob.toLowerCase()).not.toMatch(/forexconnect/);
  });
});
