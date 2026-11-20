/**
 * Phase 5D.7 — ten-detector evidence integration audit.
 * Documents required/optional evidence and verifies registry wiring + isolation.
 */
import { describe, it, expect } from "vitest";
import {
  getDefaultMifStrategyIntelligenceRegistry,
  getDefaultMifOpportunityDetectorRegistry,
  MIF_EVIDENCE_FAMILY_CATALOG,
  type MifEvidenceFamily,
} from "../../../../ai/market-data/mt5-hfm/mif/index";

const TEN = [
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
] as const;

/** Which strategies should consume PRICE_DISPLACEMENT (dedicated engine). */
const DISPLACEMENT_CONSUMERS = new Set([
  "BREAKOUT",
  "SUPPLY_DEMAND",
  "MOMENTUM_EXPANSION",
]);

describe("Phase 5D.7 — ten-detector evidence audit", () => {
  const strategies = getDefaultMifStrategyIntelligenceRegistry();
  const detectors = getDefaultMifOpportunityDetectorRegistry();

  it("registers all ten strategies and detectors", () => {
    for (const id of TEN) {
      expect(strategies.getStrategy(id)).toBeTruthy();
      expect(detectors.findByStrategyId(id).length).toBeGreaterThanOrEqual(1);
    }
  });

  it("documents evidence requirements and quality rules per detector", () => {
    const report: Array<{
      strategyId: string;
      required: string[];
      optional: string[];
      consumesDisplacement: boolean;
      displacementAvailability: string | null;
    }> = [];

    for (const id of TEN) {
      const s = strategies.getStrategy(id)!;
      const required = s.requiredEvidence.map((e) => `${e.family}:${e.evidenceId}`);
      const optional = s.optionalEvidence.map((e) => `${e.family}:${e.evidenceId}`);
      const disp = [...s.requiredEvidence, ...s.optionalEvidence].find(
        (e) => e.family === "PRICE_DISPLACEMENT",
      );
      report.push({
        strategyId: id,
        required,
        optional,
        consumesDisplacement: !!disp,
        displacementAvailability: disp?.availability ?? null,
      });

      // Every required family must exist in catalog
      for (const e of s.requiredEvidence) {
        expect(MIF_EVIDENCE_FAMILY_CATALOG[e.family as MifEvidenceFamily]).toBeTruthy();
      }

      // DATA_QUALITY required for all production detectors
      expect(s.requiredEvidence.some((e) => e.family === "DATA_QUALITY")).toBe(true);

      // Safety flags on strategy definition
      expect(s.placesOrders).toBe(false);
      expect(s.mutatesBroker).toBe(false);
      expect(s.acceptsForExecution).toBe(false);
    }

    for (const row of report) {
      if (DISPLACEMENT_CONSUMERS.has(row.strategyId)) {
        expect(row.consumesDisplacement).toBe(true);
        expect(row.displacementAvailability).toBe("AVAILABLE");
      }
    }

    // Explicit non-consumers should not be forced to require displacement
    for (const id of TEN) {
      if (DISPLACEMENT_CONSUMERS.has(id)) continue;
      const s = strategies.getStrategy(id)!;
      const requiredDisp = s.requiredEvidence.some((e) => e.family === "PRICE_DISPLACEMENT");
      // Optional displacement is allowed; required must not be forced into irrelevant strategies
      expect(requiredDisp).toBe(false);
    }
  });

  it("keeps PRICE_DISPLACEMENT family AVAILABLE via dedicated engine", () => {
    expect(MIF_EVIDENCE_FAMILY_CATALOG.PRICE_DISPLACEMENT.availability).toBe("AVAILABLE");
    expect(MIF_EVIDENCE_FAMILY_CATALOG.PRICE_DISPLACEMENT.expectedSourceEngine).toBe(
      "mif-price-displacement",
    );
  });

  it("detector failure isolation contract: each detector is independently registered", () => {
    const ids = detectors.listDetectors().map((d) => d.detectorId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of TEN) {
      const d = detectors.findByStrategyId(id)[0]!;
      expect(d.placesOrders).toBe(false);
      expect(d.mutatesBroker).toBe(false);
      expect(d.acceptsForExecution).toBe(false);
    }
  });
});

