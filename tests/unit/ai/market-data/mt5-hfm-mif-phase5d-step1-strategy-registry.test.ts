/**
 * Phase 5D Step 1 — Strategy Intelligence Foundation & Registry.
 */
import { describe, it, expect } from "vitest";
import {
  createMifStrategyIntelligenceRegistry,
  evaluateStrategyEligibility,
  getDefaultMifStrategyIntelligenceRegistry,
  MIF_STRATEGY_CATALOG,
  MIF_STRATEGY_CATALOG_VERSION,
  MIF_STRATEGY_IDS,
  MIF_STRATEGY_INTELLIGENCE_CONTRACT_ID,
  MIF_STRATEGY_INTELLIGENCE_POLICY_ID,
  validateMifStrategyDefinition,
  validateStrategyLifecycleTransition,
  type MifStrategyDefinition,
  type MifStrategyEvidenceSummary,
} from "../../../../ai/market-data/mt5-hfm/mif/index";

function summary(over: Partial<MifStrategyEvidenceSummary> = {}): MifStrategyEvidenceSummary {
  return {
    providerSymbol: "XAUUSD",
    dataQualityStatus: "VALID",
    regimeDirection: "UP",
    regimeStructure: "TRENDING",
    regimeVolatility: "NORMAL",
    availableTimeframeRoles: [
      "PRIMARY_DIRECTION",
      "INTERMEDIATE_STRUCTURE",
      "SETUP_DEVELOPMENT",
      "OPPORTUNITY_FORMATION",
      "LOWER_TIMEFRAME_CONFIRMATION",
    ],
    evidence: [
      {
        evidenceId: "tc.regime",
        family: "MARKET_REGIME",
        presence: "PRESENT",
        qualityStatus: "VALID",
        closedCandleSatisfied: true,
        sourceAssessmentId: "reg1",
        sourceContractId: "kwizera.mif.market-regime.v1",
      },
      {
        evidenceId: "tc.mtf",
        family: "MULTI_TIMEFRAME_RELATIONSHIP",
        presence: "PRESENT",
        qualityStatus: "VALID",
        closedCandleSatisfied: true,
        sourceAssessmentId: "mtf1",
        sourceContractId: "kwizera.mif.multi-timeframe-relationships.v1",
      },
      {
        evidenceId: "tc.quality",
        family: "DATA_QUALITY",
        presence: "PRESENT",
        qualityStatus: "VALID",
        closedCandleSatisfied: null,
        sourceAssessmentId: "q1",
        sourceContractId: "kwizera.mif.quality.v1",
      },
      {
        evidenceId: "tc.structure",
        family: "MARKET_STRUCTURE",
        presence: "PRESENT",
        qualityStatus: "VALID",
        closedCandleSatisfied: true,
        sourceAssessmentId: null,
        sourceContractId: null,
      },
    ],
    ...over,
  };
}

describe("Phase 5D Step1 — strategy registry catalog", () => {
  const registry = getDefaultMifStrategyIntelligenceRegistry();

  it("contains exactly ten versioned ACTIVE strategies with unique IDs", () => {
    expect(MIF_STRATEGY_CATALOG).toHaveLength(10);
    expect(MIF_STRATEGY_IDS).toHaveLength(10);
    expect(new Set(MIF_STRATEGY_IDS).size).toBe(10);
    expect(registry.diagnostics().catalogVersion).toBe(MIF_STRATEGY_CATALOG_VERSION);
    expect(registry.diagnostics().validationOk).toBe(true);
    expect(registry.diagnostics().activeCount).toBe(10);
    expect(registry.getPolicyId()).toBe(MIF_STRATEGY_INTELLIGENCE_POLICY_ID);

    for (const id of [
      "TREND_CONTINUATION",
      "PULLBACK",
      "REVERSAL",
      "BREAKOUT",
      "BREAKOUT_RETEST",
      "RANGE",
      "LIQUIDITY_SWEEP",
      "SUPPLY_DEMAND",
      "MOMENTUM_EXPANSION",
      "PATTERN_COMPLETION",
    ] as const) {
      const s = registry.getStrategy(id);
      expect(s, id).toBeTruthy();
      expect(s!.definitionVersion).toBe("1.0.0");
      expect(s!.lifecycleStatus).toBe("ACTIVE");
      expect(s!.placesOrders).toBe(false);
      expect(s!.doesNotApproveAiReasoning).toBe(true);
      expect(s!.doesNotCreateOpportunities).toBe(true);
      expect(validateMifStrategyDefinition(s!).ok).toBe(true);
      expect(s!.requiredEvidence.length).toBeGreaterThan(0);
      expect(s!.timeframeRoles.length).toBeGreaterThan(0);
      expect(s!.confirmations.length).toBeGreaterThan(0);
      expect(s!.invalidations.length).toBeGreaterThan(0);
    }
  });

  it("supports deterministic lookup, category and lifecycle filters", () => {
    const listed = registry.listStrategies();
    expect(listed.map((s) => s.strategyId)).toEqual(
      [...listed.map((s) => s.strategyId)].sort((a, b) => a.localeCompare(b)),
    );
    expect(registry.getStrategy("NOPE")).toBeNull();
    expect(registry.getStrategyVersion("PULLBACK", "1.0.0")?.strategyId).toBe("PULLBACK");
    expect(registry.getStrategyVersion("PULLBACK", "9.9.9")).toBeNull();
    expect(registry.filterByCategory("BREAKOUT").map((s) => s.strategyId).sort()).toEqual([
      "BREAKOUT",
      "BREAKOUT_RETEST",
    ]);
    expect(registry.filterByLifecycle("ACTIVE")).toHaveLength(10);
    expect(registry.filterByLifecycle("DRAFT")).toHaveLength(0);
  });

  it("rejects invalid definitions and illegal lifecycle transitions", () => {
    const base = registry.getStrategy("RANGE")!;
    const bad: MifStrategyDefinition = {
      ...base,
      strategyId: "RANGE",
      definitionVersion: "bad",
      requiredEvidence: [],
    };
    expect(validateMifStrategyDefinition(bad).ok).toBe(false);
    expect(validateStrategyLifecycleTransition("DEPRECATED", "ACTIVE").ok).toBe(false);
    expect(validateStrategyLifecycleTransition("DRAFT", "ACTIVE").ok).toBe(true);
    expect(() =>
      createMifStrategyIntelligenceRegistry([base, { ...base, name: "dup" }]),
    ).toThrow(/duplicate/i);
  });
});

describe("Phase 5D Step1 — eligibility", () => {
  const registry = getDefaultMifStrategyIntelligenceRegistry();

  it("marks TREND_CONTINUATION eligible when requirements satisfied", () => {
    const r = registry.evaluateEligibility("TREND_CONTINUATION", summary());
    expect(r.contractId).toBe(MIF_STRATEGY_INTELLIGENCE_CONTRACT_ID);
    expect(r.status).toBe("ELIGIBLE_FOR_DETECTION");
    expect(r.eligibleForDetectionOnly).toBe(true);
    expect(r.doesNotCreateOpportunities).toBe(true);
    expect(r.placesOrders).toBe(false);
  });

  it("returns INSUFFICIENT_EVIDENCE when required evidence missing", () => {
    const r = evaluateStrategyEligibility({
      definition: registry.getStrategy("TREND_CONTINUATION"),
      summary: summary({ evidence: [] }),
    });
    expect(["INSUFFICIENT_EVIDENCE", "INELIGIBLE"]).toContain(r.status);
  });

  it("blocks on data quality and disabled/deprecated/draft lifecycles", () => {
    const blocked = registry.evaluateEligibility(
      "TREND_CONTINUATION",
      summary({ dataQualityStatus: "BLOCKED" }),
    );
    expect(blocked.status).toBe("BLOCKED_BY_DATA_QUALITY");

    const draftDef = {
      ...registry.getStrategy("TREND_CONTINUATION")!,
      lifecycleStatus: "DRAFT" as const,
    };
    expect(
      evaluateStrategyEligibility({ definition: draftDef, summary: summary() }).status,
    ).toBe("DRAFT");
    expect(
      evaluateStrategyEligibility({
        definition: { ...draftDef, lifecycleStatus: "DISABLED" },
        summary: summary(),
      }).status,
    ).toBe("DISABLED");
    expect(
      evaluateStrategyEligibility({
        definition: { ...draftDef, lifecycleStatus: "DEPRECATED" },
        summary: summary(),
      }).status,
    ).toBe("DEPRECATED");
  });

  it("PATTERN_COMPLETION requires geometric or harmonic PRESENT", () => {
    const baseEvidence = [
      {
        evidenceId: "pc.quality",
        family: "DATA_QUALITY" as const,
        presence: "PRESENT" as const,
        qualityStatus: "VALID" as const,
        closedCandleSatisfied: null,
        sourceAssessmentId: "q",
        sourceContractId: "kwizera.mif.quality.v1",
      },
    ];
    const missing = registry.evaluateEligibility(
      "PATTERN_COMPLETION",
      summary({
        evidence: baseEvidence,
        availableTimeframeRoles: ["SETUP_DEVELOPMENT"],
        regimeDirection: null,
        regimeStructure: null,
        regimeVolatility: null,
      }),
    );
    expect(missing.status).toBe("INSUFFICIENT_EVIDENCE");

    const ok = registry.evaluateEligibility(
      "PATTERN_COMPLETION",
      summary({
        evidence: [
          ...baseEvidence,
          {
            evidenceId: "pc.harmonic",
            family: "HARMONIC_PATTERN",
            presence: "PRESENT",
            qualityStatus: "VALID",
            closedCandleSatisfied: true,
            sourceAssessmentId: "har",
            sourceContractId: "kwizera.mif.harmonic-patterns.v1",
          },
        ],
        availableTimeframeRoles: ["SETUP_DEVELOPMENT"],
        regimeDirection: null,
        regimeStructure: null,
        regimeVolatility: null,
      }),
    );
    expect(ok.status).toBe("ELIGIBLE_FOR_DETECTION");
  });

  it("is deterministic for identical inputs; optional M1 absence does not invalidate", () => {
    const s = summary({
      availableTimeframeRoles: [
        "PRIMARY_DIRECTION",
        "INTERMEDIATE_STRUCTURE",
        "SETUP_DEVELOPMENT",
        "OPPORTUNITY_FORMATION",
        // no OPTIONAL_ENTRY_REFINEMENT / M1
      ],
    });
    const a = registry.evaluateEligibility("TREND_CONTINUATION", s);
    const b = registry.evaluateEligibility("TREND_CONTINUATION", s);
    expect(a.status).toBe(b.status);
    expect(a.explanation).toBe(b.explanation);
    expect(a.status).toBe("ELIGIBLE_FOR_DETECTION");
  });

  it("flags regime incompatibility", () => {
    const r = registry.evaluateEligibility(
      "TREND_CONTINUATION",
      summary({ regimeStructure: "RANGING", regimeDirection: "NEUTRAL" }),
    );
    expect(r.status).toBe("INELIGIBLE");
    expect(r.reasonCodes).toContain("REGIME_INCOMPATIBLE");
  });
});
