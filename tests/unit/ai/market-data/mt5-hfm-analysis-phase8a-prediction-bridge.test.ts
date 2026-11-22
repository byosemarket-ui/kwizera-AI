/**
 * P8.A — Charts → MIF Prediction Outcome bridge.
 * Lightweight: temp storage only; no live OpenAI / broker.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  MifPredictionOutcomeStorage,
  __setMifPredictionOutcomeStorageForTests,
  buildPredictionSnapshot,
  computePredictionId,
} from "../../../../ai/market-data/mt5-hfm/mif/index";
import {
  applyPredictionLinkage,
  bridgeChartsReasoningToPrediction,
  extractChartsTradeLevels,
  resolveActivationFromContext,
  resolveEntryPrice,
  HFM_CHARTS_PREDICTION_BRIDGE_CONTRACT_ID,
  HFM_CHARTS_SOURCE_ANALYSIS_PREFIX,
} from "../../../../ai/market-data/mt5-hfm/analysis/prediction-bridge/index";
import type { HfmReasoningRecord, HfmReasoningValidatedResult } from "../../../../ai/market-data/mt5-hfm/analysis/reasoning/types";
import type { HfmAnalysisContextResult } from "../../../../ai/market-data/mt5-hfm/analysis/types";
import type { MifScenarioPackage } from "../../../../ai/market-data/mt5-hfm/mif/scenario-intelligence/types";
import {
  HFM_REASONING_PROMPT_VERSION,
  HFM_REASONING_SCHEMA_VERSION,
} from "../../../../ai/market-data/mt5-hfm/analysis/reasoning/constants";

const T0 = 1_700_000_000;

function tmpRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "p8a-bridge-"));
}

function baseTradePlan(overrides?: Partial<HfmReasoningValidatedResult["tradePlan"]>) {
  return {
    direction: "BUY" as const,
    setupStatus: "READY" as const,
    entryZone: { low: 1.1, high: 1.12 },
    stopLoss: 1.08,
    takeProfitTargets: [1.16],
    invalidationPrice: 1.075,
    riskRewardEstimate: 2,
    explanation: "test plan",
    ...overrides,
  };
}

function baseResult(
  overrides?: Partial<HfmReasoningValidatedResult> & {
    decision?: Partial<HfmReasoningValidatedResult["decision"]>;
    tradePlan?: Partial<HfmReasoningValidatedResult["tradePlan"]>;
  },
): HfmReasoningValidatedResult {
  const { decision, tradePlan, ...rest } = overrides ?? {};
  return {
    schemaVersion: HFM_REASONING_SCHEMA_VERSION,
    analysisStatus: "COMPLETED",
    provider: "HFM_MT5",
    symbol: "EURUSD",
    contextId: "snap-1",
    snapshotId: "snap-1",
    snapshotHash: "hash-1",
    promptVersion: HFM_REASONING_PROMPT_VERSION,
    model: "gpt-test",
    analysisId: "analysis-1",
    marketRegime: "TRENDING",
    decision: {
      action: "BUY",
      confidence: 0.7,
      confidenceLabel: "MODERATE",
      summary: "bullish setup",
      ...decision,
    },
    decisionStatus: "CONFIRMED",
    selectedScenarioId: "scen-bull-1",
    bullishAssessment: {
      side: "BULLISH",
      status: "ACTIVE",
      summary: "ok",
      supportingEvidenceIds: [],
      conflictingEvidenceIds: [],
      missingConfirmations: [],
      invalidationConditions: [],
    },
    bearishAssessment: {
      side: "BEARISH",
      status: "NOT_SUPPORTED",
      summary: "weak",
      supportingEvidenceIds: [],
      conflictingEvidenceIds: [],
      missingConfirmations: [],
      invalidationConditions: [],
    },
    supportingEvidenceIds: ["ev-1"],
    conflictingEvidenceIds: [],
    missingConfirmations: ["need close above"],
    invalidationConditions: ["break below 1.075"],
    deterministicDisagreement: {
      agreesWithRanking: true,
      agreesWithScenarioOutcome: true,
      disagreementReason: null,
      alternativeEvidenceIds: [],
    },
    confidenceSemantics: {
      decisionConfidenceIsWinProbability: false,
      definition: "analytical",
    },
    unifiedInputIdentity: "ui-1",
    evidencePackageId: "evpkg-1",
    scenarioPackageId: "scpkg-1",
    inputCompleteness: "COMPLETE",
    marketOverview: {
      sectionStatus: "PROVIDED",
      marketCondition: "TRENDING",
      overallBias: "BULLISH",
      higherTimeframeBias: "BULLISH",
      timeframeAlignment: "ALIGNED",
    },
    timeframeAnalysis: {
      H1: {
        sectionStatus: "PROVIDED",
        bias: "BULLISH",
        structure: "HH",
        observations: [],
        supportingEvidence: [],
        risks: [],
      },
      M30: {
        sectionStatus: "NOT_PROVIDED",
        bias: "NOT_PROVIDED",
        structure: "",
        observations: [],
        supportingEvidence: [],
        risks: [],
      },
      M15: {
        sectionStatus: "NOT_PROVIDED",
        bias: "NOT_PROVIDED",
        structure: "",
        observations: [],
        supportingEvidence: [],
        risks: [],
      },
      M5: {
        sectionStatus: "NOT_PROVIDED",
        bias: "NOT_PROVIDED",
        structure: "",
        observations: [],
        supportingEvidence: [],
        risks: [],
      },
    },
    scenarios: {
      bullish: { status: "ACTIVE", conditions: [], confirmation: [], invalidation: [] },
      bearish: { status: "NOT_SUPPORTED", conditions: [], confirmation: [], invalidation: [] },
    },
    tradePlan: baseTradePlan(tradePlan),
    evidence: {
      observedFacts: [],
      interpretations: [],
      uncertainties: [],
      missingData: [],
      dataQualityWarnings: [],
    },
    riskAssessment: {
      sectionStatus: "PROVIDED",
      riskLevel: "MODERATE",
      reasons: [],
      reasonsToAvoidTrade: [],
    },
    nextConfirmation: { required: false, conditions: [], timeframesToWatch: [] },
    completeness: { status: "COMPLETE", missingSections: [], notes: [] },
    pricePrecision: {
      verified: true,
      digits: 5,
      tickSize: 0.00001,
      point: 0.00001,
      source: "HFM_CATALOG",
      reason: null,
    },
    disclaimer: "analytical only",
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    ...rest,
  };
}

function baseRecord(
  overrides?: Partial<HfmReasoningRecord> & {
    result?: HfmReasoningValidatedResult | null;
  },
): HfmReasoningRecord {
  const result = overrides?.result === undefined ? baseResult() : overrides.result;
  return {
    analysisId: "analysis-1",
    contextId: "snap-1",
    snapshotId: "snap-1",
    snapshotHash: "hash-1",
    symbol: "EURUSD",
    provider: "HFM_MT5",
    status: "COMPLETED",
    createdAt: "2024-01-01T00:00:00.000Z",
    completedAt: "2024-01-01T00:01:00.000Z",
    promptVersion: HFM_REASONING_PROMPT_VERSION,
    schemaVersion: HFM_REASONING_SCHEMA_VERSION,
    model: "gpt-test",
    errorCode: null,
    errorMessage: null,
    dataQualityStatus: "VALID",
    synchronizationStatus: "VALID",
    candleCounts: { H1: 100 },
    imageRefs: [],
    lineage: {
      unifiedInputIdentity: "ui-1",
      evidencePackageId: "evpkg-1",
      scenarioPackageId: "scpkg-1",
      scenarioIds: ["scen-bull-1", "scen-bear-1"],
      selectedScenarioId: "scen-bull-1",
      inputCompleteness: "COMPLETE",
      groundingStatus: "PASSED",
      rankingReference: null,
    },
    usage: null,
    predictionLinkage: null,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    ...overrides,
    result,
  };
}

function makeContext(tf = "H1"): HfmAnalysisContextResult {
  return {
    ok: true,
    state: "COMPLETED",
    job: {
      jobId: "job-1",
      provider: "HFM_MT5",
      symbolAtStart: "EURUSD",
      selectedSymbolVersion: 1,
      chartTimeframeAtStart: tf,
      analysisTimeframes: [tf],
      startedAt: "2024-01-01T00:00:00.000Z",
      completedAt: "2024-01-01T00:00:30.000Z",
      status: "COMPLETED",
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
    },
    snapshot: {
      snapshotId: "snap-1",
      snapshotHash: "hash-1",
      hashVersion: "v1",
      provider: "HFM_MT5",
      symbol: "EURUSD",
      capturedAt: "2024-01-01T00:00:30.000Z",
      chartTimeframeAtStart: tf,
      timeframes: {
        [tf]: {
          timeframe: tf,
          symbol: "EURUSD",
          historical: [
            {
              symbol: "EURUSD",
              provider: "HFM_MT5",
              timeframe: tf,
              timestamp: T0,
              open: 1.1,
              high: 1.12,
              low: 1.09,
              close: 1.11,
              tickVolume: 10,
              realVolume: null,
              volumeType: "tick",
              provenance: "native",
              isCurrent: false,
              sourceTimestamp: T0,
              normalizedAt: "2024-01-01T00:00:00.000Z",
            },
            {
              symbol: "EURUSD",
              provider: "HFM_MT5",
              timeframe: tf,
              timestamp: T0 + 3600,
              open: 1.11,
              high: 1.13,
              low: 1.1,
              close: 1.12,
              tickVolume: 10,
              realVolume: null,
              volumeType: "tick",
              provenance: "native",
              isCurrent: true,
              sourceTimestamp: T0 + 3600,
              normalizedAt: "2024-01-01T00:00:00.000Z",
            },
          ],
          current: null,
          candleCount: 2,
          oldestTimestamp: T0,
          newestTimestamp: T0 + 3600,
          freshness: "LIVE",
          connectionStatus: "CONNECTED",
          validationStatus: "ok",
          sourceProvenance: "test",
          errors: [],
        },
      },
      quote: {
        symbol: "EURUSD",
        bid: 1.12,
        ask: 1.1202,
        spread: 2,
        brokerTimestamp: T0 + 3600,
        receiveTimestamp: "2024-01-01T00:00:30.000Z",
        freshness: "LIVE",
        acquisition: "tick",
      },
      dataQuality: {
        status: "VALID",
        errors: [],
        warnings: [],
        approvedForAiReasoning: true,
        policyNote: "ok",
      },
      synchronization: {
        status: "VALID",
        symbol: "EURUSD",
        timeframesPresent: [tf],
        timeframesMissing: [],
        latestQuoteTimestamp: T0 + 3600,
        latestCandleByTf: { [tf]: T0 + 3600 },
        warnings: [],
        errors: [],
      },
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
    },
    chartImages: {},
    timings: {
      collectMs: 1,
      normalizeMs: 1,
      validateMs: 1,
      syncMs: 1,
      renderMs: 1,
      totalMs: 5,
    },
    diagnostics: [],
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
  };
}

function makeScenarioPackage(): MifScenarioPackage {
  // Bridge only reads scenarioId + setupFingerprint; keep fixture minimal.
  return {
    bullishScenario: {
      scenarioId: "scen-bull-1",
      setupFingerprint: "fp-bull-aaa",
    },
    bearishScenario: {
      scenarioId: "scen-bear-1",
      setupFingerprint: "fp-bear-bbb",
    },
  } as unknown as MifScenarioPackage;
}

describe("P8.A Charts prediction bridge", () => {
  let root: string;
  let store: MifPredictionOutcomeStorage;

  beforeEach(() => {
    root = tmpRoot();
    store = new MifPredictionOutcomeStorage(root);
    __setMifPredictionOutcomeStorageForTests(store);
  });

  afterEach(() => {
    __setMifPredictionOutcomeStorageForTests(null);
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("resolves entry midpoint and activation from last closed candle", () => {
    expect(resolveEntryPrice(baseTradePlan())).toBeCloseTo(1.11, 8);
    const act = resolveActivationFromContext(makeContext("H1"), "EURUSD");
    expect(act.ok).toBe(true);
    if (act.ok) {
      expect(act.activation.activationOpenTimeSec).toBe(T0);
      expect(act.activation.timeframe).toBe("H1");
    }
  });

  it("creates BUY prediction with lineage and persists predictionId", async () => {
    const record = baseRecord();
    const out = await bridgeChartsReasoningToPrediction({
      record,
      context: makeContext(),
      scenarioPackage: makeScenarioPackage(),
      storage: store,
      bridgedAt: "2024-01-01T00:02:00.000Z",
    });
    expect(out.status).toBe("CREATED");
    expect(out.predictionId).toMatch(/^pred:/);
    expect(out.created).toBe(true);
    expect(out.linkage.setupFingerprint).toBe("fp-bull-aaa");
    expect(out.linkage.scenarioId).toBe("scen-bull-1");
    expect(out.linkage.evidencePackageId).toBe("evpkg-1");
    expect(out.snapshot?.direction).toBe("BUY");
    expect(out.snapshot?.levels.entry.present).toBe(true);
    expect(out.snapshot?.levels.target.present).toBe(true);
    expect(out.snapshot?.levels.invalidation.present).toBe(true);
    expect(out.snapshot?.sourceAnalysisIdentity).toBe(
      `${HFM_CHARTS_SOURCE_ANALYSIS_PREFIX}analysis-1`,
    );
    expect(out.snapshot?.analysisRunId).toBe("analysis-1");
    expect(out.contractId).toBe(HFM_CHARTS_PREDICTION_BRIDGE_CONTRACT_ID);

    const loaded = await store.getSnapshot(out.predictionId!);
    expect(loaded?.snapshotHash).toBe(out.snapshot?.snapshotHash);

    const linked = applyPredictionLinkage(record, out);
    expect(linked.result?.decision.action).toBe("BUY");
    expect(linked.predictionLinkage?.predictionId).toBe(out.predictionId);
  });

  it("creates SELL prediction with valid inverted levels", async () => {
    const record = baseRecord({
      result: baseResult({
        decision: { action: "SELL", confidence: 0.6, confidenceLabel: "MODERATE", summary: "bear" },
        tradePlan: {
          direction: "SELL",
          entryZone: { low: 1.1, high: 1.12 },
          stopLoss: 1.14,
          takeProfitTargets: [1.06],
          invalidationPrice: 1.145,
        },
        selectedScenarioId: "scen-bear-1",
      }),
    });
    const out = await bridgeChartsReasoningToPrediction({
      record,
      context: makeContext(),
      scenarioPackage: makeScenarioPackage(),
      storage: store,
    });
    expect(out.status).toBe("CREATED");
    expect(out.snapshot?.direction).toBe("SELL");
    expect(out.linkage.setupFingerprint).toBe("fp-bear-bbb");
  });

  it("excludes NO_TRADE without creating a prediction", async () => {
    const record = baseRecord({
      result: baseResult({
        decision: {
          action: "NO_TRADE",
          confidence: 0.4,
          confidenceLabel: "LOW",
          summary: "no trade",
        },
      }),
    });
    const out = await bridgeChartsReasoningToPrediction({
      record,
      context: makeContext(),
      storage: store,
    });
    expect(out.status).toBe("SKIPPED");
    expect(out.reason).toBe("NO_TRADE");
    expect(out.predictionId).toBeNull();
    await store.ensureLayout();
    const files = fs.readdirSync(store.snapshotsDir()).filter((f) => f.endsWith(".json"));
    expect(files.length).toBe(0);
  });

  it("excludes WAITING_FOR_CONFIRMATION without creating a prediction", async () => {
    const record = baseRecord({
      result: baseResult({
        decision: {
          action: "WAITING_FOR_CONFIRMATION",
          confidence: 0.5,
          confidenceLabel: "MODERATE",
          summary: "wait",
        },
      }),
    });
    const out = await bridgeChartsReasoningToPrediction({
      record,
      context: makeContext(),
      storage: store,
    });
    expect(out.status).toBe("SKIPPED");
    expect(out.reason).toBe("WAITING");
    expect(out.predictionId).toBeNull();
  });

  it("skips missing levels", async () => {
    const levels = extractChartsTradeLevels(
      baseResult({
        tradePlan: { stopLoss: null, takeProfitTargets: [], invalidationPrice: null },
      }),
    );
    expect(levels.ok).toBe(false);
    if (!levels.ok) expect(levels.code).toBe("MISSING_LEVELS");

    const out = await bridgeChartsReasoningToPrediction({
      record: baseRecord({
        result: baseResult({
          tradePlan: { stopLoss: null, takeProfitTargets: [], invalidationPrice: null },
        }),
      }),
      context: makeContext(),
      storage: store,
    });
    expect(out.status).toBe("SKIPPED");
    expect(out.reason).toBe("MISSING_LEVELS");
  });

  it("skips invalid BUY geometry", async () => {
    const out = await bridgeChartsReasoningToPrediction({
      record: baseRecord({
        result: baseResult({
          tradePlan: {
            stopLoss: 1.2,
            takeProfitTargets: [1.16],
            invalidationPrice: 1.075,
          },
        }),
      }),
      context: makeContext(),
      storage: store,
    });
    expect(out.status).toBe("SKIPPED");
    expect(out.reason).toBe("INVALID_LEVELS");
  });

  it("is idempotent on duplicate bridge for the same analysis", async () => {
    const record = baseRecord();
    const ctx = makeContext();
    const pkg = makeScenarioPackage();
    const first = await bridgeChartsReasoningToPrediction({
      record,
      context: ctx,
      scenarioPackage: pkg,
      storage: store,
      bridgedAt: "2024-01-01T00:02:00.000Z",
    });
    expect(first.status).toBe("CREATED");
    const second = await bridgeChartsReasoningToPrediction({
      record,
      context: ctx,
      scenarioPackage: pkg,
      storage: store,
      bridgedAt: "2024-01-01T00:99:00.000Z",
    });
    expect(second.status).toBe("REUSED");
    expect(second.predictionId).toBe(first.predictionId);
    expect(second.created).toBe(false);
    expect(second.snapshot?.snapshotHash).toBe(first.snapshot?.snapshotHash);

    const files = fs.readdirSync(store.snapshotsDir()).filter((f) => f.endsWith(".json"));
    expect(files.length).toBe(1);

    // Deterministic identity matches computePredictionId material.
    const expectedId = computePredictionId({
      candidateId: "scen-bull-1",
      reasoningRunId: null,
      analysisRunId: "analysis-1",
      evaluationId: null,
      activationOpenTimeSec: T0,
      instrument: "EURUSD",
      timeframe: "H1",
      direction: "BUY",
      snapshotPolicyVersion: "1.0.0",
    });
    expect(first.predictionId).toBe(expectedId);
  });

  it("survives persistence recovery after first write (read-back reuse)", async () => {
    const record = baseRecord();
    const first = await bridgeChartsReasoningToPrediction({
      record,
      context: makeContext(),
      scenarioPackage: makeScenarioPackage(),
      storage: store,
    });
    // Simulate process restart with a new storage instance on same root.
    const store2 = new MifPredictionOutcomeStorage(root);
    const second = await bridgeChartsReasoningToPrediction({
      record,
      context: makeContext(),
      scenarioPackage: makeScenarioPackage(),
      storage: store2,
    });
    expect(second.status).toBe("REUSED");
    expect(second.predictionId).toBe(first.predictionId);
  });

  it("preserves Analyze Now / Auto Analysis shared bridge contract fields", async () => {
    // Both Analyze Now and Auto Analysis call runHfmAiReasoning → same bridge.
    // Verify linkage shape is stable for either trigger path.
    const record = baseRecord({ analysisId: "analysis-auto-1" });
    const out = await bridgeChartsReasoningToPrediction({
      record: { ...record, analysisId: "analysis-auto-1", result: baseResult({ analysisId: "analysis-auto-1" }) },
      context: makeContext(),
      scenarioPackage: makeScenarioPackage(),
      storage: store,
    });
    expect(out.linkage.bridgeId).toBe("hfm-charts-prediction-bridge");
    expect(out.linkage.placesOrders).toBe(false);
    expect(out.linkage.mutatesBroker).toBe(false);
    expect(out.linkage.acceptsForExecution).toBe(false);
    expect(out.snapshot?.strategyId).toBe("hfm-charts-analyze");
  });

  it("remains compatible with existing MIF prediction snapshots", async () => {
    // Pre-seed a classic MIF snapshot (non-Charts) and ensure bridge does not overwrite it.
    const legacy = buildPredictionSnapshot({
      candidateId: "legacy-cand-1",
      analysisRunId: "mif-run-1",
      activationOpenTimeSec: T0,
      instrument: "EURUSD",
      timeframe: "H1",
      direction: "BUY",
      entryPrice: 1.1,
      targetPrice: 1.2,
      invalidationPrice: 1.05,
      createdAt: "2023-01-01T00:00:00.000Z",
    });
    const persisted = await store.persistSnapshot(legacy);
    expect(persisted.ok).toBe(true);

    const charts = await bridgeChartsReasoningToPrediction({
      record: baseRecord(),
      context: makeContext(),
      scenarioPackage: makeScenarioPackage(),
      storage: store,
    });
    expect(charts.status).toBe("CREATED");
    expect(charts.predictionId).not.toBe(legacy.predictionId);

    const still = await store.getSnapshot(legacy.predictionId);
    expect(still?.snapshotHash).toBe(legacy.snapshotHash);

    const files = fs.readdirSync(store.snapshotsDir()).filter((f) => f.endsWith(".json"));
    expect(files.length).toBe(2);
  });

  it("skips when activation candle cannot be resolved", async () => {
    const ctx = makeContext();
    ctx.snapshot!.timeframes = {};
    const out = await bridgeChartsReasoningToPrediction({
      record: baseRecord(),
      context: ctx,
      storage: store,
    });
    expect(out.status).toBe("SKIPPED");
    expect(out.reason).toBe("MISSING_ACTIVATION");
  });

  it("reports FAILED on persistence exception without dropping analysis decision", async () => {
    const record = baseRecord();
    const exploding = {
      persistSnapshot: async () => {
        throw new Error("disk full");
      },
      getSnapshot: async () => null,
    } as unknown as MifPredictionOutcomeStorage;
    const out = await bridgeChartsReasoningToPrediction({
      record,
      context: makeContext(),
      scenarioPackage: makeScenarioPackage(),
      storage: exploding,
    });
    expect(out.status).toBe("FAILED");
    expect(String(out.reason)).toMatch(/PERSIST_FAILED/);
    const linked = applyPredictionLinkage(record, out);
    expect(linked.result?.decision.action).toBe("BUY");
    expect(linked.status).toBe("COMPLETED");
    expect(linked.predictionLinkage?.status).toBe("FAILED");
  });

  it("Analyze Now and Auto Analysis share the same bridge entrypoint", async () => {
    // Both triggers funnel through runHfmAiReasoning → bridgeChartsReasoningToPrediction.
    // Simulate one manual and one auto completed record with distinct analysisIds.
    const manual = await bridgeChartsReasoningToPrediction({
      record: baseRecord({ analysisId: "analysis-manual" }),
      context: makeContext(),
      scenarioPackage: makeScenarioPackage(),
      storage: store,
    });
    const auto = await bridgeChartsReasoningToPrediction({
      record: baseRecord({
        analysisId: "analysis-auto",
        result: baseResult({ analysisId: "analysis-auto" }),
      }),
      context: makeContext(),
      scenarioPackage: makeScenarioPackage(),
      storage: store,
    });
    expect(manual.status).toBe("CREATED");
    expect(auto.status).toBe("CREATED");
    expect(manual.predictionId).not.toBe(auto.predictionId);
    expect(manual.linkage.bridgeId).toBe(auto.linkage.bridgeId);
    expect(manual.snapshot?.strategyId).toBe("hfm-charts-analyze");
    expect(auto.snapshot?.strategyId).toBe("hfm-charts-analyze");
  });
});
