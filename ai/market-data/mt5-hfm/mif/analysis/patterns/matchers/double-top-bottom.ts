/**
 * DOUBLE_TOP / DOUBLE_BOTTOM matchers.
 * DOUBLE_TOP: HIGH1 → LOW → HIGH2; neckline at intervening trough; bearish break.
 * DOUBLE_BOTTOM: LOW1 → HIGH → LOW2; neckline at intervening peak; bullish break.
 */
import type { StructureSwing } from "../../../../../../forex-structure/types.js";
import {
  barsBetween,
  equalityTol,
  horizontalBoundary,
  priceMid,
  pricesEqualWithin,
  swingsForMatching,
} from "../geometry.js";
import type { PatternMatcherContext, RawPatternCandidate } from "./types.js";
import { swingToPivot } from "./types.js";

function interveningExtremum(
  swings: readonly StructureSwing[],
  a: StructureSwing,
  b: StructureSwing,
  kind: "LOW" | "HIGH",
): StructureSwing | null {
  const between = swings.filter(
    (s) => s.kind === kind && s.time > a.time && s.time < b.time && s.index > a.index && s.index < b.index,
  );
  if (between.length === 0) return null;
  if (kind === "LOW") {
    return between.reduce((best, s) => (s.price < best.price ? s : best));
  }
  return between.reduce((best, s) => (s.price > best.price ? s : best));
}

export function matchDoubleTops(ctx: PatternMatcherContext): RawPatternCandidate[] {
  const swings = swingsForMatching(ctx.swings, ctx.policy, !ctx.allowConfirmed);
  const highs = swings.filter((s) => s.kind === "HIGH");
  const out: RawPatternCandidate[] = [];
  const tol = equalityTol(ctx.policy, highs[0]?.price ?? 1, ctx.atr);

  for (let i = 0; i < highs.length; i += 1) {
    for (let j = i + 1; j < highs.length; j += 1) {
      const h1 = highs[i]!;
      const h2 = highs[j]!;
      if (barsBetween(h1, h2) < ctx.policy.minBarsBetweenPivots) continue;
      if (!pricesEqualWithin(h1.price, h2.price, equalityTol(ctx.policy, priceMid(h1.price, h2.price), ctx.atr))) {
        continue;
      }
      const trough = interveningExtremum(swings, h1, h2, "LOW");
      if (!trough) continue;
      const mid = priceMid(h1.price, h2.price);
      const depth = (mid - trough.price) / Math.max(Math.abs(mid), 1);
      if (!(depth >= ctx.policy.minRetraceOfSpan)) continue;

      const neckline = horizontalBoundary(
        "double-top-neckline",
        trough.price,
        trough.time,
        h2.time,
      );
      const eqScore = 1 - Math.min(1, Math.abs(h1.price - h2.price) / Math.max(tol, 1e-12));
      out.push({
        patternType: "DOUBLE_TOP",
        pivots: [
          swingToPivot("HIGH1", h1),
          swingToPivot("NECKLINE_LOW", trough),
          swingToPivot("HIGH2", h2),
        ],
        neckline,
        upperBoundary: null,
        lowerBoundary: null,
        breakBoundary: neckline,
        breakoutDirection: "BEARISH",
        afterPivotTimeSec: h2.time,
        midPrice: mid,
        geometryValid: true,
        structureInvalidated: false,
        measurements: {
          peakDelta: Math.abs(h1.price - h2.price),
          equalityTol: equalityTol(ctx.policy, mid, ctx.atr),
          retraceDepth: depth,
          minRetraceOfSpan: ctx.policy.minRetraceOfSpan,
        },
        geometryFit: eqScore,
        depthOrProminence: Math.min(1, depth / Math.max(ctx.policy.minRetraceOfSpan, 1e-9)),
        symmetryOrTouches: eqScore,
      });
    }
  }
  return out;
}

export function matchDoubleBottoms(ctx: PatternMatcherContext): RawPatternCandidate[] {
  const swings = swingsForMatching(ctx.swings, ctx.policy, !ctx.allowConfirmed);
  const lows = swings.filter((s) => s.kind === "LOW");
  const out: RawPatternCandidate[] = [];

  for (let i = 0; i < lows.length; i += 1) {
    for (let j = i + 1; j < lows.length; j += 1) {
      const l1 = lows[i]!;
      const l2 = lows[j]!;
      if (barsBetween(l1, l2) < ctx.policy.minBarsBetweenPivots) continue;
      const mid = priceMid(l1.price, l2.price);
      const tol = equalityTol(ctx.policy, mid, ctx.atr);
      if (!pricesEqualWithin(l1.price, l2.price, tol)) continue;
      const peak = interveningExtremum(swings, l1, l2, "HIGH");
      if (!peak) continue;
      const depth = (peak.price - mid) / Math.max(Math.abs(mid), 1);
      if (!(depth >= ctx.policy.minRetraceOfSpan)) continue;

      const neckline = horizontalBoundary(
        "double-bottom-neckline",
        peak.price,
        peak.time,
        l2.time,
      );
      const eqScore = 1 - Math.min(1, Math.abs(l1.price - l2.price) / Math.max(tol, 1e-12));
      out.push({
        patternType: "DOUBLE_BOTTOM",
        pivots: [
          swingToPivot("LOW1", l1),
          swingToPivot("NECKLINE_HIGH", peak),
          swingToPivot("LOW2", l2),
        ],
        neckline,
        upperBoundary: null,
        lowerBoundary: null,
        breakBoundary: neckline,
        breakoutDirection: "BULLISH",
        afterPivotTimeSec: l2.time,
        midPrice: mid,
        geometryValid: true,
        structureInvalidated: false,
        measurements: {
          troughDelta: Math.abs(l1.price - l2.price),
          equalityTol: tol,
          rallyDepth: depth,
          minRetraceOfSpan: ctx.policy.minRetraceOfSpan,
        },
        geometryFit: eqScore,
        depthOrProminence: Math.min(1, depth / Math.max(ctx.policy.minRetraceOfSpan, 1e-9)),
        symmetryOrTouches: eqScore,
      });
    }
  }
  return out;
}
