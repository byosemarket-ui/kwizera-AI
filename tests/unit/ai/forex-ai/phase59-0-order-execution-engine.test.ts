/**
 * Phase 59.0 — Order Execution Engine unit + mock integration tests.
 * No broker mutation. Disabled adapter remains the AT default.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  mapProposedQuantityToLots,
  prepareDemoExecutionPlan,
  validateDecisionForExecution,
  AT_ORDER_EXECUTION_PHASE,
  AT_EXECUTION_STATE_MAP,
} from "../../../../ai/forex-ai/automated-trading/order-execution/index.ts";
import type { AtDecisionResult } from "../../../../ai/forex-ai/automated-trading/decision/types.ts";
import type { AtSimDraftResult } from "../../../../ai/forex-ai/automated-trading/simulation-risk/types.ts";
import { getDisabledBrokerMutationAdapter } from "../../../../ai/forex-ai/automated-trading/broker-intent/mutation-stub.ts";
import { evaluateDemoLifecyclePreflight } from "../../../../ai/forex-ai/automated-trading/demo-execution/preflight.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

function baseDecision(over: Partial<AtDecisionResult> = {}): AtDecisionResult {
  return {
    schemaVersion: "at-trading-decision-v1",
    phase: "54",
    decisionId: "dec-59-buy-1",
    decisionStatus: "ACCEPTED_FOR_REVIEW",
    direction: "BUY",
    instrument: "XAU/USD",
    timeframe: "1h",
    forecastHorizon: "1h",
    sourceAnalysisId: "an-59-1",
    sourceEvidenceFingerprint: "fp-1",
    sourceCreatedAtUtc: new Date().toISOString(),
    environment: "DEMO",
    environmentEpoch: 1,
    monitorConfigEpoch: 1,
    directionalConfidencePct: 72,
    directionalConfidenceNote: "Estimated directional confidence — NOT CALIBRATED",
    confidenceLabel: "NOT CALIBRATED",
    confidenceIsCalibratedWinProbability: false,
    decidedAtUtc: new Date().toISOString(),
    checks: [],
    blockers: [],
    rejectionReasons: [],
    freshness: {
      quoteFresh: true,
      feedStatus: "LIVE",
      verificationIdentityStatus: "OK",
      analysisAgeMs: 1000,
      historicalOnly: false,
    },
    verification: {
      present: true,
      environmentMatches: true,
      accountIdentityVerified: true,
      marketDataHealthVerified: true,
      readyForTrading: false,
    },
    chartImage: {
      applicable: false,
      available: null,
      includedInOpenAiRequest: null,
      imageHash: null,
      fingerprintMatch: null,
    },
    policySnapshot: {
      confidenceThresholdEnabled: false,
      minDirectionalConfidencePct: null,
      maxAnalysisAgeMs: null,
    },
    placesOrders: false,
    acceptsForExecution: false,
    ...over,
  };
}

function baseDraft(over: Partial<AtSimDraftResult> = {}): AtSimDraftResult {
  return {
    schemaVersion: "at-simulation-risk-draft-v1",
    phase: "56.4.2",
    draftId: "draft-59-1",
    createdAtUtc: new Date().toISOString(),
    validatedAtUtc: new Date().toISOString(),
    overallStatus: "VALIDATION_PASSED",
    environment: "DEMO",
    instrument: "XAU/USD",
    direction: "BUY",
    entryPrice: 2650,
    stopLoss: 2640,
    takeProfit: 2680,
    proposedQuantity: 2.4,
    proposedQuantityNote: "test",
    structuralOk: true,
    instrumentStatus: "PASS",
    quoteFreshnessStatus: "PASS",
    slTpStatus: "PASS",
    accountStatus: "PASS",
    quantityContractStatus: "PASS",
    riskBudgetStatus: "PASS",
    marginStatus: "PASS",
    checks: [],
    reasons: [],
    explanations: [],
    sourceDecisionId: "dec-59-buy-1",
    sourceAnalysisId: "an-59-1",
    sourceEvidenceFingerprint: "fp-1",
    riskPolicyVersion: "sim-risk-policy-v1",
    riskPolicyMode: "SIMULATION_ONLY",
    riskPercentConfigured: false,
    allocationAnalysis: {
      allocationPercentage: 15,
      allocationBudget: 1500,
      equityUsed: 10000,
      isStopLossRisk: false,
      inApprovedRange: true,
      forcedByWeakEvidence: false,
      status: "PASS",
      note: "ok",
    },
    rewardRiskAnalysis: {
      estimatedStopLossRisk: 20,
      targetReward3R: 60,
      theoreticalTakeProfit3R: 2680,
      riskRewardRatio: 3,
      estimatedGrossTarget: 60,
      estimatedNetTarget: null,
      estimatedNetTargetStatus: "NOT_VERIFIED",
      estimatedRequiredMargin: null,
      estimatedRequiredMarginStatus: "NOT_VERIFIED",
      status: "PASS",
      note: "ok",
    },
    capitalBudgetAnalysis: {
      capitalAllocationPercent: 20,
      capitalAllocationBudget: 2000,
      reservedActive: 0,
      remainingBudget: 2000,
      perOrderAllocation: 500,
      perOrderLossLimit: 125,
      perOrderLossLimitPass: true,
      status: "PASS",
      note: "ok",
    },
    profitProtection: null,
    eligibilityStatus: "SIMULATION_ANALYSIS_ONLY",
    banner: "SIMULATION-ONLY DRAFT VALIDATION — PHASE 56.4.2 — EXECUTION FORBIDDEN",
    simulationOnly: true,
    placesOrders: false,
    acceptsForExecution: false,
    ...over,
  };
}

describe("Phase 59.0 decision validation", () => {
  it("rejects WAIT / missing direction and REJECTED decisions", () => {
    const wait = validateDecisionForExecution({
      decision: baseDecision({ direction: null }),
    });
    expect(wait.ok).toBe(false);
    expect(wait.rejections.some((r) => r.code === "WAIT_OR_NO_TRADE")).toBe(true);

    const rejected = validateDecisionForExecution({
      decision: baseDecision({ decisionStatus: "REJECTED" }),
    });
    expect(rejected.ok).toBe(false);
    expect(rejected.rejections.some((r) => r.code === "DECISION_NOT_ACCEPTED")).toBe(true);
  });

  it("rejects stale decisions and instrument mismatch", () => {
    const stale = validateDecisionForExecution({
      decision: baseDecision({
        decidedAtUtc: new Date(Date.now() - 60_000).toISOString(),
      }),
      maxDecisionAgeMs: 10_000,
      nowMs: Date.now(),
    });
    expect(stale.ok).toBe(false);
    expect(stale.rejections.some((r) => r.code === "DECISION_STALE")).toBe(true);

    const mismatch = validateDecisionForExecution({
      decision: baseDecision({ instrument: "EUR/USD" }),
      expectedInstrument: "XAU/USD",
    });
    expect(mismatch.ok).toBe(false);
    expect(mismatch.rejections.some((r) => r.code === "DECISION_INSTRUMENT_MISMATCH")).toBe(true);
  });

  it("does not invent direction from confidence alone", () => {
    const r = validateDecisionForExecution({
      decision: baseDecision({
        direction: null,
        directionalConfidencePct: 99,
      }),
    });
    expect(r.ok).toBe(false);
    expect(r.direction).toBeNull();
  });
});

describe("Phase 59.0 lots mapping", () => {
  it("floors proposed quantity and clamps down to grant", () => {
    const ok = mapProposedQuantityToLots({ proposedQuantity: 2.9, grantMaxLots: 5 });
    expect(ok.ok).toBe(true);
    expect(ok.lots).toBe(2);

    const clamped = mapProposedQuantityToLots({ proposedQuantity: 8, grantMaxLots: 3 });
    expect(clamped.ok).toBe(true);
    expect(clamped.lots).toBe(3);
    expect(clamped.clampedToGrant).toBe(true);
  });

  it("refuses to upsize below-minimum quantity or override above risk", () => {
    const below = mapProposedQuantityToLots({ proposedQuantity: 0.4, grantMaxLots: 5 });
    expect(below.ok).toBe(false);
    expect(below.rejections[0]?.code).toBe("LOTS_BELOW_MINIMUM");

    const over = mapProposedQuantityToLots({
      proposedQuantity: 2,
      grantMaxLots: 5,
      lotsOverride: 3,
    });
    expect(over.ok).toBe(false);
    expect(over.rejections[0]?.code).toBe("LOTS_OVERRIDE_EXCEEDS_RISK");
  });
});

describe("Phase 59.0 prepareDemoExecutionPlan", () => {
  it("builds BUY/SELL demo requests with SL/TP and decision-scoped idempotency", () => {
    const buy = prepareDemoExecutionPlan({
      decision: baseDecision(),
      draft: baseDraft(),
      grantId: "grant-1",
      grantActive: true,
      grantMaxLots: 5,
      grantInstrumentAllowlist: ["XAU/USD"],
      environment: "DEMO",
    });
    expect(buy.status).toBe("READY_FOR_DEMO_GRANT_SUBMISSION");
    expect(buy.phase).toBe(AT_ORDER_EXECUTION_PHASE);
    expect(buy.demoRequest?.direction).toBe("BUY");
    expect(buy.demoRequest?.lots).toBe(2);
    expect(buy.demoRequest?.stopLoss).toBe(2640);
    expect(buy.demoRequest?.takeProfit).toBe(2680);
    expect(buy.demoRequest?.requireProtective).toBe(true);
    expect(buy.demoRequest?.idempotencyKey).toBe("at59_dec-59-buy-1_draft-59-1");
    expect(buy.demoRequest?.sourceDecisionId).toBe("dec-59-buy-1");
    expect(buy.maySubmitDemoMutation).toBe(false);
    expect(buy.placesOrders).toBe(false);
    expect(buy.acceptsForExecution).toBe(false);
    expect(buy.mutatesBroker).toBe(false);

    const sell = prepareDemoExecutionPlan({
      decision: baseDecision({
        decisionId: "dec-59-sell-1",
        direction: "SELL",
      }),
      draft: baseDraft({
        draftId: "draft-59-sell",
        direction: "SELL",
        sourceDecisionId: "dec-59-sell-1",
        entryPrice: 2650,
        stopLoss: 2660,
        takeProfit: 2620,
        proposedQuantity: 1,
      }),
      grantId: "grant-1",
      grantActive: true,
      grantMaxLots: 5,
      grantInstrumentAllowlist: ["XAU/USD"],
      environment: "DEMO",
    });
    expect(sell.status).toBe("READY_FOR_DEMO_GRANT_SUBMISSION");
    expect(sell.demoRequest?.direction).toBe("SELL");
    expect(sell.demoRequest?.lots).toBe(1);
  });

  it("rejects LIVE, invalid SL/TP geometry, missing draft, and WAIT", () => {
    const live = prepareDemoExecutionPlan({
      decision: baseDecision(),
      draft: baseDraft(),
      grantId: "grant-1",
      grantActive: true,
      grantMaxLots: 5,
      grantInstrumentAllowlist: ["XAU/USD"],
      environment: "LIVE",
    });
    expect(live.status).toBe("REJECTED");
    expect(live.demoRequest).toBeNull();
    expect(live.rejections.some((r) => r.code === "LIVE_LOCKED")).toBe(true);

    const badGeom = prepareDemoExecutionPlan({
      decision: baseDecision(),
      draft: baseDraft({ stopLoss: 2700, takeProfit: 2680 }),
      grantId: "grant-1",
      grantActive: true,
      grantMaxLots: 5,
      grantInstrumentAllowlist: ["XAU/USD"],
      environment: "DEMO",
    });
    expect(badGeom.status).toBe("REJECTED");
    expect(badGeom.demoRequest).toBeNull();
    expect(badGeom.rejections.some((r) => r.code.includes("STOP_LOSS") || r.code.includes("GEOMETRY"))).toBe(true);

    const noDraft = prepareDemoExecutionPlan({
      decision: baseDecision(),
      draft: null,
      grantId: "grant-1",
      grantActive: true,
      grantMaxLots: 5,
      grantInstrumentAllowlist: ["XAU/USD"],
      environment: "DEMO",
    });
    expect(noDraft.status).toBe("BLOCKED");
    expect(noDraft.rejections.some((r) => r.code === "DRAFT_MISSING")).toBe(true);

    const wait = prepareDemoExecutionPlan({
      decision: baseDecision({ direction: null }),
      draft: baseDraft({ direction: null, sourceDecisionId: "dec-59-buy-1" }),
      grantId: "grant-1",
      grantActive: true,
      grantMaxLots: 5,
      grantInstrumentAllowlist: ["XAU/USD"],
      environment: "DEMO",
    });
    expect(wait.demoRequest).toBeNull();
    expect(wait.rejections.some((r) => r.code === "WAIT_OR_NO_TRADE")).toBe(true);
  });

  it("rejects unvalidated drafts and inactive grants without building a request", () => {
    const draftFail = prepareDemoExecutionPlan({
      decision: baseDecision(),
      draft: baseDraft({ overallStatus: "REJECTED_LOCAL" }),
      grantId: "grant-1",
      grantActive: true,
      grantMaxLots: 5,
      grantInstrumentAllowlist: ["XAU/USD"],
      environment: "DEMO",
    });
    expect(draftFail.demoRequest).toBeNull();
    expect(draftFail.rejections.some((r) => r.code === "DRAFT_NOT_VALIDATED")).toBe(true);

    const noGrant = prepareDemoExecutionPlan({
      decision: baseDecision(),
      draft: baseDraft(),
      grantId: "grant-1",
      grantActive: false,
      grantMaxLots: 5,
      grantInstrumentAllowlist: ["XAU/USD"],
      environment: "DEMO",
    });
    expect(noGrant.demoRequest).toBeNull();
    expect(noGrant.rejections.some((r) => r.code === "NO_ACTIVE_DEMO_GRANT")).toBe(true);
  });
});

describe("Phase 59.0 mock integration path", () => {
  it("invalid plan never implies broker adapter call; disabled AT adapter still forbids", () => {
    const plan = prepareDemoExecutionPlan({
      decision: baseDecision({ direction: null }),
      draft: baseDraft({ direction: null }),
      grantId: "grant-1",
      grantActive: true,
      grantMaxLots: 5,
      grantInstrumentAllowlist: ["XAU/USD"],
      environment: "DEMO",
    });
    expect(plan.demoRequest).toBeNull();

    let brokerCalls = 0;
    if (plan.demoRequest) {
      brokerCalls += 1;
    }
    expect(brokerCalls).toBe(0);

    const disabled = getDisabledBrokerMutationAdapter();
    const denied = disabled.submit({});
    expect(denied.ok).toBe(false);
    expect(denied.code).toBe("EXECUTION_FORBIDDEN");
    expect(disabled.placesOrders).toBe(false);
  });

  it("ready plan still fails DEMO preflight without quote/session — no fill/protected claim", () => {
    const plan = prepareDemoExecutionPlan({
      decision: baseDecision(),
      draft: baseDraft(),
      grantId: "grant-1",
      grantActive: true,
      grantMaxLots: 5,
      grantInstrumentAllowlist: ["XAU/USD"],
      environment: "DEMO",
    });
    expect(plan.status).toBe("READY_FOR_DEMO_GRANT_SUBMISSION");
    expect(plan.demoRequest).not.toBeNull();

    const preflight = evaluateDemoLifecyclePreflight({
      instrument: plan.demoRequest!.instrument,
      direction: plan.demoRequest!.direction,
      lots: plan.demoRequest!.lots,
      maxLots: 5,
      environment: "demo",
      sessionConnected: false,
      quotePresent: false,
      quoteBid: null,
      quoteAsk: null,
      requireProtective: true,
      stopLoss: plan.demoRequest!.stopLoss ?? null,
      takeProfit: plan.demoRequest!.takeProfit ?? null,
      entryHint: plan.demoRequest!.entryHint ?? null,
      grantActive: true,
    });
    expect(preflight.ok).toBe(false);
    expect(preflight.maySubmitDemoMutation).toBe(false);
    expect(preflight.placesOrdersGlobal).toBe(false);
    // A successful prepare alone must not mark FILLED/PROTECTED.
    expect(plan.status).not.toBe("FILLED" as never);
  });

  it("documents state map and wires prepare-from-draft API path", () => {
    expect(AT_EXECUTION_STATE_MAP.UNKNOWN_REQUIRES_RECONCILIATION).toMatch(/RECONCILIATION/);
    const api = read("dev/server/forex-automated-trading-api.ts");
    expect(api).toContain("demo-lifecycle/prepare-from-draft");
    expect(api).toContain("prepareDemoExecutionPlan");
    expect(api).toContain("sourceDecisionId");
    const orch = read("ai/forex-ai/automated-trading/demo-execution/orchestrator.ts");
    expect(orch).toContain("sourceDecisionId");
    expect(orch).toContain('phase: "59.0"');
  });
});
