/**
 * Phase 5D Step 3 — Pullback Detector.
 */
import { describe, it, expect } from "vitest";
import {
  MIF_PROVIDER_ID,
  MIF_PULLBACK_DETECTOR_ID,
  mifPullbackDetector,
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
    sourceEngine: over.sourceEngine ?? "test",
    sourceContractId: over.sourceContractId ?? "kwizera.mif.test.v1",
    sourceContractVersion: over.sourceContractVersion ?? "1.0.0",
    sourcePolicyVersion: over.sourcePolicyVersion ?? "1.0.0",
    sourceAssessmentId: over.sourceAssessmentId ?? `${over.evidenceId}.src`,
    sourceInputIdentity: over.sourceInputIdentity ?? null,
    timeframe: over.timeframe ?? "M15",
    timeframeRole: over.timeframeRole ?? "OPPORTUNITY_FORMATION",
    assessmentTimestamp: over.assessmentTimestamp ?? "2024-06-01T12:00:00.000Z",
    qualityStatus: over.qualityStatus ?? "VALID",
    candleState: over.candleState === undefined ? "CLOSED" : over.candleState,
    notes: over.notes,
  };
}

function pbContext(over: Partial<MifOpportunityDetectionContext> = {}): MifOpportunityDetectionContext {
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
      "OPPORTUNITY_FORMATION",
      "INTERMEDIATE_STRUCTURE",
      "LOWER_TIMEFRAME_CONFIRMATION",
    ],
    evidence: [
      ev({ evidenceId: "pb.regime", family: "MARKET_REGIME", timeframe: "H4" }),
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
        "OPPORTUNITY_FORMATION",
        "INTERMEDIATE_STRUCTURE",
      ],
      evidence: [
        {
          evidenceId: "pb.regime",
          family: "MARKET_REGIME",
          presence: "PRESENT",
          qualityStatus: "VALID",
          closedCandleSatisfied: true,
          sourceAssessmentId: "pb.regime.src",
          sourceContractId: "kwizera.mif.market-regime.v1",
        },
        {
          evidenceId: "pb.mtf",
          family: "MULTI_TIMEFRAME_RELATIONSHIP",
          presence: "PRESENT",
          qualityStatus: "VALID",
          closedCandleSatisfied: true,
          sourceAssessmentId: "pb.mtf.src",
          sourceContractId: "kwizera.mif.multi-timeframe-relationships.v1",
        },
        {
          evidenceId: "pb.quality",
          family: "DATA_QUALITY",
          presence: "PRESENT",
          qualityStatus: "VALID",
          closedCandleSatisfied: null,
          sourceAssessmentId: "q1",
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
    ...over,
  };
}

describe("Phase 5D Step3 — pullback detector", () => {
  it("produces bullish-trend pullback candidate", () => {
    const r = mifPullbackDetector.evaluate(pbContext());
    expect(r.candidate).toBeTruthy();
    expect(r.candidate!.direction).toBe("BUY");
    expect(r.candidate!.strategyId).toBe("PULLBACK");
    expect(r.candidate!.detectorId).toBe(MIF_PULLBACK_DETECTOR_ID);
    expect(r.candidate!.invalidationConditions).toContain("pb.becomes_reversal");
  });

  it("produces bearish-trend pullback candidate", () => {
    const ctx = pbContext({
      evidenceSummary: {
        ...pbContext().evidenceSummary!,
        regimeDirection: "DOWN",
      },
    });
    expect(mifPullbackDetector.evaluate(ctx).candidate?.direction).toBe("SELL");
  });

  it("rejects countertrend movement without confirmation", () => {
    const ctx = pbContext({
      evidence: [
        ev({ evidenceId: "pb.regime", family: "MARKET_REGIME" }),
        ev({
          evidenceId: "pb.mtf",
          family: "MULTI_TIMEFRAME_RELATIONSHIP",
          notes: "relation=PARTIAL_ALIGNMENT;pullbackCompatible=true",
        }),
        ev({ evidenceId: "pb.quality", family: "DATA_QUALITY", candleState: null }),
        // no structure, no candle confirm
      ],
    });
    const r = mifPullbackDetector.evaluate(ctx);
    expect(r.candidate).toBeNull();
    expect(r.diagnostics).toMatch(/confirm/i);
  });

  it("rejects potential reversal conflict", () => {
    const ctx = pbContext({
      evidence: [
        ev({ evidenceId: "pb.regime", family: "MARKET_REGIME" }),
        ev({
          evidenceId: "pb.mtf",
          family: "MULTI_TIMEFRAME_RELATIONSHIP",
          notes: "relation=POTENTIAL_REVERSAL",
        }),
        ev({ evidenceId: "pb.quality", family: "DATA_QUALITY", candleState: null }),
        ev({ evidenceId: "pb.structure", family: "MARKET_STRUCTURE" }),
      ],
    });
    const r = mifPullbackDetector.evaluate(ctx);
    expect(r.candidate).toBeNull();
    expect(r.diagnostics).toMatch(/reversal/i);
  });

  it("rejects Fibonacci proximity without confirmation", () => {
    const ctx = pbContext({
      evidence: [
        ev({ evidenceId: "pb.regime", family: "MARKET_REGIME" }),
        ev({
          evidenceId: "pb.mtf",
          family: "MULTI_TIMEFRAME_RELATIONSHIP",
          notes: "relation=ALIGNMENT",
        }),
        ev({ evidenceId: "pb.quality", family: "DATA_QUALITY", candleState: null }),
        ev({ evidenceId: "pb.fib", family: "FIBONACCI" }),
      ],
    });
    const r = mifPullbackDetector.evaluate(ctx);
    expect(r.candidate).toBeNull();
    expect(r.diagnostics).toMatch(/Fibonacci/i);
  });

  it("rejects insufficient swing evidence when confirmation depends on it", () => {
    const ctx = pbContext({
      evidence: [
        ev({ evidenceId: "pb.regime", family: "MARKET_REGIME" }),
        ev({
          evidenceId: "pb.mtf",
          family: "MULTI_TIMEFRAME_RELATIONSHIP",
          notes: "relation=CONFLICT;pullbackCompatible=true",
        }),
        ev({ evidenceId: "pb.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifPullbackDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects conflicting timeframe evidence without pullback compatibility", () => {
    const ctx = pbContext({
      evidence: [
        ev({ evidenceId: "pb.regime", family: "MARKET_REGIME" }),
        ev({
          evidenceId: "pb.mtf",
          family: "MULTI_TIMEFRAME_RELATIONSHIP",
          notes: "relation=CONFLICT",
        }),
        ev({ evidenceId: "pb.quality", family: "DATA_QUALITY", candleState: null }),
        ev({ evidenceId: "pb.structure", family: "MARKET_STRUCTURE" }),
      ],
    });
    expect(mifPullbackDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("warns on missing optional evidence but still produces when confirmed", () => {
    const r = mifPullbackDetector.evaluate(pbContext());
    expect(r.candidate).toBeTruthy();
    expect(r.warnings?.some((w) => /optional evidence missing: pb.fib/i.test(w))).toBe(true);
  });

  it("rejects blocked/stale required evidence via orchestrator", () => {
    const ctx = pbContext({
      dataQualityStatus: "BLOCKED",
      evidenceSummary: {
        ...pbContext().evidenceSummary!,
        dataQualityStatus: "BLOCKED",
      },
    });
    const result = runMifOpportunityDetection({
      context: ctx,
      detectors: [mifPullbackDetector],
      reportMissingDetectors: false,
    });
    expect(result.candidates).toHaveLength(0);
    expect(["BLOCKED_BY_DATA_QUALITY", "INELIGIBLE"]).toContain(result.outcomes[0]?.status);
  });

  it("is deterministic and does not mutate input", () => {
    const ctx = pbContext();
    const before = JSON.stringify(ctx);
    const a = mifPullbackDetector.evaluate(ctx);
    const b = mifPullbackDetector.evaluate(ctx);
    expect(a.candidate?.candidateId).toBe(b.candidate?.candidateId);
    expect(JSON.stringify(ctx)).toBe(before);
  });
});
