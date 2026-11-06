/**
 * Stage 2 — Live read-only risk intelligence (fail-closed; no broker mutation).
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  buildRiskIntelligenceSnapshot,
  readConfiguredMaxSpreadAbsolute,
  type RiskIntelligenceGatherInput,
} from "../../../../ai/forex-ai/automated-trading/risk-intelligence/index.js";
import {
  runPreExecutionValidation,
  OWNER_MAX_LOTS_EXECUTION,
  type AtPreExecutionValidationInput,
} from "../../../../ai/forex-ai/automated-trading/broker-execution/index.js";
import type { AtBrokerHandoffRecord } from "../../../../ai/forex-ai/automated-trading/broker-compatibility/types.js";
import type { AtOrderProposalRecord } from "../../../../ai/forex-ai/automated-trading/order-proposal/types.js";
import { buildOrderProposal } from "../../../../ai/forex-ai/automated-trading/order-proposal/index.js";
import type { AtOrderPreparationHandoff } from "../../../../ai/forex-ai/automated-trading/result-intake/types.js";

const NOW = Date.parse("2026-11-06T12:00:00.000Z");
const FRESH_AT = "2026-11-06T11:59:55.000Z";

function baseAccounts(over: Record<string, unknown> = {}) {
  return {
    ok: true as const,
    count: 1,
    fetchedAt: FRESH_AT,
    accounts: [
      {
        accountId: "123456",
        accountIdMasked: "****3456",
        environment: "demo",
        accountCurrency: "USD",
        balance: 10_000,
        equity: 10_050,
        usedMargin: 50,
        usableMargin: 9_000,
        dayPl: -5,
        grossPl: 50,
        missingFields: [],
        ...over,
      },
    ],
  };
}

function emptyTradesOk() {
  return { ok: true, trades: [] as unknown[], fetchedAt: FRESH_AT, count: 0 };
}

function emptyClosedOk() {
  return { ok: true, closedTrades: [] as unknown[], fetchedAt: FRESH_AT, count: 0 };
}

function gather(
  over: Partial<RiskIntelligenceGatherInput> = {},
): RiskIntelligenceGatherInput {
  return {
    environment: "demo",
    instrument: "EUR/USD",
    accounts: baseAccounts(),
    trades: emptyTradesOk(),
    closedTrades: emptyClosedOk(),
    brokerConnected: true,
    forexConnectAvailable: true,
    baseUnitSize: 1000,
    contractVerified: true,
    bid: 1.1000,
    ask: 1.1002,
    quoteAgeMs: 500,
    priorDaily: null,
    nowMs: NOW,
    accountMaxAgeMs: 15_000,
    quoteMaxAgeMs: 5_000,
    ...over,
  };
}

afterEach(() => {
  delete process.env.KWIZERA_AT_MAX_SPREAD_ABSOLUTE;
});

describe("Stage 2 — account telemetry", () => {
  it("accepts a valid account snapshot", () => {
    const { snapshot } = buildRiskIntelligenceSnapshot(gather());
    expect(snapshot.account.meta.status).toBe("VERIFIED");
    expect(snapshot.account.equity).toBe(10_050);
    expect(snapshot.account.balance).toBe(10_000);
    expect(snapshot.account.usableMargin).toBe(9_000);
    expect(snapshot.account.isFresh).toBe(true);
    expect(snapshot.precheckAccount?.equity).toBe(10_050);
    expect(snapshot.placesOrders).toBe(false);
    expect(snapshot.mutatesBroker).toBe(false);
  });

  it("rejects missing balance (never coerces to zero)", () => {
    const { snapshot } = buildRiskIntelligenceSnapshot(gather({
      accounts: baseAccounts({ balance: null }),
    }));
    expect(snapshot.account.meta.status).toBe("INVALID");
    expect(snapshot.account.balance).toBeNull();
    expect(snapshot.account.missingFields).toContain("balance");
  });

  it("rejects missing equity", () => {
    const { snapshot } = buildRiskIntelligenceSnapshot(gather({
      accounts: baseAccounts({ equity: null }),
    }));
    expect(snapshot.account.meta.status).toBe("INVALID");
    expect(snapshot.account.equity).toBeNull();
  });

  it("rejects invalid numeric equity", () => {
    const { snapshot } = buildRiskIntelligenceSnapshot(gather({
      accounts: baseAccounts({ equity: Number.NaN }),
    }));
    expect(snapshot.account.meta.status).toBe("INVALID");
  });

  it("marks stale account snapshots", () => {
    const { snapshot } = buildRiskIntelligenceSnapshot(gather({
      accounts: { ...baseAccounts(), fetchedAt: "2026-11-06T11:00:00.000Z" },
    }));
    expect(snapshot.account.meta.status).toBe("STALE");
    expect(snapshot.account.isFresh).toBe(false);
  });

  it("rejects wrong account identity", () => {
    const { snapshot } = buildRiskIntelligenceSnapshot(gather({
      expectedAccountIdMasked: "****9999",
    }));
    expect(snapshot.account.meta.status).toBe("INVALID");
    expect(snapshot.account.meta.reason).toMatch(/masked id/i);
  });

  it("rejects incomplete multi-account response", () => {
    const accounts = baseAccounts();
    accounts.accounts.push({
      ...accounts.accounts[0],
      accountId: "999",
      accountIdMasked: "****9999",
    });
    accounts.count = 2;
    const { snapshot } = buildRiskIntelligenceSnapshot(gather({ accounts }));
    expect(snapshot.account.meta.status).toBe("INVALID");
    expect(snapshot.account.meta.reason).toMatch(/Multiple accounts/i);
  });

  it("marks ForexConnect unavailable", () => {
    const { snapshot } = buildRiskIntelligenceSnapshot(gather({
      forexConnectAvailable: false,
      brokerConnected: false,
      accounts: null,
    }));
    expect(snapshot.account.meta.status).toBe("UNAVAILABLE");
    expect(snapshot.exposure.exposureAuthoritative).toBe(false);
  });
});

describe("Stage 2 — exposure", () => {
  it("verifies zero open exposure from complete empty trades snapshot", () => {
    const { snapshot } = buildRiskIntelligenceSnapshot(gather());
    expect(snapshot.exposure.exposureAuthoritative).toBe(true);
    expect(snapshot.exposure.openExposureLots).toBe(0);
    expect(snapshot.exposure.openPositionCount).toBe(0);
    expect(snapshot.exposure.duplicateTradeSuspected).toBe(false);
    expect(snapshot.exposure.meta.status).toBe("VERIFIED");
  });

  it("computes one open position in lots", () => {
    const { snapshot } = buildRiskIntelligenceSnapshot(gather({
      trades: {
        ok: true,
        fetchedAt: FRESH_AT,
        trades: [{
          tradeId: "t1",
          instrument: "EUR/USD",
          buySell: "B",
          amount: 1000,
          openRate: 1.1,
          grossPL: 12,
        }],
      },
    }));
    expect(snapshot.exposure.openExposureLots).toBe(1);
    expect(snapshot.exposure.openPositionCount).toBe(1);
    expect(snapshot.exposure.duplicateTradeSuspected).toBe(true);
    expect(snapshot.exposure.exposureAuthoritative).toBe(true);
  });

  it("handles multiple instruments and long/short", () => {
    const { snapshot } = buildRiskIntelligenceSnapshot(gather({
      instrument: "EUR/USD",
      trades: {
        ok: true,
        fetchedAt: FRESH_AT,
        trades: [
          { tradeId: "t1", instrument: "EUR/USD", buySell: "B", amount: 1000, grossPL: 1 },
          { tradeId: "t2", instrument: "GBP/USD", buySell: "S", amount: 2000, grossPL: -2 },
        ],
      },
    }));
    expect(snapshot.exposure.openExposureLotsInstrument).toBe(1);
    expect(snapshot.exposure.openExposureLotsAccount).toBe(3);
    expect(snapshot.exposure.openPositionCountInstrument).toBe(1);
    expect(snapshot.exposure.openPositionCountAccount).toBe(2);
    expect(snapshot.exposure.positions[1].direction).toBe("SELL");
  });

  it("blocks when contract size missing", () => {
    const { snapshot } = buildRiskIntelligenceSnapshot(gather({
      baseUnitSize: null,
      contractVerified: false,
      trades: {
        ok: true,
        fetchedAt: FRESH_AT,
        trades: [{ tradeId: "t1", instrument: "EUR/USD", buySell: "B", amount: 1000, grossPL: 0 }],
      },
    }));
    expect(snapshot.exposure.exposureAuthoritative).toBe(false);
    expect(snapshot.exposure.openExposureLots).toBeNull();
    expect(snapshot.exposure.meta.status).toBe("UNAVAILABLE");
  });

  it("blocks invalid position quantity", () => {
    const { snapshot } = buildRiskIntelligenceSnapshot(gather({
      trades: {
        ok: true,
        fetchedAt: FRESH_AT,
        trades: [{ tradeId: "t1", instrument: "EUR/USD", buySell: "B", amount: 1500, grossPL: 0 }],
      },
    }));
    expect(snapshot.exposure.exposureAuthoritative).toBe(false);
    expect(snapshot.exposure.meta.status).toBe("INVALID");
  });

  it("detects duplicate exposure on proposed instrument", () => {
    const { snapshot } = buildRiskIntelligenceSnapshot(gather({
      trades: {
        ok: true,
        fetchedAt: FRESH_AT,
        trades: [
          { tradeId: "t1", instrument: "EUR/USD", buySell: "B", amount: 1000, grossPL: 0 },
          { tradeId: "t2", instrument: "EUR/USD", buySell: "B", amount: 1000, grossPL: 0 },
        ],
      },
    }));
    expect(snapshot.exposure.openPositionCount).toBe(2);
    expect(snapshot.exposure.duplicateTradeSuspected).toBe(true);
  });

  it("does not treat incomplete trades response as zero exposure", () => {
    const { snapshot } = buildRiskIntelligenceSnapshot(gather({
      trades: { ok: false, trades: [], code: "SERVICE_UNAVAILABLE" },
    }));
    expect(snapshot.exposure.openExposureLots).toBeNull();
    expect(snapshot.exposure.exposureAuthoritative).toBe(false);
    expect(snapshot.exposure.meta.status).toBe("UNAVAILABLE");
  });
});

describe("Stage 2 — daily risk", () => {
  it("uses Accounts.dayPl for daily realized PnL", () => {
    const { snapshot } = buildRiskIntelligenceSnapshot(gather());
    expect(snapshot.daily.dayRealizedPnlAccount).toBe(-5);
    expect(snapshot.daily.dayRealizedSource).toBe("accounts.dayPl");
    expect(snapshot.daily.meta.status).toBe("VERIFIED");
    expect(snapshot.daily.timezone).toBe("UTC");
    expect(snapshot.daily.tradingDayKey).toBe("2026-11-06");
  });

  it("sums closed trades when dayPl absent", () => {
    const { snapshot } = buildRiskIntelligenceSnapshot(gather({
      accounts: baseAccounts({ dayPl: null }),
      closedTrades: {
        ok: true,
        fetchedAt: FRESH_AT,
        closedTrades: [
          { tradeId: "c1", closeTime: "2026-11-06T10:00:00.000Z", grossPL: -3 },
          { tradeId: "c2", closeTime: "2026-11-05T10:00:00.000Z", grossPL: -99 },
        ],
      },
    }));
    expect(snapshot.daily.dayRealizedPnlAccount).toBe(-3);
    expect(snapshot.daily.dayRealizedSource).toBe("closed_trades_sum");
  });

  it("treats empty open book unrealized as 0 only when fetch ok", () => {
    const { snapshot } = buildRiskIntelligenceSnapshot(gather());
    expect(snapshot.daily.unrealizedPnlAccount).toBe(0);
  });

  it("marks missing trade history unavailable (not zero)", () => {
    const { snapshot } = buildRiskIntelligenceSnapshot(gather({
      accounts: baseAccounts({ dayPl: null }),
      closedTrades: { ok: false, closedTrades: [] },
    }));
    expect(snapshot.daily.dayRealizedPnlAccount).toBeNull();
    expect(snapshot.daily.meta.status).toBe("UNAVAILABLE");
    expect(snapshot.precheckExposure.dayRealizedPnlAccount).toBeNull();
  });

  it("rejects duplicate closed trade ids", () => {
    const { snapshot } = buildRiskIntelligenceSnapshot(gather({
      accounts: baseAccounts({ dayPl: null }),
      closedTrades: {
        ok: true,
        fetchedAt: FRESH_AT,
        closedTrades: [
          { tradeId: "c1", closeTime: "2026-11-06T10:00:00.000Z", grossPL: -1 },
          { tradeId: "c1", closeTime: "2026-11-06T11:00:00.000Z", grossPL: -2 },
        ],
      },
    }));
    expect(snapshot.daily.dayRealizedPnlAccount).toBeNull();
    expect(snapshot.daily.meta.status).toBe("INVALID");
  });

  it("keeps drawdown unavailable without day-start equity path when account invalid", () => {
    const { snapshot } = buildRiskIntelligenceSnapshot(gather({
      accounts: { ok: false, count: 0, accounts: [], fetchedAt: FRESH_AT },
    }));
    expect(snapshot.daily.dayStartEquity).toBeNull();
    expect(snapshot.daily.drawdownMeta.status).toBe("UNAVAILABLE");
    expect(snapshot.precheckExposure.dayStartEquity).toBeNull();
  });

  it("establishes UTC day-start equity from fresh account snapshot", () => {
    const { snapshot } = buildRiskIntelligenceSnapshot(gather());
    expect(snapshot.daily.dayStartEquity).toBe(10_050);
    expect(snapshot.daily.drawdownMeta.status).toBe("VERIFIED");
    expect(snapshot.precheckExposure.dayStartEquity).toBe(10_050);
  });
});

describe("Stage 2 — spread", () => {
  it("accepts valid bid/ask", () => {
    const { snapshot } = buildRiskIntelligenceSnapshot(gather());
    expect(snapshot.spread.spread).toBeCloseTo(0.0002);
    expect(snapshot.spread.meta.status).toBe("VERIFIED");
  });

  it("rejects invalid bid", () => {
    const { snapshot } = buildRiskIntelligenceSnapshot(gather({ bid: -1 }));
    expect(snapshot.spread.meta.status).toBe("INVALID");
  });

  it("rejects invalid ask", () => {
    const { snapshot } = buildRiskIntelligenceSnapshot(gather({ ask: 0 }));
    expect(snapshot.spread.meta.status).toBe("INVALID");
  });

  it("rejects crossed market", () => {
    const { snapshot } = buildRiskIntelligenceSnapshot(gather({ bid: 1.2, ask: 1.1 }));
    expect(snapshot.spread.meta.status).toBe("INVALID");
    expect(snapshot.spread.meta.reason).toMatch(/Crossed/i);
  });

  it("rejects stale quote", () => {
    const { snapshot } = buildRiskIntelligenceSnapshot(gather({ quoteAgeMs: 60_000 }));
    expect(snapshot.spread.meta.status).toBe("STALE");
  });

  it("keeps SPREAD_LIMIT_NOT_CONFIGURED without approved limit", () => {
    const cfg = readConfiguredMaxSpreadAbsolute(undefined);
    expect(cfg.value).toBeNull();
    expect(cfg.reason).toMatch(/SPREAD_LIMIT_NOT_CONFIGURED/);
    const { snapshot } = buildRiskIntelligenceSnapshot(gather({ maxSpreadAbsolute: undefined }));
    expect(snapshot.spread.limitMeta.status).toBe("NOT_CONFIGURED");
    expect(snapshot.spread.maxSpreadAbsolute).toBeNull();
  });

  it("uses configured approved spread limit from env", () => {
    process.env.KWIZERA_AT_MAX_SPREAD_ABSOLUTE = "0.0005";
    const { snapshot } = buildRiskIntelligenceSnapshot(gather({ maxSpreadAbsolute: undefined }));
    expect(snapshot.spread.maxSpreadAbsolute).toBe(0.0005);
    expect(snapshot.spread.limitMeta.status).toBe("VERIFIED");
  });
});

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

function readyProposal(): AtOrderProposalRecord {
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
  };
}

function readyHandoff(proposal: AtOrderProposalRecord): AtBrokerHandoffRecord {
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
  };
}

function precheckBase(
  risk: ReturnType<typeof buildRiskIntelligenceSnapshot>["snapshot"],
  over: Partial<AtPreExecutionValidationInput> = {},
): AtPreExecutionValidationInput {
  const proposal = readyProposal();
  const handoff = readyHandoff(proposal);
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
    account: risk.precheckAccount ?? {
      equity: 10_050,
      balance: 10_000,
      usableMargin: 9_000,
      usedMargin: 50,
      currency: "USD",
      accountIdMasked: "****3456",
      fetchedAtMs: NOW - 5_000,
      isFresh: true,
    },
    market: {
      bid: risk.spread.bid,
      ask: risk.spread.ask,
      spread: risk.spread.spread,
      quoteAgeMs: risk.spread.quoteAgeMs,
      tradingEligible: true,
      marketClosed: false,
      instrument: "EUR/USD",
    },
    exposure: risk.precheckExposure,
    instrumentContract: {
      baseUnitSize: 100,
      minQuantity: 1,
      quantityStep: 1,
      mmrPerLot: 50,
      contractVerified: true,
    },
    riskLimits: {
      maxSpreadAbsolute: risk.spread.maxSpreadAbsolute,
    },
    nowMs: NOW,
    ...over,
  };
}

function hasCode(r: { blockingReasons: { code: string }[] }, code: string): boolean {
  return r.blockingReasons.some((b) => b.code === code);
}

describe("Stage 2 — precheck integration", () => {
  it("feeds verified telemetry into the existing validator", () => {
    process.env.KWIZERA_AT_MAX_SPREAD_ABSOLUTE = "0.001";
    const { snapshot } = buildRiskIntelligenceSnapshot(gather({
      maxSpreadAbsolute: undefined,
    }));
    expect(snapshot.exposure.exposureAuthoritative).toBe(true);
    expect(snapshot.precheckExposure.dayRealizedPnlAccount).toBe(-5);
    const result = runPreExecutionValidation(precheckBase(snapshot));
    expect(result.placesOrders).toBe(false);
    expect(result.acceptsForExecution).toBe(false);
    expect(result.mutatesBroker).toBe(false);
    expect(result.executionAuthorized).toBe(false);
    expect(result.allowed).toBe(false);
    expect(hasCode(result, "EXECUTION_MASTER_OFF")).toBe(true);
    const exposure = result.checks.find((c) => c.id === "exposure");
    expect(exposure?.verdict).toBe("PASS");
    const daily = result.checks.find((c) => c.id === "daily_loss");
    expect(daily?.verdict).toBe("PASS");
  });

  it("keeps unavailable exposure blocked", () => {
    const { snapshot } = buildRiskIntelligenceSnapshot(gather({
      trades: { ok: false, trades: [] },
    }));
    const result = runPreExecutionValidation(precheckBase(snapshot));
    expect(hasCode(result, "EXPOSURE_UNVERIFIED")).toBe(true);
  });

  it("keeps unavailable daily loss blocked", () => {
    const { snapshot } = buildRiskIntelligenceSnapshot(gather({
      accounts: baseAccounts({ dayPl: null }),
      closedTrades: { ok: false, closedTrades: [] },
    }));
    const result = runPreExecutionValidation(precheckBase(snapshot));
    expect(hasCode(result, "DAILY_LOSS_UNAVAILABLE")).toBe(true);
  });

  it("keeps unavailable drawdown blocked", () => {
    const { snapshot } = buildRiskIntelligenceSnapshot(gather({
      accounts: { ok: false, count: 0, accounts: [], fetchedAt: FRESH_AT },
    }));
    const result = runPreExecutionValidation(precheckBase(snapshot, {
      account: {
        equity: 10_000,
        balance: 10_000,
        usableMargin: 9_000,
        usedMargin: 0,
        currency: "USD",
        accountIdMasked: "****3456",
        fetchedAtMs: NOW - 1000,
        isFresh: true,
      },
      exposure: {
        ...snapshot.precheckExposure,
        dayStartEquity: null,
      },
    }));
    expect(hasCode(result, "DRAWDOWN_UNAVAILABLE")).toBe(true);
  });

  it("keeps unconfigured spread blocked", () => {
    const { snapshot } = buildRiskIntelligenceSnapshot(gather({ maxSpreadAbsolute: null }));
    const result = runPreExecutionValidation(precheckBase(snapshot));
    expect(hasCode(result, "SPREAD_LIMIT_NOT_CONFIGURED")).toBe(true);
  });

  it("keeps stale telemetry blocked", () => {
    const { snapshot } = buildRiskIntelligenceSnapshot(gather({
      accounts: { ...baseAccounts(), fetchedAt: "2026-11-06T11:00:00.000Z" },
    }));
    const result = runPreExecutionValidation(precheckBase(snapshot));
    expect(hasCode(result, "STALE_ACCOUNT_DATA")).toBe(true);
  });

  it("Execution Master OFF continues to block authorization", () => {
    process.env.KWIZERA_AT_MAX_SPREAD_ABSOLUTE = "0.001";
    const { snapshot } = buildRiskIntelligenceSnapshot(gather());
    const result = runPreExecutionValidation(precheckBase(snapshot, {
      foundation: {
        executionMasterEnabled: false,
        armedForSubmission: false,
        placesOrders: false,
        acceptsForExecution: false,
        mutatesBroker: false,
        lifecycle: "IDLE",
      },
    }));
    expect(result.allowed).toBe(false);
    expect(result.executionAuthorized).toBe(false);
    expect(hasCode(result, "EXECUTION_MASTER_OFF")).toBe(true);
  });

  it("Emergency Lock ON continues to block authorization", () => {
    process.env.KWIZERA_AT_MAX_SPREAD_ABSOLUTE = "0.001";
    const { snapshot } = buildRiskIntelligenceSnapshot(gather());
    const result = runPreExecutionValidation(precheckBase(snapshot, {
      controls: {
        emergencyEntryLock: true,
        masterEnable: false,
        automaticEntry: false,
      },
    }));
    expect(result.allowed).toBe(false);
    expect(hasCode(result, "EMERGENCY_LOCK")).toBe(true);
  });
});

describe("Stage 2 — safety stamps", () => {
  it("never reports mutation or submission capability", () => {
    const { snapshot } = buildRiskIntelligenceSnapshot(gather());
    expect(snapshot.placesOrders).toBe(false);
    expect(snapshot.acceptsForExecution).toBe(false);
    expect(snapshot.mutatesBroker).toBe(false);
    expect(OWNER_MAX_LOTS_EXECUTION).toBe(0.01);
  });
});
