/**
 * Phase 5C Step 2 — versioned harmonic Fibonacci ratio tables (Carney-style).
 * Ranges are explicit policy inputs — not universal market laws.
 * Exact ratios use exactTol rather than silent rounding.
 */
import type { MifHarmonicPatternRatioPolicy, MifHarmonicRatioRange } from "./types.js";

function exact(target: number, tol = 0.04): MifHarmonicRatioRange {
  return { min: null, max: null, exact: target, exactTol: tol };
}

function band(min: number, max: number): MifHarmonicRatioRange {
  return { min, max, exact: null, exactTol: 0 };
}

/** Built-in ratio policies for mif-hfm-harmonic-patterns@1.0.0 */
export const MIF_HARMONIC_RATIO_TABLE_V1: readonly MifHarmonicPatternRatioPolicy[] = [
  {
    patternType: "GARTLEY",
    abOfXa: exact(0.618, 0.04),
    bcOfAb: band(0.382, 0.886),
    cdOfBc: band(1.272, 1.618),
    adOfXa: exact(0.786, 0.04),
  },
  {
    patternType: "BAT",
    abOfXa: band(0.382, 0.5),
    bcOfAb: band(0.382, 0.886),
    cdOfBc: band(1.618, 2.618),
    adOfXa: exact(0.886, 0.04),
  },
  {
    patternType: "BUTTERFLY",
    abOfXa: exact(0.786, 0.04),
    bcOfAb: band(0.382, 0.886),
    cdOfBc: band(1.618, 2.618),
    adOfXa: band(1.27, 1.618),
  },
  {
    patternType: "CRAB",
    abOfXa: band(0.382, 0.618),
    bcOfAb: band(0.382, 0.886),
    cdOfBc: band(2.24, 3.618),
    adOfXa: exact(1.618, 0.05),
  },
  {
    patternType: "SHARK",
    abOfXa: band(1.13, 1.618),
    bcOfAb: band(1.618, 2.24),
    cdOfBc: band(0.886, 1.618),
    adOfXa: band(0.886, 1.13),
    cdOfXc: band(0.886, 1.13),
  },
];

export function ratioPasses(measured: number, range: MifHarmonicRatioRange): {
  passed: boolean;
  deviation: number | null;
} {
  if (!Number.isFinite(measured) || measured <= 0) {
    return { passed: false, deviation: null };
  }
  if (range.exact != null) {
    const deviation = Math.abs(measured - range.exact);
    return { passed: deviation <= range.exactTol, deviation };
  }
  if (range.min != null && range.max != null) {
    const passed = measured >= range.min && measured <= range.max;
    const deviation = passed
      ? 0
      : measured < range.min
        ? range.min - measured
        : measured - range.max;
    return { passed, deviation };
  }
  return { passed: false, deviation: null };
}

export function legRatio(from: number, to: number, baseFrom: number, baseTo: number): number | null {
  const leg = Math.abs(to - from);
  const base = Math.abs(baseTo - baseFrom);
  if (!(base > 0) || !Number.isFinite(leg)) return null;
  return leg / base;
}
