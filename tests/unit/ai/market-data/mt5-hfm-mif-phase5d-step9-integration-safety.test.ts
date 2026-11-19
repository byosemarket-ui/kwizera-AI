/**
 * Phase 5D Step 9 — registry/orchestrator integration + safety.
 */
import { describe, it, expect } from "vitest";
import {
  MIF_BREAKOUT_DETECTOR_ID,
  MIF_BREAKOUT_RETEST_DETECTOR_ID,
  MIF_LIQUIDITY_SWEEP_DETECTOR_ID,
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
    timeframe: over.timeframe ?? "H1",
    timeframeRole: "INTERMEDIATE_STRUCTURE",
    assessmentTimestamp: "2024-06-01T12:00:00.000Z",
    qualityStatus: "VALID",
    candleState: over.candleState === undefined ? "CLOSED" : over.candleState,
    notes: over.notes,
  };
}

function item(evidenceId: string, family: MifDetectionEvidenceRef["family"]) {
  return {
    evidenceId,
    family,
    presence: "PRESENT" as const,
    qualityStatus: "VALID" as const,
    closedCandleSatisfied: true as boolean | null,
    sourceAssessmentId: `${evidenceId}.src`,
    sourceContractId: "kwizera.mif.test.v1",
  };
}

describe("Phase 5D Step9 — integration & safety", () => {
  it("registers supply-demand alongside the seven prior detectors", () => {
    const reg = getDefaultMifOpportunityDetectorRegistry();
    expect(reg.getDetector(MIF_TREND_CONTINUATION_DETECTOR_ID)?.strategyId).toBe("TREND_CONTINUATION");
    expect(reg.getDetector(MIF_PULLBACK_DETECTOR_ID)?.strategyId).toBe("PULLBACK");
    expect(reg.getDetector(MIF_REVERSAL_DETECTOR_ID)?.strategyId).toBe("REVERSAL");
    expect(reg.getDetector(MIF_BREAKOUT_DETECTOR_ID)?.strategyId).toBe("BREAKOUT");
    expect(reg.getDetector(MIF_BREAKOUT_RETEST_DETECTOR_ID)?.strategyId).toBe("BREAKOUT_RETEST");
    expect(reg.getDetector(MIF_RANGE_DETECTOR_ID)?.strategyId).toBe("RANGE");
    expect(reg.getDetector(MIF_LIQUIDITY_SWEEP_DETECTOR_ID)?.strategyId).toBe("LIQUIDITY_SWEEP");
    expect(reg.getDetector(MIF_SUPPLY_DEMAND_DETECTOR_ID)?.strategyId).toBe("SUPPLY_DEMAND");
    expect(reg.diagnostics().activeCount).toBe(8);
    expect(reg.diagnostics().strategiesWithoutDetector).toHaveLength(2);
    expect(reg.diagnostics().strategiesWithoutDetector.sort()).toEqual([
      "MOMENTUM_EXPANSION",
      "PATTERN_COMPLETION",
    ]);
    for (const d of reg.listDetectors()) {
      expect(d.placesOrders).toBe(false);
      expect(d.acceptsForExecution).toBe(false);
      expect(d.doesNotApproveAiReasoning).toBe(true);
    }
  });

  it("runs eight detectors through the orchestrator independently", () => {
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
          evidenceId: "sd.structure",
          family: "MARKET_STRUCTURE",
          notes:
            "zoneId=ZONE_D1;zoneKind=DEMAND;lowerId=ZL;upperId=ZU;orderValid=true;interaction=REACTION_CONFIRMED",
        }),
        ev({
          evidenceId: "sd.displacement",
          family: "PRICE_DISPLACEMENT",
          notes: "origin=IMPULSE;direction=UP",
        }),
        ev({
          evidenceId: "sd.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "react=UP;closeState=CLOSED;accepted=false",
        }),
        ev({ evidenceId: "sd.quality", family: "DATA_QUALITY", candleState: null }),
      ],
      evidenceSummary: {
        providerSymbol: "XAUUSD",
        dataQualityStatus: "VALID",
        regimeDirection: "UP",
        regimeStructure: "TRENDING",
        regimeVolatility: "NORMAL",
        availableTimeframeRoles: [
          "PRIMARY_DIRECTION",
          "INTERMEDIATE_STRUCTURE",
          "SETUP_DEVELOPMENT",
          "OPPORTUNITY_FORMATION",
          "LOWER_TIMEFRAME_CONFIRMATION",
        ],
        evidence: [
          item("sd.structure", "MARKET_STRUCTURE"),
          item("sd.displacement", "PRICE_DISPLACEMENT"),
          item("sd.quality", "DATA_QUALITY"),
        ].map((e) =>
          e.evidenceId.endsWith("quality") ? { ...e, closedCandleSatisfied: null } : e,
        ),
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
    ];
    for (const id of ids) {
      expect(result.outcomes.find((o) => o.detectorId === id)?.status).toBeTruthy();
    }
    const sd = result.outcomes.find((o) => o.detectorId === MIF_SUPPLY_DEMAND_DETECTOR_ID);
    expect(sd?.status).toBe("CANDIDATE_PRODUCED");
    expect(result.candidates.some((c) => c.detectorId === MIF_SUPPLY_DEMAND_DETECTOR_ID)).toBe(true);
    for (const o of result.outcomes) {
      expect(o.acceptsForExecution).toBe(false);
    }
  });

  it("does not fabricate supply-demand candidates from empty evidence", () => {
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
    const sd = result.outcomes.find((o) => o.detectorId === MIF_SUPPLY_DEMAND_DETECTOR_ID);
    expect(sd?.status).not.toBe("CANDIDATE_PRODUCED");
  });
});
