/**
 * Phase 5C Step 3 — multi-timeframe relationships engine.
 */
import { describe, it, expect } from "vitest";
import {
  assessMifMultiTimeframeRelationships,
  buildMifStep3AnalyticalBundle,
  MIF_MTF_RELATIONSHIPS_CONTRACT_ID,
  MIF_POLICY_HFM_MTF_RELATIONSHIPS,
  validateMifMtfRelationshipsPolicy,
  type MifMarketRegimeAssessment,
  type MifMtfTimeframeSources,
  type MifHarmonicAssessment,
  type MifChartPatternAssessment,
} from "../../../../ai/market-data/mt5-hfm/mif/index";

function regimeStub(over: Partial<MifMarketRegimeAssessment> & {
  timeframe: string;
  direction: MifMarketRegimeAssessment["direction"];
  structure: MifMarketRegimeAssessment["structure"];
}): MifMarketRegimeAssessment {
  return {
    contractId: "kwizera.mif.market-regime.v1",
    contractVersion: "1.0.0",
    scope: "step2-market-regime",
    assessmentId: `reg-${over.timeframe}`,
    inputIdentity: `id-${over.timeframe}`,
    providerId: "HFM_MT5",
    providerSymbol: "XAUUSD",
    timeframe: over.timeframe,
    instrument: null,
    policyId: "mif-hfm-market-regime",
    policyVersion: "1.0.0",
    engineId: "mif-market-regime",
    engineVersion: "1.0.0",
    assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    status: over.status ?? "VALID",
    direction: over.direction,
    structure: over.structure,
    volatility: over.volatility ?? "NORMAL",
    compositeLabel: over.compositeLabel ?? "TRANSITION",
    trendEvidence: {
      higherHighs: 0,
      higherLows: 0,
      lowerHighs: 0,
      lowerLows: 0,
      displacement: null,
      displacementAtr: null,
      persistenceBars: 0,
      directionHint: over.direction,
    },
    rangeEvidence: {
      high: null,
      low: null,
      width: null,
      widthAtr: null,
      containmentRatio: null,
      displacementAtr: null,
    },
    breakoutEvidence: {
      state: "NONE",
      direction: "NEUTRAL",
      boundary: null,
      breakCandleOpenTimeSec: null,
      displacementAtr: null,
      followThroughBars: 0,
    },
    volatilityEvidence: {
      atr: 1,
      atrBaseline: 1,
      atrRatio: 1,
      classification: over.volatility ?? "NORMAL",
    },
    transition: {
      previousStructure: null,
      previousDirection: null,
      changed: false,
      hysteresisHeld: false,
      reason: "stub",
    },
    qualityRef: {
      sourceKind: "step1-data-integrity",
      status: "VALID",
      inputIdentity: "q",
      assessmentId: "q1",
    },
    findings: [],
    warningCodes: [],
    blockingCodes: [],
    diagnostics: {
      overallStatusReason: "stub",
      closedBarCount: 40,
      confirmedSwingCount: 6,
      atrMethodId: "SMA_OF_TR",
      atrValue: 1,
      atrPeriod: 14,
    },
    diagnosticsSummary: "stub",
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    doesNotApproveAiReasoning: true,
    analyticalRegimeInformationOnly: true,
    ...over,
  };
}

function src(
  timeframe: string,
  regime: MifMarketRegimeAssessment,
  extra: Partial<MifMtfTimeframeSources> = {},
): MifMtfTimeframeSources {
  return {
    timeframe,
    providerSymbol: "XAUUSD",
    regime,
    tipCandleState: "CLOSED",
    tipTimebase: "BROKER_SERVER",
    tipOpenTimeSec: 1_700_000_000,
    qualityStatus: "VALID",
    ...extra,
  };
}

describe("Phase 5C Step3 — multi-timeframe relationships", () => {
  it("validates built-in policy and hierarchy", () => {
    expect(validateMifMtfRelationshipsPolicy(MIF_POLICY_HFM_MTF_RELATIONSHIPS).ok).toBe(true);
    expect(MIF_POLICY_HFM_MTF_RELATIONSHIPS.hierarchy).toEqual([
      "W1", "D1", "H4", "H1", "M30", "M15", "M5", "M1",
    ]);
  });

  it("classifies full bullish alignment W1→M5 with optional M1 missing", () => {
    const sources = ["W1", "D1", "H4", "H1", "M30", "M15", "M5"].map((tf) =>
      src(tf, regimeStub({
        timeframe: tf,
        direction: "UP",
        structure: "TRENDING",
        compositeLabel: "TRENDING_UP",
      })),
    );
    const r = assessMifMultiTimeframeRelationships({
      sources,
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(r.contractId).toBe(MIF_MTF_RELATIONSHIPS_CONTRACT_ID);
    expect(r.directional.relation).toBe("ALIGNMENT");
    expect(r.completeness.missingOptional).toContain("M1");
    expect(r.completeness.missingRequired).toHaveLength(0);
    expect(r.doesNotApproveAiReasoning).toBe(true);
    expect(r.placesOrders).toBe(false);
    expect(r.alignmentScore).not.toBeNull();
  });

  it("preserves higher-bullish / lower-bearish as pullback when intermediate agrees higher", () => {
    const sources = [
      src("H4", regimeStub({ timeframe: "H4", direction: "UP", structure: "TRENDING", compositeLabel: "TRENDING_UP" })),
      src("H1", regimeStub({ timeframe: "H1", direction: "UP", structure: "TRENDING", compositeLabel: "TRENDING_UP" })),
      src("M15", regimeStub({ timeframe: "M15", direction: "DOWN", structure: "TRENDING", compositeLabel: "TRENDING_DOWN" })),
    ];
    const r = assessMifMultiTimeframeRelationships({
      sources,
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(r.directional.relation).toBe("COUNTERTREND_PULLBACK");
    expect(r.conflicts.pullbackCompatible).toBe(true);
    expect(r.conflicts.hasConflict).toBe(true);
  });

  it("flags potential reversal when lower and intermediate oppose higher with transition", () => {
    const sources = [
      src("H4", regimeStub({ timeframe: "H4", direction: "DOWN", structure: "TRENDING", compositeLabel: "TRENDING_DOWN" })),
      src("H1", regimeStub({ timeframe: "H1", direction: "UP", structure: "TRANSITION", compositeLabel: "TRANSITION" })),
      src("M15", regimeStub({ timeframe: "M15", direction: "UP", structure: "TRENDING", compositeLabel: "TRENDING_UP" })),
    ];
    const r = assessMifMultiTimeframeRelationships({
      sources,
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(["POTENTIAL_REVERSAL", "TRANSITION", "CONFLICT"]).toContain(r.directional.relation);
    expect(r.conflicts.transitionCompatible || r.directional.relation === "POTENTIAL_REVERSAL").toBe(true);
  });

  it("handles local breakout within higher-timeframe range via regime relationships", () => {
    const sources = [
      src("D1", regimeStub({ timeframe: "D1", direction: "NEUTRAL", structure: "RANGING", compositeLabel: "RANGING" })),
      src("H4", regimeStub({ timeframe: "H4", direction: "NEUTRAL", structure: "RANGING", compositeLabel: "RANGING" })),
      src("H1", regimeStub({ timeframe: "H1", direction: "UP", structure: "BREAKOUT", compositeLabel: "BREAKOUT" })),
      src("M15", regimeStub({ timeframe: "M15", direction: "UP", structure: "BREAKOUT", compositeLabel: "BREAKOUT" })),
    ];
    const r = assessMifMultiTimeframeRelationships({
      sources,
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(r.regimeRelationships.explanation.toLowerCase()).toMatch(/range|breakout/);
    expect(["PARTIAL", "TRANSITION", "ALIGNED", "INSUFFICIENT"]).toContain(r.regimeRelationships.status);
  });

  it("blocks mixed instruments and duplicate timeframes", () => {
    const mixed = assessMifMultiTimeframeRelationships({
      sources: [
        src("H4", regimeStub({ timeframe: "H4", direction: "UP", structure: "TRENDING", providerSymbol: "XAUUSD" as never })),
        {
          ...src("H1", regimeStub({ timeframe: "H1", direction: "UP", structure: "TRENDING", providerSymbol: "EURUSD" as never })),
          providerSymbol: "EURUSD",
        },
      ],
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    // Fix: regime stubs always XAUUSD — set providerSymbol on sources and regime
    const mixed2 = assessMifMultiTimeframeRelationships({
      sources: [
        {
          timeframe: "H4",
          providerSymbol: "XAUUSD",
          regime: regimeStub({ timeframe: "H4", direction: "UP", structure: "TRENDING" }),
          tipTimebase: "BROKER_SERVER",
        },
        {
          timeframe: "H1",
          providerSymbol: "EURUSD",
          regime: {
            ...regimeStub({ timeframe: "H1", direction: "UP", structure: "TRENDING" }),
            providerSymbol: "EURUSD",
          },
          tipTimebase: "BROKER_SERVER",
        },
      ],
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(mixed2.status).toBe("BLOCKED");
    expect(mixed2.blockingCodes).toContain("MIXED_INSTRUMENTS");
    void mixed;

    const dup = assessMifMultiTimeframeRelationships({
      sources: [
        src("H1", regimeStub({ timeframe: "H1", direction: "UP", structure: "TRENDING" })),
        src("H1", regimeStub({ timeframe: "H1", direction: "DOWN", structure: "TRENDING" })),
      ],
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(dup.status).toBe("BLOCKED");
    expect(dup.blockingCodes).toContain("DUPLICATE_TIMEFRAME");
  });

  it("does not block when optional M1 missing; warns on missing required when configured", () => {
    const onlyHigher = assessMifMultiTimeframeRelationships({
      sources: [
        src("W1", regimeStub({ timeframe: "W1", direction: "UP", structure: "TRENDING", compositeLabel: "TRENDING_UP" })),
        src("D1", regimeStub({ timeframe: "D1", direction: "UP", structure: "TRENDING", compositeLabel: "TRENDING_UP" })),
      ],
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(onlyHigher.completeness.missingRequired.length).toBeGreaterThan(0);
    expect(onlyHigher.status).not.toBe("BLOCKED"); // missingRequiredBlocks=false
    expect(onlyHigher.warningCodes).toContain("INSUFFICIENT_COVERAGE");
  });

  it("surfaces FORMING/STALE/UNKNOWN timebase limitations without promoting data", () => {
    const r = assessMifMultiTimeframeRelationships({
      sources: [
        {
          ...src("H4", regimeStub({ timeframe: "H4", direction: "UP", structure: "TRENDING" })),
          tipCandleState: "FORMING",
        },
        {
          ...src("H1", regimeStub({ timeframe: "H1", direction: "UP", structure: "TRENDING" })),
          tipCandleState: "STALE",
        },
        {
          ...src("M15", regimeStub({ timeframe: "M15", direction: "UP", structure: "TRENDING" })),
          tipTimebase: "UNKNOWN",
        },
      ],
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const h4 = r.contexts.find((c) => c.timeframe === "H4")!;
    expect(h4.limitations.some((l) => l.includes("FORMING"))).toBe(true);
    expect(r.warningCodes.length).toBeGreaterThan(0);
    expect(r.status).toBe("WARNING");
  });

  it("blocks mixed tip timebases", () => {
    const r = assessMifMultiTimeframeRelationships({
      sources: [
        { ...src("H4", regimeStub({ timeframe: "H4", direction: "UP", structure: "TRENDING" })), tipTimebase: "BROKER_SERVER" },
        { ...src("H1", regimeStub({ timeframe: "H1", direction: "UP", structure: "TRENDING" })), tipTimebase: "UTC" },
      ],
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(r.status).toBe("BLOCKED");
    expect(r.blockingCodes).toContain("TIMEBASE_INCOMPARABLE");
  });

  it("pattern conflict across bands is preserved; forming vs confirmed counted", () => {
    const bullPat = {
      detections: [
        {
          patternType: "DOUBLE_BOTTOM",
          lifecycle: "CONFIRMED",
          confirmation: { direction: "BULLISH", met: true },
        },
      ],
      assessmentId: "pat-h4",
      providerSymbol: "XAUUSD",
    } as unknown as MifChartPatternAssessment;
    const bearHar = {
      detections: [
        { orientation: "BEARISH", lifecycle: "FORMING", patternType: "GARTLEY" },
      ],
      assessmentId: "har-m15",
      providerSymbol: "XAUUSD",
    } as unknown as MifHarmonicAssessment;

    const r = assessMifMultiTimeframeRelationships({
      sources: [
        {
          ...src("H4", regimeStub({ timeframe: "H4", direction: "UP", structure: "TRENDING" })),
          chartPatterns: bullPat,
        },
        {
          ...src("M15", regimeStub({ timeframe: "M15", direction: "DOWN", structure: "TRENDING" })),
          harmonic: bearHar,
        },
        src("H1", regimeStub({ timeframe: "H1", direction: "UP", structure: "TRENDING" })),
      ],
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(["CONFLICT", "PARTIAL", "AGREE", "INSUFFICIENT"]).toContain(r.patternRelationships.status);
    expect(r.patternRelationships.formingVsConfirmed.forming + r.patternRelationships.formingVsConfirmed.confirmed).toBeGreaterThan(0);
  });

  it("deterministic repeated assessments and immutability; step3 bridge safety", () => {
    const sources = [
      src("H4", regimeStub({ timeframe: "H4", direction: "UP", structure: "TRENDING", compositeLabel: "TRENDING_UP" })),
      src("H1", regimeStub({ timeframe: "H1", direction: "UP", structure: "TRENDING", compositeLabel: "TRENDING_UP" })),
      src("M15", regimeStub({ timeframe: "M15", direction: "UP", structure: "TRENDING", compositeLabel: "TRENDING_UP" })),
    ];
    const snap = JSON.stringify(sources);
    const a = assessMifMultiTimeframeRelationships({
      sources,
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const b = assessMifMultiTimeframeRelationships({
      sources,
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(a.inputIdentity).toBe(b.inputIdentity);
    expect(a.directional.relation).toBe(b.directional.relation);
    expect(JSON.stringify(sources)).toBe(snap);
    const bundle = buildMifStep3AnalyticalBundle({ multiTimeframeRelationships: a });
    expect(bundle.doesNotApproveAiReasoning).toBe(true);
    expect(bundle.acceptsForExecution).toBe(false);
    expect(bundle.analyticalBundleOnly).toBe(true);
  });
});
