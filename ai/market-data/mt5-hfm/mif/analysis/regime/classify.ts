/**
 * Phase 5C Step 2 — deterministic regime classifiers (direction / structure / volatility).
 */
import type { StructureCandle, StructureSwing } from "../../../../../forex-structure/types.js";
import { atrAt } from "../../../../../forex-ai/automated-trading/auto-engine/strategy/evaluate.js";
import { confirmedOnly, isClosedCandle } from "../patterns/geometry.js";
import type {
  MifBreakoutEvidence,
  MifMarketRegimePolicy,
  MifRangeEvidence,
  MifRegimeCompositeLabel,
  MifRegimeDirection,
  MifRegimeStructure,
  MifRegimeVolatility,
  MifTrendEvidence,
  MifVolatilityEvidence,
} from "./types.js";

function closedOnly(candles: readonly StructureCandle[]): StructureCandle[] {
  return candles.filter((c) => isClosedCandle(c));
}

export function classifyTrend(input: {
  swings: readonly StructureSwing[];
  candles: readonly StructureCandle[];
  atr: number;
  policy: MifMarketRegimePolicy;
}): MifTrendEvidence {
  const swings = confirmedOnly(input.swings);
  const highs = swings.filter((s) => s.kind === "HIGH");
  const lows = swings.filter((s) => s.kind === "LOW");

  let higherHighs = 0;
  let lowerHighs = 0;
  for (let i = 1; i < highs.length; i++) {
    if (highs[i]!.price > highs[i - 1]!.price) higherHighs++;
    else if (highs[i]!.price < highs[i - 1]!.price) lowerHighs++;
  }
  let higherLows = 0;
  let lowerLows = 0;
  for (let i = 1; i < lows.length; i++) {
    if (lows[i]!.price > lows[i - 1]!.price) higherLows++;
    else if (lows[i]!.price < lows[i - 1]!.price) lowerLows++;
  }

  const closed = closedOnly(input.candles);
  const look = closed.slice(-input.policy.lookbackBars);
  let displacement: number | null = null;
  let displacementAtr: number | null = null;
  if (look.length >= 2) {
    displacement = look[look.length - 1]!.close - look[0]!.close;
    displacementAtr = input.atr > 0 ? displacement / input.atr : null;
  }

  let directionHint: MifRegimeDirection = "NEUTRAL";
  const upPairs = Math.min(higherHighs, higherLows);
  const downPairs = Math.min(lowerHighs, lowerLows);
  if (
    upPairs >= input.policy.minTrendSwingPairs
    && displacementAtr != null
    && displacementAtr >= input.policy.minTrendDisplacementAtr
  ) {
    directionHint = "UP";
  } else if (
    downPairs >= input.policy.minTrendSwingPairs
    && displacementAtr != null
    && displacementAtr <= -input.policy.minTrendDisplacementAtr
  ) {
    directionHint = "DOWN";
  } else if (
    (upPairs >= input.policy.minTrendSwingPairs && downPairs >= input.policy.minTrendSwingPairs)
    || (upPairs > 0 && downPairs > 0 && Math.abs(upPairs - downPairs) <= 1)
  ) {
    directionHint = "UNKNOWN";
  }

  return {
    higherHighs,
    higherLows,
    lowerHighs,
    lowerLows,
    displacement,
    displacementAtr,
    persistenceBars: look.length,
    directionHint,
  };
}

export function classifyRange(input: {
  candles: readonly StructureCandle[];
  atr: number;
  policy: MifMarketRegimePolicy;
  trend: MifTrendEvidence;
}): MifRangeEvidence {
  const closed = closedOnly(input.candles).slice(-input.policy.lookbackBars);
  if (closed.length < 5) {
    return {
      high: null,
      low: null,
      width: null,
      widthAtr: null,
      containmentRatio: null,
      displacementAtr: input.trend.displacementAtr,
    };
  }
  const high = Math.max(...closed.map((c) => c.high));
  const low = Math.min(...closed.map((c) => c.low));
  const width = high - low;
  const widthAtr = input.atr > 0 ? width / input.atr : null;
  const midBand = (high + low) / 2;
  const half = width / 2;
  let inside = 0;
  for (const c of closed) {
    if (c.close >= midBand - half && c.close <= midBand + half) inside++;
  }
  const containmentRatio = inside / closed.length;
  return {
    high,
    low,
    width,
    widthAtr,
    containmentRatio,
    displacementAtr: input.trend.displacementAtr,
  };
}

export function classifyBreakout(input: {
  candles: readonly StructureCandle[];
  atr: number;
  policy: MifMarketRegimePolicy;
  range: MifRangeEvidence;
}): MifBreakoutEvidence {
  const empty: MifBreakoutEvidence = {
    state: "NONE",
    direction: "NEUTRAL",
    boundary: null,
    breakCandleOpenTimeSec: null,
    displacementAtr: null,
    followThroughBars: 0,
  };
  if (input.range.high == null || input.range.low == null) return empty;

  const closed = closedOnly(input.candles);
  if (closed.length < input.policy.lookbackBars + input.policy.breakoutConfirmBars) {
    return empty;
  }

  // Prior range from lookback excluding the most recent breakoutConfirmBars+fail window tip.
  const tipCount = input.policy.breakoutConfirmBars + input.policy.breakoutFailBars;
  const body = closed.slice(0, Math.max(0, closed.length - tipCount));
  const prior = body.slice(-input.policy.lookbackBars);
  if (prior.length < 5) return empty;

  const priorHigh = Math.max(...prior.map((c) => c.high));
  const priorLow = Math.min(...prior.map((c) => c.low));
  // Prior window must look range-like — skip breakout labeling on already-trending legs.
  const priorDisp = prior[prior.length - 1]!.close - prior[0]!.close;
  if (
    input.atr > 0
    && Math.abs(priorDisp) / input.atr > input.policy.minTrendDisplacementAtr
  ) {
    return empty;
  }
  const buf = input.policy.breakoutBufferAtr * input.atr;
  const priorEndTime = prior[prior.length - 1]!.time;
  const afterStart = closed.findIndex((c) => c.time > priorEndTime);
  const after = afterStart >= 0 ? closed.slice(afterStart) : [];

  let breakCandle: StructureCandle | null = null;
  let direction: MifRegimeDirection = "NEUTRAL";
  let boundary: number | null = null;

  for (const c of after) {
    if (c.close > priorHigh + buf) {
      breakCandle = c;
      direction = "UP";
      boundary = priorHigh;
      break;
    }
    if (c.close < priorLow - buf) {
      breakCandle = c;
      direction = "DOWN";
      boundary = priorLow;
      break;
    }
  }
  if (!breakCandle || boundary == null) return empty;

  const post = after.filter((c) => c.time > breakCandle!.time);
  let follow = 0;
  let failed = false;
  for (const c of post.slice(0, input.policy.breakoutFailBars)) {
    if (direction === "UP") {
      if (c.close > boundary + buf) follow++;
      if (c.close < boundary - buf) {
        failed = true;
        break;
      }
    } else {
      if (c.close < boundary - buf) follow++;
      if (c.close > boundary + buf) {
        failed = true;
        break;
      }
    }
  }

  const disp =
    input.atr > 0
      ? (direction === "UP"
        ? (breakCandle.close - boundary) / input.atr
        : (boundary - breakCandle.close) / input.atr)
      : null;

  if (failed) {
    return {
      state: "FAILED",
      direction,
      boundary,
      breakCandleOpenTimeSec: breakCandle.time,
      displacementAtr: disp,
      followThroughBars: follow,
    };
  }
  if (follow >= input.policy.breakoutConfirmBars) {
    return {
      state: "CONFIRMED",
      direction,
      boundary,
      breakCandleOpenTimeSec: breakCandle.time,
      displacementAtr: disp,
      followThroughBars: follow,
    };
  }
  return {
    state: "POTENTIAL",
    direction,
    boundary,
    breakCandleOpenTimeSec: breakCandle.time,
    displacementAtr: disp,
    followThroughBars: follow,
  };
}

export function classifyVolatility(input: {
  candles: readonly StructureCandle[];
  atr: number;
  atrPeriod: number;
  policy: MifMarketRegimePolicy;
}): MifVolatilityEvidence {
  const closed = closedOnly(input.candles);
  const highs = closed.map((c) => c.high);
  const lows = closed.map((c) => c.low);
  const closes = closed.map((c) => c.close);

  const baselineSamples: number[] = [];
  const start = Math.max(input.atrPeriod, closed.length - input.policy.atrBaselineLookback);
  for (let i = start; i < closed.length; i++) {
    const v = atrAt(highs, lows, closes, input.atrPeriod, i);
    if (v != null && v > 0) baselineSamples.push(v);
  }
  const atrBaseline =
    baselineSamples.length > 0
      ? baselineSamples.reduce((a, b) => a + b, 0) / baselineSamples.length
      : null;
  const atrRatio =
    atrBaseline != null && atrBaseline > 0 ? input.atr / atrBaseline : null;

  let classification: MifRegimeVolatility = "UNKNOWN";
  if (atrRatio != null) {
    if (atrRatio <= input.policy.volLowMax) classification = "LOW";
    else if (atrRatio <= input.policy.volNormalMax) classification = "NORMAL";
    else if (atrRatio <= input.policy.volHighMax) classification = "HIGH";
    else classification = "EXTREME";
  }

  return {
    atr: input.atr,
    atrBaseline,
    atrRatio,
    classification,
  };
}

export function resolveStructure(input: {
  trend: MifTrendEvidence;
  range: MifRangeEvidence;
  breakout: MifBreakoutEvidence;
  policy: MifMarketRegimePolicy;
  previousStructure?: MifRegimeStructure | null;
}): {
  structure: MifRegimeStructure;
  direction: MifRegimeDirection;
  conflicting: boolean;
} {
  const { trend, range, breakout, policy } = input;
  let conflicting = false;

  const trending =
    (trend.directionHint === "UP" || trend.directionHint === "DOWN")
    && trend.displacementAtr != null
    && Math.abs(trend.displacementAtr) >= policy.minTrendDisplacementAtr;

  // Confirmed breakout wins only when the market is not already a sustained trend.
  if (breakout.state === "CONFIRMED" && !trending) {
    return {
      structure: "BREAKOUT",
      direction: breakout.direction,
      conflicting: false,
    };
  }

  const ranging =
    range.widthAtr != null
    && range.widthAtr >= policy.minRangeWidthAtr
    && range.widthAtr <= policy.maxRangeWidthAtr
    && range.displacementAtr != null
    && Math.abs(range.displacementAtr) <= policy.maxRangeDisplacementAtr
    && (range.containmentRatio ?? 0) >= 0.6
    && trend.directionHint !== "UP"
    && trend.directionHint !== "DOWN";

  if (trending && ranging) {
    conflicting = true;
    return { structure: "UNSTABLE", direction: "UNKNOWN", conflicting };
  }

  if (breakout.state === "FAILED") {
    return {
      structure: ranging ? "RANGING" : "TRANSITION",
      direction: ranging ? "NEUTRAL" : "UNKNOWN",
      conflicting: false,
    };
  }

  if (trending) {
    return {
      structure: "TRENDING",
      direction: trend.directionHint,
      conflicting: false,
    };
  }

  if (ranging) {
    return { structure: "RANGING", direction: "NEUTRAL", conflicting: false };
  }

  if (breakout.state === "POTENTIAL") {
    return {
      structure: "TRANSITION",
      direction: breakout.direction,
      conflicting: false,
    };
  }

  if (trend.directionHint === "UNKNOWN") {
    return { structure: "UNSTABLE", direction: "UNKNOWN", conflicting: true };
  }

  // Soft evidence → transition rather than inventing a firm label.
  return { structure: "TRANSITION", direction: trend.directionHint, conflicting: false };
}

export function applyHysteresis(input: {
  candidate: MifRegimeStructure;
  previous: MifRegimeStructure | null | undefined;
  persistBars: number;
  sameCandidateStreak: number;
}): { structure: MifRegimeStructure; hysteresisHeld: boolean } {
  if (!input.previous || input.previous === input.candidate) {
    return { structure: input.candidate, hysteresisHeld: false };
  }
  if (input.sameCandidateStreak >= input.persistBars) {
    return { structure: input.candidate, hysteresisHeld: false };
  }
  return { structure: input.previous, hysteresisHeld: true };
}

export function compositeLabel(input: {
  direction: MifRegimeDirection;
  structure: MifRegimeStructure;
  volatility: MifRegimeVolatility;
  status: "VALID" | "WARNING" | "DEGRADED" | "BLOCKED" | "INSUFFICIENT_DATA";
}): MifRegimeCompositeLabel {
  if (input.status === "INSUFFICIENT_DATA" || input.status === "BLOCKED") {
    return "INSUFFICIENT_DATA";
  }
  if (input.structure === "UNSTABLE") return "UNSTABLE";
  if (input.structure === "TRANSITION") return "TRANSITION";
  if (input.structure === "BREAKOUT") return "BREAKOUT";
  if (input.structure === "RANGING") return "RANGING";
  if (input.structure === "TRENDING" && input.direction === "UP") return "TRENDING_UP";
  if (input.structure === "TRENDING" && input.direction === "DOWN") return "TRENDING_DOWN";
  if (input.volatility === "HIGH" || input.volatility === "EXTREME") return "HIGH_VOLATILITY";
  if (input.volatility === "LOW") return "LOW_VOLATILITY";
  return "TRANSITION";
}
