/**
 * Build compact numerical evidence for OpenAI (no secrets, bounded candles).
 */
import { HFM_REASONING_REQUIRED_TFS } from "./constants.js";
import type { HfmAnalysisContextResult } from "../types.js";
import type { HfmReasoningImageRef } from "./types.js";

/** Keep tip + evenly sampled history for prompt size. */
function sampleCandles(
  candles: Array<{
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    tickVolume: number | null;
    realVolume: number | null;
    isCurrent?: boolean;
  }>,
  max = 40,
): unknown[] {
  if (candles.length <= max) {
    return candles.map((c) => ({
      t: c.timestamp,
      o: c.open,
      h: c.high,
      l: c.low,
      c: c.close,
      tv: c.tickVolume,
      rv: c.realVolume,
      cur: Boolean(c.isCurrent),
    }));
  }
  const out: typeof candles = [];
  const step = (candles.length - 1) / (max - 1);
  for (let i = 0; i < max; i += 1) {
    const idx = Math.min(candles.length - 1, Math.round(i * step));
    out.push(candles[idx]!);
  }
  // Ensure last tip included
  if (out[out.length - 1] !== candles[candles.length - 1]) {
    out[out.length - 1] = candles[candles.length - 1]!;
  }
  return out.map((c) => ({
    t: c.timestamp,
    o: c.open,
    h: c.high,
    l: c.low,
    c: c.close,
    tv: c.tickVolume,
    rv: c.realVolume,
    cur: Boolean(c.isCurrent),
  }));
}

export function buildHfmReasoningEvidencePackage(input: {
  context: HfmAnalysisContextResult;
  imageRefs: HfmReasoningImageRef[];
}): {
  json: string;
  candleCounts: Record<string, number>;
  packageObject: Record<string, unknown>;
} {
  const snap = input.context.snapshot!;
  const timeframes: Record<string, unknown> = {};
  const candleCounts: Record<string, number> = {};

  for (const tf of HFM_REASONING_REQUIRED_TFS) {
    const ds = snap.timeframes[tf];
    if (!ds) {
      timeframes[tf] = { missing: true };
      candleCounts[tf] = 0;
      continue;
    }
    const series = ds.current
      ? [...ds.historical.filter((c) => c.timestamp !== ds.current!.timestamp), ds.current]
      : ds.historical;
    candleCounts[tf] = series.length;
    timeframes[tf] = {
      timeframe: tf,
      symbol: ds.symbol,
      candleCount: series.length,
      oldestTimestamp: ds.oldestTimestamp,
      newestTimestamp: ds.newestTimestamp,
      freshness: ds.freshness,
      validationStatus: ds.validationStatus,
      hasCurrent: Boolean(ds.current),
      candlesSampled: sampleCandles(series, 40),
      note: series.length > 40
        ? `Sampled ${40} of ${series.length} candles for prompt size; full count is authoritative.`
        : "Full candle series included.",
    };
  }

  const packageObject: Record<string, unknown> = {
    provider: snap.provider,
    symbol: snap.symbol,
    contextId: snap.snapshotId,
    snapshotId: snap.snapshotId,
    snapshotHash: snap.snapshotHash,
    capturedAt: snap.capturedAt,
    chartTimeframeAtStart: snap.chartTimeframeAtStart,
    dataQuality: snap.dataQuality,
    synchronization: snap.synchronization,
    quote: snap.quote,
    timeframes,
    images: input.imageRefs.map((r) => ({
      timeframe: r.timeframe,
      imageId: r.imageId,
      imageHash: r.imageHash,
      orderHint: `Image for ${r.timeframe} follows in multimodal payload`,
    })),
    analyticalRoles: {
      H1: "higher-timeframe context",
      M30: "intermediate structure",
      M15: "setup development",
      M5: "trigger and confirmation",
    },
    safety: {
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
    },
  };

  return {
    json: JSON.stringify(packageObject),
    candleCounts,
    packageObject,
  };
}
