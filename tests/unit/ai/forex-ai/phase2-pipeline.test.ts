/**
 * Phase 2 — System Master generation gate, directional bias vs eligibility,
 * and analysis→intake→proposal→handoff→precheck orchestration (no broker mutation).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  reconcileAnalysis,
  indicatorsFromStrategyValues,
} from "../../../../ai/forex-ai/automated-trading/analysis/reconciler.ts";
import { SMA_CROSSOVER_RULES } from "../../../../ai/forex-ai/automated-trading/auto-engine/strategy/rules.ts";
import { validateCanonicalForIntake } from "../../../../ai/forex-ai/automated-trading/result-intake/validate.ts";
import {
  getAtSystemMasterStore,
  resetAtSystemMasterStoreForTests,
} from "../../../../ai/forex-ai/automated-trading/system-master/index.ts";
import {
  getAtPhase2PipelineStore,
  resetAtPhase2PipelineStoreForTests,
  runPhase2Downstream,
} from "../../../../ai/forex-ai/automated-trading/phase2-pipeline.ts";
import type { AtResultIntakeRecord } from "../../../../ai/forex-ai/automated-trading/result-intake/types.ts";
import { ANALYSIS_CONFIDENCE_TYPE } from "../../../../ai/forex-ai/automated-trading/analysis/canonical-analysis.types.ts";

function tmpRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-phase2-"));
}

function baseIntake(over: Partial<AtResultIntakeRecord> = {}): AtResultIntakeRecord {
  return {
    schemaVersion: "at-analysis-result-intake-v1",
    phase: "4.18G.1",
    resultId: "intake-1",
    idempotencyKey: "k1",
    analysisId: "analysis-1",
    observationId: null,
    imageId: null,
    imageHash: null,
    instrument: "XAU/USD",
    provider: "FOREXCONNECT",
    environment: "DEMO",
    modelIdentifier: null,
    primaryTimeframe: "15m",
    timeframeCoverage: ["15m"],
    analyzedAtUtc: new Date().toISOString(),
    receivedAtUtc: new Date().toISOString(),
    decision: "BUY",
    canonicalOutcome: "BUY_CANDIDATE",
    aiDirection: "BUY",
    strategyDirection: "BUY",
    canonicalDecision: "BUY",
    reconciliationStatus: "RECON_DET_BUY",
    validationStatus: "VALID",
    intakeLifecycle: "ACCEPTED",
    directionalConfidencePct: 70,
    confidenceType: ANALYSIS_CONFIDENCE_TYPE,
    isCalibratedWinProbability: false,
    confidenceBreakdown: null,
    confidenceLimitations: [],
    analysisReasons: [],
    supportingEvidence: [],
    conflictingEvidence: [],
    marketTrend: null,
    marketMomentum: null,
    volatility: null,
    mtfAlignment: null,
    marketStructure: null,
    invalidationConditions: [],
    sourceProvenance: [],
    imageSource: null,
    imageDeliveryStatus: null,
    includedImageBytesInRequest: null,
    observationCorrelated: null,
    imageHashVerified: null,
    noTradeReason: null,
    rejectionReason: null,
    supersededByResultId: null,
    supersedesResultId: null,
    expiresAtUtc: new Date(Date.now() + 600_000).toISOString(),
    eligibleForOrderPreparation: true,
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    ...over,
  } as AtResultIntakeRecord;
}

describe("Phase 2 directional bias vs trade eligibility", () => {
  it("stale quote with BUY evidence keeps direction BUY and BLOCKED eligibility", () => {
    const r = reconcileAnalysis({
      environment: "DEMO",
      instrument: "XAU/USD",
      primaryTimeframe: "15m",
      analyzedAtUtc: "2026-11-01T12:00:00.000Z",
      quote: {
        instrument: "XAU/USD",
        bid: 2650,
        ask: 2650.5,
        quoteFresh: false,
        freshnessReasonCode: "QUOTE_AGE_EXCEEDED",
        effectivePriceChangeAgeMs: 120_000,
        snapshotFingerprint: "fp",
        evaluatedAtUtc: "2026-11-01T12:00:00.000Z",
      },
      candleStrategyReady: true,
      indicators: indicatorsFromStrategyValues({ fastSma: 2651, slowSma: 2648, atr: 2 }),
      deterministic: {
        strategyId: SMA_CROSSOVER_RULES.strategyId,
        direction: "BUY",
        code: "BUY_SMA_CROSS",
        reasons: ["test"],
        entryPrice: 2650,
        stopLoss: 2640,
        takeProfit: 2670,
        confidencePct: 55,
        closedCandle: {
          instrument: "XAU/USD",
          timeframe: "15m",
          openTimeSec: 1_700_000_000,
          closeTimeSec: 1_700_000_900,
          ohlcFingerprint: "abc",
          closed: true,
        },
        atrMethod: "SMA_OF_TR",
      },
      ai: {
        analysisId: "ai-1",
        schemaVersion: "at-openai-ta-v1",
        lifecycle: "ANALYSIS_VALID",
        direction: "BUY",
        directionalBias: "BULLISH",
        trendState: "UPTREND",
        trendStrength: "MODERATE",
        mtfAgreement: "AGREE_BULLISH",
        supportLevels: [],
        resistanceLevels: [],
        explanation: "ai",
        directionalConfidencePct: 71,
        placesOrders: false,
      },
    });
    expect(r.finalOutcome).toBe("STALE_DATA");
    expect(r.direction).toBe("BUY");
    expect(r.tradeEligibility).toBe("BLOCKED");
    expect(r.blockReasons).toContain("QUOTE_STALE");
    expect(r.calibratedWinProbability).toBeNull();

    const gate = validateCanonicalForIntake(r, null, {
      nowMs: Date.parse("2026-11-01T12:05:00.000Z"),
    });
    expect(gate.ok).toBe(true);
    expect(gate.validationStatus).toBe("VALID");
  });

  it("NO_CROSSOVER with AI SELL preserves directional bias and blocks trade", () => {
    const r = reconcileAnalysis({
      environment: "DEMO",
      instrument: "XAU/USD",
      primaryTimeframe: "15m",
      analyzedAtUtc: "2026-11-01T12:00:00.000Z",
      quote: {
        instrument: "XAU/USD",
        bid: 2650,
        ask: 2650.5,
        quoteFresh: true,
        freshnessReasonCode: "LIVE_FRESH",
        effectivePriceChangeAgeMs: 500,
        snapshotFingerprint: "fp",
        evaluatedAtUtc: "2026-11-01T12:00:00.000Z",
      },
      candleStrategyReady: true,
      indicators: indicatorsFromStrategyValues({ fastSma: 2651, slowSma: 2648, atr: 2 }),
      deterministic: {
        strategyId: SMA_CROSSOVER_RULES.strategyId,
        direction: "NO_TRADE",
        code: "NO_CROSSOVER",
        reasons: ["no cross"],
        entryPrice: null,
        stopLoss: null,
        takeProfit: null,
        confidencePct: null,
        closedCandle: {
          instrument: "XAU/USD",
          timeframe: "15m",
          openTimeSec: 1_700_000_000,
          closeTimeSec: 1_700_000_900,
          ohlcFingerprint: "abc",
          closed: true,
        },
        atrMethod: "SMA_OF_TR",
      },
      ai: {
        analysisId: "ai-2",
        schemaVersion: "at-openai-ta-v1",
        lifecycle: "ANALYSIS_VALID",
        direction: "SELL",
        directionalBias: "BEARISH",
        trendState: "DOWNTREND",
        trendStrength: "MODERATE",
        mtfAgreement: "AGREE_BEARISH",
        supportLevels: [],
        resistanceLevels: [],
        explanation: "ai sell",
        directionalConfidencePct: 66,
        placesOrders: false,
      },
    });
    expect(r.finalOutcome).toBe("NO_TRADE");
    expect(r.direction).toBe("SELL");
    expect(r.tradeEligibility).toBe("BLOCKED");
    expect(r.blockReasons).toContain("NO_DETERMINISTIC_CROSS");
  });
});

describe("Phase 2 downstream pipeline", () => {
  let root: string;

  beforeEach(() => {
    root = tmpRoot();
    process.env.KWIZERA_STORAGE_ROOT = root;
    resetAtSystemMasterStoreForTests();
    resetAtPhase2PipelineStoreForTests();
  });

  afterEach(() => {
    resetAtSystemMasterStoreForTests();
    resetAtPhase2PipelineStoreForTests();
    try {
      fs.rmSync(root, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it("aborts when System Master is OFF", async () => {
    const master = getAtSystemMasterStore(root);
    expect(master.get().ownerState).toBe("OFF");
    const store = getAtPhase2PipelineStore(root);
    const out = await runPhase2Downstream({
      record: baseIntake(),
      analysisGeneration: master.getAnalysisGeneration(),
      store,
      service: {
        generateProposal: vi.fn(async () => ({ ok: true, proposal: { proposalId: "p1" } })),
        validateHandoff: vi.fn(async () => ({ ok: true, handoff: { handoffId: "h1" } })),
        runBrokerPrecheck: vi.fn(async () => ({ ok: true, validation: { outcome: "PASS" } })),
      },
    });
    expect(out.status).toBe("ABORTED_SYSTEM_OFF");
    expect(out.blockers).toContain("SYSTEM_MASTER_OFF");
  });

  it("blocks proposal when individualOrderAllocation is missing", async () => {
    const master = getAtSystemMasterStore(root);
    await master.forceSet((prev) => ({
      ...prev,
      ownerState: "ON",
      masterEnabled: true,
      operationalState: "ON",
    }));
    const store = getAtPhase2PipelineStore(root);
    const generateProposal = vi.fn(async () => ({ ok: true, proposal: { proposalId: "p1" } }));
    const out = await runPhase2Downstream({
      record: baseIntake(),
      analysisGeneration: master.getAnalysisGeneration(),
      store,
      service: {
        generateProposal,
        validateHandoff: vi.fn(async () => ({ ok: true })),
        runBrokerPrecheck: vi.fn(async () => ({ ok: true })),
        getProposalAllocationConfig: async () => ({ individualOrderAllocation: null }),
      },
    });
    expect(out.status).toBe("ALLOCATION_BLOCKED");
    expect(out.blockers).toContain("PER_ORDER_ALLOCATION_MISSING");
    expect(generateProposal).not.toHaveBeenCalled();
  });

  it("runs proposal → handoff → precheck without broker mutation", async () => {
    const master = getAtSystemMasterStore(root);
    await master.forceSet((prev) => ({
      ...prev,
      ownerState: "ON",
      masterEnabled: true,
      operationalState: "ON",
    }));
    const store = getAtPhase2PipelineStore(root);
    const generateProposal = vi.fn(async () => ({
      ok: true,
      proposal: { proposalId: "prop-1", lifecycle: "PROPOSAL_READY", blockers: [] },
      perOrderRisk: { decisionId: "risk-1" },
    }));
    const validateHandoff = vi.fn(async () => ({
      ok: true,
      handoff: { handoffId: "hand-1", lifecycle: "HANDOFF_READY", blockers: [] },
    }));
    const runBrokerPrecheck = vi.fn(async () => ({
      ok: true,
      placesOrders: false,
      mutatesBroker: false,
      executionAuthorized: false,
      validation: { id: "pre-1", outcome: "PASS", blockers: [] },
    }));
    const submitOrder = vi.fn();
    const out = await runPhase2Downstream({
      record: baseIntake(),
      analysisGeneration: master.getAnalysisGeneration(),
      store,
      service: {
        generateProposal,
        validateHandoff,
        runBrokerPrecheck,
        getProposalAllocationConfig: async () => ({ individualOrderAllocation: 40 }),
      },
    });
    expect(out.status).toBe("PRECHECK_PASSED");
    expect(out.analysisId).toBe("analysis-1");
    expect(out.intakeId).toBe("intake-1");
    expect(out.proposalId).toBe("prop-1");
    expect(out.riskDecisionId).toBe("risk-1");
    expect(out.handoffId).toBe("hand-1");
    expect(out.precheckId).toBe("pre-1");
    expect(out.placesOrders).toBe(false);
    expect(out.mutatesBroker).toBe(false);
    expect(generateProposal).toHaveBeenCalledOnce();
    expect(validateHandoff).toHaveBeenCalledOnce();
    expect(runBrokerPrecheck).toHaveBeenCalledOnce();
    expect(submitOrder).not.toHaveBeenCalled();
  });

  it("bumps analysisGeneration on System Master OFF", async () => {
    const master = getAtSystemMasterStore(root);
    await master.forceSet((prev) => ({
      ...prev,
      ownerState: "ON",
      masterEnabled: true,
      operationalState: "ON",
      analysisGeneration: 3,
    }));
    const before = master.getAnalysisGeneration();
    await master.forceSet((prev) => ({
      ...prev,
      ownerState: "OFF",
      masterEnabled: false,
      operationalState: "OFF",
    }));
    expect(master.getAnalysisGeneration()).toBe(before + 1);
  });
});
