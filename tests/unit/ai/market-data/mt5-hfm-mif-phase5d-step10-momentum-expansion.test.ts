/**
 * Phase 5D Step 10 — Momentum Expansion Opportunity Detector.
 */
import { describe, it, expect } from "vitest";
import {
  MIF_PROVIDER_ID,
  MIF_MOMENTUM_EXPANSION_DETECTOR_ID,
  createMifOpportunityDetectorRegistry,
  createMifStrategyIntelligenceRegistry,
  getDefaultMifStrategyIntelligenceRegistry,
  mifMomentumExpansionDetector,
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
    regimeStructure: "TRENDING" as const,
    regimeVolatility: "HIGH" as const,
    availableTimeframeRoles: ["OPPORTUNITY_FORMATION" as const, "PRIMARY_DIRECTION" as const],
    evidence: [
      {
        evidenceId: "me.displacement",
        family: "PRICE_DISPLACEMENT" as const,
        presence: "PRESENT" as const,
        qualityStatus: "VALID" as const,
        closedCandleSatisfied: true,
        sourceAssessmentId: null,
        sourceContractId: null,
      },
      {
        evidenceId: "me.vol",
        family: "VOLATILITY" as const,
        presence: "PRESENT" as const,
        qualityStatus: "VALID" as const,
        closedCandleSatisfied: true,
        sourceAssessmentId: null,
        sourceContractId: null,
      },
      {
        evidenceId: "me.regime",
        family: "MARKET_REGIME" as const,
        presence: "PRESENT" as const,
        qualityStatus: "VALID" as const,
        closedCandleSatisfied: null,
        sourceAssessmentId: null,
        sourceContractId: null,
      },
      {
        evidenceId: "me.quality",
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

function meContext(over: Partial<MifOpportunityDetectionContext> = {}): MifOpportunityDetectionContext {
  const summaryOver = (over.evidenceSummary ?? {}) as Record<string, unknown>;
  const summary = baseSummary(summaryOver);
  // Always force required role — Partial spreads must not drop OPPORTUNITY_FORMATION.
  summary.availableTimeframeRoles = [
    "OPPORTUNITY_FORMATION",
    "PRIMARY_DIRECTION",
    ...((summary.availableTimeframeRoles as string[] | undefined) ?? []).filter(
      (r) => r !== "OPPORTUNITY_FORMATION" && r !== "PRIMARY_DIRECTION",
    ),
  ] as typeof summary.availableTimeframeRoles;

  return {
    contextVersion: "1.0.0",
    providerId: MIF_PROVIDER_ID,
    providerSymbol: "XAUUSD",
    instrument: null,
    assessmentTimestamp: "2024-06-01T12:00:00.000Z",
    timebase: "BROKER_SERVER",
    dataQualityStatus: "VALID",
    availableTimeframeRoles: [
      "OPPORTUNITY_FORMATION",
      "PRIMARY_DIRECTION",
      "INTERMEDIATE_STRUCTURE",
      "SETUP_DEVELOPMENT",
      "LOWER_TIMEFRAME_CONFIRMATION",
    ],
    evidence: [
      ev({
        evidenceId: "me.displacement",
        family: "PRICE_DISPLACEMENT",
        notes:
          "direction=UP;phase=EXPANDING;atrExpand=true;expand=true;magnitude=STRONG;closeState=CLOSED",
      }),
      ev({
        evidenceId: "me.vol",
        family: "VOLATILITY",
        notes: "volState=HIGH;expand=true",
      }),
      ev({
        evidenceId: "me.regime",
        family: "MARKET_REGIME",
        candleState: null,
        notes: "structure=TRENDING;direction=UP",
      }),
      ev({
        evidenceId: "me.candle",
        family: "CANDLE_CONFIRMATION",
        notes: "closeState=CLOSED;confirm=EXPAND",
      }),
      ev({ evidenceId: "me.quality", family: "DATA_QUALITY", candleState: null }),
      ev({
        evidenceId: "me.mtf",
        family: "MULTI_TIMEFRAME_RELATIONSHIP",
        notes: "relation=ALIGNMENT",
      }),
    ],
    evidenceSummary: summary,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    doesNotApproveAiReasoning: true,
    analyticalDetectionContextOnly: true,
    ...over,
    // Re-apply summary after over so role/regime eligibility cannot be dropped.
    evidenceSummary: over.evidenceSummary
      ? baseSummary({
          ...over.evidenceSummary,
          availableTimeframeRoles: [
            "OPPORTUNITY_FORMATION",
            "PRIMARY_DIRECTION",
            ...((over.evidenceSummary.availableTimeframeRoles as string[] | undefined) ?? []),
          ],
        })
      : summary,
    availableTimeframeRoles: over.availableTimeframeRoles ?? [
      "OPPORTUNITY_FORMATION",
      "PRIMARY_DIRECTION",
      "INTERMEDIATE_STRUCTURE",
      "SETUP_DEVELOPMENT",
      "LOWER_TIMEFRAME_CONFIRMATION",
    ],
  };
}

describe("Phase 5D Step10 — bullish and bearish expansion", () => {
  it("produces BUY on valid bullish momentum expansion", () => {
    const r = mifMomentumExpansionDetector.evaluate(meContext());
    expect(r.candidate).toBeTruthy();
    expect(r.candidate!.direction).toBe("BUY");
    expect(r.candidate!.strategyId).toBe("MOMENTUM_EXPANSION");
    expect(r.candidate!.detectorId).toBe(MIF_MOMENTUM_EXPANSION_DETECTOR_ID);
    expect(r.candidate!.acceptsForExecution).toBe(false);
    expect(r.candidate!.status).toBe("DETECTED");
  });

  it("produces SELL on valid bearish momentum expansion", () => {
    const ctx = meContext({
      evidence: [
        ev({
          evidenceId: "me.displacement",
          family: "PRICE_DISPLACEMENT",
          notes:
            "direction=DOWN;phase=EXPANDING;atrExpand=true;magnitude=STRONG;closeState=CLOSED",
        }),
        ev({ evidenceId: "me.vol", family: "VOLATILITY", notes: "volState=EXTREME" }),
        ev({ evidenceId: "me.regime", family: "MARKET_REGIME", candleState: null }),
        ev({
          evidenceId: "me.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "closeState=CLOSED",
        }),
        ev({ evidenceId: "me.quality", family: "DATA_QUALITY", candleState: null }),
        ev({
          evidenceId: "me.mtf",
          family: "MULTI_TIMEFRAME_RELATIONSHIP",
          notes: "relation=ALIGNMENT",
        }),
      ],
      evidenceSummary: baseSummary({ regimeDirection: "DOWN" }),
    });
    expect(mifMomentumExpansionDetector.evaluate(ctx).candidate?.direction).toBe("SELL");
  });

  it("rejects positive momentum without expansion", () => {
    const ctx = meContext({
      evidence: [
        ev({
          evidenceId: "me.displacement",
          family: "PRICE_DISPLACEMENT",
          notes: "direction=UP;phase=BUILDING;magnitude=MODERATE;closeState=CLOSED;atrExpand=false",
        }),
        ev({ evidenceId: "me.vol", family: "VOLATILITY", notes: "volState=NORMAL" }),
        ev({ evidenceId: "me.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifMomentumExpansionDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects negative momentum without expansion", () => {
    const ctx = meContext({
      evidence: [
        ev({
          evidenceId: "me.displacement",
          family: "PRICE_DISPLACEMENT",
          notes: "direction=DOWN;phase=BUILDING;magnitude=WEAK;closeState=CLOSED",
        }),
        ev({ evidenceId: "me.vol", family: "VOLATILITY", notes: "volState=NORMAL" }),
        ev({ evidenceId: "me.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifMomentumExpansionDetector.evaluate(ctx).candidate).toBeNull();
  });
});

describe("Phase 5D Step10 — volatility, candle, magnitude gates", () => {
  it("rejects volatility expansion without directional displacement", () => {
    const ctx = meContext({
      evidence: [
        ev({
          evidenceId: "me.vol",
          family: "VOLATILITY",
          notes: "volState=EXPANDING;expand=true;directional=false",
        }),
        ev({ evidenceId: "me.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    const r = mifMomentumExpansionDetector.evaluate(ctx);
    expect(r.candidate).toBeNull();
    expect(r.diagnostics).toMatch(/volatility alone|directional/i);
  });

  it("rejects large candle alone", () => {
    const ctx = meContext({
      evidence: [
        ev({
          evidenceId: "me.displacement",
          family: "PRICE_DISPLACEMENT",
          notes:
            "direction=UP;phase=EXPANDING;atrExpand=true;magnitude=STRONG;closeState=CLOSED;candleOnly=true",
        }),
        ev({ evidenceId: "me.vol", family: "VOLATILITY", notes: "volState=HIGH" }),
        ev({ evidenceId: "me.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifMomentumExpansionDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects missing displacement", () => {
    const ctx = meContext({
      evidence: [
        ev({ evidenceId: "me.vol", family: "VOLATILITY", notes: "volState=HIGH" }),
        ev({ evidenceId: "me.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifMomentumExpansionDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects missing or invalid magnitude", () => {
    const ctx = meContext({
      evidence: [
        ev({
          evidenceId: "me.displacement",
          family: "PRICE_DISPLACEMENT",
          notes: "direction=UP;phase=EXPANDING;atrExpand=true;closeState=CLOSED",
        }),
        ev({ evidenceId: "me.vol", family: "VOLATILITY", notes: "volState=HIGH" }),
        ev({ evidenceId: "me.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifMomentumExpansionDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects fabricated acceleration / MOMENTUM notes", () => {
    const ctx = meContext({
      evidence: [
        ...meContext().evidence!,
        ev({
          evidenceId: "me.momentum",
          family: "MOMENTUM",
          notes: "fabricated=true;phase=EXPANDING;direction=UP",
        }),
      ],
    });
    expect(mifMomentumExpansionDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects exhaustion misclassified as expansion", () => {
    const ctx = meContext({
      evidence: [
        ev({
          evidenceId: "me.displacement",
          family: "PRICE_DISPLACEMENT",
          notes:
            "direction=UP;phase=EXHAUSTING;atrExpand=true;magnitude=STRONG;closeState=CLOSED",
        }),
        ev({ evidenceId: "me.vol", family: "VOLATILITY", notes: "volState=HIGH" }),
        ev({ evidenceId: "me.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifMomentumExpansionDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects conflicting momentum phase", () => {
    const ctx = meContext({
      evidence: [
        ev({
          evidenceId: "me.displacement",
          family: "PRICE_DISPLACEMENT",
          notes:
            "direction=UP;phase=CONFLICTING;atrExpand=true;magnitude=STRONG;closeState=CLOSED",
        }),
        ev({ evidenceId: "me.vol", family: "VOLATILITY", notes: "volState=HIGH" }),
        ev({ evidenceId: "me.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifMomentumExpansionDetector.evaluate(ctx).candidate).toBeNull();
  });
});

describe("Phase 5D Step10 — candle confirmation", () => {
  it("accepts CLOSED displacement confirmation", () => {
    const r = mifMomentumExpansionDetector.evaluate(meContext());
    expect(r.candidate).toBeTruthy();
  });

  it("rejects FORMING displacement candle", () => {
    const ctx = meContext({
      evidence: [
        ev({
          evidenceId: "me.displacement",
          family: "PRICE_DISPLACEMENT",
          candleState: "FORMING",
          notes:
            "direction=UP;phase=EXPANDING;atrExpand=true;magnitude=STRONG;closeState=FORMING",
        }),
        ev({ evidenceId: "me.vol", family: "VOLATILITY", notes: "volState=HIGH" }),
        ev({ evidenceId: "me.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifMomentumExpansionDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects STALE displacement", () => {
    const ctx = meContext({
      evidence: [
        ev({
          evidenceId: "me.displacement",
          family: "PRICE_DISPLACEMENT",
          candleState: "STALE",
          notes:
            "direction=UP;phase=EXPANDING;atrExpand=true;magnitude=STRONG;closeState=CLOSED",
        }),
        ev({ evidenceId: "me.vol", family: "VOLATILITY", notes: "volState=HIGH" }),
        ev({ evidenceId: "me.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifMomentumExpansionDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects invalid displacement quality", () => {
    const ctx = meContext({
      evidence: [
        ev({
          evidenceId: "me.displacement",
          family: "PRICE_DISPLACEMENT",
          qualityStatus: "INVALID",
          notes:
            "direction=UP;phase=EXPANDING;atrExpand=true;magnitude=STRONG;closeState=CLOSED",
        }),
        ev({ evidenceId: "me.vol", family: "VOLATILITY", notes: "volState=HIGH" }),
        ev({ evidenceId: "me.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifMomentumExpansionDetector.evaluate(ctx).candidate).toBeNull();
  });
});

describe("Phase 5D Step10 — instrument, timeframe, quality", () => {
  it("rejects instrument mismatch", () => {
    const ctx = meContext({
      evidence: [
        ev({
          evidenceId: "me.displacement",
          family: "PRICE_DISPLACEMENT",
          notes:
            "direction=UP;phase=EXPANDING;atrExpand=true;magnitude=STRONG;closeState=CLOSED",
        }),
        ev({ evidenceId: "me.vol", family: "VOLATILITY", notes: "volState=HIGH" }),
        ev({
          evidenceId: "me.structure",
          family: "MARKET_STRUCTURE",
          notes: "symbol=EURUSD",
        }),
        ev({ evidenceId: "me.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifMomentumExpansionDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects timeframe mismatch", () => {
    const ctx = meContext({
      evidence: [
        ev({
          evidenceId: "me.displacement",
          family: "PRICE_DISPLACEMENT",
          timeframe: "M15",
          notes:
            "direction=UP;phase=EXPANDING;atrExpand=true;magnitude=STRONG;closeState=CLOSED",
        }),
        ev({ evidenceId: "me.vol", family: "VOLATILITY", notes: "volState=HIGH" }),
        ev({
          evidenceId: "me.structure",
          family: "MARKET_STRUCTURE",
          notes: "timeframe=H1",
        }),
        ev({ evidenceId: "me.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifMomentumExpansionDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects blocked data quality", () => {
    const ctx = meContext({ dataQualityStatus: "BLOCKED" });
    expect(mifMomentumExpansionDetector.evaluate(ctx).candidate).toBeNull();
  });
});

describe("Phase 5D Step10 — regime interactions", () => {
  it("accepts TRENDING_UP context", () => {
    const r = mifMomentumExpansionDetector.evaluate(
      meContext({ evidenceSummary: baseSummary({ regimeDirection: "UP", regimeStructure: "TRENDING" }) }),
    );
    expect(r.candidate?.direction).toBe("BUY");
  });

  it("accepts TRENDING_DOWN context for bearish expansion", () => {
    const ctx = meContext({
      evidence: [
        ev({
          evidenceId: "me.displacement",
          family: "PRICE_DISPLACEMENT",
          notes:
            "direction=DOWN;phase=EXPANDING;atrExpand=true;magnitude=STRONG;closeState=CLOSED",
        }),
        ev({ evidenceId: "me.vol", family: "VOLATILITY", notes: "volState=HIGH" }),
        ev({
          evidenceId: "me.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "closeState=CLOSED",
        }),
        ev({ evidenceId: "me.quality", family: "DATA_QUALITY", candleState: null }),
        ev({
          evidenceId: "me.mtf",
          family: "MULTI_TIMEFRAME_RELATIONSHIP",
          notes: "relation=ALIGNMENT",
        }),
      ],
      evidenceSummary: baseSummary({ regimeDirection: "DOWN", regimeStructure: "TRENDING" }),
    });
    expect(mifMomentumExpansionDetector.evaluate(ctx).candidate?.direction).toBe("SELL");
  });

  it("marks BREAKOUT regime as NEEDS_CONFIRMATION", () => {
    const ctx = meContext({
      evidenceSummary: baseSummary({ regimeStructure: "BREAKOUT" }),
    });
    const r = mifMomentumExpansionDetector.evaluate(ctx);
    expect(r.candidate).toBeTruthy();
    expect(r.candidate!.status).toBe("NEEDS_CONFIRMATION");
    expect(r.warnings?.some((w) => /BREAKOUT/i.test(w))).toBe(true);
  });

  it("rejects RANGING regime", () => {
    const ctx = meContext({
      evidenceSummary: baseSummary({ regimeStructure: "RANGING" }),
    });
    expect(mifMomentumExpansionDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects UNSTABLE regime", () => {
    const ctx = meContext({
      evidenceSummary: baseSummary({ regimeStructure: "UNSTABLE" }),
    });
    expect(mifMomentumExpansionDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("marks TRANSITION as NEEDS_CONFIRMATION", () => {
    const ctx = meContext({
      evidenceSummary: baseSummary({ regimeStructure: "TRANSITION" }),
    });
    const r = mifMomentumExpansionDetector.evaluate(ctx);
    expect(r.candidate).toBeTruthy();
    expect(r.candidate!.status).toBe("NEEDS_CONFIRMATION");
  });
});

describe("Phase 5D Step10 — MTF", () => {
  it("preserves MTF ALIGNMENT for DETECTED when other gates pass", () => {
    const r = mifMomentumExpansionDetector.evaluate(meContext());
    expect(r.candidate?.status).toBe("DETECTED");
  });

  it("marks PARTIAL_ALIGNMENT as NEEDS_CONFIRMATION", () => {
    const ctx = meContext({
      evidence: [
        ...meContext().evidence!.filter((e) => e.evidenceId !== "me.mtf"),
        ev({
          evidenceId: "me.mtf",
          family: "MULTI_TIMEFRAME_RELATIONSHIP",
          notes: "relation=PARTIAL_ALIGNMENT",
        }),
      ],
    });
    const r = mifMomentumExpansionDetector.evaluate(ctx);
    expect(r.candidate!.status).toBe("NEEDS_CONFIRMATION");
    expect(r.candidate!.conflictingEvidenceIds.length).toBeGreaterThan(0);
  });

  it("preserves MTF CONFLICT", () => {
    const ctx = meContext({
      evidence: [
        ...meContext().evidence!.filter((e) => e.evidenceId !== "me.mtf"),
        ev({
          evidenceId: "me.mtf",
          family: "MULTI_TIMEFRAME_RELATIONSHIP",
          notes: "relation=CONFLICT",
        }),
      ],
    });
    const r = mifMomentumExpansionDetector.evaluate(ctx);
    expect(r.candidate!.status).toBe("NEEDS_CONFIRMATION");
    expect(r.candidate!.conflictingEvidenceIds).toContain("me.mtf");
  });

  it("preserves POTENTIAL_REVERSAL conflict", () => {
    const ctx = meContext({
      evidence: [
        ...meContext().evidence!.filter((e) => e.evidenceId !== "me.mtf"),
        ev({
          evidenceId: "me.mtf",
          family: "MULTI_TIMEFRAME_RELATIONSHIP",
          notes: "relation=POTENTIAL_REVERSAL",
        }),
      ],
    });
    const r = mifMomentumExpansionDetector.evaluate(ctx);
    expect(r.candidate!.status).toBe("NEEDS_CONFIRMATION");
    expect(r.warnings?.some((w) => /POTENTIAL_REVERSAL/i.test(w))).toBe(true);
  });
});

describe("Phase 5D Step10 — eligibility and determinism", () => {
  it("rejects ACTIVE detector for DISABLED strategy", () => {
    const base = getDefaultMifStrategyIntelligenceRegistry().getStrategy("MOMENTUM_EXPANSION")!;
    const disabled: MifStrategyDefinition = { ...base, lifecycleStatus: "DISABLED" };
    const stratReg = createMifStrategyIntelligenceRegistry([
      ...MIF_STRATEGY_CATALOG.filter((s) => s.strategyId !== "MOMENTUM_EXPANSION"),
      disabled,
    ]);
    expect(() =>
      createMifOpportunityDetectorRegistry(
        [{ ...mifMomentumExpansionDetector, availabilityStatus: "ACTIVE" }],
        stratReg,
      ),
    ).toThrow(/lifecycle|activate/i);
  });

  it("produces deterministic candidate identity", () => {
    const a = mifMomentumExpansionDetector.evaluate(meContext()).candidate!;
    const b = mifMomentumExpansionDetector.evaluate(meContext()).candidate!;
    expect(a.candidateId).toBe(b.candidateId);
  });

  it("does not mutate input context", () => {
    const ctx = meContext();
    const before = JSON.stringify(ctx);
    mifMomentumExpansionDetector.evaluate(ctx);
    expect(JSON.stringify(ctx)).toBe(before);
  });

  it("runs eligible MOMENTUM_EXPANSION through orchestrator", () => {
    const ctx = meContext();
    const result = runMifOpportunityDetection({
      context: ctx,
      detectors: [mifMomentumExpansionDetector],
      reportMissingDetectors: false,
    });
    expect(
      result.outcomes[0]?.status,
      `diag=${result.outcomes[0]?.diagnostics}; elig=${result.outcomes[0]?.eligibility?.status}; roles=${JSON.stringify(ctx.evidenceSummary?.availableTimeframeRoles)}; missing=${JSON.stringify(result.outcomes[0]?.eligibility?.missing)}; ev=${JSON.stringify(result.outcomes[0]?.evidenceValidation)}`,
    ).toBe("CANDIDATE_PRODUCED");
    expect(result.candidates[0]?.strategyId).toBe("MOMENTUM_EXPANSION");
    expect(result.acceptsForExecution).toBe(false);
  });

  it("isolates detector failure without throwing from evaluate", () => {
    const r = mifMomentumExpansionDetector.evaluate(meContext({ evidence: [] }));
    expect(r.candidate).toBeNull();
    expect(typeof r.diagnostics).toBe("string");
  });
});
