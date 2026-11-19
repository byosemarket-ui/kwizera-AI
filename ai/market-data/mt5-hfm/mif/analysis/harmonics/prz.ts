/**
 * Phase 5C Step 2 — Potential Reversal Zone from Fibonacci projections.
 * Analytical reference only — not a reversal guarantee or entry instruction.
 */
import type { MifHarmonicOrientation, MifHarmonicPatternRatioPolicy, MifHarmonicPrz } from "./types.js";
import type { PivotPrices } from "./measure-ratios.js";

function projectAd(prices: PivotPrices, ratio: number, orientation: MifHarmonicOrientation): number {
  const xa = Math.abs(prices.a - prices.x);
  // Bullish D below A by AD*XA; Bearish D above A.
  return orientation === "BULLISH" ? prices.a - ratio * xa : prices.a + ratio * xa;
}

function projectCd(prices: PivotPrices, ratio: number, orientation: MifHarmonicOrientation): number {
  const bc = Math.abs(prices.c - prices.b);
  return orientation === "BULLISH" ? prices.c - ratio * bc : prices.c + ratio * bc;
}

function midOrExact(range: { min: number | null; max: number | null; exact: number | null }): number | null {
  if (range.exact != null) return range.exact;
  if (range.min != null && range.max != null) return (range.min + range.max) / 2;
  return null;
}

/**
 * PRZ from AD and CD (and CD/XC for Shark) target projections.
 * Convergence = projections fall within maxPrzWidthAtr * atr.
 */
export function computePrz(input: {
  prices: PivotPrices;
  orientation: MifHarmonicOrientation;
  ratioPolicy: MifHarmonicPatternRatioPolicy;
  atr: number;
  maxPrzWidthAtr: number;
  minPrzProjections: number;
}): MifHarmonicPrz {
  const projections: Array<{ id: string; price: number }> = [];
  const adTarget = midOrExact(input.ratioPolicy.adOfXa);
  const cdTarget = midOrExact(input.ratioPolicy.cdOfBc);

  if (adTarget != null) {
    projections.push({
      id: "AD_XA_PROJ",
      price: projectAd(input.prices, adTarget, input.orientation),
    });
  }
  if (cdTarget != null) {
    projections.push({
      id: "CD_BC_PROJ",
      price: projectCd(input.prices, cdTarget, input.orientation),
    });
  }
  if (input.ratioPolicy.cdOfXc) {
    const xcTarget = midOrExact(input.ratioPolicy.cdOfXc);
    if (xcTarget != null) {
      const xc = Math.abs(input.prices.c - input.prices.x);
      const price =
        input.orientation === "BULLISH"
          ? input.prices.c - xcTarget * xc
          : input.prices.c + xcTarget * xc;
      projections.push({ id: "CD_XC_PROJ", price });
    }
  }

  // Also include observed D as a measured point (not a projection), for width context only —
  // do not count it as a contributing projection for convergence.
  if (projections.length < input.minPrzProjections) {
    return {
      low: null,
      high: null,
      width: null,
      widthAtr: null,
      contributingProjections: projections,
      convergenceOk: false,
      analyticalReferenceOnly: true,
    };
  }

  const prices = projections.map((p) => p.price).filter((p) => Number.isFinite(p));
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  const width = high - low;
  const widthAtr = input.atr > 0 ? width / input.atr : null;
  const convergenceOk =
    widthAtr != null && widthAtr <= input.maxPrzWidthAtr && projections.length >= input.minPrzProjections;

  return {
    low,
    high,
    width,
    widthAtr,
    contributingProjections: projections,
    convergenceOk,
    analyticalReferenceOnly: true,
  };
}
