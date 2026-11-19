/**
 * Phase 5D Step 7 — registry/orchestrator integration + safety.
 */
import { describe, it, expect } from "vitest";
import {
  MIF_BREAKOUT_DETECTOR_ID,
  MIF_BREAKOUT_RETEST_DETECTOR_ID,
  MIF_OPPORTUNITY_DETECTION_CONTRACT_ID,
  MIF_PROVIDER_ID,
  MIF_PULLBACK_DETECTOR_ID,
  MIF_RANGE_DETECTOR_ID,
  MIF_REVERSAL_DETECTOR_ID,
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

describe("Phase 5D Step7 — integration & safety", () => {
  it("registers range alongside TC, pullback, reversal, breakout, and breakout-retest", () => {
    const reg = getDefaultMifOpportunityDetectorRegistry();
    expect(reg.getDetector(MIF_TREND_CONTINUATION_DETECTOR_ID)?.strategyId).toBe("TREND_CONTINUATION");
    expect(reg.getDetector(MIF_PULLBACK_DETECTOR_ID)?.strategyId).toBe("PULLBACK");
    expect(reg.getDetector(MIF_REVERSAL_DETECTOR_ID)?.strategyId).toBe("REVERSAL");
    expect(reg.getDetector(MIF_BREAKOUT_DETECTOR_ID)?.strategyId).toBe("BREAKOUT");
    expect(reg.getDetector(MIF_BREAKOUT_RETEST_DETECTOR_ID)?.strategyId).toBe("BREAKOUT_RETEST");
    expect(reg.getDetector(MIF_RANGE_DETECTOR_ID)?.strategyId).toBe("RANGE");
    expect(reg.diagnostics().activeCount).toBeGreaterThanOrEqual(6);
    expect(reg.getDetector(MIF_RANGE_DETECTOR_ID)).toBeTruthy();
    expect(reg.diagnostics().strategiesWithoutDetector.length).toBe(
      10 - reg.diagnostics().activeCount,
    );
    for (const d of reg.listDetectors()) {
      expect(d.placesOrders).toBe(false);
      expect(d.acceptsForExecution).toBe(false);
      expect(d.doesNotApproveAiReasoning).toBe(true);
    }
  });

  it("runs six detectors through the orchestrator independently", () => {
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
        ev({ evidenceId: "rg.regime", family: "MARKET_REGIME" }),
        ev({
          evidenceId: "rg.range",
          family: "RANGE_STRUCTURE",
          notes:
            "upperId=ZONE_U;lowerId=ZONE_L;rangeState=VALID;position=NEAR_LOWER;orderValid=true",
        }),
        ev({
          evidenceId: "rg.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "reject=UP;closeState=CLOSED;accepted=true",
        }),
        ev({ evidenceId: "rg.quality", family: "DATA_QUALITY", candleState: null }),
      ],
      evidenceSummary: {
        providerSymbol: "XAUUSD",
        dataQualityStatus: "VALID",
        regimeDirection: "NEUTRAL",
        regimeStructure: "RANGING",
        regimeVolatility: "NORMAL",
        availableTimeframeRoles: [
          "PRIMARY_DIRECTION",
          "INTERMEDIATE_STRUCTURE",
          "SETUP_DEVELOPMENT",
          "OPPORTUNITY_FORMATION",
          "LOWER_TIMEFRAME_CONFIRMATION",
        ],
        evidence: [
          item("rg.regime", "MARKET_REGIME"),
          item("rg.range", "RANGE_STRUCTURE"),
          item("rg.quality", "DATA_QUALITY"),
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
    ];
    for (const id of ids) {
      expect(result.outcomes.find((o) => o.detectorId === id)?.status).toBeTruthy();
    }
    const rg = result.outcomes.find((o) => o.detectorId === MIF_RANGE_DETECTOR_ID);
    expect(rg?.status).toBe("CANDIDATE_PRODUCED");
    expect(result.candidates.some((c) => c.detectorId === MIF_RANGE_DETECTOR_ID)).toBe(true);
    for (const o of result.outcomes) {
      expect(o.acceptsForExecution).toBe(false);
    }
  });

  it("does not fabricate range candidates from empty evidence", () => {
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
    const rg = result.outcomes.find((o) => o.detectorId === MIF_RANGE_DETECTOR_ID);
    expect(rg?.status).not.toBe("CANDIDATE_PRODUCED");
  });
});
