/**
 * Phase 5D Step 3 — Trend Continuation Detector.
 */
import { describe, it, expect } from "vitest";
import {
  MIF_PROVIDER_ID,
  MIF_TREND_CONTINUATION_DETECTOR_ID,
  createMifOpportunityDetectorRegistry,
  createMifStrategyIntelligenceRegistry,
  getDefaultMifStrategyIntelligenceRegistry,
  mifTrendContinuationDetector,
  runMifOpportunityDetection,
  type MifDetectionEvidenceRef,
  type MifOpportunityDetectionContext,
  type MifStrategyDefinition,
  MIF_STRATEGY_CATALOG,
} from "../../../../ai/market-data/mt5-hfm/mif/index";

function ev(
  over: Partial<MifDetectionEvidenceRef> & Pick<MifDetectionEvidenceRef, "evidenceId" | "family">,
): MifDetectionEvidenceRef {
  return {
    evidenceId: over.evidenceId,
    family: over.family,
    presence: over.presence ?? "PRESENT",
    sourceEngine: over.sourceEngine ?? "test",
    sourceContractId: over.sourceContractId ?? "kwizera.mif.test.v1",
    sourceContractVersion: over.sourceContractVersion ?? "1.0.0",
    sourcePolicyVersion: over.sourcePolicyVersion ?? "1.0.0",
    sourceAssessmentId: over.sourceAssessmentId ?? `${over.evidenceId}.src`,
    sourceInputIdentity: over.sourceInputIdentity ?? null,
    timeframe: over.timeframe ?? "H1",
    timeframeRole: over.timeframeRole ?? "OPPORTUNITY_FORMATION",
    assessmentTimestamp: over.assessmentTimestamp ?? "2024-06-01T12:00:00.000Z",
    qualityStatus: over.qualityStatus ?? "VALID",
    candleState: over.candleState === undefined ? "CLOSED" : over.candleState,
    notes: over.notes,
  };
}

function tcContext(over: Partial<MifOpportunityDetectionContext> = {}): MifOpportunityDetectionContext {
  const direction = (over.evidenceSummary as { regimeDirection?: string } | null | undefined)?.regimeDirection
    ?? "UP";
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
    ],
    evidenceSummary: {
      providerSymbol: "XAUUSD",
      dataQualityStatus: "VALID",
      regimeDirection: direction === "DOWN" ? "DOWN" : "UP",
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
          sourceAssessmentId: "tc.regime.src",
          sourceContractId: "kwizera.mif.market-regime.v1",
        },
        {
          evidenceId: "tc.mtf",
          family: "MULTI_TIMEFRAME_RELATIONSHIP",
          presence: "PRESENT",
          qualityStatus: "VALID",
          closedCandleSatisfied: true,
          sourceAssessmentId: "tc.mtf.src",
          sourceContractId: "kwizera.mif.multi-timeframe-relationships.v1",
        },
        {
          evidenceId: "tc.quality",
          family: "DATA_QUALITY",
          presence: "PRESENT",
          qualityStatus: "VALID",
          closedCandleSatisfied: null,
          sourceAssessmentId: "q1",
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
      ],
    },
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    doesNotApproveAiReasoning: true,
    analyticalDetectionContextOnly: true,
    ...over,
  };
}

describe("Phase 5D Step3 — trend continuation detector", () => {
  it("produces bullish continuation candidate", () => {
    const r = mifTrendContinuationDetector.evaluate(tcContext());
    expect(r.candidate).toBeTruthy();
    expect(r.candidate!.direction).toBe("BUY");
    expect(r.candidate!.strategyId).toBe("TREND_CONTINUATION");
    expect(r.candidate!.detectorId).toBe(MIF_TREND_CONTINUATION_DETECTOR_ID);
    expect(r.candidate!.acceptsForExecution).toBe(false);
    expect(r.candidate!.notExecutable).toBe(true);
  });

  it("produces bearish continuation candidate", () => {
    const ctx = tcContext({
      evidenceSummary: {
        ...tcContext().evidenceSummary!,
        regimeDirection: "DOWN",
      },
    });
    const r = mifTrendContinuationDetector.evaluate(ctx);
    expect(r.candidate?.direction).toBe("SELL");
  });

  it("rejects when no established trend (TRANSITION)", () => {
    const ctx = tcContext({
      evidenceSummary: {
        ...tcContext().evidenceSummary!,
        regimeStructure: "TRANSITION",
      },
    });
    expect(mifTrendContinuationDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects conflicting higher/lower timeframe evidence", () => {
    const ctx = tcContext({
      evidence: [
        ev({ evidenceId: "tc.regime", family: "MARKET_REGIME" }),
        ev({
          evidenceId: "tc.mtf",
          family: "MULTI_TIMEFRAME_RELATIONSHIP",
          notes: "relation=CONFLICT",
        }),
        ev({ evidenceId: "tc.quality", family: "DATA_QUALITY", candleState: null }),
        ev({ evidenceId: "tc.structure", family: "MARKET_STRUCTURE" }),
      ],
    });
    const r = mifTrendContinuationDetector.evaluate(ctx);
    expect(r.candidate).toBeNull();
    expect(r.diagnostics).toMatch(/CONFLICT|continuation/i);
  });

  it("rejects insufficient structure evidence (regime alone insufficient)", () => {
    const base = tcContext();
    const ctx = tcContext({
      evidence: base.evidence.filter((e) => e.evidenceId !== "tc.structure"),
      evidenceSummary: {
        ...base.evidenceSummary!,
        evidence: base.evidenceSummary!.evidence.filter((e) => e.evidenceId !== "tc.structure"),
      },
    });
    // Direct evaluate: structure missing → no candidate
    expect(mifTrendContinuationDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects stale/blocked required evidence via orchestrator", () => {
    const ctx = tcContext({
      evidence: [
        ev({ evidenceId: "tc.regime", family: "MARKET_REGIME", qualityStatus: "BLOCKED" }),
        ev({
          evidenceId: "tc.mtf",
          family: "MULTI_TIMEFRAME_RELATIONSHIP",
          notes: "relation=ALIGNMENT",
        }),
        ev({ evidenceId: "tc.quality", family: "DATA_QUALITY", candleState: null }),
        ev({ evidenceId: "tc.structure", family: "MARKET_STRUCTURE" }),
      ],
      evidenceSummary: {
        ...tcContext().evidenceSummary!,
        evidence: tcContext().evidenceSummary!.evidence.map((e) =>
          e.evidenceId === "tc.regime" ? { ...e, qualityStatus: "BLOCKED", presence: "PRESENT" } : e,
        ),
      },
    });
    const result = runMifOpportunityDetection({
      context: ctx,
      detectors: [mifTrendContinuationDetector],
      reportMissingDetectors: false,
    });
    const out = result.outcomes.find((o) => o.detectorId === MIF_TREND_CONTINUATION_DETECTOR_ID);
    expect(["INSUFFICIENT_EVIDENCE", "INELIGIBLE", "BLOCKED_BY_DATA_QUALITY"]).toContain(out?.status);
    expect(result.candidates).toHaveLength(0);
  });

  it("handles missing optional evidence with warnings and NEEDS_CONFIRMATION", () => {
    const r = mifTrendContinuationDetector.evaluate(tcContext());
    expect(r.candidate?.status).toBe("NEEDS_CONFIRMATION");
    expect(r.warnings?.some((w) => /optional evidence missing/i.test(w))).toBe(true);
  });

  it("is deterministic and does not mutate input", () => {
    const ctx = tcContext();
    const before = JSON.stringify(ctx.evidence);
    const a = mifTrendContinuationDetector.evaluate(ctx);
    const b = mifTrendContinuationDetector.evaluate(ctx);
    expect(a.candidate?.candidateId).toBe(b.candidate?.candidateId);
    expect(JSON.stringify(ctx.evidence)).toBe(before);
  });

  it("respects disabled strategy via custom registry (ACTIVE detector cannot register)", () => {
    const base = getDefaultMifStrategyIntelligenceRegistry().getStrategy("TREND_CONTINUATION")!;
    const disabled: MifStrategyDefinition = { ...base, lifecycleStatus: "DISABLED" };
    const stratReg = createMifStrategyIntelligenceRegistry([
      ...MIF_STRATEGY_CATALOG.filter((s) => s.strategyId !== "TREND_CONTINUATION"),
      disabled,
    ]);
    expect(() =>
      createMifOpportunityDetectorRegistry(
        [{ ...mifTrendContinuationDetector, availabilityStatus: "ACTIVE" }],
        stratReg,
      ),
    ).toThrow(/lifecycle|activate/i);
  });
});
