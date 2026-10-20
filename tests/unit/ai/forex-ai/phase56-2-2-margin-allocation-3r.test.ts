/**
 * Phase 56.2.2 — Margin allocation (12–25%), independent 3R, profit-protection simulation.
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  ALLOCATION_PCT_MAX,
  ALLOCATION_PCT_MIN,
  compute3RTarget,
  computeAllocationBudget,
  defaultSimRiskPolicy,
  estimateStopLossRisk,
  evaluateProfitProtection,
  getAtSimRiskEngine,
  resetAtSimRiskEngineForTests,
  resetAtSimRiskStoreForTests,
  validateAllocationPercentage,
  validateSimulationDraft,
  wouldWidenStopLoss,
  type AtSimDraftInput,
  type AtSimRiskPolicy,
} from "../../../../ai/forex-ai/automated-trading/index.ts";

function basePolicy(over: Partial<AtSimRiskPolicy> = {}): AtSimRiskPolicy {
  return { ...defaultSimRiskPolicy(), ...over };
}

function baseInput(over: Partial<AtSimDraftInput> = {}): AtSimDraftInput {
  return {
    environment: "DEMO",
    environmentMeta: {
      requested: "DEMO",
      actualSession: "DEMO",
      matches: true,
      environmentEpoch: 1,
      identityVerified: true,
      liveExecutionAuthorized: false,
    },
    instrument: "XAU/USD",
    direction: "BUY",
    entryPrice: 4100,
    stopLoss: 4080,
    takeProfit: 4160,
    requestedQuantity: 1,
    allocationPercentage: 18,
    marketEvidenceStrength: "SUFFICIENT",
    profitProtection: null,
    quote: {
      bid: 4099.9,
      ask: 4100.1,
      entryPrice: 4100,
      entrySource: "test",
      fresh: true,
      freshnessReasonCode: "FRESH",
      quoteAgeMs: 50,
      observedAtUtc: new Date().toISOString(),
    },
    contract: {
      verified: true,
      pointSize: 0.01,
      tickSize: 0.01,
      digits: 2,
      quantityMin: 1,
      quantityStep: 1,
      quantityUnit: "lots",
      quantityUnitAmbiguous: false,
      contractMultiplier: 1,
      baseUnitSize: 1,
      pipCostAccount: 0.01,
      marginPerLotAccount: 100,
      minStopDistance: 0.5,
      minStopDistanceVerified: true,
      source: "test",
      unavailableReason: null,
    },
    account: {
      verified: true,
      accountIdMasked: "12••••34",
      accountCurrency: "USD",
      equity: 10_000,
      balance: 10_000,
      usableMargin: 8_000,
      usedMargin: 0,
      fetchedAtUtc: new Date().toISOString(),
      environment: "DEMO",
      unavailableReason: null,
    },
    sourceDecisionId: "dec-5622",
    sourceAnalysisId: "an-5622",
    sourceEvidenceFingerprint: "fp-5622",
    sourceDecidedAtUtc: new Date().toISOString(),
    policy: basePolicy({ riskBudgetMode: "UNDECIDED", riskPercent: null }),
    openPositionsCount: 0,
    pendingOrdersCount: 0,
    exposureDataAuthoritative: true,
    ...over,
  };
}

describe("Phase 56.2.2 allocation boundaries", () => {
  it("accepts 12% as in-range allocation input", () => {
    const v = validateAllocationPercentage(ALLOCATION_PCT_MIN);
    expect(v.ok).toBe(true);
    const r = validateSimulationDraft(baseInput({ allocationPercentage: 12 }));
    expect(r.allocationAnalysis.inApprovedRange).toBe(true);
    expect(r.allocationAnalysis.allocationBudget).toBe(1200);
    expect(r.allocationAnalysis.isStopLossRisk).toBe(false);
    expect(r.placesOrders).toBe(false);
    expect(r.acceptsForExecution).toBe(false);
  });

  it("accepts 25% as in-range allocation input", () => {
    const v = validateAllocationPercentage(ALLOCATION_PCT_MAX);
    expect(v.ok).toBe(true);
    const r = validateSimulationDraft(baseInput({ allocationPercentage: 25 }));
    expect(r.allocationAnalysis.allocationBudget).toBe(2500);
    expect(r.checks.some((c) => c.code === "ALLOCATION_PCT_IN_RANGE" && c.status === "PASS")).toBe(true);
  });

  it("rejects allocation below 12%", () => {
    const v = validateAllocationPercentage(11);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.code).toBe("ALLOCATION_PCT_BELOW_MIN");
    const r = validateSimulationDraft(baseInput({ allocationPercentage: 11 }));
    expect(r.overallStatus).toBe("REJECTED_LOCAL");
    expect(r.reasons.some((x) => x.code === "ALLOCATION_PCT_BELOW_MIN")).toBe(true);
  });

  it("rejects allocation above 25%", () => {
    const v = validateAllocationPercentage(26);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.code).toBe("ALLOCATION_PCT_ABOVE_MAX");
    const r = validateSimulationDraft(baseInput({ allocationPercentage: 30 }));
    expect(r.reasons.some((x) => x.code === "ALLOCATION_PCT_ABOVE_MAX")).toBe(true);
  });

  it("handles intermediate allocation 18% correctly", () => {
    const r = validateSimulationDraft(baseInput({ allocationPercentage: 18 }));
    expect(r.allocationAnalysis.allocationPercentage).toBe(18);
    expect(r.allocationAnalysis.allocationBudget).toBe(1800);
    expect(r.allocationAnalysis.isStopLossRisk).toBe(false);
  });

  it("computes allocation budget from equity and does not mislabel as SL risk", () => {
    const budget = computeAllocationBudget(10_000, 20);
    expect(budget.ok).toBe(true);
    if (budget.ok) {
      expect(budget.allocationBudget).toBe(2000);
      expect(budget.equityUsed).toBe(10_000);
    }
    const r = validateSimulationDraft(baseInput({ allocationPercentage: 20 }));
    expect(r.allocationAnalysis.allocationBudget).toBe(2000);
    expect(r.allocationAnalysis.isStopLossRisk).toBe(false);
    expect(r.rewardRiskAnalysis.estimatedStopLossRisk).not.toBe(2000);
  });

  it("blocks allocation budget when equity missing", () => {
    const budget = computeAllocationBudget(null, 18);
    expect(budget.ok).toBe(false);
    const r = validateSimulationDraft(
      baseInput({
        allocationPercentage: 18,
        account: {
          verified: true,
          accountIdMasked: "x",
          accountCurrency: "USD",
          equity: null,
          balance: 10_000,
          usableMargin: 8_000,
          usedMargin: 0,
          fetchedAtUtc: new Date().toISOString(),
          environment: "DEMO",
          unavailableReason: null,
        },
      }),
    );
    expect(r.allocationAnalysis.status).toBe("BLOCKED");
    expect(r.reasons.some((x) => x.code === "ALLOCATION_EQUITY_MISSING")).toBe(true);
  });

  it("blocks eligibility when estimated required margin exceeds usable margin", () => {
    const r = validateSimulationDraft(
      baseInput({
        requestedQuantity: 100,
        contract: {
          verified: true,
          pointSize: 0.01,
          tickSize: 0.01,
          digits: 2,
          quantityMin: 1,
          quantityStep: 1,
          quantityUnit: "lots",
          quantityUnitAmbiguous: false,
          contractMultiplier: 1,
          baseUnitSize: 1,
          pipCostAccount: 0.01,
          marginPerLotAccount: 100,
          minStopDistance: 0.5,
          minStopDistanceVerified: true,
          source: "test",
          unavailableReason: null,
        },
        account: {
          verified: true,
          accountIdMasked: "x",
          accountCurrency: "USD",
          equity: 10_000,
          balance: 10_000,
          usableMargin: 500,
          usedMargin: 0,
          fetchedAtUtc: new Date().toISOString(),
          environment: "DEMO",
          unavailableReason: null,
        },
      }),
    );
    expect(r.rewardRiskAnalysis.estimatedRequiredMargin).toBe(10_000);
    expect(r.reasons.some((x) => x.code === "INSUFFICIENT_AVAILABLE_MARGIN")).toBe(true);
    expect(r.acceptsForExecution).toBe(false);
  });
});

describe("Phase 56.2.2 geometry and missing SL/TP", () => {
  it("validates BUY SL/TP geometry", () => {
    const r = validateSimulationDraft(baseInput({ direction: "BUY", stopLoss: 4080, takeProfit: 4160 }));
    expect(r.checks.some((c) => c.code === "BUY_GEOMETRY" && c.status === "PASS")).toBe(true);
  });

  it("validates SELL SL/TP geometry", () => {
    const r = validateSimulationDraft(
      baseInput({ direction: "SELL", entryPrice: 4100, stopLoss: 4120, takeProfit: 4040 }),
    );
    expect(r.checks.some((c) => c.code === "SELL_GEOMETRY" && c.status === "PASS")).toBe(true);
  });

  it("blocks missing Stop Loss", () => {
    const r = validateSimulationDraft(baseInput({ stopLoss: null }));
    expect(r.reasons.some((x) => x.code === "SL_MISSING")).toBe(true);
  });

  it("blocks missing Take Profit", () => {
    const r = validateSimulationDraft(baseInput({ takeProfit: null }));
    expect(r.reasons.some((x) => x.code === "TP_MISSING")).toBe(true);
  });

  it("blocks invalid direction or malformed prices", () => {
    const badDir = validateSimulationDraft(baseInput({ direction: null }));
    expect(badDir.reasons.some((x) => x.code === "DIRECTION_MISSING")).toBe(true);
    const badEntry = validateSimulationDraft(baseInput({ entryPrice: -1 }));
    expect(badEntry.reasons.some((x) => x.code === "ENTRY_INVALID")).toBe(true);
  });
});

describe("Phase 56.2.2 independent R and 3R", () => {
  it("produces theoretical 3R target within price precision when risk is valid", () => {
    // pointSize 0.01, pipCost 0.01, qty 1, move 20 → R = (20/0.01)*0.01*1 = 20
    const risk = estimateStopLossRisk({
      entryPrice: 4100,
      stopLoss: 4080,
      quantity: 1,
      contract: baseInput().contract,
    });
    expect(risk.ok).toBe(true);
    if (!risk.ok) return;
    expect(risk.estimatedStopLossRisk).toBe(20);

    const three = compute3RTarget({
      direction: "BUY",
      entryPrice: 4100,
      stopLoss: 4080,
      takeProfit: 4160,
      estimatedStopLossRisk: risk.estimatedStopLossRisk,
      priceMove: risk.priceMove,
      digits: 2,
      costDataVerified: false,
      estimatedCostsAccount: null,
    });
    expect(three.ok).toBe(true);
    if (!three.ok) return;
    expect(three.targetReward3R).toBe(60);
    expect(three.theoreticalTakeProfit3R).toBe(4160);
    expect(three.estimatedNetTargetStatus).toBe("NOT_VERIFIED");

    const r = validateSimulationDraft(baseInput());
    expect(r.rewardRiskAnalysis.estimatedStopLossRisk).toBe(20);
    expect(r.rewardRiskAnalysis.targetReward3R).toBe(60);
    expect(r.rewardRiskAnalysis.theoreticalTakeProfit3R).toBe(4160);
    expect(r.rewardRiskAnalysis.riskRewardRatio).toBe(3);
  });

  it("does not fabricate 3R when monetary risk is unavailable", () => {
    const risk = estimateStopLossRisk({
      entryPrice: 4100,
      stopLoss: 4080,
      quantity: null,
      contract: baseInput().contract,
    });
    expect(risk.ok).toBe(false);
    const three = compute3RTarget({
      direction: "BUY",
      entryPrice: 4100,
      stopLoss: 4080,
      takeProfit: 4160,
      estimatedStopLossRisk: null,
      priceMove: 20,
      digits: 2,
      costDataVerified: false,
      estimatedCostsAccount: null,
    });
    expect(three.ok).toBe(false);
    if (!three.ok) expect(three.targetReward3R).toBeNull();

    const r = validateSimulationDraft(baseInput({ requestedQuantity: null }));
    expect(r.rewardRiskAnalysis.targetReward3R).toBeNull();
    expect(r.rewardRiskAnalysis.estimatedStopLossRisk).toBeNull();
  });

  it("blocks quantity/dependent calcs when XAU units ambiguous", () => {
    const r = validateSimulationDraft(
      baseInput({
        contract: {
          verified: true,
          pointSize: 0.01,
          tickSize: 0.01,
          digits: 2,
          quantityMin: 1,
          quantityStep: 1,
          quantityUnit: "unknown",
          quantityUnitAmbiguous: true,
          contractMultiplier: 1,
          baseUnitSize: 1,
          pipCostAccount: 0.01,
          marginPerLotAccount: 100,
          minStopDistance: 0.5,
          minStopDistanceVerified: true,
          source: "test",
          unavailableReason: "ounces unproven",
        },
      }),
    );
    expect(r.reasons.some((x) => x.code === "QUANTITY_UNIT_AMBIGUOUS")).toBe(true);
    expect(r.rewardRiskAnalysis.estimatedStopLossRisk).toBeNull();
    expect(r.proposedQuantity).toBeNull();
  });

  it("blocks when minimum-stop-distance evidence missing", () => {
    const r = validateSimulationDraft(
      baseInput({
        contract: {
          ...baseInput().contract!,
          minStopDistance: null,
          minStopDistanceVerified: false,
        },
      }),
    );
    expect(r.reasons.some((x) => x.code === "MIN_STOP_DISTANCE_UNVERIFIED")).toBe(true);
  });

  it("reflects missing cost data honestly in net-target reporting", () => {
    const r = validateSimulationDraft(baseInput());
    expect(r.rewardRiskAnalysis.estimatedNetTargetStatus).toBe("NOT_VERIFIED");
    expect(r.rewardRiskAnalysis.estimatedNetTarget).toBeNull();
  });
});

describe("Phase 56.2.2 evidence gate and profit protection", () => {
  it("does not force 12–25% allocation on weak/stale evidence", () => {
    const weak = validateSimulationDraft(
      baseInput({ marketEvidenceStrength: "WEAK", allocationPercentage: 18 }),
    );
    expect(weak.checks.some((c) => c.code === "ALLOCATION_NOT_FORCED_WEAK_EVIDENCE")).toBe(true);
    expect(weak.allocationAnalysis.allocationBudget).toBeNull();
    expect(weak.allocationAnalysis.forcedByWeakEvidence).toBe(false);

    const stale = validateSimulationDraft(
      baseInput({
        marketEvidenceStrength: "STALE",
        quote: { ...baseInput().quote, fresh: false, freshnessReasonCode: "STALE" },
      }),
    );
    expect(stale.checks.some((c) => c.code === "ALLOCATION_NOT_FORCED_WEAK_EVIDENCE")).toBe(true);
  });

  it("proposes simulation-only protective action when reversal conditions met", () => {
    const r = validateSimulationDraft(
      baseInput({
        profitProtection: {
          currentPrice: 4140,
          favorableMovePrice: 40,
          multiTimeframeReversalEvidence: true,
          evidenceContradictory: false,
          evidenceInsufficient: false,
          proposedMinFavorableR: 1,
          proposedTightenToBreakEven: true,
        },
      }),
    );
    expect(r.profitProtection?.state).toBe("PROTECTIVE_ACTION_PROPOSED_SIM");
    expect(r.profitProtection?.isBrokerExecution).toBe(false);
    expect(r.profitProtection?.placesOrders).toBe(false);
    expect(r.profitProtection?.proposedAction).toBe("TIGHTEN_SL_SIM");
    expect(r.profitProtection?.proposedStopLoss).toBe(4100);
    expect(r.profitProtection?.trailingThresholdOwnerApproved).toBe(false);
  });

  it("does not falsely claim reversal when evidence insufficient", () => {
    const pp = evaluateProfitProtection({
      direction: "BUY",
      originalStopLoss: 4080,
      entryPrice: 4100,
      currentPrice: 4140,
      favorableMovePrice: 40,
      stopDistancePrice: 20,
      multiTimeframeReversalEvidence: false,
      evidenceContradictory: false,
      evidenceInsufficient: true,
      proposedMinFavorableR: 1,
      proposedTightenToBreakEven: true,
    });
    expect(pp.state).toBe("WATCH");
    expect(pp.proposedAction).toBe("CONTINUE_MONITOR");
    expect(pp.isBrokerExecution).toBe(false);
  });

  it("rejects protective SL that would widen risk", () => {
    expect(wouldWidenStopLoss("BUY", 4080, 4070)).toBe(true);
    expect(wouldWidenStopLoss("BUY", 4080, 4090)).toBe(false);
    expect(wouldWidenStopLoss("SELL", 4120, 4130)).toBe(true);
    expect(wouldWidenStopLoss("SELL", 4120, 4110)).toBe(false);
  });

  it("distinguishes simulated early-exit from broker execution", () => {
    const pp = evaluateProfitProtection({
      direction: "BUY",
      originalStopLoss: 4080,
      entryPrice: 4100,
      currentPrice: 4140,
      favorableMovePrice: 40,
      stopDistancePrice: 20,
      multiTimeframeReversalEvidence: true,
      evidenceContradictory: false,
      evidenceInsufficient: false,
      proposedMinFavorableR: 1,
      proposedTightenToBreakEven: false,
    });
    expect(pp.state).toBe("PROTECTIVE_ACTION_PROPOSED_SIM");
    expect(pp.proposedAction).toBe("EARLY_EXIT_SIM");
    expect(pp.isBrokerExecution).toBe(false);
    expect(pp.simulationOnly).toBe(true);
    expect(pp.acceptsForExecution).toBe(false);
  });
});

describe("Phase 56.2.2 persistence and safety", () => {
  let tmp: string;
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "at-sim-56-2-2-"));
    resetAtSimRiskEngineForTests();
    resetAtSimRiskStoreForTests();
  });
  afterEach(() => {
    resetAtSimRiskEngineForTests();
    resetAtSimRiskStoreForTests();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("persists draft without granting execution eligibility", async () => {
    const engine = getAtSimRiskEngine(tmp);
    const draft = await engine.validateAndPersist(baseInput());
    expect(draft.eligibilityStatus).not.toBeUndefined();
    expect(draft.acceptsForExecution).toBe(false);
    expect(draft.placesOrders).toBe(false);
    expect(engine.getLatest()?.acceptsForExecution).toBe(false);
    expect(engine.publicStatus().acceptsForExecution).toBe(false);
    expect(engine.publicStatus().placesOrders).toBe(false);
    expect(engine.publicStatus().phase).toBe("56.2.2");
  });

  it("keeps safety invariants false/locked across scenarios", () => {
    for (const over of [
      { allocationPercentage: 12 },
      { allocationPercentage: 25 },
      { allocationPercentage: 11 },
      { stopLoss: null },
      { marketEvidenceStrength: "WEAK" as const },
      { requestedQuantity: null },
    ]) {
      const r = validateSimulationDraft(baseInput(over));
      expect(r.placesOrders).toBe(false);
      expect(r.acceptsForExecution).toBe(false);
      expect(r.simulationOnly).toBe(true);
      expect(r.checks.some((c) => c.code === "HARD_MAX_LOSS_POLICY_UNDECIDED" && c.status === "BLOCKED")).toBe(true);
    }
  });

  it("default policy documents allocation range distinct from hard max-loss", () => {
    const p = defaultSimRiskPolicy();
    expect(p.allocationPercentMin).toBe(12);
    expect(p.allocationPercentMax).toBe(25);
    expect(p.allocationPolicyMode).toBe("PERCENTAGE_RANGE");
    expect(p.riskBudgetMode).toBe("UNDECIDED");
    expect(p.riskPercent).toBeNull();
    expect(p.note).toMatch(/not loss/i);
  });
});
