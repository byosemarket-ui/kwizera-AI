import { describe, expect, it, beforeEach } from "vitest";
import {
  createHfmSubscriptionManagerForTests,
  resetHfmSubscriptionManagerForTests,
} from "../../../../ai/market-data/mt5-hfm/subscription-manager";
import {
  computeSymbolFreshness,
  HfmSymbolFreshnessEngine,
  resetHfmSymbolFreshnessEngineForTests,
} from "../../../../ai/market-data/mt5-hfm/symbol-freshness";
import {
  classifyRecoveryError,
  computeBackoffMs,
  HfmRecoveryEngine,
  resetHfmRecoveryEngineForTests,
} from "../../../../ai/market-data/mt5-hfm/recovery-engine";
import { HfmSnapshotTracker, resetHfmSnapshotTrackerForTests } from "../../../../ai/market-data/mt5-hfm/snapshot-tracker";
import {
  HfmSubscriptionScheduler,
  resetHfmSubscriptionSchedulerForTests,
} from "../../../../ai/market-data/mt5-hfm/subscription-scheduler";
import {
  getHfmQuoteSubscriptionRegistry,
  resetHfmQuoteSubscriptionRegistryForTests,
  HfmQuoteSubscriptionRegistry,
} from "../../../../ai/market-data/mt5-hfm/quote-subscriptions";
import {
  HfmQuoteService,
  resetHfmQuoteServiceForTests,
} from "../../../../ai/market-data/mt5-hfm/quote-service";
import { getHfmSubscriptionManager } from "../../../../ai/market-data/mt5-hfm/subscription-manager";
import { HFM_DEFAULT_QUOTE_SYMBOLS } from "../../../../ai/market-data/mt5-hfm/quote-types";
import { MT5_HFM_SSE_EVENT_TYPES } from "../../../../ai/market-data/mt5-hfm/event-contract";

describe("HFM STEP 2B subscription lifecycle (synthetic)", () => {
  beforeEach(() => {
    resetHfmSubscriptionManagerForTests();
    resetHfmQuoteSubscriptionRegistryForTests();
  });

  it("defaults to nine symbols and enforces capacity", () => {
    const reg = getHfmQuoteSubscriptionRegistry();
    expect(reg.list().symbols).toEqual([...HFM_DEFAULT_QUOTE_SYMBOLS]);
    const limited = new HfmQuoteSubscriptionRegistry({ maxActive: 2, seedDefaults: false });
    expect(limited.activate("EURUSD").ok).toBe(true);
    expect(limited.activate("GBPUSD").ok).toBe(true);
    expect(limited.activate("USDJPY").ok).toBe(false);
    expect(limited.activate("USDJPY").reason).toBe("SUBSCRIPTION_LIMIT");
  });

  it("supports idempotent subscribe and unsubscribe", async () => {
    const mgr = createHfmSubscriptionManagerForTests({ seedDefaults: false });
    const a = mgr.activateSync("EURUSD");
    expect(a.ok).toBe(true);
    const again = await mgr.subscribe("EURUSD", { requireCatalog: false });
    expect(again.ok).toBe(true);
    expect(mgr.listAcquisitionSymbols()).toEqual(["EURUSD"]);
    const u1 = await mgr.unsubscribe("EURUSD");
    expect(u1.ok).toBe(true);
    const u2 = await mgr.unsubscribe("EURUSD");
    expect(u2.ok).toBe(true);
  });

  it("pauses and resumes without invalid transitions", () => {
    const mgr = createHfmSubscriptionManagerForTests({ seedDefaults: false });
    mgr.activateSync("EURUSD");
    expect(mgr.pause("EURUSD").ok).toBe(true);
    expect(mgr.get("EURUSD")?.status).toBe("PAUSED");
    expect(mgr.isAcquisitionEligible("EURUSD")).toBe(false);
    expect(mgr.resume("EURUSD").ok).toBe(true);
    expect(mgr.isAcquisitionEligible("EURUSD")).toBe(true);
    expect(mgr.pause("NOPE").ok).toBe(false);
  });

  it("rejects invalid state transitions", () => {
    const mgr = createHfmSubscriptionManagerForTests({ seedDefaults: false });
    mgr.activateSync("EURUSD");
    mgr.deactivateSync("EURUSD");
    // UNSUBSCRIBED removed from map — resume fails
    expect(mgr.resume("EURUSD").ok).toBe(false);
  });

  it("updates priority", () => {
    const mgr = createHfmSubscriptionManagerForTests({ seedDefaults: false });
    mgr.activateSync("EURUSD");
    const r = mgr.setPriority("EURUSD", "CRITICAL");
    expect(r.ok).toBe(true);
    expect(r.record?.priority).toBe("CRITICAL");
  });
});

describe("HFM STEP 2B scheduling fairness (synthetic)", () => {
  beforeEach(() => {
    resetHfmSubscriptionManagerForTests();
    resetHfmSubscriptionSchedulerForTests();
    resetHfmQuoteSubscriptionRegistryForTests();
  });

  it("priority-aware round-robin never starves low priority within a window", () => {
    const mgr = getHfmSubscriptionManager();
    mgr.replaceActiveSet(["EURUSD", "GBPUSD", "USDJPY"], "step2b");
    mgr.setPriority("EURUSD", "CRITICAL");
    mgr.setPriority("GBPUSD", "LOW");
    mgr.setPriority("USDJPY", "NORMAL");
    const sched = new HfmSubscriptionScheduler({ batchSize: 2 });
    const seen = new Set<string>();
    for (let i = 0; i < 12; i++) {
      const batch = sched.nextBatch();
      for (const s of batch.symbols) seen.add(s);
    }
    expect(seen.has("EURUSD")).toBe(true);
    expect(seen.has("GBPUSD")).toBe(true);
    expect(seen.has("USDJPY")).toBe(true);
  });

  it("prevents overlapping acquisition cycles", () => {
    const sched = new HfmSubscriptionScheduler({ batchSize: 2 });
    expect(sched.beginCycle()).toBe(true);
    expect(sched.beginCycle()).toBe(false);
    sched.endCycle(5);
    expect(sched.beginCycle()).toBe(true);
    sched.endCycle(1);
    expect(sched.status().overlappingPrevented).toBeGreaterThanOrEqual(1);
  });
});

describe("HFM STEP 2B freshness (synthetic)", () => {
  beforeEach(() => {
    resetHfmSymbolFreshnessEngineForTests();
  });

  it("classifies fresh/aging/stale/no-quote/disconnected/closed", () => {
    const now = Date.parse("2026-01-01T12:00:00.000Z");
    expect(
      computeSymbolFreshness({
        nowMs: now,
        lastValidQuoteAt: "2026-01-01T11:59:50.000Z",
        lastReceivedAt: "2026-01-01T11:59:50.000Z",
        lastTickTimestamp: now / 1000,
        category: "FOREX",
      }).status,
    ).toBe("FRESH");
    expect(
      computeSymbolFreshness({
        nowMs: now,
        lastValidQuoteAt: "2026-01-01T11:59:30.000Z",
        lastReceivedAt: "2026-01-01T11:59:30.000Z",
        lastTickTimestamp: null,
        category: "FOREX",
      }).status,
    ).toBe("AGING");
    expect(
      computeSymbolFreshness({
        nowMs: now,
        lastValidQuoteAt: "2026-01-01T11:57:00.000Z",
        lastReceivedAt: "2026-01-01T11:57:00.000Z",
        lastTickTimestamp: null,
        category: "FOREX",
      }).status,
    ).toBe("STALE");
    expect(
      computeSymbolFreshness({
        nowMs: now,
        lastValidQuoteAt: null,
        lastReceivedAt: null,
        lastTickTimestamp: null,
      }).status,
    ).toBe("NO_QUOTE");
    expect(
      computeSymbolFreshness({
        nowMs: now,
        lastValidQuoteAt: "2026-01-01T11:59:50.000Z",
        lastReceivedAt: "2026-01-01T11:59:50.000Z",
        lastTickTimestamp: null,
        terminalRunning: false,
      }).status,
    ).toBe("TERMINAL_DISCONNECTED");
    expect(
      computeSymbolFreshness({
        nowMs: now,
        lastValidQuoteAt: "2026-01-01T11:59:50.000Z",
        lastReceivedAt: "2026-01-01T11:59:50.000Z",
        lastTickTimestamp: null,
        marketClosed: true,
      }).status,
    ).toBe("MARKET_CLOSED");
  });

  it("emits freshness.changed only on transition", () => {
    const eng = new HfmSymbolFreshnessEngine();
    const events: string[] = [];
    eng.onEvent((e) => events.push(`${e.previousStatus}->${e.newStatus}`));
    eng.noteValidQuote({
      symbol: "EURUSD",
      receivedAt: new Date().toISOString(),
      tickTimestamp: Math.floor(Date.now() / 1000),
      category: "FOREX",
    });
    eng.noteValidQuote({
      symbol: "EURUSD",
      receivedAt: new Date().toISOString(),
      tickTimestamp: Math.floor(Date.now() / 1000),
      category: "FOREX",
    });
    expect(events.length).toBe(1);
  });
});

describe("HFM STEP 2B LKG + paused acquisition (synthetic)", () => {
  beforeEach(() => {
    resetHfmQuoteServiceForTests();
    resetHfmQuoteSubscriptionRegistryForTests();
    resetHfmSubscriptionManagerForTests();
    resetHfmSymbolFreshnessEngineForTests();
  });

  it("does not overwrite LKG with invalid and skips paused symbols", async () => {
    const mgr = getHfmSubscriptionManager();
    mgr.replaceActiveSet(["EURUSD", "GBPUSD"], "step2b");
    const svc = new HfmQuoteService();
    const good = await svc.ingestRawQuotes(
      [{ symbol: "EURUSD", bid: 1.1, ask: 1.1002, tickTime: 1_700_000_000 }],
      {
        server: "HFMarketsGlobal-Demo",
        sequence: 1,
        receivedAt: "2026-01-01T12:00:00.000Z",
        ageSec: 2,
        marketClosed: false,
        terminalRunning: true,
        feedFreshness: "LIVE",
        requireCatalogMatch: false,
      },
    );
    expect(good.published).toHaveLength(1);
    mgr.pause("EURUSD");
    const paused = await svc.ingestRawQuotes(
      [
        { symbol: "EURUSD", bid: 1.2, ask: 1.2002, tickTime: 1_700_000_100 },
        { symbol: "GBPUSD", bid: 1.3, ask: 1.3002, tickTime: 1_700_000_100 },
      ],
      {
        server: "HFMarketsGlobal-Demo",
        sequence: 2,
        receivedAt: "2026-01-01T12:00:03.000Z",
        ageSec: 2,
        marketClosed: false,
        terminalRunning: true,
        feedFreshness: "LIVE",
        requireCatalogMatch: false,
      },
    );
    expect(paused.skippedUnsubscribed).toBe(1);
    expect(paused.published.map((q) => q.symbol)).toEqual(["GBPUSD"]);
    expect(svc.getQuote("EURUSD")?.bid).toBe(1.1);

    const bad = await svc.ingestRawQuotes(
      [{ symbol: "GBPUSD", bid: 1.4, ask: 1.3 }],
      {
        server: "HFMarketsGlobal-Demo",
        sequence: 3,
        receivedAt: "2026-01-01T12:00:06.000Z",
        ageSec: 2,
        marketClosed: false,
        terminalRunning: true,
        feedFreshness: "LIVE",
        requireCatalogMatch: false,
      },
    );
    expect(bad.rejected).toHaveLength(1);
    expect(svc.getQuote("GBPUSD")?.bid).toBe(1.3);
  });
});

describe("HFM STEP 2B recovery + snapshot consistency (synthetic)", () => {
  beforeEach(() => {
    resetHfmRecoveryEngineForTests();
    resetHfmSnapshotTrackerForTests();
  });

  it("classifies permanent vs temporary errors and bounds retries", () => {
    expect(classifyRecoveryError("SYMBOL_NOT_IN_CATALOG")).toBe("permanent");
    expect(classifyRecoveryError("AGENT_UNAVAILABLE")).toBe("temporary");
    const delays = [1, 2, 3, 4].map((a) => computeBackoffMs(a, 1000, 10_000, 0));
    expect(delays[0]).toBe(1000);
    expect(delays[1]).toBe(2000);
    expect(delays[2]).toBe(4000);
    expect(delays[3]).toBe(8000);
  });

  it("does not mark recovered without a valid quote", () => {
    const eng = new HfmRecoveryEngine({ maxRetries: 3, minRetryMs: 10, maxRetryMs: 50 });
    eng.begin("DISCONNECT", "detect");
    const mid = eng.completeAttempt({
      ok: true,
      transportOk: true,
      terminalRunning: true,
      validQuoteObserved: false,
      stage: "connected",
    });
    expect(mid.status).toBe("DEGRADED");
    const done = eng.completeAttempt({
      ok: true,
      transportOk: true,
      terminalRunning: true,
      validQuoteObserved: true,
      stage: "quotes",
    });
    expect(done.status).toBe("HEALTHY");
  });

  it("detects duplicate, gap, and incomplete snapshots", () => {
    const t = new HfmSnapshotTracker();
    const a = t.observe({
      snapshotId: "s1",
      sequence: 1,
      expectedSymbols: ["EURUSD", "GBPUSD"],
      symbolsInBatch: ["EURUSD"],
      expectedBatchCount: 1,
    });
    expect(a.incomplete).toBe(true);
    expect(a.tracker.missingSymbols).toContain("GBPUSD");
    const b = t.observe({ snapshotId: "s1", sequence: 3, symbolsInBatch: ["EURUSD", "GBPUSD"] });
    expect(b.gap).toBe(1);
    const c = t.observe({ snapshotId: "s1", sequence: 3, symbolsInBatch: ["EURUSD", "GBPUSD"] });
    expect(c.duplicate).toBe(true);
  });
});

describe("HFM STEP 2B SSE contract extension", () => {
  it("includes subscription/freshness/recovery event types", () => {
    expect(MT5_HFM_SSE_EVENT_TYPES).toContain("subscription");
    expect(MT5_HFM_SSE_EVENT_TYPES).toContain("freshness");
    expect(MT5_HFM_SSE_EVENT_TYPES).toContain("recovery");
    expect(MT5_HFM_SSE_EVENT_TYPES).toContain("quote");
    expect(MT5_HFM_SSE_EVENT_TYPES).toContain("snapshot");
  });
});
