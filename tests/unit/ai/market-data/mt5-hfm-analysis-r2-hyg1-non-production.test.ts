/**
 * R2-HYG-1 — synthetic/smoke exclusion from production analytics & census.
 * Fixtures only; never deletes or rewrites evaluation records.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  HfmChartsPredictionOutcomeStorage,
  __setHfmChartsPredictionOutcomeStorageForTests,
  buildChartsCalibrationCensus,
  buildChartsCalibrationCensusFromStorage,
  buildChartsPerformanceAnalytics,
  buildChartsPerformanceAnalyticsFromStorage,
  classifyChartsProductionEligibility,
  filterChartsEvaluationsForProductionAnalytics,
  HFM_CHARTS_PREDICTION_OUTCOME_EVALUATOR_VERSION,
  HFM_CHARTS_SIGNED_R_POLICY_VERSION,
} from "../../../../ai/market-data/mt5-hfm/analysis/prediction-outcome/index";
import {
  MifPredictionOutcomeStorage,
  __setMifPredictionOutcomeStorageForTests,
  buildPredictionSnapshot,
} from "../../../../ai/market-data/mt5-hfm/mif/index";
import type { MifPredictionSnapshot } from "../../../../ai/market-data/mt5-hfm/mif/prediction-outcome/types";

function tmpRoot(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function evalRec(overrides: Record<string, unknown> = {}): any {
  const predictionId = String(overrides.predictionId ?? "pred-prod-1");
  const evaluationId = String(overrides.evaluationId ?? `cpe:${predictionId}:a`);
  const activation = Number(overrides.activationOpenTimeSec ?? 1_700_000_000);
  const provOverrides = (overrides.provenance as Record<string, unknown>) ?? {};
  return {
    contractId: "kwizera.hfm.charts-prediction-outcome.v1",
    contractVersion: "1.0.0",
    evaluatorId: "hfm-charts-prediction-outcome",
    evaluatorVersion: HFM_CHARTS_PREDICTION_OUTCOME_EVALUATOR_VERSION,
    evaluationId,
    predictionId,
    snapshotHash: "snap",
    resultKind: overrides.resultKind ?? "TARGET_REACHED",
    entryTrigger: {
      policyId: "hfm-charts-entry-trigger-policy",
      policyVersion: "1.0.0",
      status: "TRIGGERED",
      entryZone: { low: 1.09, high: 1.1 },
      entryZoneSource: "SNAPSHOT_STRUCTURED_ENTRY_POINT",
      touchRule: "CLOSED_CANDLE_RANGE_INTERSECTS_ZONE_AFTER_ACTIVATION",
      activationOpenTimeSec: activation,
      triggerOpenTimeSec: activation + 3600,
      triggerCloseTimeSec: activation + 7200,
      triggerReferencePrice: 1.1,
      triggerCandleExcludedFromLevelEval: true,
      barsScannedForTrigger: 1,
      reason: null,
    },
    realizedSignedRMultiple: 1.5,
    signedRDefinition: "test",
    signedRPolicyVersion: HFM_CHARTS_SIGNED_R_POLICY_VERSION,
    invalidationPrice: 1.08,
    entryPrice: 1.1,
    targetPrice: 1.13,
    exitPrice: 1.13,
    mae: 0.01,
    mfe: 0.03,
    observationCandleCount: 3,
    evaluationStartOpenTimeSec: activation + 3600,
    evaluationEndOpenTimeSec: activation + 10800,
    provenance: {
      predictionId,
      snapshotHash: "snap",
      analysisRunId: "analysis-prod-001",
      sourceAnalysisIdentity: "hfm-charts:analysis-prod-001",
      scenarioId: null,
      setupFingerprint: "setup-a",
      evidencePackageId: null,
      scenarioPackageId: null,
      symbol: "EURUSD",
      timeframe: "H1",
      direction: "BUY",
      analyticalConfidence: 72,
      confidenceSource: "REASONING_STORE",
      confidenceSemantics: "NON_PROBABILITY_ANALYTICAL_SCORE",
      pitManifestId: "pit-1",
      pitManifestContentIdentityHash: "pit-hash",
      datasetId: "ds-1",
      datasetVersion: 1,
      datasetContentHash: "ds-hash",
      candleRangeHash: "cr-hash",
      evaluatorVersion: HFM_CHARTS_PREDICTION_OUTCOME_EVALUATOR_VERSION,
      entryTriggerPolicyVersion: "1.0.0",
      signedRPolicyVersion: HFM_CHARTS_SIGNED_R_POLICY_VERSION,
      ...provOverrides,
    },
    levelOutcome: null,
    pathOutcome: null,
    mifOutcome: null,
    computationTimestamp: "2026-11-01T12:00:00.000Z",
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

function smokeSnapshot(): MifPredictionSnapshot {
  return buildPredictionSnapshot({
    candidateId: "vps-smoke",
    analysisRunId: "vps-smoke-analysis",
    reasoningRunId: "smoke-reasoning-run",
    activationOpenTimeSec: 1_700_000_000,
    instrument: "EURUSD",
    timeframe: "H1",
    direction: "BUY",
    entryPrice: 1.1,
    targetPrice: 1.14,
    targetSide: "ABOVE",
    invalidationPrice: 1.08,
    invalidationSide: "BELOW",
    sourceAnalysisIdentity: "vps-smoke",
    createdAt: "2026-11-01T00:00:00.000Z",
  });
}

describe("R2-HYG-1 non-production exclusion", () => {
  let storageRoot: string;
  let chartsStore: HfmChartsPredictionOutcomeStorage;
  let snapStore: MifPredictionOutcomeStorage;

  beforeEach(() => {
    storageRoot = tmpRoot("r2-hyg1-");
    chartsStore = new HfmChartsPredictionOutcomeStorage(storageRoot);
    snapStore = new MifPredictionOutcomeStorage(storageRoot);
    __setHfmChartsPredictionOutcomeStorageForTests(chartsStore);
    __setMifPredictionOutcomeStorageForTests(snapStore);
  });

  afterEach(() => {
    __setHfmChartsPredictionOutcomeStorageForTests(null);
    __setMifPredictionOutcomeStorageForTests(null);
    try {
      fs.rmSync(storageRoot, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it("1. excludes vps-smoke via trusted snapshot candidateId", () => {
    const snap = smokeSnapshot();
    const smoke = evalRec({
      predictionId: snap.predictionId,
      evaluationId: `cpe:${snap.predictionId}:a`,
      provenance: {
        analysisRunId: "analysis-x",
        sourceAnalysisIdentity: "hfm-charts:analysis-x",
      },
    });
    const map = new Map([[snap.predictionId, snap]]);
    const cls = classifyChartsProductionEligibility(smoke, snap);
    expect(cls.excludeFromProductionAnalytics).toBe(true);
    expect(cls.reasons).toContain("SMOKE_CANDIDATE_ID");
    const filtered = filterChartsEvaluationsForProductionAnalytics([smoke], map);
    expect(filtered.included).toHaveLength(0);
    expect(filtered.excludedNonProduction).toBe(1);
  });

  it("2. genuine production records remain eligible", () => {
    const prod = evalRec();
    const cls = classifyChartsProductionEligibility(prod, null);
    expect(cls.class).toBe("PRODUCTION_ELIGIBLE");
    expect(cls.excludeFromProductionAnalytics).toBe(false);
    const filtered = filterChartsEvaluationsForProductionAnalytics([prod]);
    expect(filtered.included).toHaveLength(1);
  });

  it("3. client-supplied production flags cannot override server provenance", () => {
    const snap = smokeSnapshot();
    const smoke = evalRec({
      predictionId: snap.predictionId,
      provenance: { confidenceSource: "TEST_OVERRIDE" },
    });
    const cls = classifyChartsProductionEligibility(smoke, snap, {
      isProduction: true,
      productionEligible: true,
      excludeFromAnalytics: false,
    });
    expect(cls.excludeFromProductionAnalytics).toBe(true);
    expect(cls.ignoredClientProductionClaim).toBe(true);
    expect(cls.reasons).toContain("CLIENT_FLAG_IGNORED_TRUSTED_SMOKE");
    expect(cls.reasons).toContain("TEST_OVERRIDE_CONFIDENCE");
  });

  it("4. legacy unmarked records are included conservatively and transparently", () => {
    const legacy = evalRec({
      provenance: {
        analysisRunId: null,
        sourceAnalysisIdentity: null,
        confidenceSource: "REASONING_STORE",
      },
    });
    const cls = classifyChartsProductionEligibility(legacy, null);
    expect(cls.class).toBe("LEGACY_UNMARKED");
    expect(cls.excludeFromProductionAnalytics).toBe(false);
    const filtered = filterChartsEvaluationsForProductionAnalytics([legacy]);
    expect(filtered.legacyUnmarkedIncluded).toBe(1);
    expect(filtered.included).toHaveLength(1);
  });

  it("5. performance analytics and calibration census share the same eligibility policy", async () => {
    const prod = evalRec({ predictionId: "pred-prod", evaluationId: "cpe:pred-prod:a" });
    const snap = smokeSnapshot();
    const smoke = evalRec({
      predictionId: snap.predictionId,
      evaluationId: `cpe:${snap.predictionId}:a`,
      provenance: { confidenceSource: "TEST_OVERRIDE", analyticalConfidence: 80 },
    });
    await chartsStore.persistEvaluation(prod);
    await chartsStore.persistEvaluation(smoke);
    const snapPersist = await snapStore.persistSnapshot(snap);
    expect(snapPersist.ok).toBe(true);

    const perf = await buildChartsPerformanceAnalyticsFromStorage({ storage: chartsStore });
    const census = await buildChartsCalibrationCensusFromStorage({ storage: chartsStore });

    expect(perf.productionEligibility?.excludedNonProduction).toBeGreaterThanOrEqual(1);
    expect(census.productionEligibility?.excludedNonProduction).toBeGreaterThanOrEqual(1);
    expect(perf.productionEligibility?.policyId).toBe(
      census.productionEligibility?.policyId,
    );
    expect(perf.productionEligibility?.policyVersion).toBe(
      census.productionEligibility?.policyVersion,
    );
    expect(perf.population.rawEvaluationRecords).toBe(1);
    expect(census.totalEvaluations).toBe(1);
  });

  it("6. existing evaluation records remain immutable", async () => {
    const rec = evalRec({ predictionId: "pred-imm", evaluationId: "cpe:pred-imm:a" });
    const first = await chartsStore.persistEvaluation(rec);
    expect(first.ok).toBe(true);
    const mutated = {
      ...rec,
      resultKind: "INVALIDATION_REACHED",
      realizedSignedRMultiple: -1,
    };
    const second = await chartsStore.persistEvaluation(mutated as any);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.code).toBe("EVALUATION_IMMUTABLE_CONFLICT");
    const loaded = await chartsStore.getEvaluation("cpe:pred-imm:a");
    expect(loaded?.resultKind).toBe("TARGET_REACHED");
    expect(loaded?.realizedSignedRMultiple).toBe(1.5);
  });

  it("7. exclusion counts and reasons are observable without leaking sensitive data", () => {
    const snap = smokeSnapshot();
    const smoke = evalRec({
      predictionId: snap.predictionId,
      evaluationId: `cpe:${snap.predictionId}:a`,
      provenance: { confidenceSource: "TEST_OVERRIDE" },
    });
    const prod = evalRec({ predictionId: "pred-ok", evaluationId: "cpe:pred-ok:a" });
    const filtered = filterChartsEvaluationsForProductionAnalytics(
      [smoke, prod],
      new Map([[snap.predictionId, snap]]),
      new Map([
        [
          smoke.evaluationId,
          { isProduction: true, apiToken: "SECRET_SHOULD_NOT_APPEAR" },
        ],
      ]),
    );
    const diagBlob = JSON.stringify({
      excludedNonProduction: filtered.excludedNonProduction,
      excludedNonProductionByReason: filtered.excludedNonProductionByReason,
      clientProductionClaimsIgnored: filtered.clientProductionClaimsIgnored,
    });
    expect(filtered.excludedNonProduction).toBe(1);
    expect(filtered.excludedNonProductionByReason.TEST_OVERRIDE_CONFIDENCE).toBe(1);
    expect(filtered.clientProductionClaimsIgnored).toBe(1);
    expect(diagBlob).not.toContain("SECRET_SHOULD_NOT_APPEAR");
    expect(diagBlob).not.toContain("apiToken");
  });

  it("pure builders still accept pre-filtered lists (unchanged contract)", () => {
    const prod = evalRec();
    const perf = buildChartsPerformanceAnalytics({ evaluations: [prod] });
    const census = buildChartsCalibrationCensus([prod]);
    expect(perf.population.rawEvaluationRecords).toBe(1);
    expect(census.totalEvaluations).toBe(1);
  });
});
