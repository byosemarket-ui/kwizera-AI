/**
 * Phase 5D Step 10 — registry/orchestrator integration + safety.
 */
import { describe, it, expect } from "vitest";
import {
  MIF_BREAKOUT_DETECTOR_ID,
  MIF_BREAKOUT_RETEST_DETECTOR_ID,
  MIF_LIQUIDITY_SWEEP_DETECTOR_ID,
  MIF_MOMENTUM_EXPANSION_DETECTOR_ID,
  MIF_OPPORTUNITY_DETECTION_CONTRACT_ID,
  MIF_PROVIDER_ID,
  MIF_PULLBACK_DETECTOR_ID,
  MIF_RANGE_DETECTOR_ID,
  MIF_REVERSAL_DETECTOR_ID,
  MIF_SUPPLY_DEMAND_DETECTOR_ID,
  MIF_TREND_CONTINUATION_DETECTOR_ID,
  getDefaultMifOpportunityDetectorRegistry,
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
    timeframe: over.timeframe ?? "M15",
    timeframeRole: "OPPORTUNITY_FORMATION",
    assessmentTimestamp: "2024-06-01T12:00:00.000Z",
    qualityStatus: "VALID",
    candleState: over.candleState === undefined ? "CLOSED" : over.candleState,
    notes: over.notes,
  };
}

describe("Phase 5D Step10 — integration & safety", () => {
  it("registers momentum-expansion alongside the eight prior detectors", () => {
    const reg = getDefaultMifOpportunityDetectorRegistry();
    expect(reg.getDetector(MIF_TREND_CONTINUATION_DETECTOR_ID)?.strategyId).toBe("TREND_CONTINUATION");
    expect(reg.getDetector(MIF_PULLBACK_DETECTOR_ID)?.strategyId).toBe("PULLBACK");
    expect(reg.getDetector(MIF_REVERSAL_DETECTOR_ID)?.strategyId).toBe("REVERSAL");
    expect(reg.getDetector(MIF_BREAKOUT_DETECTOR_ID)?.strategyId).toBe("BREAKOUT");
    expect(reg.getDetector(MIF_BREAKOUT_RETEST_DETECTOR_ID)?.strategyId).toBe("BREAKOUT_RETEST");
    expect(reg.getDetector(MIF_RANGE_DETECTOR_ID)?.strategyId).toBe("RANGE");
    expect(reg.getDetector(MIF_LIQUIDITY_SWEEP_DETECTOR_ID)?.strategyId).toBe("LIQUIDITY_SWEEP");
    expect(reg.getDetector(MIF_SUPPLY_DEMAND_DETECTOR_ID)?.strategyId).toBe("SUPPLY_DEMAND");
    expect(reg.getDetector(MIF_MOMENTUM_EXPANSION_DETECTOR_ID)?.strategyId).toBe("MOMENTUM_EXPANSION");
    expect(reg.diagnostics().activeCount).toBeGreaterThanOrEqual(9);
    expect(reg.diagnostics().strategiesWithoutDetector.length).toBe(
      10 - reg.diagnostics().activeCount,
    );
    for (const d of reg.listDetectors()) {
      expect(d.placesOrders).toBe(false);
      expect(d.mutatesBroker).toBe(false);
      expect(d.acceptsForExecution).toBe(false);
      expect(d.doesNotApproveAiReasoning).toBe(true);
    }
  });

  it("runs nine detectors through the orchestrator independently", () => {
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
        "OPPORTUNITY_FORMATION",
        "LOWER_TIMEFRAME_CONFIRMATION",
      ],
      evidence: [
        ev({
          evidenceId: "me.displacement",
          family: "PRICE_DISPLACEMENT",
          notes:
            "direction=UP;phase=EXPANDING;atrExpand=true;magnitude=STRONG;closeState=CLOSED",
        }),
        ev({ evidenceId: "me.vol", family: "VOLATILITY", notes: "volState=HIGH" }),
        ev({
          evidenceId: "me.regime",
          family: "MARKET_REGIME",
          candleState: null,
          notes: "structure=TRENDING;direction=UP",
        }),
        ev({
          evidenceId: "me.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "closeState=CLOSED",
        }),
        ev({ evidenceId: "me.quality", family: "DATA_QUALITY", candleState: null }),
        ev({
          evidenceId: "me.mtf",
          family: "MULTI_TIMEFRAME_RELATIONSHIP",
          notes: "relation=ALIGNMENT",
        }),
      ],
      evidenceSummary: {
        providerSymbol: "XAUUSD",
        dataQualityStatus: "VALID",
        regimeDirection: "UP",
        regimeStructure: "TRENDING",
        regimeVolatility: "HIGH",
        availableTimeframeRoles: [
          "OPPORTUNITY_FORMATION",
          "PRIMARY_DIRECTION",
          "INTERMEDIATE_STRUCTURE",
          "SETUP_DEVELOPMENT",
          "LOWER_TIMEFRAME_CONFIRMATION",
        ],
        evidence: [
          {
            evidenceId: "me.displacement",
            family: "PRICE_DISPLACEMENT",
            presence: "PRESENT",
            qualityStatus: "VALID",
            closedCandleSatisfied: true,
            sourceAssessmentId: "me.displacement.src",
            sourceContractId: "kwizera.mif.test.v1",
          },
          {
            evidenceId: "me.vol",
            family: "VOLATILITY",
            presence: "PRESENT",
            qualityStatus: "VALID",
            closedCandleSatisfied: true,
            sourceAssessmentId: "me.vol.src",
            sourceContractId: "kwizera.mif.test.v1",
          },
          {
            evidenceId: "me.regime",
            family: "MARKET_REGIME",
            presence: "PRESENT",
            qualityStatus: "VALID",
            closedCandleSatisfied: null,
            sourceAssessmentId: "me.regime.src",
            sourceContractId: "kwizera.mif.test.v1",
          },
          {
            evidenceId: "me.quality",
            family: "DATA_QUALITY",
            presence: "PRESENT",
            qualityStatus: "VALID",
            closedCandleSatisfied: null,
            sourceAssessmentId: "me.quality.src",
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
    ];
    for (const id of ids) {
      expect(result.outcomes.find((o) => o.detectorId === id)?.status).toBeTruthy();
    }
    const me = result.outcomes.find((o) => o.detectorId === MIF_MOMENTUM_EXPANSION_DETECTOR_ID);
    expect(me?.status).toBe("CANDIDATE_PRODUCED");
    expect(result.candidates.some((c) => c.detectorId === MIF_MOMENTUM_EXPANSION_DETECTOR_ID)).toBe(
      true,
    );
    for (const o of result.outcomes) {
      expect(o.acceptsForExecution).toBe(false);
    }
  });

  it("does not fabricate momentum-expansion candidates from empty evidence", () => {
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
    const me = result.outcomes.find((o) => o.detectorId === MIF_MOMENTUM_EXPANSION_DETECTOR_ID);
    expect(me?.status).not.toBe("CANDIDATE_PRODUCED");
  });
});
