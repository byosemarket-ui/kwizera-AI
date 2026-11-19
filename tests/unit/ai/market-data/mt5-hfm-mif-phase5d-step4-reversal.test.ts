/**
 * Phase 5D Step 4 — Reversal Detector.
 */
import { describe, it, expect } from "vitest";
import {
  MIF_PROVIDER_ID,
  MIF_REVERSAL_DETECTOR_ID,
  createMifOpportunityDetectorRegistry,
  createMifStrategyIntelligenceRegistry,
  getDefaultMifStrategyIntelligenceRegistry,
  mifReversalDetector,
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
    timeframeRole: over.timeframeRole ?? "INTERMEDIATE_STRUCTURE",
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
    regimeDirection: "DOWN" as const,
    regimeStructure: "TRANSITION" as const,
    regimeVolatility: "NORMAL" as const,
    availableTimeframeRoles: [
      "PRIMARY_DIRECTION" as const,
      "INTERMEDIATE_STRUCTURE" as const,
      "LOWER_TIMEFRAME_CONFIRMATION" as const,
    ],
    evidence: [
      {
        evidenceId: "rv.regime",
        family: "MARKET_REGIME" as const,
        presence: "PRESENT" as const,
        qualityStatus: "VALID" as const,
        closedCandleSatisfied: true,
        sourceAssessmentId: "rv.regime.src",
        sourceContractId: "kwizera.mif.market-regime.v1",
      },
      {
        evidenceId: "rv.mtf",
        family: "MULTI_TIMEFRAME_RELATIONSHIP" as const,
        presence: "PRESENT" as const,
        qualityStatus: "VALID" as const,
        closedCandleSatisfied: true,
        sourceAssessmentId: "rv.mtf.src",
        sourceContractId: "kwizera.mif.multi-timeframe-relationships.v1",
      },
      {
        evidenceId: "rv.structure",
        family: "MARKET_STRUCTURE" as const,
        presence: "PRESENT" as const,
        qualityStatus: "VALID" as const,
        closedCandleSatisfied: true,
        sourceAssessmentId: null,
        sourceContractId: null,
      },
      {
        evidenceId: "rv.quality",
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

function rvContext(over: Partial<MifOpportunityDetectionContext> = {}): MifOpportunityDetectionContext {
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
      "LOWER_TIMEFRAME_CONFIRMATION",
    ],
    evidence: [
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

describe("Phase 5D Step4 — bullish reversal", () => {
  it("produces bullish reversal with structural + MTF support", () => {
    const r = mifReversalDetector.evaluate(rvContext());
    expect(r.candidate).toBeTruthy();
    expect(r.candidate!.direction).toBe("BUY");
    expect(r.candidate!.strategyId).toBe("REVERSAL");
    expect(r.candidate!.detectorId).toBe(MIF_REVERSAL_DETECTOR_ID);
    expect(r.candidate!.status).toBe("DETECTED");
    expect(r.candidate!.acceptsForExecution).toBe(false);
  });

  it("supports bullish reversal with confirmed geometric pattern", () => {
    const ctx = rvContext({
      evidence: [
        ev({ evidenceId: "rv.regime", family: "MARKET_REGIME" }),
        ev({
          evidenceId: "rv.mtf",
          family: "MULTI_TIMEFRAME_RELATIONSHIP",
          notes: "relation=TRANSITION",
        }),
        ev({
          evidenceId: "rv.structure",
          family: "MARKET_STRUCTURE",
          notes: "structuralChange=WEAKENING;priorDirection=DOWN;newBias=BULLISH",
        }),
        ev({ evidenceId: "rv.quality", family: "DATA_QUALITY", candleState: null }),
        ev({
          evidenceId: "rv.geometric",
          family: "GEOMETRIC_PATTERN",
          notes: "lifecycle=CONFIRMED;patternType=DOUBLE_BOTTOM;bias=BULLISH",
        }),
      ],
    });
    const r = mifReversalDetector.evaluate(ctx);
    expect(r.candidate?.direction).toBe("BUY");
    expect(r.candidate?.supportingEvidenceIds).toContain("rv.geometric");
  });

  it("preserves conflicting bearish evidence on bullish candidate", () => {
    const ctx = rvContext({
      evidence: [
        ev({ evidenceId: "rv.regime", family: "MARKET_REGIME" }),
        ev({
          evidenceId: "rv.mtf",
          family: "MULTI_TIMEFRAME_RELATIONSHIP",
          notes: "relation=CONFLICT",
        }),
        ev({
          evidenceId: "rv.structure",
          family: "MARKET_STRUCTURE",
          notes: "structuralChange=BOS;priorDirection=DOWN;newBias=BULLISH",
        }),
        ev({ evidenceId: "rv.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    const r = mifReversalDetector.evaluate(ctx);
    expect(r.candidate).toBeTruthy();
    expect(r.candidate!.conflictingEvidenceIds.length).toBeGreaterThan(0);
  });

  it("invalidates bullish hypothesis on failed structure", () => {
    const ctx = rvContext({
      evidence: [
        ev({ evidenceId: "rv.regime", family: "MARKET_REGIME" }),
        ev({
          evidenceId: "rv.mtf",
          family: "MULTI_TIMEFRAME_RELATIONSHIP",
          notes: "relation=POTENTIAL_REVERSAL",
        }),
        ev({
          evidenceId: "rv.structure",
          family: "MARKET_STRUCTURE",
          notes: "structuralChange=FAILED;priorDirection=DOWN;newBias=BULLISH",
        }),
        ev({ evidenceId: "rv.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifReversalDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("returns NEEDS_CONFIRMATION when structural weakening lacks closed confirm", () => {
    const ctx = rvContext({
      evidence: [
        ev({ evidenceId: "rv.regime", family: "MARKET_REGIME" }),
        ev({
          evidenceId: "rv.mtf",
          family: "MULTI_TIMEFRAME_RELATIONSHIP",
          notes: "relation=TRANSITION",
        }),
        ev({
          evidenceId: "rv.structure",
          family: "MARKET_STRUCTURE",
          notes: "structuralChange=WEAKENING;priorDirection=DOWN;newBias=BULLISH",
        }),
        ev({ evidenceId: "rv.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    const r = mifReversalDetector.evaluate(ctx);
    expect(r.candidate?.status).toBe("NEEDS_CONFIRMATION");
  });
});

describe("Phase 5D Step4 — bearish reversal", () => {
  it("produces bearish reversal with structural + MTF support", () => {
    const ctx = rvContext({
      evidence: [
        ev({ evidenceId: "rv.regime", family: "MARKET_REGIME" }),
        ev({
          evidenceId: "rv.mtf",
          family: "MULTI_TIMEFRAME_RELATIONSHIP",
          notes: "relation=POTENTIAL_REVERSAL",
        }),
        ev({
          evidenceId: "rv.structure",
          family: "MARKET_STRUCTURE",
          notes: "structuralChange=CHoCH;priorDirection=UP;newBias=BEARISH",
        }),
        ev({ evidenceId: "rv.quality", family: "DATA_QUALITY", candleState: null }),
      ],
      evidenceSummary: baseSummary({
        regimeDirection: "UP",
        regimeStructure: "TRANSITION",
      }),
    });
    const r = mifReversalDetector.evaluate(ctx);
    expect(r.candidate?.direction).toBe("SELL");
    expect(r.candidate?.status).toBe("DETECTED");
  });

  it("supports bearish reversal with confirmed head-and-shoulders", () => {
    const ctx = rvContext({
      evidence: [
        ev({ evidenceId: "rv.regime", family: "MARKET_REGIME" }),
        ev({
          evidenceId: "rv.mtf",
          family: "MULTI_TIMEFRAME_RELATIONSHIP",
          notes: "relation=TRANSITION",
        }),
        ev({
          evidenceId: "rv.structure",
          family: "MARKET_STRUCTURE",
          notes: "structuralChange=WEAKENING;priorDirection=UP;newBias=BEARISH",
        }),
        ev({ evidenceId: "rv.quality", family: "DATA_QUALITY", candleState: null }),
        ev({
          evidenceId: "rv.geometric",
          family: "GEOMETRIC_PATTERN",
          notes: "lifecycle=CONFIRMED;patternType=HEAD_AND_SHOULDERS;bias=BEARISH",
        }),
      ],
      evidenceSummary: baseSummary({ regimeDirection: "UP" }),
    });
    expect(mifReversalDetector.evaluate(ctx).candidate?.direction).toBe("SELL");
  });

  it("preserves conflicting bullish evidence on bearish candidate", () => {
    const ctx = rvContext({
      evidence: [
        ev({ evidenceId: "rv.regime", family: "MARKET_REGIME" }),
        ev({
          evidenceId: "rv.mtf",
          family: "MULTI_TIMEFRAME_RELATIONSHIP",
          notes: "relation=PARTIAL_ALIGNMENT",
        }),
        ev({
          evidenceId: "rv.structure",
          family: "MARKET_STRUCTURE",
          notes: "structuralChange=BOS;priorDirection=UP;newBias=BEARISH",
        }),
        ev({ evidenceId: "rv.quality", family: "DATA_QUALITY", candleState: null }),
      ],
      evidenceSummary: baseSummary({ regimeDirection: "UP" }),
    });
    const r = mifReversalDetector.evaluate(ctx);
    expect(r.candidate).toBeTruthy();
    expect(r.candidate!.conflictingEvidenceIds.length).toBeGreaterThan(0);
  });

  it("invalidates bearish hypothesis on failed structure", () => {
    const ctx = rvContext({
      evidence: [
        ev({ evidenceId: "rv.regime", family: "MARKET_REGIME" }),
        ev({
          evidenceId: "rv.mtf",
          family: "MULTI_TIMEFRAME_RELATIONSHIP",
          notes: "relation=POTENTIAL_REVERSAL",
        }),
        ev({
          evidenceId: "rv.structure",
          family: "MARKET_STRUCTURE",
          notes: "structuralChange=INVALIDATED;priorDirection=UP;newBias=BEARISH",
        }),
        ev({ evidenceId: "rv.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifReversalDetector.evaluate(ctx).candidate).toBeNull();
  });
});

describe("Phase 5D Step4 — pullback vs reversal discrimination", () => {
  it("does not classify ordinary bullish-trend pullback as bearish reversal", () => {
    const ctx = rvContext({
      evidence: [
        ev({ evidenceId: "rv.regime", family: "MARKET_REGIME" }),
        ev({
          evidenceId: "rv.mtf",
          family: "MULTI_TIMEFRAME_RELATIONSHIP",
          notes: "relation=COUNTERTREND_PULLBACK",
        }),
        ev({
          evidenceId: "rv.structure",
          family: "MARKET_STRUCTURE",
          notes: "priorDirection=UP",
        }),
        ev({ evidenceId: "rv.quality", family: "DATA_QUALITY", candleState: null }),
      ],
      evidenceSummary: baseSummary({
        regimeDirection: "UP",
        regimeStructure: "TRENDING",
      }),
    });
    expect(mifReversalDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("does not classify ordinary bearish-trend pullback as bullish reversal", () => {
    const ctx = rvContext({
      evidence: [
        ev({ evidenceId: "rv.regime", family: "MARKET_REGIME" }),
        ev({
          evidenceId: "rv.mtf",
          family: "MULTI_TIMEFRAME_RELATIONSHIP",
          notes: "relation=COUNTERTREND_PULLBACK",
        }),
        ev({
          evidenceId: "rv.structure",
          family: "MARKET_STRUCTURE",
          notes: "priorDirection=DOWN",
        }),
        ev({ evidenceId: "rv.quality", family: "DATA_QUALITY", candleState: null }),
      ],
      evidenceSummary: baseSummary({
        regimeDirection: "DOWN",
        regimeStructure: "TRENDING",
      }),
    });
    expect(mifReversalDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects LTF POTENTIAL_REVERSAL without HTF structural change", () => {
    const ctx = rvContext({
      evidence: [
        ev({ evidenceId: "rv.regime", family: "MARKET_REGIME" }),
        ev({
          evidenceId: "rv.mtf",
          family: "MULTI_TIMEFRAME_RELATIONSHIP",
          notes: "relation=POTENTIAL_REVERSAL",
        }),
        ev({
          evidenceId: "rv.structure",
          family: "MARKET_STRUCTURE",
          notes: "priorDirection=UP",
        }),
        ev({ evidenceId: "rv.quality", family: "DATA_QUALITY", candleState: null }),
      ],
      evidenceSummary: baseSummary({
        regimeDirection: "UP",
        regimeStructure: "TRENDING",
      }),
    });
    expect(mifReversalDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("accepts genuine structural change with independent supporting evidence", () => {
    const r = mifReversalDetector.evaluate(rvContext());
    expect(r.candidate).toBeTruthy();
  });

  it("rejects TRANSITION regime without structural confirmation", () => {
    const ctx = rvContext({
      evidence: [
        ev({ evidenceId: "rv.regime", family: "MARKET_REGIME" }),
        ev({
          evidenceId: "rv.mtf",
          family: "MULTI_TIMEFRAME_RELATIONSHIP",
          notes: "relation=UNKNOWN",
        }),
        ev({
          evidenceId: "rv.structure",
          family: "MARKET_STRUCTURE",
          notes: "priorDirection=DOWN",
        }),
        ev({ evidenceId: "rv.quality", family: "DATA_QUALITY", candleState: null }),
      ],
      evidenceSummary: baseSummary({ regimeStructure: "TRANSITION" }),
    });
    expect(mifReversalDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects Fibonacci proximity alone", () => {
    const ctx = rvContext({
      evidence: [
        ev({ evidenceId: "rv.regime", family: "MARKET_REGIME" }),
        ev({
          evidenceId: "rv.mtf",
          family: "MULTI_TIMEFRAME_RELATIONSHIP",
          notes: "relation=ALIGNMENT",
        }),
        ev({
          evidenceId: "rv.structure",
          family: "MARKET_STRUCTURE",
          notes: "priorDirection=DOWN",
        }),
        ev({ evidenceId: "rv.quality", family: "DATA_QUALITY", candleState: null }),
        ev({ evidenceId: "rv.fib", family: "FIBONACCI" }),
      ],
      evidenceSummary: baseSummary({
        regimeDirection: "DOWN",
        regimeStructure: "TRENDING",
      }),
    });
    const r = mifReversalDetector.evaluate(ctx);
    expect(r.candidate).toBeNull();
    expect(r.diagnostics).toMatch(/Fibonacci/i);
  });

  it("rejects FORMING pattern alone", () => {
    const ctx = rvContext({
      evidence: [
        ev({ evidenceId: "rv.regime", family: "MARKET_REGIME" }),
        ev({
          evidenceId: "rv.mtf",
          family: "MULTI_TIMEFRAME_RELATIONSHIP",
          notes: "relation=UNKNOWN",
        }),
        ev({
          evidenceId: "rv.structure",
          family: "MARKET_STRUCTURE",
          notes: "priorDirection=DOWN",
        }),
        ev({ evidenceId: "rv.quality", family: "DATA_QUALITY", candleState: null }),
        ev({
          evidenceId: "rv.geometric",
          family: "GEOMETRIC_PATTERN",
          notes: "lifecycle=FORMING;patternType=DOUBLE_BOTTOM;bias=BULLISH",
        }),
      ],
    });
    expect(mifReversalDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects FAILED/INVALIDATED pattern as confirmation", () => {
    const ctx = rvContext({
      evidence: [
        ev({ evidenceId: "rv.regime", family: "MARKET_REGIME" }),
        ev({
          evidenceId: "rv.mtf",
          family: "MULTI_TIMEFRAME_RELATIONSHIP",
          notes: "relation=TRANSITION",
        }),
        ev({
          evidenceId: "rv.structure",
          family: "MARKET_STRUCTURE",
          notes: "priorDirection=DOWN",
        }),
        ev({ evidenceId: "rv.quality", family: "DATA_QUALITY", candleState: null }),
        ev({
          evidenceId: "rv.geometric",
          family: "GEOMETRIC_PATTERN",
          notes: "lifecycle=FAILED;patternType=DOUBLE_BOTTOM;bias=BULLISH",
        }),
      ],
    });
    expect(mifReversalDetector.evaluate(ctx).candidate).toBeNull();
  });
});

describe("Phase 5D Step4 — data quality and eligibility", () => {
  it("rejects via orchestrator when required evidence quality is blocked", () => {
    const ctx = rvContext({
      evidence: [
        ev({ evidenceId: "rv.regime", family: "MARKET_REGIME", qualityStatus: "BLOCKED" }),
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
      ],
      evidenceSummary: baseSummary({
        evidence: baseSummary().evidence.map((e) =>
          e.evidenceId === "rv.regime"
            ? { ...e, qualityStatus: "BLOCKED" as const }
            : e,
        ),
      }),
    });
    const result = runMifOpportunityDetection({
      context: ctx,
      detectors: [mifReversalDetector],
      reportMissingDetectors: false,
    });
    expect(result.candidates).toHaveLength(0);
    expect(["INSUFFICIENT_EVIDENCE", "INELIGIBLE", "BLOCKED_BY_DATA_QUALITY"]).toContain(
      result.outcomes[0]?.status,
    );
  });

  it("rejects ACTIVE detector registration against DISABLED strategy", () => {
    const base = getDefaultMifStrategyIntelligenceRegistry().getStrategy("REVERSAL")!;
    const disabled: MifStrategyDefinition = { ...base, lifecycleStatus: "DISABLED" };
    const stratReg = createMifStrategyIntelligenceRegistry([
      ...MIF_STRATEGY_CATALOG.filter((s) => s.strategyId !== "REVERSAL"),
      disabled,
    ]);
    expect(() =>
      createMifOpportunityDetectorRegistry(
        [{ ...mifReversalDetector, availabilityStatus: "ACTIVE" }],
        stratReg,
      ),
    ).toThrow(/lifecycle|activate/i);
  });

  it("is deterministic and does not mutate input", () => {
    const ctx = rvContext();
    const before = JSON.stringify(ctx.evidence);
    const a = mifReversalDetector.evaluate(ctx);
    const b = mifReversalDetector.evaluate(ctx);
    expect(a.candidate?.candidateId).toBe(b.candidate?.candidateId);
    expect(JSON.stringify(ctx.evidence)).toBe(before);
  });

  it("rejects invalid context mixed instruments via orchestrator", () => {
    const result = runMifOpportunityDetection({
      context: rvContext({
        providerSymbol: "XAUUSD",
        regime: { providerSymbol: "EURUSD" } as MifOpportunityDetectionContext["regime"],
      }),
      detectors: [mifReversalDetector],
      reportMissingDetectors: false,
    });
    expect(result.outcomes[0]?.status).toBe("INVALID_CONTEXT");
    expect(result.candidates).toHaveLength(0);
  });
});
