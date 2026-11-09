/**
 * Stage 5 — Automated Per-Order Risk Management Engine tests.
 * Deterministic fixtures only — no broker submission.
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PER_ORDER_RISK_PERCENT,
  MAX_PER_ORDER_LOSS_PERCENT,
  MINIMUM_REWARD_TO_RISK_RATIO,
  MODELED_VS_REALIZED_NOTE,
  deriveAutomaticOrderLevels,
  proposeStopFromVerifiedAtr,
  runAutomatedPerOrderRiskEngine,
  validateMonetaryRewardToRisk,
  buildPerOrderRiskRecord,
  resolveDisplayCategory,
} from "../../../../ai/forex-ai/automated-trading/per-order-risk/index.js";
import {
  OWNER_MAX_QUANTITY,
  PER_ORDER_RISK_MAXIMUM_PERCENT,
  PER_ORDER_RISK_TARGET_PERCENT,
  type AtOrderProposalRecord,
} from "../../../../ai/forex-ai/automated-trading/order-proposal/index.js";
import {
  computePerOrderRiskBreakdown,
  evaluatePerOrderLossLimit,
} from "../../../../ai/forex-ai/automated-trading/simulation-risk/capital-budget.js";
import type { AtSimContractMetaInput } from "../../../../ai/forex-ai/automated-trading/simulation-risk/types.js";
import type { AtOrderPreparationHandoff } from "../../../../ai/forex-ai/automated-trading/result-intake/types.js";

function handoff(dir: "BUY" | "SELL", overrides: Partial<AtOrderPreparationHandoff> = {}): AtOrderPreparationHandoff {
  return {
    acceptedResultId: "res-s5-1",
    analysisId: "an-s5-1",
    instrument: "EUR/USD",
    canonicalDirection: dir,
    directionalConfidencePct: 70,
    confidenceType: "ANALYSIS_CONFIDENCE",
    isCalibratedWinProbability: false,
    observationId: "obs-1",
    imageId: "img-1",
    imageHash: "hash-1",
    analyzedAtUtc: new Date().toISOString(),
    resultExpiresAtUtc: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
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
    note: "test",
    ...overrides,
  };
}

function eurUsdContract(overrides: Partial<AtSimContractMetaInput> = {}): AtSimContractMetaInput {
  return {
    verified: true,
    pointSize: 0.00001,
    tickSize: 0.00001,
    digits: 5,
    quantityMin: 0.01,
    quantityStep: 0.01,
    quantityUnit: "contracts",
    quantityUnitAmbiguous: false,
    contractMultiplier: 100_000,
    baseUnitSize: 100_000,
    // $1 per pip per 0.01 lot ≈ pipCost for 1 contract at 0.0001 pip? Use POINT_COST:
    // riskPerUnit = (move / pointSize) * pipCostAccount
    // For move=0.0010 (10 pips), want riskPerUnit such that 0.01 lots ≈ small $ risk.
    pipCostAccount: 0.00001, // (0.001/0.00001)*0.00001 = 1.0 per unit → 0.01 qty = $0.01 risk at 10 pips... scale up
    marginPerLotAccount: 50,
    minStopDistance: null,
    minStopDistanceVerified: false,
    source: "test-eurusd",
    unavailableReason: null,
    ...overrides,
  };
}

/** Contract tuned so 0.01 qty with 10-pip SL stays under 20% of small allocations. */
function fineContract(overrides: Partial<AtSimContractMetaInput> = {}): AtSimContractMetaInput {
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
    marginPerLotAccount: 50,
    minStopDistance: null,
    minStopDistanceVerified: false,
    source: "test",
    unavailableReason: null,
    ...overrides,
  };
}

function xauContract(overrides: Partial<AtSimContractMetaInput> = {}): AtSimContractMetaInput {
  return fineContract({
    pointSize: 0.01,
    tickSize: 0.01,
    digits: 2,
    quantityUnit: "contracts",
    baseUnitSize: 1,
    contractMultiplier: 1,
    pipCostAccount: 0.01,
    source: "test-xau",
    ...overrides,
  });
}

function baseInput(dir: "BUY" | "SELL", alloc = 100) {
  const entry = 2000;
  const stop = dir === "BUY" ? 1990 : 2010;
  return {
    handoff: handoff(dir, { instrument: "XAU/USD" }),
    entryPrice: entry,
    stopLoss: stop,
    autoLevels: false as const,
    verifiedEquity: 10_000,
    accountCurrency: "USD",
    equityFresh: true,
    usableMargin: 8_000,
    usedMargin: 500,
    marginFresh: true,
    strategyAllocationPercent: 50,
    individualOrderAllocation: alloc,
    allocationCurrency: "USD",
    existingCommittedExposure: 0,
    pendingProposalReservations: 0,
    contract: fineContract(),
    contractFresh: true,
    sdkMinQuantity: 0.01,
    marginPerUnitAccount: 50,
    exposureAuthoritative: true,
    existingExposure: 0,
    systemMasterOn: true,
    tradingEnabled: false,
    emergencyEntryLock: true,
    environment: "DEMO" as const,
  };
}

describe("Stage 5 — operating risk defaults (verified existing)", () => {
  it("preserves 25% operating target and 25% hard maximum (v3)", () => {
    expect(DEFAULT_PER_ORDER_RISK_PERCENT).toBe(25);
    expect(MAX_PER_ORDER_LOSS_PERCENT).toBe(25);
    expect(PER_ORDER_RISK_TARGET_PERCENT).toBe(25);
    expect(PER_ORDER_RISK_MAXIMUM_PERCENT).toBe(25);
    expect(MINIMUM_REWARD_TO_RISK_RATIO).toBe(3);
    expect(OWNER_MAX_QUANTITY).toBe(0.01); // legacy reference only
  });

  it("documents modeled vs realized distinction", () => {
    expect(MODELED_VS_REALIZED_NOTE).toMatch(/NOT a guaranteed maximum realized loss/i);
  });
});

describe("Stage 5 — capital allocation independence", () => {
  it("allocates $10 / $20 / $40 independently with distinct risk budgets", () => {
    const a = runAutomatedPerOrderRiskEngine(baseInput("BUY", 10));
    const b = runAutomatedPerOrderRiskEngine(baseInput("BUY", 20));
    const c = runAutomatedPerOrderRiskEngine(baseInput("BUY", 40));
    expect(a.allocationId).not.toBe(b.allocationId);
    expect(b.allocationId).not.toBe(c.allocationId);
    expect(a.perOrderRisk.capitalAllocation).toBe(10);
    expect(b.perOrderRisk.capitalAllocation).toBe(20);
    expect(c.perOrderRisk.capitalAllocation).toBe(40);
    expect(a.perOrderRisk.maximumAllowedMonetaryLoss).toBeCloseTo(2.5, 8);
    expect(b.perOrderRisk.maximumAllowedMonetaryLoss).toBeCloseTo(5, 8);
    expect(c.perOrderRisk.maximumAllowedMonetaryLoss).toBeCloseTo(10, 8);
    // v3: target == hard max == 25% of allocation
    expect(a.perOrderRisk.plannedMonetaryRisk).toBeCloseTo(2.5, 8);
    expect(b.perOrderRisk.plannedMonetaryRisk).toBeCloseTo(5, 8);
    expect(c.perOrderRisk.plannedMonetaryRisk).toBeCloseTo(10, 8);
  });

  it("rejects zero / negative / missing allocation", () => {
    for (const alloc of [0, -5, null]) {
      const r = runAutomatedPerOrderRiskEngine({
        ...baseInput("BUY", 10),
        individualOrderAllocation: alloc as number | null,
      });
      expect(r.proposal.lifecycle).toBe("BLOCKED");
      expect(r.proposal.blockers.some((b) =>
        String(b.code).includes("ALLOCATION") || String(b.code) === "ORDER_ALLOCATION_UNAVAILABLE"
      )).toBe(true);
    }
  });

  it("rejects over-allocation beyond remaining strategy budget", () => {
    const r = runAutomatedPerOrderRiskEngine({
      ...baseInput("BUY", 500),
      strategyAllocationPercent: 1, // budget = 100
      pendingProposalReservations: 80,
    });
    expect(r.proposal.lifecycle).toBe("BLOCKED");
    expect(r.proposal.blockers.some((b) => String(b.code) === "ALLOCATION_BUDGET_EXCEEDED")).toBe(true);
  });

  it("rejects stale account equity", () => {
    const r = runAutomatedPerOrderRiskEngine({
      ...baseInput("BUY", 100),
      equityFresh: false,
    });
    expect(r.proposal.lifecycle).toBe("BLOCKED");
    expect(r.proposal.blockers.some((b) => String(b.code) === "STALE_ACCOUNT_EQUITY")).toBe(true);
  });
});

describe("Stage 5 — maximum risk 25%/25%", () => {
  it("computes exact 25% operating and 25% hard max for allocation examples", () => {
    for (const alloc of [10, 20, 40, 100, 200]) {
      const bd = computePerOrderRiskBreakdown(alloc);
      expect(bd.riskTargetAmount).toBeCloseTo(alloc * 0.25, 10);
      expect(bd.maximumPermittedOrderLoss).toBeCloseTo(alloc * 0.25, 10);
      expect(bd.allowedRiskAmount).toBeCloseTo(alloc * 0.25, 10);
    }
  });

  it("evaluatePerOrderLossLimit fails above 25%", () => {
    const fail = evaluatePerOrderLossLimit({
      perOrderAllocation: 100,
      estimatedStopLossRisk: 26,
    });
    expect(fail.pass).toBe(false);
    expect(fail.code).toBe("PER_ORDER_LOSS_LIMIT_EXCEEDED");
    const atCeiling = evaluatePerOrderLossLimit({
      perOrderAllocation: 100,
      estimatedStopLossRisk: 25,
    });
    // v3: 25 equals both target and hard max → pass
    expect(atCeiling.pass).toBe(true);
    const withinTarget = evaluatePerOrderLossLimit({
      perOrderAllocation: 100,
      estimatedStopLossRisk: 20,
    });
    expect(withinTarget.pass).toBe(true);
  });
});

describe("Stage 5 — automatic Stop Loss", () => {
  it("BUY: structure support below entry", () => {
    const r = deriveAutomaticOrderLevels({
      direction: "BUY",
      bid: 1.1,
      ask: 1.1002,
      mid: 1.1001,
      quoteFresh: true,
      supportLevels: [{ price: 1.095 }],
      resistanceLevels: [{ price: 1.11 }],
      digits: 5,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.entryPrice).toBe(1.1002);
      expect(r.stopLoss).toBe(1.095);
      expect(r.stopLoss).toBeLessThan(r.entryPrice);
      expect(r.takeProfit).toBeGreaterThan(r.entryPrice);
      expect(r.structureUsed).toBe(true);
    }
  });

  it("SELL: structure resistance above entry", () => {
    const r = deriveAutomaticOrderLevels({
      direction: "SELL",
      bid: 1.1,
      ask: 1.1002,
      mid: 1.1001,
      quoteFresh: true,
      supportLevels: [{ price: 1.09 }],
      resistanceLevels: [{ price: 1.105 }],
      digits: 5,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.entryPrice).toBe(1.1);
      expect(r.stopLoss).toBe(1.105);
      expect(r.stopLoss).toBeGreaterThan(r.entryPrice);
      expect(r.takeProfit).toBeLessThan(r.entryPrice);
    }
  });

  it("rejects BUY SL above entry and missing SL", () => {
    const atr = proposeStopFromVerifiedAtr({
      direction: "BUY",
      entryPrice: 100,
      atrValue: null,
    });
    expect(atr.ok).toBe(false);
    if (!atr.ok) expect(atr.code).toBe("WAITING_FOR_VALID_STOP_LOSS");

    const bad = deriveAutomaticOrderLevels({
      direction: "BUY",
      bid: 1.1,
      ask: 1.1,
      mid: 1.1,
      quoteFresh: true,
      supportLevels: [],
      resistanceLevels: [],
      atrValue: null,
      digits: 5,
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.waitingForValidStopLoss).toBe(true);
  });

  it("ATR fallback when structure missing but ATR verified", () => {
    const r = deriveAutomaticOrderLevels({
      direction: "BUY",
      bid: 2000,
      ask: 2000.5,
      mid: 2000.25,
      quoteFresh: true,
      supportLevels: [],
      resistanceLevels: [],
      atrValue: 5,
      atrMethod: "SMA_OF_TR",
      digits: 2,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.stopLoss).toBeLessThan(r.entryPrice);
      expect(r.stopLossSource).toMatch(/atr/i);
      expect(r.structureUsed).toBe(false);
    }
  });

  it("engine blocks when auto levels cannot find SL", () => {
    const r = runAutomatedPerOrderRiskEngine({
      ...baseInput("BUY", 100),
      entryPrice: null,
      stopLoss: null,
      autoLevels: true,
      bid: 2000,
      ask: 2000.5,
      mid: 2000.25,
      quoteFresh: true,
      supportLevels: [],
      resistanceLevels: [],
      atrValue: null,
      contract: fineContract(),
    });
    expect(r.proposal.lifecycle).toBe("BLOCKED");
    expect(
      r.proposal.blockers.some((b) =>
        String(b.code) === "WAITING_FOR_VALID_STOP_LOSS"
        || String(b.code) === "INVALID_STOP_LOSS"
      ),
    ).toBe(true);
  });
});

describe("Stage 5 — position sizing + dynamic risk budget (v3)", () => {
  it("sizes within per-order 25% risk budget without forced 0.01 lot cap", () => {
    const r = runAutomatedPerOrderRiskEngine(baseInput("BUY", 500));
    expect(r.proposal.placesOrders).toBe(false);
    expect(r.proposal.acceptsForExecution).toBe(false);
    expect(r.proposal.mutatesBroker).toBe(false);
    if (r.proposal.lifecycle === "PROPOSAL_READY") {
      expect(r.proposal.quantity.normalizedQuantity!).toBeGreaterThan(0);
      expect(r.perOrderRisk.actualModeledMonetaryRisk!).toBeLessThanOrEqual(
        r.perOrderRisk.maximumAllowedMonetaryLoss! + 1e-8,
      );
      expect(r.perOrderRisk.actualModeledMonetaryRisk!).toBeLessThanOrEqual(
        r.perOrderRisk.plannedMonetaryRisk! + 1e-8,
      );
      expect(r.perOrderRisk.operatingRiskPercent).toBe(25);
      expect(r.perOrderRisk.hardMaximumRiskPercent).toBe(25);
    }
  });

  it("rejects unverified contract", () => {
    const r = runAutomatedPerOrderRiskEngine({
      ...baseInput("BUY", 100),
      contract: { ...fineContract(), verified: false },
    });
    expect(r.proposal.lifecycle).toBe("BLOCKED");
    expect(r.proposal.blockers.some((b) => String(b.code) === "MISSING_INSTRUMENT_SPEC")).toBe(true);
  });

  it("EUR/USD / GBP/USD / USD/JPY / XAU contracts do not share assumed identical sizing", () => {
    const instruments: Array<{ name: string; contract: AtSimContractMetaInput; entry: number; sl: number }> = [
      { name: "EUR/USD", contract: eurUsdContract({ pipCostAccount: 1 }), entry: 1.1, sl: 1.099 },
      { name: "GBP/USD", contract: eurUsdContract({ pipCostAccount: 1, source: "test-gbpusd" }), entry: 1.25, sl: 1.249 },
      { name: "USD/JPY", contract: eurUsdContract({ pointSize: 0.001, tickSize: 0.001, digits: 3, pipCostAccount: 1 }), entry: 150, sl: 149.9 },
      { name: "XAU/USD", contract: xauContract(), entry: 2000, sl: 1990 },
    ];
    for (const row of instruments) {
      const r = runAutomatedPerOrderRiskEngine({
        ...baseInput("BUY", 200),
        handoff: handoff("BUY", { instrument: row.name }),
        entryPrice: row.entry,
        stopLoss: row.sl,
        contract: row.contract,
        instrument: row.name,
      });
      // May be READY or BLOCKED depending on risk/min — never invents contract.
      expect(r.perOrderRisk.instrument).toBe(row.name);
      expect(r.proposal.mutatesBroker).toBe(false);
      if (r.proposal.lifecycle === "PROPOSAL_READY" && r.perOrderRisk.actualModeledMonetaryRisk != null) {
        expect(r.perOrderRisk.actualModeledMonetaryRisk).toBeLessThanOrEqual(
          (r.perOrderRisk.maximumAllowedMonetaryLoss ?? Infinity) + 1e-8,
        );
      }
    }
  });

  it("broker minimum exceeding risk budget blocks", () => {
    const r = runAutomatedPerOrderRiskEngine({
      ...baseInput("BUY", 10),
      contract: fineContract({ quantityMin: 1, quantityStep: 1, baseUnitSize: 1 }),
      sdkMinQuantity: 1,
    });
    expect(r.proposal.lifecycle).toBe("BLOCKED");
  });
});

describe("Stage 5 — Take Profit monetary 3R", () => {
  it("validates exactly 3R monetary reward", () => {
    const v = validateMonetaryRewardToRisk({
      direction: "BUY",
      entryPrice: 2000,
      stopLoss: 1990,
      takeProfit: 2030,
      quantity: 0.01,
      contract: fineContract(),
    });
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.actualRewardToRiskRatio).toBeGreaterThanOrEqual(3 - 1e-9);
      expect(v.expectedMonetaryProfit).toBeCloseTo(v.modeledStopLossRisk * 3, 8);
    }
  });

  it("rejects monetary R:R below 3", () => {
    const v = validateMonetaryRewardToRisk({
      direction: "BUY",
      entryPrice: 2000,
      stopLoss: 1990,
      takeProfit: 2015, // 1.5R price distance
      quantity: 0.01,
      contract: fineContract(),
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.code).toBe("TAKE_PROFIT_BELOW_3R");
  });

  it("SELL TP below entry with ≥3R", () => {
    const v = validateMonetaryRewardToRisk({
      direction: "SELL",
      entryPrice: 2000,
      stopLoss: 2010,
      takeProfit: 1970,
      quantity: 0.01,
      contract: fineContract(),
    });
    expect(v.ok).toBe(true);
  });

  it("rejects invalid TP geometry", () => {
    const buyBad = validateMonetaryRewardToRisk({
      direction: "BUY",
      entryPrice: 2000,
      stopLoss: 1990,
      takeProfit: 1980,
      quantity: 0.01,
      contract: fineContract(),
    });
    expect(buyBad.ok).toBe(false);
    const sellBad = validateMonetaryRewardToRisk({
      direction: "SELL",
      entryPrice: 2000,
      stopLoss: 2010,
      takeProfit: 2020,
      quantity: 0.01,
      contract: fineContract(),
    });
    expect(sellBad.ok).toBe(false);
  });
});

describe("Stage 5 — integrated pipeline + safety stamps", () => {
  it("produces complete validated proposal with risk record", () => {
    const r = runAutomatedPerOrderRiskEngine(baseInput("BUY", 500));
    expect(r.placesOrders).toBe(false);
    expect(r.acceptsForExecution).toBe(false);
    expect(r.mutatesBroker).toBe(false);
    expect(r.executionAuthorized).toBe(false);
    expect(r.perOrderRisk.placesOrders).toBe(false);
    expect(r.perOrderRisk.executionAuthorized).toBe(false);
    expect(r.proposal.perOrderRisk?.allocationId).toBe(r.allocationId);
    if (r.proposal.lifecycle === "PROPOSAL_READY") {
      expect(r.perOrderRisk.displayCategory).toBe("VALIDATED_PROPOSAL");
      expect(r.perOrderRisk.validationResult).toBe("PASS");
      expect(r.perOrderRisk.actualRewardToRiskRatio!).toBeGreaterThanOrEqual(3 - 1e-6);
    }
  });

  it("maps blocked risk to display categories", () => {
    const blocked = runAutomatedPerOrderRiskEngine({
      ...baseInput("BUY", 100),
      stopLoss: null,
      autoLevels: false,
    });
    const cat = resolveDisplayCategory(blocked.proposal);
    expect(["INVALID_RISK", "BLOCKED_PROPOSAL", "WAITING_FOR_DATA"]).toContain(cat);
    const record = buildPerOrderRiskRecord({
      proposal: blocked.proposal,
      monetary3rOk: false,
    });
    expect(record.validationResult).not.toBe("PASS");
  });

  it("expired handoff blocks", () => {
    const r = runAutomatedPerOrderRiskEngine({
      ...baseInput("BUY", 100),
      handoff: handoff("BUY", {
        resultExpiresAtUtc: new Date(Date.now() - 60_000).toISOString(),
      }),
    });
    expect(r.proposal.lifecycle).toBe("BLOCKED");
    expect(r.proposal.blockers.some((b) => String(b.code) === "HANDOFF_EXPIRED")).toBe(true);
  });

  it("never sets execution stamps true on any path", () => {
    const cases = [
      runAutomatedPerOrderRiskEngine(baseInput("BUY", 100)),
      runAutomatedPerOrderRiskEngine({ ...baseInput("SELL", 50), equityFresh: false }),
      runAutomatedPerOrderRiskEngine({
        ...baseInput("BUY", 100),
        contract: null,
      }),
    ];
    for (const r of cases) {
      const p: AtOrderProposalRecord = r.proposal;
      expect(p.placesOrders).toBe(false);
      expect(p.acceptsForExecution).toBe(false);
      expect(p.mutatesBroker).toBe(false);
    }
  });
});
