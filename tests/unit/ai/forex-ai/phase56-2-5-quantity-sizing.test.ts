/**
 * Phase 56.2.5 — Quantity min/step evidence, sizing from allocation, fail-closed gates.
 * Synthetic fixtures — not live broker evidence.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { contractSpecFromForexConnectMetadata } from "../../../../ai/forex-ai/position-sizing/contract-spec.ts";
import {
  floorQuantityToStep,
  looksLikeInventedLotsMin,
  resolveXauQuantityConstraints,
  sizeOrderQuantityFromAllocation,
  proposeQuantityFromAllocation,
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

const xauContract: AtSimContractMetaInput = {
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
  marginPerLotAccount: 4.79,
  minStopDistance: null,
  minStopDistanceVerified: false,
  source: "synthetic",
  unavailableReason: null,
};

describe("Phase 56.2.5 quantityMin vs quantityStep discrepancy", () => {
  it("documents 0.01 as invented lots fallback, not SDK CFD min", () => {
    expect(looksLikeInventedLotsMin(0.01)).toBe(true);
    expect(looksLikeInventedLotsMin(1)).toBe(false);
  });

  it("resolves DEMO-style 0.01 vs 1 by discarding invented min and using BaseUnitSize step", () => {
    const r = resolveXauQuantityConstraints({
      quantityUnit: "contracts",
      quantityUnitAmbiguous: false,
      baseUnitSize: 1,
      sdkMinQuantity: null,
      legacyLotStep: 1, // historical getMinQuantity alias
      reportedQuantityStep: 1,
      reportedQuantityMin: 0.01, // local lots invention
    });
    expect(r.status).toBe("VERIFIED");
    expect(r.sizingBlocked).toBe(false);
    expect(r.quantityMin).toBe(1);
    expect(r.quantityStep).toBe(1);
    expect(r.quantityUnit).toBe("contracts");
    expect(r.notes.some((n) => /0\.01/.test(n))).toBe(true);
  });

  it("does not silently replace step=1 with 0.01", () => {
    const r = resolveXauQuantityConstraints({
      quantityUnit: "contracts",
      quantityUnitAmbiguous: false,
      baseUnitSize: 1,
      reportedQuantityStep: 0.01,
      reportedQuantityMin: 0.01,
      legacyLotStep: null,
      sdkMinQuantity: null,
    });
    // Without SDK min, block — do not invent min=1 merely to look complete.
    expect(r.sizingBlocked).toBe(true);
    expect(r.quantityStep).toBe(1);
    expect(r.quantityMin).toBeNull();
  });

  it("blocks contradictory min not multiple of BaseUnitSize", () => {
    const r = resolveXauQuantityConstraints({
      quantityUnit: "contracts",
      quantityUnitAmbiguous: false,
      baseUnitSize: 1,
      sdkMinQuantity: 1.5,
    });
    expect(r.status).toBe("CONTRADICTORY");
    expect(r.sizingBlocked).toBe(true);
  });

  it("contract-spec for XAU uses BaseUnitSize as step, not invented 0.01", () => {
    const spec = contractSpecFromForexConnectMetadata({
      instrumentId: "XAU/USD",
      instrumentTypeLabel: "Bullion",
      metadata: {
        pointSize: 0.01,
        pipCost: 0.01,
        baseUnitSize: 1,
        contractMultiplier: 1,
        minQuantity: 1,
      },
    });
    expect(spec.quantityUnit).toBe("contracts");
    expect(spec.quantityStep).toBe(1);
    expect(spec.quantityMin).toBe(1);
  });
});

describe("Phase 56.2.5 sizeOrderQuantityFromAllocation", () => {
  const baseSizeInput = {
    verifiedEquity: 10_000,
    accountCurrency: "USD",
    strategyAllocationPercent: 50,
    remainingStrategyBudget: 5_000,
    individualOrderAllocation: 200,
    entryPrice: 4100,
    stopLoss: 4080,
    contract: xauContract,
    freeMargin: 8_000,
    exposureAuthoritative: true,
    marginPerUnitAccount: 4.79,
    sdkMinQuantity: 1,
    legacyLotStep: 1,
  };

  it("sizes quantity under 25% loss ceiling and floors to step", () => {
    // move=20, points=2000, risk/unit=$20; max loss=$50 → raw=2.5 → floor to 2
    const r = sizeOrderQuantityFromAllocation(baseSizeInput);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.quantity).toBe(2);
    expect(r.quantityUnit).toBe("contracts");
    expect(r.estimatedStopLossRisk).toBe(40);
    expect(r.maxPermittedOrderLoss).toBe(50);
    expect(r.requiredMargin).toBeCloseTo(9.58, 5);
    expect(r.requiredMargin).not.toBe(r.maxPermittedOrderLoss);
  });

  it("never rounds up past the loss ceiling", () => {
    const r = sizeOrderQuantityFromAllocation({
      ...baseSizeInput,
      individualOrderAllocation: 30, // max loss $7.5 < $20/contract → below min
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toMatch(/BELOW_MIN|LOSS/i);
  });

  it("rejects invalid allocation and non-USD without conversion", () => {
    expect(validateOrderAllocationAmount(-1).ok).toBe(false);
    expect(validateOrderAllocationAmount(0).ok).toBe(false);
    const eur = sizeOrderQuantityFromAllocation({
      ...baseSizeInput,
      accountCurrency: "EUR",
    });
    expect(eur.ok).toBe(false);
    if (!eur.ok) expect(eur.code).toBe("SIZE_QTY_CURRENCY_CONVERSION_UNVERIFIED");
  });

  it("blocks when exposure is not authoritative", () => {
    const r = sizeOrderQuantityFromAllocation({
      ...baseSizeInput,
      exposureAuthoritative: false,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("SIZE_QTY_EXPOSURE_UNVERIFIED");
  });

  it("blocks ambiguous units", () => {
    const r = sizeOrderQuantityFromAllocation({
      ...baseSizeInput,
      contract: { ...xauContract, quantityUnitAmbiguous: true, quantityUnit: "unknown" },
    });
    expect(r.ok).toBe(false);
  });

  it("keeps allocation distinct from required margin", () => {
    const r = sizeOrderQuantityFromAllocation(baseSizeInput);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.requiredMargin).not.toBe(baseSizeInput.individualOrderAllocation);
    expect(r.requiredMargin!).toBeLessThan(baseSizeInput.individualOrderAllocation);
  });

  it("floorQuantityToStep never rounds up", () => {
    expect(floorQuantityToStep(2.9, 1, 1)).toBe(2);
    expect(floorQuantityToStep(0.9, 1, 1)).toBeNull();
  });
});

describe("Phase 56.2.5 proposeQuantityFromAllocation uses constraints", () => {
  it("sizes with verified min/step on contract", () => {
    const r = proposeQuantityFromAllocation({
      orderAllocation: 200,
      entryPrice: 4100,
      stopLoss: 4080,
      contract: xauContract,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.quantity).toBe(2);
    expect(r.quantityUnit).toBe("contracts");
  });
});

describe("Phase 56.2.5 safety and UI invariants", () => {
  it("validation never enables execution", () => {
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
      entryPrice: 4100,
      stopLoss: 4080,
      takeProfit: 4160,
      requestedQuantity: null,
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
      contract: xauContract,
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
      sourceDecisionId: "d1",
      sourceAnalysisId: "a1",
      sourceEvidenceFingerprint: "fp",
      sourceDecidedAtUtc: new Date().toISOString(),
      policy: { ...defaultSimRiskPolicy(), riskBudgetMode: "PERCENTAGE", riskPercent: 0.5 },
      openPositionsCount: 0,
      pendingOrdersCount: 0,
      exposureDataAuthoritative: true,
      allocationPercentage: 18,
      marketEvidenceStrength: "SUFFICIENT",
      profitProtection: null,
      capitalAllocationPercent: 50,
      requestedPerOrderAllocation: 200,
      reservedStrategyBudgetActive: 0,
    };
    const r = validateSimulationDraft(input);
    expect(r.acceptsForExecution).toBe(false);
    expect(r.placesOrders).toBe(false);
    expect(r.simulationOnly).toBe(true);
  });

  it("UI keeps Order Allocation as only manual draft amount and safety closed", () => {
    const page = read("desktop/forex/ForexAutomatedTradingPage.tsx");
    expect(page).toMatch(/Order Allocation \(USD\)/);
    expect(page).toMatch(/simOrderAlloc/);
    expect(page).not.toMatch(/simEntryPrice|setSimEntry|manualEntry/);
    expect(page).toMatch(/placesOrders/);
    expect(page).toMatch(/acceptsForExecution/);
    const css = read("desktop/forex/forex.css");
    expect(css).toMatch(/fx-auto-sim-/);
    const py = read("services/forexconnect-sidecar/server.py");
    expect(py).toMatch(/minQuantity/);
    expect(py).toMatch(/get_min_quantity|getMinQuantity/);
    expect(py).toMatch(/Never map CondDist/);
  });
});
