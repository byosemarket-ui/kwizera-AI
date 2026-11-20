/**
 * Phase 5F STEP 3 — Prediction Outcome & Historical Performance Engine.
 * Weekend-safe: synthetic fixtures + optional COMPLETE archive smoke.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  MifHistoricalResearchStorage,
  MifPredictionOutcomeStorage,
  __setMifHistoricalResearchStorageForTests,
  __setMifPredictionOutcomeStorageForTests,
  aggregatePredictionPerformance,
  buildPredictionSnapshot,
  computeDirectionalPathMetrics,
  computePredictionId,
  evaluatePredictionAgainstHistoricalArchive,
  evaluatePredictionAgainstLiveCopyRates,
  evaluatePredictionOutcome,
  isAuthoritativelyClosed,
  loadLiveCopyRatesForOutcome,
  selectFutureBarsAfterActivation,
  selectLatestOutcomesByPrediction,
  sealResearchDataset,
  toStoredResearchBar,
  type MifCanonicalCandle,
  type MifPredictionOutcomeRecord,
  type MifResearchStoredBar,
} from "../../../../ai/market-data/mt5-hfm/mif/index";
import { baseCanonicalCandle, deriveCloseTimeSec } from "../../../../ai/market-data/mt5-hfm/mif/canonical/candle";

const T0 = 1_700_000_000;
const STEP = 3600; // H1

function makeRaw(i: number, close = 100 + i * 0.1, opts?: { high?: number; low?: number }) {
  const c = close;
  return {
    time: T0 + i * STEP,
    open: c - 0.05,
    high: opts?.high ?? c + 0.1,
    low: opts?.low ?? c - 0.1,
    close: c,
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

function candle(
  i: number,
  close: number,
  extras?: Partial<MifCanonicalCandle> & { high?: number; low?: number },
): MifCanonicalCandle {
  const openTimeSec = T0 + i * STEP;
  return baseCanonicalCandle({
    providerSymbol: "EURUSD",
    timeframe: "H1",
    openTimeSec,
    closeTimeSec: deriveCloseTimeSec(openTimeSec, "H1"),
    open: close - 0.05,
    high: extras?.high ?? close + 0.1,
    low: extras?.low ?? close - 0.1,
    close,
    tickVolume: 10,
    realVolume: null,
    collapsedVolume: null,
    volumeType: "tick",
    spread: 12,
    candleState: extras?.candleState ?? "CLOSED",
    priceBasis: "unspecified",
    timebase: "BROKER_SERVER",
    timezoneOffsetSec: null,
    brokerTimestampSec: openTimeSec,
    receivedAt: null,
    availableAt: null,
    availabilityStatus: "UNKNOWN",
    sourceDialect: "hfm.historical-bar",
    sourceProvenance: "test",
    sourceMode: "TEST",
    sourceDataQuality: "ok",
    validation: { status: "ok", errors: [], warnings: [] },
    instrument: null,
  });
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
      exportJobId: `job:${instrument}:${timeframe}:step3`,
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

describe("Phase 5F STEP 3 — prediction identity & snapshot", () => {
  it("computes deterministic predictionId", () => {
    const a = computePredictionId({
      candidateId: "cand-1",
      reasoningRunId: "run-A",
      analysisRunId: null,
      evaluationId: null,
      activationOpenTimeSec: T0 + 10 * STEP,
      instrument: "EURUSD",
      timeframe: "H1",
      direction: "BUY",
      snapshotPolicyVersion: "1.0.0",
    });
    const b = computePredictionId({
      candidateId: "cand-1",
      reasoningRunId: "run-A",
      analysisRunId: null,
      evaluationId: null,
      activationOpenTimeSec: T0 + 10 * STEP,
      instrument: "EURUSD",
      timeframe: "H1",
      direction: "BUY",
      snapshotPolicyVersion: "1.0.0",
    });
    expect(a).toBe(b);
    expect(a.startsWith("pred:")).toBe(true);
  });

  it("differentiates same candidate across separate reasoning runs", () => {
    const a = computePredictionId({
      candidateId: "cand-1",
      reasoningRunId: "run-A",
      analysisRunId: null,
      evaluationId: null,
      activationOpenTimeSec: T0,
      instrument: "EURUSD",
      timeframe: "H1",
      direction: "BUY",
      snapshotPolicyVersion: "1.0.0",
    });
    const b = computePredictionId({
      candidateId: "cand-1",
      reasoningRunId: "run-B",
      analysisRunId: null,
      evaluationId: null,
      activationOpenTimeSec: T0,
      instrument: "EURUSD",
      timeframe: "H1",
      direction: "BUY",
      snapshotPolicyVersion: "1.0.0",
    });
    expect(a).not.toBe(b);
  });

  it("rejects missing activation cutoff without substituting now()", () => {
    const snap = buildPredictionSnapshot({
      candidateId: "cand-1",
      instrument: "EURUSD",
      timeframe: "H1",
      direction: "BUY",
      activationOpenTimeSec: null,
    });
    expect(snap.status).toBe("INVALID_INSUFFICIENT");
    expect(snap.invalidReason).toMatch(/MISSING_ACTIVATION_CUTOFF/);
  });

  it("preserves missing levels and parses legacy notes at boundary", () => {
    const snap = buildPredictionSnapshot({
      candidateId: "cand-1",
      instrument: "EURUSD",
      timeframe: "H1",
      direction: "BUY",
      activationOpenTimeSec: T0,
      invalidationConditions: ["entryPrice=1.1000", "targetPrice=1.1200", "invalidationPrice=1.0900"],
    });
    expect(snap.status).toBe("FROZEN");
    expect(snap.levels.entry.price).toBe(1.1);
    expect(snap.levels.target.price).toBe(1.12);
    expect(snap.levels.invalidation.price).toBe(1.09);
    expect(snap.levels.target.side).toBe("ABOVE");
    expect(snap.levels.invalidation.side).toBe("BELOW");
    expect(snap.levels.parseProvenance).toBe("LEGACY_NOTES_PARSE");
    expect(snap.levels.originalEvidence.length).toBeGreaterThan(0);
  });

  it("keeps missing levels explicitly missing when absent", () => {
    const snap = buildPredictionSnapshot({
      candidateId: "cand-1",
      instrument: "EURUSD",
      timeframe: "H1",
      direction: "BUY",
      activationOpenTimeSec: T0,
    });
    expect(snap.levels.entry.present).toBe(false);
    expect(snap.levels.target.present).toBe(false);
    expect(snap.levels.invalidation.present).toBe(false);
    expect(snap.levels.parseProvenance).toBe("MISSING");
  });
});

describe("Phase 5F STEP 3 — path metrics BUY/SELL", () => {
  it("computes BUY forward return / MFE / MAE", () => {
    const window = [
      candle(1, 101, { high: 102, low: 100.5 }),
      candle(2, 103, { high: 104, low: 101 }),
    ];
    const m = computeDirectionalPathMetrics({ direction: "BUY", entry: 100, window });
    expect(m.forwardReturn).toBeCloseTo((103 - 100) / 100, 10);
    expect(m.mfe).toBeCloseTo((104 - 100) / 100, 10);
    expect(m.mae).toBeCloseTo((100.5 - 100) / 100, 10);
  });

  it("computes SELL forward return / MFE / MAE", () => {
    const window = [
      candle(1, 99, { high: 99.5, low: 98 }),
      candle(2, 97, { high: 98, low: 96 }),
    ];
    const m = computeDirectionalPathMetrics({ direction: "SELL", entry: 100, window });
    expect(m.forwardReturn).toBeCloseTo((100 - 97) / 100, 10);
    expect(m.mfe).toBeCloseTo((100 - 96) / 100, 10);
    expect(m.mae).toBeCloseTo((100 - 99.5) / 100, 10);
  });

  it("does not evaluate NEUTRAL as BUY", () => {
    const snap = buildPredictionSnapshot({
      candidateId: "n1",
      instrument: "EURUSD",
      timeframe: "H1",
      direction: "NEUTRAL",
      activationOpenTimeSec: T0,
      entryPrice: 100,
    });
    const future = [candle(1, 101), candle(2, 102), candle(3, 103), candle(4, 104)];
    const ev = evaluatePredictionOutcome({
      snapshot: snap,
      futureClosedCandles: future,
      activationClose: 100,
      marketSourceMode: "HISTORICAL_ARCHIVE",
      marketProvenance: {
        mode: "HISTORICAL_ARCHIVE",
        providerId: "HFM_MT5",
        datasetId: "x",
        datasetVersion: 1,
        contentHash: "abc",
      },
      dataQuality: {
        closedOnly: true,
        activationExcluded: true,
        gapDetected: false,
        gapFlags: [],
        duplicateBarsRejected: 0,
        outOfOrderRejected: 0,
        formingRejected: 0,
        staleRejected: 0,
        closureUnverifiedRejected: 0,
        missingIntervals: [],
        tipClipped: false,
        futureBarsExcluded: 0,
      },
      horizons: [4],
    });
    expect(ev.ok).toBe(true);
    if (!ev.ok) return;
    expect(ev.outcome.pathOutcome.unsupportedReason).toMatch(/NEUTRAL/);
    expect(ev.outcome.pathOutcome.horizons[0]!.completeness).toBe("UNSUPPORTED_DIRECTION");
    expect(ev.outcome.pathOutcome.horizons[0]!.forwardReturn).toBeNull();
  });
});

describe("Phase 5F STEP 3 — closed candle & activation cutoff", () => {
  it("excludes activation candle from future measurements", () => {
    const bars = [candle(0, 100), candle(1, 101), candle(2, 102)];
    const { future, activationCandle } = selectFutureBarsAfterActivation(bars, T0);
    expect(activationCandle?.openTimeSec).toBe(T0);
    expect(future.every((c) => c.openTimeSec > T0)).toBe(true);
    expect(future).toHaveLength(2);
  });

  it("rejects forming candles even if labeled oddly", () => {
    const forming = candle(1, 100, { candleState: "FORMING" });
    const check = isAuthoritativelyClosed(forming, { brokerNowSec: T0 + 10 * STEP });
    expect(check.ok).toBe(false);
  });

  it("rejects evaluation when future bars leak activation", () => {
    const snap = buildPredictionSnapshot({
      candidateId: "leak",
      instrument: "EURUSD",
      timeframe: "H1",
      direction: "BUY",
      activationOpenTimeSec: T0 + STEP,
      entryPrice: 100,
    });
    const ev = evaluatePredictionOutcome({
      snapshot: snap,
      futureClosedCandles: [candle(1, 100), candle(2, 101)],
      activationClose: 100,
      marketSourceMode: "HISTORICAL_ARCHIVE",
      marketProvenance: {
        mode: "HISTORICAL_ARCHIVE",
        providerId: "HFM_MT5",
        datasetId: "x",
        datasetVersion: 1,
        contentHash: "abc",
      },
      dataQuality: {
        closedOnly: true,
        activationExcluded: true,
        gapDetected: false,
        gapFlags: [],
        duplicateBarsRejected: 0,
        outOfOrderRejected: 0,
        formingRejected: 0,
        staleRejected: 0,
        closureUnverifiedRejected: 0,
        missingIntervals: [],
        tipClipped: false,
        futureBarsExcluded: 0,
      },
    });
    expect(ev.ok).toBe(false);
    if (ev.ok) return;
    expect(ev.code).toBe("ACTIVATION_LEAKAGE");
  });
});

describe("Phase 5F STEP 3 — level outcomes & ambiguity", () => {
  it("reports TARGET_REACHED / INVALIDATION_REACHED / BOTH_AMBIGUOUS_SAME_CANDLE", () => {
    const snap = buildPredictionSnapshot({
      candidateId: "lvl",
      instrument: "EURUSD",
      timeframe: "H1",
      direction: "BUY",
      activationOpenTimeSec: T0,
      entryPrice: 100,
      targetPrice: 102,
      targetSide: "ABOVE",
      invalidationPrice: 99,
      invalidationSide: "BELOW",
    });
    const targetHit = evaluatePredictionOutcome({
      snapshot: snap,
      futureClosedCandles: [
        candle(1, 100.5, { high: 101, low: 100 }),
        candle(2, 102.5, { high: 103, low: 101 }),
      ],
      activationClose: 100,
      marketSourceMode: "HISTORICAL_ARCHIVE",
      marketProvenance: {
        mode: "HISTORICAL_ARCHIVE",
        providerId: "HFM_MT5",
        datasetId: "x",
        datasetVersion: 1,
        contentHash: "abc",
      },
      dataQuality: {
        closedOnly: true,
        activationExcluded: true,
        gapDetected: false,
        gapFlags: [],
        duplicateBarsRejected: 0,
        outOfOrderRejected: 0,
        formingRejected: 0,
        staleRejected: 0,
        closureUnverifiedRejected: 0,
        missingIntervals: [],
        tipClipped: false,
        futureBarsExcluded: 0,
      },
      horizons: [4],
    });
    expect(targetHit.ok).toBe(true);
    if (!targetHit.ok) return;
    expect(targetHit.outcome.levelOutcome.resultKind).toBe("TARGET_REACHED");
    // Path positive does not auto-mean target — but here both agree; fields remain distinct.
    expect(targetHit.outcome.pathOutcome).toBeDefined();
    expect(targetHit.outcome.levelOutcome).toBeDefined();

    const ambiguous = evaluatePredictionOutcome({
      snapshot: snap,
      futureClosedCandles: [candle(1, 100, { high: 103, low: 98 })],
      activationClose: 100,
      marketSourceMode: "HISTORICAL_ARCHIVE",
      marketProvenance: {
        mode: "HISTORICAL_ARCHIVE",
        providerId: "HFM_MT5",
        datasetId: "x",
        datasetVersion: 1,
        contentHash: "abc",
      },
      dataQuality: {
        closedOnly: true,
        activationExcluded: true,
        gapDetected: false,
        gapFlags: [],
        duplicateBarsRejected: 0,
        outOfOrderRejected: 0,
        formingRejected: 0,
        staleRejected: 0,
        closureUnverifiedRejected: 0,
        missingIntervals: [],
        tipClipped: false,
        futureBarsExcluded: 0,
      },
      horizons: [4],
    });
    expect(ambiguous.ok).toBe(true);
    if (!ambiguous.ok) return;
    expect(ambiguous.outcome.levelOutcome.resultKind).toBe("BOTH_AMBIGUOUS_SAME_CANDLE");
  });

  it("marks PARTIAL vs INSUFFICIENT horizons", () => {
    const snap = buildPredictionSnapshot({
      candidateId: "hz",
      instrument: "EURUSD",
      timeframe: "H1",
      direction: "BUY",
      activationOpenTimeSec: T0,
      entryPrice: 100,
    });
    const ev = evaluatePredictionOutcome({
      snapshot: snap,
      futureClosedCandles: [candle(1, 101), candle(2, 102)],
      activationClose: 100,
      marketSourceMode: "HISTORICAL_ARCHIVE",
      marketProvenance: {
        mode: "HISTORICAL_ARCHIVE",
        providerId: "HFM_MT5",
        datasetId: "x",
        datasetVersion: 1,
        contentHash: "abc",
      },
      dataQuality: {
        closedOnly: true,
        activationExcluded: true,
        gapDetected: false,
        gapFlags: [],
        duplicateBarsRejected: 0,
        outOfOrderRejected: 0,
        formingRejected: 0,
        staleRejected: 0,
        closureUnverifiedRejected: 0,
        missingIntervals: [],
        tipClipped: false,
        futureBarsExcluded: 0,
      },
      horizons: [4, 8],
    });
    expect(ev.ok).toBe(true);
    if (!ev.ok) return;
    expect(ev.outcome.pathOutcome.horizons[0]!.completeness).toBe("PARTIAL");
    expect(ev.outcome.pathOutcome.horizons[1]!.completeness).toBe("PARTIAL");
    expect(ev.outcome.completeness).toBe("PARTIAL");
  });
});

describe("Phase 5F STEP 3 — live adapter contract (mocked)", () => {
  it("accepts HFM_MT5 closed CopyRates and rejects forming", () => {
    const brokerNow = T0 + 20 * STEP;
    const ok = loadLiveCopyRatesForOutcome({
      instrument: "EURUSD",
      timeframe: "H1",
      activationOpenTimeSec: T0 + 5 * STEP,
      brokerNowSec: brokerNow,
      snapshotId: "snap-1",
      sequenceId: "seq-1",
      bars: [
        { time: T0 + 5 * STEP, open: 100, high: 100.2, low: 99.8, close: 100.1, isClosed: true },
        { time: T0 + 6 * STEP, open: 100.1, high: 100.5, low: 100, close: 100.4, isClosed: true },
        { time: T0 + 7 * STEP, open: 100.4, high: 100.6, low: 100.2, close: 100.5, isClosed: true },
        {
          time: T0 + 19 * STEP,
          open: 101,
          high: 101.1,
          low: 100.9,
          close: 101,
          isClosed: false,
          candleState: "FORMING",
        },
      ],
    });
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(ok.provenance.mode).toBe("LIVE_COPYRATES");
    expect(ok.provenance.snapshotId).toBe("snap-1");
    expect(ok.provenance.sequenceId).toBe("seq-1");
    expect(ok.dataQuality.formingRejected).toBeGreaterThan(0);
    expect(ok.futureClosed.every((c) => c.openTimeSec > T0 + 5 * STEP)).toBe(true);
  });

  it("rejects missing brokerNowSec", () => {
    const bad = loadLiveCopyRatesForOutcome({
      instrument: "EURUSD",
      timeframe: "H1",
      activationOpenTimeSec: T0,
      brokerNowSec: NaN,
      bars: [{ time: T0 + STEP, open: 1, high: 1.1, low: 0.9, close: 1, isClosed: true }],
    });
    expect(bad.ok).toBe(false);
  });
});

describe("Phase 5F STEP 3 — persistence & performance", () => {
  let tmp: string;
  let research: MifHistoricalResearchStorage;
  let outcomes: MifPredictionOutcomeStorage;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mif-po-"));
    research = new MifHistoricalResearchStorage(tmp);
    outcomes = new MifPredictionOutcomeStorage(tmp);
    __setMifHistoricalResearchStorageForTests(research);
    __setMifPredictionOutcomeStorageForTests(outcomes);
  });

  afterEach(() => {
    __setMifHistoricalResearchStorageForTests(null);
    __setMifPredictionOutcomeStorageForTests(null);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("persists immutable snapshot and idempotent outcomes; revisions dedupe in performance", async () => {
    const bars = toStored(Array.from({ length: 40 }, (_, i) => makeRaw(i)));
    const sealed = await sealComplete(research, "EURUSD", "H1", bars);
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;

    const snap = buildPredictionSnapshot({
      candidateId: "hist-1",
      reasoningRunId: "rr-1",
      instrument: "EURUSD",
      timeframe: "H1",
      direction: "BUY",
      activationOpenTimeSec: T0 + 10 * STEP,
      entryPrice: 100 + 10 * 0.1,
      targetPrice: 100 + 20 * 0.1,
      targetSide: "ABOVE",
      invalidationPrice: 100 + 5 * 0.1,
      invalidationSide: "BELOW",
      modelVersion: "m1",
      strategyVersion: "s1",
    });
    expect(snap.status).toBe("FROZEN");

    const p1 = await outcomes.persistSnapshot(snap);
    expect(p1.ok).toBe(true);
    const p2 = await outcomes.persistSnapshot(snap);
    expect(p2.ok).toBe(true);
    if (p2.ok) expect(p2.created).toBe(false);

    const mutated = { ...snap, snapshotHash: "tampered" };
    const conflict = await outcomes.persistSnapshot(mutated);
    expect(conflict.ok).toBe(false);

    const r1 = await evaluatePredictionAgainstHistoricalArchive({
      snapshot: snap,
      researchStorage: research,
      outcomeStorage: outcomes,
      datasetId: sealed.manifest.datasetId,
      version: sealed.manifest.version,
      horizons: [4, 8],
    });
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;

    // Idempotent re-eval same candle range
    const r1b = await evaluatePredictionAgainstHistoricalArchive({
      snapshot: snap,
      researchStorage: research,
      outcomeStorage: outcomes,
      datasetId: sealed.manifest.datasetId,
      version: sealed.manifest.version,
      horizons: [4, 8],
    });
    expect(r1b.ok).toBe(true);

    // New revision with fewer future bars → different candleRangeHash
    const shortFuture = r1.outcome.evaluatedCandleRange.barCount;
    expect(shortFuture).toBeGreaterThan(0);

    // Simulate second outcome with different hash by evaluating live subset
    const live = await evaluatePredictionAgainstLiveCopyRates({
      snapshot: snap,
      outcomeStorage: outcomes,
      brokerNowSec: T0 + 40 * STEP,
      sourceProvenance: "copyrates-test",
      snapshotId: "s1",
      sequenceId: "q1",
      horizons: [4],
      bars: Array.from({ length: 20 }, (_, i) => {
        const raw = makeRaw(i);
        return {
          time: raw.time,
          open: raw.open,
          high: raw.high,
          low: raw.low,
          close: raw.close,
          isClosed: true,
        };
      }),
    });
    expect(live.ok).toBe(true);

    const listed = await outcomes.listOutcomesForPrediction(snap.predictionId);
    expect(listed.length).toBeGreaterThanOrEqual(1);

    const summary = await aggregatePredictionPerformance({
      storage: outcomes,
      groupKey: { instrument: "EURUSD", timeframe: "H1", direction: "BUY" },
    });
    expect(summary.totalUniquePredictions).toBe(1);
    expect(summary.isNotCalibratedProbability).toBe(true);
    expect(summary.warnings.isNotCalibratedProbability).toBe(true);
    expect(summary.note).not.toMatch(/calibrated probability/i);
    expect(JSON.stringify(summary)).not.toMatch(/"calibratedProbability"/);

    const latestOnly = selectLatestOutcomesByPrediction(listed);
    expect(latestOnly).toHaveLength(1);
  });

  it("rejects INCOMPLETE datasets for authoritative historical evaluation", async () => {
    const bars = toStored(Array.from({ length: 20 }, (_, i) => makeRaw(i)));
    const sealed = await sealResearchDataset(research, {
      instrument: "GBPUSD",
      timeframe: "H1",
      bars,
      rejectedCandles: 0,
      duplicateOrOutOfOrderRejected: 0,
      invalidOhlcRejected: 0,
      incompleteExportRange: true,
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
        exportJobId: "job-incomplete",
        pagesFetched: 1,
        lastStartPos: 0,
        nextStartPos: 20,
        requestedCountPerPage: 300,
        returnedBarTotal: bars.length,
        hasMoreAtStop: true,
        incompleteReason: "TEST_INCOMPLETE",
        sourceFreshnessNotes: ["TEST"],
        fetchErrors: [],
      },
    });
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    expect(sealed.manifest.status).toBe("INCOMPLETE");

    const snap = buildPredictionSnapshot({
      candidateId: "inc",
      instrument: "GBPUSD",
      timeframe: "H1",
      direction: "BUY",
      activationOpenTimeSec: T0 + 5 * STEP,
    });
    const r = await evaluatePredictionAgainstHistoricalArchive({
      snapshot: snap,
      researchStorage: research,
      outcomeStorage: outcomes,
      datasetId: sealed.manifest.datasetId,
      version: sealed.manifest.version,
      persist: false,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe("INCOMPLETE_DATASET");
  });

  it("future candle mutation cannot change a prior persisted outcome identity", async () => {
    const bars = toStored(Array.from({ length: 30 }, (_, i) => makeRaw(i)));
    const sealed = await sealComplete(research, "USDJPY", "H1", bars);
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    const snap = buildPredictionSnapshot({
      candidateId: "mut",
      instrument: "USDJPY",
      timeframe: "H1",
      direction: "SELL",
      activationOpenTimeSec: T0 + 8 * STEP,
      entryPrice: 100,
    });
    const r1 = await evaluatePredictionAgainstHistoricalArchive({
      snapshot: snap,
      researchStorage: research,
      outcomeStorage: outcomes,
      datasetId: sealed.manifest.datasetId,
      version: sealed.manifest.version,
      horizons: [4],
    });
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    const id1 = r1.outcome.outcomeId;
    const hash1 = r1.outcome.candleRangeHash;

    // Re-read persisted record — unchanged
    const got = await outcomes.getOutcome(id1);
    expect(got?.candleRangeHash).toBe(hash1);

    // Different future window yields different outcomeId (revision), not overwrite
    const r2 = await evaluatePredictionAgainstLiveCopyRates({
      snapshot: snap,
      outcomeStorage: outcomes,
      brokerNowSec: T0 + 40 * STEP,
      horizons: [4],
      bars: Array.from({ length: 15 }, (_, i) => {
        const raw = makeRaw(i, 100 - i * 0.2);
        return {
          time: raw.time,
          open: raw.open,
          high: raw.high,
          low: raw.low,
          close: raw.close,
          isClosed: true,
        };
      }),
    });
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    expect(r2.outcome.outcomeId).not.toBe(id1);
    const still = await outcomes.getOutcome(id1);
    expect(still?.candleRangeHash).toBe(hash1);
  });
});

describe("Phase 5F STEP 3 — safety flags on outcomes", () => {
  it("marks analytical non-executable flags", () => {
    const snap = buildPredictionSnapshot({
      candidateId: "safe",
      instrument: "EURUSD",
      timeframe: "H1",
      direction: "BUY",
      activationOpenTimeSec: T0,
      entryPrice: 100,
    });
    expect(snap.placesOrders).toBe(false);
    expect(snap.mutatesBroker).toBe(false);
    expect(snap.acceptsForExecution).toBe(false);
    expect(snap.isNotCalibratedProbability).toBe(true);
    expect(snap.analyticalOutcomeOnly).toBe(true);
  });
});
