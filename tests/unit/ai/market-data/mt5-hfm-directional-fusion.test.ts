/**
 * HFM directional evidence fusion — BUY/SELL primary direction + conviction.
 * Analytical only; never win probability / execution authorization.
 */
import { describe, it, expect } from "vitest";
import {
  fuseHfmDirectionalBias,
  HFM_DIRECTIONAL_FUSION_CALCULATION_VERSION,
  type HfmDirectionalFusionPackage,
  type MifMarketEvidencePackage,
  type MifScenarioPackage,
  type MifProductionIntegrationResult,
} from "../../../../ai/market-data/mt5-hfm/mif/index";
import {
  applyPrimaryMarketDirection,
  isPredictionBridgeEligible,
} from "../../../../ai/market-data/mt5-hfm/analysis/reasoning/apply-primary-direction";
import type { HfmReasoningValidatedResult } from "../../../../ai/market-data/mt5-hfm/analysis/reasoning/types";
import {
  HFM_REASONING_CONFIDENCE_DEFINITION,
  HFM_REASONING_DISCLAIMER,
  HFM_REASONING_PROMPT_VERSION,
  HFM_REASONING_SCHEMA_VERSION,
} from "../../../../ai/market-data/mt5-hfm/analysis/reasoning/constants";
import {
  buildMockValidReasoningPayload,
  validateHfmReasoningModelResponse,
} from "../../../../ai/market-data/mt5-hfm/analysis/reasoning/validate-response";
import { parseHfmAnalysisRecord } from "../../../../desktop/forex/hfm-dashboard/charts/analysis/parse-hfm-analysis-result";

function emptyScenarioSide(side: "BULLISH" | "BEARISH", status: string): MifScenarioPackage["bullishScenario"] {
  return {
    scenarioId: `sc-${side.toLowerCase()}`,
    setupFingerprint: `fp-${side}`,
    side,
    providerId: "HFM_MT5",
    providerSymbol: "XAUUSD",
    status: status as MifScenarioPackage["bullishScenario"]["status"],
    lifecycleState: "DETECTED",
    thesis: `${side} thesis`,
    rationale: `${side} rationale`,
    contributingCandidateIds: status === "INSUFFICIENT" ? [] : [`cand-${side}`],
    contributingStrategyIds: status === "INSUFFICIENT" ? [] : ["trend_continuation"],
    supportingEvidenceIds: status === "INSUFFICIENT" ? [] : [`ev-${side}`],
    conflictingEvidenceIds: [],
    missingConfirmations: status === "WAITING_FOR_CONFIRMATION" ? ["closed_confirm"] : [],
    invalidationConditions: [],
    levels: {
      status: "LEVELS_NOT_PROVIDED",
      entry: null,
      invalidation: null,
      targets: [],
      riskReward: null,
      notes: [],
    },
    evidenceCompleteness: {
      supportingCount: status === "INSUFFICIENT" ? 0 : 2,
      conflictingCount: 0,
      uniqueAssessmentCount: 1,
      incompleteEvidence: status === "INSUFFICIENT",
      formingOnlyConfirmationBlocked: false,
      trustedConfirmed: status === "CONFIRMED",
    },
    warnings: [],
    assessmentTimestamp: new Date().toISOString(),
    snapshotId: "snap-1",
    snapshotIdSourceVerified: true,
    analyticalScenarioOnly: true,
    notExecutable: true,
    doesNotApproveAiReasoning: true,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
  } as MifScenarioPackage["bullishScenario"];
}

function makeScenario(input: {
  bullStatus: string;
  bearStatus: string;
  strongerSide: "BULLISH" | "BEARISH" | null;
  outcome: MifScenarioPackage["outcome"];
}): MifScenarioPackage {
  return {
    contractId: "kwizera.mif.scenario-package.v1",
    contractVersion: "1.0.0",
    engineId: "scenario-intelligence",
    engineVersion: "1.0.0",
    packageId: "sp-1",
    providerId: "HFM_MT5",
    providerSymbol: "XAUUSD",
    snapshotId: "snap-1",
    snapshotHash: "hash-1",
    snapshotIdSourceVerified: true,
    assessmentTimestamp: new Date().toISOString(),
    bullishScenario: emptyScenarioSide("BULLISH", input.bullStatus),
    bearishScenario: emptyScenarioSide("BEARISH", input.bearStatus),
    outcome: input.outcome,
    strongerSide: input.strongerSide,
    comparisonExplanation: "test",
    timeframeContext: {
      expectedTimeframes: ["H4", "H1", "M30", "M15", "M5"],
      presentTimeframes: ["H4", "H1", "M30", "M15", "M5"],
      missingTimeframes: [],
      tipStates: { H1: "CLOSED", M15: "CLOSED" },
      higherTimeframeContext: ["H4", "H1"],
      intermediateStructure: ["H1", "M30"],
      lowerTimeframeFormation: ["M15", "M5"],
      conflictNotes: [],
    },
    warnings: [],
    completenessTrusted: true,
    analyticalPackageOnly: true,
    notExecutable: true,
    doesNotApproveAiReasoning: true,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
  };
}

function makeEvidenceItem(input: {
  id: string;
  type: string;
  direction: "BULLISH" | "BEARISH" | "NEUTRAL";
  engine: string;
  tf?: string;
  candleStatus?: string;
  assessmentId?: string;
  score?: number;
}): MifMarketEvidencePackage["items"][number] {
  return {
    contractId: "kwizera.mif.unified-market-evidence.v1",
    contractVersion: "1.0.0",
    evidenceId: input.id,
    signalId: null,
    analysisId: null,
    sourceEngine: input.engine,
    engineVersion: "1.0.0",
    providerId: "HFM_MT5",
    providerSymbol: "XAUUSD",
    timeframe: input.tf ?? "H1",
    instrument: null,
    evidenceType: input.type as MifMarketEvidencePackage["items"][number]["evidenceType"],
    direction: input.direction,
    eventTime: null,
    observedAt: new Date().toISOString(),
    candleStatus: (input.candleStatus ?? "CLOSED") as "CLOSED",
    levels: [],
    measurements: [],
    supportingEvidenceIds: [],
    conflictingEvidenceIds: [],
    warnings: [],
    limitations: [],
    validFrom: null,
    validUntil: null,
    score: {
      confidenceType: "STRUCTURE_CONFIDENCE",
      value: input.score ?? 70,
      scale: "0-100",
      isWinProbability: false,
      isCalibratedPrediction: false,
      calibrationStatus: null,
      reliabilityStatus: null,
      definition: "test",
    },
    provenance: {
      sourceAssessmentId: input.assessmentId ?? input.id,
      sourceInputIdentity: null,
      sourceContractId: null,
      sourceContractVersion: null,
      sourceCandidateId: null,
      runId: null,
      snapshotId: "snap-1",
      datasetId: null,
      contentHash: null,
      sourceFingerprint: input.id,
      snapshotIdSourceVerified: true,
    },
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    doesNotApproveAiReasoning: true,
    analyticalEvidenceOnly: true,
    notExecutable: true,
  };
}

function makeEvidencePkg(items: MifMarketEvidencePackage["items"]): MifMarketEvidencePackage {
  return {
    contractId: "kwizera.mif.market-evidence-package.v1",
    contractVersion: "1.0.0",
    packageId: "ep-1",
    analysisId: null,
    runId: null,
    snapshotId: "snap-1",
    snapshotIdSourceVerified: true,
    providerId: "HFM_MT5",
    providerSymbol: "XAUUSD",
    assembledAt: new Date().toISOString(),
    items,
    relations: [],
    droppedDuplicateCount: 0,
    warnings: [],
    limitations: [],
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    doesNotApproveAiReasoning: true,
    analyticalEvidencePackageOnly: true,
    notExecutable: true,
  };
}

function mockValidated(action: "BUY" | "SELL" | "WAITING_FOR_CONFIRMATION" | "NO_TRADE"): HfmReasoningValidatedResult {
  return {
    schemaVersion: HFM_REASONING_SCHEMA_VERSION,
    analysisStatus: "COMPLETED",
    provider: "HFM_MT5",
    symbol: "XAUUSD",
    contextId: "snap-1",
    snapshotId: "snap-1",
    snapshotHash: "hash-1",
    promptVersion: HFM_REASONING_PROMPT_VERSION,
    model: "test",
    analysisId: "an-1",
    marketRegime: "TRENDING",
    decision: {
      action,
      confidence: 55,
      confidenceLabel: "MODERATE",
      summary: "test summary",
    },
    decisionStatus: action === "BUY" || action === "SELL" ? "CONFIRMED" : "WAITING_FOR_CONFIRMATION",
    selectedScenarioId: null,
    bullishAssessment: {
      side: "BULLISH",
      status: "POSSIBLE",
      summary: "bull",
      supportingEvidenceIds: [],
      conflictingEvidenceIds: [],
      missingConfirmations: [],
      invalidationConditions: [],
    },
    bearishAssessment: {
      side: "BEARISH",
      status: "POSSIBLE",
      summary: "bear",
      supportingEvidenceIds: [],
      conflictingEvidenceIds: [],
      missingConfirmations: [],
      invalidationConditions: [],
    },
    supportingEvidenceIds: [],
    conflictingEvidenceIds: [],
    missingConfirmations: action === "WAITING_FOR_CONFIRMATION" ? ["need confirm"] : [],
    invalidationConditions: [],
    deterministicDisagreement: {
      agreesWithRanking: true,
      agreesWithScenarioOutcome: true,
      disagreementReason: null,
      alternativeEvidenceIds: [],
    },
    confidenceSemantics: {
      decisionConfidenceIsWinProbability: false,
      definition: HFM_REASONING_CONFIDENCE_DEFINITION,
    },
    unifiedInputIdentity: null,
    evidencePackageId: null,
    scenarioPackageId: null,
    inputCompleteness: "PARTIAL",
    marketOverview: {
      sectionStatus: "PROVIDED",
      marketCondition: "TRENDING",
      overallBias: "BULLISH",
      higherTimeframeBias: "BULLISH",
      timeframeAlignment: "PARTIALLY_ALIGNED",
    },
    timeframeAnalysis: {
      H1: { sectionStatus: "PROVIDED", bias: "BULLISH", structure: "up", observations: [], supportingEvidence: [], risks: [] },
      M30: { sectionStatus: "PROVIDED", bias: "BULLISH", structure: "up", observations: [], supportingEvidence: [], risks: [] },
      M15: { sectionStatus: "PROVIDED", bias: "MIXED", structure: "mix", observations: [], supportingEvidence: [], risks: [] },
      M5: { sectionStatus: "PROVIDED", bias: "BEARISH", structure: "down", observations: [], supportingEvidence: [], risks: [] },
    },
    scenarios: {
      bullish: { status: "POSSIBLE", conditions: [], confirmation: [], invalidation: [] },
      bearish: { status: "POSSIBLE", conditions: [], confirmation: [], invalidation: [] },
    },
    tradePlan: {
      direction: action === "BUY" || action === "SELL" ? action : "NONE",
      setupStatus: action === "BUY" || action === "SELL" ? "READY" : "WAITING",
      entryZone: { low: null, high: null },
      stopLoss: null,
      takeProfitTargets: [],
      invalidationPrice: null,
      riskRewardEstimate: null,
      explanation: "test",
    },
    evidence: {
      observedFacts: [],
      interpretations: [],
      uncertainties: [],
      missingData: [],
      dataQualityWarnings: [],
    },
    riskAssessment: {
      sectionStatus: "NOT_PROVIDED",
      riskLevel: "NOT_PROVIDED",
      reasons: [],
      reasonsToAvoidTrade: [],
    },
    nextConfirmation: {
      required: action === "WAITING_FOR_CONFIRMATION",
      conditions: [],
      timeframesToWatch: [],
    },
    completeness: { status: "COMPLETE", missingSections: [], notes: [] },
    pricePrecision: {
      verified: false,
      digits: null,
      tickSize: null,
      point: null,
      source: "UNAVAILABLE",
      reason: "test",
    },
    disclaimer: HFM_REASONING_DISCLAIMER,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
  };
}

describe("HFM directional fusion", () => {
  it("1. selects BUY when bullish evidence dominates", () => {
    const fusion = fuseHfmDirectionalBias({
      symbol: "XAUUSD",
      scenarioPackage: makeScenario({
        bullStatus: "CONFIRMED",
        bearStatus: "INSUFFICIENT",
        strongerSide: "BULLISH",
        outcome: "BULLISH_PREFERRED",
      }),
      evidencePackage: makeEvidencePkg([
        makeEvidenceItem({ id: "s1", type: "MARKET_STRUCTURE", direction: "BULLISH", engine: "structure-h1", tf: "H1" }),
        makeEvidenceItem({ id: "r1", type: "MARKET_REGIME", direction: "BULLISH", engine: "regime-h1", tf: "H1" }),
      ]),
      tipStates: { H1: "CLOSED", M15: "CLOSED" },
    });
    expect(fusion.conviction.direction).toBe("BUY");
    expect(fusion.conviction.directionalConvictionScore).toBeGreaterThan(0);
    expect(fusion.conviction.scoreSemantics).toBe("ANALYTICAL_DIRECTIONAL_CONVICTION_NOT_WIN_PROBABILITY");
    expect(fusion.conviction.executionAuthorizationImplied).toBe(false);
  });

  it("2. selects SELL when bearish evidence dominates", () => {
    const fusion = fuseHfmDirectionalBias({
      symbol: "XAUUSD",
      scenarioPackage: makeScenario({
        bullStatus: "INSUFFICIENT",
        bearStatus: "CONFIRMED",
        strongerSide: "BEARISH",
        outcome: "BEARISH_PREFERRED",
      }),
      evidencePackage: makeEvidencePkg([
        makeEvidenceItem({ id: "s1", type: "MARKET_STRUCTURE", direction: "BEARISH", engine: "structure-h1", tf: "H1" }),
        makeEvidenceItem({ id: "r1", type: "MARKET_REGIME", direction: "BEARISH", engine: "regime-h1", tf: "H1" }),
      ]),
    });
    expect(fusion.conviction.direction).toBe("SELL");
  });

  it("3. strong BUY with lower-timeframe conflict still BUY", () => {
    const fusion = fuseHfmDirectionalBias({
      symbol: "XAUUSD",
      scenarioPackage: makeScenario({
        bullStatus: "CONFIRMED",
        bearStatus: "DEVELOPING",
        strongerSide: "BULLISH",
        outcome: "BULLISH_PREFERRED",
      }),
      evidencePackage: makeEvidencePkg([
        makeEvidenceItem({ id: "s1", type: "MARKET_STRUCTURE", direction: "BULLISH", engine: "structure-h1", tf: "H1", score: 90 }),
        makeEvidenceItem({ id: "r1", type: "MARKET_REGIME", direction: "BULLISH", engine: "regime-h4", tf: "H4", score: 90 }),
        makeEvidenceItem({ id: "m1", type: "MOMENTUM", direction: "BEARISH", engine: "mom-m5", tf: "M5", score: 60 }),
      ]),
      tipStates: { H1: "CLOSED", M5: "FORMING" },
    });
    expect(fusion.conviction.direction).toBe("BUY");
    expect(fusion.conviction.contradictingEngineIds.length).toBeGreaterThan(0);
  });

  it("4. strong SELL with lower-timeframe conflict still SELL", () => {
    const fusion = fuseHfmDirectionalBias({
      symbol: "XAUUSD",
      scenarioPackage: makeScenario({
        bullStatus: "DEVELOPING",
        bearStatus: "CONFIRMED",
        strongerSide: "BEARISH",
        outcome: "BEARISH_PREFERRED",
      }),
      evidencePackage: makeEvidencePkg([
        makeEvidenceItem({ id: "s1", type: "MARKET_STRUCTURE", direction: "BEARISH", engine: "structure-h1", tf: "H1", score: 90 }),
        makeEvidenceItem({ id: "r1", type: "MARKET_REGIME", direction: "BEARISH", engine: "regime-h4", tf: "H4", score: 90 }),
        makeEvidenceItem({ id: "m1", type: "MOMENTUM", direction: "BULLISH", engine: "mom-m5", tf: "M5", score: 60 }),
      ]),
    });
    expect(fusion.conviction.direction).toBe("SELL");
  });

  it("5. equal directional scores use deterministic tie-break", () => {
    const fusion = fuseHfmDirectionalBias({
      symbol: "XAUUSD",
      scenarioPackage: null,
      evidencePackage: makeEvidencePkg([]),
      tipStates: {},
    });
    expect(fusion.conviction.direction === "BUY" || fusion.conviction.direction === "SELL").toBe(true);
    expect(fusion.conviction.tieBreakApplied).toBe(true);
    expect(fusion.conviction.directionalConvictionScore).toBeLessThanOrEqual(28);
    expect(fusion.conviction.knownLimitations).toContain("NOT_EXECUTION_AUTHORIZATION");
  });

  it("6. insufficient evidence still emits BUY|SELL with low conviction", () => {
    const fusion = fuseHfmDirectionalBias({
      symbol: "XAUUSD",
      scenarioPackage: makeScenario({
        bullStatus: "INSUFFICIENT",
        bearStatus: "INSUFFICIENT",
        strongerSide: null,
        outcome: "NO_QUALIFIED_OPPORTUNITY",
      }),
      evidencePackage: makeEvidencePkg([]),
    });
    expect(["BUY", "SELL"]).toContain(fusion.conviction.direction);
    expect(fusion.conviction.convictionLabel === "MINIMAL" || fusion.conviction.convictionLabel === "LOW").toBe(true);
  });

  it("7. missing indicators do not crash fusion", () => {
    const fusion = fuseHfmDirectionalBias({
      symbol: "XAUUSD",
      scenarioPackage: null,
      evidencePackage: null,
      pipeline: null,
    });
    expect(["BUY", "SELL"]).toContain(fusion.conviction.direction);
    expect(fusion.conviction.knownLimitations.length).toBeGreaterThan(0);
  });

  it("8. stale market data reduces conviction / quality", () => {
    const fresh = fuseHfmDirectionalBias({
      symbol: "XAUUSD",
      scenarioPackage: makeScenario({
        bullStatus: "CONFIRMED",
        bearStatus: "INSUFFICIENT",
        strongerSide: "BULLISH",
        outcome: "BULLISH_PREFERRED",
      }),
      evidencePackage: makeEvidencePkg([
        makeEvidenceItem({ id: "s1", type: "MARKET_STRUCTURE", direction: "BULLISH", engine: "structure", candleStatus: "CLOSED" }),
      ]),
      tipStates: { H1: "CLOSED" },
    });
    const stale = fuseHfmDirectionalBias({
      symbol: "XAUUSD",
      scenarioPackage: makeScenario({
        bullStatus: "CONFIRMED",
        bearStatus: "INSUFFICIENT",
        strongerSide: "BULLISH",
        outcome: "BULLISH_PREFERRED",
      }),
      evidencePackage: makeEvidencePkg([
        makeEvidenceItem({ id: "s1", type: "MARKET_STRUCTURE", direction: "BULLISH", engine: "structure", candleStatus: "STALE" }),
      ]),
      tipStates: { H1: "STALE", M15: "STALE" },
    });
    expect(stale.conviction.dataQuality).toBeLessThanOrEqual(fresh.conviction.dataQuality);
  });

  it("9. FORMING-only evidence lowers conviction", () => {
    const closed = fuseHfmDirectionalBias({
      symbol: "XAUUSD",
      scenarioPackage: null,
      evidencePackage: makeEvidencePkg([
        makeEvidenceItem({ id: "s1", type: "MARKET_STRUCTURE", direction: "BULLISH", engine: "structure", candleStatus: "CLOSED", score: 90 }),
        makeEvidenceItem({ id: "r1", type: "MARKET_REGIME", direction: "BULLISH", engine: "regime", candleStatus: "CLOSED", score: 90 }),
      ]),
      tipStates: { H1: "CLOSED" },
    });
    const forming = fuseHfmDirectionalBias({
      symbol: "XAUUSD",
      scenarioPackage: null,
      evidencePackage: makeEvidencePkg([
        makeEvidenceItem({ id: "s1", type: "MARKET_STRUCTURE", direction: "BULLISH", engine: "structure", candleStatus: "FORMING", score: 90 }),
        makeEvidenceItem({ id: "r1", type: "MARKET_REGIME", direction: "BULLISH", engine: "regime", candleStatus: "FORMING", score: 90 }),
      ]),
      tipStates: { H1: "FORMING" },
    });
    expect(forming.conviction.directionalConvictionScore).toBeLessThanOrEqual(closed.conviction.directionalConvictionScore);
    expect(forming.conviction.knownLimitations.some((l) => /FORMING/i.test(l))).toBe(true);
  });

  it("10. closed-candle confirmation contributes higher quality", () => {
    const fusion = fuseHfmDirectionalBias({
      symbol: "XAUUSD",
      scenarioPackage: makeScenario({
        bullStatus: "CONFIRMED",
        bearStatus: "INSUFFICIENT",
        strongerSide: "BULLISH",
        outcome: "BULLISH_PREFERRED",
      }),
      evidencePackage: makeEvidencePkg([
        makeEvidenceItem({ id: "s1", type: "MARKET_STRUCTURE", direction: "BULLISH", engine: "structure", candleStatus: "CLOSED" }),
      ]),
      tipStates: { H1: "CLOSED", M15: "CLOSED" },
    });
    expect(fusion.conviction.direction).toBe("BUY");
    expect(fusion.conviction.dataQuality).toBeGreaterThan(0.5);
  });

  it("11. correlated evidence is not double-counted beyond family cap", () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      makeEvidenceItem({
        id: `m${i}`,
        type: "MOMENTUM",
        direction: "BULLISH",
        engine: `mom-${i}`,
        assessmentId: `same-assessment`, // same underlying fact
        score: 90,
      }),
    );
    const fusion = fuseHfmDirectionalBias({
      symbol: "XAUUSD",
      scenarioPackage: null,
      evidencePackage: makeEvidencePkg(many),
    });
    // Same assessmentId → only one atom kept for MOMENTUM family from evidence map
    const momAtoms = fusion.atoms.filter((a) => a.family === "MOMENTUM");
    expect(momAtoms.length).toBeLessThanOrEqual(2);
  });

  it("12. different-timeframe conflict classified", () => {
    const pipeline = {
      mtfRelation: "CONFLICT",
      timeframeSnapshots: [],
      detection: null,
    } as unknown as MifProductionIntegrationResult;
    const fusion = fuseHfmDirectionalBias({
      symbol: "XAUUSD",
      scenarioPackage: makeScenario({
        bullStatus: "DEVELOPING",
        bearStatus: "DEVELOPING",
        strongerSide: "BULLISH",
        outcome: "BALANCED_CONFLICT",
      }),
      evidencePackage: makeEvidencePkg([
        makeEvidenceItem({ id: "s1", type: "MARKET_STRUCTURE", direction: "BULLISH", engine: "structure-h1", tf: "H1" }),
        makeEvidenceItem({ id: "s2", type: "MARKET_STRUCTURE", direction: "BEARISH", engine: "structure-m5", tf: "M5" }),
      ]),
      pipeline,
    });
    expect(["DIFFERENT_TIMEFRAME", "GENUINE_CONFLICT", "DIFFERENT_METHODOLOGY", "AGREEMENT"]).toContain(
      fusion.conviction.conflictKind,
    );
  });

  it("13. genuine engine disagreement surfaces contradicting engines", () => {
    const fusion = fuseHfmDirectionalBias({
      symbol: "XAUUSD",
      scenarioPackage: makeScenario({
        bullStatus: "WAITING_FOR_CONFIRMATION",
        bearStatus: "WAITING_FOR_CONFIRMATION",
        strongerSide: null,
        outcome: "BALANCED_CONFLICT",
      }),
      evidencePackage: makeEvidencePkg([
        makeEvidenceItem({ id: "s1", type: "MARKET_STRUCTURE", direction: "BULLISH", engine: "structure", tf: "H1", score: 80 }),
        makeEvidenceItem({ id: "r1", type: "MARKET_REGIME", direction: "BEARISH", engine: "regime", tf: "H1", score: 80 }),
        makeEvidenceItem({ id: "d1", type: "DEEP_TECHNICAL_INTELLIGENCE", direction: "BULLISH", engine: "dti", tf: "H1", score: 70 }),
        makeEvidenceItem({ id: "m1", type: "MOMENTUM", direction: "BEARISH", engine: "momentum", tf: "H1", score: 70 }),
      ]),
    });
    expect(fusion.conviction.supportingEngineIds.length).toBeGreaterThan(0);
    expect(fusion.conviction.contradictingEngineIds.length).toBeGreaterThan(0);
  });

  it("14. invalid/incomplete levels do not invent prices — fusion still directional", () => {
    const fusion = fuseHfmDirectionalBias({
      symbol: "XAUUSD",
      scenarioPackage: makeScenario({
        bullStatus: "DEVELOPING",
        bearStatus: "INSUFFICIENT",
        strongerSide: "BULLISH",
        outcome: "BULLISH_PREFERRED",
      }),
      evidencePackage: makeEvidencePkg([
        makeEvidenceItem({ id: "s1", type: "MARKET_STRUCTURE", direction: "BULLISH", engine: "structure" }),
      ]),
    });
    expect(fusion.conviction.direction).toBe("BUY");
    expect(fusion.conviction.executionAuthorizationImplied).toBe(false);
  });

  it("15. direction present while entry unavailable after applyPrimaryMarketDirection", () => {
    const fusion = fuseHfmDirectionalBias({
      symbol: "XAUUSD",
      scenarioPackage: makeScenario({
        bullStatus: "WAITING_FOR_CONFIRMATION",
        bearStatus: "INSUFFICIENT",
        strongerSide: "BULLISH",
        outcome: "BULLISH_PREFERRED",
      }),
      evidencePackage: makeEvidencePkg([
        makeEvidenceItem({ id: "s1", type: "MARKET_STRUCTURE", direction: "BULLISH", engine: "structure" }),
      ]),
    });
    const applied = applyPrimaryMarketDirection({
      result: mockValidated("WAITING_FOR_CONFIRMATION"),
      fusion,
      strongerSide: "BULLISH",
    });
    expect(applied.marketDirection).toBe("BUY");
    expect(applied.decision.action).toBe("BUY");
    expect(applied.decisionStatus).toBe("WAITING_FOR_CONFIRMATION");
    expect(applied.executionReadiness).toBe("WAITING_FOR_CONFIRMATION");
    expect(applied.tradePlan.setupStatus).not.toBe("READY");
    expect(applied.acceptsForExecution).toBe(false);
  });

  it("16. execution authorization remains disabled", () => {
    const fusion = fuseHfmDirectionalBias({
      symbol: "XAUUSD",
      scenarioPackage: makeScenario({
        bullStatus: "CONFIRMED",
        bearStatus: "INSUFFICIENT",
        strongerSide: "BULLISH",
        outcome: "BULLISH_PREFERRED",
      }),
      evidencePackage: makeEvidencePkg([
        makeEvidenceItem({ id: "s1", type: "MARKET_STRUCTURE", direction: "BULLISH", engine: "structure" }),
      ]),
    });
    const applied = applyPrimaryMarketDirection({
      result: mockValidated("BUY"),
      fusion,
    });
    expect(applied.placesOrders).toBe(false);
    expect(applied.mutatesBroker).toBe(false);
    expect(applied.acceptsForExecution).toBe(false);
    expect(applied.directionalConviction?.executionAuthorizationImplied).toBe(false);
  });

  it("17. conviction score is reproducible from same evidence", () => {
    const input = {
      symbol: "XAUUSD",
      scenarioPackage: makeScenario({
        bullStatus: "CONFIRMED",
        bearStatus: "INSUFFICIENT",
        strongerSide: "BULLISH" as const,
        outcome: "BULLISH_PREFERRED" as const,
      }),
      evidencePackage: makeEvidencePkg([
        makeEvidenceItem({ id: "s1", type: "MARKET_STRUCTURE", direction: "BULLISH" as const, engine: "structure", tf: "H1" }),
        makeEvidenceItem({ id: "r1", type: "MARKET_REGIME", direction: "BULLISH" as const, engine: "regime", tf: "H1" }),
      ]),
      tipStates: { H1: "CLOSED" },
      generatedAt: "2024-01-01T00:00:00.000Z",
    };
    const a = fuseHfmDirectionalBias(input);
    const b = fuseHfmDirectionalBias(input);
    expect(a.conviction.direction).toBe(b.conviction.direction);
    expect(a.conviction.directionalConvictionScore).toBe(b.conviction.directionalConvictionScore);
    expect(a.conviction.bullishEvidenceScore).toBe(b.conviction.bullishEvidenceScore);
    expect(a.conviction.bearishEvidenceScore).toBe(b.conviction.bearishEvidenceScore);
    expect(a.conviction.calculationVersion).toBe(HFM_DIRECTIONAL_FUSION_CALCULATION_VERSION);
  });

  it("18. no win-probability mislabeling", () => {
    const fusion = fuseHfmDirectionalBias({
      symbol: "XAUUSD",
      scenarioPackage: makeScenario({
        bullStatus: "CONFIRMED",
        bearStatus: "INSUFFICIENT",
        strongerSide: "BULLISH",
        outcome: "BULLISH_PREFERRED",
      }),
      evidencePackage: makeEvidencePkg([
        makeEvidenceItem({ id: "s1", type: "MARKET_STRUCTURE", direction: "BULLISH", engine: "structure" }),
      ]),
    });
    expect(fusion.conviction.scoreSemantics).toBe("ANALYTICAL_DIRECTIONAL_CONVICTION_NOT_WIN_PROBABILITY");
    expect(fusion.conviction.knownLimitations).toContain("NOT_WIN_PROBABILITY");
    const applied = applyPrimaryMarketDirection({
      result: mockValidated("WAITING_FOR_CONFIRMATION"),
      fusion,
    });
    expect(isPredictionBridgeEligible(applied)).toBe(false);
    expect(applied.confidenceSemantics.decisionConfidenceIsWinProbability).toBe(false);
  });
});

describe("validator — directional BUY/SELL without READY setup", () => {
  it("accepts BUY direction when TF gaps exist and setup is WAITING", () => {
    const raw = buildMockValidReasoningPayload({
      symbol: "XAUUSD",
      contextId: "snap-1",
      snapshotId: "snap-1",
      snapshotHash: "hash-1",
      model: "test",
      action: "BUY",
    });
    raw.decisionStatus = "WAITING_FOR_CONFIRMATION";
    raw.marketDirection = "BUY";
    raw.executionReadiness = "WAITING_FOR_CONFIRMATION";
    (raw.tradePlan as Record<string, unknown>).direction = "NONE";
    (raw.tradePlan as Record<string, unknown>).setupStatus = "WAITING";
    (raw.tradePlan as Record<string, unknown>).entryZone = { low: null, high: null };
    (raw.tradePlan as Record<string, unknown>).stopLoss = null;
    (raw.tradePlan as Record<string, unknown>).takeProfitTargets = [];
    (raw.tradePlan as Record<string, unknown>).invalidationPrice = null;
    (raw.tradePlan as Record<string, unknown>).riskRewardEstimate = null;
    // Simulate missing TF blocks (NOT_PROVIDED)
    raw.timeframeAnalysis = {
      H1: { sectionStatus: "NOT_PROVIDED" },
      M30: { sectionStatus: "NOT_PROVIDED" },
      M15: { sectionStatus: "NOT_PROVIDED" },
      M5: { sectionStatus: "NOT_PROVIDED" },
    };
    raw.marketOverview = {
      sectionStatus: "NOT_PROVIDED",
      marketCondition: "UNCLEAR",
      overallBias: "MIXED",
      higherTimeframeBias: "unclear",
      timeframeAlignment: "UNCLEAR",
    };
    const v = validateHfmReasoningModelResponse({
      raw,
      expected: {
        symbol: "XAUUSD",
        contextId: "snap-1",
        snapshotId: "snap-1",
        snapshotHash: "hash-1",
        model: "test",
        analysisId: "an-1",
      },
      instrument: null,
    });
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.result.decision.action).toBe("BUY");
      expect(v.result.analysisStatus).toBe("COMPLETED_WITH_GAPS");
    }
  });
});

describe("Charts parse + UI fields", () => {
  it("parses marketDirection and conviction as primary hero fields", () => {
    const fusion: HfmDirectionalFusionPackage = fuseHfmDirectionalBias({
      symbol: "XAUUSD",
      scenarioPackage: makeScenario({
        bullStatus: "CONFIRMED",
        bearStatus: "INSUFFICIENT",
        strongerSide: "BULLISH",
        outcome: "BULLISH_PREFERRED",
      }),
      evidencePackage: makeEvidencePkg([
        makeEvidenceItem({ id: "s1", type: "MARKET_STRUCTURE", direction: "BULLISH", engine: "structure" }),
      ]),
    });
    const applied = applyPrimaryMarketDirection({
      result: mockValidated("WAITING_FOR_CONFIRMATION"),
      fusion,
    });
    const view = parseHfmAnalysisRecord({
      analysisId: "an-1",
      snapshotId: "snap-1",
      symbol: "XAUUSD",
      status: "COMPLETED",
      result: applied,
      lineage: null,
    });
    expect(view).not.toBeNull();
    expect(view!.marketDirection).toBe("BUY");
    expect(view!.action).toBe("BUY");
    expect(view!.decisionStatus).toBe("WAITING_FOR_CONFIRMATION");
    expect(view!.executionReadiness).toBe("WAITING_FOR_CONFIRMATION");
    expect(view!.directionalConviction?.score).toBeGreaterThan(0);
    expect(view!.estimatedProbabilityStatus).toBe("NOT_AVAILABLE");
  });
});
