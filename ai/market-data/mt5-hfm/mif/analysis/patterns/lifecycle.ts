/**
 * Phase 5C Step 1B — pattern lifecycle resolution.
 * FORMING / CONFIRMED / FAILED / INVALIDATED are distinct — never conflated.
 */
import type { StructureCandle } from "../../../../../forex-structure/types.js";
import {
  breakoutBuffer,
  closedCandlesAfter,
  isClosedCandle,
  linePriceAt,
} from "./geometry.js";
import type {
  MifChartPatternBoundary,
  MifChartPatternBreakoutDirection,
  MifChartPatternConfirmationEvidence,
  MifChartPatternLifecycle,
  MifChartPatternPolicy,
  MifChartPatternRetestEvidence,
} from "./types.js";

export interface LifecycleInput {
  geometryValid: boolean;
  structureInvalidated: boolean;
  policy: MifChartPatternPolicy;
  atr: number;
  midPrice: number;
  /** Boundary used for breakout (neckline or triangle side). */
  breakBoundary: MifChartPatternBoundary | null;
  breakoutDirection: MifChartPatternBreakoutDirection;
  /** Last pattern pivot time — breakout candles must be strictly after. */
  afterPivotTimeSec: number;
  candles: readonly StructureCandle[];
  /** When false, CONFIRMED is unavailable (quality / provisional). */
  allowConfirmed: boolean;
}

function boundaryPrice(b: MifChartPatternBoundary, timeSec: number): number {
  if (b.kind === "horizontal" || Math.abs(b.slopePerSec) < 1e-18) {
    return b.priceAtStart;
  }
  // Reconstruct intercept from start point.
  const intercept = b.priceAtStart - b.slopePerSec * b.timeSecStart;
  return linePriceAt(b.slopePerSec, intercept, timeSec);
}

export function evaluateBreakoutAndLifecycle(
  input: LifecycleInput,
): {
  lifecycle: MifChartPatternLifecycle;
  confirmation: MifChartPatternConfirmationEvidence;
  retest: MifChartPatternRetestEvidence;
} {
  const emptyConfirm: MifChartPatternConfirmationEvidence = {
    met: false,
    direction: "NONE",
    candleOpenTimeSec: null,
    candleClose: null,
    candleState: null,
    boundaryPriceAtBreak: null,
    bufferUsed: null,
  };
  const emptyRetest: MifChartPatternRetestEvidence = {
    observed: false,
    candleOpenTimeSec: null,
    advisoryOnly: true,
  };

  if (input.structureInvalidated) {
    return {
      lifecycle: "INVALIDATED",
      confirmation: emptyConfirm,
      retest: emptyRetest,
    };
  }
  if (!input.geometryValid || !input.breakBoundary) {
    return {
      lifecycle: "INVALIDATED",
      confirmation: emptyConfirm,
      retest: emptyRetest,
    };
  }

  const buf = breakoutBuffer(input.policy, input.midPrice, input.atr);
  const after = closedCandlesAfter(input.candles, input.afterPivotTimeSec);
  let breakCandle: StructureCandle | null = null;
  let boundaryAtBreak: number | null = null;

  for (const c of after) {
    if (!isClosedCandle(c)) continue; // FORMING never confirms
    const level = boundaryPrice(input.breakBoundary, c.time);
    const bearishOk =
      input.breakoutDirection === "BEARISH" && c.close < level - buf;
    const bullishOk =
      input.breakoutDirection === "BULLISH" && c.close > level + buf;
    if (bearishOk || bullishOk) {
      breakCandle = c;
      boundaryAtBreak = level;
      break;
    }
  }

  if (!breakCandle) {
    // Advisory: forming tip beyond boundary does not confirm.
    return {
      lifecycle: "FORMING",
      confirmation: {
        ...emptyConfirm,
        direction: input.breakoutDirection,
        bufferUsed: buf,
      },
      retest: emptyRetest,
    };
  }

  const confirmation: MifChartPatternConfirmationEvidence = {
    met: true,
    direction: input.breakoutDirection,
    candleOpenTimeSec: breakCandle.time,
    candleClose: breakCandle.close,
    candleState: "CLOSED",
    boundaryPriceAtBreak: boundaryAtBreak,
    bufferUsed: buf,
  };

  // Failure: within failureWindowBars after break, closed close back through boundary.
  const post = closedCandlesAfter(input.candles, breakCandle.time)
    .filter((c) => isClosedCandle(c))
    .slice(0, input.policy.failureWindowBars);

  let failed = false;
  for (const c of post) {
    const level = boundaryPrice(input.breakBoundary, c.time);
    if (input.breakoutDirection === "BEARISH" && c.close > level + buf) {
      failed = true;
      break;
    }
    if (input.breakoutDirection === "BULLISH" && c.close < level - buf) {
      failed = true;
      break;
    }
  }

  // Advisory retest: touch near boundary after break without failing.
  let retestTime: number | null = null;
  if (!failed) {
    for (const c of post) {
      const level = boundaryPrice(input.breakBoundary, c.time);
      const near = Math.abs(c.low - level) <= buf * 2 || Math.abs(c.high - level) <= buf * 2
        || Math.abs(c.close - level) <= buf * 2;
      if (near) {
        retestTime = c.time;
        break;
      }
    }
  }

  if (failed) {
    return {
      lifecycle: "FAILED",
      confirmation,
      retest: { observed: false, candleOpenTimeSec: null, advisoryOnly: true },
    };
  }

  if (!input.allowConfirmed) {
    // Geometry+breakout seen but quality/policy forbids CONFIRMED → keep FORMING.
    return {
      lifecycle: "FORMING",
      confirmation: { ...confirmation, met: false },
      retest: {
        observed: retestTime != null,
        candleOpenTimeSec: retestTime,
        advisoryOnly: true,
      },
    };
  }

  return {
    lifecycle: "CONFIRMED",
    confirmation,
    retest: {
      observed: retestTime != null,
      candleOpenTimeSec: retestTime,
      advisoryOnly: true,
    },
  };
}

export function confidenceComposite(parts: {
  geometryFit: number;
  depthOrProminence: number;
  symmetryOrTouches: number;
  qualityGate: number;
  breakoutClarity: number;
}): {
  geometryFit: number;
  depthOrProminence: number;
  symmetryOrTouches: number;
  qualityGate: number;
  breakoutClarity: number;
  composite: number;
} {
  const clamp = (x: number) => Math.max(0, Math.min(1, x));
  const geometryFit = clamp(parts.geometryFit);
  const depthOrProminence = clamp(parts.depthOrProminence);
  const symmetryOrTouches = clamp(parts.symmetryOrTouches);
  const qualityGate = clamp(parts.qualityGate);
  const breakoutClarity = clamp(parts.breakoutClarity);
  const composite = clamp(
    0.3 * geometryFit
      + 0.2 * depthOrProminence
      + 0.2 * symmetryOrTouches
      + 0.15 * qualityGate
      + 0.15 * breakoutClarity,
  );
  return {
    geometryFit,
    depthOrProminence,
    symmetryOrTouches,
    qualityGate,
    breakoutClarity,
    composite,
  };
}
