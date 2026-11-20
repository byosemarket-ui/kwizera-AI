/**
 * Phase 5F STEP 3 — direction-aware price-path metrics (forward return / MFE / MAE).
 * Distinct from level-based outcomes. NEUTRAL/UNKNOWN are not evaluated as BUY.
 */
import type { MifCanonicalCandle } from "../canonical/candle.js";
import {
  MIF_PREDICTION_DEFAULT_HORIZONS,
  MIF_PREDICTION_PATH_METRICS_POLICY_ID,
  MIF_PREDICTION_PATH_METRICS_POLICY_VERSION,
} from "./contracts.js";
import type {
  MifPredictionDirection,
  MifPredictionEntryReferenceKind,
  MifPredictionHorizonCompleteness,
  MifPredictionPathHorizonMetric,
  MifPredictionPathOutcome,
  MifPredictionSnapshot,
} from "./types.js";

function isValidPrice(n: number | null | undefined): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

function detectGapFlags(candles: readonly MifCanonicalCandle[]): string[] {
  if (candles.length < 3) return [];
  const steps: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    steps.push(candles[i]!.openTimeSec - candles[i - 1]!.openTimeSec);
  }
  steps.sort((a, b) => a - b);
  const median = steps[Math.floor(steps.length / 2)]!;
  const flags: string[] = [];
  if (median > 0 && steps.some((s) => s > median * 2.5)) {
    flags.push("IRREGULAR_SPACING");
  }
  return flags;
}

export function resolveEntryReference(input: {
  snapshot: MifPredictionSnapshot;
  activationClose: number | null;
}): {
  entryPrice: number | null;
  entryReferenceKind: MifPredictionEntryReferenceKind;
} {
  const structured = input.snapshot.levels.entry.price;
  if (isValidPrice(structured)) {
    return { entryPrice: structured, entryReferenceKind: "STRUCTURED_ENTRY" };
  }
  if (
    input.snapshot.allowActivationCloseAsEntry
    && isValidPrice(input.activationClose)
  ) {
    return {
      entryPrice: input.activationClose,
      entryReferenceKind: "ACTIVATION_CLOSE",
    };
  }
  return { entryPrice: null, entryReferenceKind: "MISSING" };
}

/**
 * BUY:  FR=(close-entry)/entry; MFE=(maxHigh-entry)/entry; MAE=(minLow-entry)/entry
 * SELL: FR=(entry-close)/entry; MFE=(entry-minLow)/entry; MAE=(entry-maxHigh)/entry
 */
export function computeDirectionalPathMetrics(input: {
  direction: MifPredictionDirection;
  entry: number;
  window: readonly MifCanonicalCandle[];
}): {
  forwardReturn: number | null;
  mfe: number | null;
  mae: number | null;
} {
  if (!isValidPrice(input.entry) || input.window.length === 0) {
    return { forwardReturn: null, mfe: null, mae: null };
  }
  const last = input.window[input.window.length - 1]!;
  if (input.direction === "BUY") {
    const forwardReturn = isValidPrice(last.close)
      ? (last.close - input.entry) / input.entry
      : null;
    let mfe = Number.NEGATIVE_INFINITY;
    let mae = Number.POSITIVE_INFINITY;
    for (const c of input.window) {
      if (isValidPrice(c.high)) mfe = Math.max(mfe, (c.high - input.entry) / input.entry);
      if (isValidPrice(c.low)) mae = Math.min(mae, (c.low - input.entry) / input.entry);
    }
    return {
      forwardReturn,
      mfe: Number.isFinite(mfe) ? mfe : null,
      mae: Number.isFinite(mae) ? mae : null,
    };
  }
  if (input.direction === "SELL") {
    const forwardReturn = isValidPrice(last.close)
      ? (input.entry - last.close) / input.entry
      : null;
    let mfe = Number.NEGATIVE_INFINITY;
    let mae = Number.POSITIVE_INFINITY;
    for (const c of input.window) {
      if (isValidPrice(c.low)) mfe = Math.max(mfe, (input.entry - c.low) / input.entry);
      if (isValidPrice(c.high)) mae = Math.min(mae, (input.entry - c.high) / input.entry);
    }
    return {
      forwardReturn,
      mfe: Number.isFinite(mfe) ? mfe : null,
      mae: Number.isFinite(mae) ? mae : null,
    };
  }
  return { forwardReturn: null, mfe: null, mae: null };
}

/**
 * Compute multi-horizon path outcome from future CLOSED bars strictly after activation.
 */
export function computePathOutcome(input: {
  snapshot: MifPredictionSnapshot;
  futureClosedCandles: readonly MifCanonicalCandle[];
  activationClose: number | null;
  horizons?: readonly number[];
}): MifPredictionPathOutcome {
  const horizons = [...(input.horizons ?? MIF_PREDICTION_DEFAULT_HORIZONS)];
  const future = [...input.futureClosedCandles].sort(
    (a, b) => a.openTimeSec - b.openTimeSec,
  );
  const gapFlags = detectGapFlags(future);
  const { entryPrice, entryReferenceKind } = resolveEntryReference({
    snapshot: input.snapshot,
    activationClose: input.activationClose,
  });

  const direction = input.snapshot.direction;
  const observationWindow = {
    activationOpenTimeSec: input.snapshot.activationOpenTimeSec,
    firstFutureOpenTimeSec: future[0]?.openTimeSec ?? null,
    lastFutureOpenTimeSec: future[future.length - 1]?.openTimeSec ?? null,
    futureBarCount: future.length,
  };

  if (direction === "NEUTRAL" || direction === "UNKNOWN") {
    return {
      policyId: MIF_PREDICTION_PATH_METRICS_POLICY_ID,
      policyVersion: MIF_PREDICTION_PATH_METRICS_POLICY_VERSION,
      direction,
      entryReferenceKind,
      entryPrice,
      activationClose: input.activationClose,
      horizons: horizons.map((h) => unsupportedHorizon(h, entryReferenceKind, entryPrice, "UNSUPPORTED_DIRECTION")),
      observationWindow,
      gapDetected: gapFlags.length > 0,
      gapFlags,
      unsupportedReason: `direction ${direction} has no directional path-metric policy`,
    };
  }

  if (!isValidPrice(entryPrice)) {
    return {
      policyId: MIF_PREDICTION_PATH_METRICS_POLICY_ID,
      policyVersion: MIF_PREDICTION_PATH_METRICS_POLICY_VERSION,
      direction,
      entryReferenceKind: "MISSING",
      entryPrice: null,
      activationClose: input.activationClose,
      horizons: horizons.map((h) => unsupportedHorizon(h, "MISSING", null, "INVALID_ENTRY")),
      observationWindow,
      gapDetected: gapFlags.length > 0,
      gapFlags,
      unsupportedReason: "no valid entry reference (structured entry and activation close both missing/invalid)",
    };
  }

  const horizonMetrics: MifPredictionPathHorizonMetric[] = horizons.map((h) => {
    if (h < 1) {
      return unsupportedHorizon(h, entryReferenceKind, entryPrice, "INSUFFICIENT");
    }
    if (future.length === 0) {
      return {
        requestedHorizon: h,
        availableCandles: 0,
        requiredCandles: h,
        completeness: "INSUFFICIENT",
        forwardReturn: null,
        mfe: null,
        mae: null,
        lastObservedOpenTimeSec: null,
        gapFlags: ["NO_FUTURE_BARS"],
        entryReferenceKind,
        entryPrice,
        evaluationRange: { firstOpenTimeSec: null, lastOpenTimeSec: null, barCount: 0 },
        resultStatus: "INSUFFICIENT",
      };
    }
    if (future.length < h) {
      const window = future;
      const metrics = computeDirectionalPathMetrics({
        direction,
        entry: entryPrice,
        window,
      });
      const completeness: MifPredictionHorizonCompleteness =
        future.length === 0 ? "INSUFFICIENT" : "PARTIAL";
      return {
        requestedHorizon: h,
        availableCandles: future.length,
        requiredCandles: h,
        completeness,
        forwardReturn: metrics.forwardReturn,
        mfe: metrics.mfe,
        mae: metrics.mae,
        lastObservedOpenTimeSec: window[window.length - 1]!.openTimeSec,
        gapFlags: [...gapFlags, `NEED_${h}_HAVE_${future.length}`],
        entryReferenceKind,
        entryPrice,
        evaluationRange: {
          firstOpenTimeSec: window[0]!.openTimeSec,
          lastOpenTimeSec: window[window.length - 1]!.openTimeSec,
          barCount: window.length,
        },
        resultStatus: completeness,
      };
    }

    const window = future.slice(0, h);
    const metrics = computeDirectionalPathMetrics({
      direction,
      entry: entryPrice,
      window,
    });
    return {
      requestedHorizon: h,
      availableCandles: future.length,
      requiredCandles: h,
      completeness: "COMPLETE",
      forwardReturn: metrics.forwardReturn,
      mfe: metrics.mfe,
      mae: metrics.mae,
      lastObservedOpenTimeSec: window[window.length - 1]!.openTimeSec,
      gapFlags,
      entryReferenceKind,
      entryPrice,
      evaluationRange: {
        firstOpenTimeSec: window[0]!.openTimeSec,
        lastOpenTimeSec: window[window.length - 1]!.openTimeSec,
        barCount: window.length,
      },
      resultStatus: "COMPLETE",
    };
  });

  return {
    policyId: MIF_PREDICTION_PATH_METRICS_POLICY_ID,
    policyVersion: MIF_PREDICTION_PATH_METRICS_POLICY_VERSION,
    direction,
    entryReferenceKind,
    entryPrice,
    activationClose: input.activationClose,
    horizons: horizonMetrics,
    observationWindow,
    gapDetected: gapFlags.length > 0,
    gapFlags,
    unsupportedReason: null,
  };
}

function unsupportedHorizon(
  h: number,
  entryReferenceKind: MifPredictionEntryReferenceKind,
  entryPrice: number | null,
  status: MifPredictionHorizonCompleteness,
): MifPredictionPathHorizonMetric {
  return {
    requestedHorizon: h,
    availableCandles: 0,
    requiredCandles: h,
    completeness: status,
    forwardReturn: null,
    mfe: null,
    mae: null,
    lastObservedOpenTimeSec: null,
    gapFlags: [status],
    entryReferenceKind,
    entryPrice,
    evaluationRange: { firstOpenTimeSec: null, lastOpenTimeSec: null, barCount: 0 },
    resultStatus: status,
  };
}
