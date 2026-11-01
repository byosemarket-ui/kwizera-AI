/**
 * Phase 4.18E — Deterministic historical movement metrics from closed OHLC.
 * Educational / evidence only — not a trade signal. Provenance: DETERMINISTIC_COMPUTED.
 */
export interface MovementCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  closed?: boolean;
}

export interface CandleGeometry {
  openTimeSec: number;
  range: number;
  body: number;
  upperWick: number;
  lowerWick: number;
  direction: "BULLISH" | "BEARISH" | "DOJI";
}

export interface HistoricalMovementSummary {
  schemaVersion: "kwizera.historical-movement.v1";
  instrument: string;
  timeframe: string;
  closedCount: number;
  firstOpenSec: number | null;
  lastOpenSec: number | null;
  historySpanSec: number | null;
  lastCandle: CandleGeometry | null;
  consecutiveBullish: number;
  consecutiveBearish: number;
  /** Net close change over window as fraction of last close (null if unavailable). */
  netReturnPct: number | null;
  /** Mean true-range / last close (approx volatility). */
  meanRangePct: number | null;
  recentAcceleration: "ACCELERATING" | "DECELERATING" | "STABLE" | "UNKNOWN";
  structureHints: {
    higherHighs: number;
    lowerHighs: number;
    higherLows: number;
    lowerLows: number;
    bias: "BULLISH" | "BEARISH" | "RANGE" | "UNKNOWN";
  };
  provenance: "DETERMINISTIC_COMPUTED";
  limitations: string[];
}

function finite(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

export function classifyCandleGeometry(c: MovementCandle): CandleGeometry | null {
  if (![c.time, c.open, c.high, c.low, c.close].every(finite)) return null;
  if (!(c.high >= c.low) || c.open <= 0 || c.close <= 0) return null;
  const body = Math.abs(c.close - c.open);
  const range = c.high - c.low;
  const upperWick = c.high - Math.max(c.open, c.close);
  const lowerWick = Math.min(c.open, c.close) - c.low;
  let direction: CandleGeometry["direction"] = "DOJI";
  if (c.close > c.open) direction = "BULLISH";
  else if (c.close < c.open) direction = "BEARISH";
  return {
    openTimeSec: Math.floor(c.time > 1e12 ? c.time / 1000 : c.time),
    range,
    body,
    upperWick: Math.max(0, upperWick),
    lowerWick: Math.max(0, lowerWick),
    direction,
  };
}

/**
 * Closed candles only. Drops trailing forming bar when closed===false.
 */
export function selectClosedMovementCandles(candles: MovementCandle[]): MovementCandle[] {
  let rows = candles.filter(
    (c) =>
      c
      && finite(c.time)
      && finite(c.open)
      && finite(c.high)
      && finite(c.low)
      && finite(c.close),
  );
  if (!rows.length) return [];
  const last = rows[rows.length - 1]!;
  if (last.closed === false) rows = rows.slice(0, -1);
  return rows;
}

/**
 * Compare successive swing-ish pivots using simple 3-bar local extrema on closes/highs/lows.
 * Lightweight — full fractal swings live in forex-structure; this is a compact evidence hint.
 */
function structureHintsFromClosed(closed: MovementCandle[]): HistoricalMovementSummary["structureHints"] {
  const empty = {
    higherHighs: 0,
    lowerHighs: 0,
    higherLows: 0,
    lowerLows: 0,
    bias: "UNKNOWN" as const,
  };
  if (closed.length < 7) return empty;
  const highs: number[] = [];
  const lows: number[] = [];
  for (let i = 1; i < closed.length - 1; i++) {
    const p = closed[i - 1]!;
    const c = closed[i]!;
    const n = closed[i + 1]!;
    if (c.high >= p.high && c.high >= n.high) highs.push(c.high);
    if (c.low <= p.low && c.low <= n.low) lows.push(c.low);
  }
  let higherHighs = 0;
  let lowerHighs = 0;
  for (let i = 1; i < highs.length; i++) {
    if (highs[i]! > highs[i - 1]!) higherHighs += 1;
    else if (highs[i]! < highs[i - 1]!) lowerHighs += 1;
  }
  let higherLows = 0;
  let lowerLows = 0;
  for (let i = 1; i < lows.length; i++) {
    if (lows[i]! > lows[i - 1]!) higherLows += 1;
    else if (lows[i]! < lows[i - 1]!) lowerLows += 1;
  }
  let bias: HistoricalMovementSummary["structureHints"]["bias"] = "UNKNOWN";
  if (higherHighs > lowerHighs && higherLows >= lowerLows) bias = "BULLISH";
  else if (lowerHighs > higherHighs && lowerLows >= higherLows) bias = "BEARISH";
  else if (highs.length >= 2 && lows.length >= 2) bias = "RANGE";
  return { higherHighs, lowerHighs, higherLows, lowerLows, bias };
}

export function summarizeHistoricalMovement(input: {
  instrument: string;
  timeframe: string;
  candles: MovementCandle[];
  /** Max closed bars to include in metrics (newest). */
  windowBars?: number;
}): HistoricalMovementSummary {
  const limitations: string[] = [
    "Historical movement is deterministic evidence only — not a trade authorization.",
  ];
  const closedAll = selectClosedMovementCandles(input.candles);
  const window = Math.max(5, Math.floor(input.windowBars ?? 80));
  const closed = closedAll.slice(-window);
  if (!closed.length) {
    return {
      schemaVersion: "kwizera.historical-movement.v1",
      instrument: input.instrument,
      timeframe: input.timeframe,
      closedCount: 0,
      firstOpenSec: null,
      lastOpenSec: null,
      historySpanSec: null,
      lastCandle: null,
      consecutiveBullish: 0,
      consecutiveBearish: 0,
      netReturnPct: null,
      meanRangePct: null,
      recentAcceleration: "UNKNOWN",
      structureHints: {
        higherHighs: 0,
        lowerHighs: 0,
        higherLows: 0,
        lowerLows: 0,
        bias: "UNKNOWN",
      },
      provenance: "DETERMINISTIC_COMPUTED",
      limitations: [...limitations, "No closed candles."],
    };
  }

  const first = closed[0]!;
  const last = closed[closed.length - 1]!;
  const firstOpenSec = Math.floor(first.time > 1e12 ? first.time / 1000 : first.time);
  const lastOpenSec = Math.floor(last.time > 1e12 ? last.time / 1000 : last.time);

  let consecutiveBullish = 0;
  let consecutiveBearish = 0;
  for (let i = closed.length - 1; i >= 0; i--) {
    const g = classifyCandleGeometry(closed[i]!);
    if (!g) break;
    if (g.direction === "BULLISH") {
      if (consecutiveBearish > 0) break;
      consecutiveBullish += 1;
    } else if (g.direction === "BEARISH") {
      if (consecutiveBullish > 0) break;
      consecutiveBearish += 1;
    } else break;
  }

  const netReturnPct =
    first.close > 0 ? ((last.close - first.close) / first.close) * 100 : null;

  let rangeSum = 0;
  let rangeN = 0;
  for (const c of closed) {
    if (c.close > 0 && c.high >= c.low) {
      rangeSum += (c.high - c.low) / c.close;
      rangeN += 1;
    }
  }
  const meanRangePct = rangeN > 0 ? (rangeSum / rangeN) * 100 : null;

  // Acceleration: compare |net return| of last third vs prior third
  let recentAcceleration: HistoricalMovementSummary["recentAcceleration"] = "UNKNOWN";
  if (closed.length >= 12) {
    const third = Math.floor(closed.length / 3);
    const a0 = closed[closed.length - 3 * third]!;
    const a1 = closed[closed.length - 2 * third]!;
    const a2 = closed[closed.length - 1]!;
    if (a0.close > 0 && a1.close > 0) {
      const r1 = Math.abs((a1.close - a0.close) / a0.close);
      const r2 = Math.abs((a2.close - a1.close) / a1.close);
      if (r2 > r1 * 1.25) recentAcceleration = "ACCELERATING";
      else if (r2 < r1 * 0.75) recentAcceleration = "DECELERATING";
      else recentAcceleration = "STABLE";
    }
  } else {
    limitations.push("Fewer than 12 closed bars — acceleration UNKNOWN.");
  }

  return {
    schemaVersion: "kwizera.historical-movement.v1",
    instrument: input.instrument,
    timeframe: input.timeframe,
    closedCount: closed.length,
    firstOpenSec,
    lastOpenSec,
    historySpanSec: lastOpenSec - firstOpenSec,
    lastCandle: classifyCandleGeometry(last),
    consecutiveBullish,
    consecutiveBearish,
    netReturnPct: netReturnPct != null && Number.isFinite(netReturnPct) ? netReturnPct : null,
    meanRangePct: meanRangePct != null && Number.isFinite(meanRangePct) ? meanRangePct : null,
    recentAcceleration,
    structureHints: structureHintsFromClosed(closed),
    provenance: "DETERMINISTIC_COMPUTED",
    limitations,
  };
}
