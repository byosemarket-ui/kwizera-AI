/**
 * Phase 5D Step 1 — integration + safety regression.
 */
import { describe, it, expect } from "vitest";
import {
  assessMifHarmonicPatterns,
  assessMifMarketRegime,
  assessMifMultiTimeframeRelationships,
  getDefaultMifStrategyIntelligenceRegistry,
  MIF_HARMONIC_PATTERNS_CONTRACT_ID,
  MIF_MARKET_REGIME_CONTRACT_ID,
  MIF_MTF_RELATIONSHIPS_CONTRACT_ID,
  MIF_EVIDENCE_FAMILY_CATALOG,
  MIF_STRATEGY_INTELLIGENCE_CONTRACT_ID,
} from "../../../../ai/market-data/mt5-hfm/mif/index";

describe("Phase 5D Step1 — integration & safety", () => {
  it("reuses Phase 5C contract IDs in evidence catalog", () => {
    expect(MIF_EVIDENCE_FAMILY_CATALOG.MARKET_REGIME.expectedSourceContractId).toBe(
      MIF_MARKET_REGIME_CONTRACT_ID,
    );
    expect(MIF_EVIDENCE_FAMILY_CATALOG.HARMONIC_PATTERN.expectedSourceContractId).toBe(
      MIF_HARMONIC_PATTERNS_CONTRACT_ID,
    );
    expect(MIF_EVIDENCE_FAMILY_CATALOG.MULTI_TIMEFRAME_RELATIONSHIP.expectedSourceContractId).toBe(
      MIF_MTF_RELATIONSHIPS_CONTRACT_ID,
    );
    expect(MIF_EVIDENCE_FAMILY_CATALOG.LIQUIDITY_REFERENCE.availability).toBe("AVAILABLE");
    expect(MIF_EVIDENCE_FAMILY_CATALOG.MOMENTUM.availability).toBe("AVAILABLE");
    expect(MIF_EVIDENCE_FAMILY_CATALOG.MARKET_STRUCTURE.availability).toBe("AVAILABLE");
    expect(MIF_EVIDENCE_FAMILY_CATALOG.SUPPORT_RESISTANCE.availability).toBe("AVAILABLE");
  });

  it("registry and Phase 5C engines remain independently callable with safety flags", () => {
    const registry = getDefaultMifStrategyIntelligenceRegistry();
    expect(registry.diagnostics().strategyCount).toBe(10);

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

    for (const a of [har, reg, mtf]) {
      expect(a.placesOrders).toBe(false);
      expect(a.mutatesBroker).toBe(false);
      expect(a.acceptsForExecution).toBe(false);
      expect(a.doesNotApproveAiReasoning).toBe(true);
    }

    const elig = registry.evaluateEligibility("RANGE", {
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
          sourceContractId: MIF_MARKET_REGIME_CONTRACT_ID,
        },
        {
          evidenceId: "rg.range",
          family: "RANGE_STRUCTURE",
          presence: "PRESENT",
          qualityStatus: "VALID",
          closedCandleSatisfied: true,
          sourceAssessmentId: reg.assessmentId,
          sourceContractId: MIF_MARKET_REGIME_CONTRACT_ID,
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
    expect(elig.status).toBe("ELIGIBLE_FOR_DETECTION");
    expect(elig.doesNotCreateOpportunities).toBe(true);
    expect(elig.acceptsForExecution).toBe(false);
  });
});
