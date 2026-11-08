/**
 * Stage 2 — Canonical market analysis → proposal pipeline.
 * Fixtures labelled SYNTHETIC/HISTORICAL — never counted as LIVE evidence.
 */
import { describe, expect, it } from "vitest";
import {
  classifyMarketDataMode,
  normalizeDataModeLabel,
} from "../../../../ai/forex-ai/automated-trading/analysis/data-mode.js";
import {
  buildCanonicalPipelineReport,
  validateProposalPriceCompleteness,
} from "../../../../ai/forex-ai/automated-trading/order-proposal/canonical-pipeline-report.js";
import type { AtOrderProposalRecord } from "../../../../ai/forex-ai/automated-trading/order-proposal/types.js";
import type { CanonicalAnalysisResult } from "../../../../ai/forex-ai/automated-trading/analysis/canonical-analysis.types.js";
import { SLIPPAGE_EVIDENCE_REQUIRES_CONTROLLED_DEMO_EXECUTION } from "../../../../ai/forex-ai/automated-trading/risk-policy/slippage-evidence.js";

function syntheticAnalysis(over: Partial<CanonicalAnalysisResult> = {}): CanonicalAnalysisResult {
  const base = {
    schemaVersion: "kwizera.canonical-analysis.v1" as const,
    analysisVersion: "4.18C" as const,
    analysisId: "an-hist-1",
    environment: "demo" as const,
    instrument: "EUR/USD",
    provider: "FOREXCONNECT" as const,
    primaryTimeframe: "1h" as const,
    analyzedAtUtc: "2026-11-07T12:00:00.000Z",
    trigger: "unit_test" as const,
    evidenceFingerprint: "fp-test",
    quote: {
      instrument: "EUR/USD",
      bid: 1.1,
      ask: 1.1002,
      quoteFresh: false,
      freshnessReasonCode: "MARKET_CLOSED",
      effectivePriceChangeAgeMs: null,
      snapshotFingerprint: null,
      evaluatedAtUtc: "2026-11-07T12:00:00.000Z",
    },
    dataQuality: "INSUFFICIENT" as const,
    candleQuality: null,
    indicators: {
      fastSma: { value: null, provenance: "DETERMINISTIC_COMPUTED" as const, sourceComponent: "t", asOfUtc: null },
      slowSma: { value: null, provenance: "DETERMINISTIC_COMPUTED" as const, sourceComponent: "t", asOfUtc: null },
      atr: { value: null, provenance: "DETERMINISTIC_COMPUTED" as const, sourceComponent: "t", asOfUtc: null },
      atrMethod: "SMA_OF_TR" as const,
      atrLength: 14,
    },
    marketStructure: {
      trendDirection: { value: "UNKNOWN" as const, provenance: "DETERMINISTIC_COMPUTED" as const, sourceComponent: "t", asOfUtc: null },
      trendStrength: { value: "UNKNOWN" as const, provenance: "DETERMINISTIC_COMPUTED" as const, sourceComponent: "t", asOfUtc: null },
      momentum: { value: "UNKNOWN" as const, provenance: "DETERMINISTIC_COMPUTED" as const, sourceComponent: "t", asOfUtc: null },
      volatilityRegime: { value: "UNKNOWN" as const, provenance: "DETERMINISTIC_COMPUTED" as const, sourceComponent: "t", asOfUtc: null },
    },
    supportResistance: { support: [], resistance: [] },
    htf: {
      primaryTimeframe: "1h" as const,
      confirmationTimeframes: ["4h" as const, "1d" as const],
      perTf: [],
      agreement: "INSUFFICIENT" as const,
    },
    deterministic: null,
    ai: null,
    finalOutcome: "INSUFFICIENT_DATA" as const,
    direction: null,
    marketInterpretation: null,
    confidencePct: null,
    confidenceType: "ANALYSIS_CONFIDENCE" as const,
    confidenceModelVersion: "analysis-confidence.v1" as const,
    confidenceBreakdown: null,
    confidenceLimitations: [],
    reconciliationCode: "RECON_INSUFFICIENT",
    explanation: ["SYNTHETIC fixture"],
    validationErrors: [],
    placesOrders: false as const,
    acceptsForExecution: false as const,
  };
  return { ...base, ...over, quote: { ...base.quote, ...(over.quote || {}) } };
}

function blockedProposal(): AtOrderProposalRecord {
  return {
    schemaVersion: "at-order-proposal-v1",
    phase: "4.18G.2",
    proposalId: "prop-hist-1",
    idempotencyKey: "idem-1",
    createdAtUtc: "2026-11-07T12:01:00.000Z",
    updatedAtUtc: "2026-11-07T12:01:00.000Z",
    lifecycle: "BLOCKED",
    analysisId: "an-hist-1",
    resultIntakeId: "res-1",
    observationId: null,
    imageId: null,
    imageHash: null,
    instrument: "EUR/USD",
    timeframe: "1h",
    strategyId: null,
    environment: "demo",
    canonicalDecision: "NO_TRADE",
    direction: null,
    strategyRationale: [],
    supportingEvidence: [],
    conflictingEvidence: [],
    analysisConfidencePct: null,
    confidenceCalibrationFlag: false,
    pricePlan: {
      entryType: "UNSET",
      entryPrice: null,
      entryZoneLow: null,
      entryZoneHigh: null,
      stopLoss: null,
      takeProfit: null,
      riskDistance: null,
      rewardDistance: null,
      plannedRewardRiskRatio: null,
      takeProfitLabel: "3R_PLANNED_TARGET",
      takeProfitNote: "t",
      invalidationConditions: [],
    },
    capital: {
      verifiedEquity: null,
      accountCurrency: null,
      strategyAllocationPercent: null,
      strategyAllocationBudget: null,
      individualOrderAllocation: null,
      allocatedAmount: null,
      existingCommittedExposure: null,
      pendingProposalReservations: null,
      remainingStrategyBudget: null,
      riskTargetPercent: null,
      riskTargetAmount: null,
      riskMaximumPercent: null,
      maximumPermittedOrderLoss: null,
      allowedRiskAmount: null,
      projectedLossAtStopLoss: null,
      remainingRiskBudget: null,
      aggregateOpenRisk: null,
      pendingProposalRisk: null,
      aggregateRiskPercentPolicy: null,
      riskValidationStatus: "NOT_EVALUATED",
      riskPolicyId: "PER_ORDER_ALLOCATION_20TARGET_25MAX",
      riskPolicyVersion: "per-order-risk-v2-20target-25max",
      currency: null,
      configVersion: null,
      lastUpdateAtUtc: null,
    },
    quantity: {
      calculatedQuantity: null,
      normalizedQuantity: null,
      lotContractUnit: null,
      contractSize: null,
      tickSize: null,
      pipTickValue: null,
      brokerMinimum: null,
      brokerMaximum: null,
      quantityStep: null,
      ownerMaxQuantity: 0.01,
      estimatedMargin: null,
      availableMargin: null,
      usedMargin: null,
      projectedMarginUtilization: null,
      existingExposure: null,
      projectedExposure: null,
      sizingMethod: null,
    },
    brokerPrep: {
      accountReference: null,
      instrumentOfferReference: null,
      buySell: null,
      amountQuantity: null,
      orderType: null,
      entryPrice: null,
      stopLoss: null,
      takeProfit: null,
      timeInForce: null,
      expiration: null,
      clientReference: null,
      brokerOrderId: null,
      brokerTradeId: null,
      note: "non-submitting",
    },
    blockers: [{ code: "NO_CANONICAL_BUY_SELL", message: "No BUY/SELL" }],
    notes: ["SYNTHETIC fixture"],
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
  };
}

describe("Stage 2 — data mode classification", () => {
  it("labels MARKET_CLOSED / HISTORICAL / CACHED / SYNTHETIC and refuses LIVE claims", () => {
    expect(classifyMarketDataMode({ marketClosed: true }).dataMode).toBe("MARKET_CLOSED");
    expect(classifyMarketDataMode({ marketClosed: true }).code).toBe("WAITING_FOR_LIVE_MARKET");
    expect(classifyMarketDataMode({ historicalOnly: true }).dataMode).toBe("HISTORICAL");
    expect(classifyMarketDataMode({ cachedSnapshot: true }).dataMode).toBe("CACHED");
    expect(classifyMarketDataMode({ syntheticOrTest: true }).mayLabelAsLiveMarketPrice).toBe(false);
    expect(classifyMarketDataMode({
      quoteFresh: true,
      historicalOnly: false,
      marketClosed: false,
      candleIsHistoricalSeries: true,
    }).dataMode).toBe("LIVE");
    expect(normalizeDataModeLabel("HISTORICAL_ONLY")).toBe("HISTORICAL");
  });

  it("never promotes candle-only series to LIVE market price", () => {
    const c = classifyMarketDataMode({
      candleIsHistoricalSeries: true,
      quoteFresh: false,
      marketClosed: false,
    });
    expect(c.dataMode).toBe("HISTORICAL");
    expect(c.mayClaimLiveProposalReady).toBe(false);
  });
});

describe("Stage 2 — canonical pipeline report", () => {
  it("closed market + missing policies → NOT_RESOLVED with Stage 1 blockers; not live READY", () => {
    const report = buildCanonicalPipelineReport({
      analysis: syntheticAnalysis(),
      proposal: blockedProposal(),
      marketClosed: true,
      syntheticOrTest: true,
      spreadPolicyStatus: "NOT_CONFIGURED",
      slippagePolicyStatus: "NOT_CONFIGURED",
      slippageFillEvidenceAvailable: false,
    });
    expect(report.stage2Status).toBe("NOT_RESOLVED");
    expect(report.stage2LiveVerified).toBe(false);
    expect(report.reportAsLiveProposal).toBe(false);
    expect(report.placesOrders).toBe(false);
    expect(report.mutatesBroker).toBe(false);
    expect(report.stage1.WAITING_FOR_LIVE_MARKET).toBe(true);
    expect(report.stage1.WAITING_FOR_OWNER_APPROVAL).toBe(true);
    expect(report.stage1.WAITING_FOR_CONTROLLED_DEMO_EVIDENCE).toBe(true);
    expect(report.stage1.codes).toContain(SLIPPAGE_EVIDENCE_REQUIRES_CONTROLLED_DEMO_EXECUTION);
    expect(report.displayStatus).toBe("BLOCKED");
    expect(report.confidenceDefinition).toContain("ANALYSIS_CONFIDENCE");
  });

  it("HISTORICAL PROPOSAL_READY is WAITING — not live READY", () => {
    const proposal = blockedProposal();
    proposal.lifecycle = "PROPOSAL_READY";
    proposal.direction = "BUY";
    proposal.canonicalDecision = "BUY";
    proposal.pricePlan.entryPrice = 1.1;
    proposal.pricePlan.stopLoss = 1.09;
    proposal.pricePlan.takeProfit = 1.13;
    proposal.blockers = [];
    const report = buildCanonicalPipelineReport({
      analysis: syntheticAnalysis({
        quote: {
          instrument: "EUR/USD",
          bid: 1.1,
          ask: 1.1002,
          quoteFresh: false,
          freshnessReasonCode: "HISTORICAL",
          effectivePriceChangeAgeMs: null,
          snapshotFingerprint: null,
          evaluatedAtUtc: "2026-11-07T12:00:00.000Z",
        },
        finalOutcome: "BUY_CANDIDATE",
        direction: "BUY",
        marketInterpretation: "BULLISH",
      }),
      proposal,
      marketClosed: false,
      historicalOnly: true,
      spreadPolicyStatus: "NOT_CONFIGURED",
      slippagePolicyStatus: "NOT_CONFIGURED",
      slippageFillEvidenceAvailable: false,
    });
    expect(report.dataMode).toBe("HISTORICAL");
    expect(report.displayStatus).toBe("WAITING");
    expect(report.reportAsLiveProposal).toBe(false);
    expect(report.reportLabel).toContain("HISTORICAL");
  });

  it("incomplete entry/SL/TP fails completeness validation", () => {
    const p = blockedProposal();
    expect(validateProposalPriceCompleteness(p).complete).toBe(false);
    expect(validateProposalPriceCompleteness(p).blockers).toEqual(
      expect.arrayContaining(["ENTRY_MISSING", "STOP_LOSS_MISSING", "TAKE_PROFIT_MISSING"]),
    );
    p.pricePlan.entryPrice = 1.1;
    p.pricePlan.stopLoss = 1.09;
    p.pricePlan.takeProfit = 1.13;
    expect(validateProposalPriceCompleteness(p).complete).toBe(true);
  });
});
