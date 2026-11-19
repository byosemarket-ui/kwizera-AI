/**
 * ASCENDING / DESCENDING / SYMMETRICAL triangle matchers.
 * Pivot-only boundary fit (OLS on swing highs / lows). Never silent full-close regression.
 */
import {
  boundaryFromFit,
  confirmedOnly,
  fitPivotLine,
  priceMid,
  swingsForMatching,
} from "../geometry.js";
import type { PatternMatcherContext, RawPatternCandidate } from "./types.js";
import { swingToPivot } from "./types.js";

function classifyTriangle(input: {
  upperSlope: number;
  lowerSlope: number;
  flatTolPerSec: number;
  minConvergencePerSec: number;
}): "ASCENDING_TRIANGLE" | "DESCENDING_TRIANGLE" | "SYMMETRICAL_TRIANGLE" | null {
  const { upperSlope, lowerSlope, flatTolPerSec, minConvergencePerSec } = input;
  const converging = upperSlope < lowerSlope - minConvergencePerSec
    || (upperSlope < -minConvergencePerSec && lowerSlope > minConvergencePerSec);
  // Expanding if boundaries diverge.
  if (upperSlope > lowerSlope + minConvergencePerSec && upperSlope > 0 && lowerSlope < 0) {
    return null;
  }
  if (!(upperSlope < lowerSlope) && Math.abs(upperSlope - lowerSlope) < minConvergencePerSec) {
    // Nearly parallel — reject unless one is flat enough for classic triangle.
  }

  const upperFlat = Math.abs(upperSlope) <= flatTolPerSec;
  const lowerFlat = Math.abs(lowerSlope) <= flatTolPerSec;

  if (upperFlat && lowerSlope > flatTolPerSec) {
    return "ASCENDING_TRIANGLE";
  }
  if (lowerFlat && upperSlope < -flatTolPerSec) {
    return "DESCENDING_TRIANGLE";
  }
  if (upperSlope < -flatTolPerSec && lowerSlope > flatTolPerSec && converging) {
    return "SYMMETRICAL_TRIANGLE";
  }
  // Also accept converging when upper declining and lower rising without flat.
  if (upperSlope < lowerSlope - minConvergencePerSec && upperSlope < 0 && lowerSlope > 0) {
    return "SYMMETRICAL_TRIANGLE";
  }
  return null;
}

export function matchTriangles(ctx: PatternMatcherContext): RawPatternCandidate[] {
  const swings = swingsForMatching(ctx.swings, ctx.policy, !ctx.allowConfirmed);
  const highs = swings.filter((s) => s.kind === "HIGH");
  const lows = swings.filter((s) => s.kind === "LOW");
  const minT = ctx.policy.triangleMinTouchesPerBoundary;
  if (highs.length < minT || lows.length < minT) return [];

  // Use the most recent minT..minT+2 pivots per side for a compact pattern window.
  const take = Math.min(Math.max(minT, 3), highs.length, lows.length);
  const hi = highs.slice(-take);
  const lo = lows.slice(-take);

  const upperPts = hi.map((s) => ({ timeSec: s.time, price: s.price }));
  const lowerPts = lo.map((s) => ({ timeSec: s.time, price: s.price }));
  const upperFit = fitPivotLine(upperPts);
  const lowerFit = fitPivotLine(lowerPts);
  if (!upperFit || !lowerFit) return [];

  if (upperFit.meanAbsResidual / ctx.atr > ctx.policy.triangleMaxResidualAtr) return [];
  if (lowerFit.meanAbsResidual / ctx.atr > ctx.policy.triangleMaxResidualAtr) return [];

  // Approximate flat tolerance in price/sec from ATR per bar using median bar duration.
  const times = confirmedOnly(ctx.swings).map((s) => s.time);
  let barSec = 3600;
  if (times.length >= 2) {
    const deltas: number[] = [];
    for (let i = 1; i < times.length; i += 1) deltas.push(times[i]! - times[i - 1]!);
    deltas.sort((a, b) => a - b);
    barSec = Math.max(deltas[Math.floor(deltas.length / 2)] ?? 3600, 1);
  }
  const flatTolPerSec = (ctx.policy.triangleFlatSlopeAtrMult * ctx.atr) / barSec;
  const minConvPerSec = ctx.policy.triangleMinConvergencePerBar / barSec;

  // Reject expanding: upper slope rising while lower declining.
  if (upperFit.slopePerSec > flatTolPerSec && lowerFit.slopePerSec < -flatTolPerSec) {
    return [];
  }

  const kind = classifyTriangle({
    upperSlope: upperFit.slopePerSec,
    lowerSlope: lowerFit.slopePerSec,
    flatTolPerSec,
    minConvergencePerSec: minConvPerSec,
  });
  if (!kind) return [];

  const upperBoundary = boundaryFromFit("triangle-upper", upperPts, upperFit);
  const lowerBoundary = boundaryFromFit("triangle-lower", lowerPts, lowerFit);
  const lastHi = hi[hi.length - 1]!;
  const lastLo = lo[lo.length - 1]!;
  const afterPivotTimeSec = Math.max(lastHi.time, lastLo.time);
  const mid = priceMid(lastHi.price, lastLo.price);

  const breakBoundary = kind === "DESCENDING_TRIANGLE" ? lowerBoundary : upperBoundary;
  // Ascending breaks up through flat resistance; descending breaks down through flat support;
  // symmetrical: break either — prefer direction of closer boundary breach potential via upper for bearish default... 
  // Spec: detect breakout beyond relevant boundary. For symmetrical we evaluate both later via two candidates.
  const direction =
    kind === "ASCENDING_TRIANGLE"
      ? "BULLISH" as const
      : kind === "DESCENDING_TRIANGLE"
        ? "BEARISH" as const
        : "BULLISH" as const;

  const touchScore = Math.min(1, (hi.length + lo.length) / (2 * minT) / 2 + 0.5);
  const residScore = 1 - Math.min(
    1,
    Math.max(upperFit.meanAbsResidual, lowerFit.meanAbsResidual)
      / Math.max(ctx.policy.triangleMaxResidualAtr * ctx.atr, 1e-12),
  );

  const base = {
    pivots: [
      ...hi.map((s, i) => swingToPivot(`HIGH_${i + 1}`, s)),
      ...lo.map((s, i) => swingToPivot(`LOW_${i + 1}`, s)),
    ],
    neckline: null,
    upperBoundary,
    lowerBoundary,
    afterPivotTimeSec,
    midPrice: mid,
    geometryValid: true,
    structureInvalidated: false,
    measurements: {
      upperSlopePerSec: upperFit.slopePerSec,
      lowerSlopePerSec: lowerFit.slopePerSec,
      upperResidual: upperFit.meanAbsResidual,
      lowerResidual: lowerFit.meanAbsResidual,
      upperResidualAtr: upperFit.meanAbsResidual / ctx.atr,
      lowerResidualAtr: lowerFit.meanAbsResidual / ctx.atr,
      highTouches: hi.length,
      lowTouches: lo.length,
      atrMethodId: ctx.policy.atrMethodId,
    },
    geometryFit: residScore,
    depthOrProminence: residScore,
    symmetryOrTouches: touchScore,
  };

  const out: RawPatternCandidate[] = [];
  if (kind === "SYMMETRICAL_TRIANGLE") {
    out.push({
      ...base,
      patternType: kind,
      breakBoundary: upperBoundary,
      breakoutDirection: "BEARISH",
    });
    out.push({
      ...base,
      patternType: kind,
      breakBoundary: lowerBoundary,
      breakoutDirection: "BULLISH",
    });
  } else {
    out.push({
      ...base,
      patternType: kind,
      breakBoundary,
      breakoutDirection: direction,
    });
  }
  return out;
}
