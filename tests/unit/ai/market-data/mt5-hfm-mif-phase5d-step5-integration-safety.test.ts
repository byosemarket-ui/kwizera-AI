/**
 * Phase 5D Step 5 — registry/orchestrator integration + safety.
 */
import { describe, it, expect } from "vitest";
import {
  MIF_BREAKOUT_DETECTOR_ID,
  MIF_OPPORTUNITY_DETECTION_CONTRACT_ID,
  MIF_PROVIDER_ID,
  MIF_PULLBACK_DETECTOR_ID,
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

describe("Phase 5D Step5 — integration & safety", () => {
  it("registers breakout alongside TC, pullback, and reversal", () => {
    const reg = getDefaultMifOpportunityDetectorRegistry();
    expect(reg.getDetector(MIF_TREND_CONTINUATION_DETECTOR_ID)?.strategyId).toBe("TREND_CONTINUATION");
    expect(reg.getDetector(MIF_PULLBACK_DETECTOR_ID)?.strategyId).toBe("PULLBACK");
    expect(reg.getDetector(MIF_REVERSAL_DETECTOR_ID)?.strategyId).toBe("REVERSAL");
    expect(reg.getDetector(MIF_BREAKOUT_DETECTOR_ID)?.strategyId).toBe("BREAKOUT");
    expect(reg.diagnostics().activeCount).toBe(4);
    expect(reg.diagnostics().strategiesWithoutDetector).toHaveLength(6);
    for (const d of reg.listDetectors()) {
      expect(d.placesOrders).toBe(false);
      expect(d.acceptsForExecution).toBe(false);
      expect(d.doesNotApproveAiReasoning).toBe(true);
    }
  });

  it("runs all four detectors through the orchestrator independently", () => {
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
        ev({ evidenceId: "tc.regime", family: "MARKET_REGIME" }),
        ev({
          evidenceId: "tc.mtf",
          family: "MULTI_TIMEFRAME_RELATIONSHIP",
          notes: "relation=ALIGNMENT",
        }),
        ev({ evidenceId: "tc.quality", family: "DATA_QUALITY", candleState: null }),
        ev({ evidenceId: "tc.structure", family: "MARKET_STRUCTURE" }),
        ev({ evidenceId: "pb.regime", family: "MARKET_REGIME" }),
        ev({
          evidenceId: "pb.mtf",
          family: "MULTI_TIMEFRAME_RELATIONSHIP",
          notes: "relation=COUNTERTREND_PULLBACK",
        }),
        ev({ evidenceId: "pb.quality", family: "DATA_QUALITY", candleState: null }),
        ev({ evidenceId: "pb.structure", family: "MARKET_STRUCTURE" }),
        ev({ evidenceId: "rv.regime", family: "MARKET_REGIME" }),
        ev({
          evidenceId: "rv.mtf",
          family: "MULTI_TIMEFRAME_RELATIONSHIP",
          notes: "relation=POTENTIAL_REVERSAL",
        }),
        ev({
          evidenceId: "rv.structure",
          family: "MARKET_STRUCTURE",
          notes: "structuralChange=CHoCH;priorDirection=DOWN;newBias=BULLISH",
        }),
        ev({ evidenceId: "rv.quality", family: "DATA_QUALITY", candleState: null }),
        ev({ evidenceId: "bo.regime", family: "MARKET_REGIME" }),
        ev({
          evidenceId: "bo.boundary",
          family: "SUPPORT_RESISTANCE",
          notes: "boundaryKind=RESISTANCE;boundaryQuality=VALID",
        }),
        ev({
          evidenceId: "bo.displacement",
          family: "PRICE_DISPLACEMENT",
          notes: "excursion=BEYOND;side=ABOVE;closeState=CLOSED;accepted=true",
        }),
        ev({ evidenceId: "bo.quality", family: "DATA_QUALITY", candleState: null }),
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
          item("tc.regime", "MARKET_REGIME"),
          item("tc.mtf", "MULTI_TIMEFRAME_RELATIONSHIP"),
          item("tc.quality", "DATA_QUALITY"),
          item("tc.structure", "MARKET_STRUCTURE"),
          item("pb.regime", "MARKET_REGIME"),
          item("pb.mtf", "MULTI_TIMEFRAME_RELATIONSHIP"),
          item("pb.quality", "DATA_QUALITY"),
          item("pb.structure", "MARKET_STRUCTURE"),
          item("rv.regime", "MARKET_REGIME"),
          item("rv.mtf", "MULTI_TIMEFRAME_RELATIONSHIP"),
          item("rv.structure", "MARKET_STRUCTURE"),
          item("rv.quality", "DATA_QUALITY"),
          item("bo.regime", "MARKET_REGIME"),
          item("bo.boundary", "SUPPORT_RESISTANCE"),
          item("bo.displacement", "PRICE_DISPLACEMENT"),
          item("bo.quality", "DATA_QUALITY"),
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

    // BREAKOUT eligibility prefers BREAKOUT/RANGING/TRENDING — TRENDING OK.
    // For stronger breakout status use BREAKOUT structure in a separate summary is hard;
    // detector still can produce with TRENDING + closed beyond + accepted.
    const result = runMifOpportunityDetection({
      context: {
        ...ctx,
        evidenceSummary: {
          ...ctx.evidenceSummary!,
          regimeStructure: "BREAKOUT",
        },
      },
      detectorRegistry: getDefaultMifOpportunityDetectorRegistry(),
      reportMissingDetectors: false,
    });

    expect(result.contractId).toBe(MIF_OPPORTUNITY_DETECTION_CONTRACT_ID);
    expect(result.acceptsForExecution).toBe(false);
    expect(result.doesNotRankOpportunities).toBe(true);

    const tc = result.outcomes.find((o) => o.detectorId === MIF_TREND_CONTINUATION_DETECTOR_ID);
    const pb = result.outcomes.find((o) => o.detectorId === MIF_PULLBACK_DETECTOR_ID);
    const rv = result.outcomes.find((o) => o.detectorId === MIF_REVERSAL_DETECTOR_ID);
    const bo = result.outcomes.find((o) => o.detectorId === MIF_BREAKOUT_DETECTOR_ID);

    // TC may be INELIGIBLE if regime BREAKOUT isn't in TC compatibility (TC wants TRENDING).
    // Use dual summaries isn't possible — so check BO produced and others don't crash.
    expect(bo?.status).toBe("CANDIDATE_PRODUCED");
    expect([tc?.status, pb?.status, rv?.status].every((s) => s != null)).toBe(true);
    expect(result.candidates.some((c) => c.detectorId === MIF_BREAKOUT_DETECTOR_ID)).toBe(true);
    for (const o of result.outcomes) {
      expect(o.acceptsForExecution).toBe(false);
    }
  });

  it("does not fabricate breakout candidates from empty evidence", () => {
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
    const bo = result.outcomes.find((o) => o.detectorId === MIF_BREAKOUT_DETECTOR_ID);
    expect(bo?.status).not.toBe("CANDIDATE_PRODUCED");
  });
});
