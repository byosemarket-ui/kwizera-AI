/**
 * Phase 5F STEP 4 — Backtesting & Walk-Forward (weekend-safe).
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  MifBacktestStorage,
  MifHistoricalResearchStorage,
  __setMifBacktestStorageForTests,
  __setMifHistoricalResearchStorageForTests,
  applyEmbargo,
  applyPurge,
  filterBarsClosedAtDecision,
  isBarClosedAtDecision,
  planRollingWalkForward,
  resolveDecisionTimeSec,
  runMifBacktest,
  sealResearchDataset,
  toStoredResearchBar,
  type MifResearchStoredBar,
} from "../../../../ai/market-data/mt5-hfm/mif/index";

const T0 = 1_700_000_000;
const H1 = 3600;
const H4 = 14400;

function makeRaw(i: number, step = H1, close = 100 + i * 0.05) {
  return {
    time: T0 + i * step,
    open: close - 0.02,
    high: close + 0.05,
    low: close - 0.05,
    close,
    tickVolume: 10,
    realVolume: null as number | null,
    spread: 12 as number | null,
    validationStatus: "ok" as const,
    provenance: "native" as const,
  };
}

function toStored(bars: ReturnType<typeof makeRaw>[]): MifResearchStoredBar[] {
  return bars.map((b) => toStoredResearchBar(b));
}

async function sealComplete(
  store: MifHistoricalResearchStorage,
  instrument: string,
  timeframe: string,
  bars: MifResearchStoredBar[],
) {
  return sealResearchDataset(store, {
    instrument,
    timeframe,
    bars,
    rejectedCandles: 0,
    duplicateOrOutOfOrderRejected: 0,
    invalidOhlcRejected: 0,
    incompleteExportRange: false,
    inclusionRules: {
      providerMustBe: "HFM_MT5",
      timeframeMustBeOperationallyExportable: true,
      rejectInvalidOhlc: true,
      rejectDuplicateOrOutOfOrder: true,
      synthesizeCandles: false,
      interpolateGaps: false,
      repairSilently: false,
      allowOtherProviders: false,
      requestedStartTimeSec: null,
      requestedEndTimeSec: null,
      maxBars: 10000,
      maxPages: 40,
    },
    exportProvenance: {
      exportJobId: `job:${instrument}:${timeframe}:s4`,
      pagesFetched: 1,
      lastStartPos: 0,
      nextStartPos: null,
      requestedCountPerPage: 300,
      returnedBarTotal: bars.length,
      hasMoreAtStop: false,
      incompleteReason: null,
      sourceFreshnessNotes: ["TEST"],
      fetchErrors: [],
    },
  });
}

describe("Phase 5F STEP 4 — MTF closure / look-ahead", () => {
  it("excludes HTF candle that opened before tip but closes after decision", () => {
    const tipOpen = T0 + 10 * H1;
    const decision = resolveDecisionTimeSec({
      tipOpenTimeSec: tipOpen,
      primaryTimeframe: "H1",
    });
    expect(decision.ok).toBe(true);
    if (!decision.ok) return;
    // H4 bar opened 2h before tip, closes 2h after tip open → still forming at tip close if tip mid-H4
    const h4Open = tipOpen - 2 * H1;
    const check = isBarClosedAtDecision({
      openTimeSec: h4Open,
      timeframe: "H4",
      decisionTimeSec: decision.decisionTimeSec,
    });
    // h4 close = h4Open + 14400; tip close = tipOpen + 3600
    // if h4Open = tipOpen - 7200, close = tipOpen + 7200 > tipOpen + 3600 → forming
    expect(check.visible).toBe(false);
    if (!check.visible) expect(check.reason).toBe("STILL_FORMING_AT_DECISION");
  });

  it("accepts HTF candle closed exactly at decision boundary", () => {
    const tipOpen = T0 + 10 * H1;
    const decision = resolveDecisionTimeSec({
      tipOpenTimeSec: tipOpen,
      primaryTimeframe: "H1",
    });
    expect(decision.ok).toBe(true);
    if (!decision.ok) return;
    // H1 tip itself closes at decision
    const tip = isBarClosedAtDecision({
      openTimeSec: tipOpen,
      timeframe: "H1",
      decisionTimeSec: decision.decisionTimeSec,
    });
    expect(tip.visible).toBe(true);
  });

  it("rejects candle that closes after decision tip and future injection", () => {
    const tipOpen = T0 + 5 * H1;
    const decision = resolveDecisionTimeSec({
      tipOpenTimeSec: tipOpen,
      primaryTimeframe: "H1",
    });
    expect(decision.ok).toBe(true);
    if (!decision.ok) return;
    const future = isBarClosedAtDecision({
      openTimeSec: tipOpen + H1,
      timeframe: "H1",
      decisionTimeSec: decision.decisionTimeSec,
    });
    expect(future.visible).toBe(false);

    const filtered = filterBarsClosedAtDecision({
      bars: [
        makeRaw(0),
        makeRaw(5),
        { ...makeRaw(6), time: tipOpen + H1 },
      ],
      timeframe: "H1",
      decisionTimeSec: decision.decisionTimeSec,
    });
    expect(filtered.visible.every((b) => b.time + H1 <= decision.decisionTimeSec)).toBe(true);
  });

  it("excludes all bars when timeframe duration unknown", () => {
    const filtered = filterBarsClosedAtDecision({
      bars: [makeRaw(0)],
      timeframe: "MN1",
      decisionTimeSec: T0 + 86400,
    });
    expect(filtered.visible).toHaveLength(0);
    expect(filtered.limitation).toMatch(/duration unknown/i);
  });
});

describe("Phase 5F STEP 4 — purge / embargo / walk-forward plan", () => {
  it("purges overlapping observations and applies embargo boundaries", () => {
    const tipIndices = [40, 41, 42, 50, 51, 60];
    const opens = tipIndices.map((i) => T0 + i * H1);
    const purged = applyPurge({
      tipIndices,
      tipOpenTimes: opens,
      nextIntervalStartIndex: 50,
      horizonBars: 8,
    });
    // tip 42 + 8 = 50 → overlaps; tip 41 + 8 = 49 < 50 keep; tip 42 overlaps
    expect(purged.excluded.some((e) => e.tipIndex === 42)).toBe(true);
    expect(purged.keptIndices.includes(40)).toBe(true);

    const emb = applyEmbargo({
      tipIndices: [50, 51, 55, 60],
      tipOpenTimes: [50, 51, 55, 60].map((i) => T0 + i * H1),
      intervalStartIndex: 50,
      embargoBars: 4,
    });
    expect(emb.keptIndices.every((i) => i >= 54)).toBe(true);
    expect(emb.excluded.some((e) => e.reason.startsWith("EMBARGO"))).toBe(true);
  });

  it("plans rolling folds with IS/VAL/OOS separation", () => {
    const plan = planRollingWalkForward({
      barCount: 200,
      warmupBars: 40,
      maxFolds: 3,
      maxHorizonBars: 16,
      timeframe: "H1",
      useValidation: true,
    });
    expect(plan.folds.length).toBeGreaterThan(0);
    for (const f of plan.folds) {
      expect(f.isEndIndex).toBeLessThanOrEqual(f.oosStartIndex);
      if (f.valStartIndex != null && f.valEndIndex != null) {
        expect(f.valStartIndex).toBe(f.isEndIndex);
        expect(f.valEndIndex).toBe(f.oosStartIndex);
      }
      expect(f.oosEndIndex).toBeGreaterThan(f.oosStartIndex);
      expect(f.embargoBars).toBeGreaterThanOrEqual(16);
    }
  });
});

describe("Phase 5F STEP 4 — backtest run persistence & cost honesty", () => {
  let tmp: string;
  let research: MifHistoricalResearchStorage;
  let backtests: MifBacktestStorage;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mif-bt-"));
    research = new MifHistoricalResearchStorage(tmp);
    backtests = new MifBacktestStorage(tmp);
    __setMifHistoricalResearchStorageForTests(research);
    __setMifBacktestStorageForTests(backtests);
  });

  afterEach(() => {
    __setMifHistoricalResearchStorageForTests(null);
    __setMifBacktestStorageForTests(null);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("runs bounded SINGLE_WINDOW backtest with costAdjusted=false and immutable persist", async () => {
    const bars = toStored(Array.from({ length: 120 }, (_, i) => makeRaw(i)));
    const sealed = await sealComplete(research, "EURUSD", "H1", bars);
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;

    const result = await runMifBacktest({
      researchStorage: research,
      backtestStorage: backtests,
      datasetId: sealed.manifest.datasetId,
      version: sealed.manifest.version,
      expectedContentHash: sealed.manifest.contentHash,
      mode: "SINGLE_WINDOW",
      warmupBars: 40,
      maxSteps: 15,
      stepBars: 2,
      timeoutMs: 60_000,
      persist: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const m = result.record.manifest;
    expect(m.costAdjusted).toBe(false);
    expect(m.placesOrders).toBe(false);
    expect(m.mutatesBroker).toBe(false);
    expect(m.acceptsForExecution).toBe(false);
    expect(m.isNotCalibratedProbability).toBe(true);
    expect(m.executionModelId).toBe("GROSS_OHLC_ANALYTICAL");
    expect(m.mtfClosureFilterApplied).toBe(true);
    expect(m.costAvailability.suitableForCostAdjustedBacktest).toBe(false);
    expect(m.costAvailability.slippage).toBe("UNAVAILABLE");
    expect(m.aggregateMetrics.sharpe.availability).toBe("UNSUPPORTED");
    expect(JSON.stringify(m)).not.toMatch(/"costAdjusted":\s*true/);

    const again = await runMifBacktest({
      researchStorage: research,
      backtestStorage: backtests,
      datasetId: sealed.manifest.datasetId,
      version: sealed.manifest.version,
      expectedContentHash: sealed.manifest.contentHash,
      mode: "SINGLE_WINDOW",
      warmupBars: 40,
      maxSteps: 15,
      stepBars: 2,
      persist: true,
    });
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    // Idempotent same hash
    expect(again.record.manifest.runId).toBe(m.runId);
  }, 120_000);

  it("walk-forward reports INSUFFICIENT_SAMPLE without lowering threshold", async () => {
    const bars = toStored(Array.from({ length: 100 }, (_, i) => makeRaw(i)));
    const sealed = await sealComplete(research, "GBPUSD", "H1", bars);
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;

    const result = await runMifBacktest({
      researchStorage: research,
      backtestStorage: backtests,
      datasetId: sealed.manifest.datasetId,
      version: sealed.manifest.version,
      mode: "WALK_FORWARD",
      warmupBars: 40,
      maxSteps: 40,
      maxFolds: 2,
      minOosSamples: 30,
      timeoutMs: 60_000,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // With shallow history / few OD candidates, folds often insufficient — must not invent success
    for (const f of result.record.manifest.folds) {
      if (f.status === "INSUFFICIENT_SAMPLE") {
        expect(f.decisiveOosSamples).toBeLessThan(f.minOosSamplesRequired);
        expect(f.failureReason).toMatch(/decisiveOos/);
      }
      expect(f.minOosSamplesRequired).toBe(30);
    }
    expect(result.record.manifest.costAdjusted).toBe(false);
  }, 120_000);
});
