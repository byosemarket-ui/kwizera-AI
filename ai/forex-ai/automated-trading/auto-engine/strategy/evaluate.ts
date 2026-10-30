import {
  SMA_CROSSOVER_RULES,
  type StrategyCandle,
  type StrategyDirection,
} from "./rules.js";

function sma(values: number[], length: number, endIndex: number): number | null {
  if (endIndex + 1 < length) return null;
  let sum = 0;
  for (let i = endIndex - length + 1; i <= endIndex; i++) {
    const v = values[i];
    if (v == null || !Number.isFinite(v)) return null;
    sum += v;
  }
  return sum / length;
}

/** Wilder-style ATR from closed OHLC bars ending at endIndex inclusive. */
export function atrAt(
  highs: number[],
  lows: number[],
  closes: number[],
  length: number,
  endIndex: number,
): number | null {
  if (endIndex < length || endIndex >= highs.length) return null;
  const trs: number[] = [];
  for (let i = endIndex - length + 1; i <= endIndex; i++) {
    const high = highs[i]!;
    const low = lows[i]!;
    const prevClose = closes[i - 1]!;
    if (![high, low, prevClose].every((x) => Number.isFinite(x))) return null;
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    if (!(tr >= 0) || !Number.isFinite(tr)) return null;
    trs.push(tr);
  }
  const sum = trs.reduce((a, b) => a + b, 0);
  const atr = sum / length;
  return Number.isFinite(atr) && atr > 0 ? atr : null;
}

export interface StrategyEvaluation {
  ok: boolean;
  direction: StrategyDirection;
  code: string;
  reasons: string[];
  strategyId: string;
  closedCandleOpenSec: number | null;
  entryPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  atr: number | null;
  fastSma: number | null;
  slowSma: number | null;
  confidencePct: number | null;
}

/**
 * Evaluate SMA crossover on closed candles only.
 * Drops a trailing forming candle when `closed === false`.
 */
export function evaluateSmaCrossoverStrategy(input: {
  candles: StrategyCandle[];
  pointSize: number | null;
  rules?: typeof SMA_CROSSOVER_RULES;
}): StrategyEvaluation {
  const rules = input.rules ?? SMA_CROSSOVER_RULES;
  const reasons: string[] = [];
  const base = {
    strategyId: rules.strategyId,
    closedCandleOpenSec: null as number | null,
    entryPrice: null as number | null,
    stopLoss: null as number | null,
    takeProfit: null as number | null,
    atr: null as number | null,
    fastSma: null as number | null,
    slowSma: null as number | null,
    confidencePct: null as number | null,
  };

  const fail = (code: string, message: string): StrategyEvaluation => ({
    ok: false,
    direction: "NO_TRADE",
    code,
    reasons: [...reasons, message],
    ...base,
  });

  if (!Array.isArray(input.candles) || input.candles.length === 0) {
    return fail("CANDLES_MISSING", "No candles supplied.");
  }

  let rows = input.candles.filter((c) =>
    c
    && Number.isFinite(c.time)
    && Number.isFinite(c.open)
    && Number.isFinite(c.high)
    && Number.isFinite(c.low)
    && Number.isFinite(c.close)
  );
  if (rows.length === 0) return fail("CANDLES_INVALID", "Candle OHLC invalid.");

  // Never use forming bar.
  const last = rows[rows.length - 1]!;
  if (last.closed === false) {
    rows = rows.slice(0, -1);
    reasons.push("Dropped forming candle.");
  }
  if (rows.length < rules.slowSmaLength + 2) {
    return fail("INSUFFICIENT_CLOSED_CANDLES", `Need at least ${rules.slowSmaLength + 2} closed candles.`);
  }

  const closes = rows.map((r) => r.close);
  const highs = rows.map((r) => r.high);
  const lows = rows.map((r) => r.low);
  const i = rows.length - 1;
  const prev = i - 1;

  const fastNow = sma(closes, rules.fastSmaLength, i);
  const slowNow = sma(closes, rules.slowSmaLength, i);
  const fastPrev = sma(closes, rules.fastSmaLength, prev);
  const slowPrev = sma(closes, rules.slowSmaLength, prev);
  base.fastSma = fastNow;
  base.slowSma = slowNow;

  if (fastNow == null || slowNow == null || fastPrev == null || slowPrev == null) {
    return fail("SMA_UNAVAILABLE", "SMA calculation failed.");
  }

  const atr = atrAt(highs, lows, closes, rules.atrLength, i);
  base.atr = atr;
  if (atr == null) return fail("ATR_UNAVAILABLE", "ATR calculation failed.");

  if (!finitePositive(input.pointSize)) {
    return fail("POINT_SIZE_UNVERIFIED", "pointSize required for stop geometry.");
  }
  const pointSize = input.pointSize;

  let direction: StrategyDirection = "NO_TRADE";
  if (fastPrev <= slowPrev && fastNow > slowNow) direction = "BUY";
  else if (fastPrev >= slowPrev && fastNow < slowNow) direction = "SELL";
  else {
    return {
      ok: true,
      direction: "NO_TRADE",
      code: "NO_CROSSOVER",
      reasons: [...reasons, "No SMA crossover on latest closed bar."],
      ...base,
      closedCandleOpenSec: rows[i]!.time,
      entryPrice: rows[i]!.close,
      confidencePct: 0,
    };
  }

  const entry = rows[i]!.close;
  const stopDist = Math.max(atr * rules.stopAtrMultiple, pointSize * rules.minStopPoints);
  const tpDist = stopDist * rules.takeProfitRMultiple;
  const stopLoss = direction === "BUY" ? entry - stopDist : entry + stopDist;
  const takeProfit = direction === "BUY" ? entry + tpDist : entry - tpDist;
  if (![entry, stopLoss, takeProfit].every((x) => Number.isFinite(x) && x > 0)) {
    return fail("LEVELS_INVALID", "Computed SL/TP invalid.");
  }

  // Confidence: separation of SMAs relative to ATR (capped, not a win-rate claim).
  const sep = Math.abs(fastNow - slowNow);
  const confidencePct = Math.max(1, Math.min(85, Math.round((sep / atr) * 40 + 40)));

  return {
    ok: true,
    direction,
    code: direction === "BUY" ? "BUY_SMA_CROSS" : "SELL_SMA_CROSS",
    reasons: [
      ...reasons,
      `${direction} crossover: fast SMA ${fastNow.toFixed(5)} vs slow SMA ${slowNow.toFixed(5)}.`,
      `ATR=${atr.toFixed(5)}; stopDist=${stopDist.toFixed(5)}; tpDist=${tpDist.toFixed(5)}.`,
    ],
    strategyId: rules.strategyId,
    closedCandleOpenSec: rows[i]!.time,
    entryPrice: entry,
    stopLoss,
    takeProfit,
    atr,
    fastSma: fastNow,
    slowSma: slowNow,
    confidencePct,
  };
}

function finitePositive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

/** Offline replay helper — not a profitability certificate. */
export function backtestSmaCrossover(input: {
  candles: StrategyCandle[];
  pointSize: number;
}): {
  signals: Array<{ time: number; direction: "BUY" | "SELL"; entry: number; stop: number; tp: number }>;
  note: string;
} {
  const signals: Array<{ time: number; direction: "BUY" | "SELL"; entry: number; stop: number; tp: number }> = [];
  const closed = input.candles.filter((c) => c.closed !== false);
  for (let end = SMA_CROSSOVER_RULES.slowSmaLength + 2; end <= closed.length; end++) {
    const slice = closed.slice(0, end).map((c) => ({ ...c, closed: true as const }));
    const ev = evaluateSmaCrossoverStrategy({ candles: slice, pointSize: input.pointSize });
    if (ev.ok && (ev.direction === "BUY" || ev.direction === "SELL") && ev.closedCandleOpenSec != null) {
      const lastTime = ev.closedCandleOpenSec;
      if (signals.some((s) => s.time === lastTime)) continue;
      signals.push({
        time: lastTime,
        direction: ev.direction,
        entry: ev.entryPrice!,
        stop: ev.stopLoss!,
        tp: ev.takeProfit!,
      });
    }
  }
  return {
    signals,
    note: "Replay enumerates historical crossover signals only. It does not prove expectancy or net profit.",
  };
}
