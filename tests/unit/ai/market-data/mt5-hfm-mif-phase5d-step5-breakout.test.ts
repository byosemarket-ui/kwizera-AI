/**
 * Phase 5D Step 5 — Breakout Detector.
 */
import { describe, it, expect } from "vitest";
import {
  MIF_PROVIDER_ID,
  MIF_BREAKOUT_DETECTOR_ID,
  createMifOpportunityDetectorRegistry,
  createMifStrategyIntelligenceRegistry,
  getDefaultMifStrategyIntelligenceRegistry,
  mifBreakoutDetector,
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
    timeframe: over.timeframe ?? "M15",
    timeframeRole: over.timeframeRole ?? "OPPORTUNITY_FORMATION",
    assessmentTimestamp: over.assessmentTimestamp ?? "2024-06-01T12:00:00.000Z",
    qualityStatus: over.qualityStatus ?? "VALID",
    candleState: over.candleState === undefined ? "CLOSED" : over.candleState,
    notes: over.notes,
  };
}

function baseSummary(over: Record<string, unknown> = {}) {
  return {
    providerSymbol: "XAUUSD",
    dataQualityStatus: "VALID" as const,
    regimeDirection: "UP" as const,
    regimeStructure: "BREAKOUT" as const,
    regimeVolatility: "NORMAL" as const,
    availableTimeframeRoles: [
      "INTERMEDIATE_STRUCTURE" as const,
      "OPPORTUNITY_FORMATION" as const,
    ],
    evidence: [
      {
        evidenceId: "bo.regime",
        family: "MARKET_REGIME" as const,
        presence: "PRESENT" as const,
        qualityStatus: "VALID" as const,
        closedCandleSatisfied: true,
        sourceAssessmentId: "bo.regime.src",
        sourceContractId: "kwizera.mif.market-regime.v1",
      },
      {
        evidenceId: "bo.boundary",
        family: "SUPPORT_RESISTANCE" as const,
        presence: "PRESENT" as const,
        qualityStatus: "VALID" as const,
        closedCandleSatisfied: true,
        sourceAssessmentId: null,
        sourceContractId: null,
      },
      {
        evidenceId: "bo.displacement",
        family: "PRICE_DISPLACEMENT" as const,
        presence: "PRESENT" as const,
        qualityStatus: "VALID" as const,
        closedCandleSatisfied: true,
        sourceAssessmentId: null,
        sourceContractId: null,
      },
      {
        evidenceId: "bo.quality",
        family: "DATA_QUALITY" as const,
        presence: "PRESENT" as const,
        qualityStatus: "VALID" as const,
        closedCandleSatisfied: null,
        sourceAssessmentId: "q1",
        sourceContractId: "kwizera.mif.quality.v1",
      },
    ],
    ...over,
  };
}

function boContext(over: Partial<MifOpportunityDetectionContext> = {}): MifOpportunityDetectionContext {
  return {
    contextVersion: "1.0.0",
    providerId: MIF_PROVIDER_ID,
    providerSymbol: "XAUUSD",
    instrument: null,
    assessmentTimestamp: "2024-06-01T12:00:00.000Z",
    timebase: "BROKER_SERVER",
    dataQualityStatus: "VALID",
    availableTimeframeRoles: ["INTERMEDIATE_STRUCTURE", "OPPORTUNITY_FORMATION"],
    evidence: [
      ev({ evidenceId: "bo.regime", family: "MARKET_REGIME", timeframe: "H1" }),
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
    evidenceSummary: baseSummary(),
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    doesNotApproveAiReasoning: true,
    analyticalDetectionContextOnly: true,
    ...over,
  };
}

describe("Phase 5D Step5 — bullish breakout", () => {
  it("produces bullish candidate on CLOSED close above resistance", () => {
    const r = mifBreakoutDetector.evaluate(boContext());
    expect(r.candidate).toBeTruthy();
    expect(r.candidate!.direction).toBe("BUY");
    expect(r.candidate!.strategyId).toBe("BREAKOUT");
    expect(r.candidate!.detectorId).toBe(MIF_BREAKOUT_DETECTOR_ID);
    expect(r.candidate!.acceptsForExecution).toBe(false);
  });

  it("produces bullish candidate above range ceiling", () => {
    const ctx = boContext({
      evidence: [
        ev({ evidenceId: "bo.regime", family: "MARKET_REGIME" }),
        ev({
          evidenceId: "bo.boundary",
          family: "SUPPORT_RESISTANCE",
          notes: "boundaryKind=RANGE_CEILING;boundaryQuality=VALID",
        }),
        ev({
          evidenceId: "bo.displacement",
          family: "PRICE_DISPLACEMENT",
          notes: "excursion=BEYOND;side=ABOVE;closeState=CLOSED;accepted=true",
        }),
        ev({ evidenceId: "bo.quality", family: "DATA_QUALITY", candleState: null }),
      ],
      evidenceSummary: baseSummary({ regimeStructure: "RANGING" }),
    });
    expect(mifBreakoutDetector.evaluate(ctx).candidate?.direction).toBe("BUY");
  });

  it("preserves higher-timeframe bearish conflict", () => {
    const ctx = boContext({
      evidence: [
        ev({ evidenceId: "bo.regime", family: "MARKET_REGIME" }),
        ev({
          evidenceId: "bo.boundary",
          family: "SUPPORT_RESISTANCE",
          notes: "boundaryKind=RESISTANCE;boundaryQuality=VALID",
        }),
        ev({
          evidenceId: "bo.displacement",
          family: "PRICE_DISPLACEMENT",
          notes: "excursion=BEYOND;side=ABOVE;closeState=CLOSED",
        }),
        ev({ evidenceId: "bo.quality", family: "DATA_QUALITY", candleState: null }),
        ev({
          evidenceId: "bo.mtf",
          family: "MULTI_TIMEFRAME_RELATIONSHIP",
          notes: "relation=CONFLICT",
        }),
      ],
    });
    // Without assessment higherDirection, CONFLICT still retained as conflicting evidence
    const r = mifBreakoutDetector.evaluate(ctx);
    expect(r.candidate).toBeTruthy();
    expect(r.candidate!.conflictingEvidenceIds.length).toBeGreaterThan(0);
  });

  it("rejects missing boundary evidence", () => {
    const ctx = boContext({
      evidence: [
        ev({ evidenceId: "bo.regime", family: "MARKET_REGIME" }),
        ev({
          evidenceId: "bo.displacement",
          family: "PRICE_DISPLACEMENT",
          notes: "excursion=BEYOND;side=ABOVE;closeState=CLOSED",
        }),
        ev({ evidenceId: "bo.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifBreakoutDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects missing closed confirmation (FORMING)", () => {
    const ctx = boContext({
      evidence: [
        ev({ evidenceId: "bo.regime", family: "MARKET_REGIME" }),
        ev({
          evidenceId: "bo.boundary",
          family: "SUPPORT_RESISTANCE",
          notes: "boundaryKind=RESISTANCE;boundaryQuality=VALID",
        }),
        ev({
          evidenceId: "bo.displacement",
          family: "PRICE_DISPLACEMENT",
          candleState: "FORMING",
          notes: "excursion=BEYOND;side=ABOVE;closeState=FORMING",
        }),
        ev({ evidenceId: "bo.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifBreakoutDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects price remaining inside boundary", () => {
    const ctx = boContext({
      evidence: [
        ev({ evidenceId: "bo.regime", family: "MARKET_REGIME" }),
        ev({
          evidenceId: "bo.boundary",
          family: "SUPPORT_RESISTANCE",
          notes: "boundaryKind=RESISTANCE;boundaryQuality=VALID",
        }),
        ev({
          evidenceId: "bo.displacement",
          family: "PRICE_DISPLACEMENT",
          notes: "excursion=INSIDE;side=ABOVE;closeState=CLOSED",
        }),
        ev({ evidenceId: "bo.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifBreakoutDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects invalid boundary evidence", () => {
    const ctx = boContext({
      evidence: [
        ev({ evidenceId: "bo.regime", family: "MARKET_REGIME" }),
        ev({
          evidenceId: "bo.boundary",
          family: "SUPPORT_RESISTANCE",
          notes: "boundaryKind=RESISTANCE;boundaryQuality=INVALID",
        }),
        ev({
          evidenceId: "bo.displacement",
          family: "PRICE_DISPLACEMENT",
          notes: "excursion=BEYOND;side=ABOVE;closeState=CLOSED",
        }),
        ev({ evidenceId: "bo.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifBreakoutDetector.evaluate(ctx).candidate).toBeNull();
  });
});

describe("Phase 5D Step5 — bearish breakout", () => {
  it("produces bearish candidate on CLOSED close below support", () => {
    const ctx = boContext({
      evidence: [
        ev({ evidenceId: "bo.regime", family: "MARKET_REGIME" }),
        ev({
          evidenceId: "bo.boundary",
          family: "SUPPORT_RESISTANCE",
          notes: "boundaryKind=SUPPORT;boundaryQuality=VALID",
        }),
        ev({
          evidenceId: "bo.displacement",
          family: "PRICE_DISPLACEMENT",
          notes: "excursion=BEYOND;side=BELOW;closeState=CLOSED;accepted=true",
        }),
        ev({ evidenceId: "bo.quality", family: "DATA_QUALITY", candleState: null }),
      ],
      evidenceSummary: baseSummary({ regimeDirection: "DOWN", regimeStructure: "BREAKOUT" }),
    });
    const r = mifBreakoutDetector.evaluate(ctx);
    expect(r.candidate?.direction).toBe("SELL");
  });

  it("produces bearish candidate below range floor", () => {
    const ctx = boContext({
      evidence: [
        ev({ evidenceId: "bo.regime", family: "MARKET_REGIME" }),
        ev({
          evidenceId: "bo.boundary",
          family: "SUPPORT_RESISTANCE",
          notes: "boundaryKind=RANGE_FLOOR;boundaryQuality=VALID",
        }),
        ev({
          evidenceId: "bo.displacement",
          family: "PRICE_DISPLACEMENT",
          notes: "excursion=ACCEPTED;side=BELOW;closeState=CLOSED;accepted=true",
        }),
        ev({ evidenceId: "bo.quality", family: "DATA_QUALITY", candleState: null }),
      ],
      evidenceSummary: baseSummary({ regimeDirection: "DOWN", regimeStructure: "RANGING" }),
    });
    expect(mifBreakoutDetector.evaluate(ctx).candidate?.direction).toBe("SELL");
  });

  it("rejects missing support boundary", () => {
    const ctx = boContext({
      evidence: [
        ev({ evidenceId: "bo.regime", family: "MARKET_REGIME" }),
        ev({
          evidenceId: "bo.displacement",
          family: "PRICE_DISPLACEMENT",
          notes: "excursion=BEYOND;side=BELOW;closeState=CLOSED",
        }),
        ev({ evidenceId: "bo.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifBreakoutDetector.evaluate(ctx).candidate).toBeNull();
  });
});

describe("Phase 5D Step5 — false breakout and rejection", () => {
  it("rejects wick beyond resistance with close inside", () => {
    const ctx = boContext({
      evidence: [
        ev({ evidenceId: "bo.regime", family: "MARKET_REGIME" }),
        ev({
          evidenceId: "bo.boundary",
          family: "SUPPORT_RESISTANCE",
          notes: "boundaryKind=RESISTANCE;boundaryQuality=VALID",
        }),
        ev({
          evidenceId: "bo.displacement",
          family: "PRICE_DISPLACEMENT",
          notes: "excursion=WICK_ONLY;side=ABOVE;closeState=CLOSED",
        }),
        ev({ evidenceId: "bo.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifBreakoutDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects wick below support with return inside", () => {
    const ctx = boContext({
      evidence: [
        ev({ evidenceId: "bo.regime", family: "MARKET_REGIME" }),
        ev({
          evidenceId: "bo.boundary",
          family: "SUPPORT_RESISTANCE",
          notes: "boundaryKind=SUPPORT;boundaryQuality=VALID",
        }),
        ev({
          evidenceId: "bo.displacement",
          family: "PRICE_DISPLACEMENT",
          notes: "excursion=RETURNED_INSIDE;side=BELOW;closeState=CLOSED;accepted=false",
        }),
        ev({ evidenceId: "bo.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifBreakoutDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects FORMING candle beyond boundary", () => {
    const ctx = boContext({
      evidence: [
        ev({ evidenceId: "bo.regime", family: "MARKET_REGIME" }),
        ev({
          evidenceId: "bo.boundary",
          family: "SUPPORT_RESISTANCE",
          notes: "boundaryKind=RESISTANCE;boundaryQuality=VALID",
        }),
        ev({
          evidenceId: "bo.displacement",
          family: "PRICE_DISPLACEMENT",
          candleState: "FORMING",
          notes: "excursion=BEYOND;side=ABOVE;closeState=FORMING",
        }),
        ev({ evidenceId: "bo.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifBreakoutDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("does not use FAILED pattern as confirmation", () => {
    const ctx = boContext({
      evidence: [
        ev({ evidenceId: "bo.regime", family: "MARKET_REGIME" }),
        ev({
          evidenceId: "bo.boundary",
          family: "SUPPORT_RESISTANCE",
          notes: "boundaryKind=RESISTANCE;boundaryQuality=VALID",
        }),
        ev({
          evidenceId: "bo.displacement",
          family: "PRICE_DISPLACEMENT",
          notes: "excursion=BEYOND;side=ABOVE;closeState=CLOSED",
        }),
        ev({ evidenceId: "bo.quality", family: "DATA_QUALITY", candleState: null }),
        ev({
          evidenceId: "bo.pattern",
          family: "GEOMETRIC_PATTERN",
          notes: "lifecycle=FAILED;bias=BULLISH",
        }),
      ],
      evidenceSummary: baseSummary({ regimeStructure: "RANGING" }),
    });
    const r = mifBreakoutDetector.evaluate(ctx);
    // May still produce NEEDS_CONFIRMATION from closed beyond + ranging, but not upgrade via FAILED pattern
    if (r.candidate) {
      expect(r.warnings?.some((w) => /failed\/invalidated pattern/i.test(w))).toBe(true);
      expect(r.candidate.status).toBe("NEEDS_CONFIRMATION");
    }
  });

  it("rejects Fibonacci-only boundary", () => {
    const ctx = boContext({
      evidence: [
        ev({ evidenceId: "bo.regime", family: "MARKET_REGIME" }),
        ev({
          evidenceId: "bo.boundary",
          family: "SUPPORT_RESISTANCE",
          notes: "boundaryKind=RESISTANCE;boundaryQuality=VALID;source=FIBONACCI",
        }),
        ev({
          evidenceId: "bo.displacement",
          family: "PRICE_DISPLACEMENT",
          notes: "excursion=BEYOND;side=ABOVE;closeState=CLOSED",
        }),
        ev({ evidenceId: "bo.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifBreakoutDetector.evaluate(ctx).candidate).toBeNull();
  });
});

describe("Phase 5D Step5 — MTF quality eligibility determinism", () => {
  it("blocks stale displacement evidence", () => {
    const ctx = boContext({
      evidence: [
        ev({ evidenceId: "bo.regime", family: "MARKET_REGIME" }),
        ev({
          evidenceId: "bo.boundary",
          family: "SUPPORT_RESISTANCE",
          notes: "boundaryKind=RESISTANCE;boundaryQuality=VALID",
        }),
        ev({
          evidenceId: "bo.displacement",
          family: "PRICE_DISPLACEMENT",
          candleState: "STALE",
          notes: "excursion=BEYOND;side=ABOVE;closeState=CLOSED",
        }),
        ev({ evidenceId: "bo.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifBreakoutDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects ACTIVE detector for DISABLED strategy", () => {
    const base = getDefaultMifStrategyIntelligenceRegistry().getStrategy("BREAKOUT")!;
    const disabled: MifStrategyDefinition = { ...base, lifecycleStatus: "DISABLED" };
    const stratReg = createMifStrategyIntelligenceRegistry([
      ...MIF_STRATEGY_CATALOG.filter((s) => s.strategyId !== "BREAKOUT"),
      disabled,
    ]);
    expect(() =>
      createMifOpportunityDetectorRegistry(
        [{ ...mifBreakoutDetector, availabilityStatus: "ACTIVE" }],
        stratReg,
      ),
    ).toThrow(/lifecycle|activate/i);
  });

  it("is deterministic and does not mutate input", () => {
    const ctx = boContext();
    const before = JSON.stringify(ctx.evidence);
    const a = mifBreakoutDetector.evaluate(ctx);
    const b = mifBreakoutDetector.evaluate(ctx);
    expect(a.candidate?.candidateId).toBe(b.candidate?.candidateId);
    expect(JSON.stringify(ctx.evidence)).toBe(before);
  });

  it("rejects blocked quality via orchestrator", () => {
    const ctx = boContext({
      dataQualityStatus: "BLOCKED",
      evidenceSummary: { ...baseSummary(), dataQualityStatus: "BLOCKED" },
    });
    const result = runMifOpportunityDetection({
      context: ctx,
      detectors: [mifBreakoutDetector],
      reportMissingDetectors: false,
    });
    expect(result.candidates).toHaveLength(0);
    expect(["BLOCKED_BY_DATA_QUALITY", "INELIGIBLE"]).toContain(result.outcomes[0]?.status);
  });

  it("rejects mixed instruments via orchestrator", () => {
    const result = runMifOpportunityDetection({
      context: boContext({
        regime: { providerSymbol: "EURUSD" } as MifOpportunityDetectionContext["regime"],
      }),
      detectors: [mifBreakoutDetector],
      reportMissingDetectors: false,
    });
    expect(result.outcomes[0]?.status).toBe("INVALID_CONTEXT");
  });
});
