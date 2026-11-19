/**
 * Phase 5D Step 8 — Liquidity Sweep Opportunity Detector.
 */
import { describe, it, expect } from "vitest";
import {
  MIF_PROVIDER_ID,
  MIF_LIQUIDITY_SWEEP_DETECTOR_ID,
  createMifOpportunityDetectorRegistry,
  createMifStrategyIntelligenceRegistry,
  getDefaultMifStrategyIntelligenceRegistry,
  mifLiquiditySweepDetector,
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
    regimeDirection: "UP" as const,
    regimeStructure: "TRENDING" as const,
    regimeVolatility: "NORMAL" as const,
    availableTimeframeRoles: [
      "INTERMEDIATE_STRUCTURE" as const,
      "OPPORTUNITY_FORMATION" as const,
    ],
    evidence: [
      {
        evidenceId: "ls.quality",
        family: "DATA_QUALITY" as const,
        presence: "PRESENT" as const,
        qualityStatus: "VALID" as const,
        closedCandleSatisfied: null,
        sourceAssessmentId: "q1",
        sourceContractId: "kwizera.mif.quality.v1",
      },
      {
        evidenceId: "ls.structure",
        family: "MARKET_STRUCTURE" as const,
        presence: "PRESENT" as const,
        qualityStatus: "VALID" as const,
        closedCandleSatisfied: true,
        sourceAssessmentId: null,
        sourceContractId: null,
      },
      {
        evidenceId: "ls.candle",
        family: "CANDLE_CONFIRMATION" as const,
        presence: "PRESENT" as const,
        qualityStatus: "VALID" as const,
        closedCandleSatisfied: true,
        sourceAssessmentId: null,
        sourceContractId: null,
      },
    ],
    ...over,
  };
}

function lsContext(over: Partial<MifOpportunityDetectionContext> = {}): MifOpportunityDetectionContext {
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
      ev({ evidenceId: "ls.quality", family: "DATA_QUALITY", candleState: null }),
      ev({
        evidenceId: "ls.structure",
        family: "MARKET_STRUCTURE",
        notes:
          "refId=SWING_L1;refType=SWING_LOW;refSide=SELL_SIDE;confirmed=true;temporalOrder=BEFORE_SWEEP",
      }),
      ev({
        evidenceId: "ls.candle",
        family: "CANDLE_CONFIRMATION",
        timeframe: "M15",
        timeframeRole: "OPPORTUNITY_FORMATION",
        notes: "excursion=BELOW;reclaim=true;closeState=CLOSED;reject=UP;accepted=false",
      }),
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

describe("Phase 5D Step8 — bullish liquidity sweep", () => {
  it("produces BUY on sell-side swing-low excursion + CLOSED reclaim", () => {
    const r = mifLiquiditySweepDetector.evaluate(lsContext());
    expect(r.candidate).toBeTruthy();
    expect(r.candidate!.direction).toBe("BUY");
    expect(r.candidate!.strategyId).toBe("LIQUIDITY_SWEEP");
    expect(r.candidate!.detectorId).toBe(MIF_LIQUIDITY_SWEEP_DETECTOR_ID);
    expect(r.candidate!.acceptsForExecution).toBe(false);
  });

  it("preserves supportive MTF evidence", () => {
    const ctx = lsContext({
      evidence: [
        ev({ evidenceId: "ls.quality", family: "DATA_QUALITY", candleState: null }),
        ev({
          evidenceId: "ls.structure",
          family: "MARKET_STRUCTURE",
          notes: "refId=SWING_L1;refType=SWING_LOW;confirmed=true",
        }),
        ev({
          evidenceId: "ls.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "excursion=BELOW;reclaim=true;closeState=CLOSED;reject=UP",
        }),
        ev({
          evidenceId: "ls.mtf",
          family: "MULTI_TIMEFRAME_RELATIONSHIP",
          notes: "relation=ALIGNMENT",
        }),
      ],
    });
    const r = mifLiquiditySweepDetector.evaluate(ctx);
    expect(r.candidate).toBeTruthy();
    expect(r.candidate!.supportingEvidenceIds).toContain("ls.mtf");
  });

  it("rejects missing reclaim", () => {
    const ctx = lsContext({
      evidence: [
        ev({ evidenceId: "ls.quality", family: "DATA_QUALITY", candleState: null }),
        ev({
          evidenceId: "ls.structure",
          family: "MARKET_STRUCTURE",
          notes: "refId=SWING_L1;refType=SWING_LOW;confirmed=true",
        }),
        ev({
          evidenceId: "ls.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "excursion=BELOW;closeState=CLOSED",
        }),
      ],
    });
    expect(mifLiquiditySweepDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects FORMING reclaim candle", () => {
    const ctx = lsContext({
      evidence: [
        ev({ evidenceId: "ls.quality", family: "DATA_QUALITY", candleState: null }),
        ev({
          evidenceId: "ls.structure",
          family: "MARKET_STRUCTURE",
          notes: "refId=SWING_L1;refType=SWING_LOW;confirmed=true",
        }),
        ev({
          evidenceId: "ls.candle",
          family: "CANDLE_CONFIRMATION",
          candleState: "FORMING",
          notes: "excursion=BELOW;reclaim=true;closeState=FORMING;reject=UP",
        }),
      ],
    });
    expect(mifLiquiditySweepDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects arbitrary low without validated reference", () => {
    const ctx = lsContext({
      evidence: [
        ev({ evidenceId: "ls.quality", family: "DATA_QUALITY", candleState: null }),
        ev({
          evidenceId: "ls.structure",
          family: "MARKET_STRUCTURE",
          notes: "refId=SWING_L1;refType=SWING_LOW;confirmed=true;arbitrary=true",
        }),
        ev({
          evidenceId: "ls.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "excursion=BELOW;reclaim=true;closeState=CLOSED;reject=UP",
        }),
      ],
    });
    expect(mifLiquiditySweepDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects unconfirmed swing reference", () => {
    const ctx = lsContext({
      evidence: [
        ev({ evidenceId: "ls.quality", family: "DATA_QUALITY", candleState: null }),
        ev({
          evidenceId: "ls.structure",
          family: "MARKET_STRUCTURE",
          notes: "refId=SWING_L1;refType=SWING_LOW",
        }),
        ev({
          evidenceId: "ls.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "excursion=BELOW;reclaim=true;closeState=CLOSED;reject=UP",
        }),
      ],
    });
    expect(mifLiquiditySweepDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects missing reference identity", () => {
    const ctx = lsContext({
      evidence: [
        ev({ evidenceId: "ls.quality", family: "DATA_QUALITY", candleState: null }),
        ev({
          evidenceId: "ls.structure",
          family: "MARKET_STRUCTURE",
          notes: "refType=SWING_LOW;confirmed=true",
        }),
        ev({
          evidenceId: "ls.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "excursion=BELOW;reclaim=true;closeState=CLOSED;reject=UP",
        }),
      ],
    });
    expect(mifLiquiditySweepDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects stale reference", () => {
    const ctx = lsContext({
      evidence: [
        ev({ evidenceId: "ls.quality", family: "DATA_QUALITY", candleState: null }),
        ev({
          evidenceId: "ls.structure",
          family: "MARKET_STRUCTURE",
          candleState: "STALE",
          notes: "refId=SWING_L1;refType=SWING_LOW;confirmed=true",
        }),
        ev({
          evidenceId: "ls.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "excursion=BELOW;reclaim=true;closeState=CLOSED;reject=UP",
        }),
      ],
    });
    expect(mifLiquiditySweepDetector.evaluate(ctx).candidate).toBeNull();
  });
});

describe("Phase 5D Step8 — bearish liquidity sweep", () => {
  it("produces SELL on buy-side swing-high excursion + CLOSED reclaim", () => {
    const ctx = lsContext({
      evidence: [
        ev({ evidenceId: "ls.quality", family: "DATA_QUALITY", candleState: null }),
        ev({
          evidenceId: "ls.structure",
          family: "MARKET_STRUCTURE",
          notes: "refId=SWING_H1;refType=SWING_HIGH;refSide=BUY_SIDE;confirmed=true",
        }),
        ev({
          evidenceId: "ls.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "excursion=ABOVE;reclaim=true;closeState=CLOSED;reject=DOWN;accepted=false",
        }),
      ],
      evidenceSummary: baseSummary({ regimeDirection: "DOWN" }),
    });
    expect(mifLiquiditySweepDetector.evaluate(ctx).candidate?.direction).toBe("SELL");
  });

  it("rejects excursion without reclaim", () => {
    const ctx = lsContext({
      evidence: [
        ev({ evidenceId: "ls.quality", family: "DATA_QUALITY", candleState: null }),
        ev({
          evidenceId: "ls.structure",
          family: "MARKET_STRUCTURE",
          notes: "refId=SWING_H1;refType=SWING_HIGH;confirmed=true",
        }),
        ev({
          evidenceId: "ls.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "excursion=ABOVE;reclaim=pending;closeState=CLOSED",
        }),
      ],
    });
    expect(mifLiquiditySweepDetector.evaluate(ctx).candidate).toBeNull();
  });
});

describe("Phase 5D Step8 — sweep versus breakout", () => {
  it("rejects accepted-through as breakout continuation not sweep", () => {
    const ctx = lsContext({
      evidence: [
        ev({ evidenceId: "ls.quality", family: "DATA_QUALITY", candleState: null }),
        ev({
          evidenceId: "ls.structure",
          family: "MARKET_STRUCTURE",
          notes: "refId=SWING_L1;refType=SWING_LOW;confirmed=true",
        }),
        ev({
          evidenceId: "ls.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "excursion=BELOW;reclaim=false;closeState=CLOSED;accepted=true;sweepPhase=ACCEPTED",
        }),
      ],
    });
    expect(mifLiquiditySweepDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("preserves BREAKOUT regime conflict on reclaim candidate", () => {
    const ctx = lsContext({
      evidenceSummary: baseSummary({ regimeStructure: "BREAKOUT" }),
    });
    const r = mifLiquiditySweepDetector.evaluate(ctx);
    expect(r.candidate).toBeTruthy();
    expect(r.candidate!.status).toBe("NEEDS_CONFIRMATION");
    expect(r.warnings?.some((w) => /BREAKOUT/i.test(w))).toBe(true);
  });

  it("does not create candidate from generic POTENTIAL_REVERSAL without sweep", () => {
    const ctx = lsContext({
      evidence: [
        ev({ evidenceId: "ls.quality", family: "DATA_QUALITY", candleState: null }),
        ev({
          evidenceId: "ls.structure",
          family: "MARKET_STRUCTURE",
          notes: "refId=SWING_L1;refType=SWING_LOW;confirmed=true",
        }),
        ev({
          evidenceId: "ls.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "closeState=CLOSED",
        }),
        ev({
          evidenceId: "ls.mtf",
          family: "MULTI_TIMEFRAME_RELATIONSHIP",
          notes: "relation=POTENTIAL_REVERSAL",
        }),
      ],
    });
    expect(mifLiquiditySweepDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects failed sweep phase", () => {
    const ctx = lsContext({
      evidence: [
        ev({ evidenceId: "ls.quality", family: "DATA_QUALITY", candleState: null }),
        ev({
          evidenceId: "ls.structure",
          family: "MARKET_STRUCTURE",
          notes: "refId=SWING_L1;refType=SWING_LOW;confirmed=true",
        }),
        ev({
          evidenceId: "ls.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "excursion=BELOW;reclaim=true;closeState=CLOSED;sweepPhase=FAILED",
        }),
      ],
    });
    expect(mifLiquiditySweepDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("preserves conflicting MTF on confirmed reclaim", () => {
    const ctx = lsContext({
      evidence: [
        ev({ evidenceId: "ls.quality", family: "DATA_QUALITY", candleState: null }),
        ev({
          evidenceId: "ls.structure",
          family: "MARKET_STRUCTURE",
          notes: "refId=SWING_L1;refType=SWING_LOW;confirmed=true",
        }),
        ev({
          evidenceId: "ls.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "excursion=BELOW;reclaim=true;closeState=CLOSED;reject=UP",
        }),
        ev({
          evidenceId: "ls.mtf",
          family: "MULTI_TIMEFRAME_RELATIONSHIP",
          notes: "relation=CONFLICT",
        }),
      ],
    });
    const r = mifLiquiditySweepDetector.evaluate(ctx);
    expect(r.candidate).toBeTruthy();
    expect(r.candidate!.conflictingEvidenceIds.length).toBeGreaterThan(0);
    expect(r.candidate!.status).toBe("NEEDS_CONFIRMATION");
  });
});

describe("Phase 5D Step8 — eligibility and determinism", () => {
  it("rejects ACTIVE detector for DISABLED strategy", () => {
    const base = getDefaultMifStrategyIntelligenceRegistry().getStrategy("LIQUIDITY_SWEEP")!;
    const disabled: MifStrategyDefinition = { ...base, lifecycleStatus: "DISABLED" };
    const stratReg = createMifStrategyIntelligenceRegistry([
      ...MIF_STRATEGY_CATALOG.filter((s) => s.strategyId !== "LIQUIDITY_SWEEP"),
      disabled,
    ]);
    expect(() =>
      createMifOpportunityDetectorRegistry(
        [{ ...mifLiquiditySweepDetector, availabilityStatus: "ACTIVE" }],
        stratReg,
      ),
    ).toThrow(/lifecycle|activate/i);
  });

  it("is deterministic and does not mutate input", () => {
    const ctx = lsContext();
    const before = JSON.stringify(ctx.evidence);
    const a = mifLiquiditySweepDetector.evaluate(ctx);
    const b = mifLiquiditySweepDetector.evaluate(ctx);
    expect(a.candidate?.candidateId).toBe(b.candidate?.candidateId);
    expect(JSON.stringify(ctx.evidence)).toBe(before);
  });

  it("rejects blocked quality via orchestrator", () => {
    const result = runMifOpportunityDetection({
      context: lsContext({
        dataQualityStatus: "BLOCKED",
        evidenceSummary: { ...baseSummary(), dataQualityStatus: "BLOCKED" },
      }),
      detectors: [mifLiquiditySweepDetector],
      reportMissingDetectors: false,
    });
    expect(result.candidates).toHaveLength(0);
    expect(["BLOCKED_BY_DATA_QUALITY", "INELIGIBLE"]).toContain(result.outcomes[0]?.status);
  });

  it("rejects mixed instruments via orchestrator", () => {
    const result = runMifOpportunityDetection({
      context: lsContext({
        regime: { providerSymbol: "EURUSD" } as MifOpportunityDetectionContext["regime"],
      }),
      detectors: [mifLiquiditySweepDetector],
      reportMissingDetectors: false,
    });
    expect(result.outcomes[0]?.status).toBe("INVALID_CONTEXT");
  });

  it("runs eligible LIQUIDITY_SWEEP through orchestrator", () => {
    const result = runMifOpportunityDetection({
      context: lsContext(),
      detectors: [mifLiquiditySweepDetector],
      reportMissingDetectors: false,
    });
    expect(result.outcomes[0]?.status).toBe("CANDIDATE_PRODUCED");
    expect(result.candidates[0]?.strategyId).toBe("LIQUIDITY_SWEEP");
    expect(result.acceptsForExecution).toBe(false);
  });

  it("rejects invalid temporal order when represented", () => {
    const ctx = lsContext({
      evidence: [
        ev({ evidenceId: "ls.quality", family: "DATA_QUALITY", candleState: null }),
        ev({
          evidenceId: "ls.structure",
          family: "MARKET_STRUCTURE",
          notes: "refId=SWING_L1;refType=SWING_LOW;confirmed=true;temporalOrder=AFTER_SWEEP",
        }),
        ev({
          evidenceId: "ls.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "excursion=BELOW;reclaim=true;closeState=CLOSED;reject=UP",
        }),
      ],
    });
    expect(mifLiquiditySweepDetector.evaluate(ctx).candidate).toBeNull();
  });
});
