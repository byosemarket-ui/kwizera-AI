/**
 * Phase 5C Step 2 — pattern-specific Fibonacci ratio measurement.
 * Measured values are never silently rounded to force a match.
 */
import { legRatio, ratioPasses } from "./ratios.js";
import type {
  MifHarmonicPatternRatioPolicy,
  MifHarmonicPatternType,
  MifHarmonicPolicy,
  MifHarmonicRatioMeasurement,
} from "./types.js";

export interface PivotPrices {
  x: number;
  a: number;
  b: number;
  c: number;
  d: number;
}

export function measureHarmonicRatios(
  prices: PivotPrices,
  ratioPolicy: MifHarmonicPatternRatioPolicy,
): MifHarmonicRatioMeasurement[] {
  // AB relative to XA; BC to AB; CD to BC; AD to XA; (Shark) CD to XC.
  const abOfXa = legRatio(prices.a, prices.b, prices.x, prices.a);
  const bcOfAb = legRatio(prices.b, prices.c, prices.a, prices.b);
  const cdOfBc = legRatio(prices.c, prices.d, prices.b, prices.c);
  const adOfXa = legRatio(prices.a, prices.d, prices.x, prices.a);
  const cdOfXc = legRatio(prices.c, prices.d, prices.x, prices.c);

  const specs: Array<{
    id: MifHarmonicRatioMeasurement["id"];
    measured: number | null;
    range: typeof ratioPolicy.abOfXa;
    required: boolean;
  }> = [
    { id: "AB_XA", measured: abOfXa, range: ratioPolicy.abOfXa, required: true },
    { id: "BC_AB", measured: bcOfAb, range: ratioPolicy.bcOfAb, required: true },
    { id: "CD_BC", measured: cdOfBc, range: ratioPolicy.cdOfBc, required: true },
    { id: "AD_XA", measured: adOfXa, range: ratioPolicy.adOfXa, required: true },
  ];
  if (ratioPolicy.cdOfXc) {
    specs.push({
      id: "CD_XC",
      measured: cdOfXc,
      range: ratioPolicy.cdOfXc,
      required: true,
    });
  }

  return specs.map((s) => {
    if (s.measured == null || !Number.isFinite(s.measured)) {
      return {
        id: s.id,
        measured: Number.NaN,
        expectedMin: s.range.min,
        expectedMax: s.range.max,
        expectedExact: s.range.exact,
        deviation: null,
        passed: false,
      };
    }
    const { passed, deviation } = ratioPasses(s.measured, s.range);
    return {
      id: s.id,
      measured: s.measured,
      expectedMin: s.range.min,
      expectedMax: s.range.max,
      expectedExact: s.range.exact,
      deviation,
      passed: s.required ? passed : true,
    };
  });
}

export function geometryFitFromRatios(ratios: readonly MifHarmonicRatioMeasurement[]): number {
  if (ratios.length === 0) return 0;
  let score = 0;
  for (const r of ratios) {
    if (!r.passed) {
      score += 0;
      continue;
    }
    if (r.deviation == null) {
      score += 1;
      continue;
    }
    // Smaller deviation → higher fit; clamp.
    const tol = r.expectedExact != null
      ? Math.max(r.expectedExact * 0.05, 0.02)
      : r.expectedMax != null && r.expectedMin != null
        ? Math.max((r.expectedMax - r.expectedMin) / 2, 0.02)
        : 0.05;
    score += Math.max(0, 1 - r.deviation / tol);
  }
  return Math.max(0, Math.min(1, score / ratios.length));
}

export function findMatchingPatternTypes(
  prices: PivotPrices,
  policy: MifHarmonicPolicy,
): Array<{
  patternType: MifHarmonicPatternType;
  ratios: MifHarmonicRatioMeasurement[];
  allRequiredRatiosPassed: boolean;
  geometryFit: number;
  ratioPolicy: MifHarmonicPatternRatioPolicy;
}> {
  const out: Array<{
    patternType: MifHarmonicPatternType;
    ratios: MifHarmonicRatioMeasurement[];
    allRequiredRatiosPassed: boolean;
    geometryFit: number;
    ratioPolicy: MifHarmonicPatternRatioPolicy;
  }> = [];
  for (const ratioPolicy of policy.patternRatios) {
    const ratios = measureHarmonicRatios(prices, ratioPolicy);
    const allRequiredRatiosPassed = ratios.every((r) => r.passed);
    if (!allRequiredRatiosPassed) continue;
    out.push({
      patternType: ratioPolicy.patternType,
      ratios,
      allRequiredRatiosPassed,
      geometryFit: geometryFitFromRatios(ratios),
      ratioPolicy,
    });
  }
  return out;
}
