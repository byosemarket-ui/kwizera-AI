/**
 * Phase 5F STEP 2 — Historical Analogue & Market Similarity Engine.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  MifHistoricalResearchStorage,
  __setMifHistoricalResearchStorageForTests,
  __setMifAnalogueSearchStorageForTests,
  assessAnalogueDatasetEligibility,
  attachAnalogueOutcomes,
  buildAnalogueReferenceState,
  clipResearchBarsToTip,
  computeAtr,
  distanceToSimilarityScore,
  extractAnalogueFeatures,
  getMifAnalogueSearchStorage,
  resolveComparisonMode,
  runAnalogueSearch,
  scoreAnalogueSimilarity,
  scoreCandidateWindowForTests,
  sealResearchDataset,
  suppressOverlappingAnalogues,
  toStoredResearchBar,
  windowIou,
  type MifAnalogueCandidateRecord,
  type MifResearchStoredBar,
} from "../../../../ai/market-data/mt5-hfm/mif/index";

const T0 = 1_700_000_000;
const STEP = 3600;

function makeRaw(i: number, close = 100 + i * 0.1) {
  return {
    time: T0 + i * STEP,
    open: close - 0.05,
    high: close + 0.1,
    low: close - 0.1,
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
      exportJobId: `job:${instrument}:${timeframe}`,
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

describe("Phase 5F STEP 2 — historical analogue engine", () => {
  let tmp: string;
  let store: MifHistoricalResearchStorage;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mif-analogue-"));
    store = new MifHistoricalResearchStorage(tmp);
    __setMifHistoricalResearchStorageForTests(store);
    __setMifAnalogueSearchStorageForTests(getMifAnalogueSearchStorage(tmp));
  });

  afterEach(() => {
    __setMifHistoricalResearchStorageForTests(null);
    __setMifAnalogueSearchStorageForTests(null);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("accepts COMPLETE HFM candle research datasets and rejects INCOMPLETE", async () => {
    const bars = toStored(Array.from({ length: 120 }, (_, i) => makeRaw(i)));
    const sealed = await sealComplete(store, "EURUSD", "H1", bars);
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    const ok = assessAnalogueDatasetEligibility(sealed.manifest, "PRICE_ACTION");
    expect(ok.eligible).toBe(true);

    const incomplete = await sealResearchDataset(store, {
      instrument: "GBPUSD",
      timeframe: "H1",
      bars: bars.slice(0, 50),
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
        maxBars: 100,
        maxPages: 1,
      },
      exportProvenance: {
        exportJobId: "job:incomplete",
        pagesFetched: 1,
        lastStartPos: 0,
        nextStartPos: 100,
        requestedCountPerPage: 300,
        returnedBarTotal: 50,
        hasMoreAtStop: true,
        incompleteReason: "MAX_BARS_REACHED",
        sourceFreshnessNotes: [],
        fetchErrors: [],
      },
    });
    expect(incomplete.ok).toBe(true);
    if (!incomplete.ok) return;
    const bad = assessAnalogueDatasetEligibility(incomplete.manifest, "PRICE_ACTION");
    expect(bad.eligible).toBe(false);
    expect(bad.reasons).toContain("STATUS_INCOMPLETE");
  });

  it("builds deterministic tip-clipped reference and rejects insufficient history", async () => {
    const bars = toStored(Array.from({ length: 100 }, (_, i) => makeRaw(i)));
    const sealed = await sealComplete(store, "EURUSD", "H1", bars);
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    const tip = bars[bars.length - 1]!.time;
    const a = buildAnalogueReferenceState({
      manifest: sealed.manifest,
      bars,
      tipOpenTimeSec: tip,
      lookbackBars: 16,
      warmupBars: 20,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    const b = buildAnalogueReferenceState({
      manifest: sealed.manifest,
      bars,
      tipOpenTimeSec: tip,
      lookbackBars: 16,
      warmupBars: 20,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.reference.referenceId).toBe(b.reference.referenceId);
    expect(a.reference.contentHash).toBe(sealed.manifest.contentHash);

    const short = buildAnalogueReferenceState({
      manifest: sealed.manifest,
      bars: bars.slice(0, 10),
      tipOpenTimeSec: bars[9]!.time,
      lookbackBars: 32,
      warmupBars: 40,
    });
    expect(short.ok).toBe(false);
    if (short.ok) return;
    expect(short.code).toBe("INSUFFICIENT_HISTORY");
  });

  it("scores identical windows high and dissimilar windows lower", () => {
    const bars = toStored(Array.from({ length: 80 }, (_, i) => makeRaw(i)));
    const features = extractAnalogueFeatures({
      barsThroughTip: bars.slice(0, 72),
      lookbackBars: 32,
      warmupBars: 40,
    });
    const same = scoreAnalogueSimilarity({
      reference: features,
      candidate: features,
      minFeatureCoverage: 0.5,
    });
    expect(same.score).toBeGreaterThan(90);
    expect(same.score).toBeLessThanOrEqual(100);

    const other = toStored(
      Array.from({ length: 80 }, (_, i) => makeRaw(i, 100 + Math.sin(i) * 5 + (i % 3) * 2)),
    );
    const otherFeat = extractAnalogueFeatures({
      barsThroughTip: other.slice(0, 72),
      lookbackBars: 32,
      warmupBars: 40,
    });
    const diff = scoreAnalogueSimilarity({
      reference: features,
      candidate: otherFeat,
      minFeatureCoverage: 0.5,
    });
    expect(diff.score).toBeLessThan(same.score);
    expect(distanceToSimilarityScore(0)).toBe(100);
  });

  it("does not let future bars change similarity (leakage)", async () => {
    const base = toStored(Array.from({ length: 90 }, (_, i) => makeRaw(i)));
    const sealed = await sealComplete(store, "EURUSD", "H1", base);
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    const tip = base[80]!.time;
    const ref = buildAnalogueReferenceState({
      manifest: sealed.manifest,
      bars: base,
      tipOpenTimeSec: tip,
      lookbackBars: 16,
      warmupBars: 20,
    });
    expect(ref.ok).toBe(true);
    if (!ref.ok) return;

    const clipped = clipResearchBarsToTip(base, tip).bars;
    const window = clipped.slice(clipped.length - 36);
    const s1 = scoreCandidateWindowForTests({
      reference: ref.reference,
      barsThroughTip: window,
      lookbackBars: 16,
      warmupBars: 20,
    });

    const withFuture = [
      ...window,
      toStoredResearchBar(makeRaw(900, 9999)),
    ];
    // If caller forgets to clip, tip is still last of window for extract — inject after tip time but
    // keep tip as last bar by reordering wrongly: ensure clip removes future.
    const clipped2 = clipResearchBarsToTip(withFuture, tip).bars;
    const window2 = clipped2.slice(clipped2.length - 36);
    const s2 = scoreCandidateWindowForTests({
      reference: ref.reference,
      barsThroughTip: window2,
      lookbackBars: 16,
      warmupBars: 20,
    });
    expect(s2.score).toBe(s1.score);

    // Mutating future-only bars (after tip) must not affect score when tip-clipped.
    const futureMut = [
      ...base.slice(0, 81),
      ...Array.from({ length: 20 }, (_, i) =>
        toStoredResearchBar(makeRaw(81 + i, 5000 + i * 100)),
      ),
    ];
    const clipped3 = clipResearchBarsToTip(futureMut, tip).bars;
    const window3 = clipped3.slice(clipped3.length - 36);
    const s3 = scoreCandidateWindowForTests({
      reference: ref.reference,
      barsThroughTip: window3,
      lookbackBars: 16,
      warmupBars: 20,
    });
    expect(s3.score).toBe(s1.score);
  });

  it("attaches outcomes only after tip and marks partial horizons", () => {
    const bars = toStored(Array.from({ length: 50 }, (_, i) => makeRaw(i)));
    const tip = bars[40]!.time;
    const out = attachAnalogueOutcomes({
      tipOpenTimeSec: tip,
      tipClose: bars[40]!.close,
      bars,
      horizons: [4, 20],
    });
    expect(out.separatedFromSimilarityScore).toBe(true);
    expect(out.probabilityNotComputed).toBe(true);
    expect(out.horizons[0]!.completeness).toBe("COMPLETE");
    expect(out.horizons[1]!.completeness).toBe("PARTIAL");
    expect(out.costUncertainty).toBe(true);
    expect(out.sessionUncertainty).toBe(true);
  });

  it("suppresses overlapping windows deterministically", () => {
    const mk = (id: string, tip: number, score: number): MifAnalogueCandidateRecord =>
      ({
        analogueId: id,
        instrument: "EURUSD",
        timeframe: "H1",
        tipOpenTimeSec: tip,
        windowStartOpenTimeSec: tip - 10 * STEP,
        windowEndOpenTimeSec: tip,
        datasetId: "ds:EURUSD:H1:aaa",
        datasetVersion: 1,
        contentHash: "h",
        similarity: {
          score,
          distance: 0,
          algorithmId: "a",
          algorithmVersion: "1",
          weightTableId: "w",
          weightTableVersion: "1",
          normalizationPolicyId: "n",
          normalizationPolicyVersion: "1",
          comparableCoverage: 1,
          insufficientComparableFeatures: false,
          contributions: [],
          agreeingFeatures: [],
          disagreeingFeatures: [],
          unavailableFeatures: [],
        },
        explanation: {
          selectedBecause: "t",
          factualNotes: [],
          disclaimer: "d",
        },
        qualityNotes: [],
        pitWarnings: [],
        costWarnings: [],
        outcome: null,
        suppressed: false,
        suppressionReason: null,
      });
    const ranked = [mk("a", T0 + 50 * STEP, 99), mk("b", T0 + 52 * STEP, 98), mk("c", T0 + 200 * STEP, 97)];
    expect(windowIou(
      { start: ranked[0]!.windowStartOpenTimeSec, end: ranked[0]!.windowEndOpenTimeSec },
      { start: ranked[1]!.windowStartOpenTimeSec, end: ranked[1]!.windowEndOpenTimeSec },
    )).toBeGreaterThan(0.5);
    const { kept, suppressed } = suppressOverlappingAnalogues({
      ranked,
      iouThreshold: 0.5,
    });
    expect(kept.map((k) => k.analogueId)).toEqual(["a", "c"]);
    expect(suppressed.map((s) => s.analogueId)).toEqual(["b"]);
  });

  it("runs bounded search, persists immutably, and is deterministic", async () => {
    const barsA = toStored(Array.from({ length: 120 }, (_, i) => makeRaw(i)));
    const barsB = toStored(
      Array.from({ length: 120 }, (_, i) => makeRaw(i, 100 + i * 0.1 + Math.sin(i / 3) * 0.2)),
    );
    const a = await sealComplete(store, "EURUSD", "H1", barsA);
    const b = await sealComplete(store, "GBPUSD", "H1", barsB);
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;

    const tip = barsA[barsA.length - 1]!.time;
    const ref = buildAnalogueReferenceState({
      manifest: a.manifest,
      bars: barsA,
      tipOpenTimeSec: tip,
      lookbackBars: 16,
      warmupBars: 24,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    expect(ref.ok).toBe(true);
    if (!ref.ok) return;

    const s1 = await runAnalogueSearch({
      storage: store,
      reference: ref.reference,
      params: {
        maxResults: 5,
        maxCandidatesScanned: 200,
        stride: 2,
        timeoutMs: 30_000,
        allowCrossInstrument: true,
        lookbackBars: 16,
        warmupBars: 24,
      },
    });
    const s2 = await runAnalogueSearch({
      storage: store,
      reference: ref.reference,
      params: {
        maxResults: 5,
        maxCandidatesScanned: 200,
        stride: 2,
        timeoutMs: 30_000,
        allowCrossInstrument: true,
        lookbackBars: 16,
        warmupBars: 24,
      },
    });
    expect(s1.searchHash).toBe(s2.searchHash);
    expect(s1.analogues.map((x) => x.analogueId)).toEqual(s2.analogues.map((x) => x.analogueId));
    expect(s1.placesOrders).toBe(false);
    expect(s1.similarityIsNotProbability).toBe(true);
    expect(s1.analogues.every((x) => x.outcome?.separatedFromSimilarityScore)).toBe(true);

    const analogueStore = getMifAnalogueSearchStorage(tmp);
    const p1 = await analogueStore.persistSearch(s1);
    expect(p1.ok).toBe(true);
    const p2 = await analogueStore.persistSearch(s1);
    expect(p2.ok).toBe(true);
    const loaded = await analogueStore.getSearch(s1.searchId);
    expect(loaded?.searchHash).toBe(s1.searchHash);
    expect(loaded?.analogues.length).toBe(s1.analogues.length);
  });

  it("rejects cross-instrument×cross-timeframe by default", () => {
    const r = resolveComparisonMode({
      referenceInstrument: "EURUSD",
      referenceTimeframe: "H1",
      candidateInstrument: "XAUUSD",
      candidateTimeframe: "M15",
      allowCrossInstrument: true,
    });
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("CROSS_INSTRUMENT_CROSS_TF_REJECTED");
  });

  it("handles zero-range candles without inventing ratios", () => {
    const bars = toStored(Array.from({ length: 80 }, (_, i) => {
      if (i === 70) {
        return {
          ...makeRaw(i, 100),
          open: 100,
          high: 100,
          low: 100,
          close: 100,
        };
      }
      return makeRaw(i);
    }));
    const feat = extractAnalogueFeatures({
      barsThroughTip: bars.slice(0, 72),
      lookbackBars: 32,
      warmupBars: 40,
    });
    expect(feat.continuous.some((f) => f.name.startsWith("mean_"))).toBe(true);
    expect(computeAtr(bars.slice(0, 72), 14)).not.toBeNull();
  });

  it("exposes safety flags and cost/PIT warnings on search results", async () => {
    const bars = toStored(Array.from({ length: 100 }, (_, i) => makeRaw(i)));
    const sealed = await sealComplete(store, "EURUSD", "H1", bars);
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    const tip = bars[bars.length - 1]!.time;
    const ref = buildAnalogueReferenceState({
      manifest: sealed.manifest,
      bars,
      tipOpenTimeSec: tip,
      lookbackBars: 16,
      warmupBars: 20,
    });
    expect(ref.ok).toBe(true);
    if (!ref.ok) return;
    expect(ref.reference.costWarnings.length).toBeGreaterThan(0);
    expect(ref.reference.pitWarnings.length).toBeGreaterThan(0);
    expect(ref.reference.acceptsForExecution).toBe(false);
  });
});
