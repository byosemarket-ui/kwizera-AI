/**
 * Client-side HFM Bid → forming candle aggregation (broker-aligned buckets).
 * Mirrors ai/market-data/mt5-hfm/live-candle-engine for verified chart TFs.
 */
import { HFM_CHART_VERIFIED_TFS, type HfmChartCandle } from "./types";

const TF_SECONDS: Record<string, number> = {
  M1: 60,
  M3: 180,
  M5: 300,
  M15: 900,
  M30: 1800,
  H1: 3600,
  H2: 7200,
  H4: 14400,
  H6: 21600,
  H12: 43200,
  D1: 86400,
  W1: 604800,
};

export function isLiveFormingTimeframe(tf: string): boolean {
  return (HFM_CHART_VERIFIED_TFS as readonly string[]).includes(tf.toUpperCase());
}

export function timeframeSeconds(tf: string): number | null {
  return TF_SECONDS[tf.toUpperCase()] ?? null;
}

export function resolveFormingBucket(
  tickTime: number,
  timeframe: string,
  anchorTime: number | null | undefined,
): number | null {
  const tf = timeframe.toUpperCase();
  const sec = timeframeSeconds(tf);
  if (sec == null) return null;
  if (typeof anchorTime === "number" && Number.isFinite(anchorTime) && anchorTime > 0) {
    if (tickTime < anchorTime) return null;
    return anchorTime + Math.floor((tickTime - anchorTime) / sec) * sec;
  }
  // W1 requires broker CopyRates week-open anchor (same contract as live-candle-engine).
  if (tf === "W1") return null;
  return Math.floor(tickTime / sec) * sec;
}

export function seedFormingFromBar(bar: HfmChartCandle): HfmChartCandle {
  return {
    time: bar.time,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    tickVolume: bar.tickVolume,
    realVolume: bar.realVolume,
    spread: bar.spread,
    closed: false,
  };
}

/**
 * Apply a validated Bid tick to the forming candle.
 * Open stays stable within the bucket; High/Low/Close update from Bid only.
 */
export function applyBidToFormingCandle(
  prev: HfmChartCandle | null,
  bid: number,
  tickTime: number,
  timeframe: string,
  options?: { anchorTime?: number | null; spread?: number | null },
): HfmChartCandle | null {
  if (!isLiveFormingTimeframe(timeframe)) return prev;
  if (!(bid > 0) || !Number.isFinite(bid) || !(tickTime > 0)) return prev;

  const sec = timeframeSeconds(timeframe);
  if (sec == null) return prev;

  const anchor =
    options?.anchorTime ??
    prev?.time ??
    null;
  const bucket = resolveFormingBucket(tickTime, timeframe, anchor);
  if (bucket == null) return prev;

  if (prev && prev.time === bucket) {
    return {
      ...prev,
      high: Math.max(prev.high, bid),
      low: Math.min(prev.low, bid),
      close: bid,
      tickVolume: (prev.tickVolume ?? 0) + 1,
      spread: options?.spread ?? prev.spread,
      closed: false,
    };
  }

  // New bucket: do not carry prior open.
  return {
    time: bucket,
    open: bid,
    high: bid,
    low: bid,
    close: bid,
    tickVolume: 1,
    realVolume: null,
    spread: options?.spread ?? null,
    closed: false,
  };
}

/** Deterministic OHLC fixture helper for unit tests. */
export function aggregateBidSequence(
  bids: number[],
  timeframe: string,
  startTime: number,
): HfmChartCandle | null {
  let forming: HfmChartCandle | null = null;
  let t = startTime;
  for (const bid of bids) {
    forming = applyBidToFormingCandle(forming, bid, t, timeframe, { anchorTime: startTime });
    t += 1;
  }
  return forming;
}

export function formatHfmSpread(
  spread: number | null | undefined,
  digits: number | null | undefined,
): string {
  if (spread == null || !Number.isFinite(spread)) return "—";
  const d =
    typeof digits === "number" && Number.isFinite(digits)
      ? Math.min(8, Math.max(0, Math.round(digits)))
      : 5;
  const factor = 10 ** d;
  const rounded = Math.round(spread * factor) / factor;
  return rounded.toFixed(d);
}
