/**
 * Phase 5F STEP 5 Phase B — probability freeze unit tests (local only).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  MIF_PROBABILITY_FREEZE_CONTRACT_ID,
  MIF_PROBABILITY_INTELLIGENCE_CONTRACT_ID,
  MIF_PROBABILITY_INTELLIGENCE_CONTRACT_VERSION,
  MIF_PROBABILITY_INTELLIGENCE_ENGINE_ID,
  MIF_PROBABILITY_INTELLIGENCE_ENGINE_VERSION,
  MIF_PROBABILITY_INTELLIGENCE_POLICY_ID,
  MIF_PROBABILITY_INTELLIGENCE_POLICY_VERSION,
  __setMifProbabilityFreezeStorageForTests,
  buildProbabilityFreeze,
  buildProbabilityFreezeRevision,
  getMifProbabilityFreezeStorage,
  resolveAssessmentFreezeStatus,
  type MifProbabilityAssessment,
} from "../../../../ai/market-data/mt5-hfm/mif/index.js";

function baseAssessment(
  overrides: Partial<MifProbabilityAssessment> = {},
): MifProbabilityAssessment {
  return {
    contractId: MIF_PROBABILITY_INTELLIGENCE_CONTRACT_ID,
    contractVersion: MIF_PROBABILITY_INTELLIGENCE_CONTRACT_VERSION,
    assessmentId: "prob:test-assess-1",
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
    targetEventDefinition:
      "P(TARGET_REACHED before INVALIDATION within evaluation horizon)",
    probability: 0.62,
    rawEmpiricalFrequency: 0.62,
    successCount: 31,
    eligibleResolvedDenominator: 50,
    excludedObservationCounts: {},
    sampleStatus: "SUFFICIENT",
    confidenceInterval: null,
    cohort: null,
    evaluationHorizonBars: 200,
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
    calculatedAt: "2024-06-01T12:00:00.000Z",
    inputIdentity: "inp-1",
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

describe("Phase 5F STEP 5 Phase B — probability freeze", () => {
  const tmpDirs: string[] = [];
  afterEach(() => {
    __setMifProbabilityFreezeStorageForTests(null);
    for (const d of tmpDirs.splice(0)) {
      try {
        fs.rmSync(d, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  });

  it("rejects missing predictedAt (never substitutes now)", () => {
    const r = buildProbabilityFreeze({
      assessment: baseAssessment({ calculatedAt: "" }),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("MISSING_PREDICTED_AT");
  });

  it("rejects assessment after outcome resolution", () => {
    const r = buildProbabilityFreeze({
      assessment: baseAssessment({ calculatedAt: "2024-06-02T00:00:00.000Z" }),
      outcomeResolvedAt: "2024-06-01T00:00:00.000Z",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ASSESSMENT_AFTER_OUTCOME");
  });

  it("rejects invalid probability", () => {
    const r = buildProbabilityFreeze({
      assessment: baseAssessment({ probability: null }),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("INVALID_PROBABILITY");
  });

  it("rejects probability outside [0,1]", () => {
    const r = buildProbabilityFreeze({
      assessment: baseAssessment({ probability: 1.5 as unknown as number }),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("INVALID_PROBABILITY");
  });

  it("builds freeze with prediction-time semantics and NOT_CALIBRATED claim", () => {
    const r = buildProbabilityFreeze({
      assessment: baseAssessment(),
      predictionId: "pred:abc",
      sourceDatasetId: "ds1",
      sourceDatasetVersion: 1,
      sourceContentHash: "hashabc",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.freeze.contractId).toBe(MIF_PROBABILITY_FREEZE_CONTRACT_ID);
    expect(r.freeze.probability).toBe(0.62);
    expect(r.freeze.predictedAt).toBe("2024-06-01T12:00:00.000Z");
    expect(r.freeze.predictionId).toBe("pred:abc");
    expect(r.freeze.calibrationClaim).toBe("NOT_CALIBRATED");
    expect(r.freeze.isCalibratedProbability).toBe(false);
    expect(r.freeze.isWalkForwardCalibrated).toBe(false);
    expect(r.freeze.placesOrders).toBe(false);
    expect(r.freeze.mutatesBroker).toBe(false);
    expect(r.freeze.acceptsForExecution).toBe(false);
  });

  it("duplicate freeze persist is idempotent; conflicting hash refuses overwrite", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "mif-freeze-"));
    tmpDirs.push(root);
    const store = getMifProbabilityFreezeStorage(root);
    __setMifProbabilityFreezeStorageForTests(store);
    const built = buildProbabilityFreeze({ assessment: baseAssessment() });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const a = await store.persistFreeze(built.freeze);
    const b = await store.persistFreeze(built.freeze);
    expect(a).toEqual({ ok: true, created: true });
    expect(b).toEqual({ ok: true, created: false });

    const conflict = await store.persistFreeze({
      ...built.freeze,
      freezeHash: "different-hash",
    });
    expect(conflict.ok).toBe(false);
    if (!conflict.ok) expect(conflict.code).toBe("FREEZE_IMMUTABLE_CONFLICT");
  });

  it("unlinked assessments remain UNFROZEN / NOT_CALIBRATED", () => {
    const status = resolveAssessmentFreezeStatus({
      assessment: baseAssessment(),
      freeze: null,
    });
    expect(status.lifecycle).toBe("UNFROZEN");
    expect(status.calibrationClaim).toBe("NOT_CALIBRATED");
    expect(status.reasons).toContain("no_immutable_prediction_time_freeze");
  });

  it("revision creates new immutable freeze with provenance", () => {
    const first = buildProbabilityFreeze({ assessment: baseAssessment() });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const rev = buildProbabilityFreezeRevision({
      prior: first.freeze,
      assessment: baseAssessment({
        assessmentId: "prob:test-assess-2",
        probability: 0.55,
        calculatedAt: "2024-06-01T11:00:00.000Z",
      }),
      revisionReason: "corrected_assessment",
    });
    expect(rev.ok).toBe(true);
    if (!rev.ok) return;
    expect(rev.freeze.freezeId).not.toBe(first.freeze.freezeId);
    expect(rev.freeze.supersedesFreezeId).toBe(first.freeze.freezeId);
    expect(rev.freeze.revisionOrdinal).toBe(2);
    expect(rev.freeze.revisionReason).toBe("corrected_assessment");
    expect(rev.freeze.probability).toBe(0.55);
  });
});
