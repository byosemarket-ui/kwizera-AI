/**
 * Stage 1 Part 1 — Independent per-order risk + dynamic sizing.
 * Fixtures only. Never submits broker orders.
 */
import { describe, expect, it } from "vitest";
import {
  assertIndependentRiskBudgets,
  buildIndependentOrderRiskBudget,
  reserveIndependentAllocations,
  runAutomatedPerOrderRiskEngine,
} from "../../../../ai/forex-ai/automated-trading/per-order-risk/index.js";
import {
  OWNER_FIXED_LOT_CAP_ENFORCED,
  OWNER_MAX_QUANTITY,
  PER_ORDER_RISK_MAXIMUM_PERCENT,
  PER_ORDER_RISK_TARGET_PERCENT,
  RISK_POLICY_VERSION,
} from "../../../../ai/forex-ai/automated-trading/order-proposal/types.js";
import {
  computePerOrderRiskBreakdown,
} from "../../../../ai/forex-ai/automated-trading/simulation-risk/capital-budget.js";
import {
  sizeOrderQuantityFromAllocation,
} from "../../../../ai/forex-ai/automated-trading/simulation-risk/size-order-quantity.js";
import type { AtSimContractMetaInput } from "../../../../ai/forex-ai/automated-trading/simulation-risk/types.js";
import type { AtOrderPreparationHandoff } from "../../../../ai/forex-ai/automated-trading/result-intake/types.js";

function handoff(instrument: string, dir: "BUY" | "SELL"): AtOrderPreparationHandoff {
  return {
    acceptedResultId: `res-${instrument}`,
    analysisId: `an-${instrument}`,
    instrument,
    canonicalDirection: dir,
    directionalConfidencePct: 70,
    confidenceType: "ANALYSIS_CONFIDENCE",
    isCalibratedWinProbability: false,
    observationId: "obs-1",
    imageId: "img-1",
    imageHash: "hash-1",
    analyzedAtUtc: new Date().toISOString(),
    resultExpiresAtUtc: new Date(Date.now() + 3_600_000).toISOString(),
    validationStatus: "VALID",
    intakeLifecycle: "ACCEPTED",
    evidenceReferences: {
      reconciliationStatus: "ALIGNED",
      canonicalOutcome: "BUY_CANDIDATE",
      primaryTimeframe: "H1",
      mtfAlignment: "ALIGNED",
    },
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    note: "fixture",
  };
}

function contract(overrides: Partial<AtSimContractMetaInput> = {}): AtSimContractMetaInput {
  return {
    verified: true,
    pointSize: 0.01,
    tickSize: 0.01,
    digits: 2,
    quantityMin: 0.01,
    quantityStep: 0.01,
    quantityUnit: "contracts",
    quantityUnitAmbiguous: false,
    contractMultiplier: 1,
    baseUnitSize: 0.01,
    pipCostAccount: 0.01,
    marginPerLotAccount: 10,
    minStopDistance: null,
    minStopDistanceVerified: false,
    source: "fixture",
    unavailableReason: null,
    ...overrides,
  };
}

function engineInput(opts: {
  instrument?: string;
  dir?: "BUY" | "SELL";
  alloc: number;
  entry?: number;
  stop?: number;
  equity?: number;
  strategyPct?: number;
  reserved?: number;
  pending?: number;
  contract?: AtSimContractMetaInput;
  sdkMin?: number;
  brokerMax?: number | null;
  marginPerUnit?: number;
  usableMargin?: number;
}) {
  const dir = opts.dir ?? "BUY";
  const entry = opts.entry ?? 2000;
  const stop = opts.stop ?? (dir === "BUY" ? 1990 : 2010);
  return {
    handoff: handoff(opts.instrument ?? "XAU/USD", dir),
    entryPrice: entry,
    stopLoss: stop,
    autoLevels: false as const,
    verifiedEquity: opts.equity ?? 50_000,
    accountCurrency: "USD",
    equityFresh: true,
    usableMargin: opts.usableMargin ?? 40_000,
    usedMargin: 0,
    marginFresh: true,
    strategyAllocationPercent: opts.strategyPct ?? 100,
    individualOrderAllocation: opts.alloc,
    allocationCurrency: "USD",
    existingCommittedExposure: opts.reserved ?? 0,
    pendingProposalReservations: opts.pending ?? 0,
    contract: opts.contract ?? contract(),
    contractFresh: true,
    sdkMinQuantity: opts.sdkMin ?? 0.01,
    brokerMaxQuantity: opts.brokerMax ?? null,
    marginPerUnitAccount: opts.marginPerUnit ?? 10,
    exposureAuthoritative: true,
    existingExposure: 0,
    systemMasterOn: true,
    tradingEnabled: false,
    emergencyEntryLock: true,
    environment: "DEMO" as const,
  };
}

describe("Stage 1 Part 1 — policy constants", () => {
  it("enforces owner-approved 25%/25% with dynamic lot sizing enabled", () => {
    expect(PER_ORDER_RISK_TARGET_PERCENT).toBe(25);
    expect(PER_ORDER_RISK_MAXIMUM_PERCENT).toBe(25);
    expect(RISK_POLICY_VERSION).toBe("per-order-risk-v3-25target-25max");
    expect(OWNER_FIXED_LOT_CAP_ENFORCED).toBe(false);
    expect(OWNER_MAX_QUANTITY).toBe(0.01);
  });
});

describe("Stage 1 Part 1 — independent allocation isolation", () => {
  it("builds $10/$20/$40 budgets with exact 25% risk and no cross-borrow flags", () => {
    const proof = assertIndependentRiskBudgets([
      { allocationId: "A", orderAllocation: 10, instrument: "EUR/USD" },
      { allocationId: "B", orderAllocation: 20, instrument: "GBP/USD" },
      { allocationId: "C", orderAllocation: 40, instrument: "XAU/USD" },
    ]);
    expect(proof.budgets.map((b) => b.allowedRiskAmount)).toEqual([2.5, 5, 10]);
    expect(proof.sumAllowedRisk).toBeCloseTo(17.5, 10);
    expect(proof.sumHardMax).toBeCloseTo(17.5, 10);
    for (const b of proof.budgets) {
      expect(b.mayBorrowFromOtherOrders).toBe(false);
      expect(b.mayLendUnusedRiskToOtherOrders).toBe(false);
      expect(b.targetRiskAmount).toBeCloseTo(b.orderAllocation * 0.25, 10);
      expect(b.hardMaximumModeledLoss).toBeCloseTo(b.orderAllocation * 0.25, 10);
    }
  });

  it("proves unused risk on a small order cannot raise a larger order's ceiling", () => {
    const small = buildIndependentOrderRiskBudget({ allocationId: "small", orderAllocation: 10 });
    const large = buildIndependentOrderRiskBudget({ allocationId: "large", orderAllocation: 40 });
    // Even if small uses $0 of its $2.50 budget, large remains capped at $10.
    expect(large.allowedRiskAmount).toBeCloseTo(10, 10);
    expect(large.allowedRiskAmount).toBeCloseTo(large.orderAllocation * 0.25, 10);
    expect(small.allowedRiskAmount + large.allowedRiskAmount).toBeCloseTo(12.5, 10);
    expect(large.allowedRiskAmount).not.toBeCloseTo(12.5, 10);
  });

  it("isolates 1, 2, 5 and 10 simultaneous order budgets", () => {
    for (const n of [1, 2, 5, 10]) {
      const specs = Array.from({ length: n }, (_, i) => ({
        allocationId: `ord-${n}-${i}`,
        orderAllocation: 10 * (i + 1),
        instrument: i % 2 === 0 ? "EUR/USD" : "XAU/USD",
      }));
      const proof = assertIndependentRiskBudgets(specs);
      expect(proof.budgets).toHaveLength(n);
      const manualSum = specs.reduce((s, x) => s + x.orderAllocation * 0.25, 0);
      expect(proof.sumAllowedRisk).toBeCloseTo(manualSum, 8);
      // No single budget equals the pooled sum unless n===1
      if (n > 1) {
        for (const b of proof.budgets) {
          expect(b.allowedRiskAmount).toBeLessThan(proof.sumAllowedRisk - 1e-9);
        }
      }
    }
  });

  it("reserves sequential allocations against strategy budget without pooling risk", () => {
    const reserved = reserveIndependentAllocations({
      capitalAllocationBudget: 200,
      requests: [
        { allocationId: "o1", orderAllocation: 10 },
        { allocationId: "o2", orderAllocation: 20 },
        { allocationId: "o3", orderAllocation: 40 },
        { allocationId: "o4", orderAllocation: 50 },
        { allocationId: "o5", orderAllocation: 30 },
      ],
    });
    expect(reserved.ok).toBe(true);
    if (!reserved.ok) return;
    expect(reserved.reserved).toHaveLength(5);
    expect(reserved.reserved[0]!.riskBudget.allowedRiskAmount).toBeCloseTo(2.5, 10);
    expect(reserved.reserved[4]!.riskBudget.allowedRiskAmount).toBeCloseTo(7.5, 10);
    expect(reserved.reserved[4]!.remainingAfter).toBeCloseTo(50, 8);
    const over = reserveIndependentAllocations({
      capitalAllocationBudget: 50,
      requests: [
        { allocationId: "a", orderAllocation: 40 },
        { allocationId: "b", orderAllocation: 20 },
      ],
    });
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.failedAllocationId).toBe("b");
  });
});

describe("Stage 1 Part 1 — dynamic position sizing", () => {
  it("computes different quantities for different allocations and SL distances", () => {
    const tight = sizeOrderQuantityFromAllocation({
      verifiedEquity: 20_000,
      accountCurrency: "USD",
      strategyAllocationPercent: 50,
      remainingStrategyBudget: 5_000,
      individualOrderAllocation: 400,
      entryPrice: 2000,
      stopLoss: 1995, // 5 points
      contract: contract(),
      freeMargin: 10_000,
      exposureAuthoritative: true,
      marginPerUnitAccount: 10,
      sdkMinQuantity: 0.01,
      allocationCurrency: "USD",
    });
    const wide = sizeOrderQuantityFromAllocation({
      verifiedEquity: 20_000,
      accountCurrency: "USD",
      strategyAllocationPercent: 50,
      remainingStrategyBudget: 5_000,
      individualOrderAllocation: 400,
      entryPrice: 2000,
      stopLoss: 1980, // 20 points
      contract: contract(),
      freeMargin: 10_000,
      exposureAuthoritative: true,
      marginPerUnitAccount: 10,
      sdkMinQuantity: 0.01,
      allocationCurrency: "USD",
    });
    expect(tight.ok).toBe(true);
    expect(wide.ok).toBe(true);
    if (!tight.ok || !wide.ok) return;
    expect(tight.quantity).toBeGreaterThan(wide.quantity!);
    expect(tight.estimatedStopLossRisk).toBeLessThanOrEqual(100 + 1e-8); // 25% of 400
    expect(wide.estimatedStopLossRisk).toBeLessThanOrEqual(100 + 1e-8);
    expect(tight.quantity).not.toBe(OWNER_MAX_QUANTITY);
  });

  it("BLOCKED when broker minimum exceeds risk-affordable quantity (no upsizing)", () => {
    const r = sizeOrderQuantityFromAllocation({
      verifiedEquity: 10_000,
      accountCurrency: "USD",
      strategyAllocationPercent: 10,
      remainingStrategyBudget: 100,
      individualOrderAllocation: 10, // allowed risk $2.50
      entryPrice: 2000,
      stopLoss: 1990, // 10 pts → riskPerUnit = 10 * 0.01 / 0.01 wait: (10/0.01)*0.01 = 10 per unit
      contract: contract({ quantityMin: 1, quantityStep: 1, baseUnitSize: 1 }),
      freeMargin: 9_000,
      exposureAuthoritative: true,
      marginPerUnitAccount: 50,
      sdkMinQuantity: 1,
      allocationCurrency: "USD",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toMatch(/BELOW_MIN|EXCEEDS/);
    expect(r.message).toMatch(/minimum|risk/i);
  });

  it("fails closed on missing metadata / stale-equivalent unverified contract", () => {
    const missing = sizeOrderQuantityFromAllocation({
      verifiedEquity: 10_000,
      accountCurrency: "USD",
      strategyAllocationPercent: 10,
      remainingStrategyBudget: 100,
      individualOrderAllocation: 40,
      entryPrice: 2000,
      stopLoss: 1990,
      contract: { ...contract(), verified: false },
      freeMargin: 9_000,
      exposureAuthoritative: true,
      sdkMinQuantity: 0.01,
      allocationCurrency: "USD",
    });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.code).toBe("SIZE_QTY_CONTRACT_UNVERIFIED");

    const noExposure = sizeOrderQuantityFromAllocation({
      verifiedEquity: 10_000,
      accountCurrency: "USD",
      strategyAllocationPercent: 10,
      remainingStrategyBudget: 100,
      individualOrderAllocation: 40,
      entryPrice: 2000,
      stopLoss: 1990,
      contract: contract(),
      freeMargin: 9_000,
      exposureAuthoritative: false,
      sdkMinQuantity: 0.01,
      allocationCurrency: "USD",
    });
    expect(noExposure.ok).toBe(false);
    if (!noExposure.ok) expect(noExposure.code).toBe("SIZE_QTY_EXPOSURE_UNVERIFIED");
  });

  it("respects broker max without inventing a larger size", () => {
    const r = sizeOrderQuantityFromAllocation({
      verifiedEquity: 50_000,
      accountCurrency: "USD",
      strategyAllocationPercent: 100,
      remainingStrategyBudget: 50_000,
      individualOrderAllocation: 10_000, // large risk budget
      entryPrice: 2000,
      stopLoss: 1999, // tiny stop → huge raw qty
      contract: contract(),
      freeMargin: 40_000,
      exposureAuthoritative: true,
      marginPerUnitAccount: 1,
      sdkMinQuantity: 0.01,
      brokerMaxQuantity: 0.05,
      allocationCurrency: "USD",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.quantity).toBeLessThanOrEqual(0.05 + 1e-12);
  });
});

describe("Stage 1 Part 1 — multi-order engine isolation", () => {
  it("five simultaneous engine runs keep distinct allocationIds and risk ceilings", () => {
    const allocs = [10, 20, 40, 80, 160];
    const runs = allocs.map((alloc, i) =>
      runAutomatedPerOrderRiskEngine({
        ...engineInput({ alloc, instrument: i % 2 ? "EUR/USD" : "XAU/USD" }),
        allocationId: `sim-${i}`,
      })
    );
    const ids = new Set(runs.map((r) => r.allocationId));
    expect(ids.size).toBe(5);
    for (let i = 0; i < runs.length; i++) {
      const risk = runs[i]!.perOrderRisk;
      expect(risk.capitalAllocation).toBe(allocs[i]);
      expect(risk.maximumAllowedMonetaryLoss).toBeCloseTo(allocs[i]! * 0.25, 8);
      expect(risk.plannedMonetaryRisk).toBeCloseTo(allocs[i]! * 0.25, 8);
      expect(risk.placesOrders).toBe(false);
      expect(risk.mutatesBroker).toBe(false);
      expect(risk.executionAuthorized).toBe(false);
    }
    // Order 0 unused risk does not change order 4 ceiling
    expect(runs[4]!.perOrderRisk.maximumAllowedMonetaryLoss).toBeCloseTo(40, 8);
  });

  it("ten simultaneous orders with different SL distances remain independently capped", () => {
    const runs = Array.from({ length: 10 }, (_, i) => {
      const alloc = 50 + i * 10;
      const stopDist = 5 + i; // points
      return runAutomatedPerOrderRiskEngine({
        ...engineInput({
          alloc,
          entry: 2000,
          stop: 2000 - stopDist,
          instrument: i % 3 === 0 ? "XAU/USD" : "EUR/USD",
        }),
        allocationId: `ten-${i}`,
      });
    });
    expect(runs).toHaveLength(10);
    const ceilings = runs.map((r) => r.perOrderRisk.maximumAllowedMonetaryLoss!);
    for (let i = 0; i < 10; i++) {
      expect(ceilings[i]).toBeCloseTo((50 + i * 10) * 0.25, 8);
      if (runs[i]!.perOrderRisk.actualModeledMonetaryRisk != null) {
        expect(runs[i]!.perOrderRisk.actualModeledMonetaryRisk!).toBeLessThanOrEqual(
          ceilings[i]! + 1e-6,
        );
      }
    }
  });

  it("portfolio strategy budget remains independently enforced from per-order risk", () => {
    const blocked = runAutomatedPerOrderRiskEngine({
      ...engineInput({ alloc: 300, equity: 10_000, strategyPct: 2 }), // budget=200
      pendingProposalReservations: 0,
    });
    expect(blocked.proposal.lifecycle).toBe("BLOCKED");
    expect(
      blocked.proposal.blockers.some((b) => String(b.code) === "ALLOCATION_BUDGET_EXCEEDED"),
    ).toBe(true);
    // Risk math for 300 would be 75 — but portfolio budget blocks first
    expect(computePerOrderRiskBreakdown(300).allowedRiskAmount).toBeCloseTo(75, 10);
  });
});

describe("Stage 1 Part 1 — three independent example calculations", () => {
  it("documents Order A=$10, B=$20, C=$40 dynamic size under 25% ceiling", () => {
    const examples = [
      { id: "A", alloc: 10 },
      { id: "B", alloc: 20 },
      { id: "C", alloc: 40 },
    ].map((row) => {
      const r = runAutomatedPerOrderRiskEngine({
        ...engineInput({ alloc: row.alloc }),
        allocationId: row.id,
      });
      return {
        id: row.id,
        allocation: row.alloc,
        targetRisk: r.perOrderRisk.plannedMonetaryRisk,
        hardMax: r.perOrderRisk.maximumAllowedMonetaryLoss,
        quantity: r.proposal.quantity.normalizedQuantity,
        modeledLoss: r.perOrderRisk.actualModeledMonetaryRisk,
        lifecycle: r.proposal.lifecycle,
      };
    });
    expect(examples[0]).toMatchObject({ allocation: 10, targetRisk: 2.5, hardMax: 2.5 });
    expect(examples[1]).toMatchObject({ allocation: 20, targetRisk: 5, hardMax: 5 });
    expect(examples[2]).toMatchObject({ allocation: 40, targetRisk: 10, hardMax: 10 });
    for (const ex of examples) {
      if (ex.modeledLoss != null) {
        expect(ex.modeledLoss).toBeLessThanOrEqual(ex.hardMax! + 1e-8);
      }
    }
  });
});
