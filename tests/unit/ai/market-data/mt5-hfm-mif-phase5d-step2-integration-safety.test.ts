/**
 * Phase 5D Step 2 — integration with Step1/5C + safety regression.
 */
import { describe, it, expect } from "vitest";
import {
  assessMifHarmonicPatterns,
  assessMifMarketRegime,
  assessMifMultiTimeframeRelationships,
  getDefaultMifOpportunityDetectorRegistry,
  getDefaultMifStrategyIntelligenceRegistry,
  MIF_OPPORTUNITY_DETECTION_CONTRACT_ID,
  MIF_OPPORTUNITY_DETECTION_POLICY_ID,
  MIF_PROVIDER_ID,
  MIF_STRATEGY_INTELLIGENCE_CONTRACT_ID,
  runMifOpportunityDetection,
  type MifOpportunityDetectionContext,
} from "../../../../ai/market-data/mt5-hfm/mif/index";

describe("Phase 5D Step2 — integration & safety", () => {
  it("keeps Step1 registry and OD registry independently usable", () => {
    const strategies = getDefaultMifStrategyIntelligenceRegistry();
    const detectors = getDefaultMifOpportunityDetectorRegistry();
    expect(strategies.diagnostics().activeCount).toBe(10);
    expect(detectors.getPolicyId()).toBe(MIF_OPPORTUNITY_DETECTION_POLICY_ID);
    expect(detectors.diagnostics().validationOk).toBe(true);

    for (const id of [
      "TREND_CONTINUATION",
      "PULLBACK",
      "REVERSAL",
      "BREAKOUT",
      "BREAKOUT_RETEST",
      "RANGE",
      "LIQUIDITY_SWEEP",
      "SUPPLY_DEMAND",
      "MOMENTUM_EXPANSION",
      "PATTERN_COMPLETION",
    ] as const) {
      expect(strategies.getStrategy(id)?.lifecycleStatus).toBe("ACTIVE");
    }
    // Implemented detectors: TC + Pullback + Reversal + Breakout; later strategies remain unregistered.
    expect(detectors.findByStrategyId("TREND_CONTINUATION").length).toBeGreaterThanOrEqual(1);
    expect(detectors.findByStrategyId("PULLBACK").length).toBeGreaterThanOrEqual(1);
    expect(detectors.findByStrategyId("REVERSAL").length).toBeGreaterThanOrEqual(1);
    expect(detectors.findByStrategyId("BREAKOUT").length).toBeGreaterThanOrEqual(1);
    expect(detectors.findByStrategyId("BREAKOUT_RETEST")).toHaveLength(0);
  });

  it("runs detection without mutating Phase 5C assessments or enabling execution", () => {
    const har = assessMifHarmonicPatterns({
      candles: [],
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      quality: null,
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const reg = assessMifMarketRegime({
      candles: [],
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      quality: null,
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const mtf = assessMifMultiTimeframeRelationships({
      sources: [],
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const harBefore = JSON.stringify(har);
    const regBefore = JSON.stringify(reg);
    const mtfBefore = JSON.stringify(mtf);

    const ctx: MifOpportunityDetectionContext = {
      contextVersion: "1.0.0",
      providerId: MIF_PROVIDER_ID,
      providerSymbol: "XAUUSD",
      instrument: null,
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
      timebase: "BROKER_SERVER",
      dataQualityStatus: "VALID",
      availableTimeframeRoles: ["PRIMARY_DIRECTION"],
      evidence: [],
      regime: reg,
      harmonic: har,
      mtfRelationships: mtf,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
      doesNotApproveAiReasoning: true,
      analyticalDetectionContextOnly: true,
    };

    const result = runMifOpportunityDetection({ context: ctx });
    expect(result.contractId).toBe(MIF_OPPORTUNITY_DETECTION_CONTRACT_ID);
    expect(result.placesOrders).toBe(false);
    expect(result.mutatesBroker).toBe(false);
    expect(result.acceptsForExecution).toBe(false);
    expect(result.doesNotApproveAiReasoning).toBe(true);
    expect(result.analyticalDetectionOnly).toBe(true);
    expect(result.doesNotRankOpportunities).toBe(true);
    expect(result.candidates).toHaveLength(0);

    expect(JSON.stringify(har)).toBe(harBefore);
    expect(JSON.stringify(reg)).toBe(regBefore);
    expect(JSON.stringify(mtf)).toBe(mtfBefore);

    // Step1 eligibility contract still independent
    const elig = getDefaultMifStrategyIntelligenceRegistry().evaluateEligibility("RANGE", {
      providerSymbol: "XAUUSD",
      dataQualityStatus: "VALID",
      regimeDirection: "NEUTRAL",
      regimeStructure: "RANGING",
      regimeVolatility: "LOW",
      availableTimeframeRoles: ["INTERMEDIATE_STRUCTURE"],
      evidence: [
        {
          evidenceId: "rg.regime",
          family: "MARKET_REGIME",
          presence: "PRESENT",
          qualityStatus: "VALID",
          closedCandleSatisfied: true,
          sourceAssessmentId: reg.assessmentId,
          sourceContractId: "kwizera.mif.market-regime.v1",
        },
        {
          evidenceId: "rg.range",
          family: "RANGE_STRUCTURE",
          presence: "PRESENT",
          qualityStatus: "VALID",
          closedCandleSatisfied: true,
          sourceAssessmentId: reg.assessmentId,
          sourceContractId: "kwizera.mif.market-regime.v1",
        },
        {
          evidenceId: "rg.quality",
          family: "DATA_QUALITY",
          presence: "PRESENT",
          qualityStatus: "VALID",
          closedCandleSatisfied: null,
          sourceAssessmentId: null,
          sourceContractId: "kwizera.mif.quality.v1",
        },
      ],
    });
    expect(elig.contractId).toBe(MIF_STRATEGY_INTELLIGENCE_CONTRACT_ID);
    expect(elig.doesNotCreateOpportunities).toBe(true);
  });
});
