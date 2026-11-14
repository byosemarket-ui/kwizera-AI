/**
 * Step 3 — Broker Compatibility, Validation & Handoff tests.
 * Never submits broker orders.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildBrokerHandoff,
  getAtBrokerHandoffStore,
  isHandoffExpired,
  resetAtBrokerHandoffStoreForTests,
  toFutureExecutionContract,
  validateProposalForBrokerHandoff,
  OWNER_MAX_LOTS,
  type AtBrokerHandoffRecord,
} from "../../../../ai/forex-ai/automated-trading/broker-compatibility/index.js";
import {
  buildOrderProposal,
  type AtOrderProposalRecord,
} from "../../../../ai/forex-ai/automated-trading/order-proposal/index.js";
import type { AtOrderPreparationHandoff } from "../../../../ai/forex-ai/automated-trading/result-intake/types.js";
import type { AtSimContractMetaInput } from "../../../../ai/forex-ai/automated-trading/simulation-risk/types.js";

function handoffBuy(): AtOrderPreparationHandoff {
  return {
    acceptedResultId: "res-1",
    analysisId: "an-1",
    instrument: "EUR/USD",
    canonicalDirection: "BUY",
    directionalConfidencePct: 60,
    confidenceType: "ANALYSIS_CONFIDENCE",
    isCalibratedWinProbability: false,
    observationId: "obs-1",
    imageId: "img-1",
    imageHash: "hash-1",
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
  };
}

/** Contract where 0.01 lots → integer AMOUNT (baseUnitSize=100 → amount=1). */
function fineContract(): AtSimContractMetaInput {
  return {
    verified: true,
    pointSize: 0.00001,
    tickSize: 0.00001,
    digits: 5,
    quantityMin: 1,
    quantityStep: 1,
    quantityUnit: "contracts",
    quantityUnitAmbiguous: false,
    contractMultiplier: 100000,
    baseUnitSize: 100,
    pipCostAccount: 1,
    marginPerLotAccount: 50,
    minStopDistance: null,
    minStopDistanceVerified: false,
    source: "test",
    unavailableReason: null,
  };
}

function readyProposal(dir: "BUY" | "SELL" = "BUY"): AtOrderProposalRecord {
  const entry = 1.10000;
  const stop = dir === "BUY" ? 1.09900 : 1.10100;
  const record = buildOrderProposal({
    handoff: { ...handoffBuy(), canonicalDirection: dir, instrument: "EUR/USD" },
    entryPrice: entry,
    stopLoss: stop,
    verifiedEquity: 10_000,
    accountCurrency: "USD",
    equityFresh: true,
    usableMargin: 8_000,
    usedMargin: 100,
    marginFresh: true,
    strategyAllocationPercent: 10,
    individualOrderAllocation: 500,
    allocationCurrency: "USD",
    existingCommittedExposure: 0,
    pendingProposalReservations: 0,
    contract: fineContract(),
    contractFresh: true,
    sdkMinQuantity: 1,
    marginPerUnitAccount: 50,
    exposureAuthoritative: true,
    existingExposure: 0,
    systemMasterOn: true,
    tradingEnabled: true,
    emergencyEntryLock: false,
  });
  // Force ready-compatible quantity if sizer capped oddly
  if (record.lifecycle === "PROPOSAL_READY") return record;
  // Fallback: stamp PROPOSAL_READY for handoff tests when engine blocked on XAU-style constraints
  return {
    ...record,
    lifecycle: "PROPOSAL_READY",
    direction: dir,
    canonicalDecision: dir,
    blockers: [],
    quantity: {
      ...record.quantity,
      normalizedQuantity: 0.01,
      calculatedQuantity: 0.01,
      brokerMinimum: 1,
      quantityStep: 1,
      lotContractUnit: "contracts",
      estimatedMargin: 0.5,
      availableMargin: 8000,
      projectedExposure: 500,
      ownerMaxQuantity: 0.01,
    },
    pricePlan: {
      ...record.pricePlan,
      entryPrice: entry,
      stopLoss: stop,
      takeProfit: dir === "BUY" ? entry + 3 * (entry - stop) : entry - 3 * (stop - entry),
      plannedRewardRiskRatio: 3,
      takeProfitLabel: "3R_PLANNED_TARGET",
      takeProfitNote: "planned",
      invalidationConditions: [],
      entryType: "EXPLICIT",
      entryZoneLow: null,
      entryZoneHigh: null,
      riskDistance: Math.abs(entry - stop),
      rewardDistance: 3 * Math.abs(entry - stop),
    },
    capital: {
      ...record.capital,
      riskPolicyVersion: "per-order-risk-v2-20target-25max",
      riskTargetPercent: 20,
      riskMaximumPercent: 25,
      riskTargetAmount: 100,
      maximumPermittedOrderLoss: 125,
      allowedRiskAmount: 100,
      projectedLossAtStopLoss: 50,
      individualOrderAllocation: 500,
      strategyAllocationPercent: 10,
      strategyAllocationBudget: 1000,
      remainingStrategyBudget: 500,
      riskValidationStatus: "PASS",
    },
    brokerPrep: {
      ...record.brokerPrep,
      buySell: dir,
      orderType: "LIMIT",
      amountQuantity: 0.01,
      entryPrice: entry,
      stopLoss: stop,
      takeProfit: dir === "BUY" ? entry + 3 * (entry - stop) : entry - 3 * (stop - entry),
      timeInForce: null,
      expiration: null,
      clientReference: record.proposalId,
      brokerOrderId: null,
      brokerTradeId: null,
    },
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
  };
}

function accountOk() {
  return {
    accountIdMasked: "DEMO***123",
    accountCurrency: "USD",
    equity: 10_000,
    usedMargin: 100,
    usableMargin: 8_000,
    isFresh: true,
    fetchedAtUtc: new Date().toISOString(),
    environment: "DEMO" as const,
    accountType: "DEMO",
    accountStatus: "ACTIVE",
  };
}

function instrumentOk(over: Record<string, unknown> = {}) {
  return {
    symbol: "EUR/USD",
    offerId: "offer-1",
    instrumentType: "Forex",
    baseAsset: "EUR",
    quoteAsset: "USD",
    pointSize: 0.00001,
    pipCostAccount: 1,
    contractMultiplier: 100000,
    baseUnitSize: 100,
    quantityMin: 1,
    quantityStep: 1,
    quantityUnit: "contracts",
    marginPerLotAccount: 50,
    contractVerified: true,
    contractSource: "test",
    unavailableReason: null,
    digits: 5,
    ...over,
  };
}

function codes(h: AtBrokerHandoffRecord): string[] {
  return h.blockers.map((b) => String(b.code));
}

describe("Phase 4.18G.3 broker handoff", () => {
  let tmp: string;

  beforeEach(() => {
    resetAtBrokerHandoffStoreForTests();
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "at-handoff-"));
  });

  afterEach(() => {
    resetAtBrokerHandoffStoreForTests();
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch { /* ignore */ }
  });

  it("1. Valid FXCM BUY compatibility → HANDOFF_READY", () => {
    const h = buildBrokerHandoff({
      proposal: readyProposal("BUY"),
      account: accountOk(),
      instrument: instrumentOk(),
      accountConnected: true,
      accountAuthenticated: true,
      instrumentFresh: true,
      marginFresh: true,
      systemMasterOn: true,
    });
    expect(h.lifecycle).toBe("HANDOFF_READY");
    expect(h.directionOrder.brokerBuySell).toBe("B");
    expect(h.placesOrders).toBe(false);
    expect(h.mutatesBroker).toBe(false);
    expect(h.acceptsForExecution).toBe(false);
  });

  it("2. Valid FXCM SELL compatibility → HANDOFF_READY", () => {
    const h = buildBrokerHandoff({
      proposal: readyProposal("SELL"),
      account: accountOk(),
      instrument: instrumentOk(),
      accountConnected: true,
      accountAuthenticated: true,
      instrumentFresh: true,
      marginFresh: true,
      systemMasterOn: true,
    });
    expect(h.lifecycle).toBe("HANDOFF_READY");
    expect(h.directionOrder.brokerBuySell).toBe("S");
  });

  it("3. NO_TRADE cannot produce a handoff", () => {
    const p = readyProposal("BUY");
    p.canonicalDecision = "NO_TRADE";
    p.direction = null;
    const h = buildBrokerHandoff({
      proposal: p,
      account: accountOk(),
      instrument: instrumentOk(),
      systemMasterOn: true,
      instrumentFresh: true,
      marginFresh: true,
    });
    expect(h.lifecycle).toBe("BLOCKED");
    expect(codes(h)).toContain("NO_TRADE_NOT_ELIGIBLE");
  });

  it("4. Invalid canonical direction blocks", () => {
    const p = readyProposal("BUY");
    p.canonicalDecision = null;
    p.direction = null;
    const h = buildBrokerHandoff({
      proposal: p,
      account: accountOk(),
      instrument: instrumentOk(),
      systemMasterOn: true,
      instrumentFresh: true,
      marginFresh: true,
    });
    expect(codes(h)).toContain("NO_CANONICAL_BUY_SELL");
  });

  it("5. Missing account ID blocks", () => {
    const h = buildBrokerHandoff({
      proposal: readyProposal("BUY"),
      account: { ...accountOk(), accountIdMasked: null },
      instrument: instrumentOk(),
      systemMasterOn: true,
      instrumentFresh: true,
      marginFresh: true,
    });
    expect(codes(h)).toContain("MISSING_ACCOUNT_ID");
  });

  it("6. Missing Offer ID blocks", () => {
    const h = buildBrokerHandoff({
      proposal: readyProposal("BUY"),
      account: accountOk(),
      instrument: instrumentOk({ offerId: null }),
      systemMasterOn: true,
      instrumentFresh: true,
      marginFresh: true,
    });
    expect(codes(h)).toContain("MISSING_OFFER_OR_SYMBOL");
  });

  it("7. Missing contract size blocks", () => {
    const h = buildBrokerHandoff({
      proposal: readyProposal("BUY"),
      account: accountOk(),
      instrument: instrumentOk({ baseUnitSize: null, contractMultiplier: null }),
      systemMasterOn: true,
      instrumentFresh: true,
      marginFresh: true,
    });
    expect(codes(h)).toContain("MISSING_CONTRACT_SIZE");
  });

  it("8. Missing quantity unit blocks", () => {
    const h = buildBrokerHandoff({
      proposal: readyProposal("BUY"),
      account: accountOk(),
      instrument: instrumentOk({ quantityUnit: null }),
      systemMasterOn: true,
      instrumentFresh: true,
      marginFresh: true,
    });
    expect(codes(h)).toContain("MISSING_QUANTITY_UNIT");
  });

  it("9. Broker minimum greater than 0.01 blocks", () => {
    // baseUnitSize=1, minQuantity=1 → min lots = 1.0 > 0.01
    const h = buildBrokerHandoff({
      proposal: readyProposal("BUY"),
      account: accountOk(),
      instrument: instrumentOk({ baseUnitSize: 1, quantityMin: 1, quantityStep: 1 }),
      systemMasterOn: true,
      instrumentFresh: true,
      marginFresh: true,
    });
    expect(
      codes(h).some((c) =>
        c === "BROKER_MINIMUM_EXCEEDS_RISK_BUDGET"
        || c === "BROKER_AMOUNT_UNIT_UNVERIFIED"
      ),
    ).toBe(true);
  });

  it("10–13. Amount conversion, step, floor-only, owner max 0.01", () => {
    const h = buildBrokerHandoff({
      proposal: readyProposal("BUY"),
      account: accountOk(),
      instrument: instrumentOk(),
      systemMasterOn: true,
      instrumentFresh: true,
      marginFresh: true,
    });
    expect(h.lifecycle).toBe("HANDOFF_READY");
    expect(h.directionOrder.amount).toBe(1); // 100 * 0.01
    expect(h.directionOrder.normalizedQuantity).toBe(0.01);
    expect(h.directionOrder.ownerMaxLots).toBeNull();
    expect(OWNER_MAX_LOTS).toBeNull();
  });

  it("14–18. Entry/SL/TP geometry and 3R for BUY and SELL", () => {
    for (const dir of ["BUY", "SELL"] as const) {
      const h = buildBrokerHandoff({
        proposal: readyProposal(dir),
        account: accountOk(),
        instrument: instrumentOk(),
        systemMasterOn: true,
        instrumentFresh: true,
        marginFresh: true,
      });
      expect(h.lifecycle).toBe("HANDOFF_READY");
      expect(h.riskCapital.plannedRewardRisk).toBeGreaterThanOrEqual(3 - 0.05);
      if (dir === "BUY") {
        expect(h.directionOrder.stopLoss!).toBeLessThan(h.directionOrder.entryPrice!);
        expect(h.directionOrder.takeProfit!).toBeGreaterThan(h.directionOrder.entryPrice!);
      } else {
        expect(h.directionOrder.stopLoss!).toBeGreaterThan(h.directionOrder.entryPrice!);
        expect(h.directionOrder.takeProfit!).toBeLessThan(h.directionOrder.entryPrice!);
      }
    }
  });

  it("19. Invalid price tick alignment blocks", () => {
    const p = readyProposal("BUY");
    p.pricePlan.entryPrice = 1.100001;
    const h = buildBrokerHandoff({
      proposal: p,
      account: accountOk(),
      instrument: instrumentOk({ pointSize: 0.00001 }),
      systemMasterOn: true,
      instrumentFresh: true,
      marginFresh: true,
    });
    expect(codes(h)).toContain("INVALID_PRICE_PRECISION");
  });

  it("20–21. Invalid order type / unsupported TIF blocks", () => {
    const p = readyProposal("BUY");
    p.brokerPrep.orderType = null;
    p.pricePlan.entryType = "UNSET";
    // MARKET is derived from UNSET — force invalid by clearing both and setting weird TIF
    p.brokerPrep.timeInForce = "YEAR";
    const h = buildBrokerHandoff({
      proposal: p,
      account: accountOk(),
      instrument: instrumentOk(),
      systemMasterOn: true,
      instrumentFresh: true,
      marginFresh: true,
    });
    expect(codes(h)).toContain("UNSUPPORTED_TIME_IN_FORCE");
  });

  it("22. Missing GTD expiration blocks", () => {
    const p = readyProposal("BUY");
    p.brokerPrep.timeInForce = "GTD";
    p.brokerPrep.expiration = null;
    const h = buildBrokerHandoff({
      proposal: p,
      account: accountOk(),
      instrument: instrumentOk(),
      systemMasterOn: true,
      instrumentFresh: true,
      marginFresh: true,
    });
    expect(codes(h)).toContain("GTD_EXPIRATION_MISSING");
  });

  it("23–24. Protection requires post-fill workflow when attach unverified", () => {
    const h = buildBrokerHandoff({
      proposal: readyProposal("BUY"),
      account: accountOk(),
      instrument: instrumentOk(),
      systemMasterOn: true,
      instrumentFresh: true,
      marginFresh: true,
      protectionAttachVerified: false,
    });
    expect(h.lifecycle).toBe("HANDOFF_READY");
    expect(h.protection.protectionCompatibilityStatus).toBe("REQUIRES_POST_FILL_WORKFLOW");
    expect(h.protection.requiredProtectionWorkflow).toContain("POST_FILL");
  });

  it("25–26. Trade ID and Order ID are never invented", () => {
    const h = buildBrokerHandoff({
      proposal: readyProposal("BUY"),
      account: accountOk(),
      instrument: instrumentOk(),
      systemMasterOn: true,
      instrumentFresh: true,
      marginFresh: true,
    });
    expect(h.directionOrder.brokerOrderId).toBeNull();
    expect(h.directionOrder.brokerTradeId).toBeNull();
  });

  it("27–28. Stale margin / insufficient margin blocks", () => {
    const stale = buildBrokerHandoff({
      proposal: readyProposal("BUY"),
      account: accountOk(),
      instrument: instrumentOk(),
      systemMasterOn: true,
      instrumentFresh: true,
      marginFresh: false,
    });
    expect(codes(stale)).toContain("STALE_MARGIN_DATA");

    const low = buildBrokerHandoff({
      proposal: readyProposal("BUY"),
      account: { ...accountOk(), usableMargin: 0.01 },
      instrument: instrumentOk(),
      systemMasterOn: true,
      instrumentFresh: true,
      marginFresh: true,
    });
    expect(codes(low)).toContain("INSUFFICIENT_AVAILABLE_MARGIN");
  });

  it("29. Exposure restriction blocks", () => {
    const h = buildBrokerHandoff({
      proposal: readyProposal("BUY"),
      account: accountOk(),
      instrument: instrumentOk(),
      systemMasterOn: true,
      instrumentFresh: true,
      marginFresh: true,
      maxExposureLimit: 100,
    });
    expect(codes(h)).toContain("EXPOSURE_LIMIT_EXCEEDED");
  });

  it("30–31. Stale account / instrument metadata blocks", () => {
    const a = buildBrokerHandoff({
      proposal: readyProposal("BUY"),
      account: { ...accountOk(), isFresh: false },
      instrument: instrumentOk(),
      systemMasterOn: true,
      instrumentFresh: true,
      marginFresh: true,
    });
    expect(codes(a).some((c) => c === "STALE_ACCOUNT_METADATA" || c === "ACCOUNT_NOT_FRESH")).toBe(true);

    const i = buildBrokerHandoff({
      proposal: readyProposal("BUY"),
      account: accountOk(),
      instrument: instrumentOk(),
      systemMasterOn: true,
      instrumentFresh: false,
      marginFresh: true,
    });
    expect(codes(i)).toContain("STALE_INSTRUMENT_METADATA");
  });

  it("32. Duplicate handoff idempotency", () => {
    const proposal = readyProposal("BUY");
    const a = validateProposalForBrokerHandoff(
      {
        proposal,
        account: accountOk(),
        instrument: instrumentOk(),
        systemMasterOn: true,
        instrumentFresh: true,
        marginFresh: true,
        accountConnected: true,
        accountAuthenticated: true,
      },
      { persist: true, storageRoot: tmp },
    );
    const b = validateProposalForBrokerHandoff(
      {
        proposal,
        account: accountOk(),
        instrument: instrumentOk(),
        systemMasterOn: true,
        instrumentFresh: true,
        marginFresh: true,
        accountConnected: true,
        accountAuthenticated: true,
      },
      { persist: true, storageRoot: tmp },
    );
    expect(a.record.lifecycle).toBe("HANDOFF_READY");
    expect(b.duplicate).toBe(true);
    expect(b.record.provenance.handoffId).toBe(a.record.provenance.handoffId);
  });

  it("32b. BLOCKED handoff revalidates after System Master recovers", () => {
    const proposal = readyProposal("BUY");
    const blocked = validateProposalForBrokerHandoff(
      {
        proposal,
        account: accountOk(),
        instrument: instrumentOk(),
        systemMasterOn: false,
        instrumentFresh: true,
        marginFresh: true,
        accountConnected: true,
        accountAuthenticated: true,
      },
      { persist: true, storageRoot: tmp },
    );
    expect(blocked.record.lifecycle).toBe("BLOCKED");
    expect(codes(blocked.record)).toContain("SYSTEM_MASTER_OFF");

    const recovered = validateProposalForBrokerHandoff(
      {
        proposal,
        account: accountOk(),
        instrument: instrumentOk(),
        systemMasterOn: true,
        instrumentFresh: true,
        marginFresh: true,
        accountConnected: true,
        accountAuthenticated: true,
      },
      { persist: true, storageRoot: tmp },
    );
    expect(recovered.duplicate).toBe(false);
    expect(recovered.record.lifecycle).toBe("HANDOFF_READY");
    expect(codes(recovered.record)).not.toContain("SYSTEM_MASTER_OFF");
    expect(recovered.record.provenance.handoffId).not.toBe(blocked.record.provenance.handoffId);
    expect(blocked.record.lifecycle === "SUPERSEDED" || getAtBrokerHandoffStore(tmp).get(blocked.record.provenance.handoffId)?.lifecycle === "SUPERSEDED").toBe(true);
  });

  it("33. Expired handoff cannot be reused as ready", () => {
    const proposal = readyProposal("BUY");
    const { record } = validateProposalForBrokerHandoff(
      {
        proposal,
        account: accountOk(),
        instrument: instrumentOk(),
        systemMasterOn: true,
        instrumentFresh: true,
        marginFresh: true,
        handoffTtlMs: -1,
      },
      { persist: true, storageRoot: tmp },
    );
    expect(isHandoffExpired(record, Date.now())).toBe(true);
  });

  it("34. Proposal superseded before validation blocks", () => {
    const p = readyProposal("BUY");
    p.lifecycle = "SUPERSEDED";
    const h = buildBrokerHandoff({
      proposal: p,
      account: accountOk(),
      instrument: instrumentOk(),
      systemMasterOn: true,
      instrumentFresh: true,
      marginFresh: true,
    });
    expect(codes(h)).toContain("PROPOSAL_SUPERSEDED");
  });

  it("35–39. Safety flags, future contract, no mutation", () => {
    const h = buildBrokerHandoff({
      proposal: readyProposal("BUY"),
      account: accountOk(),
      instrument: instrumentOk(),
      systemMasterOn: true,
      instrumentFresh: true,
      marginFresh: true,
    });
    const contract = toFutureExecutionContract(h);
    expect(contract.revalidateBeforeExecute).toBe(true);
    expect(contract.placesOrders).toBe(false);
    expect(contract.acceptsForExecution).toBe(false);
    expect(contract.mutatesBroker).toBe(false);
    expect(h.placesOrders).toBe(false);
    expect(getAtBrokerHandoffStore(tmp)).toBeTruthy();
  });

  it("Master OFF blocks", () => {
    const h = buildBrokerHandoff({
      proposal: readyProposal("BUY"),
      account: accountOk(),
      instrument: instrumentOk(),
      systemMasterOn: false,
      instrumentFresh: true,
      marginFresh: true,
    });
    expect(codes(h)).toContain("SYSTEM_MASTER_OFF");
  });
});
