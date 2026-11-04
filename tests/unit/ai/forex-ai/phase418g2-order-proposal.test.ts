/**
 * Step 2 — Risk, Capital Allocation & Order Construction tests.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildOrderProposal,
  generateOrderProposalFromHandoff,
  getAtOrderProposalStore,
  OWNER_MAX_QUANTITY,
  RISK_POLICY_ID,
  RISK_POLICY_ID_LEGACY_25,
  RISK_POLICY_VERSION,
  RISK_POLICY_VERSION_LEGACY_25,
  resetAtOrderProposalStoreForTests,
  type AtOrderProposalRecord,
} from "../../../../ai/forex-ai/automated-trading/order-proposal/index.js";
import type { AtOrderPreparationHandoff } from "../../../../ai/forex-ai/automated-trading/result-intake/types.js";
import {
  computePerOrderRiskBreakdown,
  evaluatePerOrderLossLimit,
} from "../../../../ai/forex-ai/automated-trading/simulation-risk/capital-budget.js";
import type { AtSimContractMetaInput } from "../../../../ai/forex-ai/automated-trading/simulation-risk/types.js";
function handoff(dir: "BUY" | "SELL", overrides: Partial<AtOrderPreparationHandoff> = {}): AtOrderPreparationHandoff {
  return {
    acceptedResultId: "res-1",
    analysisId: "an-1",
    instrument: "XAU/USD",
    canonicalDirection: dir,
    directionalConfidencePct: 62,
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

/** Contract where owner max 0.01 is broker-compatible (min=step=0.01). */
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

/** Broker min 1.0 vs owner max 0.01 — must block. */
function coarseContract(): AtSimContractMetaInput {
  return fineContract({
    quantityMin: 1,
    quantityStep: 1,
    baseUnitSize: 1,
    marginPerLotAccount: 500,
  });
}

function baseReadyInput(dir: "BUY" | "SELL") {
  const entry = 2000;
  const stop = dir === "BUY" ? 1990 : 2010;
  return {
    handoff: handoff(dir),
    entryPrice: entry,
    stopLoss: stop,
    verifiedEquity: 10_000,
    accountCurrency: "USD",
    equityFresh: true,
    usableMargin: 8_000,
    usedMargin: 500,
    marginFresh: true,
    strategyAllocationPercent: 10,
    individualOrderAllocation: 500,
    allocationCurrency: "USD",
    existingCommittedExposure: 0,
    contract: fineContract(),
    contractFresh: true,
    sdkMinQuantity: 0.01,
    marginPerUnitAccount: 50,
    exposureAuthoritative: true,
    existingExposure: 0,
    systemMasterOn: true,
    tradingEnabled: true,
    emergencyEntryLock: false,
    persist: false as const,
  };
}

function codes(p: AtOrderProposalRecord): string[] {
  return p.blockers.map((b) => String(b.code));
}

describe("Phase 4.18G.2 order proposal engine", () => {
  let tmp: string;

  beforeEach(() => {
    resetAtOrderProposalStoreForTests();
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "at-proposal-"));
  });

  afterEach(() => {
    resetAtOrderProposalStoreForTests();
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it("1. BUY proposal with valid Entry/SL reaches PROPOSAL_READY", () => {
    const { record } = generateOrderProposalFromHandoff(baseReadyInput("BUY"), tmp);
    expect(record.lifecycle).toBe("PROPOSAL_READY");
    expect(record.direction).toBe("BUY");
    expect(record.pricePlan.stopLoss!).toBeLessThan(record.pricePlan.entryPrice!);
    expect(record.pricePlan.takeProfit!).toBeGreaterThan(record.pricePlan.entryPrice!);
    expect(record.placesOrders).toBe(false);
    expect(record.acceptsForExecution).toBe(false);
    expect(record.mutatesBroker).toBe(false);
  });

  it("2. SELL proposal with valid Entry/SL reaches PROPOSAL_READY", () => {
    const { record } = generateOrderProposalFromHandoff(baseReadyInput("SELL"), tmp);
    expect(record.lifecycle).toBe("PROPOSAL_READY");
    expect(record.direction).toBe("SELL");
    expect(record.pricePlan.stopLoss!).toBeGreaterThan(record.pricePlan.entryPrice!);
    expect(record.pricePlan.takeProfit!).toBeLessThan(record.pricePlan.entryPrice!);
  });

  it("3. NO_TRADE cannot generate an eligible proposal", () => {
    const record = buildOrderProposal({
      ...baseReadyInput("BUY"),
      handoff: null,
      canonicalDecision: "NO_TRADE",
    });
    expect(record.lifecycle).toBe("BLOCKED");
    expect(codes(record)).toContain("NO_TRADE_NOT_ELIGIBLE");
  });

  it("4. Missing Entry blocks", () => {
    const input = baseReadyInput("BUY");
    delete (input as { entryPrice?: number }).entryPrice;
    input.entryPrice = null;
    const record = buildOrderProposal(input);
    expect(record.lifecycle).toBe("BLOCKED");
    expect(codes(record)).toContain("INVALID_ENTRY");
  });

  it("5. Missing SL blocks", () => {
    const record = buildOrderProposal({ ...baseReadyInput("BUY"), stopLoss: null });
    expect(record.lifecycle).toBe("BLOCKED");
    expect(codes(record)).toContain("INVALID_STOP_LOSS");
  });

  it("6. Invalid BUY/SELL SL geometry blocks", () => {
    const buyBad = buildOrderProposal({ ...baseReadyInput("BUY"), stopLoss: 2010 });
    expect(codes(buyBad)).toContain("INVALID_SL_GEOMETRY");
    const sellBad = buildOrderProposal({ ...baseReadyInput("SELL"), stopLoss: 1990 });
    expect(codes(sellBad)).toContain("INVALID_SL_GEOMETRY");
  });

  it("7. Correct 3R calculation for BUY", () => {
    const record = buildOrderProposal(baseReadyInput("BUY"));
    // Entry 2000, SL 1990 → risk 10 → TP 2030
    expect(record.pricePlan.takeProfit).toBe(2030);
    expect(record.pricePlan.plannedRewardRiskRatio).toBe(3);
    expect(record.pricePlan.takeProfitLabel).toBe("3R_PLANNED_TARGET");
  });

  it("8. Correct 3R calculation for SELL", () => {
    const record = buildOrderProposal(baseReadyInput("SELL"));
    // Entry 2000, SL 2010 → risk 10 → TP 1970
    expect(record.pricePlan.takeProfit).toBe(1970);
  });

  it("9. Risk amount = 20% target / 25% hard max of order allocation", () => {
    const record = buildOrderProposal(baseReadyInput("BUY"));
    expect(record.capital.riskTargetAmount).toBe(100); // 500 * 0.20
    expect(record.capital.maximumPermittedOrderLoss).toBe(125); // 500 * 0.25
    expect(record.capital.allowedRiskAmount).toBe(100); // min(target, hardMax)
    expect(record.capital.riskPolicyId).toBe("PER_ORDER_ALLOCATION_20TARGET_25MAX");
    expect(record.capital.riskPolicyVersion).toBe("per-order-risk-v2-20target-25max");
  });

  it("10. Quantity uses contract specifications (floor-only)", () => {
    const record = buildOrderProposal(baseReadyInput("BUY"));
    expect(record.lifecycle).toBe("PROPOSAL_READY");
    expect(record.quantity.normalizedQuantity).toBeGreaterThan(0);
    expect(record.quantity.normalizedQuantity!).toBeLessThanOrEqual(OWNER_MAX_QUANTITY);
    expect(record.quantity.sizingMethod).toBeTruthy();
  });

  it("11. Account-currency conversion required when allocation currency differs", () => {
    const record = buildOrderProposal({
      ...baseReadyInput("BUY"),
      accountCurrency: "EUR",
      allocationCurrency: "USD",
      conversionRateSnapshot: null,
    });
    expect(record.lifecycle).toBe("BLOCKED");
    expect(codes(record).some((c) => c === "MISSING_FX_CONVERSION" || c.startsWith("FX_"))).toBe(true);
  });

  it("11b. Same-currency allocation does not require FX", () => {
    const record = buildOrderProposal({
      ...baseReadyInput("BUY"),
      accountCurrency: "EUR",
      allocationCurrency: "EUR",
      conversionRateSnapshot: null,
    });
    expect(codes(record)).not.toContain("MISSING_FX_CONVERSION");
  });

  it("12. Floor-only quantity rounding (never rounds up)", () => {
    // riskPerUnit via POINT_COST: move=10, pointSize=0.01, pipCost=0.01 → riskPerUnit=10
    // maxLoss=125 → rawQty=12.5 → floor to 0.01 step → but owner max caps to 0.01
    const record = buildOrderProposal(baseReadyInput("BUY"));
    const q = record.quantity.normalizedQuantity!;
    expect(q).toBe(Math.floor(q / 0.01 + 1e-12) * 0.01);
    expect(q).toBeLessThanOrEqual(OWNER_MAX_QUANTITY);
  });

  it("13. Owner maximum 0.01 lots enforced", () => {
    const record = buildOrderProposal(baseReadyInput("BUY"));
    expect(record.quantity.ownerMaxQuantity).toBe(0.01);
    if (record.quantity.normalizedQuantity != null) {
      expect(record.quantity.normalizedQuantity).toBeLessThanOrEqual(0.01);
    }
  });

  it("14. Broker minimum 1.0 vs owner maximum 0.01 blocks", () => {
    const record = buildOrderProposal({
      ...baseReadyInput("BUY"),
      contract: coarseContract(),
      sdkMinQuantity: 1,
      marginPerUnitAccount: 500,
    });
    expect(record.lifecycle).toBe("BLOCKED");
    expect(
      codes(record).some((c) =>
        c === "BROKER_MINIMUM_EXCEEDS_ALLOWED_QUANTITY"
        || c === "OWNER_MAX_QUANTITY_EXCEEDED"
        || c === "SIZE_QTY_BELOW_MIN_AFTER_FLOOR"
      ),
    ).toBe(true);
  });

  it("15. Missing/stale equity blocks", () => {
    const missing = buildOrderProposal({ ...baseReadyInput("BUY"), verifiedEquity: null });
    expect(codes(missing)).toContain("MISSING_ACCOUNT_EQUITY");
    const stale = buildOrderProposal({ ...baseReadyInput("BUY"), equityFresh: false });
    expect(codes(stale)).toContain("STALE_ACCOUNT_EQUITY");
  });

  it("16. Missing/stale margin blocks", () => {
    const missing = buildOrderProposal({ ...baseReadyInput("BUY"), usableMargin: null });
    expect(codes(missing)).toContain("MISSING_MARGIN_DATA");
    const stale = buildOrderProposal({ ...baseReadyInput("BUY"), marginFresh: false });
    expect(codes(stale)).toContain("STALE_MARGIN_DATA");
  });

  it("17. Insufficient available margin blocks", () => {
    const record = buildOrderProposal({
      ...baseReadyInput("BUY"),
      usableMargin: 0.01,
      marginPerUnitAccount: 50,
    });
    expect(record.lifecycle).toBe("BLOCKED");
    expect(
      codes(record).some((c) =>
        c === "INSUFFICIENT_AVAILABLE_MARGIN" || c === "SIZE_QTY_INSUFFICIENT_FREE_MARGIN"
      ),
    ).toBe(true);
  });

  it("18. Allocation budget exceeded blocks", () => {
    const record = buildOrderProposal({
      ...baseReadyInput("BUY"),
      individualOrderAllocation: 5_000, // budget = 1000
    });
    expect(codes(record)).toContain("ALLOCATION_BUDGET_EXCEEDED");
  });

  it("19. Multiple proposals cannot over-allocate the strategy", () => {
    const first = generateOrderProposalFromHandoff({
      ...baseReadyInput("BUY"),
      persist: true,
      individualOrderAllocation: 600,
    }, tmp);
    expect(first.record.lifecycle).toBe("PROPOSAL_READY");

    const second = generateOrderProposalFromHandoff({
      ...baseReadyInput("BUY"),
      handoff: handoff("BUY", { acceptedResultId: "res-2", analysisId: "an-2" }),
      persist: true,
      individualOrderAllocation: 600,
      // pending reservations loaded from store
    }, tmp);
    expect(second.record.lifecycle).toBe("BLOCKED");
    expect(codes(second.record)).toContain("ALLOCATION_BUDGET_EXCEEDED");
  });

  it("20. Duplicate proposal idempotency", () => {
    const a = generateOrderProposalFromHandoff({ ...baseReadyInput("BUY"), persist: true }, tmp);
    const b = generateOrderProposalFromHandoff({ ...baseReadyInput("BUY"), persist: true }, tmp);
    expect(b.duplicate).toBe(true);
    expect(b.record.proposalId).toBe(a.record.proposalId);
    const store = getAtOrderProposalStore(tmp);
    expect(store.list(20).filter((p) => p.lifecycle === "PROPOSAL_READY").length).toBe(1);
  });

  it("21. Exposure limits block", () => {
    const record = buildOrderProposal({
      ...baseReadyInput("BUY"),
      existingExposure: 900,
      maxExposureLimit: 1000,
      // projected = 900 + 500 = 1400 > 1000
    });
    expect(codes(record)).toContain("EXPOSURE_LIMIT_EXCEEDED");
  });

  it("22. Instrument precision / tick-size validation", () => {
    const record = buildOrderProposal({
      ...baseReadyInput("BUY"),
      entryPrice: 2000.005,
      contract: fineContract({ tickSize: 0.01, pointSize: 0.01 }),
    });
    expect(codes(record)).toContain("INVALID_PRICE_PRECISION");
  });

  it("23. Stale instrument specifications block", () => {
    const record = buildOrderProposal({ ...baseReadyInput("BUY"), contractFresh: false });
    expect(codes(record)).toContain("STALE_INSTRUMENT_SPEC");
  });

  it("24. Missing FX conversion rates block", () => {
    const record = buildOrderProposal({
      ...baseReadyInput("BUY"),
      accountCurrency: "JPY",
      allocationCurrency: "USD",
      conversionRateSnapshot: null,
    });
    expect(codes(record)).toContain("MISSING_FX_CONVERSION");
  });

  it("25. Master OFF blocks new proposal processing", () => {
    const record = buildOrderProposal({ ...baseReadyInput("BUY"), systemMasterOn: false });
    expect(codes(record)).toContain("SYSTEM_MASTER_OFF");
    expect(record.lifecycle).toBe("BLOCKED");
  });

  it("26. Safety flags never claim execution", () => {
    const record = buildOrderProposal(baseReadyInput("BUY"));
    expect(record.placesOrders).toBe(false);
    expect(record.acceptsForExecution).toBe(false);
    expect(record.mutatesBroker).toBe(false);
    expect(record.brokerPrep.brokerOrderId).toBeNull();
    expect(record.brokerPrep.brokerTradeId).toBeNull();
  });

  it("27–28. No broker mutation / no execution acceptance on ready proposal", () => {
    const { record } = generateOrderProposalFromHandoff({ ...baseReadyInput("BUY"), persist: true }, tmp);
    expect(record.lifecycle).toBe("PROPOSAL_READY");
    expect(record.acceptsForExecution).toBe(false);
    expect(record.mutatesBroker).toBe(false);
  });

  it("29. Persistence and restart recovery", () => {
    const { record } = generateOrderProposalFromHandoff({ ...baseReadyInput("BUY"), persist: true }, tmp);
    resetAtOrderProposalStoreForTests();
    const reloaded = getAtOrderProposalStore(tmp);
    const got = reloaded.get(record.proposalId);
    expect(got?.proposalId).toBe(record.proposalId);
    expect(got?.lifecycle).toBe("PROPOSAL_READY");
    expect(reloaded.activeReservationTotal()).toBeGreaterThan(0);
  });

  it("Capital allocation budget = equity × pct / 100", () => {
    const record = buildOrderProposal(baseReadyInput("BUY"));
    expect(record.capital.strategyAllocationBudget).toBe(1000);
    expect(record.capital.strategyAllocationPercent).toBe(10);
  });

  it("Missing instrument spec blocks", () => {
    const record = buildOrderProposal({
      ...baseReadyInput("BUY"),
      contract: { ...fineContract(), verified: false },
    });
    expect(codes(record)).toContain("MISSING_INSTRUMENT_SPEC");
  });

  it("24. Historical proposals preserve original risk-policy version", () => {
    const { record } = generateOrderProposalFromHandoff({ ...baseReadyInput("BUY"), persist: true }, tmp);
    // Simulate a legacy stored record without rewriting its policy fields.
    const store = getAtOrderProposalStore(tmp);
    const legacy = {
      ...record,
      proposalId: "legacy-25-only",
      idempotencyKey: "legacy-25-key",
      capital: {
        ...record.capital,
        riskPolicyId: RISK_POLICY_ID_LEGACY_25,
        riskPolicyVersion: RISK_POLICY_VERSION_LEGACY_25,
        riskTargetAmount: null,
        maximumPermittedOrderLoss: record.capital.allowedRiskAmount,
      },
    };
    store.upsertProposal(legacy as AtOrderProposalRecord);
    resetAtOrderProposalStoreForTests();
    const reloaded = getAtOrderProposalStore(tmp);
    const got = reloaded.get("legacy-25-only");
    expect(got?.capital.riskPolicyVersion).toBe(RISK_POLICY_VERSION_LEGACY_25);
    expect(got?.capital.riskPolicyId).toBe(RISK_POLICY_ID_LEGACY_25);
    // New proposals still stamp v2.
    expect(record.capital.riskPolicyVersion).toBe(RISK_POLICY_VERSION);
    expect(record.capital.riskPolicyId).toBe(RISK_POLICY_ID);
  });
});

describe("Phase 4.18G.2 per-order risk policy v2 (20% target / 25% hard max)", () => {
  it.each([
    [100, 20, 25],
    [130, 26, 32.5],
    [200, 40, 50],
    [500, 100, 125],
  ] as const)(
    "$%s allocation → $%s risk target and $%s hard maximum",
    (alloc, target, hardMax) => {
      const bd = computePerOrderRiskBreakdown(alloc);
      expect(bd.riskTargetAmount).toBe(target);
      expect(bd.maximumPermittedOrderLoss).toBe(hardMax);
      expect(bd.allowedRiskAmount).toBe(target);
      expect(bd.riskTargetPercent).toBe(20);
      expect(bd.riskMaximumPercent).toBe(25);
    },
  );

  it("Projected loss equals risk target → PASS", () => {
    const r = evaluatePerOrderLossLimit({ perOrderAllocation: 100, estimatedStopLossRisk: 20 });
    expect(r.ok && r.pass).toBe(true);
    expect(r.code).toBe("PER_ORDER_LOSS_LIMIT_PASS");
  });

  it("Projected loss above 20% target but below 25% hard max → BLOCKED (target policy)", () => {
    const r = evaluatePerOrderLossLimit({ perOrderAllocation: 100, estimatedStopLossRisk: 22 });
    expect(r.ok).toBe(true);
    expect(r.pass).toBe(false);
    expect(r.code).toBe("PER_ORDER_RISK_TARGET_EXCEEDED");
  });

  it("Projected loss above 25% hard maximum → BLOCKED", () => {
    const r = evaluatePerOrderLossLimit({ perOrderAllocation: 100, estimatedStopLossRisk: 26 });
    expect(r.ok).toBe(true);
    expect(r.pass).toBe(false);
    expect(r.code).toBe("PER_ORDER_LOSS_LIMIT_EXCEEDED");
  });

  it("Ready proposal projected loss never exceeds allowed (20%) or hard max (25%)", () => {
    const record = buildOrderProposal({
      handoff: {
        acceptedResultId: "res-r",
        analysisId: "an-r",
        instrument: "XAU/USD",
        canonicalDirection: "BUY",
        directionalConfidencePct: 60,
        confidenceType: "ANALYSIS_CONFIDENCE",
        isCalibratedWinProbability: false,
        observationId: null,
        imageId: null,
        imageHash: null,
        analyzedAtUtc: new Date().toISOString(),
        resultExpiresAtUtc: new Date(Date.now() + 3600_000).toISOString(),
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
        note: "t",
      },
      entryPrice: 2000,
      stopLoss: 1990,
      verifiedEquity: 10_000,
      accountCurrency: "USD",
      equityFresh: true,
      usableMargin: 8_000,
      usedMargin: 0,
      marginFresh: true,
      strategyAllocationPercent: 10,
      individualOrderAllocation: 200,
      allocationCurrency: "USD",
      existingCommittedExposure: 0,
      contract: {
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
      },
      contractFresh: true,
      sdkMinQuantity: 0.01,
      marginPerUnitAccount: 50,
      exposureAuthoritative: true,
      existingExposure: 0,
      systemMasterOn: true,
      tradingEnabled: true,
      emergencyEntryLock: false,
    });
    expect(record.lifecycle).toBe("PROPOSAL_READY");
    expect(record.capital.riskTargetAmount).toBe(40);
    expect(record.capital.maximumPermittedOrderLoss).toBe(50);
    expect(record.capital.projectedLossAtStopLoss!).toBeLessThanOrEqual(
      (record.capital.allowedRiskAmount ?? 0) + 1e-8,
    );
    expect(record.capital.projectedLossAtStopLoss!).toBeLessThanOrEqual(
      (record.capital.maximumPermittedOrderLoss ?? 0) + 1e-8,
    );
    expect(record.capital.riskValidationStatus).toBe("PASS");
  });

  it("Canonical AI direction cannot override — NO_TRADE still blocked", () => {
    const record = buildOrderProposal({
      handoff: null,
      canonicalDecision: "NO_TRADE",
      entryPrice: 2000,
      stopLoss: 1990,
      verifiedEquity: 10_000,
      accountCurrency: "USD",
      equityFresh: true,
      usableMargin: 8000,
      marginFresh: true,
      strategyAllocationPercent: 10,
      individualOrderAllocation: 100,
      contract: {
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
        source: "t",
        unavailableReason: null,
      },
      contractFresh: true,
      exposureAuthoritative: true,
      systemMasterOn: true,
      tradingEnabled: true,
      emergencyEntryLock: false,
    });
    expect(record.lifecycle).toBe("BLOCKED");
    expect(record.blockers.map((b) => b.code)).toContain("NO_TRADE_NOT_ELIGIBLE");
  });
});
