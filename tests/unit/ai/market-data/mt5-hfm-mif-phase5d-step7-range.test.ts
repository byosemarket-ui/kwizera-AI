/**
 * Phase 5D Step 7 — Range Opportunity Detector.
 */
import { describe, it, expect } from "vitest";
import {
  MIF_PROVIDER_ID,
  MIF_RANGE_DETECTOR_ID,
  createMifOpportunityDetectorRegistry,
  createMifStrategyIntelligenceRegistry,
  getDefaultMifStrategyIntelligenceRegistry,
  mifRangeDetector,
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
    regimeDirection: "NEUTRAL" as const,
    regimeStructure: "RANGING" as const,
    regimeVolatility: "NORMAL" as const,
    availableTimeframeRoles: [
      "INTERMEDIATE_STRUCTURE" as const,
      "SETUP_DEVELOPMENT" as const,
    ],
    evidence: [
      {
        evidenceId: "rg.regime",
        family: "MARKET_REGIME" as const,
        presence: "PRESENT" as const,
        qualityStatus: "VALID" as const,
        closedCandleSatisfied: true,
        sourceAssessmentId: "rg.regime.src",
        sourceContractId: "kwizera.mif.market-regime.v1",
      },
      {
        evidenceId: "rg.range",
        family: "RANGE_STRUCTURE" as const,
        presence: "PRESENT" as const,
        qualityStatus: "VALID" as const,
        closedCandleSatisfied: true,
        sourceAssessmentId: null,
        sourceContractId: null,
      },
      {
        evidenceId: "rg.quality",
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

function rgContext(over: Partial<MifOpportunityDetectionContext> = {}): MifOpportunityDetectionContext {
  return {
    contextVersion: "1.0.0",
    providerId: MIF_PROVIDER_ID,
    providerSymbol: "XAUUSD",
    instrument: null,
    assessmentTimestamp: "2024-06-01T12:00:00.000Z",
    timebase: "BROKER_SERVER",
    dataQualityStatus: "VALID",
    availableTimeframeRoles: ["INTERMEDIATE_STRUCTURE", "SETUP_DEVELOPMENT"],
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
    evidenceSummary: baseSummary(),
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    doesNotApproveAiReasoning: true,
    analyticalDetectionContextOnly: true,
    ...over,
  };
}

describe("Phase 5D Step7 — valid range boundaries", () => {
  it("produces bullish candidate with valid upper/lower boundaries at NEAR_LOWER", () => {
    const r = mifRangeDetector.evaluate(rgContext());
    expect(r.candidate).toBeTruthy();
    expect(r.candidate!.direction).toBe("BUY");
    expect(r.candidate!.strategyId).toBe("RANGE");
    expect(r.candidate!.detectorId).toBe(MIF_RANGE_DETECTOR_ID);
    expect(r.candidate!.acceptsForExecution).toBe(false);
  });

  it("rejects missing upper boundary", () => {
    const ctx = rgContext({
      evidence: [
        ev({ evidenceId: "rg.regime", family: "MARKET_REGIME" }),
        ev({
          evidenceId: "rg.range",
          family: "RANGE_STRUCTURE",
          notes: "lowerId=ZONE_L;rangeState=VALID;position=NEAR_LOWER;orderValid=true",
        }),
        ev({
          evidenceId: "rg.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "reject=UP;closeState=CLOSED;accepted=true",
        }),
        ev({ evidenceId: "rg.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifRangeDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects missing lower boundary", () => {
    const ctx = rgContext({
      evidence: [
        ev({ evidenceId: "rg.regime", family: "MARKET_REGIME" }),
        ev({
          evidenceId: "rg.range",
          family: "RANGE_STRUCTURE",
          notes: "upperId=ZONE_U;rangeState=VALID;position=NEAR_UPPER;orderValid=true",
        }),
        ev({
          evidenceId: "rg.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "reject=DOWN;closeState=CLOSED;accepted=true",
        }),
        ev({ evidenceId: "rg.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifRangeDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects upper not above lower (orderValid=false)", () => {
    const ctx = rgContext({
      evidence: [
        ev({ evidenceId: "rg.regime", family: "MARKET_REGIME" }),
        ev({
          evidenceId: "rg.range",
          family: "RANGE_STRUCTURE",
          notes:
            "upperId=ZONE_U;lowerId=ZONE_L;rangeState=VALID;position=NEAR_LOWER;orderValid=false",
        }),
        ev({
          evidenceId: "rg.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "reject=UP;closeState=CLOSED;accepted=true",
        }),
        ev({ evidenceId: "rg.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifRangeDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects Fibonacci-only boundaries", () => {
    const ctx = rgContext({
      evidence: [
        ev({ evidenceId: "rg.regime", family: "MARKET_REGIME" }),
        ev({
          evidenceId: "rg.range",
          family: "RANGE_STRUCTURE",
          notes:
            "upperId=ZONE_U;lowerId=ZONE_L;rangeState=VALID;position=NEAR_LOWER;orderValid=true;source=FIBONACCI",
        }),
        ev({
          evidenceId: "rg.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "reject=UP;closeState=CLOSED;accepted=true",
        }),
        ev({ evidenceId: "rg.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifRangeDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects arbitrary unsupported levels", () => {
    const ctx = rgContext({
      evidence: [
        ev({ evidenceId: "rg.regime", family: "MARKET_REGIME" }),
        ev({
          evidenceId: "rg.range",
          family: "RANGE_STRUCTURE",
          notes:
            "upperId=ZONE_U;lowerId=ZONE_L;rangeState=VALID;position=NEAR_LOWER;orderValid=true;arbitrary=true",
        }),
        ev({
          evidenceId: "rg.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "reject=UP;closeState=CLOSED;accepted=true",
        }),
        ev({ evidenceId: "rg.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifRangeDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects invalid boundary evidence", () => {
    const ctx = rgContext({
      evidence: [
        ev({ evidenceId: "rg.regime", family: "MARKET_REGIME" }),
        ev({
          evidenceId: "rg.range",
          family: "RANGE_STRUCTURE",
          notes:
            "upperId=ZONE_U;lowerId=ZONE_L;rangeState=INVALID;position=NEAR_LOWER;orderValid=true",
        }),
        ev({
          evidenceId: "rg.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "reject=UP;closeState=CLOSED;accepted=true",
        }),
        ev({ evidenceId: "rg.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifRangeDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects stale range structure evidence", () => {
    const ctx = rgContext({
      evidence: [
        ev({ evidenceId: "rg.regime", family: "MARKET_REGIME" }),
        ev({
          evidenceId: "rg.range",
          family: "RANGE_STRUCTURE",
          candleState: "STALE",
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
    });
    expect(mifRangeDetector.evaluate(ctx).candidate).toBeNull();
  });
});

describe("Phase 5D Step7 — bullish range opportunity", () => {
  it("produces BUY on CLOSED bullish rejection at lower boundary", () => {
    expect(mifRangeDetector.evaluate(rgContext()).candidate?.direction).toBe("BUY");
  });

  it("preserves conflicting MTF evidence", () => {
    const ctx = rgContext({
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
        ev({
          evidenceId: "rg.mtf",
          family: "MULTI_TIMEFRAME_RELATIONSHIP",
          notes: "relation=CONFLICT",
        }),
      ],
    });
    const r = mifRangeDetector.evaluate(ctx);
    expect(r.candidate).toBeTruthy();
    expect(r.candidate!.conflictingEvidenceIds.length).toBeGreaterThan(0);
    expect(r.candidate!.status).toBe("NEEDS_CONFIRMATION");
  });

  it("rejects FORMING candle confirmation", () => {
    const ctx = rgContext({
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
          candleState: "FORMING",
          notes: "reject=UP;closeState=FORMING;accepted=true",
        }),
        ev({ evidenceId: "rg.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifRangeDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects regime alone without boundary rejection", () => {
    const ctx = rgContext({
      evidence: [
        ev({ evidenceId: "rg.regime", family: "MARKET_REGIME" }),
        ev({
          evidenceId: "rg.range",
          family: "RANGE_STRUCTURE",
          notes:
            "upperId=ZONE_U;lowerId=ZONE_L;rangeState=VALID;position=NEAR_LOWER;orderValid=true",
        }),
        ev({ evidenceId: "rg.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifRangeDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects confirmed downside breakout (BREAKOUT regime)", () => {
    const ctx = rgContext({
      evidenceSummary: baseSummary({ regimeStructure: "BREAKOUT", regimeDirection: "DOWN" }),
    });
    // evidenceSummary drives regime when no assessment — structure BREAKOUT
    const patched = {
      ...ctx,
      evidenceSummary: baseSummary({ regimeStructure: "BREAKOUT", regimeDirection: "DOWN" }),
    };
    expect(mifRangeDetector.evaluate(patched).candidate).toBeNull();
  });
});

describe("Phase 5D Step7 — bearish range opportunity", () => {
  it("produces SELL on CLOSED bearish rejection at upper boundary", () => {
    const ctx = rgContext({
      evidence: [
        ev({ evidenceId: "rg.regime", family: "MARKET_REGIME" }),
        ev({
          evidenceId: "rg.range",
          family: "RANGE_STRUCTURE",
          notes:
            "upperId=ZONE_U;lowerId=ZONE_L;rangeState=VALID;position=NEAR_UPPER;orderValid=true",
        }),
        ev({
          evidenceId: "rg.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "reject=DOWN;closeState=CLOSED;accepted=true",
        }),
        ev({ evidenceId: "rg.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifRangeDetector.evaluate(ctx).candidate?.direction).toBe("SELL");
  });

  it("rejects without upper-boundary position evidence", () => {
    const ctx = rgContext({
      evidence: [
        ev({ evidenceId: "rg.regime", family: "MARKET_REGIME" }),
        ev({
          evidenceId: "rg.range",
          family: "RANGE_STRUCTURE",
          notes: "upperId=ZONE_U;lowerId=ZONE_L;rangeState=VALID;orderValid=true",
        }),
        ev({
          evidenceId: "rg.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "reject=DOWN;closeState=CLOSED;accepted=true",
        }),
        ev({ evidenceId: "rg.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifRangeDetector.evaluate(ctx).candidate).toBeNull();
  });
});

describe("Phase 5D Step7 — mid-range and invalidation", () => {
  it("produces no candidate for mid-range position", () => {
    const ctx = rgContext({
      evidence: [
        ev({ evidenceId: "rg.regime", family: "MARKET_REGIME" }),
        ev({
          evidenceId: "rg.range",
          family: "RANGE_STRUCTURE",
          notes:
            "upperId=ZONE_U;lowerId=ZONE_L;rangeState=VALID;position=MID;orderValid=true",
        }),
        ev({
          evidenceId: "rg.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "reject=UP;closeState=CLOSED;accepted=true",
        }),
        ev({ evidenceId: "rg.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifRangeDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects price outside upper boundary", () => {
    const ctx = rgContext({
      evidence: [
        ev({ evidenceId: "rg.regime", family: "MARKET_REGIME" }),
        ev({
          evidenceId: "rg.range",
          family: "RANGE_STRUCTURE",
          notes:
            "upperId=ZONE_U;lowerId=ZONE_L;rangeState=VALID;position=OUTSIDE_UPPER;orderValid=true",
        }),
        ev({
          evidenceId: "rg.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "reject=DOWN;closeState=CLOSED;accepted=true",
        }),
        ev({ evidenceId: "rg.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifRangeDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects price outside lower boundary", () => {
    const ctx = rgContext({
      evidence: [
        ev({ evidenceId: "rg.regime", family: "MARKET_REGIME" }),
        ev({
          evidenceId: "rg.range",
          family: "RANGE_STRUCTURE",
          notes:
            "upperId=ZONE_U;lowerId=ZONE_L;rangeState=VALID;position=OUTSIDE_LOWER;orderValid=true",
        }),
        ev({
          evidenceId: "rg.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "reject=UP;closeState=CLOSED;accepted=true",
        }),
        ev({ evidenceId: "rg.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifRangeDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects TRANSITION alone", () => {
    const ctx = rgContext({
      evidenceSummary: baseSummary({ regimeStructure: "TRANSITION" }),
    });
    expect(mifRangeDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects TRENDING regime conflict", () => {
    const ctx = rgContext({
      evidenceSummary: baseSummary({ regimeStructure: "TRENDING", regimeDirection: "UP" }),
    });
    expect(mifRangeDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects broken range state", () => {
    const ctx = rgContext({
      evidence: [
        ev({ evidenceId: "rg.regime", family: "MARKET_REGIME" }),
        ev({
          evidenceId: "rg.range",
          family: "RANGE_STRUCTURE",
          notes:
            "upperId=ZONE_U;lowerId=ZONE_L;rangeState=BROKEN;position=NEAR_LOWER;orderValid=true",
        }),
        ev({
          evidenceId: "rg.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "reject=UP;closeState=CLOSED;accepted=true",
        }),
        ev({ evidenceId: "rg.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifRangeDetector.evaluate(ctx).candidate).toBeNull();
  });
});

describe("Phase 5D Step7 — eligibility and determinism", () => {
  it("rejects ACTIVE detector for DISABLED strategy", () => {
    const base = getDefaultMifStrategyIntelligenceRegistry().getStrategy("RANGE")!;
    const disabled: MifStrategyDefinition = { ...base, lifecycleStatus: "DISABLED" };
    const stratReg = createMifStrategyIntelligenceRegistry([
      ...MIF_STRATEGY_CATALOG.filter((s) => s.strategyId !== "RANGE"),
      disabled,
    ]);
    expect(() =>
      createMifOpportunityDetectorRegistry(
        [{ ...mifRangeDetector, availabilityStatus: "ACTIVE" }],
        stratReg,
      ),
    ).toThrow(/lifecycle|activate/i);
  });

  it("is deterministic and does not mutate input", () => {
    const ctx = rgContext();
    const before = JSON.stringify(ctx.evidence);
    const a = mifRangeDetector.evaluate(ctx);
    const b = mifRangeDetector.evaluate(ctx);
    expect(a.candidate?.candidateId).toBe(b.candidate?.candidateId);
    expect(JSON.stringify(ctx.evidence)).toBe(before);
  });

  it("rejects blocked quality via orchestrator", () => {
    const result = runMifOpportunityDetection({
      context: rgContext({
        dataQualityStatus: "BLOCKED",
        evidenceSummary: { ...baseSummary(), dataQualityStatus: "BLOCKED" },
      }),
      detectors: [mifRangeDetector],
      reportMissingDetectors: false,
    });
    expect(result.candidates).toHaveLength(0);
    expect(["BLOCKED_BY_DATA_QUALITY", "INELIGIBLE"]).toContain(result.outcomes[0]?.status);
  });

  it("rejects mixed instruments via orchestrator", () => {
    const result = runMifOpportunityDetection({
      context: rgContext({
        regime: { providerSymbol: "EURUSD" } as MifOpportunityDetectionContext["regime"],
      }),
      detectors: [mifRangeDetector],
      reportMissingDetectors: false,
    });
    expect(result.outcomes[0]?.status).toBe("INVALID_CONTEXT");
  });

  it("runs eligible RANGE through orchestrator", () => {
    const result = runMifOpportunityDetection({
      context: rgContext(),
      detectors: [mifRangeDetector],
      reportMissingDetectors: false,
    });
    expect(result.outcomes[0]?.status).toBe("CANDIDATE_PRODUCED");
    expect(result.candidates[0]?.strategyId).toBe("RANGE");
    expect(result.acceptsForExecution).toBe(false);
  });
});
