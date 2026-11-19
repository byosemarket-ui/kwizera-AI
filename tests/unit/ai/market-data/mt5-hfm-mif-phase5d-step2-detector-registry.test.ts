/**
 * Phase 5D Step 2 — detector registry + definition validation.
 */
import { describe, it, expect } from "vitest";
import {
  createMifOpportunityDetectorRegistry,
  createMifStrategyIntelligenceRegistry,
  getDefaultMifOpportunityDetectorRegistry,
  getDefaultMifStrategyIntelligenceRegistry,
  MIF_OPPORTUNITY_DETECTION_POLICY_ID,
  MIF_STRATEGY_CATALOG,
  validateOpportunityDetector,
  type MifOpportunityDetector,
  type MifStrategyDefinition,
} from "../../../../ai/market-data/mt5-hfm/mif/index";

function stubDetector(
  over: Partial<MifOpportunityDetector> & Pick<MifOpportunityDetector, "detectorId" | "strategyId">,
): MifOpportunityDetector {
  return {
    detectorId: over.detectorId,
    strategyId: over.strategyId,
    detectorVersion: over.detectorVersion ?? "1.0.0",
    policyVersion: over.policyVersion ?? "1.0.0",
    availabilityStatus: over.availabilityStatus ?? "ACTIVE",
    supportedTimeframeRoles: over.supportedTimeframeRoles ?? ["OPPORTUNITY_FORMATION"],
    supportedSymbols: over.supportedSymbols ?? null,
    notes: over.notes ?? "test stub",
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    doesNotApproveAiReasoning: true,
    evaluate: over.evaluate ?? (() => ({ candidate: null })),
  };
}

describe("Phase 5D Step2 — detector registry", () => {
  it("empty constructed registry reports all strategies without detectors", () => {
    const reg = createMifOpportunityDetectorRegistry([]);
    expect(reg.listDetectors()).toHaveLength(0);
    expect(reg.getPolicyId()).toBe(MIF_OPPORTUNITY_DETECTION_POLICY_ID);
    const d = reg.diagnostics();
    expect(d.detectorCount).toBe(0);
    expect(d.strategiesWithoutDetector).toHaveLength(10);
    expect(d.validationOk).toBe(true);
  });

  it("default registry loads only implemented detectors (no fake fillers)", () => {
    const reg = getDefaultMifOpportunityDetectorRegistry();
    const d = reg.diagnostics();
    expect(d.validationOk).toBe(true);
    expect(d.detectorCount).toBe(reg.listDetectors().length);
    expect(d.detectorCount).toBeGreaterThan(0);
    // Unimplemented strategies must remain without detectors.
    expect(d.strategiesWithoutDetector.length).toBe(10 - d.detectorCount);
    for (const det of reg.listDetectors()) {
      expect(det.placesOrders).toBe(false);
      expect(det.acceptsForExecution).toBe(false);
      expect(typeof det.evaluate).toBe("function");
    }
  });

  it("registers a valid detector and supports lookup / ordering", () => {
    const a = stubDetector({ detectorId: "det.b", strategyId: "PULLBACK" });
    const b = stubDetector({ detectorId: "det.a", strategyId: "TREND_CONTINUATION" });
    const reg = createMifOpportunityDetectorRegistry([a, b]);
    expect(reg.listDetectors().map((d) => d.detectorId)).toEqual(["det.a", "det.b"]);
    expect(reg.getDetector("det.a")?.strategyId).toBe("TREND_CONTINUATION");
    expect(reg.findByStrategyId("PULLBACK")).toHaveLength(1);
    expect(reg.filterByAvailability("ACTIVE")).toHaveLength(2);
  });

  it("rejects duplicate detector IDs", () => {
    const d = stubDetector({ detectorId: "dup", strategyId: "RANGE" });
    expect(() => createMifOpportunityDetectorRegistry([d, { ...d }])).toThrow(/DUPLICATE|dup/i);
  });

  it("rejects unknown strategy references", () => {
    const d = stubDetector({
      detectorId: "x",
      strategyId: "NOPE" as MifOpportunityDetector["strategyId"],
    });
    const v = validateOpportunityDetector(d, getDefaultMifStrategyIntelligenceRegistry());
    expect(v.ok).toBe(false);
    expect(() => createMifOpportunityDetectorRegistry([d])).toThrow(/strategy/i);
  });

  it("rejects ACTIVE detector for DISABLED / DEPRECATED / DRAFT strategies", () => {
    const base = getDefaultMifStrategyIntelligenceRegistry().getStrategy("RANGE")!;
    for (const lifecycleStatus of ["DISABLED", "DEPRECATED", "DRAFT"] as const) {
      const custom: MifStrategyDefinition = { ...base, lifecycleStatus };
      const stratReg = createMifStrategyIntelligenceRegistry([
        ...MIF_STRATEGY_CATALOG.filter((s) => s.strategyId !== "RANGE"),
        custom,
      ]);
      const det = stubDetector({
        detectorId: `det.${lifecycleStatus}`,
        strategyId: "RANGE",
        availabilityStatus: "ACTIVE",
      });
      expect(validateOpportunityDetector(det, stratReg).ok).toBe(false);
      expect(() => createMifOpportunityDetectorRegistry([det], stratReg)).toThrow(/lifecycle|activate/i);
    }
  });

  it("allows DISABLED detector against non-ACTIVE strategy for diagnostics", () => {
    const base = getDefaultMifStrategyIntelligenceRegistry().getStrategy("RANGE")!;
    const custom: MifStrategyDefinition = { ...base, lifecycleStatus: "DISABLED" };
    const stratReg = createMifStrategyIntelligenceRegistry([
      ...MIF_STRATEGY_CATALOG.filter((s) => s.strategyId !== "RANGE"),
      custom,
    ]);
    const det = stubDetector({
      detectorId: "det.disabled.range",
      strategyId: "RANGE",
      availabilityStatus: "DISABLED",
    });
    expect(validateOpportunityDetector(det, stratReg).ok).toBe(true);
    const reg = createMifOpportunityDetectorRegistry([det], stratReg);
    expect(reg.getDetector("det.disabled.range")?.availabilityStatus).toBe("DISABLED");
  });

  it("rejects invalid detector version / policy / safety flags", () => {
    const strat = getDefaultMifStrategyIntelligenceRegistry();
    expect(
      validateOpportunityDetector(
        stubDetector({ detectorId: "v", strategyId: "RANGE", detectorVersion: "bad" }),
        strat,
      ).ok,
    ).toBe(false);
    expect(
      validateOpportunityDetector(
        stubDetector({ detectorId: "p", strategyId: "RANGE", policyVersion: "1" }),
        strat,
      ).ok,
    ).toBe(false);
    const unsafe = stubDetector({ detectorId: "u", strategyId: "RANGE" });
    (unsafe as { placesOrders: boolean }).placesOrders = true;
    expect(validateOpportunityDetector(unsafe, strat).ok).toBe(false);
  });
});
