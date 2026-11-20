/**
 * Phase 5E Step 2 — Evidence Intelligence + Probability Intelligence.
 * Fixture-based; live HFM verification is separate on VPS.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  MIF_PROVIDER_ID,
  MIF_EVIDENCE_INTELLIGENCE_CONTRACT_ID,
  MIF_PROBABILITY_INTELLIGENCE_CONTRACT_ID,
  MIF_OPPORTUNITY_CANDIDATE_CONTRACT_ID,
  MIF_OPPORTUNITY_CANDIDATE_CONTRACT_VERSION,
  MIF_POLICY_HFM_PROBABILITY,
  assessEvidenceIntelligence,
  assessProbabilityIntelligence,
  selectHistoricalCohort,
  estimateOpportunityProbability,
  wilsonConfidenceInterval,
  buildCalibrationRun,
  computeCalibrationMetrics,
  assessProbabilityReliability,
  runMifHfmOpportunityPipelineFromSeriesPersisted,
  __setMifOpportunityStorageForTests,
  MifOpportunityStorage,
  getMifOdWorkerStatus,
  type MifOpportunityCandidate,
  type MifDetectionEvidenceRef,
  type MifPersistedCandidate,
  type MifOutcomeEvaluationRecord,
} from "../../../../ai/market-data/mt5-hfm/mif/index";

function ev(
  partial: Partial<MifDetectionEvidenceRef> & Pick<MifDetectionEvidenceRef, "evidenceId" | "family">,
): MifDetectionEvidenceRef {
  return {
    presence: "PRESENT",
    sourceEngine: "test",
    sourceContractId: "test.contract",
    sourceContractVersion: "1.0.0",
    sourcePolicyVersion: "1.0.0",
    sourceAssessmentId: partial.sourceAssessmentId ?? `assess:${partial.evidenceId}`,
    sourceInputIdentity: partial.sourceInputIdentity ?? `input:${partial.evidenceId}`,
    timeframe: "H1",
    timeframeRole: "PRIMARY_DIRECTION",
    assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    qualityStatus: "VALID",
    candleState: "CLOSED",
    notes: "",
    ...partial,
  };
}

function candidate(
  partial: Partial<MifOpportunityCandidate> & { candidateId: string; strategyId: string },
): MifOpportunityCandidate {
  return {
    contractId: MIF_OPPORTUNITY_CANDIDATE_CONTRACT_ID,
    contractVersion: MIF_OPPORTUNITY_CANDIDATE_CONTRACT_VERSION,
    detectorId: "test-detector",
    detectorVersion: "1.0.0",
    strategyDefinitionVersion: "1.0.0",
    policyVersion: "1.0.0",
    providerId: MIF_PROVIDER_ID,
    providerSymbol: "XAUUSD",
    instrument: null,
    direction: "BUY",
    timeframeRoles: ["PRIMARY_DIRECTION"],
    assessmentTimestamp: "2024-06-01T00:00:00.000Z",
    status: "DETECTED",
    thesis: "test",
    rationale: "test",
    supportingEvidenceIds: [],
    conflictingEvidenceIds: [],
    requiredConfirmations: [],
    invalidationConditions: [],
    knownLimitations: [],
    quality: null,
    regimeAssessmentId: null,
    mtfAssessmentId: null,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    doesNotApproveAiReasoning: true,
    analyticalCandidateOnly: true,
    notExecutable: true,
    ...partial,
  };
}

function persisted(
  partial: Partial<MifPersistedCandidate> & {
    candidateId: string;
    strategyId: string;
    createdAt: string;
    outcomeKind: MifPersistedCandidate["outcomeKind"];
  },
): MifPersistedCandidate {
  const snap = candidate({
    candidateId: partial.candidateId,
    strategyId: partial.strategyId,
    direction: (partial.direction as "BUY" | "SELL") ?? "BUY",
  });
  return {
    schemaVersion: "1.0.0",
    runId: "run-hist",
    detectorId: "test",
    providerId: "HFM_MT5",
    providerSymbol: "XAUUSD",
    direction: "BUY",
    detectionStatus: "DETECTED",
    lifecycleState: partial.outcomeKind === "TARGET_REACHED" ? "COMPLETED" : "INVALIDATED",
    timeframeRoles: ["PRIMARY_DIRECTION"],
    assessmentTimestamp: partial.createdAt,
    updatedAt: partial.createdAt,
    supportingEvidenceIds: [],
    conflictingEvidenceIds: [],
    requiredConfirmations: [],
    invalidationConditions: [],
    dataQualityStatus: "VALID",
    mtfRelation: "ALIGNMENT",
    thesis: "targetPrice=2100 targetSide=ABOVE invalidationPrice=2000 invalidationSide=BELOW",
    rationale: "entryPrice=2050",
    candidateSnapshot: {
      ...snap,
      thesis: "targetPrice=2100 targetSide=ABOVE invalidationPrice=2000 invalidationSide=BELOW",
      rationale: "entryPrice=2050",
    },
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    notExecutable: true,
    ...partial,
  };
}

function evaluation(
  candidateId: string,
  kind: "TARGET_REACHED" | "INVALIDATION_REACHED",
  ts: string,
): MifOutcomeEvaluationRecord {
  return {
    contractId: "kwizera.mif.outcome-evaluation.v1",
    contractVersion: "1.0.0",
    engineId: "mif-outcome-evaluation",
    engineVersion: "1.0.0",
    evaluationId: `ev:${candidateId}`,
    evaluationTimestamp: ts,
    candidateId,
    opportunitySnapshotRef: candidateId,
    activationOpenTimeSec: 1_700_000_000,
    entryActivationRule: "AFTER_ACTIVATION_CANDLE_CLOSE",
    levels: {
      targetPrice: 2100,
      targetSide: "ABOVE",
      invalidationPrice: 2000,
      invalidationSide: "BELOW",
      entryPrice: 2050,
    },
    resultKind: kind,
    outcomeKind: kind,
    resolvedOpenTimeSec: 1_700_003_600,
    resolvedClose: kind === "TARGET_REACHED" ? 2101 : 1999,
    barsObserved: 10,
    barsExcludedBeforeActivation: 0,
    duplicateObservationsDropped: 0,
    gapDetected: false,
    ambiguityReason: null,
    exclusionReason: null,
    realizedRMultiple: kind === "TARGET_REACHED" ? 1 : -1,
    realizedRMultipleDefinition: "test",
    sourceMarketDataRefs: { candleOpenTimeSecs: [], candleCount: 0 },
    evaluationInputsHash: "hash",
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    doesNotApproveAiReasoning: true,
    analyticalOutcomeOnly: true,
  };
}

function bars(n = 80) {
  const T0 = 1_700_000_000;
  const out = [];
  for (let i = 0; i < n; i++) {
    const c = 2000 + i * 0.35;
    const bump = i % 7 === 3 ? 1.8 : i % 7 === 6 ? -0.9 : 0;
    const close = c + bump;
    out.push({
      time: T0 + i * 3600,
      open: close - 0.15,
      high: close + 0.4,
      low: close - 0.4,
      close,
      tickVolume: 10,
      realVolume: null,
      spread: 2,
      validationStatus: "ok" as const,
      provenance: "native" as const,
    });
  }
  return out;
}

describe("Phase 5E Step 2 — evidence intelligence", () => {
  it("classifies supporting vs contradicting without mutating evidence", () => {
    const evidence = [
      ev({ evidenceId: "ms", family: "MARKET_STRUCTURE", notes: "bias=BULLISH" }),
      ev({
        evidenceId: "mtf",
        family: "MULTI_TIMEFRAME_RELATIONSHIP",
        notes: "relation=CONFLICT",
      }),
      ev({ evidenceId: "dq", family: "DATA_QUALITY" }),
    ];
    const frozen = JSON.stringify(evidence);
    const c = candidate({
      candidateId: "c1",
      strategyId: "TREND_CONTINUATION",
      supportingEvidenceIds: ["ms", "dq"],
      conflictingEvidenceIds: ["mtf"],
    });
    const a = assessEvidenceIntelligence({
      candidate: c,
      evidence,
      assessedAt: "2024-06-01T00:00:00.000Z",
    });
    expect(a.contractId).toBe(MIF_EVIDENCE_INTELLIGENCE_CONTRACT_ID);
    expect(a.placesOrders).toBe(false);
    expect(a.supporting.length).toBeGreaterThan(0);
    expect(a.contradicting.length).toBeGreaterThan(0);
    expect(JSON.stringify(evidence)).toBe(frozen);
    const again = assessEvidenceIntelligence({
      candidate: c,
      evidence,
      assessedAt: "2024-06-01T00:00:00.000Z",
    });
    expect(again.inputIdentity).toBe(a.inputIdentity);
  });

  it("does not treat missing required evidence as negative polarity proof", () => {
    const a = assessEvidenceIntelligence({
      candidate: candidate({ candidateId: "c-miss", strategyId: "TREND_CONTINUATION" }),
      evidence: [ev({ evidenceId: "dq", family: "DATA_QUALITY" })],
      assessedAt: "2024-06-01T00:00:00.000Z",
    });
    expect(a.missing.length).toBeGreaterThan(0);
    expect(a.contradicting.every((x) => x.polarity !== "MISSING")).toBe(true);
  });
});

describe("Phase 5E Step 2 — Wilson + reliability", () => {
  it("computes Wilson interval within [0,1]", () => {
    const ci = wilsonConfidenceInterval(7, 10, 0.95);
    expect(ci).not.toBeNull();
    expect(ci!.lower).toBeGreaterThanOrEqual(0);
    expect(ci!.upper).toBeLessThanOrEqual(1);
    expect(ci!.method).toBe("WILSON");
  });

  it("marks insufficient reliability below min sample", () => {
    const r = assessProbabilityReliability({
      sampleStatus: "INSUFFICIENT_SAMPLE",
      eligibleResolvedDenominator: 3,
      confidenceInterval: wilsonConfidenceInterval(2, 3, 0.95),
      calibrationStatus: "UNCALIBRATED",
    });
    expect(r.status).toBe("INSUFFICIENT_RELIABILITY");
  });
});

describe("Phase 5E Step 2 — cohorts and estimation", () => {
  const hist: MifPersistedCandidate[] = [];
  const evals: MifOutcomeEvaluationRecord[] = [];
  for (let i = 0; i < 12; i++) {
    const id = `h${i}`;
    const win = i % 3 !== 0;
    hist.push(
      persisted({
        candidateId: id,
        strategyId: "TREND_CONTINUATION",
        createdAt: `2024-01-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`,
        outcomeKind: win ? "TARGET_REACHED" : "INVALIDATION_REACHED",
        direction: "BUY",
      }),
    );
    evals.push(
      evaluation(
        id,
        win ? "TARGET_REACHED" : "INVALIDATION_REACHED",
        `2024-02-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`,
      ),
    );
  }

  it("excludes future peers (no leakage)", () => {
    const cohort = selectHistoricalCohort({
      subject: {
        candidateId: "subject",
        strategyId: "TREND_CONTINUATION",
        providerSymbol: "XAUUSD",
        direction: "BUY",
        primaryTimeframe: "H1",
        asOfIso: "2024-01-05T00:00:00.000Z",
      },
      historicalCandidates: hist,
      evaluations: evals,
      targetEvent: "TARGET_REACHED_BEFORE_INVALIDATION_WITHIN_HORIZON",
      minSample: 10,
      allowBroaderFallback: true,
    });
    expect(cohort.includedCandidateIds.every((id) => {
      const p = hist.find((h) => h.candidateId === id)!;
      return p.createdAt <= "2024-01-05T00:00:00.000Z";
    })).toBe(true);
    expect(cohort.excluded.some((e) => e.reason === "future_peer_excluded_no_leakage")).toBe(
      true,
    );
  });

  it("returns null probability when sample insufficient; keeps raw frequency", () => {
    const c = candidate({
      candidateId: "subject-small",
      strategyId: "TREND_CONTINUATION",
      thesis: "targetPrice=2100 targetSide=ABOVE invalidationPrice=2000 invalidationSide=BELOW",
      rationale: "entryPrice=2050",
    });
    const est = estimateOpportunityProbability({
      candidate: c,
      historicalCandidates: hist.slice(0, 4),
      evaluations: evals.slice(0, 4),
      asOfIso: "2024-12-01T00:00:00.000Z",
      calculatedAt: "2024-12-01T00:00:00.000Z",
      primaryTimeframe: "H1",
    });
    expect(est.contractId).toBe(MIF_PROBABILITY_INTELLIGENCE_CONTRACT_ID);
    expect(est.probability).toBeNull();
    expect(est.sampleStatus).toBe("INSUFFICIENT_SAMPLE");
    expect(est.rawEmpiricalFrequency).not.toBeNull();
    expect(est.isGuaranteedOutcome).toBe(false);
    expect(est.executionReadiness).toBe(false);
    expect(est.limitations.some((l) => /minSample=/.test(l))).toBe(true);
    expect(MIF_POLICY_HFM_PROBABILITY.minSampleForProbability).toBe(10);
  });

  it("returns UNAVAILABLE / LEVELS_NOT_PROVIDED without inventing levels", () => {
    const est = estimateOpportunityProbability({
      candidate: candidate({
        candidateId: "no-levels",
        strategyId: "TREND_CONTINUATION",
        thesis: "no prices here",
        rationale: "still none",
      }),
      historicalCandidates: hist,
      evaluations: evals,
      asOfIso: "2024-12-01T00:00:00.000Z",
      calculatedAt: "2024-12-01T00:00:00.000Z",
    });
    expect(est.probability).toBeNull();
    expect(est.sampleStatus).toBe("LEVELS_NOT_PROVIDED");
    expect(est.isWinProbability).toBe(false);
  });

  it("emits probability when sufficient decisive cohort exists", () => {
    const c = candidate({
      candidateId: "subject-ok",
      strategyId: "TREND_CONTINUATION",
      thesis: "targetPrice=2100 targetSide=ABOVE invalidationPrice=2000 invalidationSide=BELOW",
      rationale: "entryPrice=2050",
    });
    const est = estimateOpportunityProbability({
      candidate: c,
      historicalCandidates: hist,
      evaluations: evals,
      asOfIso: "2024-12-01T00:00:00.000Z",
      calculatedAt: "2024-12-01T00:00:00.000Z",
      primaryTimeframe: null,
      allowBroaderFallback: true,
    });
    expect(est.eligibleResolvedDenominator).toBeGreaterThanOrEqual(
      MIF_POLICY_HFM_PROBABILITY.minSampleForProbability,
    );
    expect(est.probability).not.toBeNull();
    expect(est.probability!).toBeGreaterThanOrEqual(0);
    expect(est.probability!).toBeLessThanOrEqual(1);
    expect(est.isWinProbability).toBe(true);
    expect(est.confidenceInterval?.method).toBe("WILSON");
    expect(est.calibrationStatus).toBe("UNCALIBRATED");
    expect(est.isCalibratedPrediction).toBe(false);
  });

  it("rejects incompatible instruments in cohort", () => {
    const foreign = persisted({
      candidateId: "eur",
      strategyId: "TREND_CONTINUATION",
      providerSymbol: "EURUSD",
      createdAt: "2024-01-02T00:00:00.000Z",
      outcomeKind: "TARGET_REACHED",
    });
    const cohort = selectHistoricalCohort({
      subject: {
        candidateId: "subject",
        strategyId: "TREND_CONTINUATION",
        providerSymbol: "XAUUSD",
        direction: "BUY",
        asOfIso: "2024-12-01T00:00:00.000Z",
      },
      historicalCandidates: [...hist, foreign],
      evaluations: evals,
      targetEvent: "TARGET_REACHED_BEFORE_INVALIDATION_WITHIN_HORIZON",
      minSample: 10,
    });
    expect(cohort.includedCandidateIds).not.toContain("eur");
  });
});

describe("Phase 5E Step 2 — calibration foundation", () => {
  it("returns UNCALIBRATED when no historical predictions exist", () => {
    const run = buildCalibrationRun({
      historicalAssessments: [],
      resolvedOutcomes: new Map(),
      calculatedAt: "2024-06-01T00:00:00.000Z",
    });
    expect(run.status).toBe("UNCALIBRATED");
    expect(run.metrics).toBeNull();
    expect(run.placesOrders).toBe(false);
  });

  it("computes Brier on chronological validation points", () => {
    const metrics = computeCalibrationMetrics(
      [
        {
          predictedAt: "2024-01-01T00:00:00.000Z",
          probability: 0.7,
          outcome: 1,
          resolvedAt: "2024-01-02T00:00:00.000Z",
          candidateId: "a",
        },
        {
          predictedAt: "2024-01-03T00:00:00.000Z",
          probability: 0.2,
          outcome: 0,
          resolvedAt: "2024-01-04T00:00:00.000Z",
          candidateId: "b",
        },
      ],
      {
        trainingWindow: { fromIso: null, toIso: null },
        validationWindow: { fromIso: "2024-01-01", toIso: "2024-01-04" },
      },
    );
    expect(metrics.brierScore).not.toBeNull();
    expect(metrics.calibrationSampleCount).toBe(2);
  });
});

describe("Phase 5E Step 2 — combined + pipeline", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mif-5e2-"));
    process.env.KWIZERA_STORAGE_ROOT = tmp;
    __setMifOpportunityStorageForTests(new MifOpportunityStorage(tmp));
  });

  afterEach(() => {
    __setMifOpportunityStorageForTests(null);
    delete process.env.KWIZERA_STORAGE_ROOT;
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("bundle exposes evidence + nullable probability", () => {
    const bundle = assessProbabilityIntelligence({
      candidate: candidate({
        candidateId: "b1",
        strategyId: "TREND_CONTINUATION",
        thesis: "no levels",
      }),
      evidence: [ev({ evidenceId: "dq", family: "DATA_QUALITY" })],
      historicalCandidates: [],
      calculatedAt: "2024-06-01T00:00:00.000Z",
    });
    expect(bundle.evidence.assessmentId).toBeTruthy();
    expect(bundle.probability.probability).toBeNull();
    expect(
      bundle.probability.sampleStatus === "LEVELS_NOT_PROVIDED"
        || bundle.probability.sampleStatus === "INSUFFICIENT_HISTORICAL_COVERAGE"
        || bundle.probability.sampleStatus === "INSUFFICIENT_SAMPLE",
    ).toBe(true);
  });

  it("integrates into production pipeline and persists assessments", async () => {
    const r = await runMifHfmOpportunityPipelineFromSeriesPersisted({
      providerSymbol: "XAUUSD",
      primaryTimeframe: "H1",
      timeframes: ["H1", "H4"],
      series: [
        { timeframe: "H1", bars: bars(80) },
        { timeframe: "H4", bars: bars(80) },
      ],
      assessmentTimestamp: "2024-06-01T00:00:00.000Z",
      maxCandleAgeSec: null,
    });
    expect(r.providerId).toBe(MIF_PROVIDER_ID);
    expect(r.ranking).toBeTruthy();
    expect(r.probabilityIntelligence).toBeTruthy();
    expect(r.probabilityIntelligence!.placesOrders).toBe(false);
    expect(r.persistence?.persisted).toBe(true);
    expect(getMifOdWorkerStatus().enabled).toBe(false);

    const store = new MifOpportunityStorage(tmp);
    const listed = await store.listProbabilityAssessments({ limit: 20 });
    // May be zero candidates → zero assessments; still ok
    for (const a of listed.items) {
      expect(a.contractId).toBe(MIF_PROBABILITY_INTELLIGENCE_CONTRACT_ID);
      expect(a.placesOrders).toBe(false);
      expect(a.isGuaranteedOutcome).toBe(false);
    }
  });
});

describe("Phase 5E Step 2 — API surface", () => {
  it("registers evidence and probability routes", () => {
    const api = fs.readFileSync(
      path.join(process.cwd(), "dev/server/mt5-hfm-mif-api.ts"),
      "utf8",
    );
    expect(api).toContain("/api/forex/providers/mt5-hfm/mif/evidence-intelligence");
    expect(api).toContain("/api/forex/providers/mt5-hfm/mif/probability");
    expect(api).toContain("/api/forex/providers/mt5-hfm/mif/calibration");
    expect(api).toContain("assessProbabilityIntelligence");
    expect(api).toContain("buildCalibrationRun");
  });
});
