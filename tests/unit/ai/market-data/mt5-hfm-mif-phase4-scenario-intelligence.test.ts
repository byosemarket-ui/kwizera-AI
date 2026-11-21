/**
 * Phase 4 — Deterministic Scenario Intelligence + ranking regime alignment.
 * Fixture-based; non-LLM; no broker mutation.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createSnapshotIdentity,
  HfmAnalysisStorage,
  __setHfmAnalysisStorageForTests,
  type HfmAnalysisMultiTfSnapshot,
  type HfmAnalysisNormalizedCandle,
  type HfmAnalysisTfDataset,
} from "../../../../ai/market-data/mt5-hfm/analysis/index";
import {
  MIF_ORCHESTRATION_TF_PACK,
  MIF_SCENARIO_INTELLIGENCE_CONTRACT_ID,
  MIF_SCENARIO_LIFECYCLE_MAPPING,
  MIF_POLICY_HFM_OPPORTUNITY_RANKING,
  MIF_OPPORTUNITY_RANKING_POLICY_VERSION,
  __resetOrchestrationLockForTests,
  buildScenarioIntelligence,
  computeSetupFingerprint,
  computeScenarioId,
  presentationStatusToLifecycle,
  candidateStatusToPresentation,
  getMifOdWorkerStatus,
  runChartsIntelligenceOrchestration,
  scoreOpportunityCandidate,
  validateMifRankingPolicy,
  type MifOpportunityCandidate,
  type MifDetectionEvidenceRef,
  type MifProductionIntegrationResult,
} from "../../../../ai/market-data/mt5-hfm/mif/index";

const T0 = 1_700_000_000;

function candle(
  symbol: string,
  tf: string,
  t: number,
  o: number,
  h: number,
  l: number,
  c: number,
): HfmAnalysisNormalizedCandle {
  return {
    symbol,
    provider: "HFM_MT5",
    timeframe: tf,
    timestamp: t,
    open: o,
    high: h,
    low: l,
    close: c,
    tickVolume: 10,
    realVolume: null,
    volumeType: "tick",
    provenance: "native",
    isCurrent: false,
    sourceTimestamp: t,
    normalizedAt: new Date().toISOString(),
  };
}

function series(symbol: string, tf: string, start: number, step: number, n: number): HfmAnalysisNormalizedCandle[] {
  const out: HfmAnalysisNormalizedCandle[] = [];
  let px = 2000;
  for (let i = 0; i < n; i += 1) {
    const o = px;
    const cl = px + (i % 2 === 0 ? 0.35 : -0.2);
    out.push(candle(symbol, tf, start + i * step, o, Math.max(o, cl) + 0.4, Math.min(o, cl) - 0.4, cl));
    px = cl;
  }
  return out;
}

const TF_STEP: Record<string, number> = {
  H4: 14400, H1: 3600, M30: 1800, M15: 900, M5: 300,
};

function dataset(symbol: string, tf: string): HfmAnalysisTfDataset {
  const step = TF_STEP[tf] ?? 3600;
  const historical = series(symbol, tf, T0, step, 50);
  const tip = historical[historical.length - 1]!;
  return {
    timeframe: tf,
    symbol,
    historical,
    current: { ...tip, isCurrent: true, provenance: "live_aggregate" },
    candleCount: historical.length,
    oldestTimestamp: historical[0]!.timestamp,
    newestTimestamp: tip.timestamp,
    freshness: "LIVE",
    connectionStatus: "CONNECTED",
    validationStatus: "ok",
    sourceProvenance: "HFM_MT5",
    errors: [],
  };
}

function makeSnapshot(): HfmAnalysisMultiTfSnapshot {
  const symbol = "XAUUSD";
  const timeframes: Record<string, HfmAnalysisTfDataset> = {};
  for (const tf of MIF_ORCHESTRATION_TF_PACK) {
    timeframes[tf] = dataset(symbol, tf);
  }
  const identity = createSnapshotIdentity({
    symbol,
    chartTimeframeAtStart: "H1",
    datasets: timeframes,
    quote: {
      symbol, bid: 2000, ask: 2000.2, spread: 0.2,
      brokerTimestamp: T0 + 100000,
      receiveTimestamp: new Date().toISOString(),
      freshness: "LIVE",
      acquisition: "SymbolInfoTick",
    },
    qualityStatus: "VALID",
  });
  return {
    ...identity,
    provider: "HFM_MT5",
    symbol,
    chartTimeframeAtStart: "H1",
    timeframes,
    quote: {
      symbol, bid: 2000, ask: 2000.2, spread: 0.2,
      brokerTimestamp: T0 + 100000,
      receiveTimestamp: new Date().toISOString(),
      freshness: "LIVE",
      acquisition: "SymbolInfoTick",
    },
    dataQuality: {
      status: "VALID", errors: [], warnings: [],
      approvedForAiReasoning: true, policyNote: "p4",
    },
    synchronization: {
      status: "VALID", symbol,
      timeframesPresent: Object.keys(timeframes),
      timeframesMissing: [],
      latestQuoteTimestamp: T0 + 100000,
      latestCandleByTf: {},
      warnings: [], errors: [],
    },
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
  };
}

function fakeCandidate(over: Partial<MifOpportunityCandidate> & {
  candidateId: string;
  direction: "BUY" | "SELL";
  strategyId: string;
}): MifOpportunityCandidate {
  return {
    contractId: "kwizera.mif.opportunity-candidate.v1" as MifOpportunityCandidate["contractId"],
    contractVersion: "1.0.0" as MifOpportunityCandidate["contractVersion"],
    candidateId: over.candidateId,
    strategyId: over.strategyId,
    detectorId: over.detectorId ?? `mif.detector.${String(over.strategyId).toLowerCase()}`,
    detectorVersion: "1.0.0",
    strategyDefinitionVersion: "1.0.0",
    policyVersion: "1.0.0",
    providerId: "HFM_MT5",
    providerSymbol: "XAUUSD",
    instrument: null,
    direction: over.direction,
    timeframeRoles: ["PRIMARY_DIRECTION", "SETUP_DEVELOPMENT"],
    assessmentTimestamp: over.assessmentTimestamp ?? "2024-01-15T12:00:00.000Z",
    status: over.status ?? "DETECTED",
    thesis: over.thesis ?? `${over.strategyId} thesis`,
    rationale: over.rationale ?? "test rationale",
    supportingEvidenceIds: over.supportingEvidenceIds ?? ["ev-support-1"],
    conflictingEvidenceIds: over.conflictingEvidenceIds ?? [],
    requiredConfirmations: over.requiredConfirmations ?? [],
    invalidationConditions: over.invalidationConditions ?? [
      "entryPrice=2000",
      "invalidationPrice=1990",
      "targetPrice=2020",
      "invalidationSide=BELOW",
      "targetSide=ABOVE",
    ],
    knownLimitations: over.knownLimitations ?? [],
    quality: null,
    regimeAssessmentId: null,
    mtfAssessmentId: null,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    doesNotApproveAiReasoning: true,
    analyticalCandidateOnly: true,
    notExecutable: true,
  };
}

function fakeEvidence(id: string, over?: Partial<MifDetectionEvidenceRef>): MifDetectionEvidenceRef {
  return {
    evidenceId: id,
    family: over?.family ?? "MARKET_STRUCTURE",
    presence: "PRESENT",
    sourceEngine: "test",
    sourceContractId: null,
    sourceContractVersion: null,
    sourcePolicyVersion: null,
    sourceAssessmentId: over?.sourceAssessmentId ?? `assess-${id}`,
    sourceInputIdentity: null,
    timeframe: "H1",
    timeframeRole: "PRIMARY_DIRECTION",
    assessmentTimestamp: "2024-01-15T12:00:00.000Z",
    qualityStatus: over?.qualityStatus ?? "VALID",
    candleState: over?.candleState ?? "CLOSED",
    notes: over?.notes,
  };
}

function fakePipeline(over?: {
  candidates?: MifOpportunityCandidate[];
  evidence?: MifDetectionEvidenceRef[];
  mtfRelation?: string | null;
  dataQualityStatus?: string;
}): MifProductionIntegrationResult {
  return {
    contractId: "kwizera.mif.production-integration.v1" as MifProductionIntegrationResult["contractId"],
    contractVersion: "1.0.0",
    engineId: "test",
    engineVersion: "1.0.0",
    requestId: "req-1",
    providerId: "HFM_MT5",
    providerSymbol: "XAUUSD",
    requestedTimeframes: [...MIF_ORCHESTRATION_TF_PACK],
    resolvedTimeframes: [...MIF_ORCHESTRATION_TF_PACK],
    primaryTimeframe: "H1",
    marketDataTimestamp: "2024-01-15T12:00:00.000Z",
    candleTimestampSec: T0,
    candleLifecycle: "FORMING",
    dataFreshness: "LIVE",
    processingTimestamp: "2024-01-15T12:00:01.000Z",
    analysisStatus: "OK",
    dataQualityStatus: (over?.dataQualityStatus as MifProductionIntegrationResult["dataQualityStatus"]) ?? "VALID",
    dataQualityDiagnostics: [],
    availableTimeframeRoles: [],
    timeframeSnapshots: [],
    mtfStatus: "OK",
    mtfRelation: over?.mtfRelation ?? "ALIGNMENT",
    eligibility: [],
    detection: {
      contractId: "kwizera.mif.opportunity-detection.v1" as never,
      contractVersion: "1.0.0",
      engineId: "od",
      engineVersion: "1.0.0",
      policyId: "p",
      policyVersion: "1.0.0",
      assessmentTimestamp: "2024-01-15T12:00:00.000Z",
      providerSymbol: "XAUUSD",
      outcomes: [],
      candidates: over?.candidates ?? [],
      strategyCoverage: [],
      diagnosticsSummary: "",
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
      doesNotApproveAiReasoning: true,
      analyticalDetectionOnly: true,
      doesNotRankOpportunities: true,
    },
    candidateCount: over?.candidates?.length ?? 0,
    evidenceRefs: over?.evidence ?? [
      fakeEvidence("ev-support-1", { sourceAssessmentId: "assess-a", candleState: "CLOSED" }),
    ],
    warnings: [],
    errors: [],
    failureCodes: [],
    contextSummary: {
      evidenceCount: 1,
      assessmentTimestamp: "2024-01-15T12:00:00.000Z",
      hasRegime: true,
      hasMtf: true,
      hasFibonacci: false,
      hasChartPatterns: false,
      hasHarmonic: false,
      hasUnified: false,
      hasMarketStructure: true,
      hasSupportResistance: false,
      hasLiquidityReference: false,
      hasMomentum: false,
      hasPriceDisplacement: false,
    },
    evidenceQuality: null,
    ranking: null,
    probabilityIntelligence: null,
    persistence: null,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
  } as MifProductionIntegrationResult;
}

describe("Phase 4 — lifecycle mapping", () => {
  it("maps presentation statuses to existing lifecycle states", () => {
    expect(presentationStatusToLifecycle("CONFIRMED")).toBe("CONFIRMED");
    expect(presentationStatusToLifecycle("WAITING_FOR_CONFIRMATION")).toBe("NEEDS_CONFIRMATION");
    expect(presentationStatusToLifecycle("INSUFFICIENT")).toBe("OUTCOME_UNKNOWN");
    expect(candidateStatusToPresentation("NEEDS_CONFIRMATION")).toBe("WAITING_FOR_CONFIRMATION");
    expect(MIF_SCENARIO_LIFECYCLE_MAPPING.length).toBe(7);
  });
});

describe("Phase 4 — scenario contracts and direction", () => {
  it("evaluates both bullish and bearish sides and explains stronger side", () => {
    const buy = fakeCandidate({
      candidateId: "c-buy",
      direction: "BUY",
      strategyId: "TREND_CONTINUATION",
      status: "DETECTED",
      supportingEvidenceIds: ["ev-b1"],
      requiredConfirmations: [],
      invalidationConditions: [
        "entryPrice=2000", "invalidationPrice=1990", "targetPrice=2030",
      ],
    });
    const sell = fakeCandidate({
      candidateId: "c-sell",
      direction: "SELL",
      strategyId: "REVERSAL",
      status: "NEEDS_CONFIRMATION",
      supportingEvidenceIds: ["ev-s1"],
      requiredConfirmations: ["rv.structure_confirm"],
      invalidationConditions: ["LEVELS_NOT_PROVIDED: no levels"],
      knownLimitations: ["LEVELS_NOT_PROVIDED: no levels"],
    });
    const result = buildScenarioIntelligence({
      pipeline: fakePipeline({
        candidates: [buy, sell],
        evidence: [
          fakeEvidence("ev-b1", { sourceAssessmentId: "a1", candleState: "CLOSED" }),
          fakeEvidence("ev-s1", { sourceAssessmentId: "a2", candleState: "CLOSED" }),
        ],
      }),
      tipStates: { H1: "CLOSED", M5: "CLOSED" },
      presentTimeframes: [...MIF_ORCHESTRATION_TF_PACK],
      missingTimeframes: [],
      snapshotId: "snap-1",
      snapshotIdSourceVerified: true,
    });
    expect(result.contractId).toBe(MIF_SCENARIO_INTELLIGENCE_CONTRACT_ID);
    expect(result.package.bullishScenario.side).toBe("BULLISH");
    expect(result.package.bearishScenario.side).toBe("BEARISH");
    expect(result.package.bullishScenario.contributingStrategyIds).toContain("TREND_CONTINUATION");
    expect(result.package.bearishScenario.contributingStrategyIds).toContain("REVERSAL");
    expect(result.package.outcome).toBe("BULLISH_PREFERRED");
    expect(result.package.strongerSide).toBe("BULLISH");
    expect(result.package.comparisonExplanation.length).toBeGreaterThan(10);
    expect(result.package.placesOrders).toBe(false);
    expect(result.notExecutable).toBe(true);
  });

  it("returns NO_QUALIFIED_OPPORTUNITY when neither side qualifies", () => {
    const result = buildScenarioIntelligence({
      pipeline: fakePipeline({ candidates: [] }),
      tipStates: { H1: "CLOSED" },
      presentTimeframes: [...MIF_ORCHESTRATION_TF_PACK],
      missingTimeframes: [],
    });
    expect(result.package.outcome).toBe("NO_QUALIFIED_OPPORTUNITY");
    expect(result.package.strongerSide).toBeNull();
    expect(result.package.bullishScenario.status).toBe("INSUFFICIENT");
    expect(result.package.bearishScenario.status).toBe("INSUFFICIENT");
  });
});

describe("Phase 4 — evidence integrity and FORMING rules", () => {
  it("dedupes overlapping detectors sharing the same sourceAssessmentId", () => {
    const buyA = fakeCandidate({
      candidateId: "c1",
      direction: "BUY",
      strategyId: "BREAKOUT",
      supportingEvidenceIds: ["ev-1", "ev-2"],
    });
    const buyB = fakeCandidate({
      candidateId: "c2",
      direction: "BUY",
      strategyId: "MOMENTUM_EXPANSION",
      supportingEvidenceIds: ["ev-3"],
    });
    const result = buildScenarioIntelligence({
      pipeline: fakePipeline({
        candidates: [buyA, buyB],
        evidence: [
          fakeEvidence("ev-1", { sourceAssessmentId: "same-assess" }),
          fakeEvidence("ev-2", { sourceAssessmentId: "same-assess" }),
          fakeEvidence("ev-3", { sourceAssessmentId: "same-assess" }),
        ],
      }),
      tipStates: { M5: "CLOSED" },
      presentTimeframes: [...MIF_ORCHESTRATION_TF_PACK],
      missingTimeframes: [],
    });
    // Three evidence ids collapse to one unique assessment
    expect(result.package.bullishScenario.evidenceCompleteness.uniqueAssessmentCount).toBe(1);
    expect(result.package.bullishScenario.supportingEvidenceIds.length).toBe(1);
  });

  it("never confirms from FORMING candle evidence alone", () => {
    const buy = fakeCandidate({
      candidateId: "c-form",
      direction: "BUY",
      strategyId: "PULLBACK",
      status: "DETECTED",
      supportingEvidenceIds: ["ev-f"],
      requiredConfirmations: ["pb.resume_closed"],
    });
    const result = buildScenarioIntelligence({
      pipeline: fakePipeline({
        candidates: [buy],
        evidence: [fakeEvidence("ev-f", { candleState: "FORMING", sourceAssessmentId: "f1" })],
      }),
      tipStates: { M5: "FORMING", M15: "FORMING" },
      presentTimeframes: [...MIF_ORCHESTRATION_TF_PACK],
      missingTimeframes: [],
    });
    expect(result.package.bullishScenario.status).not.toBe("CONFIRMED");
    expect(result.package.bullishScenario.evidenceCompleteness.formingOnlyConfirmationBlocked).toBe(true);
    expect(result.package.bullishScenario.evidenceCompleteness.trustedConfirmed).toBe(false);
  });

  it("missing timeframes reduce completeness and warn", () => {
    const result = buildScenarioIntelligence({
      pipeline: fakePipeline({ candidates: [] }),
      tipStates: { H1: "CLOSED", H4: "MISSING" },
      presentTimeframes: ["H1", "M30", "M15", "M5"],
      missingTimeframes: ["H4"],
      expectedTimeframes: MIF_ORCHESTRATION_TF_PACK,
    });
    expect(result.package.timeframeContext.missingTimeframes).toContain("H4");
    expect(result.package.warnings.some((w) => w.includes("MISSING_TIMEFRAMES"))).toBe(true);
    expect(result.package.completenessTrusted).toBe(false);
  });
});

describe("Phase 4 — levels, RR, continuity", () => {
  it("computes RR only with complete source-backed levels; otherwise null", () => {
    const withLevels = fakeCandidate({
      candidateId: "c-l",
      direction: "BUY",
      strategyId: "BREAKOUT",
      invalidationConditions: [
        "entryPrice=100", "invalidationPrice=90", "targetPrice=130",
      ],
    });
    const noLevels = fakeCandidate({
      candidateId: "c-n",
      direction: "SELL",
      strategyId: "RANGE",
      invalidationConditions: [],
      knownLimitations: ["LEVELS_NOT_PROVIDED: none"],
    });
    const result = buildScenarioIntelligence({
      pipeline: fakePipeline({
        candidates: [withLevels, noLevels],
        evidence: [
          fakeEvidence("ev-support-1", { sourceAssessmentId: "x", candleState: "CLOSED" }),
        ],
      }),
      tipStates: { H1: "CLOSED" },
      presentTimeframes: [...MIF_ORCHESTRATION_TF_PACK],
      missingTimeframes: [],
    });
    expect(result.package.bullishScenario.levels.status).toBe("AVAILABLE_FROM_SOURCE");
    expect(result.package.bullishScenario.levels.riskReward).toBe(3);
    expect(result.package.bearishScenario.levels.riskReward).toBeNull();
    expect(
      result.package.bearishScenario.levels.status === "LEVELS_NOT_PROVIDED"
      || result.package.bearishScenario.levels.status === "LEVELS_PARTIAL",
    ).toBe(true);
  });

  it("setupFingerprint is stable across assessment timestamps", () => {
    const a = fakeCandidate({
      candidateId: "c-a",
      direction: "BUY",
      strategyId: "TREND_CONTINUATION",
      assessmentTimestamp: "2024-01-15T12:00:00.000Z",
      invalidationConditions: ["entryPrice=2000", "invalidationPrice=1990", "targetPrice=2020"],
    });
    const b = {
      ...a,
      candidateId: "c-b",
      assessmentTimestamp: "2024-01-15T12:05:00.000Z",
    };
    const fp1 = computeSetupFingerprint({
      providerSymbol: "XAUUSD",
      side: "BULLISH",
      strategyIds: ["TREND_CONTINUATION"],
      candidates: [a],
    });
    const fp2 = computeSetupFingerprint({
      providerSymbol: "XAUUSD",
      side: "BULLISH",
      strategyIds: ["TREND_CONTINUATION"],
      candidates: [b],
    });
    expect(fp1).toBe(fp2);
    expect(computeScenarioId({ setupFingerprint: fp1, side: "BULLISH" }))
      .toBe(computeScenarioId({ setupFingerprint: fp2, side: "BULLISH" }));
  });
});

describe("Phase 4 — ranking regime alignment", () => {
  it("policy v1.1 includes regime weight summing to 1.0 and isWinProbability stays false", () => {
    expect(MIF_OPPORTUNITY_RANKING_POLICY_VERSION).toBe("1.1.0");
    expect(validateMifRankingPolicy(MIF_POLICY_HFM_OPPORTUNITY_RANKING).ok).toBe(true);
    expect(MIF_POLICY_HFM_OPPORTUNITY_RANKING.weights.marketRegimeAlignment).toBe(0.05);
  });

  it("scores regime alignment symmetrically for BUY and SELL", () => {
    const evidence: MifDetectionEvidenceRef[] = [
      fakeEvidence("dq", { family: "DATA_QUALITY", sourceAssessmentId: "dq1" }),
      fakeEvidence("reg", {
        family: "MARKET_REGIME",
        sourceAssessmentId: "r1",
        notes: "direction=UP;structure=TRENDING_UP",
      }),
    ];
    const buy = fakeCandidate({
      candidateId: "rb",
      direction: "BUY",
      strategyId: "TREND_CONTINUATION",
      supportingEvidenceIds: ["dq", "reg"],
    });
    const sell = fakeCandidate({
      candidateId: "rs",
      direction: "SELL",
      strategyId: "TREND_CONTINUATION",
      supportingEvidenceIds: ["dq", "reg"],
    });
    const buyRank = scoreOpportunityCandidate({
      candidate: buy,
      evidence,
      dataQualityStatus: "VALID",
      rankingRunId: "run-1",
      regimeDirection: "UP",
      regimeStructure: "TRENDING_UP",
    });
    const sellRank = scoreOpportunityCandidate({
      candidate: sell,
      evidence,
      dataQualityStatus: "VALID",
      rankingRunId: "run-1",
      regimeDirection: "UP",
      regimeStructure: "TRENDING_UP",
    });
    const buyRegime = buyRank.componentScores.find((c) => c.componentId === "MARKET_REGIME_ALIGNMENT");
    const sellRegime = sellRank.componentScores.find((c) => c.componentId === "MARKET_REGIME_ALIGNMENT");
    expect(buyRegime?.score).toBeGreaterThan(sellRegime?.score ?? 0);
    expect(buyRank.isWinProbability).toBe(false);
    expect(sellRank.isWinProbability).toBe(false);

    // Flip regime — SELL should now score higher on regime component
    const sellDown = scoreOpportunityCandidate({
      candidate: sell,
      evidence,
      dataQualityStatus: "VALID",
      rankingRunId: "run-2",
      regimeDirection: "DOWN",
      regimeStructure: "TRENDING_DOWN",
    });
    const sellDownRegime = sellDown.componentScores.find((c) => c.componentId === "MARKET_REGIME_ALIGNMENT");
    expect(sellDownRegime?.score).toBeGreaterThan(sellRegime?.score ?? 0);
  });

  it("does not double-count MTF CONFLICT in CONFLICT_PENALTY", () => {
    const cand = fakeCandidate({
      candidateId: "mtf-c",
      direction: "BUY",
      strategyId: "PULLBACK",
      supportingEvidenceIds: ["ev-mtf"],
      conflictingEvidenceIds: [],
    });
    const ranked = scoreOpportunityCandidate({
      candidate: cand,
      evidence: [
        fakeEvidence("ev-mtf", {
          family: "MULTI_TIMEFRAME_RELATIONSHIP",
          sourceAssessmentId: "m1",
          notes: "relation=CONFLICT",
        }),
      ],
      dataQualityStatus: "VALID",
      rankingRunId: "run-mtf",
      mtfRelation: "CONFLICT",
    });
    const penalty = ranked.componentScores.find((c) => c.componentId === "CONFLICT_PENALTY");
    const mtf = ranked.componentScores.find((c) => c.componentId === "MULTI_TIMEFRAME_AGREEMENT");
    expect(mtf?.score).toBe(20);
    // Penalty equals provenance contradictions only (×8) — no extra +1 for MTF CONFLICT.
    expect(penalty?.score).toBe(ranked.contradictions.length * 8);
    expect(penalty?.inputs.some((i) => i.startsWith("mtfAlreadyInComponent="))).toBe(true);
  });
});

describe("Phase 4 — orchestration integration + persistence + safety", () => {
  let tmp: string;

  beforeEach(async () => {
    __resetOrchestrationLockForTests();
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "hfm-p4-"));
    __setHfmAnalysisStorageForTests(new HfmAnalysisStorage(tmp));
  });

  afterEach(async () => {
    __setHfmAnalysisStorageForTests(null);
    __resetOrchestrationLockForTests();
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("Charts orchestration includes scenario package; OD remains disabled", () => {
    expect(getMifOdWorkerStatus().enabled).toBe(false);
    const snap = makeSnapshot();
    const orch = runChartsIntelligenceOrchestration({
      snapshot: snap,
      correlationId: snap.snapshotId,
    });
    expect(orch.completeness.probabilityIncluded).toBe(false);
    expect(orch.completeness.scenarioIncluded).toBe(true);
    expect(orch.scenarioPackage).toBeTruthy();
    expect(orch.scenarioPackage?.bullishScenario.side).toBe("BULLISH");
    expect(orch.scenarioPackage?.bearishScenario.side).toBe("BEARISH");
    expect(orch.placesOrders).toBe(false);
    expect(orch.mutatesBroker).toBe(false);
    expect(orch.acceptsForExecution).toBe(false);
    expect(getMifOdWorkerStatus().enabled).toBe(false);
  });

  it("persists scenario package by snapshotId with read-after-write", async () => {
    const store = new HfmAnalysisStorage(tmp);
    const snap = makeSnapshot();
    const orch = runChartsIntelligenceOrchestration({ snapshot: snap });
    expect(orch.scenarioPackage).toBeTruthy();
    await store.saveScenarioPackage(snap.snapshotId, orch.scenarioPackage);
    const loaded = await store.loadScenarioPackage(snap.snapshotId) as {
      packageId: string;
      bullishScenario: { scenarioId: string };
    };
    expect(loaded.packageId).toBe(orch.scenarioPackage!.packageId);
    expect(loaded.bullishScenario.scenarioId).toBe(
      orch.scenarioPackage!.bullishScenario.scenarioId,
    );
  });
});
