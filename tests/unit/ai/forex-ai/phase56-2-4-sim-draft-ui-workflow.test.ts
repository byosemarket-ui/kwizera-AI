/**
 * Phase 56.2.4 — Simplified simulation draft: order allocation only + derived levels.
 * Synthetic fixtures — not live broker evidence.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  proposeQuantityFromAllocation,
  proposeSimLevels,
  proposeTakeProfit3RPrice,
  validateOrderAllocationAmount,
  validateSimulationDraft,
  defaultSimRiskPolicy,
  type AtSimDraftInput,
  type AtSimContractMetaInput,
} from "../../../../ai/forex-ai/automated-trading/simulation-risk/index.js";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

const contract: AtSimContractMetaInput = {
  verified: true,
  pointSize: 0.01,
  tickSize: 0.01,
  digits: 2,
  quantityMin: 1,
  quantityStep: 1,
  quantityUnit: "contracts",
  quantityUnitAmbiguous: false,
  contractMultiplier: 1,
  baseUnitSize: 1,
  pipCostAccount: 0.01,
  marginPerLotAccount: 5,
  minStopDistance: null,
  minStopDistanceVerified: false,
  source: "synthetic",
  unavailableReason: null,
};

describe("Phase 56.2.4 order allocation input validation", () => {
  it("accepts positive finite allocation and rejects invalid", () => {
    expect(validateOrderAllocationAmount(100).ok).toBe(true);
    expect(validateOrderAllocationAmount(0).ok).toBe(false);
    expect(validateOrderAllocationAmount(-1).ok).toBe(false);
    expect(validateOrderAllocationAmount(Number.NaN).ok).toBe(false);
    expect(validateOrderAllocationAmount("").ok).toBe(false);
    expect(validateOrderAllocationAmount(null).ok).toBe(false);
  });
});

describe("Phase 56.2.4 derived Entry/SL/TP", () => {
  it("derives BUY entry/ask, SL from support, TP at 3R", () => {
    const r = proposeSimLevels({
      direction: "BUY",
      bid: 3999,
      ask: 4000,
      mid: 3999.5,
      quoteFresh: true,
      supportLevels: [{ price: 3980 }, { price: 3970 }],
      resistanceLevels: [{ price: 4020 }],
      digits: 2,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.entryPrice).toBe(4000);
    expect(r.stopLoss).toBe(3980);
    expect(r.takeProfit).toBe(4060); // 4000 + 3*20
    expect(r.takeProfitSource).toBe("3R_FROM_VERIFIED_STOP_DISTANCE");
  });

  it("blocks when quote stale or support missing", () => {
    const stale = proposeSimLevels({
      direction: "BUY",
      bid: 3999,
      ask: 4000,
      mid: 3999.5,
      quoteFresh: false,
      supportLevels: [{ price: 3980 }],
      resistanceLevels: [],
      digits: 2,
    });
    expect(stale.ok).toBe(false);

    const noSl = proposeSimLevels({
      direction: "BUY",
      bid: 3999,
      ask: 4000,
      mid: 3999.5,
      quoteFresh: true,
      supportLevels: [{ price: 4010 }], // above entry — invalid for BUY SL
      resistanceLevels: [],
      digits: 2,
    });
    expect(noSl.ok).toBe(false);
  });

  it("SELL uses bid and resistance above entry", () => {
    const r = proposeSimLevels({
      direction: "SELL",
      bid: 4000,
      ask: 4001,
      mid: 4000.5,
      quoteFresh: true,
      supportLevels: [{ price: 3980 }],
      resistanceLevels: [{ price: 4010 }],
      digits: 2,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.entryPrice).toBe(4000);
    expect(r.stopLoss).toBe(4010);
    expect(r.takeProfit).toBe(3970); // 4000 - 3*10
  });

  it("3R TP geometry is directionally valid", () => {
    const buy = proposeTakeProfit3RPrice({
      direction: "BUY",
      entryPrice: 100,
      stopLoss: 90,
      digits: 2,
    });
    expect(buy.ok && buy.takeProfit).toBe(130);
    const sell = proposeTakeProfit3RPrice({
      direction: "SELL",
      entryPrice: 100,
      stopLoss: 110,
      digits: 2,
    });
    expect(sell.ok && sell.takeProfit).toBe(70);
  });
});

describe("Phase 56.2.4 quantity from allocation vs margin", () => {
  it("sizes quantity so SL risk ≤ 25% of allocation", () => {
    // move=20, pointSize=0.01 → 2000 points * 0.01 pipCost = $20 per contract
    // alloc=100 → max loss 25 → qty floor 25/20 = 1
    const q = proposeQuantityFromAllocation({
      orderAllocation: 100,
      entryPrice: 4000,
      stopLoss: 3980,
      contract,
    });
    expect(q.ok).toBe(true);
    if (!q.ok) return;
    expect(q.quantity).toBe(1);
    expect(q.estimatedStopLossRisk).toBe(20);
    expect(q.maxPermittedLoss).toBe(25);
  });

  it("blocks quantity when units ambiguous", () => {
    const q = proposeQuantityFromAllocation({
      orderAllocation: 100,
      entryPrice: 4000,
      stopLoss: 3980,
      contract: { ...contract, quantityUnitAmbiguous: true, quantityUnit: "unknown" },
    });
    expect(q.ok).toBe(false);
  });

  it("keeps required margin distinct from order allocation in draft result", () => {
    const input: AtSimDraftInput = {
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
      entryPrice: 4000,
      stopLoss: 3980,
      takeProfit: 4060,
      requestedQuantity: null,
      allocationPercentage: null,
      marketEvidenceStrength: null,
      profitProtection: null,
      capitalAllocationPercent: 50,
      requestedPerOrderAllocation: 100,
      reservedStrategyBudgetActive: 0,
      quote: {
        bid: 3999,
        ask: 4000,
        entryPrice: 4000,
        entrySource: "test",
        fresh: true,
        freshnessReasonCode: "FRESH",
        quoteAgeMs: 10,
        observedAtUtc: "2026-10-20T00:00:00.000Z",
      },
      contract,
      account: {
        verified: true,
        accountIdMasked: "***1",
        accountCurrency: "USD",
        equity: 20_000,
        balance: 20_000,
        usableMargin: 20_000,
        usedMargin: 0,
        fetchedAtUtc: "2026-10-20T00:00:00.000Z",
        environment: "DEMO",
        unavailableReason: null,
      },
      sourceDecisionId: null,
      sourceAnalysisId: null,
      sourceEvidenceFingerprint: null,
      sourceDecidedAtUtc: null,
      policy: defaultSimRiskPolicy(),
      openPositionsCount: 0,
      pendingOrdersCount: 0,
      exposureDataAuthoritative: true,
    };
    const r = validateSimulationDraft(input);
    expect(r.placesOrders).toBe(false);
    expect(r.acceptsForExecution).toBe(false);
    expect(r.capitalBudgetAnalysis?.perOrderAllocation).toBe(100);
    expect(r.capitalBudgetAnalysis?.perOrderLossLimit).toBe(25);
    expect(r.proposedQuantity).toBe(1);
    // Margin for 1 contract at $5 ≠ allocation $100
    expect(r.rewardRiskAnalysis?.estimatedRequiredMargin).toBe(5);
    expect(r.rewardRiskAnalysis?.estimatedRequiredMargin).not.toBe(
      r.capitalBudgetAnalysis?.perOrderAllocation,
    );
  });
});

describe("Phase 56.2.4 UI simplified workflow greps", () => {
  it("Simulation draft exposes a single order-allocation input and derived grid", () => {
    const page = read("desktop/forex/ForexAutomatedTradingPage.tsx");
    expect(page).toMatch(/data-fx-at-sim-order-alloc/);
    expect(page).toMatch(/Order Allocation \(USD\)/);
    expect(page).toMatch(/fx-auto-sim-grid/);
    // Manual Entry/SL/TP inputs removed from simplified workflow
    expect(page).not.toMatch(/data-fx-at-sim-entry="true"/);
    expect(page).not.toMatch(/data-fx-at-sim-sl="true"/);
    expect(page).not.toMatch(/data-fx-at-sim-tp="true"/);
    expect(page).toMatch(/placesOrders=/);
    expect(page).toMatch(/acceptsForExecution=/);
    expect(page).toMatch(/data-fx-at-sim-exec=/);
  });

  it("CSS defines compact responsive sim draft breakpoints", () => {
    const css = read("desktop/forex/forex.css");
    expect(css).toMatch(/\.fx-auto-sim-grid/);
    expect(css).toMatch(/@media \(max-width: 768px\)/);
    expect(css).toMatch(/@media \(max-width: 420px\)/);
    expect(css).toMatch(/\.fx-auto-sim-alloc-input/);
  });
});
