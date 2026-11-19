/**
 * Phase 5D Step 11 — registry/orchestrator integration + safety.
 */
import { describe, it, expect } from "vitest";
import {
  MIF_BREAKOUT_DETECTOR_ID,
  MIF_BREAKOUT_RETEST_DETECTOR_ID,
  MIF_LIQUIDITY_SWEEP_DETECTOR_ID,
  MIF_MOMENTUM_EXPANSION_DETECTOR_ID,
  MIF_OPPORTUNITY_DETECTION_CONTRACT_ID,
  MIF_PATTERN_COMPLETION_DETECTOR_ID,
  MIF_PROVIDER_ID,
  MIF_PULLBACK_DETECTOR_ID,
  MIF_RANGE_DETECTOR_ID,
  MIF_REVERSAL_DETECTOR_ID,
  MIF_SUPPLY_DEMAND_DETECTOR_ID,
  MIF_TREND_CONTINUATION_DETECTOR_ID,
  getDefaultMifOpportunityDetectorRegistry,
  getDefaultMifStrategyIntelligenceRegistry,
  runMifOpportunityDetection,
  type MifDetectionEvidenceRef,
  type MifOpportunityDetectionContext,
} from "../../../../ai/market-data/mt5-hfm/mif/index";

function ev(
  over: Partial<MifDetectionEvidenceRef> & Pick<MifDetectionEvidenceRef, "evidenceId" | "family">,
): MifDetectionEvidenceRef {
  return {
    evidenceId: over.evidenceId,
    family: over.family,
    presence: over.presence ?? "PRESENT",
    sourceEngine: "test",
    sourceContractId: "kwizera.mif.test.v1",
    sourceContractVersion: "1.0.0",
    sourcePolicyVersion: "1.0.0",
    sourceAssessmentId: `${over.evidenceId}.src`,
    sourceInputIdentity: null,
    timeframe: over.timeframe ?? "H1",
    timeframeRole: "SETUP_DEVELOPMENT",
    assessmentTimestamp: "2024-06-01T12:00:00.000Z",
    qualityStatus: "VALID",
    candleState: over.candleState === undefined ? "CLOSED" : over.candleState,
    notes: over.notes,
  };
}

describe("Phase 5D Step11 — integration & safety", () => {
  it("registers all ten detectors covering the full strategy catalog", () => {
    const reg = getDefaultMifOpportunityDetectorRegistry();
    const strategies = getDefaultMifStrategyIntelligenceRegistry();
    expect(strategies.diagnostics().activeCount).toBe(10);
    expect(reg.getDetector(MIF_TREND_CONTINUATION_DETECTOR_ID)?.strategyId).toBe("TREND_CONTINUATION");
    expect(reg.getDetector(MIF_PULLBACK_DETECTOR_ID)?.strategyId).toBe("PULLBACK");
    expect(reg.getDetector(MIF_REVERSAL_DETECTOR_ID)?.strategyId).toBe("REVERSAL");
    expect(reg.getDetector(MIF_BREAKOUT_DETECTOR_ID)?.strategyId).toBe("BREAKOUT");
    expect(reg.getDetector(MIF_BREAKOUT_RETEST_DETECTOR_ID)?.strategyId).toBe("BREAKOUT_RETEST");
    expect(reg.getDetector(MIF_RANGE_DETECTOR_ID)?.strategyId).toBe("RANGE");
    expect(reg.getDetector(MIF_LIQUIDITY_SWEEP_DETECTOR_ID)?.strategyId).toBe("LIQUIDITY_SWEEP");
    expect(reg.getDetector(MIF_SUPPLY_DEMAND_DETECTOR_ID)?.strategyId).toBe("SUPPLY_DEMAND");
    expect(reg.getDetector(MIF_MOMENTUM_EXPANSION_DETECTOR_ID)?.strategyId).toBe("MOMENTUM_EXPANSION");
    expect(reg.getDetector(MIF_PATTERN_COMPLETION_DETECTOR_ID)?.strategyId).toBe("PATTERN_COMPLETION");
    expect(reg.diagnostics().activeCount).toBe(10);
    expect(reg.diagnostics().strategiesWithoutDetector).toHaveLength(0);
    for (const d of reg.listDetectors()) {
      expect(d.placesOrders).toBe(false);
      expect(d.mutatesBroker).toBe(false);
      expect(d.acceptsForExecution).toBe(false);
      expect(d.doesNotApproveAiReasoning).toBe(true);
    }
  });

  it("runs ten detectors through the orchestrator independently", () => {
    const ctx: MifOpportunityDetectionContext = {
      contextVersion: "1.0.0",
      providerId: MIF_PROVIDER_ID,
      providerSymbol: "XAUUSD",
      instrument: null,
      assessmentTimestamp: "2024-06-01T12:00:00.000Z",
      timebase: "BROKER_SERVER",
      dataQualityStatus: "VALID",
      availableTimeframeRoles: [
        "PRIMARY_DIRECTION",
        "INTERMEDIATE_STRUCTURE",
        "SETUP_DEVELOPMENT",
        "OPPORTUNITY_TRIGGER",
        "LOWER_TIMEFRAME_CONFIRMATION",
      ],
      evidence: [
        ev({
          evidenceId: "pc.geometric",
          family: "GEOMETRIC_PATTERN",
          notes:
            "patternType=DOUBLE_BOTTOM;patternId=GEO_DB1;lifecycle=CONFIRMED;orientation=BULLISH;confirm=true;confirmDir=BULLISH;closeState=CLOSED",
        }),
        ev({
          evidenceId: "pc.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "closeState=CLOSED",
        }),
        ev({ evidenceId: "pc.quality", family: "DATA_QUALITY", candleState: null }),
        ev({
          evidenceId: "pc.mtf",
          family: "MULTI_TIMEFRAME_RELATIONSHIP",
          notes: "relation=ALIGNMENT",
        }),
      ],
      evidenceSummary: {
        providerSymbol: "XAUUSD",
        dataQualityStatus: "VALID",
        regimeDirection: "UP",
        regimeStructure: "TRENDING",
        regimeVolatility: "NORMAL",
        availableTimeframeRoles: [
          "SETUP_DEVELOPMENT",
          "LOWER_TIMEFRAME_CONFIRMATION",
          "PRIMARY_DIRECTION",
          "INTERMEDIATE_STRUCTURE",
          "OPPORTUNITY_TRIGGER",
        ],
        evidence: [
          {
            evidenceId: "pc.geometric",
            family: "GEOMETRIC_PATTERN",
            presence: "PRESENT",
            qualityStatus: "VALID",
            closedCandleSatisfied: true,
            sourceAssessmentId: "pc.geometric.src",
            sourceContractId: "kwizera.mif.test.v1",
          },
          {
            evidenceId: "pc.quality",
            family: "DATA_QUALITY",
            presence: "PRESENT",
            qualityStatus: "VALID",
            closedCandleSatisfied: null,
            sourceAssessmentId: "pc.quality.src",
            sourceContractId: "kwizera.mif.test.v1",
          },
        ],
      },
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
      doesNotApproveAiReasoning: true,
      analyticalDetectionContextOnly: true,
    };

    const result = runMifOpportunityDetection({
      context: ctx,
      detectorRegistry: getDefaultMifOpportunityDetectorRegistry(),
      reportMissingDetectors: false,
    });

    expect(result.contractId).toBe(MIF_OPPORTUNITY_DETECTION_CONTRACT_ID);
    expect(result.acceptsForExecution).toBe(false);
    expect(result.doesNotRankOpportunities).toBe(true);

    const ids = [
      MIF_TREND_CONTINUATION_DETECTOR_ID,
      MIF_PULLBACK_DETECTOR_ID,
      MIF_REVERSAL_DETECTOR_ID,
      MIF_BREAKOUT_DETECTOR_ID,
      MIF_BREAKOUT_RETEST_DETECTOR_ID,
      MIF_RANGE_DETECTOR_ID,
      MIF_LIQUIDITY_SWEEP_DETECTOR_ID,
      MIF_SUPPLY_DEMAND_DETECTOR_ID,
      MIF_MOMENTUM_EXPANSION_DETECTOR_ID,
      MIF_PATTERN_COMPLETION_DETECTOR_ID,
    ];
    for (const id of ids) {
      expect(result.outcomes.find((o) => o.detectorId === id)?.status).toBeTruthy();
    }
    const pc = result.outcomes.find((o) => o.detectorId === MIF_PATTERN_COMPLETION_DETECTOR_ID);
    expect(pc?.status).toBe("CANDIDATE_PRODUCED");
    expect(result.candidates.some((c) => c.detectorId === MIF_PATTERN_COMPLETION_DETECTOR_ID)).toBe(
      true,
    );
    for (const o of result.outcomes) {
      expect(o.acceptsForExecution).toBe(false);
    }
  });

  it("does not fabricate pattern-completion candidates from empty evidence", () => {
    const result = runMifOpportunityDetection({
      context: {
        contextVersion: "1.0.0",
        providerId: MIF_PROVIDER_ID,
        providerSymbol: "XAUUSD",
        instrument: null,
        assessmentTimestamp: "2024-06-01T12:00:00.000Z",
        timebase: "BROKER_SERVER",
        dataQualityStatus: "VALID",
        availableTimeframeRoles: [],
        evidence: [],
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
        doesNotApproveAiReasoning: true,
        analyticalDetectionContextOnly: true,
      },
      detectorRegistry: getDefaultMifOpportunityDetectorRegistry(),
      reportMissingDetectors: false,
    });
    expect(result.candidates).toHaveLength(0);
    const pc = result.outcomes.find((o) => o.detectorId === MIF_PATTERN_COMPLETION_DETECTOR_ID);
    expect(pc?.status).not.toBe("CANDIDATE_PRODUCED");
  });
});
