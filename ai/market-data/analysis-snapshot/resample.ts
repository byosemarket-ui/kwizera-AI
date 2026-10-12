/**
 * Deterministic candle resampling for analysis snapshots (Phase 43C).
 * Only aggregates finer → coarser when the ratio is an exact integer.
 * Never fabricates intraperiod detail or downsamples from larger candles.
 */
import type { CanonicalTimeframeId } from "../providers/contracts.js";
import { timeframeIntervalMs } from "./periods.js";
import type { AnalysisSnapshotCandle } from "./types.js";

export function canResampleTimeframe(
  source: CanonicalTimeframeId,
  target: CanonicalTimeframeId,
): boolean {
  if (source === target) return false;
  const srcMs = timeframeIntervalMs(source);
  const tgtMs = timeframeIntervalMs(target);
  if (tgtMs <= srcMs) return false;
  return tgtMs % srcMs === 0;
}

export function rejectResampleReason(
  source: CanonicalTimeframeId,
  target: CanonicalTimeframeId,
): string | null {
  if (source === target) {
    return "Source and target timeframes are identical; resampling is unnecessary.";
  }
  const srcMs = timeframeIntervalMs(source);
  const tgtMs = timeframeIntervalMs(target);
  if (tgtMs < srcMs) {
    return `Cannot construct ${target} from coarser ${source} candles.`;
  }
  if (tgtMs === srcMs) return null;
  if (tgtMs % srcMs !== 0) {
    return `Cannot resample ${source} → ${target}: ratio is not an integer multiple.`;
  }
  return null;
}

/** Align open time (unix seconds) down to the target timeframe boundary (UTC). */
export function alignBucketStartSec(timeSec: number, target: CanonicalTimeframeId): number {
  const intervalSec = timeframeIntervalMs(target) / 1000;
  return Math.floor(timeSec / intervalSec) * intervalSec;
}

/**
 * Aggregate source candles into target timeframe buckets.
 * Open = first source open; high/low = extrema; close = last source close.
 * Volume aggregated only when every contributing source candle has volume.
 */
export function resampleCandles(
  sourceCandles: AnalysisSnapshotCandle[],
  sourceTf: CanonicalTimeframeId,
  targetTf: CanonicalTimeframeId,
): { ok: true; candles: AnalysisSnapshotCandle[] } | { ok: false; code: string; message: string } {
  const reason = rejectResampleReason(sourceTf, targetTf);
  if (reason) {
    return { ok: false, code: "UNSUPPORTED_RESAMPLE", message: reason };
  }

  const srcIntervalSec = timeframeIntervalMs(sourceTf) / 1000;
  const tgtIntervalSec = timeframeIntervalMs(targetTf) / 1000;
  const expectedPerBucket = Math.round(tgtIntervalSec / srcIntervalSec);

  const sorted = [...sourceCandles]
    .filter((c) => Number.isFinite(c.time) && c.time > 0)
    .sort((a, b) => a.time - b.time);

  const buckets = new Map<number, AnalysisSnapshotCandle[]>();
  for (const c of sorted) {
    const bucket = alignBucketStartSec(c.time, targetTf);
    const list = buckets.get(bucket) ?? [];
    list.push(c);
    buckets.set(bucket, list);
  }

  const out: AnalysisSnapshotCandle[] = [];
  for (const bucketStart of [...buckets.keys()].sort((a, b) => a - b)) {
    const members = buckets.get(bucketStart)!;
    members.sort((a, b) => a.time - b.time);
    const first = members[0]!;
    const last = members[members.length - 1]!;
    let high = first.high;
    let low = first.low;
    for (const m of members) {
      if (m.high > high) high = m.high;
      if (m.low < low) low = m.low;
    }

    const volumes = members.map((m) => m.volume);
    const allVolume = volumes.every((v) => v != null && Number.isFinite(v));
    const volume = allVolume
      ? volumes.reduce<number>((sum, v) => sum + (v as number), 0)
      : null;

    const incompleteAggregation = members.length < expectedPerBucket;
    const allClosed = members.every((m) => m.isClosed);

    out.push({
      time: bucketStart,
      open: first.open,
      high,
      low,
      close: last.close,
      volume,
      isClosed: allClosed && !incompleteAggregation,
      resampled: true,
      incompleteAggregation,
    });
  }

  return { ok: true, candles: out };
}

/** Prefer the finest native canonical source that can build the target. */
export function preferResampleSource(
  target: CanonicalTimeframeId,
  available: readonly CanonicalTimeframeId[],
): CanonicalTimeframeId | null {
  const candidates = available
    .filter((tf) => canResampleTimeframe(tf, target))
    .sort((a, b) => timeframeIntervalMs(a) - timeframeIntervalMs(b));
  return candidates[0] ?? null;
}
