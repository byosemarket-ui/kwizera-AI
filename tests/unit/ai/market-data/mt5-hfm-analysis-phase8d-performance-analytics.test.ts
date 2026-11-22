/**
 * P8.D — Charts Performance Analytics (fixtures only; no OpenAI / live market / broker).
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  HFM_CHARTS_INSUFFICIENT_SAMPLE_THRESHOLD,
  HFM_CHARTS_PERFORMANCE_ANALYTICS_POLICY_VERSION,
  HFM_CHARTS_PERFORMANCE_ANALYTICS_SCHEMA_VERSION,
  HFM_CHARTS_PREDICTION_OUTCOME_EVALUATOR_VERSION,
  HFM_CHARTS_SIGNED_R_POLICY_VERSION,
  HfmChartsPredictionOutcomeStorage,
  __setHfmChartsPredictionOutcomeStorageForTests,
  buildChartsPerformanceAnalytics,
  buildChartsPerformanceAnalyticsFromStorage,
  classifyAnalyticalConfidenceBucket,
  computeDistributionStats,
  computeRate,
  computeSignedRStats,
  filterEvaluations,
  selectEvaluationPopulation,
  validateAnalyticsFilters,
  defaultAnalyticsFilters,
} from "../../../../ai/market-data/mt5-hfm/analysis/prediction-outcome/index";
import { scanReasoningPopulationCounts } from "../../../../ai/market-data/mt5-hfm/analysis/prediction-outcome/reasoning-counts";

function tmpRoot(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function evalRec(overrides: Record<string, unknown> = {}): any {
  const predictionId = String(overrides.predictionId ?? "pred-1");
  const evaluationId = String(overrides.evaluationId ?? `cpe:${predictionId}:a`);
  const activation = Number(overrides.activationOpenTimeSec ?? 1_700_000_000);
  const status = (overrides.triggerStatus as string) ?? "TRIGGERED";
  return {
    contractId: "kwizera.hfm.charts-prediction-outcome.v1",
    contractVersion: "1.0.0",
    evaluatorId: "hfm-charts-prediction-outcome",
    evaluatorVersion:
      overrides.evaluatorVersion ?? HFM_CHARTS_PREDICTION_OUTCOME_EVALUATOR_VERSION,
    evaluationId,
    predictionId,
    snapshotHash: "snap",
    resultKind: overrides.resultKind ?? "TARGET_REACHED",
    entryTrigger: {
      policyId: "hfm-charts-entry-trigger-policy",
      policyVersion: "1.0.0",
      status,
      entryZone: { low: 1.09, high: 1.1 },
      entryZoneSource: "SNAPSHOT_STRUCTURED_ENTRY_POINT",
      touchRule: "CLOSED_CANDLE_RANGE_INTERSECTS_ZONE_AFTER_ACTIVATION",
      activationOpenTimeSec: activation,
      triggerOpenTimeSec: status === "TRIGGERED" ? activation + 3600 : null,
      triggerCloseTimeSec: status === "TRIGGERED" ? activation + 7200 : null,
      triggerReferencePrice: status === "TRIGGERED" ? 1.1 : null,
      triggerCandleExcludedFromLevelEval: true,
      barsScannedForTrigger: 1,
      reason: null,
    },
    realizedSignedRMultiple:
      overrides.realizedSignedRMultiple === undefined
        ? 1.5
        : overrides.realizedSignedRMultiple,
    signedRDefinition: "test",
    signedRPolicyVersion:
      overrides.signedRPolicyVersion ?? HFM_CHARTS_SIGNED_R_POLICY_VERSION,
    invalidationPrice: 1.08,
    entryPrice: 1.1,
    targetPrice: 1.13,
    exitPrice: 1.13,
    mae: overrides.mae === undefined ? 0.01 : overrides.mae,
    mfe: overrides.mfe === undefined ? 0.03 : overrides.mfe,
    observationCandleCount: 3,
    evaluationStartOpenTimeSec: activation + 3600,
    evaluationEndOpenTimeSec: activation + 10800,
    provenance: {
      predictionId,
      snapshotHash: "snap",
      analysisRunId: null,
      sourceAnalysisIdentity: null,
      scenarioId: null,
      setupFingerprint:
        Object.prototype.hasOwnProperty.call(overrides, "setupFingerprint")
          ? overrides.setupFingerprint
          : "setup-a",
      evidencePackageId: null,
      scenarioPackageId: null,
      symbol: overrides.symbol ?? "EURUSD",
      timeframe: overrides.timeframe ?? "H1",
      direction: overrides.direction ?? "BUY",
      analyticalConfidence: Object.prototype.hasOwnProperty.call(
        overrides,
        "analyticalConfidence",
      )
        ? overrides.analyticalConfidence
        : 0.6,
      pitManifestId: overrides.pitManifestId ?? "pit-1",
      pitManifestContentIdentityHash: "pit-hash",
      datasetId: overrides.datasetId ?? "ds-1",
      datasetVersion: 1,
      datasetContentHash: overrides.datasetContentHash ?? "ds-hash",
      candleRangeHash: "cr-hash",
      evaluatorVersion:
        overrides.evaluatorVersion ?? HFM_CHARTS_PREDICTION_OUTCOME_EVALUATOR_VERSION,
      entryTriggerPolicyVersion: "1.0.0",
      signedRPolicyVersion:
        overrides.signedRPolicyVersion ?? HFM_CHARTS_SIGNED_R_POLICY_VERSION,
    },
    levelOutcome: null,
    pathOutcome: null,
    mifOutcome: null,
    computationTimestamp:
      (overrides.computationTimestamp as string) ?? "2026-11-01T12:00:00.000Z",
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

describe("P8.D confidence buckets", () => {
  it("classifies UNKNOWN / <0.5 / 0.5–0.75 / ≥0.75 including 0–100 scale", () => {
    expect(classifyAnalyticalConfidenceBucket(null)).toBe("UNKNOWN");
    expect(classifyAnalyticalConfidenceBucket(undefined)).toBe("UNKNOWN");
    expect(classifyAnalyticalConfidenceBucket(0.4)).toBe("<0.5");
    expect(classifyAnalyticalConfidenceBucket(0.5)).toBe("0.5–0.75");
    expect(classifyAnalyticalConfidenceBucket(0.749)).toBe("0.5–0.75");
    expect(classifyAnalyticalConfidenceBucket(0.75)).toBe("≥0.75");
    expect(classifyAnalyticalConfidenceBucket(80)).toBe("≥0.75");
    expect(classifyAnalyticalConfidenceBucket(40)).toBe("<0.5");
  });
});

describe("P8.D filter validation", () => {
  it("defaults and accepts valid filters", () => {
    const d = defaultAnalyticsFilters();
    expect(d.timeBasis).toBe("activationOpenTimeSec");
    expect(d.populationMode).toBe("LATEST_PER_PREDICTION");
    const ok = validateAnalyticsFilters({
      timeBasis: "computationTimestamp",
      populationMode: "PER_PIT_MANIFEST",
      symbol: "eurusd",
      direction: "buy",
      confidenceBucket: "0.5–0.75",
      startUtc: "2026-01-01T00:00:00.000Z",
      endUtc: "2026-02-01T00:00:00.000Z",
    });
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(ok.filters.symbol).toBe("EURUSD");
    expect(ok.filters.direction).toBe("BUY");
    expect(ok.filters.confidenceBucket).toBe("0.5–0.75");
  });

  it("rejects invalid inputs", () => {
    expect(validateAnalyticsFilters({ timeBasis: "foo" as any }).ok).toBe(false);
    expect(validateAnalyticsFilters({ populationMode: "ALL" as any }).ok).toBe(false);
    expect(validateAnalyticsFilters({ direction: "LONG" }).ok).toBe(false);
    expect(validateAnalyticsFilters({ confidenceBucket: "HIGH" }).ok).toBe(false);
    expect(
      validateAnalyticsFilters({
        startUtc: "2026-02-01T00:00:00.000Z",
        endUtc: "2026-01-01T00:00:00.000Z",
      }).ok,
    ).toBe(false);
    expect(validateAnalyticsFilters({ startUtc: "not-a-date" }).ok).toBe(false);
  });
});

describe("P8.D population selection", () => {
  it("keeps latest per prediction by computationTimestamp", () => {
    const rows = [
      evalRec({
        predictionId: "p1",
        evaluationId: "e1",
        resultKind: "INVALIDATION_REACHED",
        realizedSignedRMultiple: -1,
        computationTimestamp: "2026-11-01T10:00:00.000Z",
      }),
      evalRec({
        predictionId: "p1",
        evaluationId: "e2",
        resultKind: "TARGET_REACHED",
        realizedSignedRMultiple: 2,
        computationTimestamp: "2026-11-01T12:00:00.000Z",
      }),
      evalRec({
        predictionId: "p2",
        evaluationId: "e3",
        resultKind: "UNTRIGGERED",
        triggerStatus: "UNTRIGGERED",
        realizedSignedRMultiple: null,
        mae: null,
        mfe: null,
      }),
    ];
    const latest = selectEvaluationPopulation(rows, "LATEST_PER_PREDICTION");
    expect(latest).toHaveLength(2);
    expect(latest.find((r) => r.predictionId === "p1")!.evaluationId).toBe("e2");
    const perPit = selectEvaluationPopulation(rows, "PER_PIT_MANIFEST");
    expect(perPit).toHaveLength(3);
  });

  it("does not duplicate by default when building analytics", () => {
    const report = buildChartsPerformanceAnalytics({
      evaluations: [
        evalRec({
          predictionId: "p1",
          evaluationId: "old",
          computationTimestamp: "2026-11-01T10:00:00.000Z",
          resultKind: "INVALIDATION_REACHED",
          realizedSignedRMultiple: -1,
        }),
        evalRec({
          predictionId: "p1",
          evaluationId: "new",
          computationTimestamp: "2026-11-01T12:00:00.000Z",
          resultKind: "TARGET_REACHED",
          realizedSignedRMultiple: 1,
        }),
      ],
    });
    expect(report.population.selectedEvaluations).toBe(1);
    expect(report.targetReached).toBe(1);
    expect(report.invalidationReached).toBe(0);
  });
});

describe("P8.D trigger / win-rate / signed-R / MAE-MFE", () => {
  const population = [
    evalRec({
      predictionId: "t1",
      evaluationId: "a",
      resultKind: "TARGET_REACHED",
      realizedSignedRMultiple: 2,
      mae: 0.01,
      mfe: 0.04,
    }),
    evalRec({
      predictionId: "t2",
      evaluationId: "b",
      resultKind: "INVALIDATION_REACHED",
      realizedSignedRMultiple: -1,
      mae: 0.02,
      mfe: 0.01,
    }),
    evalRec({
      predictionId: "t3",
      evaluationId: "c",
      resultKind: "UNTRIGGERED",
      triggerStatus: "UNTRIGGERED",
      realizedSignedRMultiple: null,
      mae: null,
      mfe: null,
    }),
    evalRec({
      predictionId: "t4",
      evaluationId: "d",
      resultKind: "BOTH_AMBIGUOUS_SAME_CANDLE",
      realizedSignedRMultiple: null,
      mae: 0.01,
      mfe: 0.01,
    }),
    evalRec({
      predictionId: "t5",
      evaluationId: "e",
      resultKind: "EXPIRED_UNRESOLVED",
      realizedSignedRMultiple: null,
      mae: null,
      mfe: null,
    }),
  ];

  it("computes trigger rate with eligible denominator", () => {
    const report = buildChartsPerformanceAnalytics({ evaluations: population });
    expect(report.trigger.numerator).toBe(4);
    expect(report.trigger.denominator).toBe(5);
    expect(report.trigger.rate).toBeCloseTo(0.8, 8);
    expect(report.population.untriggered).toBe(1);
  });

  it("decisive win-rate excludes ambiguous/untriggered/expired", () => {
    const report = buildChartsPerformanceAnalytics({ evaluations: population });
    expect(report.winRate.numerator).toBe(1);
    expect(report.winRate.denominator).toBe(2);
    expect(report.winRate.winRate).toBeCloseTo(0.5, 8);
    expect(report.outcomeDistribution.BOTH_AMBIGUOUS_SAME_CANDLE).toBe(1);
    expect(report.outcomeDistribution.EXPIRED_UNRESOLVED).toBe(1);
  });

  it("signed-R stats exclude null/ambiguous and report distributions", () => {
    const stats = computeSignedRStats(population as any);
    expect(stats.count).toBe(2);
    expect(stats.mean).toBeCloseTo(0.5, 8);
    expect(stats.median).toBeCloseTo(0.5, 8);
    expect(stats.min).toBe(-1);
    expect(stats.max).toBe(2);
    expect(stats.positive).toBe(1);
    expect(stats.negative).toBe(1);
    expect(stats.zero).toBe(0);
    expect(stats.unavailable).toBe(3);
  });

  it("MAE/MFE use triggered finite values only", () => {
    const report = buildChartsPerformanceAnalytics({ evaluations: population });
    expect(report.mae.count).toBe(3);
    expect(report.mfe.count).toBe(3);
    expect(report.mae.mean).toBeCloseTo((0.01 + 0.02 + 0.01) / 3, 8);
    expect(computeDistributionStats([1, 3, 2]).median).toBe(2);
    expect(computeDistributionStats([]).mean).toBeNull();
  });

  it("empty decisive population returns null rates", () => {
    const empty = buildChartsPerformanceAnalytics({ evaluations: [] });
    expect(empty.population.eligibleDirectional).toBe(0);
    expect(empty.winRate.winRate).toBeNull();
    expect(empty.trigger.rate).toBeNull();
    expect(empty.signedR.count).toBe(0);
    expect(empty.warnings).toContain("NO_ELIGIBLE_EVALUATIONS");
    expect(computeRate(0, 0).rate).toBeNull();
  });
});

describe("P8.D version separation and filters", () => {
  it("separates evaluator and signed-R policy versions", () => {
    const rows = [
      evalRec({
        predictionId: "v1",
        evaluationId: "e1",
        evaluatorVersion: "1.0.0",
        signedRPolicyVersion: "1.0.0",
        realizedSignedRMultiple: 1,
      }),
      evalRec({
        predictionId: "v2",
        evaluationId: "e2",
        evaluatorVersion: "9.9.9",
        signedRPolicyVersion: "2.0.0",
        realizedSignedRMultiple: 2,
      }),
    ];
    const mixed = buildChartsPerformanceAnalytics({ evaluations: rows });
    expect(mixed.signedR.count).toBe(2);
    expect(mixed.signedR.evaluatorVersion).toBeNull();
    expect(mixed.signedR.signedRPolicyVersion).toBeNull();
    expect(mixed.warnings).toContain("MIXED_EVALUATOR_VERSIONS");
    expect(mixed.warnings).toContain("MIXED_SIGNED_R_POLICY_VERSIONS");

    const filtered = buildChartsPerformanceAnalytics({
      evaluations: rows,
      filters: { evaluatorVersion: "1.0.0", signedRPolicyVersion: "1.0.0" },
    });
    expect(filtered.population.selectedEvaluations).toBe(1);
    expect(filtered.signedR.evaluatorVersion).toBe("1.0.0");
  });

  it("filters by activation time, symbol, timeframe, direction, confidence", () => {
    const actNov = Math.floor(Date.parse("2026-11-01T00:00:00.000Z") / 1000);
    const actDec = Math.floor(Date.parse("2026-12-01T00:00:00.000Z") / 1000);
    const rows = [
      evalRec({
        predictionId: "f1",
        evaluationId: "e1",
        activationOpenTimeSec: actNov,
        symbol: "EURUSD",
        timeframe: "H1",
        direction: "BUY",
        analyticalConfidence: 0.4,
        computationTimestamp: "2026-11-01T12:00:00.000Z",
      }),
      evalRec({
        predictionId: "f2",
        evaluationId: "e2",
        activationOpenTimeSec: actDec,
        symbol: "GBPUSD",
        timeframe: "H4",
        direction: "SELL",
        analyticalConfidence: 0.9,
        computationTimestamp: "2026-12-01T00:00:00.000Z",
      }),
    ];
    const bySym = filterEvaluations(rows, {
      ...defaultAnalyticsFilters(),
      symbol: "EURUSD",
    });
    expect(bySym.selected).toHaveLength(1);

    const byTime = filterEvaluations(rows, {
      ...defaultAnalyticsFilters({
        startUtc: "2026-01-01T00:00:00.000Z",
        endUtc: "2026-11-15T00:00:00.000Z",
      }),
    });
    expect(byTime.selected).toHaveLength(1);
    expect(byTime.selected[0]!.predictionId).toBe("f1");

    const byConf = filterEvaluations(rows, {
      ...defaultAnalyticsFilters({ confidenceBucket: "≥0.75" }),
    });
    expect(byConf.selected).toHaveLength(1);
    expect(byConf.selected[0]!.predictionId).toBe("f2");

    const byComp = filterEvaluations(rows, {
      ...defaultAnalyticsFilters({
        timeBasis: "computationTimestamp",
        startUtc: "2026-11-15T00:00:00.000Z",
        endUtc: "2026-12-31T00:00:00.000Z",
      }),
    });
    expect(byComp.selected).toHaveLength(1);
    expect(byComp.selected[0]!.predictionId).toBe("f2");
  });
});

describe("P8.D breakdowns and sparse warnings", () => {
  it("groups by symbol/timeframe/direction/setup/confidence and flags sparse", () => {
    const report = buildChartsPerformanceAnalytics({
      evaluations: [
        evalRec({
          predictionId: "b1",
          evaluationId: "e1",
          symbol: "EURUSD",
          setupFingerprint: null,
          analyticalConfidence: null,
        }),
        evalRec({
          predictionId: "b2",
          evaluationId: "e2",
          symbol: "GBPUSD",
          direction: "SELL",
          timeframe: "H4",
          setupFingerprint: "setup-b",
          analyticalConfidence: 0.2,
        }),
      ],
      generatedAt: "2026-11-22T00:00:00.000Z",
    });
    expect(report.schemaVersion).toBe(HFM_CHARTS_PERFORMANCE_ANALYTICS_SCHEMA_VERSION);
    expect(report.policyVersion).toBe(HFM_CHARTS_PERFORMANCE_ANALYTICS_POLICY_VERSION);
    expect(report.breakdowns.symbol.map((r) => r.key).sort()).toEqual(["EURUSD", "GBPUSD"]);
    expect(report.breakdowns.timeframe.some((r) => r.key === "H4")).toBe(true);
    expect(report.breakdowns.direction.some((r) => r.key === "SELL")).toBe(true);
    expect(report.breakdowns.setupFingerprint.some((r) => r.key === "UNKNOWN")).toBe(true);
    expect(report.breakdowns.analyticalConfidence.some((r) => r.key === "UNKNOWN")).toBe(true);
    expect(report.breakdowns.analyticalConfidence.some((r) => r.key === "<0.5")).toBe(true);
    expect(report.warnings).toContain("INSUFFICIENT_SAMPLE");
    expect(
      report.breakdowns.symbol.every(
        (r) =>
          r.observationCount < HFM_CHARTS_INSUFFICIENT_SAMPLE_THRESHOLD
            ? r.sampleWarning === "INSUFFICIENT_SAMPLE"
            : r.sampleWarning == null,
      ),
    ).toBe(true);
    expect(report.placesOrders).toBe(false);
    expect(report.mutatesBroker).toBe(false);
    expect(report.notBrokerAccountPnl).toBe(true);
    expect(report.isNotCalibratedProbability).toBe(true);
  });

  it("includes pitManifest breakdown only in PER_PIT_MANIFEST mode", () => {
    const rows = [
      evalRec({
        predictionId: "p1",
        evaluationId: "e1",
        pitManifestId: "pit-a",
        datasetId: "ds-a",
      }),
      evalRec({
        predictionId: "p1",
        evaluationId: "e2",
        pitManifestId: "pit-b",
        datasetId: "ds-b",
        computationTimestamp: "2026-11-02T00:00:00.000Z",
      }),
    ];
    const latest = buildChartsPerformanceAnalytics({ evaluations: rows });
    expect((latest.breakdowns as any).pitManifest).toBeUndefined();
    const perPit = buildChartsPerformanceAnalytics({
      evaluations: rows,
      filters: { populationMode: "PER_PIT_MANIFEST" },
    });
    expect(perPit.population.selectedEvaluations).toBe(2);
    expect(perPit.breakdowns.pitManifest!.map((r) => r.key).sort()).toEqual([
      "pit-a",
      "pit-b",
    ]);
  });
});

describe("P8.D storage-backed analytics + reasoning counts", () => {
  let chartsRoot: string;
  let store: HfmChartsPredictionOutcomeStorage;

  beforeEach(() => {
    chartsRoot = tmpRoot("p8d-charts-");
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

  it("loads from storage with pagination boundary and empty population", async () => {
    const empty = await buildChartsPerformanceAnalyticsFromStorage({ storage: store });
    expect(empty.population.rawEvaluationRecords).toBe(0);
    expect(empty.winRate.winRate).toBeNull();

    await store.persistEvaluation(
      evalRec({
        predictionId: "s1",
        evaluationId: "cpe:s1",
        resultKind: "TARGET_REACHED",
      }),
    );
    const one = await buildChartsPerformanceAnalyticsFromStorage({ storage: store });
    expect(one.population.selectedEvaluations).toBe(1);
    expect(one.targetReached).toBe(1);
  });

  it("returns empty reasoning counts without fabricating when store is empty", async () => {
    const reasonRoot = tmpRoot("p8d-reason-");
    const empty = await scanReasoningPopulationCounts({ storageRoot: reasonRoot });
    expect(empty.authority).toBe("REASONING_STORE");
    expect(empty.completed).toBe(0);
    expect(empty.noTrade).toBe(0);
    expect(empty.waiting).toBe(0);
    expect(empty.scanned).toBe(0);
    fs.rmSync(reasonRoot, { recursive: true, force: true });
  });

  it("counts reasoning records with linkage and decisions", async () => {
    const reasonRoot = tmpRoot("p8d-reason2-");
    const reasonDir = path.join(reasonRoot, "mt5-hfm", "analysis", "reasoning");
    fs.mkdirSync(reasonDir, { recursive: true });
    const write = (id: string, body: Record<string, unknown>) => {
      fs.writeFileSync(path.join(reasonDir, `${id}.json`), JSON.stringify(body), "utf8");
    };
    write("r1", {
      createdAt: "2026-11-10T00:00:00.000Z",
      status: "COMPLETED",
      result: { decision: { action: "BUY" } },
      predictionLinkage: { predictionId: "p1", status: "LINKED" },
    });
    write("r2", {
      createdAt: "2026-11-11T00:00:00.000Z",
      status: "COMPLETED",
      result: { decision: { action: "NO_TRADE" } },
    });
    write("r3", {
      createdAt: "2026-11-12T00:00:00.000Z",
      status: "FAILED",
      result: { decision: { action: "WAITING_FOR_CONFIRMATION" } },
    });
    write("r4", {
      createdAt: "2026-11-13T00:00:00.000Z",
      status: "REJECTED",
      result: { decision: { action: "SELL" } },
    });
    const counts = await scanReasoningPopulationCounts({ storageRoot: reasonRoot });
    expect(counts.authority).toBe("REASONING_STORE");
    expect(counts.completed).toBe(2);
    expect(counts.failed).toBe(1);
    expect(counts.rejected).toBe(1);
    expect(counts.buy).toBe(1);
    expect(counts.sell).toBe(1);
    expect(counts.noTrade).toBe(1);
    expect(counts.waiting).toBe(1);
    expect(counts.withPredictionLinkage).toBe(1);
    expect(counts.withoutPredictionLinkage).toBe(3);

    const report = buildChartsPerformanceAnalytics({
      evaluations: [evalRec({ predictionId: "x", evaluationId: "ex" })],
      reasoningCounts: counts,
    });
    expect(report.totalCompletedAnalyses).toBe(2);
    expect(report.noTradeSkipped).toBe(1);
    expect(report.waitingSkipped).toBe(1);
    expect(report.warnings).not.toContain("REASONING_COUNTS_UNAVAILABLE");

    fs.rmSync(reasonRoot, { recursive: true, force: true });
  });
});

describe("P8.D safety stamps", () => {
  it("never claims broker P&L or calibrated probability", () => {
    const report = buildChartsPerformanceAnalytics({
      evaluations: [evalRec()],
    });
    expect(report.placesOrders).toBe(false);
    expect(report.mutatesBroker).toBe(false);
    expect(report.acceptsForExecution).toBe(false);
    expect(report.scheduledWorker).toBe(false);
    expect(report.notBrokerAccountPnl).toBe(true);
    expect(report.isNotCalibratedProbability).toBe(true);
    expect(report.warnings).toContain("NOT_BROKER_ACCOUNT_PNL");
    expect(report.warnings).toContain("ANALYTICAL_CONFIDENCE_NOT_WIN_PROBABILITY");
    expect(report.warnings).toContain("CALIBRATION_MINIMUM_NOT_MET");
    expect(report.analyticalConfidenceLabel).toMatch(/not win probability/i);
  });
});
