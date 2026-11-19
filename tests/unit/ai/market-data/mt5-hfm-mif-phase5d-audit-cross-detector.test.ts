/**
 * Phase 5D full-system audit — cross-detector integration, isolation, safety.
 */
import { describe, it, expect } from "vitest";
import {
  MIF_BREAKOUT_DETECTOR_ID,
  MIF_BREAKOUT_RETEST_DETECTOR_ID,
  MIF_LIQUIDITY_SWEEP_DETECTOR_ID,
  MIF_MOMENTUM_EXPANSION_DETECTOR_ID,
  MIF_PATTERN_COMPLETION_DETECTOR_ID,
  MIF_PROVIDER_ID,
  MIF_PULLBACK_DETECTOR_ID,
  MIF_RANGE_DETECTOR_ID,
  MIF_REVERSAL_DETECTOR_ID,
  MIF_SUPPLY_DEMAND_DETECTOR_ID,
  MIF_TREND_CONTINUATION_DETECTOR_ID,
  getDefaultMifOpportunityDetectorRegistry,
  getDefaultMifStrategyIntelligenceRegistry,
  mifPatternCompletionDetector,
  runMifOpportunityDetection,
  type MifDetectionEvidenceRef,
  type MifOpportunityDetectionContext,
  type MifOpportunityDetector,
} from "../../../../ai/market-data/mt5-hfm/mif/index";

const ALL_IDS = [
  MIF_BREAKOUT_DETECTOR_ID,
  MIF_BREAKOUT_RETEST_DETECTOR_ID,
  MIF_LIQUIDITY_SWEEP_DETECTOR_ID,
  MIF_MOMENTUM_EXPANSION_DETECTOR_ID,
  MIF_PATTERN_COMPLETION_DETECTOR_ID,
  MIF_PULLBACK_DETECTOR_ID,
  MIF_RANGE_DETECTOR_ID,
  MIF_REVERSAL_DETECTOR_ID,
  MIF_SUPPLY_DEMAND_DETECTOR_ID,
  MIF_TREND_CONTINUATION_DETECTOR_ID,
].sort();

function ev(
  over: Partial<MifDetectionEvidenceRef> & Pick<MifDetectionEvidenceRef, "evidenceId" | "family">,
): MifDetectionEvidenceRef {
  return {
    evidenceId: over.evidenceId,
    family: over.family,
    presence: over.presence ?? "PRESENT",
    sourceEngine: "audit",
    sourceContractId: "kwizera.mif.audit.v1",
    sourceContractVersion: "1.0.0",
    sourcePolicyVersion: "1.0.0",
    sourceAssessmentId: `${over.evidenceId}.src`,
    sourceInputIdentity: null,
    timeframe: over.timeframe ?? "H1",
    timeframeRole: over.timeframeRole ?? "SETUP_DEVELOPMENT",
    assessmentTimestamp: "2024-06-01T12:00:00.000Z",
    qualityStatus: over.qualityStatus ?? "VALID",
    candleState: over.candleState === undefined ? "CLOSED" : over.candleState,
    notes: over.notes,
  };
}

function emptyCtx(over: Partial<MifOpportunityDetectionContext> = {}): MifOpportunityDetectionContext {
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
      "OPPORTUNITY_TRIGGER",
      "LOWER_TIMEFRAME_CONFIRMATION",
    ],
    evidence: [],
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    doesNotApproveAiReasoning: true,
    analyticalDetectionContextOnly: true,
    ...over,
  };
}

describe("Phase 5D audit — registry completeness", () => {
  it("registers exactly 10 detectors covering all 10 strategies", () => {
    const reg = getDefaultMifOpportunityDetectorRegistry();
    const strat = getDefaultMifStrategyIntelligenceRegistry();
    expect(strat.diagnostics().activeCount).toBe(10);
    expect(reg.diagnostics().activeCount).toBe(10);
    expect(reg.diagnostics().strategiesWithoutDetector).toEqual([]);
    expect(reg.listDetectors().map((d) => d.detectorId).sort()).toEqual(ALL_IDS);
    for (const d of reg.listDetectors()) {
      expect(d.placesOrders).toBe(false);
      expect(d.mutatesBroker).toBe(false);
      expect(d.acceptsForExecution).toBe(false);
      expect(d.doesNotApproveAiReasoning).toBe(true);
    }
  });

  it("lists detectors in deterministic detectorId order", () => {
    const a = getDefaultMifOpportunityDetectorRegistry().listDetectors().map((d) => d.detectorId);
    const b = getDefaultMifOpportunityDetectorRegistry().listDetectors().map((d) => d.detectorId);
    expect(a).toEqual(b);
    expect(a).toEqual([...a].sort((x, y) => x.localeCompare(y)));
  });
});

describe("Phase 5D audit — orchestrator isolation and immutability", () => {
  it("invokes all 10 detectors on empty evidence without fabricating candidates", () => {
    const result = runMifOpportunityDetection({
      context: emptyCtx(),
      detectorRegistry: getDefaultMifOpportunityDetectorRegistry(),
      reportMissingDetectors: false,
    });
    expect(result.outcomes).toHaveLength(10);
    expect(result.candidates).toHaveLength(0);
    expect(result.acceptsForExecution).toBe(false);
    expect(result.doesNotRankOpportunities).toBe(true);
    expect(result.placesOrders).toBe(false);
    expect(result.mutatesBroker).toBe(false);
    for (const id of ALL_IDS) {
      const o = result.outcomes.find((x) => x.detectorId === id);
      expect(o).toBeTruthy();
      expect(o!.status).not.toBe("CANDIDATE_PRODUCED");
      expect(o!.acceptsForExecution).toBe(false);
    }
  });

  it("isolates a throwing detector without blocking the other nine", () => {
    const boom: MifOpportunityDetector = {
      ...getDefaultMifOpportunityDetectorRegistry().getDetector(MIF_TREND_CONTINUATION_DETECTOR_ID)!,
      evaluate: () => {
        throw new Error("audit injected failure");
      },
    };
    const others = getDefaultMifOpportunityDetectorRegistry()
      .listDetectors()
      .filter((d) => d.detectorId !== MIF_TREND_CONTINUATION_DETECTOR_ID);
    const result = runMifOpportunityDetection({
      context: emptyCtx(),
      detectors: [boom, ...others],
      reportMissingDetectors: false,
    });
    const failed = result.outcomes.find((o) => o.detectorId === MIF_TREND_CONTINUATION_DETECTOR_ID);
    expect(failed?.status).toBe("DETECTOR_ERROR");
    expect(result.outcomes.filter((o) => o.detectorId !== MIF_TREND_CONTINUATION_DETECTOR_ID)).toHaveLength(9);
    for (const o of result.outcomes) {
      if (o.detectorId !== MIF_TREND_CONTINUATION_DETECTOR_ID) {
        expect(o.status).not.toBe("DETECTOR_ERROR");
      }
    }
  });

  it("does not mutate shared context evidence across detectors", () => {
    const evidence = [
      ev({
        evidenceId: "pc.geometric",
        family: "GEOMETRIC_PATTERN",
        notes:
          "patternType=DOUBLE_BOTTOM;patternId=DB1;lifecycle=CONFIRMED;orientation=BULLISH;confirm=true;closeState=CLOSED",
      }),
      ev({ evidenceId: "pc.quality", family: "DATA_QUALITY", candleState: null }),
    ];
    const ctx = emptyCtx({
      evidence,
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
        evidence: evidence.map((e) => ({
          evidenceId: e.evidenceId,
          family: e.family,
          presence: e.presence,
          qualityStatus: e.qualityStatus,
          closedCandleSatisfied: e.candleState === "CLOSED" ? true : null,
          sourceAssessmentId: e.sourceAssessmentId,
          sourceContractId: e.sourceContractId,
        })),
      },
    });
    const before = JSON.stringify(ctx);
    runMifOpportunityDetection({
      context: ctx,
      detectorRegistry: getDefaultMifOpportunityDetectorRegistry(),
      reportMissingDetectors: false,
    });
    expect(JSON.stringify(ctx)).toBe(before);
  });

  it("preserves deterministic outcome ordering by strategyId then detectorId", () => {
    const a = runMifOpportunityDetection({
      context: emptyCtx(),
      detectorRegistry: getDefaultMifOpportunityDetectorRegistry(),
      reportMissingDetectors: false,
    });
    const b = runMifOpportunityDetection({
      context: emptyCtx(),
      detectorRegistry: getDefaultMifOpportunityDetectorRegistry(),
      reportMissingDetectors: false,
    });
    expect(a.outcomes.map((o) => `${o.strategyId}|${o.detectorId}`)).toEqual(
      b.outcomes.map((o) => `${o.strategyId}|${o.detectorId}`),
    );
  });
});

describe("Phase 5D audit — pattern-completion lifecycle integrity", () => {
  it("does not upgrade FORMING to CONFIRMED via confirmationMet alone", () => {
    const ctx = emptyCtx({
      evidence: [
        ev({
          evidenceId: "pc.geometric",
          family: "GEOMETRIC_PATTERN",
          notes:
            "patternType=DOUBLE_BOTTOM;patternId=DB1;lifecycle=FORMING;orientation=BULLISH;confirm=true;closeState=CLOSED",
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
        availableTimeframeRoles: ["SETUP_DEVELOPMENT", "LOWER_TIMEFRAME_CONFIRMATION"],
        evidence: [
          {
            evidenceId: "pc.geometric",
            family: "GEOMETRIC_PATTERN",
            presence: "PRESENT",
            qualityStatus: "VALID",
            closedCandleSatisfied: true,
            sourceAssessmentId: null,
            sourceContractId: null,
          },
          {
            evidenceId: "pc.quality",
            family: "DATA_QUALITY",
            presence: "PRESENT",
            qualityStatus: "VALID",
            closedCandleSatisfied: null,
            sourceAssessmentId: null,
            sourceContractId: null,
          },
        ],
      },
    });
    const r = mifPatternCompletionDetector.evaluate(ctx);
    // May produce NEEDS_CONFIRMATION (COMPLETION_REACHED) but never DETECTED/CONFIRMED upgrade.
    if (r.candidate) {
      expect(r.candidate.status).toBe("NEEDS_CONFIRMATION");
      expect(r.diagnostics).not.toMatch(/state=CONFIRMED/);
    }
  });

  it("does not list absent quality evidence as supporting", () => {
    const ctx = emptyCtx({
      evidence: [
        ev({
          evidenceId: "pc.geometric",
          family: "GEOMETRIC_PATTERN",
          notes:
            "patternType=DOUBLE_BOTTOM;patternId=DB1;lifecycle=CONFIRMED;orientation=BULLISH;confirm=true;closeState=CLOSED",
        }),
        ev({
          evidenceId: "pc.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "closeState=CLOSED",
        }),
        ev({
          evidenceId: "pc.mtf",
          family: "MULTI_TIMEFRAME_RELATIONSHIP",
          notes: "relation=ALIGNMENT",
        }),
      ],
    });
    const r = mifPatternCompletionDetector.evaluate(ctx);
    expect(r.candidate).toBeTruthy();
    expect(r.candidate!.supportingEvidenceIds).not.toContain("pc.quality");
    expect(r.candidate!.supportingEvidenceIds).toContain("pc.geometric");
  });
});

describe("Phase 5D audit — legitimate multi-strategy overlap", () => {
  it("allows independent candidates from distinct detectors without mutual erasure", () => {
    // Pattern completion + empty peers: only PC should produce; others must still report outcomes.
    const ctx = emptyCtx({
      evidence: [
        ev({
          evidenceId: "pc.geometric",
          family: "GEOMETRIC_PATTERN",
          notes:
            "patternType=DOUBLE_BOTTOM;patternId=DB1;lifecycle=CONFIRMED;orientation=BULLISH;confirm=true;closeState=CLOSED",
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
            sourceContractId: "kwizera.mif.audit.v1",
          },
          {
            evidenceId: "pc.quality",
            family: "DATA_QUALITY",
            presence: "PRESENT",
            qualityStatus: "VALID",
            closedCandleSatisfied: null,
            sourceAssessmentId: "pc.quality.src",
            sourceContractId: "kwizera.mif.audit.v1",
          },
        ],
      },
    });
    const result = runMifOpportunityDetection({
      context: ctx,
      detectorRegistry: getDefaultMifOpportunityDetectorRegistry(),
      reportMissingDetectors: false,
    });
    expect(result.outcomes).toHaveLength(10);
    const pc = result.outcomes.find((o) => o.detectorId === MIF_PATTERN_COMPLETION_DETECTOR_ID);
    expect(pc?.status).toBe("CANDIDATE_PRODUCED");
    expect(result.candidates.some((c) => c.detectorId === MIF_PATTERN_COMPLETION_DETECTOR_ID)).toBe(
      true,
    );
    // Other detectors still ran (not skipped by PC success).
    expect(
      result.outcomes.filter((o) => o.detectorId !== MIF_PATTERN_COMPLETION_DETECTOR_ID).length,
    ).toBe(9);
  });
});

describe("Phase 5D audit — HFM_MT5 provider restriction", () => {
  it("default MIF provider id remains HFM_MT5 and OD result stays non-executing", () => {
    expect(MIF_PROVIDER_ID).toBe("HFM_MT5");
    const result = runMifOpportunityDetection({
      context: emptyCtx({ providerId: MIF_PROVIDER_ID }),
      detectorRegistry: getDefaultMifOpportunityDetectorRegistry(),
      reportMissingDetectors: false,
    });
    expect(result.acceptsForExecution).toBe(false);
    expect(result.placesOrders).toBe(false);
    expect(result.mutatesBroker).toBe(false);
  });
});
