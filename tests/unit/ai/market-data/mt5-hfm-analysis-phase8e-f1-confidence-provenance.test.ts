/**
 * P8.E F1 — evaluate-time confidence capture, immutability, census (fixtures only).
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  HfmChartsPredictionOutcomeStorage,
  __setHfmChartsPredictionOutcomeStorageForTests,
  buildChartsCalibrationCensus,
  classifyCalibrationCensusBucket,
  normalizeChartsAnalyticalConfidence,
  resolveChartsConfidenceProvenance,
  stableConfidenceProvenanceEquality,
  unavailableConfidenceProvenance,
} from "../../../../ai/market-data/mt5-hfm/analysis/prediction-outcome/index";
import { HfmReasoningStorage } from "../../../../ai/market-data/mt5-hfm/analysis/reasoning/storage";

function tmpRoot(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

describe("P8.E F1 normalizeChartsAnalyticalConfidence", () => {
  it("maps fraction 0.76 → 76 scale fraction", () => {
    const n = normalizeChartsAnalyticalConfidence(0.76);
    expect(n.ok).toBe(true);
    if (!n.ok) return;
    expect(n.confidence).toBe(76);
    expect(n.scale).toBe("fraction");
    expect(n.raw).toBe(0.76);
  });

  it("maps percentage 78 → 78 scale percent", () => {
    const n = normalizeChartsAnalyticalConfidence(78);
    expect(n.ok).toBe(true);
    if (!n.ok) return;
    expect(n.confidence).toBe(78);
    expect(n.scale).toBe("percent");
  });

  it("maps zero → 0 scale zero", () => {
    const n = normalizeChartsAnalyticalConfidence(0);
    expect(n.ok).toBe(true);
    if (!n.ok) return;
    expect(n.confidence).toBe(0);
    expect(n.scale).toBe("zero");
  });

  it("value 1 follows existing normalizer (fraction → 100)", () => {
    // Documented: existing normalizeHfmReasoningConfidence treats (0,1] as fraction.
    const n = normalizeChartsAnalyticalConfidence(1);
    expect(n.ok).toBe(true);
    if (!n.ok) return;
    expect(n.confidence).toBe(100);
    expect(n.scale).toBe("fraction");
  });

  it("rejects negative, above 100, non-finite, missing, null", () => {
    expect(normalizeChartsAnalyticalConfidence(-1).ok).toBe(false);
    expect(normalizeChartsAnalyticalConfidence(101).ok).toBe(false);
    expect(normalizeChartsAnalyticalConfidence(Number.NaN).ok).toBe(false);
    expect(normalizeChartsAnalyticalConfidence(Number.POSITIVE_INFINITY).ok).toBe(false);
    expect(normalizeChartsAnalyticalConfidence(null).ok).toBe(false);
    expect(normalizeChartsAnalyticalConfidence(undefined).ok).toBe(false);
  });
});

describe("P8.E F1 resolveChartsConfidenceProvenance", () => {
  let storageRoot: string;
  let reasoning: HfmReasoningStorage;

  beforeEach(() => {
    storageRoot = tmpRoot("p8e-f1-reason-");
    reasoning = new HfmReasoningStorage(storageRoot);
  });

  afterEach(() => {
    try {
      fs.rmSync(storageRoot, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  async function writeReasoning(
    analysisId: string,
    confidence: unknown,
    opts?: { mismatchId?: string },
  ) {
    await reasoning.ensureReady();
    const id = opts?.mismatchId ?? analysisId;
    const rec = {
      analysisId: id,
      contextId: "ctx",
      snapshotId: "snap",
      snapshotHash: "hash",
      symbol: "EURUSD",
      provider: "HFM_MT5" as const,
      status: "COMPLETED" as const,
      createdAt: "2026-11-22T00:00:00.000Z",
      completedAt: "2026-11-22T00:00:00.000Z",
      promptVersion: "t",
      schemaVersion: "hfm-ai-analysis-v1.2",
      model: "test",
      errorCode: null,
      errorMessage: null,
      dataQualityStatus: null,
      synchronizationStatus: null,
      candleCounts: {},
      imageRefs: [],
      lineage: null,
      usage: null,
      result: {
        decision: {
          action: "BUY",
          confidence,
        },
      } as any,
      placesOrders: false as const,
      mutatesBroker: false as const,
      acceptsForExecution: false as const,
    };
    // Write under requested path id (may differ from analysisId for mismatch test).
    const fp = path.join(reasoning.root, `${analysisId}.json`);
    fs.mkdirSync(reasoning.root, { recursive: true });
    fs.writeFileSync(fp, JSON.stringify(rec), "utf8");
  }

  it("SOFT UNAVAILABLE when analysisRunId missing", async () => {
    const p = await resolveChartsConfidenceProvenance({
      analysisRunId: null,
      reasoningStorage: reasoning,
    });
    expect(p.analyticalConfidence).toBeNull();
    expect(p.confidenceSource).toBe("UNAVAILABLE");
    expect(p.confidenceUnavailableReason).toBe("MISSING_ANALYSIS_RUN_ID");
  });

  it("SOFT UNAVAILABLE when reasoning file missing", async () => {
    const p = await resolveChartsConfidenceProvenance({
      analysisRunId: "missing-id",
      reasoningStorage: reasoning,
    });
    expect(p.confidenceSource).toBe("UNAVAILABLE");
    expect(p.confidenceUnavailableReason).toBe("REASONING_RECORD_NOT_FOUND");
  });

  it("SOFT UNAVAILABLE on analysisId mismatch", async () => {
    await writeReasoning("file-id", 70, { mismatchId: "other-id" });
    const p = await resolveChartsConfidenceProvenance({
      analysisRunId: "file-id",
      reasoningStorage: reasoning,
    });
    expect(p.confidenceSource).toBe("UNAVAILABLE");
    expect(p.confidenceUnavailableReason).toBe("REASONING_ANALYSIS_ID_MISMATCH");
  });

  it("resolves from reasoning store", async () => {
    await writeReasoning("a1", 0.76);
    const p = await resolveChartsConfidenceProvenance({
      analysisRunId: "a1",
      reasoningStorage: reasoning,
      normalizedAt: "2026-11-22T12:00:00.000Z",
    });
    expect(p.confidenceSource).toBe("REASONING_STORE");
    expect(p.analyticalConfidence).toBe(76);
    expect(p.confidenceScale).toBe("fraction");
    expect(p.rawAnalyticalConfidence).toBe(0.76);
    expect(p.confidenceAnalysisId).toBe("a1");
    expect(p.confidenceSemantics).toBe("NON_PROBABILITY_ANALYTICAL_SCORE");
    expect(p.confidenceUnavailableReason).toBeNull();
  });

  it("production path ignores client override when test flag off", async () => {
    await writeReasoning("a2", 50);
    const p = await resolveChartsConfidenceProvenance({
      analysisRunId: "a2",
      reasoningStorage: reasoning,
      testOnlyAllowConfidenceOverride: false,
      testOnlyAnalyticalConfidenceOverride: 99,
    });
    expect(p.analyticalConfidence).toBe(50);
    expect(p.confidenceSource).toBe("REASONING_STORE");
  });

  it("test-only override works when explicitly enabled", async () => {
    const p = await resolveChartsConfidenceProvenance({
      analysisRunId: null,
      reasoningStorage: reasoning,
      testOnlyAllowConfidenceOverride: true,
      testOnlyAnalyticalConfidenceOverride: 0.76,
    });
    expect(p.confidenceSource).toBe("TEST_OVERRIDE");
    expect(p.analyticalConfidence).toBe(76);
    expect(p.confidenceScale).toBe("fraction");
  });
});

describe("P8.E F1 immutable confidence equality", () => {
  let chartsRoot: string;
  let store: HfmChartsPredictionOutcomeStorage;

  beforeEach(() => {
    chartsRoot = tmpRoot("p8e-f1-charts-");
    store = new HfmChartsPredictionOutcomeStorage(chartsRoot);
    __setHfmChartsPredictionOutcomeStorageForTests(store);
  });

  afterEach(() => {
    __setHfmChartsPredictionOutcomeStorageForTests(null);
    try {
      fs.rmSync(chartsRoot, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  function baseEval(overrides: Record<string, unknown> = {}): any {
    const conf = (overrides.confidence as any) ?? unavailableConfidenceProvenance(
      "MISSING_ANALYSIS_RUN_ID",
      { confidenceNormalizedAt: "2026-11-22T00:00:00.000Z" },
    );
    return {
      contractId: "kwizera.hfm.charts-prediction-outcome.v1",
      contractVersion: "1.0.0",
      evaluatorId: "hfm-charts-prediction-outcome",
      evaluatorVersion: "1.0.0",
      evaluationId: overrides.evaluationId ?? "cpe:test:1",
      predictionId: "pred:1",
      snapshotHash: "snap",
      resultKind: "TARGET_REACHED",
      entryTrigger: { status: "TRIGGERED" },
      realizedSignedRMultiple: 1,
      signedRDefinition: "t",
      signedRPolicyVersion: "1.0.0",
      invalidationPrice: 1,
      entryPrice: 1.1,
      targetPrice: 1.2,
      exitPrice: 1.2,
      mae: null,
      mfe: null,
      observationCandleCount: 1,
      evaluationStartOpenTimeSec: 1,
      evaluationEndOpenTimeSec: 2,
      provenance: {
        predictionId: "pred:1",
        snapshotHash: "snap",
        analysisRunId: null,
        sourceAnalysisIdentity: null,
        scenarioId: null,
        setupFingerprint: null,
        evidencePackageId: null,
        scenarioPackageId: null,
        symbol: "EURUSD",
        timeframe: "H1",
        direction: "BUY",
        ...conf,
        pitManifestId: "pit",
        pitManifestContentIdentityHash: "ph",
        datasetId: "ds",
        datasetVersion: 1,
        datasetContentHash: "dh",
        candleRangeHash: "cr",
        evaluatorVersion: "1.0.0",
        entryTriggerPolicyVersion: "1.0.0",
        signedRPolicyVersion: "1.0.0",
      },
      levelOutcome: null,
      pathOutcome: null,
      mifOutcome: null,
      computationTimestamp: overrides.computationTimestamp ?? "2026-11-22T00:00:00.000Z",
      analyticalOhlcOnly: true,
      notBrokerAccountPnl: true,
      isNotCalibratedProbability: true,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
      doesNotApproveAiReasoning: true,
      notExecutable: true,
    };
  }

  it("idempotent retry with same stable confidence provenance", async () => {
    const a = baseEval({
      computationTimestamp: "2026-11-22T00:00:00.000Z",
      confidence: {
        analyticalConfidence: 76,
        rawAnalyticalConfidence: 0.76,
        confidenceScale: "fraction",
        confidenceSource: "REASONING_STORE",
        confidenceAnalysisId: "a1",
        confidenceNormalizedAt: "2026-11-22T00:00:00.000Z",
        confidenceSemantics: "NON_PROBABILITY_ANALYTICAL_SCORE",
        confidenceUnavailableReason: null,
      },
    });
    const first = await store.persistEvaluation(a);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.created).toBe(true);

    const b = baseEval({
      computationTimestamp: "2026-11-22T01:00:00.000Z",
      confidence: {
        analyticalConfidence: 76,
        rawAnalyticalConfidence: 0.76,
        confidenceScale: "fraction",
        confidenceSource: "REASONING_STORE",
        confidenceAnalysisId: "a1",
        confidenceNormalizedAt: "2026-11-22T01:00:00.000Z", // operational only
        confidenceSemantics: "NON_PROBABILITY_ANALYTICAL_SCORE",
        confidenceUnavailableReason: null,
      },
    });
    const second = await store.persistEvaluation(b);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.created).toBe(false);

    const stored = await store.getEvaluation("cpe:test:1");
    expect(stored?.provenance.confidenceNormalizedAt).toBe("2026-11-22T00:00:00.000Z");
  });

  it("immutable conflict when stable confidence provenance differs", async () => {
    const a = baseEval({
      confidence: {
        analyticalConfidence: null,
        rawAnalyticalConfidence: null,
        confidenceScale: null,
        confidenceSource: "UNAVAILABLE",
        confidenceAnalysisId: null,
        confidenceNormalizedAt: "2026-11-22T00:00:00.000Z",
        confidenceSemantics: "NON_PROBABILITY_ANALYTICAL_SCORE",
        confidenceUnavailableReason: "MISSING_ANALYSIS_RUN_ID",
      },
    });
    await store.persistEvaluation(a);
    const b = baseEval({
      confidence: {
        analyticalConfidence: 80,
        rawAnalyticalConfidence: 80,
        confidenceScale: "percent",
        confidenceSource: "REASONING_STORE",
        confidenceAnalysisId: "a1",
        confidenceNormalizedAt: "2026-11-22T00:00:00.000Z",
        confidenceSemantics: "NON_PROBABILITY_ANALYTICAL_SCORE",
        confidenceUnavailableReason: null,
      },
    });
    const conflict = await store.persistEvaluation(b);
    expect(conflict.ok).toBe(false);
    if (conflict.ok) return;
    expect(conflict.code).toBe("EVALUATION_IMMUTABLE_CONFLICT");
  });

  it("stable equality ignores normalization timestamp", () => {
    const a = stableConfidenceProvenanceEquality({
      analyticalConfidence: 50,
      rawAnalyticalConfidence: 50,
      confidenceScale: "percent",
      confidenceSource: "REASONING_STORE",
      confidenceAnalysisId: "x",
      confidenceSemantics: "NON_PROBABILITY_ANALYTICAL_SCORE",
      confidenceUnavailableReason: null,
    });
    const b = stableConfidenceProvenanceEquality({
      analyticalConfidence: 50,
      rawAnalyticalConfidence: 50,
      confidenceScale: "percent",
      confidenceSource: "REASONING_STORE",
      confidenceAnalysisId: "x",
      confidenceSemantics: "NON_PROBABILITY_ANALYTICAL_SCORE",
      confidenceUnavailableReason: null,
    });
    expect(a).toBe(b);
  });
});

describe("P8.E F1 census buckets and report", () => {
  it("classifies canonical buckets; UNKNOWN excluded from valid", () => {
    expect(classifyCalibrationCensusBucket(null)).toBe("UNKNOWN");
    expect(classifyCalibrationCensusBucket(0)).toBe("<50");
    expect(classifyCalibrationCensusBucket(49.9)).toBe("<50");
    expect(classifyCalibrationCensusBucket(50)).toBe("50–<75");
    expect(classifyCalibrationCensusBucket(74.9)).toBe("50–<75");
    expect(classifyCalibrationCensusBucket(75)).toBe(">=75");
    expect(classifyCalibrationCensusBucket(100)).toBe(">=75");
  });

  it("builds read-only census without counting UNKNOWN as valid", () => {
    const report = buildChartsCalibrationCensus([
      {
        evaluatorVersion: "1.0.0",
        signedRPolicyVersion: "1.0.0",
        resultKind: "TARGET_REACHED",
        entryTrigger: { status: "TRIGGERED" },
        provenance: {
          symbol: "EURUSD",
          timeframe: "H1",
          direction: "BUY",
          analyticalConfidence: 80,
          confidenceSource: "REASONING_STORE",
          confidenceUnavailableReason: null,
        },
      } as any,
      {
        evaluatorVersion: "1.0.0",
        signedRPolicyVersion: "1.0.0",
        resultKind: "UNTRIGGERED",
        entryTrigger: { status: "UNTRIGGERED" },
        provenance: {
          symbol: "EURUSD",
          timeframe: "H1",
          direction: "BUY",
          analyticalConfidence: null,
          confidenceSource: "UNAVAILABLE",
          confidenceUnavailableReason: "MISSING_ANALYSIS_RUN_ID",
        },
      } as any,
    ]);
    expect(report.totalEvaluations).toBe(2);
    expect(report.withValidConfidence).toBe(1);
    expect(report.withoutValidConfidence).toBe(1);
    expect(report.buckets.UNKNOWN).toBe(1);
    expect(report.buckets[">=75"]).toBe(1);
    expect(report.strictEligibleByBucket[">=75"]).toBe(1);
    expect(report.bucketReadiness[">=75"]).toBe("INSUFFICIENT_SAMPLE");
    expect(report.calibrated).toBe(false);
    expect(report.censusOnly).toBe(true);
    expect(report.warnings).toContain("CENSUS_ONLY_NOT_CALIBRATED");
  });
});
