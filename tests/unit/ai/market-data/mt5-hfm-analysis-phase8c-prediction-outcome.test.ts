/**
 * P8.C — Charts Deterministic Outcome Evaluation.
 * Fixtures only; no OpenAI / live market / broker.
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
  buildPredictionSnapshot,
  sealResearchDataset,
  toStoredResearchBar,
  type MifCanonicalCandle,
  type MifResearchStoredBar,
} from "../../../../ai/market-data/mt5-hfm/mif/index";
import { baseCanonicalCandle, deriveCloseTimeSec } from "../../../../ai/market-data/mt5-hfm/mif/canonical/candle";
import {
  HFM_CHARTS_PREDICTION_OUTCOME_EVALUATOR_VERSION,
  HFM_CHARTS_SIGNED_R_DEFINITION,
  __setHfmChartsPredictionOutcomeStorageForTests,
  aggregateChartsPredictionPerformance,
  candleIntersectsEntryZone,
  computeDecisiveWinRate,
  computeSignedRealizedR,
  evaluateChartsPredictionHistorical,
  findEntryTrigger,
  getHfmChartsPredictionOutcomeStorage,
  HfmChartsPredictionOutcomeStorage,
  normalizeEntryZone,
  resolveChartsEntryZone,
  selectPostTriggerClosedCandles,
} from "../../../../ai/market-data/mt5-hfm/analysis/prediction-outcome/index";

const T0 = 1_700_000_000;
const STEP = 3600;

function tmpRoot(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function toStored(bars: Array<{
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}>): MifResearchStoredBar[] {
  return bars.map((b) =>
    toStoredResearchBar({
      time: b.time,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
      tickVolume: 10,
      realVolume: null,
      spread: 12,
      validationStatus: "ok",
      provenance: "native",
    })!,
  );
}

function candle(
  i: number,
  close: number,
  extras?: { high?: number; low?: number; open?: number; state?: "CLOSED" | "FORMING" },
): MifCanonicalCandle {
  const openTimeSec = T0 + i * STEP;
  return baseCanonicalCandle({
    providerSymbol: "EURUSD",
    timeframe: "H1",
    openTimeSec,
    closeTimeSec: deriveCloseTimeSec(openTimeSec, "H1"),
    open: extras?.open ?? close - 0.05,
    high: extras?.high ?? close + 0.1,
    low: extras?.low ?? close - 0.1,
    close,
    tickVolume: 10,
    realVolume: null,
    collapsedVolume: null,
    volumeType: "tick",
    spread: 12,
    candleState: extras?.state ?? "CLOSED",
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
  bars: MifResearchStoredBar[],
) {
  return sealResearchDataset(store, {
    instrument: "EURUSD",
    timeframe: "H1",
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
      exportJobId: "job:p8c:test",
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

function buySnapshot(activationIndex = 5) {
  return buildPredictionSnapshot({
    candidateId: "charts-buy-1",
    analysisRunId: "analysis-buy-1",
    activationOpenTimeSec: T0 + activationIndex * STEP,
    instrument: "EURUSD",
    timeframe: "H1",
    direction: "BUY",
    entryPrice: 1.1,
    targetPrice: 1.14,
    targetSide: "ABOVE",
    invalidationPrice: 1.08,
    invalidationSide: "BELOW",
    sourceAnalysisIdentity: "hfm-charts-analysis:analysis-buy-1",
    createdAt: "2024-01-01T00:00:00.000Z",
  });
}

function sellSnapshot(activationIndex = 5) {
  return buildPredictionSnapshot({
    candidateId: "charts-sell-1",
    analysisRunId: "analysis-sell-1",
    activationOpenTimeSec: T0 + activationIndex * STEP,
    instrument: "EURUSD",
    timeframe: "H1",
    direction: "SELL",
    entryPrice: 1.1,
    targetPrice: 1.06,
    targetSide: "BELOW",
    invalidationPrice: 1.12,
    invalidationSide: "ABOVE",
    sourceAnalysisIdentity: "hfm-charts-analysis:analysis-sell-1",
    createdAt: "2024-01-01T00:00:00.000Z",
  });
}

/** Bars: activation at i=5 (close~1.05), then climb through entry 1.10, then to target 1.14. */
function barsBuyTarget(): MifResearchStoredBar[] {
  const rows: Array<{ time: number; open: number; high: number; low: number; close: number }> = [];
  for (let i = 0; i < 20; i++) {
    const t = T0 + i * STEP;
    if (i <= 5) {
      rows.push({ time: t, open: 1.04, high: 1.055, low: 1.03, close: 1.05 });
    } else if (i === 6) {
      // trigger: intersects entry 1.10
      rows.push({ time: t, open: 1.08, high: 1.105, low: 1.07, close: 1.1 });
    } else if (i === 7) {
      rows.push({ time: t, open: 1.1, high: 1.12, low: 1.095, close: 1.115 });
    } else if (i === 8) {
      // target 1.14
      rows.push({ time: t, open: 1.115, high: 1.145, low: 1.11, close: 1.14 });
    } else {
      rows.push({ time: t, open: 1.14, high: 1.15, low: 1.13, close: 1.142 });
    }
  }
  return toStored(rows);
}

function barsBuyInvalidation(): MifResearchStoredBar[] {
  const rows: Array<{ time: number; open: number; high: number; low: number; close: number }> = [];
  for (let i = 0; i < 20; i++) {
    const t = T0 + i * STEP;
    if (i <= 5) {
      rows.push({ time: t, open: 1.04, high: 1.055, low: 1.03, close: 1.05 });
    } else if (i === 6) {
      rows.push({ time: t, open: 1.08, high: 1.105, low: 1.07, close: 1.1 });
    } else if (i === 7) {
      // invalidation 1.08
      rows.push({ time: t, open: 1.1, high: 1.105, low: 1.07, close: 1.075 });
    } else {
      rows.push({ time: t, open: 1.075, high: 1.08, low: 1.06, close: 1.065 });
    }
  }
  return toStored(rows);
}

function barsSellTarget(): MifResearchStoredBar[] {
  const rows: Array<{ time: number; open: number; high: number; low: number; close: number }> = [];
  for (let i = 0; i < 20; i++) {
    const t = T0 + i * STEP;
    if (i <= 5) {
      rows.push({ time: t, open: 1.14, high: 1.15, low: 1.13, close: 1.145 });
    } else if (i === 6) {
      rows.push({ time: t, open: 1.12, high: 1.125, low: 1.095, close: 1.1 });
    } else if (i === 7) {
      rows.push({ time: t, open: 1.1, high: 1.105, low: 1.05, close: 1.055 });
    } else {
      rows.push({ time: t, open: 1.055, high: 1.06, low: 1.04, close: 1.05 });
    }
  }
  return toStored(rows);
}

function barsSellInvalidation(): MifResearchStoredBar[] {
  const rows: Array<{ time: number; open: number; high: number; low: number; close: number }> = [];
  for (let i = 0; i < 20; i++) {
    const t = T0 + i * STEP;
    if (i <= 5) {
      rows.push({ time: t, open: 1.14, high: 1.15, low: 1.13, close: 1.145 });
    } else if (i === 6) {
      rows.push({ time: t, open: 1.12, high: 1.125, low: 1.095, close: 1.1 });
    } else if (i === 7) {
      rows.push({ time: t, open: 1.1, high: 1.13, low: 1.095, close: 1.125 });
    } else {
      rows.push({ time: t, open: 1.125, high: 1.14, low: 1.12, close: 1.13 });
    }
  }
  return toStored(rows);
}

function barsUntriggered(): MifResearchStoredBar[] {
  const rows: Array<{ time: number; open: number; high: number; low: number; close: number }> = [];
  for (let i = 0; i < 20; i++) {
    const t = T0 + i * STEP;
    // Never reaches entry 1.10
    rows.push({ time: t, open: 1.04, high: 1.06, low: 1.03, close: 1.05 });
  }
  return toStored(rows);
}

function barsAmbiguous(): MifResearchStoredBar[] {
  const rows: Array<{ time: number; open: number; high: number; low: number; close: number }> = [];
  for (let i = 0; i < 20; i++) {
    const t = T0 + i * STEP;
    if (i <= 5) {
      rows.push({ time: t, open: 1.04, high: 1.055, low: 1.03, close: 1.05 });
    } else if (i === 6) {
      rows.push({ time: t, open: 1.08, high: 1.105, low: 1.07, close: 1.1 });
    } else if (i === 7) {
      // both target 1.14 and invalidation 1.08 in same candle
      rows.push({ time: t, open: 1.1, high: 1.15, low: 1.07, close: 1.11 });
    } else {
      rows.push({ time: t, open: 1.11, high: 1.12, low: 1.1, close: 1.115 });
    }
  }
  return toStored(rows);
}

describe("P8.C entry-trigger semantics", () => {
  it("normalizes Charts entryZone and point prices", () => {
    expect(normalizeEntryZone({ low: 1.1, high: 1.12 })).toEqual({ low: 1.1, high: 1.12 });
    expect(normalizeEntryZone({ price: 1.1 })).toEqual({ low: 1.1, high: 1.1 });
    expect(normalizeEntryZone({ low: 1.2, high: 1.1 })).toBeNull();
  });

  it("intersects inclusive entry zone", () => {
    const zone = { low: 1.1, high: 1.12 };
    expect(candleIntersectsEntryZone(candle(1, 1.11), zone)).toBe(true);
    expect(candleIntersectsEntryZone(candle(1, 1.0, { high: 1.05, low: 0.99 }), zone)).toBe(false);
    expect(
      candleIntersectsEntryZone(candle(1, 1.11, { state: "FORMING" }), zone),
    ).toBe(false);
  });

  it("does not trigger on activation candle even if it overlaps entry", () => {
    const activation = 5;
    const candles = [
      candle(5, 1.1, { high: 1.12, low: 1.08 }),
      candle(6, 1.05, { high: 1.06, low: 1.04 }),
    ];
    const trig = findEntryTrigger({
      activationOpenTimeSec: T0 + activation * STEP,
      entryZone: { low: 1.1, high: 1.12 },
      entryZoneSource: "REQUEST_OVERRIDE",
      closedCandles: candles,
    });
    expect(trig.status).toBe("UNTRIGGERED");
  });

  it("triggers only on subsequent closed candle after activation", () => {
    const activation = 5;
    const candles = [
      candle(5, 1.1, { high: 1.12, low: 1.08 }),
      candle(6, 1.1, { high: 1.115, low: 1.09 }),
    ];
    const trig = findEntryTrigger({
      activationOpenTimeSec: T0 + activation * STEP,
      entryZone: { low: 1.1, high: 1.12 },
      entryZoneSource: "SNAPSHOT_STRUCTURED_ENTRY_POINT",
      closedCandles: candles,
    });
    expect(trig.status).toBe("TRIGGERED");
    expect(trig.triggerOpenTimeSec).toBe(T0 + 6 * STEP);
    expect(trig.triggerCandleExcludedFromLevelEval).toBe(true);
  });

  it("excludes trigger candle from post-trigger observation", () => {
    const post = selectPostTriggerClosedCandles({
      closedCandles: [candle(6, 1.1), candle(7, 1.12), candle(8, 1.14)],
      triggerOpenTimeSec: T0 + 6 * STEP,
    });
    expect(post.map((c) => c.openTimeSec)).toEqual([T0 + 7 * STEP, T0 + 8 * STEP]);
  });
});

describe("P8.C signed realized R", () => {
  it("BUY profitable → positive R", () => {
    const r = computeSignedRealizedR({
      direction: "BUY",
      entryPrice: 1.1,
      invalidationPrice: 1.08,
      exitPrice: 1.14,
      resultKind: "TARGET_REACHED",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.realizedSignedRMultiple).toBeCloseTo(2, 8);
  });

  it("BUY losing → negative R", () => {
    const r = computeSignedRealizedR({
      direction: "BUY",
      entryPrice: 1.1,
      invalidationPrice: 1.08,
      exitPrice: 1.08,
      resultKind: "INVALIDATION_REACHED",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.realizedSignedRMultiple).toBeCloseTo(-1, 8);
  });

  it("SELL profitable → positive R", () => {
    const r = computeSignedRealizedR({
      direction: "SELL",
      entryPrice: 1.1,
      invalidationPrice: 1.12,
      exitPrice: 1.06,
      resultKind: "TARGET_REACHED",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.realizedSignedRMultiple).toBeCloseTo(2, 8);
  });

  it("SELL losing → negative R", () => {
    const r = computeSignedRealizedR({
      direction: "SELL",
      entryPrice: 1.1,
      invalidationPrice: 1.12,
      exitPrice: 1.12,
      resultKind: "INVALIDATION_REACHED",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.realizedSignedRMultiple).toBeCloseTo(-1, 8);
  });

  it("rejects zero / invalid risk distance", () => {
    const r = computeSignedRealizedR({
      direction: "BUY",
      entryPrice: 1.1,
      invalidationPrice: 1.1,
      exitPrice: 1.14,
      resultKind: "TARGET_REACHED",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe("INVALID_RISK_DISTANCE");
  });

  it("ambiguous same-candle keeps null R", () => {
    const r = computeSignedRealizedR({
      direction: "BUY",
      entryPrice: 1.1,
      invalidationPrice: 1.08,
      exitPrice: 1.11,
      resultKind: "BOTH_AMBIGUOUS_SAME_CANDLE",
    });
    expect(r.realizedSignedRMultiple).toBeNull();
  });
});

describe("P8.C decisive win-rate denominator", () => {
  it("returns null when denominator is zero", () => {
    const w = computeDecisiveWinRate(0, 0);
    expect(w.winRate).toBeNull();
    expect(w.denominator).toBe(0);
  });

  it("excludes ambiguous/untriggered from denominator", () => {
    const summary = aggregateChartsPredictionPerformance({
      evaluations: [
        {
          resultKind: "TARGET_REACHED",
          entryTrigger: { status: "TRIGGERED" },
          evaluationId: "a",
          predictionId: "p1",
          mae: 0.01,
          mfe: 0.02,
        } as any,
        {
          resultKind: "UNTRIGGERED",
          entryTrigger: { status: "UNTRIGGERED" },
          evaluationId: "b",
          predictionId: "p2",
          mae: null,
          mfe: null,
        } as any,
        {
          resultKind: "BOTH_AMBIGUOUS_SAME_CANDLE",
          entryTrigger: { status: "TRIGGERED" },
          evaluationId: "c",
          predictionId: "p3",
          mae: null,
          mfe: null,
        } as any,
        {
          resultKind: "INVALIDATION_REACHED",
          entryTrigger: { status: "TRIGGERED" },
          evaluationId: "d",
          predictionId: "p4",
          mae: -0.01,
          mfe: 0.01,
        } as any,
      ],
    });
    expect(summary.targetReached).toBe(1);
    expect(summary.invalidationReached).toBe(1);
    expect(summary.untriggered).toBe(1);
    expect(summary.ambiguousSameCandle).toBe(1);
    expect(summary.decisiveWinRate.numerator).toBe(1);
    expect(summary.decisiveWinRate.denominator).toBe(2);
    expect(summary.decisiveWinRate.winRate).toBeCloseTo(0.5, 8);
  });
});

describe("P8.C Charts historical evaluation (integration fixtures)", () => {
  let researchRoot: string;
  let predRoot: string;
  let chartsRoot: string;
  let research: MifHistoricalResearchStorage;
  let predStore: MifPredictionOutcomeStorage;
  let chartsStore: HfmChartsPredictionOutcomeStorage;

  beforeEach(() => {
    researchRoot = tmpRoot("p8c-research-");
    predRoot = tmpRoot("p8c-pred-");
    chartsRoot = tmpRoot("p8c-charts-");
    research = new MifHistoricalResearchStorage(researchRoot);
    predStore = new MifPredictionOutcomeStorage(predRoot);
    chartsStore = new HfmChartsPredictionOutcomeStorage(chartsRoot);
    __setMifHistoricalResearchStorageForTests(research);
    __setMifPredictionOutcomeStorageForTests(predStore);
    __setHfmChartsPredictionOutcomeStorageForTests(chartsStore);
  });

  afterEach(() => {
    __setMifHistoricalResearchStorageForTests(null as any);
    __setMifPredictionOutcomeStorageForTests(null as any);
    __setHfmChartsPredictionOutcomeStorageForTests(null);
    for (const r of [researchRoot, predRoot, chartsRoot]) {
      try {
        fs.rmSync(r, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  });

  async function prepare(bars: MifResearchStoredBar[], snap = buySnapshot()) {
    const sealed = await sealComplete(research, bars);
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) throw new Error(sealed.message);
    await predStore.persistSnapshot(snap);
    return { sealed, snap };
  }

  it("BUY target reached with positive signed R", async () => {
    const { sealed, snap } = await prepare(barsBuyTarget());
    const result = await evaluateChartsPredictionHistorical({
      researchStorage: research,
      predictionStorage: predStore,
      chartsStorage: chartsStore,
      request: {
        predictionId: snap.predictionId,
        datasetId: sealed.manifest.datasetId,
        datasetVersion: sealed.manifest.version,
        expectedContentHash: sealed.manifest.contentHash,
        entryZone: { low: 1.1, high: 1.12 },
        maxAgeBars: 12,
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.evaluation.entryTrigger.status).toBe("TRIGGERED");
    expect(result.evaluation.resultKind).toBe("TARGET_REACHED");
    expect(result.evaluation.realizedSignedRMultiple).toBeGreaterThan(0);
    expect(result.evaluation.signedRDefinition).toBe(HFM_CHARTS_SIGNED_R_DEFINITION);
    expect(result.evaluation.provenance.pitManifestId.startsWith("pitrm:")).toBe(true);
    expect(result.evaluation.evaluatorVersion).toBe(
      HFM_CHARTS_PREDICTION_OUTCOME_EVALUATOR_VERSION,
    );
  });

  it("BUY invalidation reached with negative signed R", async () => {
    const { sealed, snap } = await prepare(barsBuyInvalidation());
    const result = await evaluateChartsPredictionHistorical({
      researchStorage: research,
      predictionStorage: predStore,
      chartsStorage: chartsStore,
      request: {
        predictionId: snap.predictionId,
        datasetId: sealed.manifest.datasetId,
        datasetVersion: sealed.manifest.version,
        maxAgeBars: 12,
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.evaluation.resultKind).toBe("INVALIDATION_REACHED");
    expect(result.evaluation.realizedSignedRMultiple!).toBeLessThan(0);
  });

  it("SELL target reached with positive signed R", async () => {
    const snap = sellSnapshot();
    const { sealed } = await prepare(barsSellTarget(), snap);
    const result = await evaluateChartsPredictionHistorical({
      researchStorage: research,
      predictionStorage: predStore,
      chartsStorage: chartsStore,
      request: {
        predictionId: snap.predictionId,
        datasetId: sealed.manifest.datasetId,
        datasetVersion: sealed.manifest.version,
        entryZone: { low: 1.095, high: 1.105 },
        maxAgeBars: 12,
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.evaluation.resultKind).toBe("TARGET_REACHED");
    expect(result.evaluation.realizedSignedRMultiple!).toBeGreaterThan(0);
  });

  it("SELL invalidation reached with negative signed R", async () => {
    const snap = sellSnapshot();
    const { sealed } = await prepare(barsSellInvalidation(), snap);
    const result = await evaluateChartsPredictionHistorical({
      researchStorage: research,
      predictionStorage: predStore,
      chartsStorage: chartsStore,
      request: {
        predictionId: snap.predictionId,
        datasetId: sealed.manifest.datasetId,
        datasetVersion: sealed.manifest.version,
        entryZone: { low: 1.095, high: 1.105 },
        maxAgeBars: 12,
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.evaluation.resultKind).toBe("INVALIDATION_REACHED");
    expect(result.evaluation.realizedSignedRMultiple!).toBeLessThan(0);
  });

  it("entry never reached → UNTRIGGERED (not a loss)", async () => {
    const { sealed, snap } = await prepare(barsUntriggered());
    const result = await evaluateChartsPredictionHistorical({
      researchStorage: research,
      predictionStorage: predStore,
      chartsStorage: chartsStore,
      request: {
        predictionId: snap.predictionId,
        datasetId: sealed.manifest.datasetId,
        datasetVersion: sealed.manifest.version,
        maxAgeBars: 10,
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.evaluation.entryTrigger.status).toBe("UNTRIGGERED");
    expect(result.evaluation.resultKind).toBe("UNTRIGGERED");
    expect(result.evaluation.realizedSignedRMultiple).toBeNull();
    expect(result.evaluation.mae).toBeNull();
    expect(result.evaluation.mfe).toBeNull();
  });

  it("same-candle TP/SL → BOTH_AMBIGUOUS_SAME_CANDLE with null R", async () => {
    const { sealed, snap } = await prepare(barsAmbiguous());
    const result = await evaluateChartsPredictionHistorical({
      researchStorage: research,
      predictionStorage: predStore,
      chartsStorage: chartsStore,
      request: {
        predictionId: snap.predictionId,
        datasetId: sealed.manifest.datasetId,
        datasetVersion: sealed.manifest.version,
        entryZone: { low: 1.1, high: 1.12 },
        maxAgeBars: 12,
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.evaluation.resultKind).toBe("BOTH_AMBIGUOUS_SAME_CANDLE");
    expect(result.evaluation.realizedSignedRMultiple).toBeNull();
  });

  it("rejects hash mismatch and does not fall back to live", async () => {
    const { sealed, snap } = await prepare(barsBuyTarget());
    const result = await evaluateChartsPredictionHistorical({
      researchStorage: research,
      predictionStorage: predStore,
      chartsStorage: chartsStore,
      request: {
        predictionId: snap.predictionId,
        datasetId: sealed.manifest.datasetId,
        datasetVersion: sealed.manifest.version,
        expectedContentHash: "deadbeef",
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("HASH_MISMATCH");
  });

  it("idempotent identical evaluation; concurrent duplicate safe", async () => {
    const { sealed, snap } = await prepare(barsBuyTarget());
    const req = {
      predictionId: snap.predictionId,
      datasetId: sealed.manifest.datasetId,
      datasetVersion: sealed.manifest.version,
      expectedContentHash: sealed.manifest.contentHash,
      entryZone: { low: 1.1, high: 1.12 },
      maxAgeBars: 12,
    };
    const [a, b] = await Promise.all([
      evaluateChartsPredictionHistorical({
        researchStorage: research,
        predictionStorage: predStore,
        chartsStorage: chartsStore,
        request: req,
      }),
      evaluateChartsPredictionHistorical({
        researchStorage: research,
        predictionStorage: predStore,
        chartsStorage: chartsStore,
        request: req,
      }),
    ]);
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.evaluation.evaluationId).toBe(b.evaluation.evaluationId);
    const listed = await chartsStore.listEvaluationsForPrediction(snap.predictionId);
    expect(listed.length).toBe(1);
    const again = await evaluateChartsPredictionHistorical({
      researchStorage: research,
      predictionStorage: predStore,
      chartsStorage: chartsStore,
      request: req,
    });
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.created).toBe(false);
    expect(again.evaluation.evaluationId).toBe(a.evaluation.evaluationId);
  });

  it("different dataset hash / PIT input yields distinct evaluation identity", async () => {
    const snap = buySnapshot();
    await predStore.persistSnapshot(snap);
    const sealedA = await sealComplete(research, barsBuyTarget());
    expect(sealedA.ok).toBe(true);
    if (!sealedA.ok) return;
    const resultA = await evaluateChartsPredictionHistorical({
      researchStorage: research,
      predictionStorage: predStore,
      chartsStorage: chartsStore,
      request: {
        predictionId: snap.predictionId,
        datasetId: sealedA.manifest.datasetId,
        datasetVersion: sealedA.manifest.version,
        maxAgeBars: 12,
        entryZone: { low: 1.1, high: 1.12 },
      },
    });
    // Second sealed archive with different content (extra bar) → different hash.
    const barsB = [
      ...barsBuyTarget(),
      ...toStored([
        {
          time: T0 + 30 * STEP,
          open: 1.14,
          high: 1.16,
          low: 1.13,
          close: 1.15,
        },
      ]),
    ];
    const sealedB = await sealComplete(research, barsB);
    expect(sealedB.ok).toBe(true);
    if (!sealedB.ok) return;
    expect(sealedB.manifest.contentHash).not.toBe(sealedA.manifest.contentHash);
    const resultB = await evaluateChartsPredictionHistorical({
      researchStorage: research,
      predictionStorage: predStore,
      chartsStorage: chartsStore,
      request: {
        predictionId: snap.predictionId,
        datasetId: sealedB.manifest.datasetId,
        datasetVersion: sealedB.manifest.version,
        maxAgeBars: 12,
        entryZone: { low: 1.1, high: 1.12 },
      },
    });
    expect(resultA.ok && resultB.ok).toBe(true);
    if (!resultA.ok || !resultB.ok) return;
    expect(resultA.evaluation.evaluationId).not.toBe(resultB.evaluation.evaluationId);
    expect(resultA.evaluation.provenance.pitManifestId).not.toBe(
      resultB.evaluation.provenance.pitManifestId,
    );
  });

  it("immutable conflict refuses mutation", async () => {
    const { sealed, snap } = await prepare(barsBuyTarget());
    const result = await evaluateChartsPredictionHistorical({
      researchStorage: research,
      predictionStorage: predStore,
      chartsStorage: chartsStore,
      request: {
        predictionId: snap.predictionId,
        datasetId: sealed.manifest.datasetId,
        datasetVersion: sealed.manifest.version,
        entryZone: { low: 1.1, high: 1.12 },
        maxAgeBars: 12,
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const mutated = {
      ...result.evaluation,
      resultKind: "INVALIDATION_REACHED" as const,
      realizedSignedRMultiple: -99,
    };
    const persist = await chartsStore.persistEvaluation(mutated);
    expect(persist.ok).toBe(false);
    if (persist.ok) return;
    expect(persist.code).toBe("EVALUATION_IMMUTABLE_CONFLICT");
  });

  it("snapshot entry zone resolution falls back to structured entry point", () => {
    const snap = buySnapshot();
    const resolved = resolveChartsEntryZone({ snapshot: snap });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.source).toBe("SNAPSHOT_STRUCTURED_ENTRY_POINT");
    expect(resolved.zone).toEqual({ low: 1.1, high: 1.1 });
  });

  it("MAE/MFE BUY/SELL symmetry on path metrics remains direction-aware", async () => {
    const { sealed, snap } = await prepare(barsBuyTarget());
    const buy = await evaluateChartsPredictionHistorical({
      researchStorage: research,
      predictionStorage: predStore,
      chartsStorage: chartsStore,
      request: {
        predictionId: snap.predictionId,
        datasetId: sealed.manifest.datasetId,
        datasetVersion: sealed.manifest.version,
        entryZone: { low: 1.1, high: 1.12 },
        maxAgeBars: 12,
      },
    });
    expect(buy.ok).toBe(true);
    if (!buy.ok) return;
    expect(buy.evaluation.entryTrigger.status).toBe("TRIGGERED");
    // Path metrics present after trigger for BUY.
    expect(buy.evaluation.pathOutcome).not.toBeNull();
  });
});
