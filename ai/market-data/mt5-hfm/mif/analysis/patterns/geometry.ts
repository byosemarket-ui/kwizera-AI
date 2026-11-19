/**
 * Phase 5C Step 1B — shared geometric helpers for pattern matchers.
 */
import type { StructureCandle, StructureSwing } from "../../../../../forex-structure/types.js";
import type { MifChartPatternBoundary, MifChartPatternPolicy } from "./types.js";

export function priceMid(a: number, b: number): number {
  return (a + b) / 2;
}

export function equalityTol(policy: MifChartPatternPolicy, mid: number, atr: number): number {
  return Math.max(policy.peakEqualityTolRel * Math.max(Math.abs(mid), 1), policy.peakEqualityTolAtrMult * atr);
}

export function prominenceTol(policy: MifChartPatternPolicy, mid: number, atr: number): number {
  return Math.max(
    policy.minHeadProminenceRel * Math.max(Math.abs(mid), 1),
    policy.minHeadProminenceAtrMult * atr,
  );
}

export function symmetryTol(policy: MifChartPatternPolicy, mid: number, atr: number): number {
  return Math.max(
    policy.shoulderSymmetryTolRel * Math.max(Math.abs(mid), 1),
    policy.shoulderSymmetryTolAtrMult * atr,
  );
}

export function breakoutBuffer(policy: MifChartPatternPolicy, mid: number, atr: number): number {
  return Math.max(
    policy.breakoutBufferRel * Math.max(Math.abs(mid), 1),
    policy.breakoutBufferAtrMult * atr,
  );
}

export function pricesEqualWithin(a: number, b: number, tol: number): boolean {
  return Math.abs(a - b) <= tol;
}

export function barsBetween(a: StructureSwing, b: StructureSwing): number {
  return Math.abs(b.index - a.index);
}

export function confirmedOnly(swings: readonly StructureSwing[]): StructureSwing[] {
  return swings.filter((s) => s.status === "CONFIRMED").slice().sort((a, b) => {
    if (a.time !== b.time) return a.time - b.time;
    if (a.index !== b.index) return a.index - b.index;
    return a.kind.localeCompare(b.kind);
  });
}

export function swingsForMatching(
  swings: readonly StructureSwing[],
  policy: MifChartPatternPolicy,
  forForming: boolean,
): StructureSwing[] {
  if (forForming && policy.allowProvisionalSwingsForForming) {
    return swings
      .filter((s) => s.status === "CONFIRMED" || s.status === "PROVISIONAL")
      .slice()
      .sort((a, b) => (a.time !== b.time ? a.time - b.time : a.index - b.index));
  }
  return confirmedOnly(swings);
}

/** Pivot-only ordinary least-squares line: price = intercept + slope * timeSec. */
export function fitPivotLine(
  points: Array<{ timeSec: number; price: number }>,
): { slopePerSec: number; intercept: number; meanAbsResidual: number } | null {
  if (points.length < 2) return null;
  const n = points.length;
  let sumT = 0;
  let sumP = 0;
  let sumTT = 0;
  let sumTP = 0;
  for (const p of points) {
    sumT += p.timeSec;
    sumP += p.price;
    sumTT += p.timeSec * p.timeSec;
    sumTP += p.timeSec * p.price;
  }
  const denom = n * sumTT - sumT * sumT;
  if (Math.abs(denom) < 1e-18) {
    const intercept = sumP / n;
    let resid = 0;
    for (const p of points) resid += Math.abs(p.price - intercept);
    return { slopePerSec: 0, intercept, meanAbsResidual: resid / n };
  }
  const slopePerSec = (n * sumTP - sumT * sumP) / denom;
  const intercept = (sumP - slopePerSec * sumT) / n;
  let resid = 0;
  for (const p of points) {
    resid += Math.abs(p.price - (intercept + slopePerSec * p.timeSec));
  }
  return { slopePerSec, intercept, meanAbsResidual: resid / n };
}

export function linePriceAt(
  slopePerSec: number,
  intercept: number,
  timeSec: number,
): number {
  return intercept + slopePerSec * timeSec;
}

export function boundaryFromFit(
  label: string,
  points: Array<{ timeSec: number; price: number }>,
  fit: { slopePerSec: number; intercept: number },
): MifChartPatternBoundary {
  const t0 = points[0]!.timeSec;
  const t1 = points[points.length - 1]!.timeSec;
  const horizontal = Math.abs(fit.slopePerSec) < 1e-18;
  return {
    kind: horizontal ? "horizontal" : "sloped",
    priceAtStart: linePriceAt(fit.slopePerSec, fit.intercept, t0),
    timeSecStart: t0,
    priceAtEnd: linePriceAt(fit.slopePerSec, fit.intercept, t1),
    timeSecEnd: t1,
    slopePerSec: fit.slopePerSec,
    label,
  };
}

export function horizontalBoundary(
  label: string,
  price: number,
  timeSecStart: number,
  timeSecEnd: number,
): MifChartPatternBoundary {
  return {
    kind: "horizontal",
    priceAtStart: price,
    timeSecStart,
    priceAtEnd: price,
    timeSecEnd,
    slopePerSec: 0,
    label,
  };
}

export function closedCandlesAfter(
  candles: readonly StructureCandle[],
  afterTimeSec: number,
): StructureCandle[] {
  return candles.filter(
    (c) =>
      (c.isClosed === true || c.closed === true || (c.isClosed !== false && c.closed !== false))
      && c.time > afterTimeSec,
  );
}

export function isClosedCandle(c: StructureCandle): boolean {
  if (typeof c.isClosed === "boolean") return c.isClosed;
  if (typeof c.closed === "boolean") return c.closed;
  return true;
}
