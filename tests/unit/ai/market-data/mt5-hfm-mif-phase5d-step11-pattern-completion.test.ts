/**
 * Phase 5D Step 11 — Pattern Completion Opportunity Detector.
 */
import { describe, it, expect } from "vitest";
import {
  MIF_PROVIDER_ID,
  MIF_PATTERN_COMPLETION_DETECTOR_ID,
  createMifOpportunityDetectorRegistry,
  createMifStrategyIntelligenceRegistry,
  getDefaultMifStrategyIntelligenceRegistry,
  mifPatternCompletionDetector,
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
    timeframeRole: over.timeframeRole ?? "SETUP_DEVELOPMENT",
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
      "SETUP_DEVELOPMENT" as const,
      "LOWER_TIMEFRAME_CONFIRMATION" as const,
    ],
    evidence: [
      {
        evidenceId: "pc.geometric",
        family: "GEOMETRIC_PATTERN" as const,
        presence: "PRESENT" as const,
        qualityStatus: "VALID" as const,
        closedCandleSatisfied: true,
        sourceAssessmentId: null,
        sourceContractId: null,
      },
      {
        evidenceId: "pc.quality",
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

function pcContext(over: Partial<MifOpportunityDetectionContext> = {}): MifOpportunityDetectionContext {
  const summary = baseSummary((over.evidenceSummary ?? {}) as Record<string, unknown>);
  summary.availableTimeframeRoles = [
    "SETUP_DEVELOPMENT",
    "LOWER_TIMEFRAME_CONFIRMATION",
    ...((summary.availableTimeframeRoles as string[] | undefined) ?? []).filter(
      (r) => r !== "SETUP_DEVELOPMENT" && r !== "LOWER_TIMEFRAME_CONFIRMATION",
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
      "SETUP_DEVELOPMENT",
      "LOWER_TIMEFRAME_CONFIRMATION",
      "PRIMARY_DIRECTION",
      "INTERMEDIATE_STRUCTURE",
      "OPPORTUNITY_TRIGGER",
    ],
    evidence: [
      ev({
        evidenceId: "pc.geometric",
        family: "GEOMETRIC_PATTERN",
        notes:
          "patternType=DOUBLE_BOTTOM;patternId=GEO_DB1;lifecycle=CONFIRMED;orientation=BULLISH;confirm=true;confirmDir=BULLISH;closeState=CLOSED",
      }),
      ev({
        evidenceId: "pc.candle",
        family: "CANDLE_CONFIRMATION",
        notes: "closeState=CLOSED;confirm=true",
      }),
      ev({ evidenceId: "pc.quality", family: "DATA_QUALITY", candleState: null }),
      ev({
        evidenceId: "pc.mtf",
        family: "MULTI_TIMEFRAME_RELATIONSHIP",
        notes: "relation=ALIGNMENT",
      }),
    ],
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    doesNotApproveAiReasoning: true,
    analyticalDetectionContextOnly: true,
    ...over,
    evidenceSummary: over.evidenceSummary
      ? baseSummary({
          ...over.evidenceSummary,
          availableTimeframeRoles: [
            "SETUP_DEVELOPMENT",
            "LOWER_TIMEFRAME_CONFIRMATION",
            ...((over.evidenceSummary.availableTimeframeRoles as string[] | undefined) ?? []),
          ],
        })
      : summary,
    availableTimeframeRoles: over.availableTimeframeRoles ?? [
      "SETUP_DEVELOPMENT",
      "LOWER_TIMEFRAME_CONFIRMATION",
      "PRIMARY_DIRECTION",
      "INTERMEDIATE_STRUCTURE",
      "OPPORTUNITY_TRIGGER",
    ],
  };
}

function harmonicEvidence(over: {
  lifecycle?: string;
  orientation?: string;
  confirm?: string;
  xabcd?: string;
  prz?: string;
  przTouched?: string;
  patternType?: string;
} = {}) {
  const lifecycle = over.lifecycle ?? "CONFIRMED";
  const orientation = over.orientation ?? "BEARISH";
  const confirm = over.confirm ?? "true";
  const xabcd = over.xabcd ?? "true";
  const prz = over.prz ?? "true";
  const przTouched = over.przTouched ?? "false";
  const patternType = over.patternType ?? "GARTLEY";
  return [
    ev({
      evidenceId: "pc.harmonic",
      family: "HARMONIC_PATTERN",
      notes:
        `patternType=${patternType};patternId=HAR_1;lifecycle=${lifecycle};orientation=${orientation};confirm=${confirm};xabcdValid=${xabcd};przValid=${prz};przTouched=${przTouched};closeState=CLOSED`,
    }),
    ev({
      evidenceId: "pc.candle",
      family: "CANDLE_CONFIRMATION",
      notes: "closeState=CLOSED",
    }),
    ev({ evidenceId: "pc.quality", family: "DATA_QUALITY", candleState: null }),
    ev({
      evidenceId: "pc.mtf",
      family: "MULTI_TIMEFRAME_RELATIONSHIP",
      notes: "relation=ALIGNMENT",
    }),
  ];
}

describe("Phase 5D Step11 — geometric and harmonic completions", () => {
  it("produces BUY on valid bullish geometric confirmation", () => {
    const r = mifPatternCompletionDetector.evaluate(pcContext());
    expect(r.candidate).toBeTruthy();
    expect(r.candidate!.direction).toBe("BUY");
    expect(r.candidate!.strategyId).toBe("PATTERN_COMPLETION");
    expect(r.candidate!.detectorId).toBe(MIF_PATTERN_COMPLETION_DETECTOR_ID);
    expect(r.candidate!.acceptsForExecution).toBe(false);
    expect(r.candidate!.status).toBe("DETECTED");
  });

  it("produces SELL on valid bearish geometric confirmation", () => {
    const ctx = pcContext({
      evidence: [
        ev({
          evidenceId: "pc.geometric",
          family: "GEOMETRIC_PATTERN",
          notes:
            "patternType=DOUBLE_TOP;patternId=GEO_DT1;lifecycle=CONFIRMED;orientation=BEARISH;confirm=true;confirmDir=BEARISH;closeState=CLOSED",
        }),
        ev({
          evidenceId: "pc.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "closeState=CLOSED",
        }),
        ev({ evidenceId: "pc.quality", family: "DATA_QUALITY", candleState: null }),
        ev({
          evidenceId: "pc.mtf",
          family: "MULTI_TIMEFRAME_RELATIONSHIP",
          notes: "relation=ALIGNMENT",
        }),
      ],
      evidenceSummary: baseSummary({ regimeDirection: "DOWN" }),
    });
    expect(mifPatternCompletionDetector.evaluate(ctx).candidate?.direction).toBe("SELL");
  });

  it("produces BUY on valid bullish harmonic confirmation", () => {
    const ctx = pcContext({
      evidence: harmonicEvidence({ orientation: "BULLISH", patternType: "BAT" }),
      evidenceSummary: baseSummary({
        evidence: [
          {
            evidenceId: "pc.harmonic",
            family: "HARMONIC_PATTERN",
            presence: "PRESENT",
            qualityStatus: "VALID",
            closedCandleSatisfied: true,
            sourceAssessmentId: null,
            sourceContractId: null,
          },
          {
            evidenceId: "pc.quality",
            family: "DATA_QUALITY",
            presence: "PRESENT",
            qualityStatus: "VALID",
            closedCandleSatisfied: null,
            sourceAssessmentId: "q1",
            sourceContractId: "kwizera.mif.quality.v1",
          },
        ],
      }),
    });
    expect(mifPatternCompletionDetector.evaluate(ctx).candidate?.direction).toBe("BUY");
  });

  it("produces SELL on valid bearish harmonic confirmation", () => {
    const ctx = pcContext({
      evidence: harmonicEvidence({ orientation: "BEARISH", patternType: "CRAB" }),
      evidenceSummary: baseSummary({
        regimeDirection: "DOWN",
        evidence: [
          {
            evidenceId: "pc.harmonic",
            family: "HARMONIC_PATTERN",
            presence: "PRESENT",
            qualityStatus: "VALID",
            closedCandleSatisfied: true,
            sourceAssessmentId: null,
            sourceContractId: null,
          },
          {
            evidenceId: "pc.quality",
            family: "DATA_QUALITY",
            presence: "PRESENT",
            qualityStatus: "VALID",
            closedCandleSatisfied: null,
            sourceAssessmentId: "q1",
            sourceContractId: "kwizera.mif.quality.v1",
          },
        ],
      }),
    });
    expect(mifPatternCompletionDetector.evaluate(ctx).candidate?.direction).toBe("SELL");
  });
});

describe("Phase 5D Step11 — identity and evidence gates", () => {
  it("rejects missing pattern identity", () => {
    const ctx = pcContext({
      evidence: [
        ev({
          evidenceId: "pc.geometric",
          family: "GEOMETRIC_PATTERN",
          notes: "lifecycle=CONFIRMED;orientation=BULLISH;confirm=true;closeState=CLOSED",
        }),
        ev({ evidenceId: "pc.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifPatternCompletionDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects unsupported pattern family/type", () => {
    const ctx = pcContext({
      evidence: [
        ev({
          evidenceId: "pc.geometric",
          family: "GEOMETRIC_PATTERN",
          notes:
            "patternType=WEDGES;patternId=X;lifecycle=CONFIRMED;orientation=BULLISH;confirm=true;closeState=CLOSED",
        }),
        ev({ evidenceId: "pc.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifPatternCompletionDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects missing direction", () => {
    const ctx = pcContext({
      evidence: [
        ev({
          evidenceId: "pc.geometric",
          family: "GEOMETRIC_PATTERN",
          notes:
            "patternType=SYMMETRICAL_TRIANGLE;patternId=SYM1;lifecycle=CONFIRMED;confirm=true;closeState=CLOSED",
        }),
        ev({ evidenceId: "pc.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifPatternCompletionDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects conflicting direction", () => {
    const ctx = pcContext({
      evidence: [
        ev({
          evidenceId: "pc.geometric",
          family: "GEOMETRIC_PATTERN",
          notes:
            "patternType=DOUBLE_BOTTOM;patternId=DB1;lifecycle=CONFIRMED;orientation=BULLISH;confirmDir=BEARISH;confirm=true;closeState=CLOSED",
        }),
        ev({ evidenceId: "pc.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifPatternCompletionDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects missing completion/lifecycle evidence", () => {
    const ctx = pcContext({
      evidence: [
        ev({
          evidenceId: "pc.geometric",
          family: "GEOMETRIC_PATTERN",
          notes: "patternType=DOUBLE_BOTTOM;patternId=DB1;orientation=BULLISH",
        }),
        ev({ evidenceId: "pc.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifPatternCompletionDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects malformed PRZ evidence", () => {
    const ctx = pcContext({
      evidence: harmonicEvidence({ prz: "false" }),
      evidenceSummary: baseSummary({
        evidence: [
          {
            evidenceId: "pc.harmonic",
            family: "HARMONIC_PATTERN",
            presence: "PRESENT",
            qualityStatus: "VALID",
            closedCandleSatisfied: true,
            sourceAssessmentId: null,
            sourceContractId: null,
          },
          {
            evidenceId: "pc.quality",
            family: "DATA_QUALITY",
            presence: "PRESENT",
            qualityStatus: "VALID",
            closedCandleSatisfied: null,
            sourceAssessmentId: "q1",
            sourceContractId: null,
          },
        ],
      }),
    });
    expect(mifPatternCompletionDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects invalid XABCD", () => {
    const ctx = pcContext({
      evidence: harmonicEvidence({ xabcd: "false" }),
      evidenceSummary: baseSummary({
        evidence: [
          {
            evidenceId: "pc.harmonic",
            family: "HARMONIC_PATTERN",
            presence: "PRESENT",
            qualityStatus: "VALID",
            closedCandleSatisfied: true,
            sourceAssessmentId: null,
            sourceContractId: null,
          },
          {
            evidenceId: "pc.quality",
            family: "DATA_QUALITY",
            presence: "PRESENT",
            qualityStatus: "VALID",
            closedCandleSatisfied: null,
            sourceAssessmentId: "q1",
            sourceContractId: null,
          },
        ],
      }),
    });
    expect(mifPatternCompletionDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects instrument mismatch", () => {
    const ctx = pcContext({
      evidence: [
        ev({
          evidenceId: "pc.geometric",
          family: "GEOMETRIC_PATTERN",
          notes:
            "patternType=DOUBLE_BOTTOM;patternId=DB1;lifecycle=CONFIRMED;orientation=BULLISH;confirm=true;closeState=CLOSED;symbol=EURUSD",
        }),
        ev({ evidenceId: "pc.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifPatternCompletionDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects timeframe mismatch", () => {
    const ctx = pcContext({
      evidence: [
        ev({
          evidenceId: "pc.geometric",
          family: "GEOMETRIC_PATTERN",
          timeframe: "H1",
          notes:
            "patternType=DOUBLE_BOTTOM;patternId=DB1;lifecycle=CONFIRMED;orientation=BULLISH;confirm=true;closeState=CLOSED;timeframe=H1",
        }),
        ev({
          evidenceId: "pc.candle",
          family: "CANDLE_CONFIRMATION",
          timeframe: "M15",
          notes: "closeState=CLOSED",
        }),
        ev({ evidenceId: "pc.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifPatternCompletionDetector.evaluate(ctx).candidate).toBeNull();
  });
});

describe("Phase 5D Step11 — lifecycle", () => {
  it("rejects FORMING as confirmed candidate", () => {
    const ctx = pcContext({
      evidence: [
        ev({
          evidenceId: "pc.geometric",
          family: "GEOMETRIC_PATTERN",
          notes:
            "patternType=DOUBLE_BOTTOM;patternId=DB1;lifecycle=FORMING;orientation=BULLISH;closeState=CLOSED",
        }),
        ev({ evidenceId: "pc.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    const r = mifPatternCompletionDetector.evaluate(ctx);
    expect(r.candidate).toBeNull();
    expect(r.diagnostics).toMatch(/FORMING/i);
  });

  it("marks APPROACHING_COMPLETION as NEEDS_CONFIRMATION", () => {
    const ctx = pcContext({
      evidence: [
        ev({
          evidenceId: "pc.geometric",
          family: "GEOMETRIC_PATTERN",
          notes:
            "patternType=DOUBLE_BOTTOM;patternId=DB1;lifecycle=FORMING;completionState=APPROACHING_COMPLETION;orientation=BULLISH;closeState=CLOSED",
        }),
        ev({
          evidenceId: "pc.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "closeState=CLOSED",
        }),
        ev({ evidenceId: "pc.quality", family: "DATA_QUALITY", candleState: null }),
        ev({
          evidenceId: "pc.mtf",
          family: "MULTI_TIMEFRAME_RELATIONSHIP",
          notes: "relation=ALIGNMENT",
        }),
      ],
    });
    const r = mifPatternCompletionDetector.evaluate(ctx);
    expect(r.candidate).toBeTruthy();
    expect(r.candidate!.status).toBe("NEEDS_CONFIRMATION");
  });

  it("marks COMPLETION_REACHED without confirmation as NEEDS_CONFIRMATION", () => {
    const ctx = pcContext({
      evidence: [
        ev({
          evidenceId: "pc.geometric",
          family: "GEOMETRIC_PATTERN",
          notes:
            "patternType=HEAD_AND_SHOULDERS;patternId=HS1;lifecycle=FORMING;completionState=COMPLETION_REACHED;orientation=BEARISH;confirm=false;closeState=CLOSED",
        }),
        ev({
          evidenceId: "pc.candle",
          family: "CANDLE_CONFIRMATION",
          notes: "closeState=CLOSED",
        }),
        ev({ evidenceId: "pc.quality", family: "DATA_QUALITY", candleState: null }),
        ev({
          evidenceId: "pc.mtf",
          family: "MULTI_TIMEFRAME_RELATIONSHIP",
          notes: "relation=ALIGNMENT",
        }),
      ],
    });
    const r = mifPatternCompletionDetector.evaluate(ctx);
    expect(r.candidate!.status).toBe("NEEDS_CONFIRMATION");
  });

  it("accepts CONFIRMED with CLOSED evidence as DETECTED", () => {
    expect(mifPatternCompletionDetector.evaluate(pcContext()).candidate!.status).toBe("DETECTED");
  });

  it("rejects FAILED pattern", () => {
    const ctx = pcContext({
      evidence: [
        ev({
          evidenceId: "pc.geometric",
          family: "GEOMETRIC_PATTERN",
          notes:
            "patternType=DOUBLE_BOTTOM;patternId=DB1;lifecycle=FAILED;orientation=BULLISH;confirm=true;closeState=CLOSED",
        }),
        ev({ evidenceId: "pc.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifPatternCompletionDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects INVALIDATED pattern", () => {
    const ctx = pcContext({
      evidence: [
        ev({
          evidenceId: "pc.geometric",
          family: "GEOMETRIC_PATTERN",
          notes:
            "patternType=DOUBLE_TOP;patternId=DT1;lifecycle=INVALIDATED;orientation=BEARISH;confirm=true;closeState=CLOSED",
        }),
        ev({ evidenceId: "pc.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifPatternCompletionDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("handles unknown lifecycle safely", () => {
    const ctx = pcContext({
      evidence: [
        ev({
          evidenceId: "pc.geometric",
          family: "GEOMETRIC_PATTERN",
          notes: "patternType=DOUBLE_BOTTOM;patternId=DB1;lifecycle=WEIRD;orientation=BULLISH",
        }),
        ev({ evidenceId: "pc.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifPatternCompletionDetector.evaluate(ctx).candidate).toBeNull();
  });
});

describe("Phase 5D Step11 — harmonic, fibonacci, unified", () => {
  it("does not fabricate unsupported harmonic ratios (invalid type rejected)", () => {
    const ctx = pcContext({
      evidence: harmonicEvidence({ patternType: "CYPHER" }),
      evidenceSummary: baseSummary({
        evidence: [
          {
            evidenceId: "pc.harmonic",
            family: "HARMONIC_PATTERN",
            presence: "PRESENT",
            qualityStatus: "VALID",
            closedCandleSatisfied: true,
            sourceAssessmentId: null,
            sourceContractId: null,
          },
          {
            evidenceId: "pc.quality",
            family: "DATA_QUALITY",
            presence: "PRESENT",
            qualityStatus: "VALID",
            closedCandleSatisfied: null,
            sourceAssessmentId: "q1",
            sourceContractId: null,
          },
        ],
      }),
    });
    expect(mifPatternCompletionDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("does not falsely confirm PRZ touch without confirmation", () => {
    const ctx = pcContext({
      evidence: harmonicEvidence({
        lifecycle: "FORMING",
        confirm: "false",
        przTouched: "true",
        orientation: "BULLISH",
      }),
      evidenceSummary: baseSummary({
        evidence: [
          {
            evidenceId: "pc.harmonic",
            family: "HARMONIC_PATTERN",
            presence: "PRESENT",
            qualityStatus: "VALID",
            closedCandleSatisfied: true,
            sourceAssessmentId: null,
            sourceContractId: null,
          },
          {
            evidenceId: "pc.quality",
            family: "DATA_QUALITY",
            presence: "PRESENT",
            qualityStatus: "VALID",
            closedCandleSatisfied: null,
            sourceAssessmentId: "q1",
            sourceContractId: null,
          },
        ],
      }),
    });
    const r = mifPatternCompletionDetector.evaluate(ctx);
    expect(r.candidate).toBeTruthy();
    expect(r.candidate!.status).toBe("NEEDS_CONFIRMATION");
  });

  it("rejects Fibonacci confluence alone", () => {
    const ctx = pcContext({
      evidence: [
        ev({
          evidenceId: "pc.fib",
          family: "FIBONACCI",
          notes: "confluence=STRONG",
        }),
        ev({ evidenceId: "pc.quality", family: "DATA_QUALITY", candleState: null }),
      ],
      evidenceSummary: baseSummary({
        evidence: [
          {
            evidenceId: "pc.fib",
            family: "FIBONACCI",
            presence: "PRESENT",
            qualityStatus: "VALID",
            closedCandleSatisfied: true,
            sourceAssessmentId: null,
            sourceContractId: null,
          },
          {
            evidenceId: "pc.quality",
            family: "DATA_QUALITY",
            presence: "PRESENT",
            qualityStatus: "VALID",
            closedCandleSatisfied: null,
            sourceAssessmentId: "q1",
            sourceContractId: null,
          },
        ],
      }),
    });
    const r = mifPatternCompletionDetector.evaluate(ctx);
    expect(r.candidate).toBeNull();
    expect(r.diagnostics).toMatch(/Fibonacci|confluence/i);
  });

  it("does not upgrade FAILED pattern with confluence", () => {
    const ctx = pcContext({
      evidence: [
        ev({
          evidenceId: "pc.geometric",
          family: "GEOMETRIC_PATTERN",
          notes:
            "patternType=DOUBLE_BOTTOM;patternId=DB1;lifecycle=FAILED;orientation=BULLISH;confirm=true;closeState=CLOSED",
        }),
        ev({
          evidenceId: "pc.fib",
          family: "FIBONACCI",
          notes: "confluence=STRONG",
        }),
        ev({ evidenceId: "pc.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    const r = mifPatternCompletionDetector.evaluate(ctx);
    expect(r.candidate).toBeNull();
    expect(r.warnings?.some((w) => /confluence|FAILED|INVALIDATED/i.test(w))).toBe(true);
  });

  it("consumes unified analysis without mutation", () => {
    const unified = {
      confluence: {
        grade: "MODERATE" as const,
        components: {},
        explanation: "test",
        analyticalReferenceOnly: true as const,
      },
    };
    const before = JSON.stringify(unified);
    const ctx = pcContext({
      // @ts-expect-error partial unified stub for immutability check
      unified,
    });
    mifPatternCompletionDetector.evaluate(ctx);
    expect(JSON.stringify(unified)).toBe(before);
  });
});

describe("Phase 5D Step11 — candle and MTF", () => {
  it("rejects FORMING confirmation candle", () => {
    const ctx = pcContext({
      evidence: [
        ev({
          evidenceId: "pc.geometric",
          family: "GEOMETRIC_PATTERN",
          notes:
            "patternType=DOUBLE_BOTTOM;patternId=DB1;lifecycle=CONFIRMED;orientation=BULLISH;confirm=true;closeState=CLOSED",
        }),
        ev({
          evidenceId: "pc.candle",
          family: "CANDLE_CONFIRMATION",
          candleState: "FORMING",
          notes: "closeState=FORMING",
        }),
        ev({ evidenceId: "pc.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifPatternCompletionDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects STALE candle", () => {
    const ctx = pcContext({
      evidence: [
        ev({
          evidenceId: "pc.geometric",
          family: "GEOMETRIC_PATTERN",
          notes:
            "patternType=DOUBLE_BOTTOM;patternId=DB1;lifecycle=CONFIRMED;orientation=BULLISH;confirm=true;closeState=CLOSED",
        }),
        ev({
          evidenceId: "pc.candle",
          family: "CANDLE_CONFIRMATION",
          candleState: "STALE",
          notes: "closeState=CLOSED",
        }),
        ev({ evidenceId: "pc.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifPatternCompletionDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("rejects INVALID candle quality", () => {
    const ctx = pcContext({
      evidence: [
        ev({
          evidenceId: "pc.geometric",
          family: "GEOMETRIC_PATTERN",
          notes:
            "patternType=DOUBLE_BOTTOM;patternId=DB1;lifecycle=CONFIRMED;orientation=BULLISH;confirm=true;closeState=CLOSED",
        }),
        ev({
          evidenceId: "pc.candle",
          family: "CANDLE_CONFIRMATION",
          qualityStatus: "INVALID",
          notes: "closeState=CLOSED",
        }),
        ev({ evidenceId: "pc.quality", family: "DATA_QUALITY", candleState: null }),
      ],
    });
    expect(mifPatternCompletionDetector.evaluate(ctx).candidate).toBeNull();
  });

  it("preserves MTF ALIGNMENT for DETECTED", () => {
    expect(mifPatternCompletionDetector.evaluate(pcContext()).candidate!.status).toBe("DETECTED");
  });

  it("marks PARTIAL_ALIGNMENT as NEEDS_CONFIRMATION", () => {
    const ctx = pcContext({
      evidence: [
        ...pcContext().evidence!.filter((e) => e.evidenceId !== "pc.mtf"),
        ev({
          evidenceId: "pc.mtf",
          family: "MULTI_TIMEFRAME_RELATIONSHIP",
          notes: "relation=PARTIAL_ALIGNMENT",
        }),
      ],
    });
    const r = mifPatternCompletionDetector.evaluate(ctx);
    expect(r.candidate!.status).toBe("NEEDS_CONFIRMATION");
    expect(r.candidate!.conflictingEvidenceIds.length).toBeGreaterThan(0);
  });

  it("preserves MTF CONFLICT", () => {
    const ctx = pcContext({
      evidence: [
        ...pcContext().evidence!.filter((e) => e.evidenceId !== "pc.mtf"),
        ev({
          evidenceId: "pc.mtf",
          family: "MULTI_TIMEFRAME_RELATIONSHIP",
          notes: "relation=CONFLICT",
        }),
      ],
    });
    const r = mifPatternCompletionDetector.evaluate(ctx);
    expect(r.candidate!.status).toBe("NEEDS_CONFIRMATION");
    expect(r.candidate!.conflictingEvidenceIds).toContain("pc.mtf");
  });

  it("preserves POTENTIAL_REVERSAL", () => {
    const ctx = pcContext({
      evidence: [
        ...pcContext().evidence!.filter((e) => e.evidenceId !== "pc.mtf"),
        ev({
          evidenceId: "pc.mtf",
          family: "MULTI_TIMEFRAME_RELATIONSHIP",
          notes: "relation=POTENTIAL_REVERSAL",
        }),
      ],
    });
    const r = mifPatternCompletionDetector.evaluate(ctx);
    expect(r.candidate!.status).toBe("NEEDS_CONFIRMATION");
    expect(r.warnings?.some((w) => /POTENTIAL_REVERSAL/i.test(w))).toBe(true);
  });

  it("handles MTF UNKNOWN without fabricating alignment", () => {
    const ctx = pcContext({
      evidence: pcContext().evidence!.filter((e) => e.evidenceId !== "pc.mtf"),
    });
    const r = mifPatternCompletionDetector.evaluate(ctx);
    expect(r.candidate).toBeTruthy();
    expect(r.warnings?.some((w) => /MTF UNKNOWN|absent/i.test(w))).toBe(true);
  });
});

describe("Phase 5D Step11 — eligibility and determinism", () => {
  it("rejects ACTIVE detector for DISABLED strategy", () => {
    const base = getDefaultMifStrategyIntelligenceRegistry().getStrategy("PATTERN_COMPLETION")!;
    const disabled: MifStrategyDefinition = { ...base, lifecycleStatus: "DISABLED" };
    const stratReg = createMifStrategyIntelligenceRegistry([
      ...MIF_STRATEGY_CATALOG.filter((s) => s.strategyId !== "PATTERN_COMPLETION"),
      disabled,
    ]);
    expect(() =>
      createMifOpportunityDetectorRegistry(
        [{ ...mifPatternCompletionDetector, availabilityStatus: "ACTIVE" }],
        stratReg,
      ),
    ).toThrow(/lifecycle|activate/i);
  });

  it("produces deterministic candidate identity", () => {
    const a = mifPatternCompletionDetector.evaluate(pcContext()).candidate!;
    const b = mifPatternCompletionDetector.evaluate(pcContext()).candidate!;
    expect(a.candidateId).toBe(b.candidateId);
  });

  it("does not mutate input context", () => {
    const ctx = pcContext();
    const before = JSON.stringify(ctx);
    mifPatternCompletionDetector.evaluate(ctx);
    expect(JSON.stringify(ctx)).toBe(before);
  });

  it("runs eligible PATTERN_COMPLETION through orchestrator", () => {
    const ctx = pcContext();
    const result = runMifOpportunityDetection({
      context: ctx,
      detectors: [mifPatternCompletionDetector],
      reportMissingDetectors: false,
    });
    expect(
      result.outcomes[0]?.status,
      `diag=${result.outcomes[0]?.diagnostics}; elig=${result.outcomes[0]?.eligibility?.status}`,
    ).toBe("CANDIDATE_PRODUCED");
    expect(result.candidates[0]?.strategyId).toBe("PATTERN_COMPLETION");
    expect(result.acceptsForExecution).toBe(false);
  });

  it("isolates detector failure without throwing", () => {
    const r = mifPatternCompletionDetector.evaluate(pcContext({ evidence: [] }));
    expect(r.candidate).toBeNull();
    expect(typeof r.diagnostics).toBe("string");
  });

  it("rejects blocked data quality", () => {
    expect(
      mifPatternCompletionDetector.evaluate(pcContext({ dataQualityStatus: "BLOCKED" })).candidate,
    ).toBeNull();
  });
});
