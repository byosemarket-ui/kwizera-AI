/**
 * HEAD_AND_SHOULDERS / INVERSE_HEAD_AND_SHOULDERS matchers.
 * Pivot-only neckline through the two neckline swings (sloped when needed).
 */
import type { StructureSwing } from "../../../../../../forex-structure/types.js";
import {
  barsBetween,
  boundaryFromFit,
  fitPivotLine,
  priceMid,
  prominenceTol,
  swingsForMatching,
  symmetryTol,
} from "../geometry.js";
import type { PatternMatcherContext, RawPatternCandidate } from "./types.js";
import { swingToPivot } from "./types.js";

function alternatingWindows(
  swings: readonly StructureSwing[],
  pattern: Array<"HIGH" | "LOW">,
): StructureSwing[][] {
  const out: StructureSwing[][] = [];
  for (let i = 0; i + pattern.length <= swings.length; i += 1) {
    const window = swings.slice(i, i + pattern.length);
    if (window.every((s, k) => s.kind === pattern[k])) {
      out.push(window);
    }
  }
  return out;
}

export function matchHeadAndShoulders(ctx: PatternMatcherContext): RawPatternCandidate[] {
  const swings = swingsForMatching(ctx.swings, ctx.policy, !ctx.allowConfirmed);
  const windows = alternatingWindows(swings, ["HIGH", "LOW", "HIGH", "LOW", "HIGH"]);
  const out: RawPatternCandidate[] = [];

  for (const w of windows) {
    const [ls, n1, head, n2, rs] = w as [
      StructureSwing,
      StructureSwing,
      StructureSwing,
      StructureSwing,
      StructureSwing,
    ];
    if (
      barsBetween(ls, n1) < 1
      || barsBetween(n1, head) < 1
      || barsBetween(head, n2) < 1
      || barsBetween(n2, rs) < 1
    ) {
      continue;
    }
    if (
      barsBetween(ls, head) < ctx.policy.minBarsBetweenPivots
      || barsBetween(head, rs) < ctx.policy.minBarsBetweenPivots
    ) {
      continue;
    }

    const midShoulders = priceMid(ls.price, rs.price);
    const promTol = prominenceTol(ctx.policy, midShoulders, ctx.atr);
    const headExcess = head.price - Math.max(ls.price, rs.price);
    if (!(headExcess >= promTol)) continue;

    const symTol = symmetryTol(ctx.policy, midShoulders, ctx.atr);
    if (Math.abs(ls.price - rs.price) > symTol) continue;

    const fit = fitPivotLine([
      { timeSec: n1.time, price: n1.price },
      { timeSec: n2.time, price: n2.price },
    ]);
    if (!fit) continue;

    // Slope bound: |slope| * barSecApprox — use price change per index via time delta.
    const dt = Math.max(n2.time - n1.time, 1);
    const slopePerBarApprox = Math.abs(fit.slopePerSec) * (dt / Math.max(n2.index - n1.index, 1));
    const maxSlope = ctx.policy.maxNecklineSlopeAtrPerBar * ctx.atr;
    if (slopePerBarApprox > maxSlope && maxSlope > 0) continue;

    const neckline = boundaryFromFit("hs-neckline", [
      { timeSec: n1.time, price: n1.price },
      { timeSec: n2.time, price: n2.price },
    ], fit);

    const symScore = 1 - Math.min(1, Math.abs(ls.price - rs.price) / Math.max(symTol, 1e-12));
    const promScore = Math.min(1, headExcess / Math.max(promTol, 1e-12));

    out.push({
      patternType: "HEAD_AND_SHOULDERS",
      pivots: [
        swingToPivot("LEFT_SHOULDER_HIGH", ls),
        swingToPivot("NECKLINE_LOW_1", n1),
        swingToPivot("HEAD_HIGH", head),
        swingToPivot("NECKLINE_LOW_2", n2),
        swingToPivot("RIGHT_SHOULDER_HIGH", rs),
      ],
      neckline,
      upperBoundary: null,
      lowerBoundary: null,
      breakBoundary: neckline,
      breakoutDirection: "BEARISH",
      afterPivotTimeSec: rs.time,
      midPrice: midShoulders,
      geometryValid: true,
      structureInvalidated: false,
      measurements: {
        headExcess,
        prominenceTol: promTol,
        shoulderDelta: Math.abs(ls.price - rs.price),
        symmetryTol: symTol,
        necklineSlopePerSec: fit.slopePerSec,
      },
      geometryFit: (symScore + promScore) / 2,
      depthOrProminence: promScore,
      symmetryOrTouches: symScore,
    });
  }
  return out;
}

export function matchInverseHeadAndShoulders(ctx: PatternMatcherContext): RawPatternCandidate[] {
  const swings = swingsForMatching(ctx.swings, ctx.policy, !ctx.allowConfirmed);
  const windows = alternatingWindows(swings, ["LOW", "HIGH", "LOW", "HIGH", "LOW"]);
  const out: RawPatternCandidate[] = [];

  for (const w of windows) {
    const [ls, n1, head, n2, rs] = w as [
      StructureSwing,
      StructureSwing,
      StructureSwing,
      StructureSwing,
      StructureSwing,
    ];
    if (
      barsBetween(ls, head) < ctx.policy.minBarsBetweenPivots
      || barsBetween(head, rs) < ctx.policy.minBarsBetweenPivots
    ) {
      continue;
    }

    const midShoulders = priceMid(ls.price, rs.price);
    const promTol = prominenceTol(ctx.policy, midShoulders, ctx.atr);
    const headExcess = Math.min(ls.price, rs.price) - head.price;
    if (!(headExcess >= promTol)) continue;

    const symTol = symmetryTol(ctx.policy, midShoulders, ctx.atr);
    if (Math.abs(ls.price - rs.price) > symTol) continue;

    const fit = fitPivotLine([
      { timeSec: n1.time, price: n1.price },
      { timeSec: n2.time, price: n2.price },
    ]);
    if (!fit) continue;

    const dt = Math.max(n2.time - n1.time, 1);
    const slopePerBarApprox = Math.abs(fit.slopePerSec) * (dt / Math.max(n2.index - n1.index, 1));
    const maxSlope = ctx.policy.maxNecklineSlopeAtrPerBar * ctx.atr;
    if (slopePerBarApprox > maxSlope && maxSlope > 0) continue;

    const neckline = boundaryFromFit("ihs-neckline", [
      { timeSec: n1.time, price: n1.price },
      { timeSec: n2.time, price: n2.price },
    ], fit);

    const symScore = 1 - Math.min(1, Math.abs(ls.price - rs.price) / Math.max(symTol, 1e-12));
    const promScore = Math.min(1, headExcess / Math.max(promTol, 1e-12));

    out.push({
      patternType: "INVERSE_HEAD_AND_SHOULDERS",
      pivots: [
        swingToPivot("LEFT_SHOULDER_LOW", ls),
        swingToPivot("NECKLINE_HIGH_1", n1),
        swingToPivot("HEAD_LOW", head),
        swingToPivot("NECKLINE_HIGH_2", n2),
        swingToPivot("RIGHT_SHOULDER_LOW", rs),
      ],
      neckline,
      upperBoundary: null,
      lowerBoundary: null,
      breakBoundary: neckline,
      breakoutDirection: "BULLISH",
      afterPivotTimeSec: rs.time,
      midPrice: midShoulders,
      geometryValid: true,
      structureInvalidated: false,
      measurements: {
        headExcess,
        prominenceTol: promTol,
        shoulderDelta: Math.abs(ls.price - rs.price),
        symmetryTol: symTol,
        necklineSlopePerSec: fit.slopePerSec,
      },
      geometryFit: (symScore + promScore) / 2,
      depthOrProminence: promScore,
      symmetryOrTouches: symScore,
    });
  }
  return out;
}
