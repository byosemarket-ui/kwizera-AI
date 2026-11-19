/**
 * Phase 5D Step 3 — registry/orchestrator integration + safety.
 */
import { describe, it, expect } from "vitest";
import {
  MIF_OPPORTUNITY_DETECTION_CONTRACT_ID,
  MIF_PROVIDER_ID,
  MIF_PULLBACK_DETECTOR_ID,
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
    timeframeRole: "OPPORTUNITY_FORMATION",
    assessmentTimestamp: "2024-06-01T12:00:00.000Z",
    qualityStatus: "VALID",
    candleState: over.candleState === undefined ? "CLOSED" : over.candleState,
    notes: over.notes,
  };
}

function combinedContext(): MifOpportunityDetectionContext {
  return {
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
      ],
      evidence: [
        {
          evidenceId: "tc.regime",
          family: "MARKET_REGIME",
          presence: "PRESENT",
          qualityStatus: "VALID",
          closedCandleSatisfied: true,
          sourceAssessmentId: "a",
          sourceContractId: "kwizera.mif.market-regime.v1",
        },
        {
          evidenceId: "tc.mtf",
          family: "MULTI_TIMEFRAME_RELATIONSHIP",
          presence: "PRESENT",
          qualityStatus: "VALID",
          closedCandleSatisfied: true,
          sourceAssessmentId: "b",
          sourceContractId: "kwizera.mif.multi-timeframe-relationships.v1",
        },
        {
          evidenceId: "tc.quality",
          family: "DATA_QUALITY",
          presence: "PRESENT",
          qualityStatus: "VALID",
          closedCandleSatisfied: null,
          sourceAssessmentId: null,
          sourceContractId: "kwizera.mif.quality.v1",
        },
        {
          evidenceId: "tc.structure",
          family: "MARKET_STRUCTURE",
          presence: "PRESENT",
          qualityStatus: "VALID",
          closedCandleSatisfied: true,
          sourceAssessmentId: null,
          sourceContractId: null,
        },
        {
          evidenceId: "pb.regime",
          family: "MARKET_REGIME",
          presence: "PRESENT",
          qualityStatus: "VALID",
          closedCandleSatisfied: true,
          sourceAssessmentId: "a",
          sourceContractId: "kwizera.mif.market-regime.v1",
        },
        {
          evidenceId: "pb.mtf",
          family: "MULTI_TIMEFRAME_RELATIONSHIP",
          presence: "PRESENT",
          qualityStatus: "VALID",
          closedCandleSatisfied: true,
          sourceAssessmentId: "b2",
          sourceContractId: "kwizera.mif.multi-timeframe-relationships.v1",
        },
        {
          evidenceId: "pb.quality",
          family: "DATA_QUALITY",
          presence: "PRESENT",
          qualityStatus: "VALID",
          closedCandleSatisfied: null,
          sourceAssessmentId: null,
          sourceContractId: "kwizera.mif.quality.v1",
        },
        {
          evidenceId: "pb.structure",
          family: "MARKET_STRUCTURE",
          presence: "PRESENT",
          qualityStatus: "VALID",
          closedCandleSatisfied: true,
          sourceAssessmentId: null,
          sourceContractId: null,
        },
      ],
    },
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    doesNotApproveAiReasoning: true,
    analyticalDetectionContextOnly: true,
  };
}

describe("Phase 5D Step3 — integration & safety", () => {
  it("registers both detectors in the default registry", () => {
    const reg = getDefaultMifOpportunityDetectorRegistry();
    expect(reg.getDetector(MIF_TREND_CONTINUATION_DETECTOR_ID)?.strategyId).toBe("TREND_CONTINUATION");
    expect(reg.getDetector(MIF_PULLBACK_DETECTOR_ID)?.strategyId).toBe("PULLBACK");
    expect(reg.diagnostics().activeCount).toBe(2);
    expect(reg.diagnostics().strategiesWithoutDetector).toHaveLength(8);
    expect(getDefaultMifStrategyIntelligenceRegistry().getStrategy("TREND_CONTINUATION")?.lifecycleStatus)
      .toBe("ACTIVE");
  });

  it("runs both detectors through the orchestrator independently", () => {
    const result = runMifOpportunityDetection({
      context: combinedContext(),
      detectorRegistry: getDefaultMifOpportunityDetectorRegistry(),
      reportMissingDetectors: false,
    });
    expect(result.contractId).toBe(MIF_OPPORTUNITY_DETECTION_CONTRACT_ID);
    expect(result.doesNotRankOpportunities).toBe(true);
    expect(result.acceptsForExecution).toBe(false);
    expect(result.placesOrders).toBe(false);

    const tc = result.outcomes.find((o) => o.detectorId === MIF_TREND_CONTINUATION_DETECTOR_ID);
    const pb = result.outcomes.find((o) => o.detectorId === MIF_PULLBACK_DETECTOR_ID);
    expect(tc?.status).toBe("CANDIDATE_PRODUCED");
    expect(pb?.status).toBe("CANDIDATE_PRODUCED");
    expect(result.candidates).toHaveLength(2);
    expect(new Set(result.candidates.map((c) => c.candidateId)).size).toBe(2);
  });

  it("does not fabricate candidates from empty evidence", () => {
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
    for (const o of result.outcomes) {
      expect(o.status).not.toBe("CANDIDATE_PRODUCED");
      expect(o.acceptsForExecution).toBe(false);
    }
  });
});
