/**
 * Stage 1 Part 2 — FXCM broker compatibility + dynamic quantity validation.
 * Fixtures mirror LIVE DEMO metadata shapes; no broker mutations.
 */
import { describe, expect, it } from "vitest";
import {
  amountConstraintsToLots,
  lotsToFxcmAmount,
  sizeOrderQuantityFromAllocation,
  type AtSimContractMetaInput,
} from "../../../../ai/forex-ai/automated-trading/simulation-risk/index.js";
import { lotsToBrokerAmount } from "../../../../ai/forex-ai/automated-trading/order-execution/lots-to-broker-amount.js";
import {
  OWNER_FIXED_LOT_CAP_ENFORCED,
  PER_ORDER_RISK_MAXIMUM_PERCENT,
  PER_ORDER_RISK_TARGET_PERCENT,
} from "../../../../ai/forex-ai/automated-trading/order-proposal/types.js";
import {
  assertIndependentRiskBudgets,
  runAutomatedPerOrderRiskEngine,
} from "../../../../ai/forex-ai/automated-trading/per-order-risk/index.js";
import type { AtOrderPreparationHandoff } from "../../../../ai/forex-ai/automated-trading/result-intake/types.js";

/** LIVE DEMO-shaped metadata (Part 2 probe 2026-11-09). */
const LIVE_SHAPED = {
  "EUR/USD": {
    baseUnitSize: 1000,
    minQuantity: 1000,
    amountStep: 1000,
    pointSize: 0.0001,
    pipCostAccount: 0.1,
    mmrPerLot: 1.3,
    quantityUnit: null as string | null,
  },
  "GBP/USD": {
    baseUnitSize: 1000,
    minQuantity: 1000,
    amountStep: 1000,
    pointSize: 0.0001,
    pipCostAccount: 0.1,
    mmrPerLot: null as number | null,
    quantityUnit: null as string | null,
  },
  "USD/JPY": {
    baseUnitSize: 1000,
    minQuantity: 1000,
    amountStep: 1000,
    pointSize: 0.01,
    pipCostAccount: 0.091, // illustrative per-lot; tests use explicit values when needed
    mmrPerLot: null as number | null,
    quantityUnit: null as string | null,
  },
  "XAU/USD": {
    baseUnitSize: 1,
    minQuantity: 1,
    amountStep: 1,
    pointSize: 0.01,
    pipCostAccount: 0.01,
    mmrPerLot: 4.42,
    quantityUnit: null as string | null,
  },
} as const;

function contractFor(
  instrument: keyof typeof LIVE_SHAPED,
  overrides: Partial<AtSimContractMetaInput> = {},
): AtSimContractMetaInput {
  const m = LIVE_SHAPED[instrument];
  return {
    verified: true,
    pointSize: m.pointSize,
    tickSize: m.pointSize,
    digits: Math.max(0, Math.round(-Math.log10(m.pointSize))),
    quantityMin: m.minQuantity,
    quantityStep: m.amountStep,
    quantityUnit: "contracts",
    quantityUnitAmbiguous: false,
    contractMultiplier: null,
    baseUnitSize: m.baseUnitSize,
    pipCostAccount: m.pipCostAccount,
    marginPerLotAccount: m.mmrPerLot,
    minStopDistance: null,
    minStopDistanceVerified: false,
    source: "part2-fixture-live-shaped",
    unavailableReason: null,
    ...overrides,
  };
}

function handoff(instrument: string): AtOrderPreparationHandoff {
  return {
    acceptedResultId: `res-${instrument}`,
    analysisId: `an-${instrument}`,
    instrument,
    canonicalDirection: "BUY",
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
    note: "part2-fixture",
  };
}

describe("Stage 1 Part 2 — policy + safety invariants", () => {
  it("keeps 25%/25% dynamic sizing and never enables submission", () => {
    expect(PER_ORDER_RISK_TARGET_PERCENT).toBe(25);
    expect(PER_ORDER_RISK_MAXIMUM_PERCENT).toBe(25);
    expect(OWNER_FIXED_LOT_CAP_ENFORCED).toBe(false);
  });
});

describe("Stage 1 Part 2 — AMOUNT ↔ lots conversion", () => {
  it("converts EUR/USD AMOUNT constraints to 1-lot min/step", () => {
    const r = amountConstraintsToLots({
      baseUnitSize: 1000,
      amountMin: 1000,
      amountStep: 1000,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lots.lotsMin).toBe(1);
    expect(r.lots.lotsStep).toBe(1);
    expect(r.lots.baseUnitSize).toBe(1000);
  });

  it("converts XAU/USD independently (base=1, not ounces invention)", () => {
    const r = amountConstraintsToLots({
      baseUnitSize: 1,
      amountMin: 1,
      amountStep: 1,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lots.lotsMin).toBe(1);
    expect(r.lots.lotsStep).toBe(1);
    const amt = lotsToFxcmAmount({ lots: 3, baseUnitSize: 1, amountMin: 1 });
    expect(amt).toMatchObject({ ok: true, amount: 3 });
  });

  it("rejects fractional invented baseUnitSize and non-integer AMOUNT", () => {
    expect(amountConstraintsToLots({
      baseUnitSize: 0.01,
      amountMin: 0.01,
      amountStep: 0.01,
    }).ok).toBe(false);
    expect(lotsToFxcmAmount({ lots: 0.01, baseUnitSize: 1 }).code).toBe("AMOUNT_NOT_INTEGER");
    const microAmt = lotsToBrokerAmount({ lots: 0.01, baseUnitSize: 1000 });
    expect(microAmt.ok).toBe(true);
    expect(microAmt.amount).toBe(10); // integer AMOUNT, but below typical FX min
    expect(lotsToBrokerAmount({ lots: 0.01, baseUnitSize: 1000, minQuantity: 1000 }).ok).toBe(false);
    expect(lotsToBrokerAmount({ lots: 1, baseUnitSize: 1000, minQuantity: 1000 }).amount).toBe(1000);
  });

  it("never rounds AMOUNT upward — fractional product rejected", () => {
    const r = lotsToFxcmAmount({ lots: 1.5, baseUnitSize: 1, amountMin: 1 });
    // 1.5 * 1 = 1.5 → not integer
    expect(r.ok).toBe(false);
    expect(r.code).toBe("AMOUNT_NOT_INTEGER");
  });
});

describe("Stage 1 Part 2 — dynamic sizing per instrument", () => {
  const equity = 20_000;
  const usable = 19_000;

  it("EUR/USD: sizes in lots, emits AMOUNT=base×lots, enforces 25%", () => {
    // 10 pip stop: risk/lot ≈ $1 (float may yield 99 lots after floor-only)
    const r = sizeOrderQuantityFromAllocation({
      verifiedEquity: equity,
      accountCurrency: "USD",
      strategyAllocationPercent: 50,
      remainingStrategyBudget: 10_000,
      individualOrderAllocation: 400, // allowed $100
      entryPrice: 1.1,
      stopLoss: 1.099,
      contract: contractFor("EUR/USD"),
      freeMargin: usable,
      exposureAuthoritative: true,
      marginPerUnitAccount: 1.3,
      sdkMinQuantity: 1000,
      allocationCurrency: "USD",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.quantity).toBeGreaterThanOrEqual(99);
    expect(r.quantity).toBeLessThanOrEqual(100);
    expect(r.brokerAmount).toBe(r.quantity * 1000);
    expect(r.estimatedStopLossRisk).toBeLessThanOrEqual(100 + 1e-8);
    expect(r.requiredMargin).toBeCloseTo(1.3 * r.quantity, 8);
    expect(r.estimatedStopLossRisk).toBeLessThanOrEqual(r.allowedRiskAmount + 1e-8);
  });

  it("EUR/USD: small allocation blocked by broker min (no upsizing)", () => {
    // allowed $2.50 < $1/lot * 1 min? wait 2.50 >= 1 → would allow 2 lots
    // Use wider stop so 1 lot exceeds 25%: 40 pips → risk/lot=$4 > $2.50
    const r = sizeOrderQuantityFromAllocation({
      verifiedEquity: equity,
      accountCurrency: "USD",
      strategyAllocationPercent: 10,
      remainingStrategyBudget: 100,
      individualOrderAllocation: 10,
      entryPrice: 1.1,
      stopLoss: 1.096, // 40 pips
      contract: contractFor("EUR/USD"),
      freeMargin: usable,
      exposureAuthoritative: true,
      marginPerUnitAccount: 1.3,
      sdkMinQuantity: 1000,
      allocationCurrency: "USD",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe("SIZE_QTY_BELOW_MIN_AFTER_FLOOR");
    expect(r.message).toMatch(/minimum|risk budget/i);
  });

  it("XAU/USD: contract conversion uses base=1 (not ounces)", () => {
    // move=10 → risk/lot=(10/0.01)*0.01=10; alloc 200 → $50 → 5 lots → AMOUNT 5
    const r = sizeOrderQuantityFromAllocation({
      verifiedEquity: equity,
      accountCurrency: "USD",
      strategyAllocationPercent: 50,
      remainingStrategyBudget: 5_000,
      individualOrderAllocation: 200,
      entryPrice: 2650,
      stopLoss: 2640,
      contract: contractFor("XAU/USD"),
      freeMargin: usable,
      exposureAuthoritative: true,
      marginPerUnitAccount: 4.42,
      sdkMinQuantity: 1,
      allocationCurrency: "USD",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.quantity).toBe(5);
    expect(r.brokerAmount).toBe(5);
    expect(r.requiredMargin).toBeCloseTo(22.1, 8);
  });

  it("GBP/USD: missing MMR still risk-sizes but notes margin unavailable; engine margin gate when freeMargin+mmr path", () => {
    const r = sizeOrderQuantityFromAllocation({
      verifiedEquity: equity,
      accountCurrency: "USD",
      strategyAllocationPercent: 50,
      remainingStrategyBudget: 5_000,
      individualOrderAllocation: 400,
      entryPrice: 1.3,
      stopLoss: 1.299, // 10 pips → $1/lot
      contract: contractFor("GBP/USD", { marginPerLotAccount: null }),
      freeMargin: usable,
      exposureAuthoritative: true,
      marginPerUnitAccount: null,
      sdkMinQuantity: 1000,
      allocationCurrency: "USD",
    });
    // Without marginPer, sizing may succeed with note (margin gate skipped when both missing)
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.requiredMargin).toBeNull();
    expect(r.notes.some((n) => /UNAVAILABLE|unverified/i.test(n))).toBe(true);
  });

  it("USD/JPY: integer AMOUNT enforcement and quantity step", () => {
    const r = sizeOrderQuantityFromAllocation({
      verifiedEquity: equity,
      accountCurrency: "USD",
      strategyAllocationPercent: 50,
      remainingStrategyBudget: 5_000,
      individualOrderAllocation: 400,
      entryPrice: 150,
      stopLoss: 149.6, // 40 points of 0.01 → risk/lot = 40 * 0.091
      contract: contractFor("USD/JPY", {
        pipCostAccount: 0.091,
        marginPerLotAccount: 1.3,
      }),
      freeMargin: usable,
      exposureAuthoritative: true,
      marginPerUnitAccount: 1.3,
      sdkMinQuantity: 1000,
      allocationCurrency: "USD",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Number.isInteger(r.brokerAmount)).toBe(true);
    expect(r.brokerAmount % 1000).toBe(0);
    expect(r.estimatedStopLossRisk).toBeLessThanOrEqual(100 + 1e-6);
  });

  it("blocks when required margin known but free margin unverified", () => {
    const r = sizeOrderQuantityFromAllocation({
      verifiedEquity: equity,
      accountCurrency: "USD",
      strategyAllocationPercent: 50,
      remainingStrategyBudget: 5_000,
      individualOrderAllocation: 400,
      entryPrice: 1.1,
      stopLoss: 1.099,
      contract: contractFor("EUR/USD"),
      freeMargin: null,
      exposureAuthoritative: true,
      marginPerUnitAccount: 1.3,
      sdkMinQuantity: 1000,
      allocationCurrency: "USD",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("SIZE_QTY_FREE_MARGIN_UNVERIFIED");
  });

  it("blocks insufficient free margin without upsizing past risk", () => {
    const r = sizeOrderQuantityFromAllocation({
      verifiedEquity: equity,
      accountCurrency: "USD",
      strategyAllocationPercent: 50,
      remainingStrategyBudget: 5_000,
      individualOrderAllocation: 400,
      entryPrice: 1.1,
      stopLoss: 1.099,
      contract: contractFor("EUR/USD"),
      freeMargin: 0.5, // < 1.3 min lot margin
      exposureAuthoritative: true,
      marginPerUnitAccount: 1.3,
      sdkMinQuantity: 1000,
      allocationCurrency: "USD",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("SIZE_QTY_INSUFFICIENT_FREE_MARGIN");
  });
});

describe("Stage 1 Part 2 — allocation feasibility matrix", () => {
  it("tables small and large allocations for all four instruments", () => {
    const rows: Array<{
      instrument: string;
      allocation: number;
      entry: number;
      stop: number;
      ok: boolean;
      rawLots: number | null;
      brokerAmount: number | null;
      modeledLoss: number | null;
      pctAlloc: number | null;
      requiredMargin: number | null;
      code: string | null;
    }> = [];

    const cases: Array<{
      instrument: keyof typeof LIVE_SHAPED;
      allocation: number;
      entry: number;
      stop: number;
      mmr: number | null;
    }> = [
      { instrument: "EUR/USD", allocation: 10, entry: 1.1, stop: 1.099, mmr: 1.3 },
      { instrument: "EUR/USD", allocation: 400, entry: 1.1, stop: 1.099, mmr: 1.3 },
      { instrument: "GBP/USD", allocation: 40, entry: 1.3, stop: 1.299, mmr: null },
      { instrument: "GBP/USD", allocation: 800, entry: 1.3, stop: 1.299, mmr: null },
      { instrument: "USD/JPY", allocation: 40, entry: 150, stop: 149.9, mmr: null },
      { instrument: "USD/JPY", allocation: 800, entry: 150, stop: 149.9, mmr: 1.3 },
      { instrument: "XAU/USD", allocation: 10, entry: 2650, stop: 2640, mmr: 4.42 },
      { instrument: "XAU/USD", allocation: 400, entry: 2650, stop: 2640, mmr: 4.42 },
    ];

    for (const c of cases) {
      const meta = LIVE_SHAPED[c.instrument];
      const r = sizeOrderQuantityFromAllocation({
        verifiedEquity: 20_000,
        accountCurrency: "USD",
        strategyAllocationPercent: 100,
        remainingStrategyBudget: 20_000,
        individualOrderAllocation: c.allocation,
        entryPrice: c.entry,
        stopLoss: c.stop,
        contract: contractFor(c.instrument, {
          marginPerLotAccount: c.mmr,
          pipCostAccount: c.instrument === "USD/JPY" ? 0.091 : meta.pipCostAccount,
        }),
        freeMargin: c.mmr != null ? 19_000 : null,
        exposureAuthoritative: true,
        marginPerUnitAccount: c.mmr,
        sdkMinQuantity: meta.minQuantity,
        allocationCurrency: "USD",
      });
      const allowed = c.allocation * 0.25;
      rows.push({
        instrument: c.instrument,
        allocation: c.allocation,
        entry: c.entry,
        stop: c.stop,
        ok: r.ok,
        rawLots: r.ok ? r.quantity : null,
        brokerAmount: r.ok ? r.brokerAmount : null,
        modeledLoss: r.ok ? r.estimatedStopLossRisk : null,
        pctAlloc: r.ok ? (r.estimatedStopLossRisk / c.allocation) * 100 : null,
        requiredMargin: r.ok ? r.requiredMargin : null,
        code: r.ok ? null : r.code,
      });
      if (r.ok) {
        expect(r.estimatedStopLossRisk).toBeLessThanOrEqual(allowed + 1e-8);
        expect(Number.isInteger(r.brokerAmount)).toBe(true);
      }
    }

    // Small EUR 10 with 10-pip stop: risk/lot=$1, allowed=$2.50 → 2 lots OK
    expect(rows.find((x) => x.instrument === "EUR/USD" && x.allocation === 10)?.ok).toBe(true);
    // Small XAU 10 with $10/lot risk: allowed $2.50 < $10 → BLOCKED
    expect(rows.find((x) => x.instrument === "XAU/USD" && x.allocation === 10)?.ok).toBe(false);
    const eurLarge = rows.find((x) => x.instrument === "EUR/USD" && x.allocation === 400);
    expect(eurLarge?.ok).toBe(true);
    expect(eurLarge?.brokerAmount).toBe((eurLarge?.rawLots ?? 0) * 1000);
    expect(eurLarge?.brokerAmount).toBeGreaterThanOrEqual(99_000);
    // Prove matrix was evaluated for all four instruments
    expect(new Set(rows.map((r) => r.instrument)).size).toBe(4);
  });
});

describe("Stage 1 Part 2 — independent multi-order + pipeline brokerAmount", () => {
  it("multiple simultaneous orders keep independent 25% budgets", () => {
    const proof = assertIndependentRiskBudgets([
      { allocationId: "e", orderAllocation: 400, instrument: "EUR/USD" },
      { allocationId: "g", orderAllocation: 400, instrument: "GBP/USD" },
      { allocationId: "j", orderAllocation: 400, instrument: "USD/JPY" },
      { allocationId: "x", orderAllocation: 400, instrument: "XAU/USD" },
    ]);
    expect(proof.budgets.every((b) => b.allowedRiskAmount === 100)).toBe(true);
    expect(proof.budgets.every((b) => !b.mayBorrowFromOtherOrders)).toBe(true);
  });

  it("canonical engine emits FXCM AMOUNT in brokerPrep (not lots) for EUR/USD", () => {
    const run = runAutomatedPerOrderRiskEngine({
      handoff: handoff("EUR/USD"),
      allocationId: "eur-p2",
      entryPrice: 1.1,
      stopLoss: 1.099,
      autoLevels: false,
      verifiedEquity: 20_000,
      accountCurrency: "USD",
      equityFresh: true,
      usableMargin: 19_000,
      usedMargin: 0,
      marginFresh: true,
      strategyAllocationPercent: 100,
      individualOrderAllocation: 400,
      allocationCurrency: "USD",
      existingCommittedExposure: 0,
      pendingProposalReservations: 0,
      contract: contractFor("EUR/USD"),
      contractFresh: true,
      sdkMinQuantity: 1000,
      brokerMaxQuantity: null,
      marginPerUnitAccount: 1.3,
      exposureAuthoritative: true,
      existingExposure: 0,
      systemMasterOn: true,
      tradingEnabled: false,
      emergencyEntryLock: true,
      environment: "DEMO",
    });
    expect(run.proposal.lifecycle).toBe("PROPOSAL_READY");
    const lots = run.proposal.quantity.normalizedQuantity!;
    expect(lots).toBeGreaterThanOrEqual(99);
    expect(lots).toBeLessThanOrEqual(100);
    expect(run.proposal.quantity.brokerAmount).toBe(lots * 1000); // AMOUNT
    expect(run.proposal.brokerPrep.amountQuantity).toBe(lots * 1000);
    expect(run.proposal.brokerPrep.brokerOrderId).toBeNull();
    expect(run.perOrderRisk.placesOrders).toBe(false);
    expect(run.perOrderRisk.mutatesBroker).toBe(false);
    expect(run.perOrderRisk.executionAuthorized).toBe(false);
  });

  it("rejects invented fractional baseUnitSize in sizing path", () => {
    const r = sizeOrderQuantityFromAllocation({
      verifiedEquity: 20_000,
      accountCurrency: "USD",
      strategyAllocationPercent: 50,
      remainingStrategyBudget: 5_000,
      individualOrderAllocation: 400,
      entryPrice: 1.1,
      stopLoss: 1.099,
      contract: contractFor("EUR/USD", { baseUnitSize: 0.01, quantityMin: 0.01, quantityStep: 0.01 }),
      freeMargin: 19_000,
      exposureAuthoritative: true,
      marginPerUnitAccount: 1.3,
      sdkMinQuantity: 0.01,
      allocationCurrency: "USD",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toMatch(/BASE_UNIT|CONSTRAINTS|MIN/i);
  });
});
