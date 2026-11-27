/**
 * C7 — Deterministic OHLC reconciliation between MT5 acquisition sources.
 *
 * Closed candles are compared for exact consistency (same symbol/TF/open time).
 * Forming candles are never treated as fixed historical records when observation
 * times differ — they are classified as synchronized match, expected evolution,
 * or genuine inconsistency.
 */

export type OhlcBar = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  closed?: boolean | null;
};

export type OhlcSourceSample = {
  source: string;
  observedAt: string;
  bar: OhlcBar | null;
};

export type ReconciliationVerdict =
  | "EXACT_MATCH"
  | "EXPECTED_FORMING_EVOLUTION"
  | "TIMESTAMP_MISMATCH"
  | "STALE_SOURCE"
  | "MISSING_SOURCE"
  | "INVALID_OHLC"
  | "GENUINE_OHLC_MISMATCH"
  | "UNSAFE_FORMING_COMPARE";

export type ReconciliationResult = {
  symbol: string;
  timeframe: string;
  candleOpenTime: number | null;
  mode: "closed" | "forming";
  verdict: ReconciliationVerdict;
  left: OhlcSourceSample;
  right: OhlcSourceSample;
  detail: string;
};

const EPS = 1e-9;

export function isValidOhlc(bar: OhlcBar | null | undefined): bar is OhlcBar {
  if (!bar) return false;
  const { time, open, high, low, close } = bar;
  if (![time, open, high, low, close].every((n) => typeof n === "number" && Number.isFinite(n))) {
    return false;
  }
  if (time <= 0 || open <= 0 || high <= 0 || low <= 0 || close <= 0) return false;
  if (high + EPS < Math.max(open, close)) return false;
  if (low - EPS > Math.min(open, close)) return false;
  if (high + EPS < low) return false;
  return true;
}

export function ohlcEqual(a: OhlcBar, b: OhlcBar, eps = EPS): boolean {
  return (
    a.time === b.time &&
    Math.abs(a.open - b.open) <= eps &&
    Math.abs(a.high - b.high) <= eps &&
    Math.abs(a.low - b.low) <= eps &&
    Math.abs(a.close - b.close) <= eps
  );
}

/** Prefer explicit closed:false; otherwise treat last bar as forming tip. */
export function splitClosedAndForming(bars: OhlcBar[]): { closed: OhlcBar[]; forming: OhlcBar | null } {
  const valid = bars.filter((b) => isValidOhlc(b));
  if (valid.length === 0) return { closed: [], forming: null };
  const explicitForming = [...valid].reverse().find((b) => b.closed === false) ?? null;
  if (explicitForming) {
    return {
      closed: valid.filter((b) => b.time !== explicitForming.time && b.closed !== false),
      forming: explicitForming,
    };
  }
  // Convention: tip is forming; prior bars are closed for reconciliation.
  if (valid.length === 1) return { closed: [], forming: valid[0]! };
  return { closed: valid.slice(0, -1), forming: valid[valid.length - 1]! };
}

export function findBarByOpenTime(bars: OhlcBar[], openTime: number): OhlcBar | null {
  return bars.find((b) => b.time === openTime) ?? null;
}

function parseObservedMs(iso: string): number | null {
  if (!iso || typeof iso !== "string") return null;
  const s = iso.trim();
  // Expert dump: "2026.11.27 16:53:36Z"
  if (s.length >= 19 && s[4] === "." && s[7] === ".") {
    const body = s.replace(/[Zz]$/, "").trim();
    const m = /^(\d{4})\.(\d{2})\.(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(body);
    if (m) {
      const ms = Date.UTC(
        Number(m[1]),
        Number(m[2]) - 1,
        Number(m[3]),
        Number(m[4]),
        Number(m[5]),
        Number(m[6]),
      );
      return Number.isFinite(ms) ? ms : null;
    }
  }
  const ms = Date.parse(s);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Compare one closed bar from two sources. Requires identical candle open times.
 */
export function reconcileClosedBar(input: {
  symbol: string;
  timeframe: string;
  left: OhlcSourceSample;
  right: OhlcSourceSample;
  maxStaleMs?: number;
}): ReconciliationResult {
  const { symbol, timeframe, left, right } = input;
  const maxStaleMs = input.maxStaleMs ?? 120_000;
  const base = {
    symbol,
    timeframe,
    candleOpenTime: left.bar?.time ?? right.bar?.time ?? null,
    mode: "closed" as const,
    left,
    right,
  };
  if (!left.bar || !right.bar) {
    return { ...base, verdict: "MISSING_SOURCE", detail: "One or both closed bars missing" };
  }
  if (!isValidOhlc(left.bar) || !isValidOhlc(right.bar)) {
    return { ...base, verdict: "INVALID_OHLC", detail: "Invalid OHLC in one or both sources" };
  }
  if (left.bar.time !== right.bar.time) {
    return {
      ...base,
      candleOpenTime: null,
      verdict: "TIMESTAMP_MISMATCH",
      detail: `open time left=${left.bar.time} right=${right.bar.time}`,
    };
  }
  const lMs = parseObservedMs(left.observedAt);
  const rMs = parseObservedMs(right.observedAt);
  const skew = lMs != null && rMs != null ? Math.abs(lMs - rMs) : null;
  // Closed bars are immutable: identical OHLC is an exact match regardless of when
  // each source was sampled. Observation skew is recorded in detail only.
  if (ohlcEqual(left.bar, right.bar)) {
    return {
      ...base,
      candleOpenTime: left.bar.time,
      verdict: "EXACT_MATCH",
      detail:
        skew == null
          ? "Closed OHLC identical"
          : `Closed OHLC identical (observation skew ${skew}ms)`,
    };
  }
  // Divergent OHLC with large observation skew is ambiguous (stale sample), not a
  // proven broker/pipeline defect.
  if (skew != null && skew > maxStaleMs) {
    return {
      ...base,
      candleOpenTime: left.bar.time,
      verdict: "STALE_SOURCE",
      detail: `OHLC differs with observation skew ${skew}ms exceeding ${maxStaleMs}ms`,
    };
  }
  return {
    ...base,
    candleOpenTime: left.bar.time,
    verdict: "GENUINE_OHLC_MISMATCH",
    detail: "Closed bars share open time but OHLC differs",
  };
}

/**
 * Forming-candle comparison. If observation times differ and OHLC differs only in
 * high/low/close (open stable), classify as expected evolution — not a silent pass.
 */
export function reconcileFormingBar(input: {
  symbol: string;
  timeframe: string;
  left: OhlcSourceSample;
  right: OhlcSourceSample;
  syncWindowMs?: number;
}): ReconciliationResult {
  const { symbol, timeframe, left, right } = input;
  const syncWindowMs = input.syncWindowMs ?? 1500;
  const base = {
    symbol,
    timeframe,
    candleOpenTime: left.bar?.time ?? right.bar?.time ?? null,
    mode: "forming" as const,
    left,
    right,
  };
  if (!left.bar || !right.bar) {
    return { ...base, verdict: "MISSING_SOURCE", detail: "Forming bar missing from a source" };
  }
  if (!isValidOhlc(left.bar) || !isValidOhlc(right.bar)) {
    return { ...base, verdict: "INVALID_OHLC", detail: "Invalid forming OHLC" };
  }
  if (left.bar.time !== right.bar.time) {
    return {
      ...base,
      candleOpenTime: null,
      verdict: "TIMESTAMP_MISMATCH",
      detail: "Forming tips have different candle opens",
    };
  }
  const lMs = parseObservedMs(left.observedAt);
  const rMs = parseObservedMs(right.observedAt);
  const skew = lMs != null && rMs != null ? Math.abs(lMs - rMs) : null;
  if (ohlcEqual(left.bar, right.bar)) {
    return {
      ...base,
      candleOpenTime: left.bar.time,
      verdict: "EXACT_MATCH",
      detail: skew == null ? "Forming OHLC identical" : `Forming OHLC identical (skew ${skew}ms)`,
    };
  }
  const openStable = Math.abs(left.bar.open - right.bar.open) <= EPS;
  if (skew != null && skew > syncWindowMs) {
    if (openStable) {
      return {
        ...base,
        candleOpenTime: left.bar.time,
        verdict: "EXPECTED_FORMING_EVOLUTION",
        detail: `Open stable; H/L/C differ across ${skew}ms observation skew (not a fixed historical compare)`,
      };
    }
    return {
      ...base,
      candleOpenTime: left.bar.time,
      verdict: "UNSAFE_FORMING_COMPARE",
      detail: `Unsynchronized forming compare (${skew}ms) with open drift`,
    };
  }
  // Synchronized window but still mismatch → genuine defect or micro-tick race.
  if (openStable && skew != null && skew <= syncWindowMs) {
    return {
      ...base,
      candleOpenTime: left.bar.time,
      verdict: "EXPECTED_FORMING_EVOLUTION",
      detail: `Near-sync (${skew}ms) forming tip evolution on H/L/C`,
    };
  }
  return {
    ...base,
    candleOpenTime: left.bar.time,
    verdict: "GENUINE_OHLC_MISMATCH",
    detail: "Synchronized forming tips disagree including open",
  };
}

export function reconcileSeries(input: {
  symbol: string;
  timeframe: string;
  leftSource: string;
  rightSource: string;
  leftObservedAt: string;
  rightObservedAt: string;
  leftBars: OhlcBar[];
  rightBars: OhlcBar[];
}): { closed: ReconciliationResult[]; forming: ReconciliationResult | null } {
  const leftSplit = splitClosedAndForming(input.leftBars);
  const rightSplit = splitClosedAndForming(input.rightBars);
  const closedTimes = new Set(leftSplit.closed.map((b) => b.time));
  for (const b of rightSplit.closed) closedTimes.add(b.time);
  const closed: ReconciliationResult[] = [];
  for (const t of [...closedTimes].sort((a, b) => a - b)) {
    closed.push(
      reconcileClosedBar({
        symbol: input.symbol,
        timeframe: input.timeframe,
        left: {
          source: input.leftSource,
          observedAt: input.leftObservedAt,
          bar: findBarByOpenTime(leftSplit.closed, t),
        },
        right: {
          source: input.rightSource,
          observedAt: input.rightObservedAt,
          bar: findBarByOpenTime(rightSplit.closed, t),
        },
      }),
    );
  }
  let forming: ReconciliationResult | null = null;
  if (leftSplit.forming || rightSplit.forming) {
    forming = reconcileFormingBar({
      symbol: input.symbol,
      timeframe: input.timeframe,
      left: {
        source: input.leftSource,
        observedAt: input.leftObservedAt,
        bar: leftSplit.forming,
      },
      right: {
        source: input.rightSource,
        observedAt: input.rightObservedAt,
        bar: rightSplit.forming,
      },
    });
  }
  return { closed, forming };
}

export function summarizeReconciliation(results: ReconciliationResult[]): {
  exactMatches: number;
  expectedFormingEvolution: number;
  mismatches: number;
  other: number;
  blocking: boolean;
} {
  let exactMatches = 0;
  let expectedFormingEvolution = 0;
  let mismatches = 0;
  let other = 0;
  for (const r of results) {
    if (r.verdict === "EXACT_MATCH") exactMatches += 1;
    else if (r.verdict === "EXPECTED_FORMING_EVOLUTION") expectedFormingEvolution += 1;
    else if (r.verdict === "GENUINE_OHLC_MISMATCH" || r.verdict === "INVALID_OHLC") mismatches += 1;
    else other += 1;
  }
  return {
    exactMatches,
    expectedFormingEvolution,
    mismatches,
    other,
    blocking: mismatches > 0,
  };
}
