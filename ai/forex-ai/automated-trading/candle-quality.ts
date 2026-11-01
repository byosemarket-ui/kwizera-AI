/**
 * Phase 4.14B — Historical candle quality audit (no synthetic bars).
 * Session gaps are reported; never filled with fabricated OHLC.
 */

export interface CandleQualityBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  closed?: boolean;
}

export interface CandleQualityReport {
  instrument: string | null;
  timeframe: string | null;
  source: string;
  requestedBars: number | null;
  returnedBars: number;
  closedBars: number;
  formingBars: number;
  earliestTimestamp: number | null;
  latestTimestamp: number | null;
  duplicateCount: number;
  outOfOrderCount: number;
  invalidOhlcCount: number;
  missingSessionGapCount: number;
  priceBasis: "unknown" | "bid" | "ask" | "mid";
  dataFreshnessMs: number | null;
  strategyClosedBarsRequired: number;
  strategyReady: boolean;
  blockers: string[];
}

function finitePositive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

function ohlcInvalid(c: CandleQualityBar): boolean {
  if (![c.open, c.high, c.low, c.close].every((v) => typeof v === "number" && Number.isFinite(v))) {
    return true;
  }
  if (!(c.high >= c.low)) return true;
  if (!(c.high >= c.open && c.high >= c.close)) return true;
  if (!(c.low <= c.open && c.low <= c.close)) return true;
  if (!(c.open > 0 && c.high > 0 && c.low > 0 && c.close > 0)) return true;
  return false;
}

/**
 * Audit a candle series for strategy readiness. Does not invent missing bars.
 */
export function auditCandleQuality(input: {
  candles: ReadonlyArray<CandleQualityBar>;
  instrument?: string | null;
  timeframe?: string | null;
  source?: string;
  requestedBars?: number | null;
  priceBasis?: CandleQualityReport["priceBasis"];
  /** Expected bar step in seconds for gap heuristics (null = skip gap count). */
  expectedStepSeconds?: number | null;
  /** Max session gap multiples before counting as missing (default 3). */
  gapThresholdMultiples?: number;
  strategyClosedBarsRequired?: number;
  nowMs?: number;
}): CandleQualityReport {
  const candles = Array.isArray(input.candles) ? [...input.candles] : [];
  const required = Math.max(1, Math.floor(input.strategyClosedBarsRequired ?? 23));
  let duplicateCount = 0;
  let outOfOrderCount = 0;
  let invalidOhlcCount = 0;
  let missingSessionGapCount = 0;
  let closedBars = 0;
  let formingBars = 0;
  const seen = new Set<number>();
  let prevTime: number | null = null;
  const step = input.expectedStepSeconds != null && input.expectedStepSeconds > 0
    ? input.expectedStepSeconds
    : null;
  const gapMult = Math.max(2, Math.floor(input.gapThresholdMultiples ?? 3));

  for (const c of candles) {
    const t = Number(c.time);
    if (!Number.isFinite(t)) {
      invalidOhlcCount += 1;
      continue;
    }
    if (seen.has(t)) duplicateCount += 1;
    else seen.add(t);
    if (prevTime != null) {
      if (t < prevTime) outOfOrderCount += 1;
      else if (step != null && t - prevTime > step * gapMult) {
        missingSessionGapCount += 1;
      }
    }
    prevTime = t;
    if (ohlcInvalid(c)) invalidOhlcCount += 1;
    if (c.closed === false) formingBars += 1;
    else closedBars += 1;
  }

  const earliest = candles.length ? Number(candles[0]!.time) : null;
  const latest = candles.length ? Number(candles[candles.length - 1]!.time) : null;
  const nowMs = input.nowMs ?? Date.now();
  const latestMs = latest != null && Number.isFinite(latest)
    ? (latest > 1e12 ? latest : latest * 1000)
    : null;
  const dataFreshnessMs = latestMs != null ? Math.max(0, nowMs - latestMs) : null;

  const blockers: string[] = [];
  if (closedBars < required) blockers.push("INSUFFICIENT_CLOSED_CANDLES");
  if (duplicateCount > 0) blockers.push("DUPLICATE_CANDLES");
  if (outOfOrderCount > 0) blockers.push("OUT_OF_ORDER_CANDLES");
  if (invalidOhlcCount > 0) blockers.push("INVALID_OHLC");
  if (!input.instrument) blockers.push("NO_INSTRUMENT");

  return {
    instrument: input.instrument ?? null,
    timeframe: input.timeframe ?? null,
    source: input.source ?? "unknown",
    requestedBars: input.requestedBars ?? null,
    returnedBars: candles.length,
    closedBars,
    formingBars,
    earliestTimestamp: earliest != null && Number.isFinite(earliest) ? earliest : null,
    latestTimestamp: latest != null && Number.isFinite(latest) ? latest : null,
    duplicateCount,
    outOfOrderCount,
    invalidOhlcCount,
    missingSessionGapCount,
    priceBasis: input.priceBasis ?? "unknown",
    dataFreshnessMs,
    strategyClosedBarsRequired: required,
    strategyReady: blockers.length === 0 && closedBars >= required,
    blockers,
  };
}

export function finitePositivePrice(n: unknown): boolean {
  return finitePositive(n);
}
