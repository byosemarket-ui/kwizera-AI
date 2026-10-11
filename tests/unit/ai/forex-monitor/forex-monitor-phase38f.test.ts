import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  assertTransition,
  assessCandleFreshness,
  assessCandleFreshnessDetailed,
  shouldApplyNarrativeResult,
  evaluateMonitorTick,
  evaluateSetupRules,
  ForexMonitorTransitionError,
  resetForexMonitorManagerForTests,
  ForexMonitorManager,
  FOREX_MONITOR_SCHEMA_VERSION,
  resolveForexMonitorLimits,
} from "../../../../ai/forex-monitor/index.ts";
import type { UnifiedCandle, UnifiedCandleSeries } from "../../../../ai/market-data/providers/contracts.ts";
import type { PatternAnalysisResult } from "../../../../ai/forex-patterns/types.ts";
import type { MarketStructureAnalysisResult } from "../../../../ai/forex-structure/types.ts";

const T0 = 1_700_000_000;
function nowMs(): number {
  return Date.now();
}

function uc(
  time: number,
  o: number,
  h: number,
  l: number,
  c: number,
  closed = true,
): UnifiedCandle {
  return {
    provider: "BINANCE",
    marketType: "SPOT",
    providerSymbol: "BTCUSDT",
    canonicalSymbol: "BTCUSDT",
    displaySymbol: "BTC/USDT",
    timeframe: "15m",
    time,
    open: o,
    high: h,
    low: l,
    close: c,
    volume: 1,
    isClosed: closed,
    source: "BINANCE",
    sourceMode: "LIVE",
    dataQuality: "LIVE",
  };
}

function series(
  candles: UnifiedCandle[],
  overrides: Partial<UnifiedCandleSeries> = {},
): UnifiedCandleSeries {
  const last = candles.filter((c) => c.isClosed).at(-1);
  return {
    identity: {
      provider: "BINANCE",
      environment: "default",
      canonicalSymbol: "BTCUSDT",
      providerSymbol: "BTCUSDT",
      displaySymbol: "BTC/USDT",
      marketType: "SPOT",
      timeframe: "15m",
    },
    timeframe: "15m",
    source: "BINANCE",
    sourceMode: "LIVE",
    connectionState: "LIVE",
    dataQuality: "LIVE",
    candles,
    forming: null,
    count: candles.length,
    lastQuoteAt: new Date(nowMs()).toISOString(),
    updatedAt: new Date(nowMs()).toISOString(),
    note: "test",
    errorCode: null,
    errorMessage: null,
    ...overrides,
  };
}

function minimalSession(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: "s1",
    ownerKey: "admin",
    provider: "BINANCE",
    environment: "default",
    symbol: "BTCUSDT",
    timeframe: "15m",
    config: { narrativeEnabled: false, marketType: null, environment: "default" },
    lifecycleState: "WATCHING" as const,
    createdAt: new Date(nowMs()).toISOString(),
    updatedAt: new Date(nowMs()).toISOString(),
    startedAt: new Date(nowMs()).toISOString(),
    stoppedAt: null,
    lastEvaluationAt: null,
    lastValidCandleTime: null,
    lastDataUpdateAt: null,
    dataAgeMs: null,
    freshnessState: "FRESH" as const,
    lastError: null,
    evaluationCount: 0,
    lastSetupEventId: null,
    lastClosedCandleTimeEvaluated: null,
    currentSetup: null,
    lastEvidenceSummary: null,
    narrative: { status: "NONE" as const },
    ...overrides,
  };
}

describe.sequential("Forex Phase 38F — Continuous Monitor Core", () => {
  let tmp: string;

  beforeEach(() => {
    resetForexMonitorManagerForTests();
    tmp = mkdtempSync(path.join(tmpdir(), "fx-monitor-"));
  });

  afterEach(() => {
    resetForexMonitorManagerForTests();
    rmSync(tmp, { recursive: true, force: true });
  });

  it("exposes schema version and limits defaults", () => {
    expect(FOREX_MONITOR_SCHEMA_VERSION).toBe("forex-monitor-v1");
    const limits = resolveForexMonitorLimits();
    expect(limits.MAX_SESSIONS).toBe(5);
    expect(limits.NARRATIVE_TIMEOUT_MS).toBe(45_000);
    expect(limits.POLL_INTERVAL_MS).toBe(30_000);
  });

  it("assertTransition allows valid edges and rejects invalid (API unauthorized)", () => {
    expect(() => assertTransition("WATCHING", "SETUP_DETECTED")).not.toThrow();
    expect(() => assertTransition("STARTING", "SETUP_DETECTED")).not.toThrow();
    expect(() => assertTransition("STARTING", "CONFIRMED")).not.toThrow();
    expect(() => assertTransition("STOPPED", "WATCHING")).toThrow(ForexMonitorTransitionError);
  });

  it("freshness: age-ok Binance HISTORICAL is FRESH for closed-candle eval but not liveCapable", () => {
    const t = nowMs();
    const r = assessCandleFreshnessDetailed({
      provider: "BINANCE",
      timeframe: "15m",
      lastClosedTime: T0,
      lastUpdateAt: new Date(t).toISOString(),
      nowMs: t,
      sourceMode: "HISTORICAL",
      connectionState: "CONNECTED",
    });
    expect(r.state).toBe("FRESH");
    expect(r.liveCapable).toBe(false);
    expect(r.warnings.some((w) => /live stream not confirmed|HISTORICAL/i.test(w))).toBe(true);
  });

  it("freshness: aged Binance HISTORICAL is STALE", () => {
    const t = nowMs();
    const r = assessCandleFreshnessDetailed({
      provider: "BINANCE",
      timeframe: "15m",
      lastClosedTime: T0,
      lastUpdateAt: new Date(t - 3_600_000).toISOString(),
      nowMs: t,
      sourceMode: "HISTORICAL",
      connectionState: "CONNECTED",
    });
    expect(r.state).toBe("STALE");
    expect(r.liveCapable).toBe(false);
  });

  it("freshness: ForexConnect zero updates is not live FRESH", () => {
    const t = nowMs();
    const r = assessCandleFreshness(
      "FOREXCONNECT",
      "15m",
      T0,
      new Date(t).toISOString(),
      t,
      { updateCount: 0, pollChanges: 0 },
    );
    expect(r.state).toBe("STALE");
    expect(r.warnings.some((w) => w.includes("zero updates"))).toBe(true);
  });

  it("freshness: stale age marks STALE", () => {
    const t = nowMs();
    const old = new Date(t - 3_600_000).toISOString();
    const r = assessCandleFreshnessDetailed({
      provider: "BINANCE",
      timeframe: "15m",
      lastClosedTime: T0,
      lastUpdateAt: old,
      nowMs: t,
      sourceMode: "LIVE",
      connectionState: "LIVE",
    });
    expect(r.state).toBe("STALE");
  });

  it("evaluateMonitorTick dedupes same closed candle when still FRESH", async () => {
    const candles = [uc(T0, 100, 101, 99, 100)];
    const sess = minimalSession({
      lastClosedCandleTimeEvaluated: null,
      freshnessState: "UNKNOWN",
    });
    const fetch = vi.fn().mockResolvedValue(series(candles));
    const first = await evaluateMonitorTick(
      { session: sess, nowMs: nowMs(), candles: series(candles) },
      { fetchCandles: fetch },
    );
    expect(first.skipped).toBeFalsy();
    expect(first.session.evaluationCount).toBe(1);
    const second = await evaluateMonitorTick(
      { session: first.session, nowMs: nowMs() + 1000, candles: series(candles) },
      { fetchCandles: fetch },
    );
    expect(second.skipped).toBe(true);
    expect(second.session.evaluationCount).toBe(first.session.evaluationCount);
  });

  it("setup rules: watching vs setup detected vs waiting vs confirmed", () => {
    const emptyPattern: PatternAnalysisResult = {
      schemaVersion: "forex-candlestick-patterns-v1",
      ruleVersion: "v",
      provider: "BINANCE",
      symbol: "X",
      timeframe: "15m",
      detections: [],
      validation: { ok: true, skippedInvalid: 0, skippedDuplicates: 0, warnings: [], insufficientHistory: false },
      analyzedClosedCount: 1,
      formingExcluded: true,
      note: "",
    };
    const emptyStructure: MarketStructureAnalysisResult = {
      schemaVersion: "forex-market-structure-v1",
      ruleVersion: "v",
      provider: "BINANCE",
      symbol: "X",
      timeframe: "15m",
      analyzedAt: T0,
      trendState: "UNKNOWN",
      swings: [],
      classifications: [],
      events: [],
      zones: [],
      validation: { ok: true, skippedInvalid: 0, skippedDuplicates: 0, warnings: [], insufficientHistory: false },
      warnings: [],
      analyzedClosedCount: 1,
      formingExcluded: true,
      note: "",
      parameters: {},
      priceBasis: null,
    };

    expect(
      evaluateSetupRules({
        patternResult: emptyPattern,
        structureResult: emptyStructure,
        provider: "BINANCE",
        symbol: "X",
        timeframe: "15m",
        lastClosedCandleTime: T0,
      }).state,
    ).toBe("WATCHING");

    const withConfirmedPattern: PatternAnalysisResult = {
      ...emptyPattern,
      detections: [{
        patternId: "hammer",
        patternName: "Hammer",
        patternFamily: "CANDLESTICK",
        direction: "BULLISH",
        status: "CONFIRMED",
        provider: "BINANCE",
        symbol: "X",
        timeframe: "15m",
        candleStartTime: T0,
        candleEndTime: T0,
        candleTimes: [T0],
        ruleVersion: "v",
        parameters: {},
        evidence: ["hammer"],
      }],
    };
    expect(
      evaluateSetupRules({
        patternResult: withConfirmedPattern,
        structureResult: emptyStructure,
        provider: "BINANCE",
        symbol: "X",
        timeframe: "15m",
        lastClosedCandleTime: T0,
      }).state,
    ).toBe("SETUP_DETECTED");

    const withCandidate: PatternAnalysisResult = {
      ...withConfirmedPattern,
      detections: [{ ...withConfirmedPattern.detections[0]!, status: "CANDIDATE" }],
    };
    expect(
      evaluateSetupRules({
        patternResult: withCandidate,
        structureResult: emptyStructure,
        provider: "BINANCE",
        symbol: "X",
        timeframe: "15m",
        lastClosedCandleTime: T0,
      }).state,
    ).toBe("WAITING_FOR_CONFIRMATION");

    const withBos: MarketStructureAnalysisResult = {
      ...emptyStructure,
      events: [{
        id: "e1",
        type: "BOS",
        direction: "BULLISH",
        status: "CONFIRMED",
        level: 110,
        levelTime: T0,
        levelSwingId: "s",
        breakCandleTime: T0,
        breakCandleIndex: 1,
        evidence: ["bos"],
        eventKey: `BOS:BULLISH:${T0}:${T0}`,
      }],
    };
    expect(
      evaluateSetupRules({
        patternResult: withConfirmedPattern,
        structureResult: withBos,
        provider: "BINANCE",
        symbol: "X",
        timeframe: "15m",
        lastClosedCandleTime: T0,
      }).state,
    ).toBe("CONFIRMED");
  });

  it("manager lifecycle start pause resume stop", async () => {
    const candles = [uc(T0, 100, 101, 99, 100)];
    const mgr = new ForexMonitorManager({
      storageRoot: tmp,
      pollIntervalMs: 0,
      fetchCandles: async () => series(candles),
    });
    const started = await mgr.start({
      provider: "BINANCE",
      symbol: "BTCUSDT",
      timeframe: "15m",
    });
    expect(started.lifecycleState).toBe("STARTING");
    await mgr.runTick(nowMs());
    const watching = mgr.getSession(started.sessionId)!;
    expect(watching.lifecycleState).toBe("WATCHING");

    const paused = await mgr.pause(started.sessionId);
    expect(paused.lifecycleState).toBe("PAUSED");

    const resumed = await mgr.resume(started.sessionId);
    expect(resumed.lifecycleState).toBe("WATCHING");

    const stopped = await mgr.stop(started.sessionId);
    expect(stopped.lifecycleState).toBe("STOPPED");
    mgr.dispose();
  });

  it("prevents duplicate active session same provider env symbol tf", async () => {
    const mgr = new ForexMonitorManager({
      storageRoot: tmp,
      pollIntervalMs: 0,
      fetchCandles: async () => series([uc(T0, 1, 2, 0, 1)]),
    });
    const first = await mgr.start({ provider: "BINANCE", symbol: "BTCUSDT", timeframe: "15m" });
    await expect(
      mgr.start({ provider: "BINANCE", symbol: "BTCUSDT", timeframe: "15m" }),
    ).rejects.toThrow("DUPLICATE_ACTIVE_SESSION");
    await mgr.stop(first.sessionId);
    mgr.dispose();
  });

  it("isolates sessions by provider symbol timeframe", async () => {
    const mgr = new ForexMonitorManager({
      storageRoot: tmp,
      pollIntervalMs: 0,
      fetchCandles: async () => series([uc(T0, 1, 2, 0, 1)]),
    });
    const a = await mgr.start({ provider: "BINANCE", symbol: "BTCUSDT", timeframe: "15m" });
    const b = await mgr.start({ provider: "BINANCE", symbol: "ETHUSDT", timeframe: "15m" });
    expect(a.sessionId).not.toBe(b.sessionId);
    await mgr.stop(a.sessionId);
    await mgr.stop(b.sessionId);
    mgr.dispose();
  });

  it("stop clears active set — session not evaluated further", async () => {
    const fetch = vi.fn().mockResolvedValue(series([uc(T0, 100, 101, 99, 100)]));
    const mgr = new ForexMonitorManager({
      storageRoot: tmp,
      pollIntervalMs: 0,
      fetchCandles: fetch,
    });
    const started = await mgr.start({ provider: "BINANCE", symbol: "BTCUSDT", timeframe: "15m" });
    await mgr.runTick(nowMs());
    const countAfterStart = mgr.getSession(started.sessionId)!.evaluationCount;
    await mgr.stop(started.sessionId);
    fetch.mockClear();
    await mgr.runTick(nowMs() + 120_000);
    expect(fetch).not.toHaveBeenCalled();
    expect(mgr.getSession(started.sessionId)!.evaluationCount).toBe(countAfterStart);
    mgr.dispose();
  });

  it("recoverOnBoot restores non-stopped sessions as STARTING", async () => {
    const fetch = vi.fn().mockResolvedValue(series([uc(T0, 100, 101, 99, 100)]));
    const mgr1 = new ForexMonitorManager({
      storageRoot: tmp,
      pollIntervalMs: 0,
      fetchCandles: fetch,
    });
    const s = await mgr1.start({ provider: "BINANCE", symbol: "BTCUSDT", timeframe: "15m" });
    await mgr1.runTick(nowMs());
    mgr1.dispose();

    const mgr2 = new ForexMonitorManager({
      storageRoot: tmp,
      pollIntervalMs: 0,
      fetchCandles: fetch,
    });
    const n = await mgr2.recoverOnBoot();
    expect(n).toBe(1);
    const recovered = mgr2.getSession(s.sessionId)!;
    expect(recovered.lifecycleState).toBe("STARTING");
    expect(recovered.workerActive).toBeFalsy();
    await mgr2.runTick(nowMs());
    expect(mgr2.getSession(s.sessionId)!.lifecycleState).toBe("WATCHING");
    await mgr2.stop(s.sessionId);
    mgr2.dispose();
  });

  it("event dedupe avoids identical consecutive events", async () => {
    const mgr = new ForexMonitorManager({
      storageRoot: tmp,
      pollIntervalMs: 0,
      fetchCandles: async () => series([uc(T0, 100, 101, 99, 100)]),
    });
    const s = await mgr.start({ provider: "BINANCE", symbol: "BTCUSDT", timeframe: "15m" });
    await mgr.runTick(nowMs());
    await mgr.runTick(nowMs() + 20_000);
    const events = await mgr.getEvents(s.sessionId);
    const transitions = events.filter((e) => e.type === "LIFECYCLE_TRANSITION");
    expect(transitions.length).toBeLessThanOrEqual(1);
    mgr.dispose();
  });

  it("narrative timeout does not block monitoring ticks", async () => {
    const hang = () => new Promise<never>(() => {});
    const mgr = new ForexMonitorManager({
      storageRoot: tmp,
      pollIntervalMs: 0,
      limits: { MIN_EVAL_GAP_MS: 0, NARRATIVE_TIMEOUT_MS: 50 },
      fetchCandles: async () => series([uc(T0, 100, 101, 99, 100)]),
      runNarrative: hang,
    });
    const s = await mgr.start({
      provider: "BINANCE",
      symbol: "BTCUSDT",
      timeframe: "15m",
      config: { narrativeEnabled: true },
    });
    await mgr.runTick(nowMs());
    await new Promise((r) => setTimeout(r, 120));
    await mgr.runTick(nowMs() + 15_000);
    const session = mgr.getSession(s.sessionId)!;
    // Deterministic monitoring must keep evaluating even if narrative hangs.
    expect(["WATCHING", "SETUP_DETECTED", "WAITING_FOR_CONFIRMATION", "CONFIRMED", "STALE"]).toContain(
      session.lifecycleState,
    );
    expect(session.evaluationCount).toBeGreaterThan(0);
    expect(session.lifecycleState).not.toBe("STOPPED");
    mgr.dispose();
  });

  it("stale narrative generation is ignored on complete", async () => {
    const manager = new ForexMonitorManager({
      storageRoot: tmp,
      pollIntervalMs: 0,
      fetchCandles: async () => series([uc(T0, 100, 101, 99, 100)]),
    });
    const s = await manager.start({
      provider: "BINANCE",
      symbol: "BTCUSDT",
      timeframe: "15m",
      config: { narrativeEnabled: false },
    });
    await manager.runTick(nowMs());
    await manager["patch"](s.sessionId, {
      narrativeGeneration: 5,
      narrative: { status: "PENDING", generation: 5, eventId: "e-new" },
    });
    await manager["applyNarrativeResult"]({
      sessionId: s.sessionId,
      eventId: "e-old",
      generation: 4,
      narrative: { status: "COMPLETED", summary: "stale", generation: 4 },
    });
    const after = manager.getSession(s.sessionId)!;
    expect(after.narrative.status).toBe("PENDING");
    expect(after.narrative.summary).not.toBe("stale");
    manager.dispose();
  });
});
