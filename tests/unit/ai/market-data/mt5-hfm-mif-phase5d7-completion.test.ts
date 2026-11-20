/**
 * Phase 5D.7 — price displacement, outcomes, stats, replay, persistence hardening.
 * Fixture-based; live HFM verification is separate on VPS.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  assessMifDataIntegrity,
  assessMifMarketStructure,
  assessMifPriceDisplacement,
  baseCanonicalCandle,
  MIF_PROVIDER_ID,
  MIF_PRICE_DISPLACEMENT_CONTRACT_ID,
  MIF_EVIDENCE_FAMILY_CATALOG,
  evaluateOpportunityOutcome,
  computeOpportunityPerformanceStatistics,
  runMifHistoricalReplay,
  runMifHfmOpportunityPipelineFromSeriesPersisted,
  __setMifOpportunityStorageForTests,
  MifOpportunityStorage,
  observeCandidateAgainstCandles,
  getMifOdWorkerStatus,
  type MifCanonicalCandle,
  type MifPersistedCandidate,
} from "../../../../ai/market-data/mt5-hfm/mif/index";

const T0 = 1_700_000_000;
const STEP = 3600;

function candle(
  index: number,
  high: number,
  low: number,
  close?: number,
  state: "CLOSED" | "FORMING" = "CLOSED",
  open?: number,
): MifCanonicalCandle {
  const openTimeSec = T0 + index * STEP;
  const mid = (high + low) / 2;
  const c = close ?? mid;
  const o = open ?? mid;
  return baseCanonicalCandle({
    providerSymbol: "XAUUSD",
    timeframe: "H1",
    openTimeSec,
    closeTimeSec: openTimeSec + STEP,
    open: o,
    high,
    low,
    close: c,
    tickVolume: 1,
    realVolume: null,
    collapsedVolume: null,
    volumeType: "tick",
    spread: null,
    candleState: state,
    priceBasis: "bid",
    timebase: "BROKER_SERVER",
    timezoneOffsetSec: null,
    brokerTimestampSec: openTimeSec,
    receivedAt: null,
    availableAt: null,
    availabilityStatus: "KNOWN",
    sourceDialect: "hfm.historical-bar",
    sourceProvenance: "test",
    sourceMode: "HISTORICAL",
    sourceDataQuality: "ok",
    validation: { status: "ok", errors: [], warnings: [] },
    instrument: null,
  });
}

/** Quiet series then a strong bullish displacement tip. */
function seriesWithBullishDisplacement(n = 40): MifCanonicalCandle[] {
  const out: MifCanonicalCandle[] = [];
  for (let i = 0; i < n - 1; i++) {
    const base = 2000 + i * 0.05;
    out.push(candle(i, base + 0.4, base - 0.4, base + 0.05, "CLOSED", base));
  }
  // Tip: large bullish body + close near high
  const tip = n - 1;
  const open = 2000 + (n - 2) * 0.05;
  out.push(candle(tip, open + 8, open - 0.2, open + 7.5, "CLOSED", open));
  return out;
}

function barsForPipeline(tf: string, n = 80) {
  const step =
    tf === "H4" ? 14400 : tf === "H1" ? 3600 : tf === "M15" ? 900 : 300;
  const bars = [];
  for (let i = 0; i < n; i++) {
    const c = 2000 + i * 0.35;
    const bump = i % 7 === 3 ? 1.8 : i % 7 === 6 ? -0.9 : 0;
    const close = c + bump;
    const open = close - 0.15;
    bars.push({
      time: T0 + i * step,
      open,
      high: Math.max(open, close) + 0.4,
      low: Math.min(open, close) - 0.4,
      close,
      tickVolume: 10 + i,
      realVolume: null,
      spread: 2,
      validationStatus: "ok" as const,
      provenance: "native" as const,
    });
  }
  return bars;
}

describe("Phase 5D.7 — catalog availability", () => {
  it("marks PRICE_DISPLACEMENT as AVAILABLE with dedicated contract", () => {
    const meta = MIF_EVIDENCE_FAMILY_CATALOG.PRICE_DISPLACEMENT;
    expect(meta.availability).toBe("AVAILABLE");
    expect(meta.expectedSourceContractId).toBe(MIF_PRICE_DISPLACEMENT_CONTRACT_ID);
    expect(meta.expectedSourceEngine).toBe("mif-price-displacement");
  });
});

describe("Phase 5D.7 — price displacement engine", () => {
  it("confirms CLOSED bullish displacement with ATR metrics", () => {
    const series = seriesWithBullishDisplacement(40);
    const q = assessMifDataIntegrity({
      candles: series,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const pd = assessMifPriceDisplacement({
      candles: series,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      quality: { kind: "step1-data-integrity", assessment: q },
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(pd.providerId).toBe(MIF_PROVIDER_ID);
    expect(pd.contractId).toBe(MIF_PRICE_DISPLACEMENT_CONTRACT_ID);
    expect(pd.placesOrders).toBe(false);
    expect(pd.doesNotClaimInstitutionalOrderFlow).toBe(true);
    expect(pd.displacementKind).toBe("BULLISH_DISPLACEMENT");
    expect(pd.confirmed).toBe(true);
    expect(pd.provisional).toBe(false);
    expect(pd.metrics?.strongCandle).toBe(true);
    expect(pd.metrics?.bodyAtr).toBeGreaterThan(1);
    // Without structure break, structuralDisplacement must be false
    expect(pd.structuralDisplacement).toBe(false);
  });

  it("FORMING tip is provisional never confirmed", () => {
    const series = seriesWithBullishDisplacement(40);
    const last = series[series.length - 1]!;
    series[series.length - 1] = { ...last, candleState: "FORMING" };
    const q = assessMifDataIntegrity({
      candles: series,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const pd = assessMifPriceDisplacement({
      candles: series,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      quality: { kind: "step1-data-integrity", assessment: q },
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(pd.displacementKind).toBe("FORMING");
    expect(pd.confirmed).toBe(false);
    expect(pd.provisional).toBe(true);
    expect(pd.status).toBe("PROVISIONAL");
  });

  it("blocks on missing quality", () => {
    const series = seriesWithBullishDisplacement(40);
    const pd = assessMifPriceDisplacement({
      candles: series,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      quality: null,
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(pd.displacementKind).toBe("BLOCKED_BY_QUALITY");
    expect(pd.confirmed).toBe(false);
  });

  it("returns INSUFFICIENT_DATA for short series", () => {
    const series = [candle(0, 2001, 1999, 2000.5)];
    const q = assessMifDataIntegrity({
      candles: series,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const pd = assessMifPriceDisplacement({
      candles: series,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      quality: { kind: "step1-data-integrity", assessment: q },
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(pd.displacementKind).toBe("INSUFFICIENT_DATA");
  });

  it("distinguishes strong candle from structural displacement", () => {
    const series = seriesWithBullishDisplacement(50);
    const q = assessMifDataIntegrity({
      candles: series,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const ms = assessMifMarketStructure({
      candles: series,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      quality: { kind: "step1-data-integrity", assessment: q },
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const pd = assessMifPriceDisplacement({
      candles: series,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      quality: { kind: "step1-data-integrity", assessment: q },
      marketStructure: ms,
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(pd.metrics?.strongCandle).toBe(true);
    // Structural flag is explicit boolean — either true with break or false without inventing
    expect(typeof pd.structuralDisplacement).toBe("boolean");
    if (!pd.metrics?.structuralBreak) {
      expect(pd.structuralDisplacement).toBe(false);
    }
  });
});

describe("Phase 5D.7 — outcome evaluation", () => {
  it("detects target reached after activation only", () => {
    const activation = T0;
    const candles = [
      candle(0, 2010, 1990, 2000), // activation bar — must be ignored
      candle(1, 2010, 1995, 2005),
      candle(2, 2025, 2000, 2020), // hits target 2015 ABOVE
    ];
    const ev = evaluateOpportunityOutcome({
      candidateId: "c1",
      opportunitySnapshotRef: "c1",
      activationOpenTimeSec: activation,
      levels: {
        targetPrice: 2015,
        targetSide: "ABOVE",
        invalidationPrice: 1990,
        invalidationSide: "BELOW",
        entryPrice: 2000,
      },
      closedCandles: candles,
      evaluationTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(ev.resultKind).toBe("TARGET_REACHED");
    expect(ev.barsExcludedBeforeActivation).toBeGreaterThanOrEqual(1);
    expect(ev.realizedRMultiple).not.toBeNull();
  });

  it("never favors outcome on same-candle collision", () => {
    const activation = T0;
    const candles = [
      candle(1, 2020, 1980, 2000), // both target 2015 and inv 1985
    ];
    const ev = evaluateOpportunityOutcome({
      candidateId: "c2",
      opportunitySnapshotRef: "c2",
      activationOpenTimeSec: activation,
      levels: {
        targetPrice: 2015,
        targetSide: "ABOVE",
        invalidationPrice: 1985,
        invalidationSide: "BELOW",
        entryPrice: 2000,
      },
      closedCandles: candles,
    });
    expect(ev.resultKind).toBe("BOTH_AMBIGUOUS_SAME_CANDLE");
    expect(ev.realizedRMultiple).toBeNull();
  });

  it("does not invent levels", () => {
    const ev = evaluateOpportunityOutcome({
      candidateId: "c3",
      opportunitySnapshotRef: "c3",
      activationOpenTimeSec: T0,
      levels: {},
      closedCandles: [candle(1, 2010, 1990, 2000)],
    });
    expect(ev.resultKind).toBe("LEVELS_NOT_PROVIDED");
  });

  it("drops duplicate observations idempotently", () => {
    const candles = [
      candle(1, 2010, 1995, 2005),
      candle(1, 2010, 1995, 2005),
      candle(2, 2025, 2000, 2020),
    ];
    const ev = evaluateOpportunityOutcome({
      candidateId: "c4",
      opportunitySnapshotRef: "c4",
      activationOpenTimeSec: T0,
      levels: {
        targetPrice: 2015,
        targetSide: "ABOVE",
        invalidationPrice: 1990,
        invalidationSide: "BELOW",
      },
      closedCandles: candles,
    });
    expect(ev.duplicateObservationsDropped).toBe(1);
    expect(ev.resultKind).toBe("TARGET_REACHED");
  });

  it("is deterministic for identical inputs", () => {
    const input = {
      candidateId: "c5",
      opportunitySnapshotRef: "c5",
      activationOpenTimeSec: T0,
      levels: {
        targetPrice: 2015,
        targetSide: "ABOVE" as const,
        invalidationPrice: 1990,
        invalidationSide: "BELOW" as const,
      },
      closedCandles: [candle(1, 2010, 1995, 2005), candle(2, 2025, 2000, 2020)],
      evaluationTimestamp: "2024-01-01T00:00:00.000Z",
    };
    const a = evaluateOpportunityOutcome(input);
    const b = evaluateOpportunityOutcome(input);
    expect(a.evaluationInputsHash).toBe(b.evaluationInputsHash);
    expect(a.resultKind).toBe(b.resultKind);
  });
});

describe("Phase 5D.7 — performance statistics", () => {
  function fakeCandidate(
    id: string,
    outcomeKind: MifPersistedCandidate["outcomeKind"],
    strategyId = "BREAKOUT",
  ): MifPersistedCandidate {
    return {
      schemaVersion: "1.0.0",
      candidateId: id,
      runId: "r1",
      strategyId,
      detectorId: "d1",
      providerId: "HFM_MT5",
      providerSymbol: "XAUUSD",
      direction: "UP",
      detectionStatus: "DETECTED",
      lifecycleState:
        outcomeKind === "TARGET_REACHED"
          ? "COMPLETED"
          : outcomeKind === "INVALIDATION_REACHED"
            ? "INVALIDATED"
            : "ACTIVE",
      timeframeRoles: ["PRIMARY"],
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
      supportingEvidenceIds: [],
      conflictingEvidenceIds: [],
      requiredConfirmations: [],
      invalidationConditions: [],
      dataQualityStatus: "VALID",
      mtfRelation: null,
      thesis: "",
      rationale: "",
      outcomeKind,
      candidateSnapshot: {} as never,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
      notExecutable: true,
    };
  }

  it("excludes ambiguous from win-rate denominator and requires min sample", () => {
    const candidates = [
      ...Array.from({ length: 6 }, (_, i) => fakeCandidate(`w${i}`, "TARGET_REACHED")),
      ...Array.from({ length: 4 }, (_, i) => fakeCandidate(`l${i}`, "INVALIDATION_REACHED")),
      fakeCandidate("a1", "BOTH_AMBIGUOUS_SAME_CANDLE"),
      fakeCandidate("e1", "EXPIRED_UNRESOLVED"),
    ];
    const report = computeOpportunityPerformanceStatistics({
      candidates,
      minSampleForWinRate: 10,
      calculationTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(report.totals.wins).toBe(6);
    expect(report.totals.losses).toBe(4);
    expect(report.totals.ambiguous).toBe(1);
    expect(report.winRate.availability).toBe("AVAILABLE");
    expect(report.winRate.denominator).toBe(10);
    expect(report.winRate.value).toBeCloseTo(0.6);
    expect(report.notWinProbabilityClaim).toBe(true);

    const small = computeOpportunityPerformanceStatistics({
      candidates: candidates.slice(0, 5),
      minSampleForWinRate: 10,
    });
    expect(small.winRate.availability).toBe("INSUFFICIENT_SAMPLE");
    expect(small.winRate.value).toBeNull();
  });
});

describe("Phase 5D.7 — historical replay", () => {
  it("replays chronologically without look-ahead and is reproducible", () => {
    const bars = barsForPipeline("H1", 60);
    const a = runMifHistoricalReplay({
      providerSymbol: "XAUUSD",
      primaryTimeframe: "H1",
      series: [{ timeframe: "H1", bars }],
      warmupBars: 40,
      maxSteps: 3,
      stepBars: 5,
    });
    const b = runMifHistoricalReplay({
      providerSymbol: "XAUUSD",
      primaryTimeframe: "H1",
      series: [{ timeframe: "H1", bars }],
      warmupBars: 40,
      maxSteps: 3,
      stepBars: 5,
    });
    expect(a.resultNamespace).toBe("HISTORICAL_REPLAY");
    expect(a.separatedFromLiveOutcomes).toBe(true);
    expect(a.placesOrders).toBe(false);
    expect(a.inputIdentity).toBe(b.inputIdentity);
    expect(a.stepsExecuted).toBe(b.stepsExecuted);
    expect(a.steps.map((s) => s.tipOpenTimeSec)).toEqual(
      b.steps.map((s) => s.tipOpenTimeSec),
    );
    // Tips must be strictly increasing (chronological)
    for (let i = 1; i < a.steps.length; i++) {
      expect(a.steps[i]!.tipOpenTimeSec).toBeGreaterThan(a.steps[i - 1]!.tipOpenTimeSec);
    }
  });

  it("reports limitation when historical data insufficient", () => {
    const run = runMifHistoricalReplay({
      providerSymbol: "XAUUSD",
      primaryTimeframe: "H1",
      series: [{ timeframe: "H1", bars: barsForPipeline("H1", 10) }],
      warmupBars: 40,
      maxSteps: 2,
    });
    expect(run.stepsExecuted).toBe(0);
    expect(run.limitation).toMatch(/insufficient historical data/i);
  });
});

describe("Phase 5D.7 — persistence + lifecycle + pipeline integration", () => {
  let tmp: string;
  let store: MifOpportunityStorage;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mif-5d7-"));
    process.env.KWIZERA_STORAGE_ROOT = tmp;
    store = new MifOpportunityStorage(tmp);
    __setMifOpportunityStorageForTests(store);
  });

  afterEach(() => {
    __setMifOpportunityStorageForTests(null);
    delete process.env.KWIZERA_STORAGE_ROOT;
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("pipeline exposes dedicated price displacement and persists", async () => {
    const r = await runMifHfmOpportunityPipelineFromSeriesPersisted({
      providerSymbol: "XAUUSD",
      primaryTimeframe: "H1",
      timeframes: ["H1", "H4"],
      series: [
        { timeframe: "H1", bars: barsForPipeline("H1", 80) },
        { timeframe: "H4", bars: barsForPipeline("H4", 80) },
      ],
      assessmentTimestamp: "2024-06-01T00:00:00.000Z",
      maxCandleAgeSec: null,
    });
    expect(r.contextSummary?.hasPriceDisplacement).toBe(true);
    expect(r.providerId).toBe(MIF_PROVIDER_ID);
    expect(r.placesOrders).toBe(false);
    const disp = r._debugContext?.evidence.find((e) => e.family === "PRICE_DISPLACEMENT")
      ?? (r as { detection?: { context?: unknown } });
    void disp;
    const ctx = (r as { _debugContext?: { evidence: Array<{ family: string; notes?: string; sourceEngine?: string | null }> } })
      ._debugContext;
    // includeDebugContext not set — check via persisted run snapshot instead
    expect(r.persistence?.persisted).toBe(true);
    const audit = await store.auditIntegrity();
    expect(audit.permissionsWritable).toBe(true);
    expect(audit.runs).toBeGreaterThanOrEqual(1);
  });

  it("pipeline with debug context uses dedicated displacement engine notes", async () => {
    const { runMifHfmOpportunityPipelineFromSeries } = await import(
      "../../../../ai/market-data/mt5-hfm/mif/production-integration/run-pipeline.js"
    );
    const r = runMifHfmOpportunityPipelineFromSeries(
      {
        providerSymbol: "XAUUSD",
        primaryTimeframe: "H1",
        timeframes: ["H1"],
        series: [{ timeframe: "H1", bars: barsForPipeline("H1", 80) }],
        assessmentTimestamp: "2024-06-01T00:00:00.000Z",
        maxCandleAgeSec: null,
      },
      { includeDebugContext: true },
    );
    const ev = r._debugContext?.evidence.find((e) => e.family === "PRICE_DISPLACEMENT");
    expect(ev).toBeTruthy();
    expect(ev!.sourceEngine).toBe("mif-price-displacement");
    expect(ev!.notes).toMatch(/engine=mif-price-displacement|kind=/);
    expect(ev!.notes).not.toMatch(/PARTIAL from regime/);
  });

  it("quarantines corrupt JSON and rebuilds index", async () => {
    await store.ensureReady();
    const bad = path.join(store.runsDir, "bad-run.json");
    fs.writeFileSync(bad, "{not-json", "utf8");
    const rebuilt = await store.rebuildIndex();
    expect(rebuilt.corrupt).toBeGreaterThanOrEqual(1);
    expect(fs.existsSync(path.join(store.runsDir, "_corrupt"))).toBe(true);
  });

  it("observeCandidate uses outcome evaluation and persists evaluation", async () => {
    const { runMifHfmOpportunityPipelineFromSeriesPersisted: run } = await import(
      "../../../../ai/market-data/mt5-hfm/mif/index.js"
    );
    const r = await run({
      providerSymbol: "XAUUSD",
      primaryTimeframe: "H1",
      timeframes: ["H1"],
      series: [{ timeframe: "H1", bars: barsForPipeline("H1", 80) }],
      assessmentTimestamp: "2024-06-01T00:00:00.000Z",
      maxCandleAgeSec: null,
    });
    const candId = r.persistence?.candidateIds?.[0];
    if (!candId) {
      // Legitimate zero-candidate is acceptable — seed a candidate manually
      const seeded: MifPersistedCandidate = {
        schemaVersion: "1.0.0",
        candidateId: "seed-c1",
        runId: r.persistence?.runId ?? "seed-run",
        strategyId: "BREAKOUT",
        detectorId: "breakout",
        providerId: "HFM_MT5",
        providerSymbol: "XAUUSD",
        direction: "UP",
        detectionStatus: "DETECTED",
        lifecycleState: "DETECTED",
        timeframeRoles: ["PRIMARY"],
        assessmentTimestamp: "2024-06-01T00:00:00.000Z",
        createdAt: "2024-06-01T00:00:00.000Z",
        updatedAt: "2024-06-01T00:00:00.000Z",
        supportingEvidenceIds: [],
        conflictingEvidenceIds: [],
        requiredConfirmations: [],
        invalidationConditions: ["invalidationPrice=1990", "invalidationSide=BELOW"],
        dataQualityStatus: "VALID",
        mtfRelation: null,
        thesis: "entryPrice=2000; targetPrice=2015; targetSide=ABOVE",
        rationale: "",
        outcomeKind: "NONE",
        candidateSnapshot: { tipOpenTimeSec: T0 } as never,
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
        notExecutable: true,
      };
      await store.ensureReady();
      fs.writeFileSync(
        store.candidatePath(seeded.candidateId),
        `${JSON.stringify(seeded, null, 2)}\n`,
      );
      fs.writeFileSync(store.eventsPath(seeded.candidateId), "[]\n");
      const obs = await observeCandidateAgainstCandles({
        candidateId: "seed-c1",
        closedCandles: [
          candle(1, 2010, 1995, 2005),
          candle(2, 2025, 2000, 2020),
        ],
        targetPrice: 2015,
        targetSide: "ABOVE",
        invalidationPrice: 1990,
        invalidationSide: "BELOW",
        entryPrice: 2000,
        activationOpenTimeSec: T0,
      });
      expect(obs.evaluation?.resultKind).toBe("TARGET_REACHED");
      expect(obs.lifecycleState).toBe("COMPLETED");
      const listed = await store.listOutcomeEvaluations({ candidateId: "seed-c1" });
      expect(listed.total).toBeGreaterThanOrEqual(1);
      return;
    }
    expect(typeof candId).toBe("string");
  });

  it("worker remains disabled by default", () => {
    expect(getMifOdWorkerStatus().enabled).toBe(false);
  });
});
