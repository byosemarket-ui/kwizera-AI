/**
 * Phase 2 — Final pre-execution validator tests (non-mutating).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  applyPreExecutionValidation,
  getAtBrokerExecutionStore,
  resetAtBrokerExecutionStoreForTests,
  runPreExecutionValidation,
  OWNER_MAX_LOTS_EXECUTION,
  type AtPreExecutionValidationInput,
} from "../../../../ai/forex-ai/automated-trading/broker-execution/index.js";
import type { AtBrokerHandoffRecord } from "../../../../ai/forex-ai/automated-trading/broker-compatibility/types.js";
import type { AtOrderProposalRecord } from "../../../../ai/forex-ai/automated-trading/order-proposal/types.js";
import { buildOrderProposal } from "../../../../ai/forex-ai/automated-trading/order-proposal/index.js";
import type { AtOrderPreparationHandoff } from "../../../../ai/forex-ai/automated-trading/result-intake/types.js";

function codes(r: { blockingReasons: { code: string }[] }): string[] {
  return r.blockingReasons.map((b) => String(b.code));
}

function hasCode(r: { blockingReasons: { code: string }[] }, code: string): boolean {
  return codes(r).includes(code);
}

function checkVerdict(
  r: { checks: { id: string; verdict: string; code: string }[] },
  id: string,
): string | undefined {
  return r.checks.find((c) => c.id === id)?.verdict;
}

function intakeHandoff(): AtOrderPreparationHandoff {
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

function readyProposal(over: Partial<AtOrderProposalRecord> = {}): AtOrderProposalRecord {
  const entry = 1.1;
  const stop = 1.099;
  const tp = entry + 3 * (entry - stop);
  const base = buildOrderProposal({
    handoff: intakeHandoff(),
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
    contract: {
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
    },
    contractFresh: true,
    sdkMinQuantity: 1,
    marginPerUnitAccount: 50,
    exposureAuthoritative: true,
    existingExposure: 0,
    systemMasterOn: true,
    tradingEnabled: false,
    emergencyEntryLock: true,
  });
  return {
    ...base,
    lifecycle: "PROPOSAL_READY",
    direction: "BUY",
    canonicalDecision: "BUY",
    instrument: "EUR/USD",
    blockers: [],
    quantity: {
      ...base.quantity,
      normalizedQuantity: 0.01,
      calculatedQuantity: 0.01,
      estimatedMargin: 0.5,
      availableMargin: 8000,
      ownerMaxQuantity: 0.01,
    },
    pricePlan: {
      ...base.pricePlan,
      entryPrice: entry,
      stopLoss: stop,
      takeProfit: tp,
      plannedRewardRiskRatio: 3,
      riskDistance: entry - stop,
      rewardDistance: 3 * (entry - stop),
      takeProfitLabel: "3R_PLANNED_TARGET",
      takeProfitNote: "planned",
      entryType: "EXPLICIT",
      entryZoneLow: null,
      entryZoneHigh: null,
      invalidationConditions: [],
    },
    capital: {
      ...base.capital,
      riskPolicyVersion: "per-order-risk-v2-20target-25max",
      strategyAllocationPercent: 10,
      individualOrderAllocation: 500,
      riskValidationStatus: "PASS",
    },
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    ...over,
  };
}

function readyHandoff(proposal: AtOrderProposalRecord, over: Partial<AtBrokerHandoffRecord> = {}): AtBrokerHandoffRecord {
  const now = new Date().toISOString();
  return {
    schemaVersion: "at-broker-handoff-v1",
    phase: "4.18G.3",
    idempotencyKey: "idem-h1",
    lifecycle: "HANDOFF_READY",
    provenance: {
      handoffId: "handoff-1",
      schemaVersion: "at-broker-handoff-v1",
      createdAtUtc: now,
      updatedAtUtc: now,
      proposalId: proposal.proposalId,
      proposalSchemaVersion: proposal.schemaVersion,
      analysisId: proposal.analysisId,
      resultIntakeId: proposal.resultIntakeId,
      observationId: proposal.observationId,
      imageId: proposal.imageId,
      imageHash: proposal.imageHash,
      instrument: "EUR/USD",
      timeframe: "H1",
      strategyId: null,
      riskPolicyVersion: proposal.capital.riskPolicyVersion,
      environment: "DEMO",
    },
    account: {
      broker: "FXCM",
      brokerPlatform: "FOREXCONNECT",
      accountReference: "DEMO***123",
      accountCurrency: "USD",
      accountType: "DEMO",
      accountStatus: "ACTIVE",
      accountMetadataTimestamp: now,
      accountConnected: true,
      accountAuthenticated: true,
      accountDataFresh: true,
      equity: 10_000,
      usedMargin: 100,
      availableMargin: 8_000,
    },
    instrument: {
      symbol: "EUR/USD",
      offerId: "offer-1",
      instrumentType: "Forex",
      baseCurrency: "EUR",
      quoteCurrency: "USD",
      contractSize: 100000,
      lotSize: 100000,
      amountUnit: "contracts",
      minimumAmount: 1,
      maximumAmount: null,
      amountStep: 1,
      tickSize: 0.00001,
      pipSize: 0.00001,
      pricePrecision: 5,
      pipValue: 1,
      tickValue: 1,
      tradingStatus: "O",
      tradingSession: "OPEN",
      marginRequirement: 50,
      instrumentMetadataTimestamp: now,
      contractVerified: true,
    },
    directionOrder: {
      canonicalDecision: "BUY",
      brokerBuySell: "B",
      orderType: "LIMIT",
      amount: 1,
      normalizedQuantity: 0.01,
      ownerMaxLots: 0.01,
      entryPrice: proposal.pricePlan.entryPrice,
      entryZoneLow: null,
      entryZoneHigh: null,
      stopLoss: proposal.pricePlan.stopLoss,
      takeProfit: proposal.pricePlan.takeProfit,
      timeInForce: "GTC",
      expiration: null,
      clientReference: proposal.proposalId,
      brokerOrderId: null,
      brokerTradeId: null,
    },
    riskCapital: {
      strategyAllocationPercent: 10,
      strategyAllocationBudget: 1000,
      individualOrderAllocation: 500,
      riskTargetPercent: 20,
      maximumRiskPercent: 25,
      allowedRiskAmount: 100,
      projectedLossAtStopLoss: 50,
      plannedRewardRisk: 3,
      requiredMargin: 0.5,
      availableMargin: 8000,
      projectedExposure: 500,
      remainingAllocation: 500,
      riskPolicyVersion: proposal.capital.riskPolicyVersion,
    },
    protection: {
      stopLossSupported: true,
      takeProfitSupported: true,
      attachmentMode: "POST_FILL_SEPARATE_PROTECTION",
      requiredProtectionWorkflow: "REQUIRES_POST_FILL_WORKFLOW",
      protectionCompatibilityStatus: "REQUIRES_POST_FILL_WORKFLOW",
      note: "test",
    },
    validationStatus: "PASS",
    validationTimestamp: now,
    passedChecks: [],
    failedChecks: [],
    warnings: [],
    blockers: [],
    expiresAtUtc: new Date(Date.now() + 3600_000).toISOString(),
    futureExecutionContractVersion: "at-future-execution-contract-v1",
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    note: "test handoff",
    ...over,
  };
}

function baseInput(over: Partial<AtPreExecutionValidationInput> = {}): AtPreExecutionValidationInput {
  const proposal = readyProposal();
  const handoff = readyHandoff(proposal);
  const nowMs = Date.now();
  return {
    handoff,
    proposal,
    expectedProposalId: proposal.proposalId,
    expectedHandoffId: "handoff-1",
    environment: "DEMO",
    controls: {
      emergencyEntryLock: false,
      masterEnable: false,
      automaticEntry: false,
      positionManagement: false,
    },
    foundation: {
      executionMasterEnabled: false,
      armedForSubmission: false,
      placesOrders: false,
      acceptsForExecution: false,
      mutatesBroker: false,
      lifecycle: "IDLE",
    },
    account: {
      equity: 10_000,
      balance: 10_000,
      usableMargin: 8_000,
      usedMargin: 100,
      currency: "USD",
      accountIdMasked: "DEMO***123",
      fetchedAtMs: nowMs - 1_000,
      isFresh: true,
    },
    market: {
      bid: 1.0999,
      ask: 1.1001,
      spread: 0.0002,
      quoteAgeMs: 500,
      tradingEligible: true,
      marketClosed: false,
      instrument: "EUR/USD",
    },
    exposure: {
      openExposureLots: 0,
      openPositionCount: 0,
      exposureAuthoritative: true,
      duplicateTradeSuspected: false,
      dayRealizedPnlAccount: 0,
      dayStartEquity: 10_000,
    },
    instrumentContract: {
      baseUnitSize: 100,
      minQuantity: 1,
      quantityStep: 1,
      mmrPerLot: 50,
      contractVerified: true,
    },
    riskLimits: {
      maxSpreadAbsolute: 0.001,
      maxSlippageAbsolute: 0.01,
    },
    nowMs,
    ...over,
  };
}

describe("Phase 4.18G.4-P2 pre-execution validator", () => {
  const roots: string[] = [];

  afterEach(() => {
    resetAtBrokerExecutionStoreForTests();
    for (const root of roots.splice(0)) {
      try {
        fs.rmSync(root, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  });

  function tempRoot(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "at-precheck-"));
    roots.push(root);
    return root;
  }

  it("1. valid handoff domain passes; Master OFF keeps allowed=false; lifecycle AUTHORIZATION_REQUIRED", () => {
    const input = baseInput();
    const r = runPreExecutionValidation(input);
    expect(hasCode(r, "HANDOFF_MISSING")).toBe(false);
    expect(hasCode(r, "HANDOFF_NOT_READY")).toBe(false);
    expect(hasCode(r, "EMERGENCY_LOCK")).toBe(false);
    expect(hasCode(r, "EXECUTION_MASTER_OFF")).toBe(true);
    expect(r.allowed).toBe(false);
    expect(r.executionAuthorized).toBe(false);
    expect(r.placesOrders).toBe(false);
    expect(r.acceptsForExecution).toBe(false);
    expect(r.mutatesBroker).toBe(false);
    expect(r.suggestedLifecycle).toBe("AUTHORIZATION_REQUIRED");
    expect(r.ownerMaxLots).toBe(OWNER_MAX_LOTS_EXECUTION);
  });

  it("2. missing handoff blocks", () => {
    const r = runPreExecutionValidation(baseInput({ handoff: null }));
    expect(hasCode(r, "HANDOFF_MISSING")).toBe(true);
    expect(r.suggestedLifecycle).toBe("PRECHECK_BLOCKED");
    expect(r.allowed).toBe(false);
  });

  it("3. expired handoff blocks", () => {
    const proposal = readyProposal();
    const handoff = readyHandoff(proposal, {
      expiresAtUtc: new Date(Date.now() - 60_000).toISOString(),
    });
    const r = runPreExecutionValidation(baseInput({ handoff, proposal, expectedProposalId: proposal.proposalId }));
    expect(hasCode(r, "HANDOFF_EXPIRED")).toBe(true);
    expect(r.suggestedLifecycle).toBe("PRECHECK_BLOCKED");
  });

  it("4. superseded proposal blocks", () => {
    const proposal = readyProposal({ lifecycle: "SUPERSEDED" });
    const handoff = readyHandoff(proposal);
    const r = runPreExecutionValidation(baseInput({
      proposal,
      handoff,
      expectedProposalId: proposal.proposalId,
    }));
    expect(hasCode(r, "PROPOSAL_SUPERSEDED")).toBe(true);
  });

  it("5. proposal mismatch blocks", () => {
    const proposal = readyProposal();
    const handoff = readyHandoff(proposal);
    const r = runPreExecutionValidation(baseInput({
      proposal,
      handoff,
      expectedProposalId: "other-proposal",
    }));
    expect(hasCode(r, "PROPOSAL_MISMATCH") || hasCode(r, "HANDOFF_PROPOSAL_MISMATCH")).toBe(true);
  });

  it("6. instrument mismatch blocks", () => {
    const proposal = readyProposal({ instrument: "XAU/USD" });
    const handoff = readyHandoff(proposal);
    const r = runPreExecutionValidation(baseInput({
      proposal,
      handoff,
      expectedProposalId: proposal.proposalId,
    }));
    expect(hasCode(r, "INSTRUMENT_MISMATCH")).toBe(true);
  });

  it("7. invalid quantity blocks", () => {
    const proposal = readyProposal();
    proposal.quantity.normalizedQuantity = null;
    const handoff = readyHandoff(proposal);
    handoff.directionOrder.normalizedQuantity = null;
    const r = runPreExecutionValidation(baseInput({
      proposal,
      handoff,
      expectedProposalId: proposal.proposalId,
    }));
    expect(hasCode(r, "INVALID_QUANTITY")).toBe(true);
  });

  it("8. quantity above 0.01 blocks", () => {
    const proposal = readyProposal();
    proposal.quantity.normalizedQuantity = 0.02;
    const handoff = readyHandoff(proposal);
    handoff.directionOrder.normalizedQuantity = 0.02;
    const r = runPreExecutionValidation(baseInput({
      proposal,
      handoff,
      expectedProposalId: proposal.proposalId,
    }));
    expect(hasCode(r, "OWNER_MAX_QUANTITY_EXCEEDED")).toBe(true);
  });

  it("9. insufficient margin blocks", () => {
    const proposal = readyProposal();
    proposal.quantity.estimatedMargin = 9000;
    const handoff = readyHandoff(proposal);
    handoff.riskCapital.requiredMargin = 9000;
    const r = runPreExecutionValidation(baseInput({
      proposal,
      handoff,
      expectedProposalId: proposal.proposalId,
      account: {
        equity: 10_000,
        balance: 10_000,
        usableMargin: 100,
        usedMargin: 100,
        currency: "USD",
        accountIdMasked: "DEMO***",
        fetchedAtMs: Date.now(),
        isFresh: true,
      },
    }));
    expect(hasCode(r, "INSUFFICIENT_AVAILABLE_MARGIN")).toBe(true);
  });

  it("10. missing account data blocks", () => {
    const r = runPreExecutionValidation(baseInput({ account: null }));
    expect(hasCode(r, "MISSING_ACCOUNT_DATA")).toBe(true);
  });

  it("11. stale account data blocks", () => {
    const r = runPreExecutionValidation(baseInput({
      account: {
        equity: 10_000,
        balance: 10_000,
        usableMargin: 8_000,
        usedMargin: 100,
        currency: "USD",
        accountIdMasked: "DEMO***",
        fetchedAtMs: Date.now() - 60_000,
        isFresh: false,
      },
    }));
    expect(hasCode(r, "STALE_ACCOUNT_DATA")).toBe(true);
  });

  it("12. Emergency Lock ON blocks", () => {
    const r = runPreExecutionValidation(baseInput({
      controls: {
        emergencyEntryLock: true,
        masterEnable: false,
        automaticEntry: false,
      },
    }));
    expect(hasCode(r, "EMERGENCY_LOCK")).toBe(true);
    expect(checkVerdict(r, "emergency_lock")).toBe("FAIL");
    expect(r.suggestedLifecycle).toBe("PRECHECK_BLOCKED");
  });

  it("13. Emergency Lock OFF passes permission check (Master OFF still blocks allowed)", () => {
    const r = runPreExecutionValidation(baseInput({
      controls: {
        emergencyEntryLock: false,
        masterEnable: false,
        automaticEntry: false,
      },
    }));
    expect(hasCode(r, "EMERGENCY_LOCK")).toBe(false);
    expect(checkVerdict(r, "emergency_lock")).toBe("PASS");
    expect(hasCode(r, "EXECUTION_MASTER_OFF")).toBe(true);
    expect(r.allowed).toBe(false);
    expect(r.executionAuthorized).toBe(false);
  });

  it("14. Execution Master OFF hard-blocks allowed", () => {
    const r = runPreExecutionValidation(baseInput());
    expect(hasCode(r, "EXECUTION_MASTER_OFF")).toBe(true);
    expect(r.allowed).toBe(false);
    expect(r.brokerExecution).toBe("DISABLED");
  });

  it("15. missing safety controls blocks", () => {
    const r = runPreExecutionValidation(baseInput({ controls: null, foundation: null }));
    expect(hasCode(r, "CONTROLS_MISSING")).toBe(true);
    expect(hasCode(r, "FOUNDATION_MISSING")).toBe(true);
  });

  it("16. duplicate trade blocks", () => {
    const r = runPreExecutionValidation(baseInput({
      exposure: {
        openExposureLots: 0,
        openPositionCount: 0,
        exposureAuthoritative: true,
        duplicateTradeSuspected: true,
        dayRealizedPnlAccount: 0,
        dayStartEquity: 10_000,
      },
    }));
    expect(hasCode(r, "DUPLICATE_TRADE")).toBe(true);
  });

  it("17. daily loss limit blocks when exceeded", () => {
    const r = runPreExecutionValidation(baseInput({
      exposure: {
        openExposureLots: 0,
        openPositionCount: 0,
        exposureAuthoritative: true,
        duplicateTradeSuspected: false,
        dayRealizedPnlAccount: -30,
        dayStartEquity: 10_000,
      },
      riskLimits: { maxDailyLossAccount: 25, maxSpreadAbsolute: 0.001 },
    }));
    expect(hasCode(r, "MAX_DAILY_LOSS_EXCEEDED")).toBe(true);
  });

  it("18. drawdown limit blocks when exceeded", () => {
    const r = runPreExecutionValidation(baseInput({
      account: {
        equity: 9_500,
        balance: 9_500,
        usableMargin: 8_000,
        usedMargin: 100,
        currency: "USD",
        accountIdMasked: "DEMO***",
        fetchedAtMs: Date.now(),
        isFresh: true,
      },
      exposure: {
        openExposureLots: 0,
        openPositionCount: 0,
        exposureAuthoritative: true,
        duplicateTradeSuspected: false,
        dayRealizedPnlAccount: 0,
        dayStartEquity: 10_000,
      },
      riskLimits: {
        maxDrawdownFractionOfDayStartEquity: 0.03,
        maxSpreadAbsolute: 0.001,
      },
    }));
    expect(hasCode(r, "MAX_DRAWDOWN_EXCEEDED")).toBe(true);
  });

  it("19. concurrent position limit blocks", () => {
    const r = runPreExecutionValidation(baseInput({
      exposure: {
        openExposureLots: 0,
        openPositionCount: 1,
        exposureAuthoritative: true,
        duplicateTradeSuspected: false,
        dayRealizedPnlAccount: 0,
        dayStartEquity: 10_000,
      },
      riskLimits: { maxOpenPositions: 1, maxSpreadAbsolute: 0.001 },
    }));
    expect(hasCode(r, "MAX_OPEN_POSITIONS_EXCEEDED")).toBe(true);
  });

  it("20. stale market data blocks", () => {
    const r = runPreExecutionValidation(baseInput({
      market: {
        bid: 1.1,
        ask: 1.1002,
        spread: 0.0002,
        quoteAgeMs: 60_000,
        tradingEligible: true,
        marketClosed: false,
        instrument: "EUR/USD",
      },
    }));
    expect(hasCode(r, "STALE_MARKET_DATA")).toBe(true);
  });

  it("21. excessive spread blocks when limit configured", () => {
    const r = runPreExecutionValidation(baseInput({
      market: {
        bid: 1.1,
        ask: 1.105,
        spread: 0.005,
        quoteAgeMs: 200,
        tradingEligible: true,
        marketClosed: false,
        instrument: "EUR/USD",
      },
      riskLimits: { maxSpreadAbsolute: 0.001 },
    }));
    expect(hasCode(r, "EXCESSIVE_SPREAD")).toBe(true);
  });

  it("21b. missing spread limit fails closed without inventing a threshold", () => {
    const r = runPreExecutionValidation(baseInput({
      riskLimits: { maxSpreadAbsolute: null },
    }));
    expect(hasCode(r, "SPREAD_LIMIT_NOT_CONFIGURED")).toBe(true);
  });

  it("22. invalid stop-loss blocks", () => {
    const proposal = readyProposal();
    proposal.pricePlan.stopLoss = null;
    const handoff = readyHandoff(proposal);
    handoff.directionOrder.stopLoss = null;
    const r = runPreExecutionValidation(baseInput({
      proposal,
      handoff,
      expectedProposalId: proposal.proposalId,
    }));
    expect(hasCode(r, "INVALID_STOP_LOSS")).toBe(true);
  });

  it("23. invalid take-profit blocks", () => {
    const proposal = readyProposal();
    proposal.pricePlan.takeProfit = null;
    const handoff = readyHandoff(proposal);
    handoff.directionOrder.takeProfit = null;
    const r = runPreExecutionValidation(baseInput({
      proposal,
      handoff,
      expectedProposalId: proposal.proposalId,
    }));
    expect(hasCode(r, "INVALID_TAKE_PROFIT")).toBe(true);
  });

  it("24. missing risk configuration blocks", () => {
    const proposal = readyProposal();
    proposal.capital.riskPolicyVersion = "";
    proposal.capital.strategyAllocationPercent = null;
    proposal.capital.individualOrderAllocation = null;
    const handoff = readyHandoff(proposal);
    handoff.riskCapital.riskPolicyVersion = null;
    handoff.riskCapital.individualOrderAllocation = null;
    const r = runPreExecutionValidation(baseInput({
      proposal,
      handoff,
      expectedProposalId: proposal.proposalId,
    }));
    expect(
      hasCode(r, "RISK_CONFIG_MISSING") || hasCode(r, "CAPITAL_NOT_CONFIGURED"),
    ).toBe(true);
  });

  it("25. applyPrecheck transitions to PRECHECK_BLOCKED and survives store reload", () => {
    const root = tempRoot();
    const applied = applyPreExecutionValidation({
      ...baseInput({
        controls: {
          emergencyEntryLock: true,
          masterEnable: false,
          automaticEntry: false,
        },
      }),
      storageRoot: root,
      actor: "test",
      correlationId: "corr-precheck-1",
    });
    expect(applied.validation.suggestedLifecycle).toBe("PRECHECK_BLOCKED");
    expect(applied.lifecycleAfter).toBe("PRECHECK_BLOCKED");
    expect(applied.placesOrders).toBe(false);
    expect(applied.mutatesBroker).toBe(false);
    expect(applied.executionAuthorized).toBe(false);

    resetAtBrokerExecutionStoreForTests();
    const reloaded = getAtBrokerExecutionStore(root).get();
    expect(reloaded.lifecycle).toBe("PRECHECK_BLOCKED");
    expect(reloaded.executionMasterEnabled).toBe(false);
    expect(reloaded.armedForSubmission).toBe(false);
    expect(reloaded.placesOrders).toBe(false);
    expect(reloaded.acceptsForExecution).toBe(false);
    expect(reloaded.mutatesBroker).toBe(false);
  });

  it("25b. domain-ready apply moves to AUTHORIZATION_REQUIRED without enabling submit", () => {
    const root = tempRoot();
    const applied = applyPreExecutionValidation({
      ...baseInput(),
      storageRoot: root,
      actor: "test",
    });
    expect(applied.lifecycleAfter).toBe("AUTHORIZATION_REQUIRED");
    expect(applied.validation.allowed).toBe(false);
    expect(getAtBrokerExecutionStore(root).get().executionMasterEnabled).toBe(false);
    expect(getAtBrokerExecutionStore(root).get().armedForSubmission).toBe(false);
  });

  it("never enters READY_TO_SUBMIT from precheck", () => {
    const root = tempRoot();
    applyPreExecutionValidation({ ...baseInput(), storageRoot: root });
    expect(getAtBrokerExecutionStore(root).get().lifecycle).not.toBe("READY_TO_SUBMIT");
    const denied = getAtBrokerExecutionStore(root).transitionLifecycle(
      "READY_TO_SUBMIT",
      "test",
      "probe",
    );
    expect(denied.ok).toBe(false);
  });
});

describe("Phase 2 regression — proposal generation control hardcoding", () => {
  it("buildOrderProposal records emergency lock observation without blocking proposal-only construction", () => {
    const record = buildOrderProposal({
      handoff: intakeHandoff(),
      entryPrice: 1.1,
      stopLoss: 1.099,
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
      contract: {
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
      },
      contractFresh: true,
      sdkMinQuantity: 1,
      marginPerUnitAccount: 50,
      exposureAuthoritative: true,
      existingExposure: 0,
      systemMasterOn: true,
      tradingEnabled: false,
      emergencyEntryLock: true,
    });
    expect(record.blockers.some((b) => b.code === "EMERGENCY_LOCK")).toBe(false);
    expect(record.blockers.some((b) => b.code === "TRADING_DISABLED")).toBe(false);
    expect(record.notes.some((n) => /emergencyEntryLock=ON/i.test(n))).toBe(true);
    expect(record.placesOrders).toBe(false);
    expect(record.acceptsForExecution).toBe(false);
    expect(record.mutatesBroker).toBe(false);
  });
});
