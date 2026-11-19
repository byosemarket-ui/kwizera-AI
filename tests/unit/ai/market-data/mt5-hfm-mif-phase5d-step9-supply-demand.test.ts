/**
 * Phase 5D Step 9 — Supply/Demand Opportunity Detector.
 */
import { describe, it, expect } from "vitest";
import {
  MIF_PROVIDER_ID,
  MIF_SUPPLY_DEMAND_DETECTOR_ID,
  createMifOpportunityDetectorRegistry,
  createMifStrategyIntelligenceRegistry,
  getDefaultMifStrategyIntelligenceRegistry,
  mifSupplyDemandDetector,
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
      "SETUP_DEVELOPMENT" as const,
    ],
    evidence: [
      {
        evidenceId: "sd.structure",
        family: "MARKET_STRUCTURE" as const,
        presence: "PRESENT" as const,
        qualityStatus: "VALID" as const,
        closedCandleSatisfied: true,
        sourceAssessmentId: null,
        sourceContractId: null,
      },
      {
        evidenceId: "sd.displacement",
        family: "PRICE_DISPLACEMENT" as const,
        presence: "PRESENT" as const,
        qualityStatus: "VALID" as const,
        closedCandleSatisfied: true,
        sourceAssessmentId: null,
        sourceContractId: null,
      },
      {
        evidenceId: "sd.quality",
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

function sdContext(over: Partial<MifOpportunityDetectionContext> = {}): MifOpportunityDetectionContext {
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
      ev({
        evidenceId: "sd.structure",
        family: "MARKET_STRUCTURE",
        notes:
          "zoneId=ZONE_D1;zoneKind=DEMAND;zoneState=FRESH;interaction=REACTION_CONFIRMED;lowerId=ZL;upperId=ZU;orderValid=true",
      }),
      ev({
        evidenceId: "sd.displacement",
        family: "PRICE_DISPLACEMENT",
        notes: "origin=IMPULSE;direction=UP;quality=VALID",
      }),
      ev({
        evidenceId: "sd.candle",
        family: "CANDLE_CONFIRMATION",
        timeframe: "M15",
        timeframeRole: "SETUP_DEVELOPMENT",
        notes: "react=UP;closeState=CLOSED;accepted=false;interaction=REACTION_CONFIRMED",
      }),
      ev({ evidenceId: "sd.quality", family: "DATA_QUALITY", candleState: null }),
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

describe("Phase 5D Step9 — demand and supply reactions", () => {
  it("produces BUY on valid demand-zone CLOSED bullish reaction", () => {
    const r = mifSupplyDemandDetector.evaluate(sdContext());
    expect(r.candidate).toBeTruthy();
    expect(r.candidate!.direction).toBe("BUY");
    expect(r.candidate!.strategyId).toBe("SUPPLY_DEMAND");
    expect(r.candidate!.detectorId).toBe(MIF_SUPPLY_DEMAND_DETECTOR_ID);
    expect(r.candidate!.acceptsForExecution).toBe(false);
  });

  it("produces SELL on valid supply-zone CLOSED bearish reaction", () => {
    const ctx = sdContext({
      evidence: [
        ev({
          evidenceId: "sd.structure",
          family: "MARKET_STRUCTURE",
          notes:
            "zoneId=ZONE_S1;zoneKind=SUPPLY;zoneState=FRESH;interaction=REACTION_CONFIRMED;lowerId=ZL;upperId=ZU;orderValid=true",
        }),
        ev({
          evidenceId: "sd.displacement",
          family: "PRICE_DISPLACEMENT",
          notes: "origin=IMPULSE;direction=DOWN;quality=VALID",
        }),
        ev({
          evidenceId: "sd.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "react=DOWN;closeState=CLOSED;accepted=false",
        }),
        ev({ evidenceId: "sd.quality", family: "DATA_QUALITY", candleState: null }),
      ],
      evidenceSummary: baseSummary({ regimeDirection: "DOWN" }),
    });
    expect(mifSupplyDemandDetector.evaluate(ctx).candidate?.direction).toBe("SELL");
  });

  it("rejects demand zone alone without reaction candle", () => {
    const ctx = sdContext({
      evidence: [
        ev({
          evidenceId: "sd.structure",
          family: "MARKET_STRUCTURE",
          notes:
            "zoneId=ZONE_D1;zoneKind=DEMAND;zoneState=FRESH;lowerId=ZL;upperId=ZU;orderValid=true",
        }),
        ev({
          evidenceId: "sd.displacement",
          family: "PRICE_DISPLACEMENT",
          notes: "origin=IMPULSE;direction=UP",
        }),
        ev({ evidenceId: "sd.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifSupplyDemandDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects supply zone alone without reaction candle", () => {
    const ctx = sdContext({
      evidence: [
        ev({
          evidenceId: "sd.structure",
          family: "MARKET_STRUCTURE",
          notes:
            "zoneId=ZONE_S1;zoneKind=SUPPLY;zoneState=VALID;lowerId=ZL;upperId=ZU;orderValid=true",
        }),
        ev({
          evidenceId: "sd.displacement",
          family: "PRICE_DISPLACEMENT",
          notes: "origin=DISPLACEMENT;direction=DOWN",
        }),
        ev({ evidenceId: "sd.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifSupplyDemandDetector.evaluate(ctx).candidate).toBeNull();
  });
});

describe("Phase 5D Step9 — zone identity and boundaries", () => {
  it("rejects missing zone identity", () => {
    const ctx = sdContext({
      evidence: [
        ev({
          evidenceId: "sd.structure",
          family: "MARKET_STRUCTURE",
          notes: "zoneKind=DEMAND;lowerId=ZL;upperId=ZU;orderValid=true",
        }),
        ev({
          evidenceId: "sd.displacement",
          family: "PRICE_DISPLACEMENT",
          notes: "origin=IMPULSE;direction=UP",
        }),
        ev({
          evidenceId: "sd.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "react=UP;closeState=CLOSED",
        }),
        ev({ evidenceId: "sd.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifSupplyDemandDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects missing boundaries", () => {
    const ctx = sdContext({
      evidence: [
        ev({
          evidenceId: "sd.structure",
          family: "MARKET_STRUCTURE",
          notes: "zoneId=ZONE_D1;zoneKind=DEMAND;orderValid=true",
        }),
        ev({
          evidenceId: "sd.displacement",
          family: "PRICE_DISPLACEMENT",
          notes: "origin=IMPULSE;direction=UP",
        }),
        ev({
          evidenceId: "sd.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "react=UP;closeState=CLOSED",
        }),
        ev({ evidenceId: "sd.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifSupplyDemandDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects invalid boundary ordering", () => {
    const ctx = sdContext({
      evidence: [
        ev({
          evidenceId: "sd.structure",
          family: "MARKET_STRUCTURE",
          notes:
            "zoneId=ZONE_D1;zoneKind=DEMAND;lowerId=ZL;upperId=ZU;orderValid=false",
        }),
        ev({
          evidenceId: "sd.displacement",
          family: "PRICE_DISPLACEMENT",
          notes: "origin=IMPULSE;direction=UP",
        }),
        ev({
          evidenceId: "sd.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "react=UP;closeState=CLOSED",
        }),
        ev({ evidenceId: "sd.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifSupplyDemandDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects arbitrary zone", () => {
    const ctx = sdContext({
      evidence: [
        ev({
          evidenceId: "sd.structure",
          family: "MARKET_STRUCTURE",
          notes:
            "zoneId=ZONE_D1;zoneKind=DEMAND;lowerId=ZL;upperId=ZU;orderValid=true;arbitrary=true",
        }),
        ev({
          evidenceId: "sd.displacement",
          family: "PRICE_DISPLACEMENT",
          notes: "origin=IMPULSE;direction=UP",
        }),
        ev({
          evidenceId: "sd.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "react=UP;closeState=CLOSED",
        }),
        ev({ evidenceId: "sd.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifSupplyDemandDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects Fibonacci-only zone", () => {
    const ctx = sdContext({
      evidence: [
        ev({
          evidenceId: "sd.structure",
          family: "MARKET_STRUCTURE",
          notes:
            "zoneId=ZONE_D1;zoneKind=DEMAND;lowerId=ZL;upperId=ZU;orderValid=true;source=FIBONACCI",
        }),
        ev({
          evidenceId: "sd.displacement",
          family: "PRICE_DISPLACEMENT",
          notes: "origin=IMPULSE;direction=UP",
        }),
        ev({
          evidenceId: "sd.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "react=UP;closeState=CLOSED",
        }),
        ev({ evidenceId: "sd.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifSupplyDemandDetector.evaluate(ctx).candidate).toBeNull();
  });
});

describe("Phase 5D Step9 — lifecycle and confirmation", () => {
  it("rejects mitigated zone", () => {
    const ctx = sdContext({
      evidence: [
        ev({
          evidenceId: "sd.structure",
          family: "MARKET_STRUCTURE",
          notes:
            "zoneId=ZONE_D1;zoneKind=DEMAND;zoneState=MITIGATED;lowerId=ZL;upperId=ZU;orderValid=true",
        }),
        ev({
          evidenceId: "sd.displacement",
          family: "PRICE_DISPLACEMENT",
          notes: "origin=IMPULSE;direction=UP",
        }),
        ev({
          evidenceId: "sd.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "react=UP;closeState=CLOSED",
        }),
        ev({ evidenceId: "sd.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifSupplyDemandDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects invalidated zone", () => {
    const ctx = sdContext({
      evidence: [
        ev({
          evidenceId: "sd.structure",
          family: "MARKET_STRUCTURE",
          notes:
            "zoneId=ZONE_D1;zoneKind=DEMAND;zoneState=INVALIDATED;lowerId=ZL;upperId=ZU;orderValid=true",
        }),
        ev({
          evidenceId: "sd.displacement",
          family: "PRICE_DISPLACEMENT",
          notes: "origin=IMPULSE;direction=UP",
        }),
        ev({
          evidenceId: "sd.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "react=UP;closeState=CLOSED",
        }),
        ev({ evidenceId: "sd.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifSupplyDemandDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects approaching without touch", () => {
    const ctx = sdContext({
      evidence: [
        ev({
          evidenceId: "sd.structure",
          family: "MARKET_STRUCTURE",
          notes:
            "zoneId=ZONE_D1;zoneKind=DEMAND;interaction=APPROACHING;lowerId=ZL;upperId=ZU;orderValid=true",
        }),
        ev({
          evidenceId: "sd.displacement",
          family: "PRICE_DISPLACEMENT",
          notes: "origin=IMPULSE;direction=UP",
        }),
        ev({
          evidenceId: "sd.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "closeState=CLOSED;interaction=APPROACHING",
        }),
        ev({ evidenceId: "sd.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifSupplyDemandDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects touch without confirmation", () => {
    const ctx = sdContext({
      evidence: [
        ev({
          evidenceId: "sd.structure",
          family: "MARKET_STRUCTURE",
          notes:
            "zoneId=ZONE_D1;zoneKind=DEMAND;interaction=TOUCHED;lowerId=ZL;upperId=ZU;orderValid=true",
        }),
        ev({
          evidenceId: "sd.displacement",
          family: "PRICE_DISPLACEMENT",
          notes: "origin=IMPULSE;direction=UP",
        }),
        ev({
          evidenceId: "sd.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "closeState=CLOSED;interaction=TOUCHED",
        }),
        ev({ evidenceId: "sd.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifSupplyDemandDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects FORMING candle confirmation", () => {
    const ctx = sdContext({
      evidence: [
        ev({
          evidenceId: "sd.structure",
          family: "MARKET_STRUCTURE",
          notes:
            "zoneId=ZONE_D1;zoneKind=DEMAND;lowerId=ZL;upperId=ZU;orderValid=true",
        }),
        ev({
          evidenceId: "sd.displacement",
          family: "PRICE_DISPLACEMENT",
          notes: "origin=IMPULSE;direction=UP",
        }),
        ev({
          evidenceId: "sd.candle",
          family: "CANDLE_CONFIRMATION",
          candleState: "FORMING",
          notes: "react=UP;closeState=FORMING",
        }),
        ev({ evidenceId: "sd.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifSupplyDemandDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects acceptance through demand zone", () => {
    const ctx = sdContext({
      evidence: [
        ev({
          evidenceId: "sd.structure",
          family: "MARKET_STRUCTURE",
          notes:
            "zoneId=ZONE_D1;zoneKind=DEMAND;lowerId=ZL;upperId=ZU;orderValid=true",
        }),
        ev({
          evidenceId: "sd.displacement",
          family: "PRICE_DISPLACEMENT",
          notes: "origin=IMPULSE;direction=UP",
        }),
        ev({
          evidenceId: "sd.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "react=UP;closeState=CLOSED;accepted=true",
        }),
        ev({ evidenceId: "sd.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifSupplyDemandDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects acceptance through supply zone", () => {
    const ctx = sdContext({
      evidence: [
        ev({
          evidenceId: "sd.structure",
          family: "MARKET_STRUCTURE",
          notes:
            "zoneId=ZONE_S1;zoneKind=SUPPLY;lowerId=ZL;upperId=ZU;orderValid=true",
        }),
        ev({
          evidenceId: "sd.displacement",
          family: "PRICE_DISPLACEMENT",
          notes: "origin=IMPULSE;direction=DOWN",
        }),
        ev({
          evidenceId: "sd.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "react=DOWN;closeState=CLOSED;accepted=true",
        }),
        ev({ evidenceId: "sd.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifSupplyDemandDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("preserves BREAKOUT conflict as NEEDS_CONFIRMATION", () => {
    const ctx = sdContext({
      evidenceSummary: baseSummary({ regimeStructure: "BREAKOUT" }),
    });
    const r = mifSupplyDemandDetector.evaluate(ctx);
    expect(r.candidate).toBeTruthy();
    expect(r.candidate!.status).toBe("NEEDS_CONFIRMATION");
    expect(r.warnings?.some((w) => /BREAKOUT/i.test(w))).toBe(true);
  });

  it("preserves MTF CONFLICT", () => {
    const ctx = sdContext({
      evidence: [
        ev({
          evidenceId: "sd.structure",
          family: "MARKET_STRUCTURE",
          notes:
            "zoneId=ZONE_D1;zoneKind=DEMAND;lowerId=ZL;upperId=ZU;orderValid=true;interaction=REACTION_CONFIRMED",
        }),
        ev({
          evidenceId: "sd.displacement",
          family: "PRICE_DISPLACEMENT",
          notes: "origin=IMPULSE;direction=UP",
        }),
        ev({
          evidenceId: "sd.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "react=UP;closeState=CLOSED;accepted=false",
        }),
        ev({ evidenceId: "sd.quality", family: "DATA_QUALITY", candleState: null }),
        ev({
          evidenceId: "sd.mtf",
          family: "MULTI_TIMEFRAME_RELATIONSHIP",
          notes: "relation=CONFLICT",
        }),
      ],
    });
    const r = mifSupplyDemandDetector.evaluate(ctx);
    expect(r.candidate).toBeTruthy();
    expect(r.candidate!.conflictingEvidenceIds.length).toBeGreaterThan(0);
    expect(r.candidate!.status).toBe("NEEDS_CONFIRMATION");
  });
});

describe("Phase 5D Step9 — eligibility and determinism", () => {
  it("rejects ACTIVE detector for DISABLED strategy", () => {
    const base = getDefaultMifStrategyIntelligenceRegistry().getStrategy("SUPPLY_DEMAND")!;
    const disabled: MifStrategyDefinition = { ...base, lifecycleStatus: "DISABLED" };
    const stratReg = createMifStrategyIntelligenceRegistry([
      ...MIF_STRATEGY_CATALOG.filter((s) => s.strategyId !== "SUPPLY_DEMAND"),
      disabled,
    ]);
    expect(() =>
      createMifOpportunityDetectorRegistry(
        [{ ...mifSupplyDemandDetector, availabilityStatus: "ACTIVE" }],
        stratReg,
      ),
    ).toThrow(/lifecycle|activate/i);
  });

  it("is deterministic and does not mutate input", () => {
    const ctx = sdContext();
    const before = JSON.stringify(ctx.evidence);
    const a = mifSupplyDemandDetector.evaluate(ctx);
    const b = mifSupplyDemandDetector.evaluate(ctx);
    expect(a.candidate?.candidateId).toBe(b.candidate?.candidateId);
    expect(JSON.stringify(ctx.evidence)).toBe(before);
  });

  it("rejects blocked quality via orchestrator", () => {
    const result = runMifOpportunityDetection({
      context: sdContext({
        dataQualityStatus: "BLOCKED",
        evidenceSummary: { ...baseSummary(), dataQualityStatus: "BLOCKED" },
      }),
      detectors: [mifSupplyDemandDetector],
      reportMissingDetectors: false,
    });
    expect(result.candidates).toHaveLength(0);
    expect(["BLOCKED_BY_DATA_QUALITY", "INELIGIBLE"]).toContain(result.outcomes[0]?.status);
  });

  it("rejects mixed instruments via orchestrator", () => {
    const result = runMifOpportunityDetection({
      context: sdContext({
        regime: { providerSymbol: "EURUSD" } as MifOpportunityDetectionContext["regime"],
      }),
      detectors: [mifSupplyDemandDetector],
      reportMissingDetectors: false,
    });
    expect(result.outcomes[0]?.status).toBe("INVALID_CONTEXT");
  });

  it("runs eligible SUPPLY_DEMAND through orchestrator", () => {
    const result = runMifOpportunityDetection({
      context: sdContext(),
      detectors: [mifSupplyDemandDetector],
      reportMissingDetectors: false,
    });
    expect(result.outcomes[0]?.status).toBe("CANDIDATE_PRODUCED");
    expect(result.candidates[0]?.strategyId).toBe("SUPPLY_DEMAND");
    expect(result.acceptsForExecution).toBe(false);
  });

  it("rejects missing displacement origin", () => {
    const ctx = sdContext({
      evidence: [
        ev({
          evidenceId: "sd.structure",
          family: "MARKET_STRUCTURE",
          notes:
            "zoneId=ZONE_D1;zoneKind=DEMAND;lowerId=ZL;upperId=ZU;orderValid=true",
        }),
        ev({
          evidenceId: "sd.displacement",
          family: "PRICE_DISPLACEMENT",
          notes: "direction=UP",
        }),
        ev({
          evidenceId: "sd.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "react=UP;closeState=CLOSED",
        }),
        ev({ evidenceId: "sd.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifSupplyDemandDetector.evaluate(ctx).candidate).toBeNull();
  });
});
