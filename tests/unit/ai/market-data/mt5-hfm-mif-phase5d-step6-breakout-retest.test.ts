/**
 * Phase 5D Step 6 — Breakout Retest Detector.
 */
import { describe, it, expect } from "vitest";
import {
  MIF_PROVIDER_ID,
  MIF_BREAKOUT_RETEST_DETECTOR_ID,
  createMifOpportunityDetectorRegistry,
  createMifStrategyIntelligenceRegistry,
  getDefaultMifStrategyIntelligenceRegistry,
  mifBreakoutRetestDetector,
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
        evidenceId: "brt.prior_breakout",
        family: "MARKET_REGIME" as const,
        presence: "PRESENT" as const,
        qualityStatus: "VALID" as const,
        closedCandleSatisfied: true,
        sourceAssessmentId: "brt.prior.src",
        sourceContractId: "kwizera.mif.market-regime.v1",
      },
      {
        evidenceId: "brt.boundary",
        family: "SUPPORT_RESISTANCE" as const,
        presence: "PRESENT" as const,
        qualityStatus: "VALID" as const,
        closedCandleSatisfied: true,
        sourceAssessmentId: null,
        sourceContractId: null,
      },
      {
        evidenceId: "brt.candle",
        family: "CANDLE_CONFIRMATION" as const,
        presence: "PRESENT" as const,
        qualityStatus: "VALID" as const,
        closedCandleSatisfied: true,
        sourceAssessmentId: null,
        sourceContractId: null,
      },
      {
        evidenceId: "brt.quality",
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

function brtContext(over: Partial<MifOpportunityDetectionContext> = {}): MifOpportunityDetectionContext {
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
      ev({
        evidenceId: "brt.prior_breakout",
        family: "MARKET_REGIME",
        timeframe: "H1",
        notes: "breakoutState=CONFIRMED;breakoutDirection=UP;boundaryId=ZONE_R1;boundaryKind=RESISTANCE",
      }),
      ev({
        evidenceId: "brt.boundary",
        family: "SUPPORT_RESISTANCE",
        notes: "boundaryId=ZONE_R1;boundaryKind=RESISTANCE;boundaryQuality=VALID;retestPhase=HOLDING",
      }),
      ev({
        evidenceId: "brt.candle",
        family: "CANDLE_CONFIRMATION",
        notes: "retestResult=REJECT_UP;closeState=CLOSED;accepted=true;side=ABOVE",
      }),
      ev({ evidenceId: "brt.quality", family: "DATA_QUALITY", candleState: null }),
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

describe("Phase 5D Step6 — bullish breakout retest", () => {
  it("produces bullish candidate on prior breakout + CLOSED rejection at same resistance", () => {
    const r = mifBreakoutRetestDetector.evaluate(brtContext());
    expect(r.candidate).toBeTruthy();
    expect(r.candidate!.direction).toBe("BUY");
    expect(r.candidate!.strategyId).toBe("BREAKOUT_RETEST");
    expect(r.candidate!.detectorId).toBe(MIF_BREAKOUT_RETEST_DETECTOR_ID);
    expect(r.candidate!.acceptsForExecution).toBe(false);
  });

  it("accepts HOLD acceptance above former resistance", () => {
    const ctx = brtContext({
      evidence: [
        ev({
          evidenceId: "brt.prior_breakout",
          family: "MARKET_REGIME",
          notes: "breakoutState=CONFIRMED;breakoutDirection=UP;boundaryId=ZONE_R1;boundaryKind=RESISTANCE",
        }),
        ev({
          evidenceId: "brt.boundary",
          family: "SUPPORT_RESISTANCE",
          notes: "boundaryId=ZONE_R1;boundaryKind=RESISTANCE;boundaryQuality=VALID;retestPhase=HOLDING",
        }),
        ev({
          evidenceId: "brt.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "retestResult=HOLD;closeState=CLOSED;accepted=true;side=ABOVE",
        }),
        ev({ evidenceId: "brt.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifBreakoutRetestDetector.evaluate(ctx).candidate?.direction).toBe("BUY");
  });

  it("preserves supportive MTF and structure evidence", () => {
    const ctx = brtContext({
      evidence: [
        ev({
          evidenceId: "brt.prior_breakout",
          family: "MARKET_REGIME",
          notes: "breakoutState=CONFIRMED;breakoutDirection=UP;boundaryId=ZONE_R1;boundaryKind=RESISTANCE",
        }),
        ev({
          evidenceId: "brt.boundary",
          family: "SUPPORT_RESISTANCE",
          notes: "boundaryId=ZONE_R1;boundaryKind=RESISTANCE;boundaryQuality=VALID",
        }),
        ev({
          evidenceId: "brt.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "retestResult=REJECT_UP;closeState=CLOSED;accepted=true",
        }),
        ev({ evidenceId: "brt.quality", family: "DATA_QUALITY", candleState: null }),
        ev({
          evidenceId: "brt.mtf",
          family: "MULTI_TIMEFRAME_RELATIONSHIP",
          notes: "relation=ALIGNMENT",
        }),
        ev({
          evidenceId: "brt.structure",
          family: "MARKET_STRUCTURE",
          notes: "break=BOS;bias=BULLISH",
        }),
      ],
    });
    const r = mifBreakoutRetestDetector.evaluate(ctx);
    expect(r.candidate).toBeTruthy();
    expect(r.candidate!.supportingEvidenceIds).toContain("brt.mtf");
    expect(r.candidate!.supportingEvidenceIds).toContain("brt.structure");
  });

  it("rejects retest without prior breakout", () => {
    const ctx = brtContext({
      evidence: [
        ev({
          evidenceId: "brt.boundary",
          family: "SUPPORT_RESISTANCE",
          notes: "boundaryId=ZONE_R1;boundaryKind=RESISTANCE;boundaryQuality=VALID",
        }),
        ev({
          evidenceId: "brt.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "retestResult=REJECT_UP;closeState=CLOSED;accepted=true",
        }),
        ev({ evidenceId: "brt.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifBreakoutRetestDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects retest of a different boundaryId", () => {
    const ctx = brtContext({
      evidence: [
        ev({
          evidenceId: "brt.prior_breakout",
          family: "MARKET_REGIME",
          notes: "breakoutState=CONFIRMED;breakoutDirection=UP;boundaryId=ZONE_R1;boundaryKind=RESISTANCE",
        }),
        ev({
          evidenceId: "brt.boundary",
          family: "SUPPORT_RESISTANCE",
          notes: "boundaryId=ZONE_OTHER;boundaryKind=RESISTANCE;boundaryQuality=VALID",
        }),
        ev({
          evidenceId: "brt.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "retestResult=REJECT_UP;closeState=CLOSED;accepted=true",
        }),
        ev({ evidenceId: "brt.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifBreakoutRetestDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects missing prior boundary identity", () => {
    const ctx = brtContext({
      evidence: [
        ev({
          evidenceId: "brt.prior_breakout",
          family: "MARKET_REGIME",
          notes: "breakoutState=CONFIRMED;breakoutDirection=UP;boundaryKind=RESISTANCE",
        }),
        ev({
          evidenceId: "brt.boundary",
          family: "SUPPORT_RESISTANCE",
          notes: "boundaryId=ZONE_R1;boundaryKind=RESISTANCE;boundaryQuality=VALID",
        }),
        ev({
          evidenceId: "brt.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "retestResult=REJECT_UP;closeState=CLOSED;accepted=true",
        }),
        ev({ evidenceId: "brt.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifBreakoutRetestDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects invalidated prior breakout", () => {
    const ctx = brtContext({
      evidence: [
        ev({
          evidenceId: "brt.prior_breakout",
          family: "MARKET_REGIME",
          notes:
            "breakoutState=INVALIDATED;breakoutDirection=UP;boundaryId=ZONE_R1;boundaryKind=RESISTANCE",
        }),
        ev({
          evidenceId: "brt.boundary",
          family: "SUPPORT_RESISTANCE",
          notes: "boundaryId=ZONE_R1;boundaryKind=RESISTANCE;boundaryQuality=VALID",
        }),
        ev({
          evidenceId: "brt.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "retestResult=REJECT_UP;closeState=CLOSED;accepted=true",
        }),
        ev({ evidenceId: "brt.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifBreakoutRetestDetector.evaluate(ctx).candidate).toBeNull();
  });
});

describe("Phase 5D Step6 — bearish breakout retest", () => {
  it("produces bearish candidate on prior breakout + CLOSED rejection at same support", () => {
    const ctx = brtContext({
      evidence: [
        ev({
          evidenceId: "brt.prior_breakout",
          family: "MARKET_REGIME",
          notes: "breakoutState=CONFIRMED;breakoutDirection=DOWN;boundaryId=ZONE_S1;boundaryKind=SUPPORT",
        }),
        ev({
          evidenceId: "brt.boundary",
          family: "SUPPORT_RESISTANCE",
          notes: "boundaryId=ZONE_S1;boundaryKind=SUPPORT;boundaryQuality=VALID;retestPhase=HOLDING",
        }),
        ev({
          evidenceId: "brt.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "retestResult=REJECT_DOWN;closeState=CLOSED;accepted=true;side=BELOW",
        }),
        ev({ evidenceId: "brt.quality", family: "DATA_QUALITY", candleState: null }),
      ],
      evidenceSummary: baseSummary({ regimeDirection: "DOWN", regimeStructure: "BREAKOUT" }),
    });
    const r = mifBreakoutRetestDetector.evaluate(ctx);
    expect(r.candidate?.direction).toBe("SELL");
  });

  it("accepts HOLD below former support", () => {
    const ctx = brtContext({
      evidence: [
        ev({
          evidenceId: "brt.prior_breakout",
          family: "MARKET_REGIME",
          notes: "breakoutState=CONFIRMED;breakoutDirection=DOWN;boundaryId=ZONE_S1;boundaryKind=SUPPORT",
        }),
        ev({
          evidenceId: "brt.boundary",
          family: "SUPPORT_RESISTANCE",
          notes: "boundaryId=ZONE_S1;boundaryKind=SUPPORT;boundaryQuality=VALID",
        }),
        ev({
          evidenceId: "brt.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "retestResult=HOLD;closeState=CLOSED;accepted=true;side=BELOW",
        }),
        ev({ evidenceId: "brt.quality", family: "DATA_QUALITY", candleState: null }),
      ],
      evidenceSummary: baseSummary({ regimeDirection: "DOWN" }),
    });
    expect(mifBreakoutRetestDetector.evaluate(ctx).candidate?.direction).toBe("SELL");
  });

  it("rejects no prior bearish breakout", () => {
    const ctx = brtContext({
      evidence: [
        ev({
          evidenceId: "brt.boundary",
          family: "SUPPORT_RESISTANCE",
          notes: "boundaryId=ZONE_S1;boundaryKind=SUPPORT;boundaryQuality=VALID",
        }),
        ev({
          evidenceId: "brt.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "retestResult=REJECT_DOWN;closeState=CLOSED;accepted=true",
        }),
        ev({ evidenceId: "brt.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifBreakoutRetestDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects different support boundary identity", () => {
    const ctx = brtContext({
      evidence: [
        ev({
          evidenceId: "brt.prior_breakout",
          family: "MARKET_REGIME",
          notes: "breakoutState=CONFIRMED;breakoutDirection=DOWN;boundaryId=ZONE_S1;boundaryKind=SUPPORT",
        }),
        ev({
          evidenceId: "brt.boundary",
          family: "SUPPORT_RESISTANCE",
          notes: "boundaryId=ZONE_S9;boundaryKind=SUPPORT;boundaryQuality=VALID",
        }),
        ev({
          evidenceId: "brt.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "retestResult=REJECT_DOWN;closeState=CLOSED;accepted=true",
        }),
        ev({ evidenceId: "brt.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifBreakoutRetestDetector.evaluate(ctx).candidate).toBeNull();
  });
});

describe("Phase 5D Step6 — retest failure and lifecycle", () => {
  it("rejects touch without confirmation", () => {
    const ctx = brtContext({
      evidence: [
        ev({
          evidenceId: "brt.prior_breakout",
          family: "MARKET_REGIME",
          notes: "breakoutState=CONFIRMED;breakoutDirection=UP;boundaryId=ZONE_R1;boundaryKind=RESISTANCE",
        }),
        ev({
          evidenceId: "brt.boundary",
          family: "SUPPORT_RESISTANCE",
          notes: "boundaryId=ZONE_R1;boundaryKind=RESISTANCE;boundaryQuality=VALID;retestPhase=APPROACHING",
        }),
        ev({
          evidenceId: "brt.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "retestResult=TOUCH;closeState=CLOSED",
        }),
        ev({ evidenceId: "brt.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifBreakoutRetestDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects FORMING candle at boundary", () => {
    const ctx = brtContext({
      evidence: [
        ev({
          evidenceId: "brt.prior_breakout",
          family: "MARKET_REGIME",
          notes: "breakoutState=CONFIRMED;breakoutDirection=UP;boundaryId=ZONE_R1;boundaryKind=RESISTANCE",
        }),
        ev({
          evidenceId: "brt.boundary",
          family: "SUPPORT_RESISTANCE",
          notes: "boundaryId=ZONE_R1;boundaryKind=RESISTANCE;boundaryQuality=VALID",
        }),
        ev({
          evidenceId: "brt.candle",
          family: "CANDLE_CONFIRMATION",
          candleState: "FORMING",
          notes: "retestResult=REJECT_UP;closeState=FORMING;accepted=true",
        }),
        ev({ evidenceId: "brt.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifBreakoutRetestDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects failed reclaim through boundary", () => {
    const ctx = brtContext({
      evidence: [
        ev({
          evidenceId: "brt.prior_breakout",
          family: "MARKET_REGIME",
          notes: "breakoutState=CONFIRMED;breakoutDirection=UP;boundaryId=ZONE_R1;boundaryKind=RESISTANCE",
        }),
        ev({
          evidenceId: "brt.boundary",
          family: "SUPPORT_RESISTANCE",
          notes: "boundaryId=ZONE_R1;boundaryKind=RESISTANCE;boundaryQuality=VALID;retestPhase=RECLAIMED",
        }),
        ev({
          evidenceId: "brt.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "retestResult=RECLAIM;closeState=CLOSED;accepted=false",
        }),
        ev({ evidenceId: "brt.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifBreakoutRetestDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects FAILED prior breakout state", () => {
    const ctx = brtContext({
      evidence: [
        ev({
          evidenceId: "brt.prior_breakout",
          family: "MARKET_REGIME",
          notes: "breakoutState=FAILED;breakoutDirection=UP;boundaryId=ZONE_R1;boundaryKind=RESISTANCE",
        }),
        ev({
          evidenceId: "brt.boundary",
          family: "SUPPORT_RESISTANCE",
          notes: "boundaryId=ZONE_R1;boundaryKind=RESISTANCE;boundaryQuality=VALID",
        }),
        ev({
          evidenceId: "brt.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "retestResult=REJECT_UP;closeState=CLOSED;accepted=true",
        }),
        ev({ evidenceId: "brt.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifBreakoutRetestDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("preserves conflicting MTF evidence on candidate", () => {
    const ctx = brtContext({
      evidence: [
        ev({
          evidenceId: "brt.prior_breakout",
          family: "MARKET_REGIME",
          notes: "breakoutState=CONFIRMED;breakoutDirection=UP;boundaryId=ZONE_R1;boundaryKind=RESISTANCE",
        }),
        ev({
          evidenceId: "brt.boundary",
          family: "SUPPORT_RESISTANCE",
          notes: "boundaryId=ZONE_R1;boundaryKind=RESISTANCE;boundaryQuality=VALID",
        }),
        ev({
          evidenceId: "brt.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "retestResult=REJECT_UP;closeState=CLOSED;accepted=true",
        }),
        ev({ evidenceId: "brt.quality", family: "DATA_QUALITY", candleState: null }),
        ev({
          evidenceId: "brt.mtf",
          family: "MULTI_TIMEFRAME_RELATIONSHIP",
          notes: "relation=CONFLICT",
        }),
      ],
    });
    const r = mifBreakoutRetestDetector.evaluate(ctx);
    expect(r.candidate).toBeTruthy();
    expect(r.candidate!.conflictingEvidenceIds.length).toBeGreaterThan(0);
    expect(r.candidate!.status).toBe("NEEDS_CONFIRMATION");
  });

  it("rejects unconfirmed POTENTIAL prior breakout", () => {
    const ctx = brtContext({
      evidence: [
        ev({
          evidenceId: "brt.prior_breakout",
          family: "MARKET_REGIME",
          notes: "breakoutState=POTENTIAL;breakoutDirection=UP;boundaryId=ZONE_R1;boundaryKind=RESISTANCE",
        }),
        ev({
          evidenceId: "brt.boundary",
          family: "SUPPORT_RESISTANCE",
          notes: "boundaryId=ZONE_R1;boundaryKind=RESISTANCE;boundaryQuality=VALID",
        }),
        ev({
          evidenceId: "brt.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "retestResult=REJECT_UP;closeState=CLOSED;accepted=true",
        }),
        ev({ evidenceId: "brt.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifBreakoutRetestDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects stale prior breakout evidence", () => {
    const ctx = brtContext({
      evidence: [
        ev({
          evidenceId: "brt.prior_breakout",
          family: "MARKET_REGIME",
          candleState: "STALE",
          notes: "breakoutState=CONFIRMED;breakoutDirection=UP;boundaryId=ZONE_R1;boundaryKind=RESISTANCE",
        }),
        ev({
          evidenceId: "brt.boundary",
          family: "SUPPORT_RESISTANCE",
          notes: "boundaryId=ZONE_R1;boundaryKind=RESISTANCE;boundaryQuality=VALID",
        }),
        ev({
          evidenceId: "brt.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "retestResult=REJECT_UP;closeState=CLOSED;accepted=true",
        }),
        ev({ evidenceId: "brt.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifBreakoutRetestDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects missing retest candle evidence", () => {
    const ctx = brtContext({
      evidence: [
        ev({
          evidenceId: "brt.prior_breakout",
          family: "MARKET_REGIME",
          notes: "breakoutState=CONFIRMED;breakoutDirection=UP;boundaryId=ZONE_R1;boundaryKind=RESISTANCE",
        }),
        ev({
          evidenceId: "brt.boundary",
          family: "SUPPORT_RESISTANCE",
          notes: "boundaryId=ZONE_R1;boundaryKind=RESISTANCE;boundaryQuality=VALID",
        }),
        ev({ evidenceId: "brt.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifBreakoutRetestDetector.evaluate(ctx).candidate).toBeNull();
  });
});

describe("Phase 5D Step6 — eligibility and determinism", () => {
  it("rejects ACTIVE detector for DISABLED strategy", () => {
    const base = getDefaultMifStrategyIntelligenceRegistry().getStrategy("BREAKOUT_RETEST")!;
    const disabled: MifStrategyDefinition = { ...base, lifecycleStatus: "DISABLED" };
    const stratReg = createMifStrategyIntelligenceRegistry([
      ...MIF_STRATEGY_CATALOG.filter((s) => s.strategyId !== "BREAKOUT_RETEST"),
      disabled,
    ]);
    expect(() =>
      createMifOpportunityDetectorRegistry(
        [{ ...mifBreakoutRetestDetector, availabilityStatus: "ACTIVE" }],
        stratReg,
      ),
    ).toThrow(/lifecycle|activate/i);
  });

  it("is deterministic and does not mutate input", () => {
    const ctx = brtContext();
    const before = JSON.stringify(ctx.evidence);
    const a = mifBreakoutRetestDetector.evaluate(ctx);
    const b = mifBreakoutRetestDetector.evaluate(ctx);
    expect(a.candidate?.candidateId).toBe(b.candidate?.candidateId);
    expect(JSON.stringify(ctx.evidence)).toBe(before);
  });

  it("rejects blocked quality via orchestrator", () => {
    const ctx = brtContext({
      dataQualityStatus: "BLOCKED",
      evidenceSummary: { ...baseSummary(), dataQualityStatus: "BLOCKED" },
    });
    const result = runMifOpportunityDetection({
      context: ctx,
      detectors: [mifBreakoutRetestDetector],
      reportMissingDetectors: false,
    });
    expect(result.candidates).toHaveLength(0);
    expect(["BLOCKED_BY_DATA_QUALITY", "INELIGIBLE"]).toContain(result.outcomes[0]?.status);
  });

  it("rejects mixed instruments via orchestrator", () => {
    const result = runMifOpportunityDetection({
      context: brtContext({
        regime: { providerSymbol: "EURUSD" } as MifOpportunityDetectionContext["regime"],
      }),
      detectors: [mifBreakoutRetestDetector],
      reportMissingDetectors: false,
    });
    expect(result.outcomes[0]?.status).toBe("INVALID_CONTEXT");
  });

  it("runs eligible BREAKOUT_RETEST through orchestrator", () => {
    const result = runMifOpportunityDetection({
      context: brtContext(),
      detectors: [mifBreakoutRetestDetector],
      reportMissingDetectors: false,
    });
    expect(result.outcomes[0]?.status).toBe("CANDIDATE_PRODUCED");
    expect(result.candidates[0]?.strategyId).toBe("BREAKOUT_RETEST");
    expect(result.acceptsForExecution).toBe(false);
  });
});
