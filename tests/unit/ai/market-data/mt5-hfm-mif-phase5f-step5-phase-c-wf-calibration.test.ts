/**
 * Phase 5F STEP 5 Phase C — WF-aware calibration tests (local).
 */
import { describe, expect, it } from "vitest";
import {
  buildEvidenceLinkage,
  buildProbabilityFreeze,
  clippedLogLoss,
  computeWfCalibrationMetrics,
  resolveWfStatusFromOosCount,
  runWalkForwardCalibration,
  type MifBacktestRunManifest,
  type MifProbabilityAssessment,
  MIF_PROBABILITY_INTELLIGENCE_CONTRACT_ID,
  MIF_PROBABILITY_INTELLIGENCE_CONTRACT_VERSION,
  MIF_PROBABILITY_INTELLIGENCE_ENGINE_ID,
  MIF_PROBABILITY_INTELLIGENCE_ENGINE_VERSION,
  MIF_PROBABILITY_INTELLIGENCE_POLICY_ID,
  MIF_PROBABILITY_INTELLIGENCE_POLICY_VERSION,
} from "../../../../ai/market-data/mt5-hfm/mif/index.js";

function assessment(overrides: Partial<MifProbabilityAssessment> = {}): MifProbabilityAssessment {
  return {
    contractId: MIF_PROBABILITY_INTELLIGENCE_CONTRACT_ID,
    contractVersion: MIF_PROBABILITY_INTELLIGENCE_CONTRACT_VERSION,
    assessmentId: "prob:c1",
    evidenceAssessmentId: null,
    rankingRunId: null,
    analysisRunId: "run-1",
    candidateId: "cand-1",
    providerId: "HFM_MT5",
    providerSymbol: "EURUSD",
    strategyId: "TREND_CONTINUATION",
    direction: "BUY",
    primaryTimeframe: "M15",
    marketRegime: null,
    targetEvent: "TARGET_REACHED_BEFORE_INVALIDATION_WITHIN_HORIZON",
    targetEventDefinition: "P(TARGET before INVALIDATION)",
    probability: 0.7,
    rawEmpiricalFrequency: 0.7,
    successCount: 7,
    eligibleResolvedDenominator: 10,
    excludedObservationCounts: {},
    sampleStatus: "SUFFICIENT",
    confidenceInterval: null,
    cohort: null,
    evaluationHorizonBars: 16,
    historicalWindow: { fromIso: null, toIso: null },
    calibrationStatus: "UNCALIBRATED",
    calibrationMetrics: null,
    reliabilityStatus: "LOW_RELIABILITY",
    reliabilityNotes: [],
    limitations: [],
    policyId: MIF_PROBABILITY_INTELLIGENCE_POLICY_ID,
    policyVersion: MIF_PROBABILITY_INTELLIGENCE_POLICY_VERSION,
    engineId: MIF_PROBABILITY_INTELLIGENCE_ENGINE_ID,
    engineVersion: MIF_PROBABILITY_INTELLIGENCE_ENGINE_VERSION,
    calculatedAt: "2024-01-01T00:00:00.000Z",
    inputIdentity: "inp",
    isWinProbability: true,
    isGuaranteedOutcome: false,
    isExecutionApproval: false,
    executionReadiness: false,
    isHistoricalFrequencyOnly: false,
    isCalibratedPrediction: false,
    doesNotApproveAiReasoning: true,
    analyticalProbabilityOnly: true,
    notExecutable: true,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    ...overrides,
  };
}

describe("Phase 5C — freeze provenance trust", () => {
  it("marks LIMITED when only calculatedAt is available", () => {
    const r = buildProbabilityFreeze({ assessment: assessment() });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.freeze.provenanceTrust).toBe("LIMITED");
    expect(r.freeze.predictionTimeProvenance).toBe("ASSESSMENT_CALCULATED_AT_LIMITED");
  });

  it("marks HIGH with explicit predictionAvailableAt", () => {
    const r = buildProbabilityFreeze({
      assessment: assessment(),
      predictionAvailableAt: "2024-01-01T00:00:00.000Z",
      predictionId: "pred:1",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.freeze.provenanceTrust).toBe("HIGH");
  });

  it("rejects calculatedAt after snapshot activation", () => {
    const r = buildProbabilityFreeze({
      assessment: assessment({ calculatedAt: "2024-01-02T00:00:00.000Z" }),
      snapshotActivationAt: "2024-01-01T00:00:00.000Z",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("UNTRUSTWORTHY_CALCULATED_AT");
  });
});

describe("Phase 5C — calibration metrics", () => {
  it("computes Brier and clipped log loss", () => {
    const m = computeWfCalibrationMetrics([
      { probability: 1, outcome: 1 },
      { probability: 0, outcome: 0 },
    ]);
    expect(m.brierScore).toBe(0);
    expect(m.logLoss).toBeCloseTo(clippedLogLoss(1, 1), 10);
    expect(m.sampleCount).toBe(2);
    expect(m.maximumCalibrationError).toBeNull();
    expect(m.mceSuppressedReason).toBeTruthy();
  });

  it("threshold vocabulary at 29/30/99/100", () => {
    expect(
      resolveWfStatusFromOosCount(29, {
        temporalLeakage: false,
        incompatibleTarget: false,
        invalidProvenance: false,
        unfrozenOnly: false,
        provisionalThreshold: 30,
        calibratedThreshold: 100,
        allowCalibratedClaim: false,
      }).status,
    ).toBe("INSUFFICIENT_DATA");
    expect(
      resolveWfStatusFromOosCount(30, {
        temporalLeakage: false,
        incompatibleTarget: false,
        invalidProvenance: false,
        unfrozenOnly: false,
        provisionalThreshold: 30,
        calibratedThreshold: 100,
        allowCalibratedClaim: false,
      }).status,
    ).toBe("PROVISIONAL_EVALUATION");
    expect(
      resolveWfStatusFromOosCount(99, {
        temporalLeakage: false,
        incompatibleTarget: false,
        invalidProvenance: false,
        unfrozenOnly: false,
        provisionalThreshold: 30,
        calibratedThreshold: 100,
        allowCalibratedClaim: false,
      }).status,
    ).toBe("PROVISIONAL_EVALUATION");
    expect(
      resolveWfStatusFromOosCount(100, {
        temporalLeakage: false,
        incompatibleTarget: false,
        invalidProvenance: false,
        unfrozenOnly: false,
        provisionalThreshold: 30,
        calibratedThreshold: 100,
        allowCalibratedClaim: false,
      }).status,
    ).toBe("CALIBRATION_EVALUATED");
  });

  it("rejects temporal leakage status", () => {
    expect(
      resolveWfStatusFromOosCount(50, {
        temporalLeakage: true,
        incompatibleTarget: false,
        invalidProvenance: false,
        unfrozenOnly: false,
        provisionalThreshold: 30,
        calibratedThreshold: 100,
        allowCalibratedClaim: false,
      }).status,
    ).toBe("REJECTED_TEMPORAL_LEAKAGE");
  });
});

describe("Phase 5C — WF run isolation (empty / no false CALIBRATED)", () => {
  it("returns NOT_CALIBRATED / UNFROZEN without inventing data", () => {
    const manifest = {
      runId: "bt:test",
      runHash: "hash",
      mode: "WALK_FORWARD",
      dataset: { datasetId: "ds", contentHash: "ch", version: 1, status: "COMPLETE" },
      folds: [
        {
          foldIndex: 0,
          status: "INSUFFICIENT_SAMPLE",
          failureReason: null,
          is: { label: "IS", startOpenTimeSec: 1000, endOpenTimeSec: 2000, tipCount: 10 },
          val: { label: "VAL", startOpenTimeSec: 2000, endOpenTimeSec: 2500, tipCount: 5 },
          oos: { label: "OOS", startOpenTimeSec: 2500, endOpenTimeSec: 3000, tipCount: 5 },
          purgeBars: 16,
          embargoBars: 16,
          eligibleOosPredictions: 0,
          decisiveOosSamples: 0,
          minOosSamplesRequired: 30,
          exclusions: [],
          oosMetrics: {} as never,
          oosLedger: null,
          primaryMetric: "TARGET_RATE",
          primaryMetricValue: null,
        },
      ],
    } as unknown as MifBacktestRunManifest;

    const { run } = runWalkForwardCalibration({
      backtestManifest: manifest,
      tips: [],
      freezes: [],
      outcomes: [],
      createdAt: "2024-01-01T00:00:00.000Z",
    });
    expect(run.walkForwardCalibrated).toBe(false);
    expect(run.modelFitPerformed).toBe(false);
    expect(run.status).not.toBe("CALIBRATED");
    expect(["UNFROZEN", "NOT_CALIBRATED", "INSUFFICIENT_DATA"]).toContain(run.status);
  });
});

describe("Phase 5C — evidence linkage", () => {
  it("never invents linkage from empty ids", () => {
    const r = buildEvidenceLinkage({});
    expect(r.ok).toBe(false);
  });

  it("records LINKAGE_UNAVAILABLE explicitly", () => {
    const r = buildEvidenceLinkage({
      markUnavailable: true,
      predictionId: "pred:1",
      unavailableReason: "LINKAGE_UNAVAILABLE",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.linkage.status).toBe("LINKAGE_UNAVAILABLE");
    expect(r.linkage.neverInferredFromProximity).toBe(true);
  });

  it("links only with genuine paired ids", () => {
    const r = buildEvidenceLinkage({
      searchId: "search:1",
      analogueId: "an:1",
      predictionId: "pred:1",
      freezeId: "pfrz:1",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.linkage.status).toBe("LINKED");
  });
});
