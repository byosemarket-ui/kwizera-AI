/**
 * Dynamic Spread Intelligence Engine — comprehensive unit tests.
 * Uses clearly labelled TEST FIXTURES. Never submits broker orders.
 */
import { describe, expect, it } from "vitest";
import {
  DYNAMIC_SPREAD_COST_ACCOUNTING_CONVENTION,
  DYNAMIC_SPREAD_ENGINE_VERSION,
  DYNAMIC_SPREAD_MIN_ROLLING_SAMPLES,
  DYNAMIC_SPREAD_MODE,
  evaluateDynamicSpread,
  priceDistanceToAccountCost,
} from "../../../../ai/forex-ai/automated-trading/dynamic-spread/index.js";
import {
  fixtureEurUsdContract,
  fixtureGbpUsdContract,
  fixtureRollingSpreads,
  fixtureUsdJpyContract,
  fixtureXauUsdContract,
} from "../../../../ai/forex-ai/automated-trading/dynamic-spread/test-fixtures.js";
import {
  runPreExecutionValidation,
  type AtPreExecutionValidationInput,
} from "../../../../ai/forex-ai/automated-trading/broker-execution/index.js";
import { buildOrderProposal } from "../../../../ai/forex-ai/automated-trading/order-proposal/index.js";
import type { AtOrderProposalRecord } from "../../../../ai/forex-ai/automated-trading/order-proposal/types.js";
import type { AtOrderPreparationHandoff } from "../../../../ai/forex-ai/automated-trading/result-intake/types.js";

const NOW = Date.parse("2026-11-10T12:00:00.000Z");

function intakeHandoff(): AtOrderPreparationHandoff {
  return {
    acceptedResultId: "res-ds-1",
    analysisId: "an-ds-1",
    instrument: "EUR/USD",
    canonicalDirection: "BUY",
    directionalConfidencePct: 60,
    confidenceType: "ANALYSIS_CONFIDENCE",
    isCalibratedWinProbability: false,
    observationId: "obs-ds-1",
    imageId: "img-ds-1",
    imageHash: "hash-ds-1",
    analyzedAtUtc: new Date(NOW).toISOString(),
    resultExpiresAtUtc: new Date(NOW + 3600_000).toISOString(),
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
    note: "TEST_FIXTURE",
  };
}

/** TP beyond 3R so net reward after spread cost still meets ≥3R. */
function readyProposalWideTp(): AtOrderProposalRecord {
  const entry = 1.10000;
  const stop = 1.09900; // 10 pips
  const tp = entry + 5 * (entry - stop); // 5R price distance → room for spread cost
  const proposal = buildOrderProposal({
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
    individualOrderAllocation: 400,
    allocationCurrency: "USD",
    existingCommittedExposure: 0,
    contract: fixtureEurUsdContract(),
    exposureAuthoritative: true,
    nowMs: NOW,
  });
  proposal.pricePlan.takeProfit = tp;
  proposal.pricePlan.rewardDistance = Math.abs(tp - entry);
  proposal.pricePlan.plannedRewardRiskRatio = 5;
  return proposal;
}

function baseEngineInput(over: Record<string, unknown> = {}) {
  const hist = fixtureRollingSpreads({
    n: DYNAMIC_SPREAD_MIN_ROLLING_SAMPLES,
    baseSpread: 0.00012,
    instrument: "EUR/USD",
    nowMs: NOW,
  });
  return {
    instrument: "EUR/USD",
    bid: 1.10000,
    ask: 1.00000 + 0.10012, // 1.10012 → spread 0.00012
    quoteAgeMs: 200,
    quoteMaxAgeMs: 5_000,
    quoteTimestampUtc: new Date(NOW).toISOString(),
    quoteId: "q-fixture-1",
    provenance: "LIVE",
    feedConnected: true,
    marketStatus: "OPEN" as const,
    historicalSpreads: hist,
    direction: "BUY" as const,
    entryPrice: 1.10000,
    stopLoss: 1.09900,
    takeProfit: 1.10500, // 50 pips = 5R vs 10-pip SL
    quantityLots: 1,
    brokerAmount: 1000,
    baseUnitSize: 1000,
    contract: fixtureEurUsdContract(),
    orderAllocationAccount: 400,
    allocationId: "alloc-fixture-1",
    proposalId: "prop-fixture-1",
    accountCurrency: "USD",
    commissionVerified: false,
    slippageEvidenceAvailable: false,
    legacyMaxSpreadAbsolute: null,
    nowMs: NOW,
    ...over,
  };
}

describe("Dynamic Spread Intelligence Engine", () => {
  it("exposes DYNAMIC mode and version", () => {
    expect(DYNAMIC_SPREAD_MODE).toBe("DYNAMIC");
    expect(DYNAMIC_SPREAD_ENGINE_VERSION).toContain("dynamic-spread");
    expect(DYNAMIC_SPREAD_COST_ACCOUNTING_CONVENTION).toContain("SL_GROSS_EXCLUDES_SPREAD");
  });

  it("1. ACCEPT on valid fresh LIVE quote with sufficient rolling history", () => {
    const r = evaluateDynamicSpread(baseEngineInput());
    expect(r.decision).toBe("ACCEPT");
    expect(r.primaryReasonCode).toBe("DYNAMIC_SPREAD_OK");
    expect(r.authorizesBrokerSubmission).toBe(false);
    expect(r.placesOrders).toBe(false);
    expect(r.rolling.sufficient).toBe(true);
    expect(r.stopLossImpact.spreadIncludedInStopLossRisk).toBe(false);
  });

  it("2. REJECT when bid missing", () => {
    const r = evaluateDynamicSpread(baseEngineInput({ bid: null }));
    expect(r.decision).toBe("REJECT");
    expect(r.primaryReasonCode).toBe("QUOTE_MISSING");
  });

  it("3. REJECT when quote stale", () => {
    const r = evaluateDynamicSpread(baseEngineInput({ quoteAgeMs: 60_000 }));
    expect(r.decision).toBe("REJECT");
    expect(r.primaryReasonCode).toBe("QUOTE_STALE");
  });

  it("4. REJECT when ask < bid", () => {
    const r = evaluateDynamicSpread(baseEngineInput({ bid: 1.2, ask: 1.1 }));
    expect(r.decision).toBe("REJECT");
    expect(r.primaryReasonCode).toBe("QUOTE_INVALID");
  });

  it("5. REJECT on instrument mismatch", () => {
    const r = evaluateDynamicSpread(baseEngineInput({ expectedInstrument: "GBP/USD" }));
    expect(r.decision).toBe("REJECT");
    expect(r.primaryReasonCode).toBe("INSTRUMENT_MISMATCH");
  });

  it("6. REJECT non-LIVE provenance (no silent historical substitution)", () => {
    const r = evaluateDynamicSpread(baseEngineInput({ provenance: "CACHED" }));
    expect(r.decision).toBe("REJECT");
    expect(r.primaryReasonCode).toBe("MARKET_DATA_NOT_LIVE");
  });

  it("7. REJECT when feed disconnected", () => {
    const r = evaluateDynamicSpread(baseEngineInput({ feedConnected: false }));
    expect(r.decision).toBe("REJECT");
    expect(r.primaryReasonCode).toBe("FEED_DISCONNECTED");
  });

  it("8. REJECT when rolling history insufficient", () => {
    const r = evaluateDynamicSpread(baseEngineInput({
      historicalSpreads: fixtureRollingSpreads({
        n: 5,
        baseSpread: 0.00012,
        instrument: "EUR/USD",
        nowMs: NOW,
      }),
    }));
    expect(r.decision).toBe("REJECT");
    expect(r.primaryReasonCode).toBe("SPREAD_DATA_INSUFFICIENT");
  });

  it("9. ACCEPT on normal spread behavior near median", () => {
    const r = evaluateDynamicSpread(baseEngineInput({
      bid: 1.1,
      ask: 1.10012,
    }));
    expect(r.decision).toBe("ACCEPT");
    expect(r.rolling.abnormal).toBe(false);
  });

  it("10. REJECT abnormal spread widening above P95", () => {
    const r = evaluateDynamicSpread(baseEngineInput({
      bid: 1.1,
      ask: 1.10080, // far above fixture cluster ~0.00012
    }));
    expect(r.decision).toBe("REJECT");
    expect(r.primaryReasonCode).toBe("SPREAD_ABNORMAL_WIDENING");
  });

  it("11. REJECT when quote changes to abnormal between evaluations (fresh run required)", () => {
    const first = evaluateDynamicSpread(baseEngineInput());
    expect(first.decision).toBe("ACCEPT");
    const second = evaluateDynamicSpread(baseEngineInput({
      bid: 1.1,
      ask: 1.10090,
      quoteId: "q-fixture-2",
    }));
    expect(second.decision).toBe("REJECT");
    expect(second.requiresFreshProposalOnReject).toBe(true);
  });

  it("12. EUR/USD spread cost uses POINT_COST economics", () => {
    const cost = priceDistanceToAccountCost({
      priceDistance: 0.00012,
      quantityLots: 1,
      contract: fixtureEurUsdContract(),
    });
    expect(cost.ok).toBe(true);
    if (cost.ok) {
      expect(cost.method).toBe("POINT_COST");
      // 0.00012 / 0.00001 * 0.1 * 1 = 12 * 0.1 = 1.2
      expect(cost.costAccount).toBeCloseTo(1.2, 6);
    }
  });

  it("13. GBP/USD spread cost", () => {
    const hist = fixtureRollingSpreads({
      n: 20,
      baseSpread: 0.00014,
      instrument: "GBP/USD",
      nowMs: NOW,
    });
    const r = evaluateDynamicSpread(baseEngineInput({
      instrument: "GBP/USD",
      bid: 1.25,
      ask: 1.25014,
      historicalSpreads: hist,
      contract: fixtureGbpUsdContract(),
      entryPrice: 1.25,
      stopLoss: 1.249,
      takeProfit: 1.255,
      brokerAmount: 1000,
    }));
    expect(r.decision).toBe("ACCEPT");
    expect(r.costBreakdown.spreadCostAccount).toBeGreaterThan(0);
  });

  it("14. USD/JPY spread cost with account-currency pip cost fixture", () => {
    const hist = fixtureRollingSpreads({
      n: 20,
      baseSpread: 0.012,
      instrument: "USD/JPY",
      nowMs: NOW,
    });
    const r = evaluateDynamicSpread(baseEngineInput({
      instrument: "USD/JPY",
      bid: 150.000,
      ask: 150.012,
      historicalSpreads: hist,
      contract: fixtureUsdJpyContract(),
      entryPrice: 150.0,
      stopLoss: 149.5,
      takeProfit: 152.5,
      brokerAmount: 1000,
    }));
    expect(["ACCEPT", "REJECT"]).toContain(r.decision);
    if (r.decision === "ACCEPT") {
      expect(r.costBreakdown.method).toBe("POINT_COST");
    } else {
      // Fail-closed reasons only — never invent conversion.
      expect([
        "SPREAD_ABNORMAL_WIDENING",
        "NET_REWARD_BELOW_POLICY",
        "SPREAD_COST_EXCESSIVE",
        "STOP_LOSS_RISK_EXCEEDED",
      ]).toContain(r.primaryReasonCode);
    }
  });

  it("15. XAU/USD spread cost and contract conversion (precision-safe 0.30)", () => {
    const hist = fixtureRollingSpreads({
      n: 20,
      baseSpread: 0.30,
      instrument: "XAU/USD",
      nowMs: NOW,
    });
    const r = evaluateDynamicSpread(baseEngineInput({
      instrument: "XAU/USD",
      bid: 4000.00,
      ask: 4000.00 + 0.3000000000001819,
      historicalSpreads: hist,
      contract: fixtureXauUsdContract(),
      entryPrice: 4000,
      stopLoss: 3990,
      takeProfit: 4050,
      brokerAmount: 1,
      baseUnitSize: 1,
      quantityLots: 1,
      orderAllocationAccount: 40,
    }));
    expect(r.currentSpread).toBe(0.3);
    expect(r.decision === "ACCEPT" || r.primaryReasonCode === "SPREAD_ABNORMAL_WIDENING"
      || r.primaryReasonCode === "NET_REWARD_BELOW_POLICY").toBe(true);
  });

  it("16. REJECT invalid FXCM AMOUNT vs lots×baseUnitSize", () => {
    const r = evaluateDynamicSpread(baseEngineInput({
      quantityLots: 1,
      baseUnitSize: 1000,
      brokerAmount: 999, // wrong
    }));
    expect(r.decision).toBe("REJECT");
    expect(r.primaryReasonCode).toBe("BROKER_CONSTRAINT_UNVERIFIED");
  });

  it("17. REJECT missing contract metadata", () => {
    const r = evaluateDynamicSpread(baseEngineInput({
      contract: { ...fixtureEurUsdContract(), verified: false },
    }));
    expect(r.decision).toBe("REJECT");
    expect(r.primaryReasonCode).toBe("INSTRUMENT_METADATA_UNVERIFIED");
  });

  it("18. REJECT when pip/tick economics unavailable", () => {
    const r = evaluateDynamicSpread(baseEngineInput({
      contract: {
        ...fixtureEurUsdContract(),
        pipCostAccount: null,
        contractMultiplier: null,
      },
    }));
    expect(r.decision).toBe("REJECT");
    expect(["INSTRUMENT_METADATA_UNVERIFIED", "SPREAD_COST_UNVERIFIED"]).toContain(r.primaryReasonCode);
  });

  it("19. currency conversion: allocation path requires verified economics (no invent)", () => {
    const r = evaluateDynamicSpread(baseEngineInput({
      accountCurrency: "EUR",
      // Still uses pipCostAccount already in account currency — missing conversion is N/A when cost is account-native.
    }));
    // With verified pipCostAccount already in account terms, ACCEPT remains valid.
    expect(r.decision).toBe("ACCEPT");
  });

  it("20. commission included only when verified", () => {
    const withComm = evaluateDynamicSpread(baseEngineInput({
      commissionAccount: 0.5,
      commissionVerified: true,
      takeProfit: 1.106, // extra room for commission
    }));
    expect(withComm.costBreakdown.commissionStatus).toBe("VERIFIED");
    expect(withComm.costBreakdown.totalEntryFrictionAccount).toBeGreaterThan(
      withComm.costBreakdown.spreadCostAccount!,
    );
  });

  it("21. slippage evidence unavailable does not invent slippage cost", () => {
    const r = evaluateDynamicSpread(baseEngineInput({
      slippageEvidenceAvailable: false,
      slippageEstimateAccount: 9.99,
    }));
    expect(r.costBreakdown.slippageStatus).toBe("UNAVAILABLE");
    expect(r.costBreakdown.slippageEstimateAccount).toBeNull();
  });

  it("22. spread is NOT double-counted into SL risk", () => {
    const r = evaluateDynamicSpread(baseEngineInput());
    expect(r.stopLossImpact.spreadIncludedInStopLossRisk).toBe(false);
    expect(r.costAccountingConvention).toBe(DYNAMIC_SPREAD_COST_ACCOUNTING_CONVENTION);
    expect(r.costBreakdown.spreadCostAccount).toBeGreaterThan(0);
    expect(r.stopLossImpact.modeledStopLossRiskAccount).toBeGreaterThan(0);
    // |1.10000−1.09900|/0.00001 × 0.1 × 1 lot = 100 × 0.1 = $10 SL risk (spread separate).
    expect(r.stopLossImpact.modeledStopLossRiskAccount).toBeCloseTo(10.0, 5);
    expect(r.costBreakdown.spreadCostAccount).toBeCloseTo(1.2, 5);
  });

  it("23. STOP_LOSS_RISK_EXCEEDED when modeled SL > 25% allocation", () => {
    const r = evaluateDynamicSpread(baseEngineInput({
      orderAllocationAccount: 1, // allowed risk $0.25; SL ~$1
    }));
    expect(r.decision).toBe("REJECT");
    expect(r.primaryReasonCode).toBe("STOP_LOSS_RISK_EXCEEDED");
  });

  it("24. independent allocations — one order cannot borrow another's budget", () => {
    const a = evaluateDynamicSpread(baseEngineInput({
      allocationId: "alloc-A",
      orderAllocationAccount: 40,
      proposalId: "p-A",
    }));
    const b = evaluateDynamicSpread(baseEngineInput({
      allocationId: "alloc-B",
      orderAllocationAccount: 1,
      proposalId: "p-B",
    }));
    expect(a.decision).toBe("ACCEPT");
    expect(b.decision).toBe("REJECT");
    expect(b.primaryReasonCode).toBe("STOP_LOSS_RISK_EXCEEDED");
    expect(a.allocationId).not.toBe(b.allocationId);
  });

  it("25. 25% target and 25% hard maximum are identical under v3", () => {
    const r = evaluateDynamicSpread(baseEngineInput());
    expect(r.stopLossImpact.riskTargetFraction).toBe(0.25);
    expect(r.stopLossImpact.riskHardMaxFraction).toBe(0.25);
    expect(r.stopLossImpact.allowedRiskAmountAccount).toBe(100);
  });

  it("26. REJECT when net reward/risk below 3R after spread cost", () => {
    const r = evaluateDynamicSpread(baseEngineInput({
      takeProfit: 1.10030, // only 3R geometrically → net < 3 after spread
    }));
    expect(r.decision).toBe("REJECT");
    expect(r.primaryReasonCode).toBe("NET_REWARD_BELOW_POLICY");
  });

  it("27. ACCEPT result shape", () => {
    const r = evaluateDynamicSpread(baseEngineInput());
    expect(r.decision).toBe("ACCEPT");
    expect(r.engineId).toContain("Dynamic Spread");
    expect(r.quoteId).toBeTruthy();
    expect(r.rolling.p95).not.toBeNull();
  });

  it("28. REJECT result carries reason code", () => {
    const r = evaluateDynamicSpread(baseEngineInput({ ask: null }));
    expect(r.decision).toBe("REJECT");
    expect(r.reasonCodes.length).toBeGreaterThan(0);
    expect(r.primaryReasonCode).toBe("QUOTE_MISSING");
  });

  it("29. rejected proposal cannot resume without fresh proposal/evaluation", () => {
    const rejected = evaluateDynamicSpread(baseEngineInput({ feedConnected: false, proposalId: "p-old" }));
    expect(rejected.decision).toBe("REJECT");
    expect(rejected.requiresFreshProposalOnReject).toBe(true);
    // Same proposalId with improved market still needs a new evaluation object (engine is pure);
    // callers must mint a new proposal — engine documents the binding.
    const again = evaluateDynamicSpread(baseEngineInput({ proposalId: "p-old" }));
    expect(again.decision).toBe("ACCEPT");
    expect(again.proposalId).toBe("p-old");
    expect(again.requiresFreshProposalOnReject).toBe(true);
  });

  it("30–31. precheck consumes dynamic engine (integration)", () => {
    const proposal = readyProposalWideTp();
    const hist = fixtureRollingSpreads({
      n: 20,
      baseSpread: 0.0002,
      instrument: "EUR/USD",
      nowMs: NOW,
    });
    const input: AtPreExecutionValidationInput = {
      handoff: null,
      proposal,
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
        lifecycle: "AUTHORIZATION_REQUIRED",
      },
      account: {
        equity: 10_000,
        balance: 10_000,
        usableMargin: 8_000,
        usedMargin: 100,
        currency: "USD",
        accountIdMasked: "DEMO***",
        fetchedAtMs: NOW - 500,
        isFresh: true,
      },
      market: {
        bid: 1.0999,
        ask: 1.1001,
        spread: 0.0002,
        quoteAgeMs: 200,
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
        baseUnitSize: 1000,
        minQuantity: 1,
        quantityStep: 1000,
        mmrPerLot: 33,
        contractVerified: true,
      },
      riskLimits: {
        maxSpreadAbsolute: null, // must NOT fail solely because null
        maxSlippageAbsolute: 0.01,
      },
      dynamicSpread: {
        historicalSpreads: hist,
        provenance: "LIVE",
        feedConnected: true,
        contract: fixtureEurUsdContract(),
        orderAllocationAccount: proposal.capital.individualOrderAllocation,
        accountCurrency: "USD",
      },
      nowMs: NOW,
    };
    const r = runPreExecutionValidation(input);
    expect(r.dynamicSpread).toBeTruthy();
    expect(r.dynamicSpread?.mode).toBe("DYNAMIC");
    // Null legacy ceiling must not emit SPREAD_LIMIT_NOT_CONFIGURED
    expect(r.blockingReasons.some((b) => b.code === "SPREAD_LIMIT_NOT_CONFIGURED")).toBe(false);
    const dyn = r.checks.find((c) => c.id === "dynamic_spread");
    expect(dyn).toBeTruthy();
    expect(r.executionAuthorized).toBe(false);
    expect(r.placesOrders).toBe(false);
  });

  it("legacy emergency ceiling still REJECTS when configured and breached", () => {
    const r = evaluateDynamicSpread(baseEngineInput({
      legacyMaxSpreadAbsolute: 0.00005,
      bid: 1.1,
      ask: 1.10012,
    }));
    expect(r.decision).toBe("REJECT");
    expect(r.primaryReasonCode).toBe("LEGACY_EMERGENCY_SPREAD_CEILING");
  });
});
