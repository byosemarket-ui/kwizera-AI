/**
 * Stage 3 — Risk policy configuration & order readiness (fail-closed; no broker mutation).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  applyApprovedSlippage,
  applyApprovedSpread,
  attestProposedOrderMargin,
  auditOrderReadiness,
  executableMarketPrice,
  measureSlippageAbsolute,
  resetAtRiskPolicyStoreForTests,
  resolveSlippageLimit,
  resolveSpreadLimit,
  STAGE3_TRACKED_INSTRUMENTS,
  validateAbsolutePriceLimit,
} from "../../../../ai/forex-ai/automated-trading/risk-policy/index.js";
import {
  runPreExecutionValidation,
  OWNER_MAX_LOTS_EXECUTION,
  type AtPreExecutionValidationInput,
} from "../../../../ai/forex-ai/automated-trading/broker-execution/index.js";
import type { AtBrokerHandoffRecord } from "../../../../ai/forex-ai/automated-trading/broker-compatibility/types.js";
import type { AtOrderProposalRecord } from "../../../../ai/forex-ai/automated-trading/order-proposal/types.js";
import { buildOrderProposal } from "../../../../ai/forex-ai/automated-trading/order-proposal/index.js";
import type { AtOrderPreparationHandoff } from "../../../../ai/forex-ai/automated-trading/result-intake/types.js";

const tmpDirs: string[] = [];

afterEach(() => {
  delete process.env.KWIZERA_AT_MAX_SPREAD_ABSOLUTE;
  for (const d of tmpDirs.splice(0)) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* ignore */ }
  }
});

function tempStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "at-risk-policy-"));
  tmpDirs.push(dir);
  return resetAtRiskPolicyStoreForTests(path.join(dir, "risk-policy.json"));
}

function hasCode(r: { blockingReasons: { code: string }[] }, code: string): boolean {
  return r.blockingReasons.some((b) => b.code === code);
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
    brokerPrep: {
      ...base.brokerPrep,
      accountReference: "DEMO***123",
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
      updatedAtUtc: proposal.updatedAtUtc || now,
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

function basePrecheck(over: Partial<AtPreExecutionValidationInput> = {}): AtPreExecutionValidationInput {
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
      emergencyEntryLock: true,
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

describe("Stage 3 — spread policy", () => {
  it("keeps missing spread policy NOT_CONFIGURED", () => {
    const store = tempStore();
    const doc = store.get();
    for (const inst of STAGE3_TRACKED_INSTRUMENTS) {
      expect(doc.instruments[inst].spread.status).toBe("NOT_CONFIGURED");
      expect(doc.instruments[inst].spread.maxSpreadAbsolute).toBeNull();
    }
    const resolved = resolveSpreadLimit({ instrument: "EUR/USD", store });
    expect(resolved.status).toBe("NOT_CONFIGURED");
    expect(resolved.value).toBeNull();
  });

  it("rejects invalid spread policy", () => {
    expect(validateAbsolutePriceLimit(-1).ok).toBe(false);
    expect(validateAbsolutePriceLimit(0).ok).toBe(false);
    expect(applyApprovedSpread("EUR/USD", -0.5, "owner", new Date().toISOString()).ok).toBe(false);
    const store = tempStore();
    expect(store.setSpread({ instrument: "EUR/USD", maxSpreadAbsolute: -1, actor: "owner" }).ok).toBe(false);
  });

  it("accepts valid approved spread policy and resolves it", () => {
    const store = tempStore();
    const set = store.setSpread({
      instrument: "EUR/USD",
      maxSpreadAbsolute: 0.0003,
      actor: "owner",
      pricePrecision: 5,
    });
    expect(set.ok).toBe(true);
    if (!set.ok) return;
    expect(set.document.instruments["EUR/USD"].spread.status).toBe("VERIFIED");
    expect(set.document.audit.some((a) => a.action === "SET_SPREAD")).toBe(true);
    const resolved = resolveSpreadLimit({ instrument: "EUR/USD", store });
    expect(resolved.source).toBe("instrument_policy");
    expect(resolved.value).toBe(0.0003);
    const result = runPreExecutionValidation(basePrecheck({
      riskLimits: { maxSpreadAbsolute: resolved.value, maxSlippageAbsolute: 0.01 },
    }));
    expect(result.checks.find((c) => c.id === "spread_limit")?.verdict).toBe("PASS");
  });
});

describe("Stage 3 — slippage policy", () => {
  it("keeps missing slippage policy NOT_CONFIGURED (mandatory precheck block)", () => {
    const store = tempStore();
    expect(store.get().instruments["EUR/USD"].slippage.status).toBe("NOT_CONFIGURED");
    expect(resolveSlippageLimit({ instrument: "EUR/USD", store }).status).toBe("NOT_CONFIGURED");
    const result = runPreExecutionValidation(basePrecheck({
      riskLimits: { maxSpreadAbsolute: 0.001, maxSlippageAbsolute: null },
    }));
    expect(hasCode(result, "SLIPPAGE_LIMIT_NOT_CONFIGURED")).toBe(true);
    expect(result.allowed).toBe(false);
  });

  it("rejects invalid slippage data / policy", () => {
    expect(applyApprovedSlippage("EUR/USD", 0, "owner", new Date().toISOString()).ok).toBe(false);
    expect(executableMarketPrice("BUY", 1.1, null).ok).toBe(false);
    expect(measureSlippageAbsolute(null, 1.1).ok).toBe(false);
  });

  it("blocks stale quotes", () => {
    const result = runPreExecutionValidation(basePrecheck({
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
    expect(hasCode(result, "STALE_MARKET_DATA")).toBe(true);
  });

  it("uses approved slippage limit against entry vs ask for BUY", () => {
    const store = tempStore();
    store.setSlippage({ instrument: "EUR/USD", maxSlippageAbsolute: 0.00005, actor: "owner" });
    expect(resolveSlippageLimit({ instrument: "EUR/USD", store }).value).toBe(0.00005);
    // entry 1.1 vs ask ~1.1001 → slip ~0.0001 > 0.00005
    const result = runPreExecutionValidation(basePrecheck({
      riskLimits: { maxSpreadAbsolute: 0.001, maxSlippageAbsolute: 0.00005 },
    }));
    expect(hasCode(result, "EXCESSIVE_SLIPPAGE")).toBe(true);
  });
});

describe("Stage 3 — proposed-order margin attestation", () => {
  it("marks missing proposed-order margin metadata unavailable", () => {
    const a = attestProposedOrderMargin({
      usableMargin: 9_000,
      contractVerified: false,
      lots: 0.01,
    });
    expect(a.status).toBe("UNAVAILABLE");
  });

  it("blocks when MMR missing even if contract claimed verified", () => {
    const a = attestProposedOrderMargin({
      usableMargin: 9_000,
      contractVerified: true,
      lots: 0.01,
      mmrPerLot: null,
      baseUnitSize: null,
    });
    expect(a.status).toBe("UNAVAILABLE");
  });

  it("distinguishes usable margin from required (mmr × lots)", () => {
    const ok = attestProposedOrderMargin({
      usableMargin: 9_000,
      mmrPerLot: 50,
      lots: 0.01,
      contractVerified: true,
      baseUnitSize: 1000,
    });
    expect(ok.status).toBe("VERIFIED");
    expect(ok.requiredMargin).toBeCloseTo(0.5, 8);
    expect(ok.requiredMarginSource).toBe("mmr_per_lot_x_lots");

    const insuf = attestProposedOrderMargin({
      usableMargin: 0.1,
      mmrPerLot: 50,
      lots: 0.01,
      contractVerified: true,
      baseUnitSize: 1000,
    });
    expect(insuf.status).toBe("INSUFFICIENT");
  });

  it("precheck uses attestation when proposal estimatedMargin missing", () => {
    const proposal = readyProposal();
    proposal.quantity.estimatedMargin = null;
    const handoff = readyHandoff(proposal, {
      riskCapital: {
        strategyAllocationPercent: 10,
        strategyAllocationBudget: 1000,
        individualOrderAllocation: 500,
        riskTargetPercent: 20,
        maximumRiskPercent: 25,
        allowedRiskAmount: 100,
        projectedLossAtStopLoss: 50,
        plannedRewardRisk: 3,
        requiredMargin: null,
        availableMargin: 8000,
        projectedExposure: 500,
        remainingAllocation: 500,
        riskPolicyVersion: proposal.capital.riskPolicyVersion,
      },
    });
    const result = runPreExecutionValidation(basePrecheck({
      proposal,
      handoff,
      instrumentContract: {
        baseUnitSize: 100,
        minQuantity: 1,
        quantityStep: 1,
        mmrPerLot: 50,
        contractVerified: true,
      },
    }));
    expect(result.checks.find((c) => c.id === "margin")?.verdict).toBe("PASS");
  });
});

describe("Stage 3 — handoff/proposal lifecycle readiness", () => {
  it("detects proposal version / snapshot mismatch", () => {
    const proposal = readyProposal({ updatedAtUtc: "2026-11-06T20:00:00.000Z" });
    const handoff = readyHandoff(proposal, {
      provenance: {
        handoffId: "handoff-1",
        schemaVersion: "at-broker-handoff-v1",
        createdAtUtc: "2026-11-06T17:00:00.000Z",
        updatedAtUtc: "2026-11-06T17:00:00.000Z",
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
    });
    const audit = auditOrderReadiness({ proposal, handoff, nowMs: Date.parse("2026-11-06T18:00:00.000Z") });
    expect(audit.findings.some((f) => f.code === "STALE_PROPOSAL_SNAPSHOT")).toBe(true);
    expect(hasCode(runPreExecutionValidation(basePrecheck({ proposal, handoff })), "STALE_PROPOSAL_SNAPSHOT")).toBe(true);
  });

  it("detects account identity mismatch", () => {
    const proposal = readyProposal();
    proposal.brokerPrep.accountReference = "****9999";
    const result = runPreExecutionValidation(basePrecheck({
      proposal,
      handoff: readyHandoff(proposal),
      account: {
        equity: 10_000,
        balance: 10_000,
        usableMargin: 8_000,
        usedMargin: 100,
        currency: "USD",
        accountIdMasked: "DEMO***123",
        fetchedAtMs: Date.now() - 1_000,
        isFresh: true,
      },
    }));
    expect(hasCode(result, "ACCOUNT_IDENTITY_MISMATCH")).toBe(true);
  });

  it("blocks missing SL/TP and invalid GTD expiry", () => {
    const proposal = readyProposal();
    proposal.pricePlan.stopLoss = null as unknown as number;
    proposal.brokerPrep.stopLoss = null;
    proposal.pricePlan.takeProfit = null as unknown as number;
    proposal.brokerPrep.takeProfit = null;
    proposal.brokerPrep.timeInForce = "GTD";
    proposal.brokerPrep.expiration = "2020-01-01T00:00:00.000Z";
    const handoff = readyHandoff(proposal, {
      directionOrder: {
        ...readyHandoff(proposal).directionOrder,
        stopLoss: null,
        takeProfit: null,
        timeInForce: "GTD",
        expiration: "2020-01-01T00:00:00.000Z",
      },
    });
    const result = runPreExecutionValidation(basePrecheck({ proposal, handoff }));
    expect(hasCode(result, "INVALID_STOP_LOSS")).toBe(true);
    expect(hasCode(result, "INVALID_TAKE_PROFIT")).toBe(true);
    expect(hasCode(result, "INVALID_GTD_EXPIRY")).toBe(true);
  });

  it("blocks superseded proposals and unverified contract", () => {
    const proposal = readyProposal({ lifecycle: "SUPERSEDED" });
    const handoff = readyHandoff(proposal, { lifecycle: "SUPERSEDED" });
    const result = runPreExecutionValidation(basePrecheck({
      proposal,
      handoff,
      instrumentContract: {
        baseUnitSize: null,
        minQuantity: 1,
        quantityStep: 1,
        mmrPerLot: 50,
        contractVerified: false,
      },
    }));
    expect(hasCode(result, "PROPOSAL_SUPERSEDED")).toBe(true);
    expect(hasCode(result, "HANDOFF_SUPERSEDED")).toBe(true);
    expect(hasCode(result, "BROKER_QUANTITY_CONTRACT_FAILED")).toBe(true);
  });

  it("blocks duplicate exposure suspicion", () => {
    const result = runPreExecutionValidation(basePrecheck({
      exposure: {
        openExposureLots: 0.01,
        openPositionCount: 1,
        exposureAuthoritative: true,
        duplicateTradeSuspected: true,
        dayRealizedPnlAccount: 0,
        dayStartEquity: 10_000,
      },
    }));
    expect(
      hasCode(result, "DUPLICATE_TRADE")
      || result.checks.some((c) => c.id === "duplicate" && c.verdict === "FAIL"),
    ).toBe(true);
  });
});

describe("Stage 3 — fail-closed safety", () => {
  it("keeps precheck blocked and execution stamps false", () => {
    const result = runPreExecutionValidation(basePrecheck({
      riskLimits: { maxSpreadAbsolute: null, maxSlippageAbsolute: null },
    }));
    expect(result.allowed).toBe(false);
    expect(result.placesOrders).toBe(false);
    expect(result.acceptsForExecution).toBe(false);
    expect(result.mutatesBroker).toBe(false);
    expect(result.executionAuthorized).toBe(false);
    expect(result.ownerMaxLots).toBe(OWNER_MAX_LOTS_EXECUTION);
    expect(hasCode(result, "EXECUTION_MASTER_OFF")).toBe(true);
    expect(hasCode(result, "SPREAD_LIMIT_NOT_CONFIGURED")).toBe(true);
    expect(hasCode(result, "SLIPPAGE_LIMIT_NOT_CONFIGURED")).toBe(true);
  });
});
