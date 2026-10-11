/**
 * Explicit candlestick pattern rules for candlestick-patterns-v1.
 * Each matcher returns null when geometry does not qualify.
 */

import {
  bodyEngulfs,
  bodyMidpoint,
  bodyRatio,
  isZeroRange,
  measureCandle,
} from "./geometry.js";
import type { PatternCandle, PatternDirection, PatternRuleParams } from "./types.js";

export interface PatternMatch {
  patternId: string;
  patternName: string;
  direction: PatternDirection;
  evidence: string[];
  confirmationRequirement: string;
  invalidationCondition: string;
  warnings: string[];
  /** Parameter keys relevant to this rule (for evidence transparency). */
  paramKeys: string[];
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  const abs = Math.abs(n);
  if (abs !== 0 && (abs < 1e-4 || abs >= 1e6)) return n.toExponential(4);
  return Number(n.toPrecision(8)).toString();
}

export function matchDoji(candle: PatternCandle, params: PatternRuleParams): PatternMatch | null {
  if (isZeroRange(candle, params)) return null;
  const ratio = bodyRatio(candle, params);
  if (ratio == null || ratio > params.dojiBodyMaxRatio) return null;
  const g = measureCandle(candle, params);
  return {
    patternId: "doji",
    patternName: "Doji",
    direction: "NEUTRAL",
    evidence: [
      `body/range=${fmt(ratio)} <= dojiBodyMaxRatio=${params.dojiBodyMaxRatio}`,
      `range=${fmt(g.range)} > 0`,
    ],
    confirmationRequirement: "Candle must be closed for CONFIRMED status.",
    invalidationCondition: "A subsequent closed candle with body/range above dojiBodyMaxRatio on the same bar is not applicable; pattern is bar-local.",
    warnings: [],
    paramKeys: ["dojiBodyMaxRatio", "minRangeEpsilon"],
  };
}

export function matchHammer(candle: PatternCandle, params: PatternRuleParams): PatternMatch | null {
  if (isZeroRange(candle, params)) return null;
  const g = measureCandle(candle, params);
  const ratio = g.body / g.range;
  if (ratio > params.hammerBodyMaxRatio) return null;
  if (g.lowerWick < params.hammerLowerWickMinRatio * g.body) return null;
  if (g.upperWick > params.hammerUpperWickMaxRatio * g.body) return null;
  return {
    patternId: "hammer",
    patternName: "Hammer",
    direction: "BULLISH",
    evidence: [
      `body/range=${fmt(ratio)} <= hammerBodyMaxRatio=${params.hammerBodyMaxRatio}`,
      `lowerWick=${fmt(g.lowerWick)} >= ${params.hammerLowerWickMinRatio}×body=${fmt(params.hammerLowerWickMinRatio * g.body)}`,
      `upperWick=${fmt(g.upperWick)} <= ${params.hammerUpperWickMaxRatio}×body=${fmt(params.hammerUpperWickMaxRatio * g.body)}`,
      "small body near high (long lower wick)",
    ],
    confirmationRequirement: "Candle must be closed for CONFIRMED status.",
    invalidationCondition: "Close of a following candle below the hammer low weakens the bullish reading (educational note).",
    warnings: [],
    paramKeys: [
      "hammerBodyMaxRatio",
      "hammerLowerWickMinRatio",
      "hammerUpperWickMaxRatio",
      "minRangeEpsilon",
    ],
  };
}

export function matchShootingStar(candle: PatternCandle, params: PatternRuleParams): PatternMatch | null {
  if (isZeroRange(candle, params)) return null;
  const g = measureCandle(candle, params);
  const ratio = g.body / g.range;
  if (ratio > params.shootingStarBodyMaxRatio) return null;
  if (g.upperWick < params.shootingStarUpperWickMinRatio * g.body) return null;
  if (g.lowerWick > params.shootingStarLowerWickMaxRatio * g.body) return null;
  return {
    patternId: "shooting_star",
    patternName: "Shooting Star",
    direction: "BEARISH",
    evidence: [
      `body/range=${fmt(ratio)} <= shootingStarBodyMaxRatio=${params.shootingStarBodyMaxRatio}`,
      `upperWick=${fmt(g.upperWick)} >= ${params.shootingStarUpperWickMinRatio}×body=${fmt(params.shootingStarUpperWickMinRatio * g.body)}`,
      `lowerWick=${fmt(g.lowerWick)} <= ${params.shootingStarLowerWickMaxRatio}×body=${fmt(params.shootingStarLowerWickMaxRatio * g.body)}`,
      "small body near low (long upper wick)",
    ],
    confirmationRequirement: "Candle must be closed for CONFIRMED status.",
    invalidationCondition: "Close of a following candle above the shooting star high weakens the bearish reading (educational note).",
    warnings: [],
    paramKeys: [
      "shootingStarBodyMaxRatio",
      "shootingStarUpperWickMinRatio",
      "shootingStarLowerWickMaxRatio",
      "minRangeEpsilon",
    ],
  };
}

export function matchBullishEngulfing(
  prior: PatternCandle,
  current: PatternCandle,
  params: PatternRuleParams,
): PatternMatch | null {
  if (isZeroRange(prior, params) || isZeroRange(current, params)) return null;
  const g0 = measureCandle(prior, params);
  const g1 = measureCandle(current, params);
  if (!g0.isBearish || !g1.isBullish) return null;
  const r0 = g0.body / g0.range;
  const r1 = g1.body / g1.range;
  if (r0 < params.engulfingMinBodyRatio || r1 < params.engulfingMinBodyRatio) return null;
  if (!bodyEngulfs(current, prior)) return null;
  return {
    patternId: "bullish_engulfing",
    patternName: "Bullish Engulfing",
    direction: "BULLISH",
    evidence: [
      "prior candle bearish (close < open)",
      "current candle bullish (close > open)",
      `prior body/range=${fmt(r0)} >= engulfingMinBodyRatio=${params.engulfingMinBodyRatio}`,
      `current body/range=${fmt(r1)} >= engulfingMinBodyRatio=${params.engulfingMinBodyRatio}`,
      "current body engulfs prior body",
    ],
    confirmationRequirement: "Last candle of the pair must be closed for CONFIRMED status.",
    invalidationCondition: "Close back inside or below the engulfed body on a following candle weakens the reading (educational note).",
    warnings: [],
    paramKeys: ["engulfingMinBodyRatio", "minRangeEpsilon"],
  };
}

export function matchBearishEngulfing(
  prior: PatternCandle,
  current: PatternCandle,
  params: PatternRuleParams,
): PatternMatch | null {
  if (isZeroRange(prior, params) || isZeroRange(current, params)) return null;
  const g0 = measureCandle(prior, params);
  const g1 = measureCandle(current, params);
  if (!g0.isBullish || !g1.isBearish) return null;
  const r0 = g0.body / g0.range;
  const r1 = g1.body / g1.range;
  if (r0 < params.engulfingMinBodyRatio || r1 < params.engulfingMinBodyRatio) return null;
  if (!bodyEngulfs(current, prior)) return null;
  return {
    patternId: "bearish_engulfing",
    patternName: "Bearish Engulfing",
    direction: "BEARISH",
    evidence: [
      "prior candle bullish (close > open)",
      "current candle bearish (close < open)",
      `prior body/range=${fmt(r0)} >= engulfingMinBodyRatio=${params.engulfingMinBodyRatio}`,
      `current body/range=${fmt(r1)} >= engulfingMinBodyRatio=${params.engulfingMinBodyRatio}`,
      "current body engulfs prior body",
    ],
    confirmationRequirement: "Last candle of the pair must be closed for CONFIRMED status.",
    invalidationCondition: "Close back inside or above the engulfed body on a following candle weakens the reading (educational note).",
    warnings: [],
    paramKeys: ["engulfingMinBodyRatio", "minRangeEpsilon"],
  };
}

/**
 * Soft middle qualification for stars:
 * - middle body/range <= starMiddleBodyMaxRatio, AND
 * - either middle sits between the opposing first/third bodies (soft), OR
 *   middle close is in the soft gap zone between first close and third open.
 */
function softStarMiddleOk(
  first: PatternCandle,
  middle: PatternCandle,
  third: PatternCandle,
  params: PatternRuleParams,
): { ok: boolean; evidence: string[] } {
  if (isZeroRange(middle, params)) {
    return { ok: false, evidence: [] };
  }
  const gm = measureCandle(middle, params);
  const middleRatio = gm.body / gm.range;
  if (middleRatio > params.starMiddleBodyMaxRatio) {
    return { ok: false, evidence: [] };
  }

  const firstBodyTop = Math.max(first.open, first.close);
  const firstBodyBottom = Math.min(first.open, first.close);
  const thirdBodyTop = Math.max(third.open, third.close);
  const thirdBodyBottom = Math.min(third.open, third.close);
  const betweenOpposites =
    gm.bodyTop <= Math.max(firstBodyTop, thirdBodyTop)
    && gm.bodyBottom >= Math.min(firstBodyBottom, thirdBodyBottom);

  const gapLo = Math.min(first.close, third.open);
  const gapHi = Math.max(first.close, third.open);
  const gapSpan = gapHi - gapLo;
  const pad = gapSpan * params.starGapOrPenetrationFactor;
  const inGapZone =
    middle.close >= gapLo - pad
    && middle.close <= gapHi + pad;

  if (!betweenOpposites && !inGapZone) {
    return { ok: false, evidence: [] };
  }

  const evidence = [
    `middle body/range=${fmt(middleRatio)} <= starMiddleBodyMaxRatio=${params.starMiddleBodyMaxRatio}`,
  ];
  if (betweenOpposites) {
    evidence.push("middle body between first/third opposing bodies (soft)");
  }
  if (inGapZone) {
    evidence.push(
      `middle close in soft gap zone (factor=${params.starGapOrPenetrationFactor})`,
    );
  }
  return { ok: true, evidence };
}

export function matchMorningStar(
  first: PatternCandle,
  middle: PatternCandle,
  third: PatternCandle,
  params: PatternRuleParams,
): PatternMatch | null {
  if (
    isZeroRange(first, params)
    || isZeroRange(middle, params)
    || isZeroRange(third, params)
  ) {
    return null;
  }
  const g0 = measureCandle(first, params);
  const g2 = measureCandle(third, params);
  if (!g0.isBearish || !g2.isBullish) return null;
  const r0 = g0.body / g0.range;
  if (r0 < params.engulfingMinBodyRatio) return null;

  const mid = softStarMiddleOk(first, middle, third, params);
  if (!mid.ok) return null;

  const midpoint = bodyMidpoint(first);
  if (third.close < midpoint) return null;

  return {
    patternId: "morning_star",
    patternName: "Morning Star",
    direction: "BULLISH",
    evidence: [
      `first candle bearish with body/range=${fmt(r0)} >= engulfingMinBodyRatio=${params.engulfingMinBodyRatio}`,
      ...mid.evidence,
      `third candle bullish closing at/above first body midpoint (${fmt(midpoint)})`,
      `third close=${fmt(third.close)}`,
    ],
    confirmationRequirement: "All three candles must be closed for CONFIRMED status.",
    invalidationCondition: "Close below the middle candle low on a following bar weakens the bullish star reading (educational note).",
    warnings: [],
    paramKeys: [
      "engulfingMinBodyRatio",
      "starMiddleBodyMaxRatio",
      "starGapOrPenetrationFactor",
      "minRangeEpsilon",
    ],
  };
}

export function matchEveningStar(
  first: PatternCandle,
  middle: PatternCandle,
  third: PatternCandle,
  params: PatternRuleParams,
): PatternMatch | null {
  if (
    isZeroRange(first, params)
    || isZeroRange(middle, params)
    || isZeroRange(third, params)
  ) {
    return null;
  }
  const g0 = measureCandle(first, params);
  const g2 = measureCandle(third, params);
  if (!g0.isBullish || !g2.isBearish) return null;
  const r0 = g0.body / g0.range;
  if (r0 < params.engulfingMinBodyRatio) return null;

  const mid = softStarMiddleOk(first, middle, third, params);
  if (!mid.ok) return null;

  const midpoint = bodyMidpoint(first);
  if (third.close > midpoint) return null;

  return {
    patternId: "evening_star",
    patternName: "Evening Star",
    direction: "BEARISH",
    evidence: [
      `first candle bullish with body/range=${fmt(r0)} >= engulfingMinBodyRatio=${params.engulfingMinBodyRatio}`,
      ...mid.evidence,
      `third candle bearish closing at/below first body midpoint (${fmt(midpoint)})`,
      `third close=${fmt(third.close)}`,
    ],
    confirmationRequirement: "All three candles must be closed for CONFIRMED status.",
    invalidationCondition: "Close above the middle candle high on a following bar weakens the bearish star reading (educational note).",
    warnings: [],
    paramKeys: [
      "engulfingMinBodyRatio",
      "starMiddleBodyMaxRatio",
      "starGapOrPenetrationFactor",
      "minRangeEpsilon",
    ],
  };
}

/** Run all applicable rules ending at `endIndex` (inclusive) within `candles`. */
export function matchPatternsAtEnd(
  candles: PatternCandle[],
  endIndex: number,
  params: PatternRuleParams,
): PatternMatch[] {
  const matches: PatternMatch[] = [];
  const c = candles[endIndex];
  if (!c) return matches;

  const doji = matchDoji(c, params);
  if (doji) matches.push(doji);
  const hammer = matchHammer(c, params);
  if (hammer) matches.push(hammer);
  const star = matchShootingStar(c, params);
  if (star) matches.push(star);

  if (endIndex >= 1) {
    const prior = candles[endIndex - 1]!;
    const bull = matchBullishEngulfing(prior, c, params);
    if (bull) matches.push(bull);
    const bear = matchBearishEngulfing(prior, c, params);
    if (bear) matches.push(bear);
  }

  if (endIndex >= 2) {
    const a = candles[endIndex - 2]!;
    const b = candles[endIndex - 1]!;
    const morning = matchMorningStar(a, b, c, params);
    if (morning) matches.push(morning);
    const evening = matchEveningStar(a, b, c, params);
    if (evening) matches.push(evening);
  }

  return matches;
}
