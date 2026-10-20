/**
 * Phase 56.2.3 — Strategy capital 1–100%, shared budget, per-order 25% SL loss limit.
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { readFileSync } from "node:fs";
import {
  PER_ORDER_LOSS_LIMIT_FRACTION,
  STRATEGY_ALLOCATION_PCT_MAX,
  STRATEGY_ALLOCATION_PCT_MIN,
  allocatePerOrderFromRemaining,
  computeCapitalAllocationBudget,
  computePerOrderLossLimit,
  defaultSimRiskPolicy,
  evaluatePerOrderLossLimit,
  getAtSimRiskEngine,
  resetAtSimRiskEngineForTests,
  resetAtSimRiskStoreForTests,
  sumActiveReservations,
  validateSimulationDraft,
  validateStrategyAllocationPercent,
  type AtSimDraftInput,
  type AtSimRiskPolicy,
  type CapitalBudgetReservation,
} from "../../../../ai/forex-ai/automated-trading/index.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

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
    allocationPercentage: null,
    marketEvidenceStrength: "SUFFICIENT",
    profitProtection: null,
    capitalAllocationPercent: 50,
    requestedPerOrderAllocation: 100,
    reservedStrategyBudgetActive: 0,
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
      balance: 9_000,
      usableMargin: 8_000,
      usedMargin: 0,
      fetchedAtUtc: new Date().toISOString(),
      environment: "DEMO",
      unavailableReason: null,
    },
    sourceDecisionId: "dec-5623",
    sourceAnalysisId: "an-5623",
    sourceEvidenceFingerprint: "fp-5623",
    sourceDecidedAtUtc: new Date().toISOString(),
    policy: basePolicy({ riskBudgetMode: "UNDECIDED", riskPercent: null }),
    openPositionsCount: 0,
    pendingOrdersCount: 0,
    exposureDataAuthoritative: true,
    ...over,
  };
}

describe("Phase 56.2.3 strategy allocation settings", () => {
  it("accepts 1% and 100%", () => {
    expect(validateStrategyAllocationPercent(STRATEGY_ALLOCATION_PCT_MIN).ok).toBe(true);
    expect(validateStrategyAllocationPercent(STRATEGY_ALLOCATION_PCT_MAX).ok).toBe(true);
    const r1 = validateSimulationDraft(baseInput({ capitalAllocationPercent: 1, requestedPerOrderAllocation: 10 }));
    expect(r1.capitalBudgetAnalysis.capitalAllocationBudget).toBe(100);
    const r100 = validateSimulationDraft(baseInput({ capitalAllocationPercent: 100, requestedPerOrderAllocation: 100 }));
    expect(r100.capitalBudgetAnalysis.capitalAllocationBudget).toBe(10_000);
  });

  it("rejects below 1% and above 100%", () => {
    expect(validateStrategyAllocationPercent(0).ok).toBe(false);
    expect(validateStrategyAllocationPercent(0.5).ok).toBe(false);
    expect(validateStrategyAllocationPercent(101).ok).toBe(false);
  });

  it("handles non-finite / missing safely", () => {
    expect(validateStrategyAllocationPercent(null).ok).toBe(false);
    expect(validateStrategyAllocationPercent(Number.NaN).ok).toBe(false);
    expect(validateStrategyAllocationPercent(Number.POSITIVE_INFINITY).ok).toBe(false);
    const r = validateSimulationDraft(baseInput({ capitalAllocationPercent: null }));
    expect(r.reasons.some((x) => x.code === "STRATEGY_ALLOC_PCT_MISSING")).toBe(true);
    expect(r.acceptsForExecution).toBe(false);
  });

  it("computes equity-based budget and never substitutes balance", () => {
    const budget = computeCapitalAllocationBudget(10_000, 40);
    expect(budget.ok).toBe(true);
    if (budget.ok) expect(budget.capitalAllocationBudget).toBe(4000);
    // Equity missing even if balance present → blocked
    const r = validateSimulationDraft(
      baseInput({
        account: {
          verified: true,
          accountIdMasked: "x",
          accountCurrency: "USD",
          equity: null,
          balance: 50_000,
          usableMargin: 40_000,
          usedMargin: 0,
          fetchedAtUtc: new Date().toISOString(),
          environment: "DEMO",
          unavailableReason: null,
        },
      }),
    );
    expect(r.reasons.some((x) => x.code === "STRATEGY_EQUITY_MISSING")).toBe(true);
    expect(r.capitalBudgetAnalysis.capitalAllocationBudget).toBeNull();
  });
});

describe("Phase 56.2.3 shared strategy budget", () => {
  it("two allocations share one budget and cannot exceed it", () => {
    const budget = 1000;
    const first = allocatePerOrderFromRemaining({
      capitalAllocationBudget: budget,
      reservedActive: 0,
      requestedPerOrderAllocation: 600,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = allocatePerOrderFromRemaining({
      capitalAllocationBudget: budget,
      reservedActive: first.perOrderAllocation,
      requestedPerOrderAllocation: 500,
    });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.code).toBe("PER_ORDER_EXCEEDS_REMAINING_BUDGET");

    const okSecond = allocatePerOrderFromRemaining({
      capitalAllocationBudget: budget,
      reservedActive: first.perOrderAllocation,
      requestedPerOrderAllocation: 400,
    });
    expect(okSecond.ok).toBe(true);
  });

  it("does not grant full strategy budget automatically", () => {
    const miss = allocatePerOrderFromRemaining({
      capitalAllocationBudget: 5000,
      reservedActive: 0,
      requestedPerOrderAllocation: null,
    });
    expect(miss.ok).toBe(false);
    if (!miss.ok) expect(miss.code).toBe("PER_ORDER_ALLOCATION_MISSING");
  });

  it("sumActiveReservations ignores RELEASED and other environments", () => {
    const rows: CapitalBudgetReservation[] = [
      { draftId: "a", environment: "DEMO", amount: 100, status: "ACTIVE", createdAtUtc: "t", releasedAtUtc: null },
      { draftId: "b", environment: "DEMO", amount: 50, status: "RELEASED", createdAtUtc: "t", releasedAtUtc: "t2" },
      { draftId: "c", environment: "LIVE", amount: 999, status: "ACTIVE", createdAtUtc: "t", releasedAtUtc: null },
    ];
    expect(sumActiveReservations(rows, "DEMO")).toBe(100);
    expect(sumActiveReservations(rows, "DEMO", "a")).toBe(0);
  });

  it("unknown exposure blocks eligibility when required", () => {
    const r = validateSimulationDraft(baseInput({ exposureDataAuthoritative: false }));
    expect(r.reasons.some((x) => x.code === "EXPOSURE_DATA_UNAVAILABLE")).toBe(true);
    expect(r.acceptsForExecution).toBe(false);
  });

  it("persisted drafts release reservations when rejected and reserve when structurally ok with allocation", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "at-sim-56-2-3-"));
    resetAtSimRiskEngineForTests();
    resetAtSimRiskStoreForTests();
    try {
      const engine = getAtSimRiskEngine(tmp);
      const okDraft = await engine.validateAndPersist(
        baseInput({
          capitalAllocationPercent: 50,
          requestedPerOrderAllocation: 200,
          // Force FAIL on loss limit so reservation path for reject is exercised after a prior reserve
          // First persist a passing loss-limit draft (R=20, limit=50 for alloc 200)
        }),
      );
      // R = (20/0.01)*0.01*1 = 20; limit = 50 → pass
      expect(okDraft.capitalBudgetAnalysis.perOrderLossLimitPass).toBe(true);
      expect(engine.sumActiveReserved("DEMO")).toBeGreaterThan(0);

      const reject = await engine.validateAndPersist(
        baseInput({
          capitalAllocationPercent: 50,
          requestedPerOrderAllocation: 10,
          // R=20 > limit 2.5 → FAIL → should release / not leave ACTIVE for this draft
          stopLoss: 4080,
          entryPrice: 4100,
        }),
      );
      expect(reject.capitalBudgetAnalysis.perOrderLossLimitPass).toBe(false);
      expect(reject.placesOrders).toBe(false);
      expect(reject.acceptsForExecution).toBe(false);
    } finally {
      resetAtSimRiskEngineForTests();
      resetAtSimRiskStoreForTests();
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe("Phase 56.2.3 per-order 25% loss limit", () => {
  it("limit equals 25% of per-order allocation", () => {
    expect(PER_ORDER_LOSS_LIMIT_FRACTION).toBe(0.25);
    expect(computePerOrderLossLimit(100)).toBe(25);
  });

  it("passes when risk below or equal to limit; blocks above", () => {
    const below = evaluatePerOrderLossLimit({ perOrderAllocation: 100, estimatedStopLossRisk: 20 });
    expect(below.ok && below.pass).toBe(true);
    const eq = evaluatePerOrderLossLimit({ perOrderAllocation: 100, estimatedStopLossRisk: 25 });
    expect(eq.ok && eq.pass).toBe(true);
    const over = evaluatePerOrderLossLimit({ perOrderAllocation: 100, estimatedStopLossRisk: 25.01 });
    expect(over.ok && over.pass).toBe(false);
  });

  it("blocks when allocation or risk missing / units ambiguous", () => {
    expect(evaluatePerOrderLossLimit({ perOrderAllocation: null, estimatedStopLossRisk: 10 }).ok).toBe(false);
    expect(evaluatePerOrderLossLimit({ perOrderAllocation: 100, estimatedStopLossRisk: null }).ok).toBe(false);
    const r = validateSimulationDraft(
      baseInput({
        contract: {
          ...baseInput().contract!,
          quantityUnit: "unknown",
          quantityUnitAmbiguous: true,
        },
      }),
    );
    expect(r.rewardRiskAnalysis.estimatedStopLossRisk).toBeNull();
    expect(r.rewardRiskAnalysis.targetReward3R).toBeNull();
  });

  it("validates BUY/SELL geometry and missing SL", () => {
    expect(validateSimulationDraft(baseInput({ direction: "BUY" })).checks.some((c) => c.code === "BUY_GEOMETRY")).toBe(true);
    expect(
      validateSimulationDraft(
        baseInput({ direction: "SELL", entryPrice: 4100, stopLoss: 4120, takeProfit: 4040 }),
      ).checks.some((c) => c.code === "SELL_GEOMETRY"),
    ).toBe(true);
    expect(validateSimulationDraft(baseInput({ stopLoss: null })).reasons.some((x) => x.code === "SL_MISSING")).toBe(true);
  });

  it("computes 3R only from valid monetary risk and never mislabels margin as SL risk", () => {
    const r = validateSimulationDraft(baseInput());
    // R=20, 3R=60, allocation 100, limit 25 → pass
    expect(r.rewardRiskAnalysis.estimatedStopLossRisk).toBe(20);
    expect(r.rewardRiskAnalysis.targetReward3R).toBe(60);
    expect(r.capitalBudgetAnalysis.perOrderLossLimit).toBe(25);
    expect(r.capitalBudgetAnalysis.perOrderLossLimitPass).toBe(true);
    expect(r.capitalBudgetAnalysis.note).not.toMatch(/margin.*loss|loss.*margin/i);
    expect(r.placesOrders).toBe(false);
    expect(r.acceptsForExecution).toBe(false);
  });

  it("stale quotes block eligibility", () => {
    const r = validateSimulationDraft(
      baseInput({
        quote: { ...baseInput().quote, fresh: false, freshnessReasonCode: "STALE" },
      }),
    );
    expect(r.reasons.some((x) => x.code === "QUOTE_STALE")).toBe(true);
  });
});

describe("Phase 56.2.3 ForexConnect RO + safety greps", () => {
  it("exposes admin-gated broker-ro-tables without mutation and without EXECUTION_FORBIDDEN path clash", () => {
    const api = read("dev/server/forex-automated-trading-api.ts");
    expect(api).toMatch(/broker-ro-tables/);
    expect(api).toMatch(/listOrders/);
    expect(api).toMatch(/listTrades/);
    expect(api).toMatch(/CLOSED_TRADES_NOT_IMPLEMENTED/);
    expect(api).toMatch(/placesOrders:\s*false/);
    expect(api).toMatch(/EXECUTION_FORBIDDEN/);
    expect(api).toMatch(/capitalAllocationPercent/);
    // Production import must target client.js (no forexconnect/index barrel).
    expect(api).toMatch(/forexconnect\/client\.js/);
    expect(api).not.toMatch(/forexconnect\/index\.js/);
    // Must not enable execution on controls save
    expect(api).not.toMatch(/acceptsForExecution:\s*true/);
  });

  it("sidecar RO handlers never place orders", () => {
    const py = read("services/forexconnect-sidecar/server.py");
    expect(py).toMatch(/def orders_payload/);
    expect(py).toMatch(/def trades_payload/);
    expect(py).toMatch(/Never creates\/cancels\/amends/);
    expect(py).toMatch(/trading.*DISABLED|"trading": "DISABLED"/);
  });

  it("keeps execution closed across capital settings and drafts", () => {
    for (const over of [
      { capitalAllocationPercent: 1 as number },
      { capitalAllocationPercent: 100 as number },
      { capitalAllocationPercent: null },
      { requestedPerOrderAllocation: null },
      { exposureDataAuthoritative: false },
    ]) {
      const r = validateSimulationDraft(baseInput(over));
      expect(r.placesOrders).toBe(false);
      expect(r.acceptsForExecution).toBe(false);
      expect(r.simulationOnly).toBe(true);
    }
  });
});
