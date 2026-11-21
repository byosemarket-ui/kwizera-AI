/**
 * Phase 5 — Unified OpenAI AI Analysis (Charts Analyze Now path).
 * Fixture-based; no live OpenAI; no broker mutation.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  HFM_REASONING_CONFIDENCE_DEFINITION,
  HFM_REASONING_PROMPT_VERSION,
  HFM_REASONING_SCHEMA_VERSION,
  HFM_UNIFIED_AI_INPUT_CONTRACT_ID,
  HFM_UNIFIED_AI_MAX_CANDIDATES,
  HFM_UNIFIED_AI_MAX_EVIDENCE,
  buildHfmUnifiedAiAnalysisInput,
  buildMockValidReasoningPayload,
  verifyUnifiedPackageIdentity,
  validateHfmReasoningModelResponse,
  groundingFromUnifiedAllowlist,
  isPriceGrounded,
  HfmReasoningStorage,
  __setHfmReasoningStorageForTests,
} from "../../../../ai/market-data/mt5-hfm/analysis/reasoning/index";
import {
  HfmAnalysisStorage,
  __setHfmAnalysisStorageForTests,
  type HfmAnalysisContextResult,
} from "../../../../ai/market-data/mt5-hfm/analysis/index";
import { getMifOdWorkerStatus } from "../../../../ai/market-data/mt5-hfm/mif/index";
import { OPENAI_AI_MAX_CONCURRENT as GATE_MAX } from "../../../../ai/forex-ai/snapshot-openai/concurrency";

const SNAP_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const SNAP_HASH = "b".repeat(64);
const SYMBOL = "XAUUSD";

function makeContext(symbol = SYMBOL): HfmAnalysisContextResult {
  const mkTf = (tf: string) => {
    const historical = Array.from({ length: 40 }, (_, i) => ({
      symbol,
      provider: "HFM_MT5" as const,
      timeframe: tf,
      timestamp: 1_700_000_000 + i * 300,
      open: 2000 + i * 0.01,
      high: 2000.1 + i * 0.01,
      low: 1999.9 + i * 0.01,
      close: 2000.05 + i * 0.01,
      tickVolume: 10,
      realVolume: null,
      volumeType: "tick" as const,
      provenance: "native" as const,
      isCurrent: false,
      sourceTimestamp: 1_700_000_000 + i * 300,
      normalizedAt: new Date().toISOString(),
    }));
    return {
      timeframe: tf,
      symbol,
      historical,
      current: { ...historical[historical.length - 1]!, isCurrent: true, provenance: "live_aggregate" as const },
      candleCount: historical.length,
      oldestTimestamp: historical[0]!.timestamp,
      newestTimestamp: historical[historical.length - 1]!.timestamp,
      freshness: "LIVE" as const,
      connectionStatus: "CONNECTED",
      validationStatus: "ok" as const,
      sourceProvenance: "HFM_MT5",
      errors: [],
    };
  };
  return {
    ok: true,
    state: "COMPLETED",
    job: {
      jobId: "job-1",
      provider: "HFM_MT5",
      symbolAtStart: symbol,
      selectedSymbolVersion: 1,
      chartTimeframeAtStart: "H4",
      analysisTimeframes: ["H4", "H1", "M30", "M15", "M5"],
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      status: "COMPLETED",
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
    },
    snapshot: {
      snapshotId: SNAP_ID,
      snapshotHash: SNAP_HASH,
      hashVersion: "hfm-analysis-snapshot-v1",
      provider: "HFM_MT5",
      symbol,
      capturedAt: new Date().toISOString(),
      chartTimeframeAtStart: "H4",
      timeframes: {
        H4: mkTf("H4"),
        H1: mkTf("H1"),
        M30: mkTf("M30"),
        M15: mkTf("M15"),
        M5: mkTf("M5"),
      },
      quote: {
        symbol,
        bid: 2000,
        ask: 2000.1,
        spread: 0.1,
        brokerTimestamp: Math.floor(Date.now() / 1000),
        receiveTimestamp: new Date().toISOString(),
        freshness: "LIVE",
        acquisition: "SymbolInfoTick",
      },
      dataQuality: {
        status: "VALID",
        errors: [],
        warnings: [],
        approvedForAiReasoning: true,
        policyNote: "test",
      },
      synchronization: {
        status: "VALID",
        symbol,
        timeframesPresent: ["H4", "H1", "M30", "M15", "M5"],
        timeframesMissing: [],
        latestQuoteTimestamp: Math.floor(Date.now() / 1000),
        latestCandleByTf: { H4: 1, H1: 1, M30: 1, M15: 1, M5: 1 },
        warnings: [],
        errors: [],
      },
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
    },
    chartImages: {},
    timings: { collectMs: 1, normalizeMs: 1, validateMs: 1, syncMs: 1, renderMs: 1, totalMs: 4 },
    diagnostics: [],
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
  };
}

function makeEvidenceItem(id: string, price: number) {
  return {
    contractId: "kwizera.mif.unified-market-evidence.v1",
    contractVersion: "1.0.0",
    evidenceId: id,
    signalId: null,
    analysisId: null,
    sourceEngine: "test",
    engineVersion: "1.0.0",
    providerId: "HFM_MT5",
    providerSymbol: SYMBOL,
    timeframe: "M15",
    instrument: null,
    evidenceType: "MARKET_STRUCTURE",
    direction: "BULLISH",
    eventTime: null,
    observedAt: new Date().toISOString(),
    candleStatus: "CLOSED",
    levels: [{ id: `${id}:entry`, kind: "ENTRY", price, side: "MID", note: null }],
    measurements: [],
    supportingEvidenceIds: [],
    conflictingEvidenceIds: [],
    warnings: [],
    limitations: [],
    validFrom: null,
    validUntil: null,
    score: {
      confidenceType: "STRUCTURE_CONFIDENCE",
      value: 0.7,
      scale: "0-1",
      isWinProbability: false,
      isCalibratedPrediction: null,
      calibrationStatus: null,
      reliabilityStatus: null,
      definition: "structure quality",
    },
    provenance: {
      sourceAssessmentId: `sa-${id}`,
      sourceInputIdentity: null,
      sourceContractId: null,
      sourceContractVersion: null,
      sourceCandidateId: null,
      runId: null,
      snapshotId: SNAP_ID,
      datasetId: null,
      contentHash: null,
      sourceFingerprint: `fp-${id}`,
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

function makeScenario(side: "BULLISH" | "BEARISH", entry: number, inv: number, target: number) {
  return {
    scenarioId: `sc-${side.toLowerCase()}`,
    setupFingerprint: `fp-${side}`,
    side,
    providerId: "HFM_MT5",
    providerSymbol: SYMBOL,
    status: "WAITING_FOR_CONFIRMATION",
    lifecycleState: "WATCHING",
    thesis: `${side} thesis`,
    rationale: `${side} rationale`,
    supportingEvidenceIds: ["ev-1"],
    conflictingEvidenceIds: ["ev-2"],
    missingConfirmations: ["M5 close confirm"],
    invalidationConditions: [`entryPrice=${entry}`, `invalidationPrice=${inv}`, `targetPrice=${target}`],
    contributingCandidateIds: [`cand-${side.toLowerCase()}`],
    contributingStrategyIds: ["trend-continuation"],
    levels: {
      status: "AVAILABLE_FROM_SOURCE",
      entry: { kind: "ENTRY", price: entry, side: "AT", provenance: "test", source: "CANDIDATE_NOTES" },
      invalidation: {
        kind: "INVALIDATION",
        price: inv,
        side: side === "BULLISH" ? "BELOW" : "ABOVE",
        provenance: "test",
        source: "CANDIDATE_NOTES",
      },
      targets: [
        {
          kind: "TARGET",
          price: target,
          side: side === "BULLISH" ? "ABOVE" : "BELOW",
          provenance: "test",
          source: "CANDIDATE_NOTES",
        },
      ],
      riskReward: Math.abs(target - entry) / Math.abs(entry - inv),
      notes: [],
    },
    evidenceCompleteness: {
      supportingCount: 1,
      conflictingCount: 1,
      uniqueAssessmentCount: 2,
      incompleteEvidence: false,
      formingOnlyConfirmationBlocked: false,
      trustedConfirmed: true,
    },
    warnings: [],
    assessmentTimestamp: new Date().toISOString(),
    snapshotId: SNAP_ID,
    snapshotIdSourceVerified: true,
    analyticalScenarioOnly: true,
    notExecutable: true,
    doesNotApproveAiReasoning: true,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
  };
}

function makePackages() {
  const items = [
    makeEvidenceItem("ev-1", 2000),
    makeEvidenceItem("ev-2", 1995),
    makeEvidenceItem("ev-3", 2005),
  ];
  const evidencePackage = {
    contractId: "kwizera.mif.market-evidence-package.v1",
    contractVersion: "1.0.0",
    packageId: "ep-1",
    analysisId: null,
    runId: null,
    snapshotId: SNAP_ID,
    snapshotIdSourceVerified: true,
    providerId: "HFM_MT5",
    providerSymbol: SYMBOL,
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
  const bullish = makeScenario("BULLISH", 2000, 1995, 2010);
  const bearish = makeScenario("BEARISH", 2000, 2005, 1990);
  const scenarioPackage = {
    contractId: "kwizera.mif.scenario-package.v1",
    contractVersion: "1.0.0",
    engineId: "mif-hfm-scenario-intelligence",
    engineVersion: "1.0.0",
    packageId: "sp-1",
    providerId: "HFM_MT5",
    providerSymbol: SYMBOL,
    snapshotId: SNAP_ID,
    snapshotHash: SNAP_HASH,
    snapshotIdSourceVerified: true,
    assessmentTimestamp: new Date().toISOString(),
    bullishScenario: bullish,
    bearishScenario: bearish,
    outcome: "BALANCED_CONFLICT",
    strongerSide: null,
    comparisonExplanation: "Balanced",
    timeframeContext: {
      expectedTimeframes: ["H4", "H1", "M30", "M15", "M5"],
      presentTimeframes: ["H4", "H1", "M30", "M15", "M5"],
      missingTimeframes: [],
      tipStates: { H4: "CLOSED", H1: "CLOSED", M30: "CLOSED", M15: "CLOSED", M5: "FORMING" },
      higherTimeframeContext: [],
      intermediateStructure: [],
      lowerTimeframeFormation: [],
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
  const orchestration = {
    contractId: "kwizera.mif.charts-intelligence-orchestration.v1",
    contractVersion: "1.0.0",
    correlationId: "corr-1",
    snapshotId: SNAP_ID,
    snapshotHash: SNAP_HASH,
    hashVersion: "hfm-analysis-snapshot-v1",
    snapshotIdSourceVerified: true,
    providerId: "HFM_MT5",
    providerSymbol: SYMBOL,
    timeframePack: ["H4", "H1", "M30", "M15", "M5"],
    candleTipStates: { H4: "CLOSED", H1: "CLOSED", M30: "CLOSED", M15: "CLOSED", M5: "FORMING" },
    mifRequestId: "req-1",
    mifRunId: "run-1",
    evidencePackageId: "ep-1",
    evidencePackage,
    scenarioPackage,
    scenarioPackageId: "sp-1",
    orchestrationStatus: "COMPLETE",
    completeness: {
      expectedTimeframes: ["H4", "H1", "M30", "M15", "M5"],
      presentTimeframes: ["H4", "H1", "M30", "M15", "M5"],
      missingTimeframes: [],
      enginesCompleted: ["assemble", "scenario"],
      enginesSkipped: [],
      rankingIncluded: true,
      probabilityIncluded: false,
      scenarioIncluded: true,
      evidenceItemCount: 3,
      evidenceTrustedComplete: true,
      notes: [],
    },
    warnings: [],
    failureReason: null,
    timingsMs: { validateMs: 1, seriesAdaptMs: 1, pipelineMs: 1, assembleMs: 1, persistMs: 1, totalMs: 5 },
    capturedAt: new Date().toISOString(),
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    doesNotApproveAiReasoning: true,
    analyticalOrchestrationOnly: true,
    notExecutable: true,
  };
  return { evidencePackage, scenarioPackage, orchestration };
}

const imageRefs = (["H1", "M30", "M15", "M5"] as const).map((tf) => ({
  timeframe: tf,
  imageId: `img-${tf}`,
  imageHash: createHash("sha256").update(tf).digest("hex"),
  snapshotId: SNAP_ID,
  snapshotHash: SNAP_HASH,
  validationStatus: "ok",
}));

describe("Phase 5 — unified input builder", () => {
  it("includes H4 text context and exactly four images", () => {
    const { orchestration, scenarioPackage } = makePackages();
    const built = buildHfmUnifiedAiAnalysisInput({
      analysisId: "an-1",
      context: makeContext(),
      imageRefs: [...imageRefs],
      orchestration: orchestration as never,
      scenarioPackage: scenarioPackage as never,
    });
    expect(built.contractId).toBe(HFM_UNIFIED_AI_INPUT_CONTRACT_ID);
    expect(built.imageCount).toBe(4);
    const mc = built.packageObject.marketContext as { timeframes: Record<string, { imageAttached?: boolean }> };
    expect(mc.timeframes.H4).toBeTruthy();
    expect(mc.timeframes.H4!.imageAttached).toBe(false);
    expect(mc.timeframes.H1!.imageAttached).toBe(true);
    expect((built.packageObject.images as unknown[]).length).toBe(4);
    expect(built.packageObject.scenarioPackage).toBeTruthy();
    const sp = built.packageObject.scenarioPackage as {
      bullishScenario: { scenarioId: string };
      bearishScenario: { scenarioId: string };
    };
    expect(sp.bullishScenario.scenarioId).toBe("sc-bullish");
    expect(sp.bearishScenario.scenarioId).toBe("sc-bearish");
    expect(built.grounding.allowedEvidenceIds).toEqual(["ev-1", "ev-2", "ev-3"]);
  });

  it("enforces evidence and candidate caps with PARTIAL truncation", () => {
    const { orchestration, scenarioPackage } = makePackages();
    const many = Array.from({ length: 100 }, (_, i) => makeEvidenceItem(`ev-x-${i}`, 2000 + i));
    const orch = {
      ...orchestration,
      evidencePackage: { ...orchestration.evidencePackage, items: many },
    };
    const built = buildHfmUnifiedAiAnalysisInput({
      analysisId: "an-2",
      context: makeContext(),
      imageRefs: [...imageRefs],
      orchestration: orch as never,
      scenarioPackage: scenarioPackage as never,
      maxEvidence: HFM_UNIFIED_AI_MAX_EVIDENCE,
      maxCandidates: HFM_UNIFIED_AI_MAX_CANDIDATES,
    });
    expect(
      (built.packageObject.deterministicEvidence as { itemCount: number }).itemCount,
    ).toBe(HFM_UNIFIED_AI_MAX_EVIDENCE);
    expect(built.completeness).toBe("PARTIAL");
    expect(built.warnings.some((w) => /evidence_truncated/.test(w))).toBe(true);
  });

  it("rejects snapshot/symbol mismatched packages", () => {
    const { orchestration, scenarioPackage } = makePackages();
    const bad = verifyUnifiedPackageIdentity({
      snapshotId: SNAP_ID,
      snapshotHash: SNAP_HASH,
      symbol: SYMBOL,
      orchestration: { ...orchestration, snapshotId: "other-snap" },
      scenarioPackage: { ...scenarioPackage, providerSymbol: "EURUSD" },
    });
    expect(bad.rejected).toContain("orchestration_snapshot_mismatch");
    expect(bad.rejected).toContain("scenario_package_symbol_mismatch");
    expect(bad.orchestration).toBeNull();
    expect(bad.scenarioPackage).toBeNull();
  });

  it("produces stable unifiedInputIdentity for identical normalized packages", () => {
    const { orchestration, scenarioPackage } = makePackages();
    const args = {
      analysisId: "an-stable",
      context: makeContext(),
      imageRefs: [...imageRefs],
      orchestration: orchestration as never,
      scenarioPackage: scenarioPackage as never,
    };
    const a = buildHfmUnifiedAiAnalysisInput(args);
    const b = buildHfmUnifiedAiAnalysisInput(args);
    expect(a.unifiedInputIdentity).toBe(b.unifiedInputIdentity);
    expect(a.unifiedInputIdentity).toMatch(/^[a-f0-9]{64}$/);
  });

  it("never fabricates levels when scenario missing — PARTIAL", () => {
    const built = buildHfmUnifiedAiAnalysisInput({
      analysisId: "an-3",
      context: makeContext(),
      imageRefs: [...imageRefs],
      orchestration: null,
      scenarioPackage: null,
    });
    expect(built.completeness).toBe("PARTIAL");
    expect(built.grounding.allowedPrices).toEqual([]);
    expect(built.scenarioPackageId).toBeNull();
    expect(built.packageObject.knownLimitations).toEqual(
      expect.arrayContaining(["input_package_PARTIAL_do_not_describe_as_complete"]),
    );
  });
});

describe("Phase 5 — schema v1.2 grounding", () => {
  const expected = {
    symbol: SYMBOL,
    contextId: SNAP_ID,
    snapshotId: SNAP_ID,
    snapshotHash: SNAP_HASH,
    model: "gpt-test",
    analysisId: "an-g1",
  };

  function grounding(overrides?: Partial<ReturnType<typeof groundingFromUnifiedAllowlist>>) {
    return groundingFromUnifiedAllowlist({
      analysisId: "an-g1",
      grounding: {
        allowedEvidenceIds: ["ev-1", "ev-2", "ev-3"],
        allowedScenarioIds: ["sc-bullish", "sc-bearish"],
        allowedCandidateIds: ["cand-bullish"],
        allowedPrices: [2000, 1995, 2010, 2005, 1990, 100, 101, 99, 103, 98.5, 102],
        formingOnlyConfirmationBlocked: false,
        scenarioOutcome: "BALANCED_CONFLICT",
        rankingIsNotProbability: true,
      },
      inputCompleteness: "COMPLETE",
      evidencePackageId: "ep-1",
      scenarioPackageId: "sp-1",
      unifiedInputIdentity: "abc",
      tickSize: 0.01,
      ...overrides,
    });
  }

  it("accepts agreement with ranking and WAITING_FOR_CONFIRMATION", () => {
    const raw = buildMockValidReasoningPayload({
      ...expected,
      action: "WAITING_FOR_CONFIRMATION",
      supportingEvidenceIds: ["ev-1"],
      selectedScenarioId: "sc-bullish",
      agreesWithRanking: true,
      agreesWithScenarioOutcome: true,
    });
    // Align trade plan prices unused for waiting
    const v = validateHfmReasoningModelResponse({
      raw,
      expected,
      grounding: grounding(),
    });
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.result.schemaVersion).toBe(HFM_REASONING_SCHEMA_VERSION);
      expect(v.result.promptVersion).toBe(HFM_REASONING_PROMPT_VERSION);
      expect(v.result.decision.action).toBe("WAITING_FOR_CONFIRMATION");
      expect(v.result.confidenceSemantics.decisionConfidenceIsWinProbability).toBe(false);
      expect(v.result.confidenceSemantics.definition).toContain("NOT win probability");
      expect(v.result.deterministicDisagreement.agreesWithRanking).toBe(true);
    }
  });

  it("requires disagreement reason and alternative evidence when disagreeing", () => {
    const raw = buildMockValidReasoningPayload({
      ...expected,
      action: "NO_TRADE",
      agreesWithRanking: false,
      agreesWithScenarioOutcome: false,
      disagreementReason: null,
      alternativeEvidenceIds: [],
    });
    const v = validateHfmReasoningModelResponse({
      raw,
      expected,
      grounding: grounding(),
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.error).toMatch(/disagreementReason/i);
  });

  it("accepts explicit disagreement with evidence", () => {
    const raw = buildMockValidReasoningPayload({
      ...expected,
      action: "NO_TRADE",
      agreesWithRanking: false,
      agreesWithScenarioOutcome: false,
      disagreementReason: "Conflicting MTF structure outweighs ranking preference",
      alternativeEvidenceIds: ["ev-2"],
      supportingEvidenceIds: ["ev-2"],
    });
    const v = validateHfmReasoningModelResponse({
      raw,
      expected,
      grounding: grounding(),
    });
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.result.deterministicDisagreement.agreesWithRanking).toBe(false);
      expect(v.result.deterministicDisagreement.alternativeEvidenceIds).toContain("ev-2");
    }
  });

  it("rejects unknown evidence IDs", () => {
    const raw = buildMockValidReasoningPayload({
      ...expected,
      action: "NO_TRADE",
      supportingEvidenceIds: ["ev-unknown"],
    });
    const v = validateHfmReasoningModelResponse({
      raw,
      expected,
      grounding: grounding(),
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.code).toBe("EVIDENCE_GROUNDING_FAILED");
  });

  it("rejects unknown scenario IDs", () => {
    const raw = buildMockValidReasoningPayload({
      ...expected,
      action: "NO_TRADE",
      selectedScenarioId: "sc-forged",
    });
    const v = validateHfmReasoningModelResponse({
      raw,
      expected,
      grounding: grounding(),
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.code).toBe("SCENARIO_GROUNDING_FAILED");
  });

  it("rejects invented prices on BUY", () => {
    const raw = buildMockValidReasoningPayload({
      ...expected,
      action: "BUY",
      supportingEvidenceIds: ["ev-1"],
      selectedScenarioId: "sc-bullish",
    });
    // mock BUY uses 100/101/99/103 — remove them from allowlist
    const g = groundingFromUnifiedAllowlist({
      analysisId: "an-g1",
      grounding: {
        allowedEvidenceIds: ["ev-1", "ev-2", "ev-3"],
        allowedScenarioIds: ["sc-bullish", "sc-bearish"],
        allowedCandidateIds: [],
        allowedPrices: [2000, 1995, 2010],
        formingOnlyConfirmationBlocked: false,
        scenarioOutcome: "BULLISH_PREFERRED",
        rankingIsNotProbability: true,
      },
      inputCompleteness: "COMPLETE",
      evidencePackageId: "ep-1",
      scenarioPackageId: "sp-1",
      unifiedInputIdentity: "abc",
      tickSize: 0.01,
    });
    const v = validateHfmReasoningModelResponse({
      raw,
      expected,
      instrument: {
        symbol: SYMBOL,
        digits: 2,
        point: 0.01,
        tickSize: 0.01,
        source: "HFM_CATALOG",
      },
      grounding: g,
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.code).toBe("INVENTED_PRICE_REJECTED");
  });

  it("accepts source-backed BUY levels", () => {
    const raw = buildMockValidReasoningPayload({
      ...expected,
      action: "BUY",
      supportingEvidenceIds: ["ev-1"],
      selectedScenarioId: "sc-bullish",
    });
    (raw.tradePlan as Record<string, unknown>).entryZone = { low: 2000, high: 2000 };
    (raw.tradePlan as Record<string, unknown>).stopLoss = 1995;
    (raw.tradePlan as Record<string, unknown>).takeProfitTargets = [2010];
    (raw.tradePlan as Record<string, unknown>).invalidationPrice = 1995;
    (raw.tradePlan as Record<string, unknown>).riskRewardEstimate = 2;
    const v = validateHfmReasoningModelResponse({
      raw,
      expected,
      instrument: {
        symbol: SYMBOL,
        digits: 2,
        point: 0.01,
        tickSize: 0.01,
        source: "HFM_CATALOG",
      },
      grounding: grounding(),
    });
    expect(v.ok).toBe(true);
  });

  it("blocks FORMING-only confirmation for BUY", () => {
    const raw = buildMockValidReasoningPayload({
      ...expected,
      action: "BUY",
      supportingEvidenceIds: ["ev-1"],
      selectedScenarioId: "sc-bullish",
    });
    (raw.tradePlan as Record<string, unknown>).entryZone = { low: 2000, high: 2000 };
    (raw.tradePlan as Record<string, unknown>).stopLoss = 1995;
    (raw.tradePlan as Record<string, unknown>).takeProfitTargets = [2010];
    (raw.tradePlan as Record<string, unknown>).invalidationPrice = 1995;
    const g = groundingFromUnifiedAllowlist({
      analysisId: "an-g1",
      grounding: {
        allowedEvidenceIds: ["ev-1"],
        allowedScenarioIds: ["sc-bullish"],
        allowedCandidateIds: [],
        allowedPrices: [2000, 1995, 2010],
        formingOnlyConfirmationBlocked: true,
        scenarioOutcome: "BULLISH_PREFERRED",
        rankingIsNotProbability: true,
      },
      inputCompleteness: "COMPLETE",
      evidencePackageId: "ep-1",
      scenarioPackageId: "sp-1",
      unifiedInputIdentity: "abc",
      tickSize: 0.01,
    });
    const v = validateHfmReasoningModelResponse({
      raw,
      expected,
      instrument: {
        symbol: SYMBOL,
        digits: 2,
        point: 0.01,
        tickSize: 0.01,
        source: "HFM_CATALOG",
      },
      grounding: g,
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.error).toMatch(/forming_only/i);
  });

  it("rejects win-probability language", () => {
    const raw = buildMockValidReasoningPayload({
      ...expected,
      action: "NO_TRADE",
    });
    (raw.decision as Record<string, unknown>).summary = "High win probability setup";
    const v = validateHfmReasoningModelResponse({
      raw,
      expected,
      grounding: grounding(),
    });
    expect(v.ok).toBe(false);
  });

  it("isPriceGrounded matches tick-sized sources", () => {
    expect(isPriceGrounded(2000.0, new Set([2000]), 0.01)).toBe(true);
    expect(isPriceGrounded(1999.5, new Set([2000]), 0.01)).toBe(false);
  });

  it("confidence definition constant is explicit", () => {
    expect(HFM_REASONING_CONFIDENCE_DEFINITION).toMatch(/NOT win probability/i);
  });
});

describe("Phase 5 — persistence lineage", () => {
  let tmp: string;
  let store: HfmReasoningStorage;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "hfm-p5-"));
    store = new HfmReasoningStorage(tmp);
    __setHfmReasoningStorageForTests(store);
    await store.ensureReady();
  });

  afterEach(async () => {
    __setHfmReasoningStorageForTests(null);
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("persists lineage linked to snapshot and packages", async () => {
    await store.save({
      analysisId: "a-p5",
      contextId: SNAP_ID,
      snapshotId: SNAP_ID,
      snapshotHash: SNAP_HASH,
      symbol: SYMBOL,
      provider: "HFM_MT5",
      status: "COMPLETED",
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      promptVersion: HFM_REASONING_PROMPT_VERSION,
      schemaVersion: HFM_REASONING_SCHEMA_VERSION,
      model: "gpt-test",
      errorCode: null,
      errorMessage: null,
      dataQualityStatus: "VALID",
      synchronizationStatus: "VALID",
      candleCounts: { H4: 40, H1: 40 },
      imageRefs: [...imageRefs],
      lineage: {
        unifiedInputIdentity: "deadbeef",
        evidencePackageId: "ep-1",
        scenarioPackageId: "sp-1",
        scenarioIds: ["sc-bullish", "sc-bearish"],
        selectedScenarioId: "sc-bullish",
        inputCompleteness: "COMPLETE",
        groundingStatus: "PASSED",
        rankingReference: "BALANCED_CONFLICT",
      },
      usage: null,
      result: null,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
    });
    const loaded = await store.load("a-p5");
    expect(loaded?.lineage?.evidencePackageId).toBe("ep-1");
    expect(loaded?.lineage?.scenarioPackageId).toBe("sp-1");
    expect(loaded?.lineage?.selectedScenarioId).toBe("sc-bullish");
    expect(loaded?.snapshotId).toBe(SNAP_ID);
    expect(loaded?.schemaVersion).toBe("hfm-ai-analysis-v1.2");
  });

  it("persists failure records with lineage", async () => {
    await store.save({
      analysisId: "a-fail",
      contextId: SNAP_ID,
      snapshotId: SNAP_ID,
      snapshotHash: SNAP_HASH,
      symbol: SYMBOL,
      provider: "HFM_MT5",
      status: "FAILED",
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      promptVersion: HFM_REASONING_PROMPT_VERSION,
      schemaVersion: HFM_REASONING_SCHEMA_VERSION,
      model: null,
      errorCode: "INVALID_MODEL_RESPONSE",
      errorMessage: "schema mismatch",
      dataQualityStatus: null,
      synchronizationStatus: null,
      candleCounts: {},
      imageRefs: [],
      lineage: {
        unifiedInputIdentity: "x",
        evidencePackageId: null,
        scenarioPackageId: null,
        scenarioIds: [],
        selectedScenarioId: null,
        inputCompleteness: "PARTIAL",
        groundingStatus: "FAILED",
        rankingReference: null,
      },
      usage: null,
      result: null,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
    });
    const loaded = await store.load("a-fail");
    expect(loaded?.status).toBe("FAILED");
    expect(loaded?.lineage?.groundingStatus).toBe("FAILED");
  });
});

describe("Phase 5 — storage package load by snapshotId", () => {
  let tmp: string;
  let analysisStore: HfmAnalysisStorage;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "hfm-p5-store-"));
    analysisStore = new HfmAnalysisStorage(tmp);
    __setHfmAnalysisStorageForTests(analysisStore);
    await analysisStore.ensureReady();
  });

  afterEach(async () => {
    __setHfmAnalysisStorageForTests(null);
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("loads snapshot-specific evidence and scenario packages", async () => {
    const { orchestration, scenarioPackage } = makePackages();
    await analysisStore.saveIntelligenceOrchestration(SNAP_ID, orchestration);
    await analysisStore.saveScenarioPackage(SNAP_ID, scenarioPackage);
    const orch = await analysisStore.loadIntelligenceOrchestration(SNAP_ID);
    const sc = await analysisStore.loadScenarioPackage(SNAP_ID);
    expect((orch as { evidencePackage: { packageId: string } }).evidencePackage.packageId).toBe("ep-1");
    expect((sc as { packageId: string }).packageId).toBe("sp-1");
    expect(await analysisStore.loadScenarioPackage("other")).toBeNull();
  });
});

describe("Phase 5 — safety regressions", () => {
  it("keeps global OpenAI concurrency at 1", () => {
    expect(GATE_MAX).toBe(1);
  });

  it("OD worker remains disabled", () => {
    const st = getMifOdWorkerStatus();
    expect(st.enabled).toBe(false);
  });

  it("Analyze Now and Auto Analysis share executeAnalysisPipeline → runHfmAiReasoning", async () => {
    const scheduler = await fs.readFile(
      path.join(process.cwd(), "ai/market-data/mt5-hfm/analysis/reasoning/scheduler.ts"),
      "utf8",
    );
    expect(scheduler).toContain("executeAnalysisPipeline");
    expect(scheduler).toContain("runHfmAiReasoning");
    const engine = await fs.readFile(
      path.join(process.cwd(), "ai/market-data/mt5-hfm/analysis/reasoning/engine.ts"),
      "utf8",
    );
    expect(engine).toContain("buildHfmUnifiedAiAnalysisInput");
    expect(engine).toContain("loadScenarioPackage");
    expect(engine).toContain("loadIntelligenceOrchestration");
    expect(engine).not.toMatch(/runMifAiMarketReasoning/);
  });

  it("schema and prompt are v1.2", () => {
    expect(HFM_REASONING_SCHEMA_VERSION).toBe("hfm-ai-analysis-v1.2");
    expect(HFM_REASONING_PROMPT_VERSION).toBe("hfm-ai-reasoning-prompt-v1.2");
  });
});
