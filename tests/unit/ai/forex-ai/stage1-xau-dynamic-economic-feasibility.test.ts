/**
 * KWIZERA AI STUDIO → FOREX → AUTOMATED TRADING → XAU/USD
 * Per-trade economic feasibility replaces fixed maxSpreadAbsolute as primary eligibility.
 * TEST FIXTURES only — never LIVE broker mutations.
 */
import { describe, expect, it } from "vitest";
import {
  decidePerTradeEconomicFeasibility,
  evaluateDynamicSpread,
  DYNAMIC_SPREAD_MIN_ROLLING_SAMPLES,
} from "../../../../ai/forex-ai/automated-trading/dynamic-spread/index.js";
import {
  fixtureRollingSpreads,
  fixtureXauUsdContract,
} from "../../../../ai/forex-ai/automated-trading/dynamic-spread/test-fixtures.js";
import { proposeTakeProfitNetAware3R } from "../../../../ai/forex-ai/automated-trading/simulation-risk/net-3r-take-profit.js";
import { buildCanonicalPipelineReport } from "../../../../ai/forex-ai/automated-trading/order-proposal/canonical-pipeline-report.js";
import { resolveSpreadLimit } from "../../../../ai/forex-ai/automated-trading/risk-policy/resolve.js";
import {
  usesDynamicPerTradeSpreadEligibility,
} from "../../../../ai/forex-ai/automated-trading/risk-policy/types.js";
import { buildStage1ReadinessReport } from "../../../../ai/forex-ai/automated-trading/risk-policy/stage1-readiness.js";
import { evaluateControlledDemoReadiness } from "../../../../ai/forex-ai/automated-trading/controlled-demo-execution/readiness.js";
import type { AtOrderProposalRecord } from "../../../../ai/forex-ai/automated-trading/order-proposal/types.js";

const NOW = Date.parse("2026-11-11T18:00:00.000Z");

function xauHist(baseSpread = 0.30) {
  return fixtureRollingSpreads({
    n: DYNAMIC_SPREAD_MIN_ROLLING_SAMPLES,
    baseSpread,
    instrument: "XAU/USD",
    nowMs: NOW,
  });
}

function xauInput(over: Record<string, unknown> = {}) {
  const spread = typeof over.spreadAbsolute === "number" ? over.spreadAbsolute : 0.30;
  const { spreadAbsolute: _s, ...rest } = over as { spreadAbsolute?: number };
  return {
    instrument: "XAU/USD",
    expectedInstrument: "XAU/USD",
    bid: 4000.00,
    ask: 4000.00 + spread,
    quoteAgeMs: 150,
    quoteMaxAgeMs: 5_000,
    quoteTimestampUtc: new Date(NOW).toISOString(),
    quoteId: "q-xau-fixture",
    provenance: "LIVE",
    feedConnected: true,
    marketStatus: "OPEN" as const,
    historicalSpreads: xauHist(0.30),
    direction: "BUY" as const,
    entryPrice: 4000.00,
    stopLoss: 3990.00, // $10 SL risk at 1 lot with pipCost 0.01
    takeProfit: 4050.00, // 5R gross before costs
    quantityLots: 1,
    brokerAmount: 1,
    baseUnitSize: 1,
    contract: fixtureXauUsdContract(),
    orderAllocationAccount: 40,
    allocationId: "alloc-xau-40",
    proposalId: "prop-xau-1",
    accountCurrency: "USD",
    commissionVerified: false,
    slippageEvidenceAvailable: false,
    legacyMaxSpreadAbsolute: null,
    nowMs: NOW,
    ...rest,
  };
}

describe("XAU/USD — dynamic per-trade economic feasibility (no fixed 0.30 primary)", () => {
  it("ACTIVE XAU uses DYNAMIC_PER_TRADE; EUR does not", () => {
    expect(usesDynamicPerTradeSpreadEligibility("XAU/USD")).toBe(true);
    expect(usesDynamicPerTradeSpreadEligibility("EUR/USD")).toBe(false);
  });

  it("resolveSpreadLimit: XAU without ceiling is DYNAMIC, not trade-blocking", () => {
    const r = resolveSpreadLimit({
      instrument: "XAU/USD",
      store: { getInstrument: () => null },
    });
    expect(r.value).toBeNull();
    expect(r.eligibilityMode).toBe("DYNAMIC_PER_TRADE");
    expect(r.fixedCeilingRequiredForTradeEligibility).toBe(false);
  });

  it("A1–A4: spreads below/at/above 0.30 ACCEPT when economics valid", () => {
    for (const spreadAbsolute of [0.20, 0.30, 0.45, 0.80]) {
      const r = decidePerTradeEconomicFeasibility(xauInput({ spreadAbsolute }));
      expect(r.decision, `spread=${spreadAbsolute}`).toBe("ACCEPT");
      expect(r.fixedCeilingIsPrimaryEligibility).toBe(false);
      expect(r.authorizesBrokerSubmission).toBe(false);
      expect(r.primaryReasonCode).toBe("DYNAMIC_SPREAD_OK");
    }
  });

  it("A5: spread below 0.30 but net <3R REJECT", () => {
    const r = decidePerTradeEconomicFeasibility(xauInput({
      spreadAbsolute: 0.20,
      takeProfit: 4015, // only 1.5R gross
    }));
    expect(r.decision).toBe("REJECT");
    expect(r.reasonCodes).toContain("NET_REWARD_BELOW_3R");
  });

  it("A6–A7: abnormal/high volatility flagged; REJECT only if economics fail", () => {
    const viable = decidePerTradeEconomicFeasibility(xauInput({
      spreadAbsolute: 1.20, // wide vs hist 0.30
      takeProfit: 4080,
    }));
    expect(viable.rolling.abnormal).toBe(true);
    // 1.20 cost vs $10 SL — still absorbable; net still ≥3R with TP 4080
    expect(viable.decision).toBe("ACCEPT");

    const unviable = decidePerTradeEconomicFeasibility(xauInput({
      spreadAbsolute: 12.0, // cost $12 > $10 allowed risk
      takeProfit: 4080,
    }));
    expect(unviable.decision).toBe("REJECT");
    expect(
      unviable.reasonCodes.includes("SPREAD_COST_EXCESSIVE")
      || unviable.reasonCodes.includes("SPREAD_ABNORMAL_WIDENING")
      || unviable.reasonCodes.includes("NET_REWARD_BELOW_3R"),
    ).toBe(true);
  });

  it("A8–A12: insufficient history / stale / invalid / provenance / identity", () => {
    expect(decidePerTradeEconomicFeasibility(xauInput({
      historicalSpreads: xauHist(0.30).slice(0, 5),
    })).primaryReasonCode).toBe("SPREAD_DATA_INSUFFICIENT");

    expect(decidePerTradeEconomicFeasibility(xauInput({
      quoteAgeMs: 60_000,
    })).primaryReasonCode).toBe("QUOTE_STALE");

    expect(decidePerTradeEconomicFeasibility(xauInput({
      bid: 4001,
      ask: 4000,
    })).primaryReasonCode).toBe("QUOTE_INVALID");

    expect(decidePerTradeEconomicFeasibility(xauInput({
      provenance: "CACHED",
    })).primaryReasonCode).toBe("MARKET_DATA_NOT_LIVE");

    expect(decidePerTradeEconomicFeasibility(xauInput({
      expectedInstrument: "EUR/USD",
    })).primaryReasonCode).toBe("INSTRUMENT_MISMATCH");
  });

  it("B13–B15: $40 allocation → $10 max; exact 25% ok; above rejected", () => {
    const atBudget = decidePerTradeEconomicFeasibility(xauInput({
      orderAllocationAccount: 40,
      stopLoss: 3990, // $10
    }));
    expect(atBudget.stopLossImpact.allowedRiskAmountAccount).toBe(10);
    expect(atBudget.decision).toBe("ACCEPT");

    const over = decidePerTradeEconomicFeasibility(xauInput({
      orderAllocationAccount: 40,
      stopLoss: 3980, // $20 > $10
    }));
    expect(over.decision).toBe("REJECT");
    expect(over.primaryReasonCode).toBe("STOP_LOSS_RISK_EXCEEDED");
  });

  it("B16: two allocations do not share risk capacity", () => {
    const a = decidePerTradeEconomicFeasibility(xauInput({
      allocationId: "A",
      orderAllocationAccount: 40,
    }));
    const b = decidePerTradeEconomicFeasibility(xauInput({
      allocationId: "B",
      orderAllocationAccount: 40,
    }));
    expect(a.stopLossImpact.allowedRiskAmountAccount).toBe(10);
    expect(b.stopLossImpact.allowedRiskAmountAccount).toBe(10);
    expect(a.allocationId).not.toBe(b.allocationId);
  });

  it("C22–C26: net exactly 3R / 4R / 5R / 6R ACCEPT; below 3R REJECT", () => {
    // SL risk $10 → need net reward ≥ $30, $40, $50, $60
    // spread 0.30 → friction $0.30; gross needed ≈ 30.3 / 40.3 / ...
    const cases: Array<{ tp: number; minRatio: number }> = [
      { tp: 4030.30, minRatio: 3 },
      { tp: 4040.30, minRatio: 4 },
      { tp: 4050.30, minRatio: 5 },
      { tp: 4060.30, minRatio: 6 },
    ];
    for (const c of cases) {
      const r = decidePerTradeEconomicFeasibility(xauInput({ takeProfit: c.tp }));
      expect(r.decision, `tp=${c.tp}`).toBe("ACCEPT");
      expect(r.netReward.rewardToRiskRatio ?? 0).toBeGreaterThanOrEqual(c.minRatio - 0.05);
    }
    const below = decidePerTradeEconomicFeasibility(xauInput({ takeProfit: 4020 }));
    expect(below.decision).toBe("REJECT");
    expect(below.reasonCodes).toContain("NET_REWARD_BELOW_3R");
  });

  it("C27: gross 3R but net below 3R REJECT", () => {
    // Gross geometric 3R TP at 4030; with spread 0.30 net < 3
    const r = decidePerTradeEconomicFeasibility(xauInput({
      takeProfit: 4030,
      spreadAbsolute: 0.30,
    }));
    expect(r.decision).toBe("REJECT");
    expect(r.reasonCodes).toContain("NET_REWARD_BELOW_3R");
  });

  it("C28–C29 / I: technical target cannot support net 3R; open-ended >3R allowed", () => {
    const cannot = proposeTakeProfitNetAware3R({
      direction: "BUY",
      entryPrice: 4000,
      stopLoss: 3990,
      quantityLots: 1,
      contract: fixtureXauUsdContract(),
      verifiedTradingCostsAccount: 0.30,
      costsVerified: true,
      digits: 2,
      tickSize: 0.01,
      technicalRewardDistanceMax: 20, // only 2R structure
    });
    expect(cannot.ok).toBe(false);
    if (!cannot.ok) expect(cannot.code).toBe("TECHNICAL_TARGET_CANNOT_SUPPORT_NET_3R");

    const openEnded = proposeTakeProfitNetAware3R({
      direction: "BUY",
      entryPrice: 4000,
      stopLoss: 3990,
      quantityLots: 1,
      contract: fixtureXauUsdContract(),
      verifiedTradingCostsAccount: 0.30,
      costsVerified: true,
      digits: 2,
      tickSize: 0.01,
      technicalRewardDistanceMax: 60, // 6R structure — must not clip to exact 3R
    });
    expect(openEnded.ok).toBe(true);
    if (openEnded.ok) {
      expect(openEnded.rewardDistance).toBeGreaterThanOrEqual(60 - 0.01);
      expect(openEnded.netRewardRiskRatio ?? 0).toBeGreaterThan(3);
    }
  });

  it("D33–D34: spread deducted once; not in modeled SL risk", () => {
    const r = decidePerTradeEconomicFeasibility(xauInput({ spreadAbsolute: 0.30 }));
    expect(r.decision).toBe("ACCEPT");
    expect(r.stopLossImpact.spreadIncludedInStopLossRisk).toBe(false);
    expect(r.stopLossImpact.modeledStopLossRiskAccount).toBeCloseTo(10, 6);
    expect(r.costBreakdown.spreadCostAccount).toBeCloseTo(0.30, 6);
    expect(r.netReward.costsSubtractedFromReward).toBe(true);
    expect(r.costAccountingConvention).toContain("SPREAD_IS_ENTRY_FRICTION");
  });

  it("D35–D37: commission/slippage only when verified; missing invent forbidden", () => {
    const invented = decidePerTradeEconomicFeasibility(xauInput({
      commissionAccount: 1.5,
      commissionVerified: false,
    }));
    // Unverified commission must not be silently included as verified cost path —
    // engine treats unverified commission as NOT_VERIFIED and excludes from friction.
    expect(invented.costBreakdown.commissionStatus).toBe("NOT_VERIFIED");
    expect(invented.costBreakdown.commissionAccount).toBeNull();

    const verified = decidePerTradeEconomicFeasibility(xauInput({
      commissionAccount: 0.5,
      commissionVerified: true,
      takeProfit: 4050,
    }));
    expect(verified.costBreakdown.commissionStatus).toBe("VERIFIED");
    expect(verified.costBreakdown.commissionAccount).toBe(0.5);
  });

  it("E44–E48: governance PENDING does not block XAU pipeline; EUR still waits; safety independent", () => {
    const xauReport = buildCanonicalPipelineReport({
      analysis: {
        instrument: "XAU/USD",
        dataQuality: "SUFFICIENT",
        quote: { quoteFresh: true },
      } as never,
      proposal: {
        instrument: "XAU/USD",
        lifecycle: "PROPOSAL_READY",
        direction: "BUY",
        placesOrders: false,
        acceptsForExecution: false,
        mutatesBroker: false,
      } as never,
      marketClosed: false,
      spreadPolicyStatus: "NOT_CONFIGURED",
      slippagePolicyStatus: "VERIFIED",
      slippageFillEvidenceAvailable: true,
    });
    expect(xauReport.stage1.WAITING_FOR_OWNER_APPROVAL).toBe(false);

    const eurReport = buildCanonicalPipelineReport({
      analysis: {
        instrument: "EUR/USD",
        dataQuality: "SUFFICIENT",
        quote: { quoteFresh: true },
      } as never,
      proposal: {
        instrument: "EUR/USD",
        lifecycle: "PROPOSAL_READY",
        direction: "BUY",
        placesOrders: false,
        acceptsForExecution: false,
        mutatesBroker: false,
      } as never,
      marketClosed: false,
      spreadPolicyStatus: "NOT_CONFIGURED",
      slippagePolicyStatus: "VERIFIED",
      slippageFillEvidenceAvailable: true,
    });
    expect(eurReport.stage1.WAITING_FOR_OWNER_APPROVAL).toBe(true);

    const readiness = buildStage1ReadinessReport({
      nowMs: NOW,
      marketOpen: true,
      store: { getInstrument: () => null },
    });
    const xau = readiness.instruments.find((i) => i.instrument === "XAU/USD")!;
    expect(xau.phaseStatus).toBe("ACTIVE");
    // Without slippage VERIFIED, still waiting for demo evidence — not for 0.30 approval.
    expect(xau.overall).not.toBe("WAITING_FOR_OWNER_APPROVAL");
    expect(["WAITING_FOR_CONTROLLED_DEMO_EVIDENCE", "NOT_CONFIGURED", "INSUFFICIENT_LIVE_EVIDENCE"])
      .toContain(xau.overall);
    for (const inst of ["EUR/USD", "GBP/USD", "USD/JPY"] as const) {
      expect(readiness.instruments.find((i) => i.instrument === inst)!.overall).toBe("OUT_OF_SCOPE");
    }
  });

  it("E39–E42: XAU DEMO readiness does not require fixed spread VERIFIED", () => {
    const proposal = {
      proposalId: "prop-xau-demo",
      instrument: "XAU/USD",
      lifecycle: "PROPOSAL_READY",
      direction: "BUY",
      placesOrders: false,
      acceptsForExecution: false,
      mutatesBroker: false,
    } as unknown as AtOrderProposalRecord;

    const r = evaluateControlledDemoReadiness({
      proposal,
      configuredEnvironment: "DEMO",
      sessionEnvironment: "DEMO",
      accountIdMasked: "****",
      bid: 4000,
      ask: 4000.3,
      quoteFresh: true,
      quoteAgeMs: 100,
      baseUnitSize: 1,
      offerId: "4001",
      spreadPolicyStatus: "PENDING_APPROVAL",
      slippagePolicyStatus: "VERIFIED",
      usableMargin: 5000,
      marginFresh: true,
      executionMasterEnabled: false,
      emergencyEntryLock: true,
      tradingEnabled: false,
      activeGrant: null,
      unresolvedAttemptExists: false,
      conflictingActiveExecution: false,
    });
    expect(r.gates.spreadPolicy.pass).toBe(true);
    expect(r.blockers.some((b) => b.code === "SPREAD_LIMIT_NOT_CONFIGURED")).toBe(false);
    expect(r.placesOrders).toBe(false);
    expect(r.mutatesBroker).toBe(false);
  });

  it("F49–F53: decision never authorizes broker submission", () => {
    const r = decidePerTradeEconomicFeasibility(xauInput());
    expect(r.authorizesBrokerSubmission).toBe(false);
    expect(r.placesOrders).toBe(false);
    expect(r.acceptsForExecution).toBe(false);
    expect(r.mutatesBroker).toBe(false);
    expect(r.requiresFreshProposalOnReject).toBe(true);
  });

  it("historical 0.30 legacy ceiling is optional emergency only — not primary REJECT", () => {
    const withoutCeiling = evaluateDynamicSpread(xauInput({
      spreadAbsolute: 0.45,
      legacyMaxSpreadAbsolute: null,
    }));
    expect(withoutCeiling.decision).toBe("ACCEPT");

    const withCeiling = evaluateDynamicSpread(xauInput({
      spreadAbsolute: 0.45,
      legacyMaxSpreadAbsolute: 0.30,
    }));
    expect(withCeiling.decision).toBe("REJECT");
    expect(withCeiling.primaryReasonCode).toBe("LEGACY_EMERGENCY_SPREAD_CEILING");
  });
});
