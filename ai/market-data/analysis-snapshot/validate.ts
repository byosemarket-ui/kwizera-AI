/**
 * Deterministic validation for analysis market snapshots (Phase 43B).
 */
import type { CanonicalTimeframeId } from "../providers/contracts.js";
import { timeframeIntervalMs } from "./periods.js";
import type {
  AnalysisDataGap,
  AnalysisSnapshotCandle,
  AnalysisSnapshotQuote,
  AnalysisSnapshotValidation,
  AnalysisSnapshotValidationStatus,
  AnalysisTimeRange,
} from "./types.js";

function finitePositive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

export function validateOhlcCandle(c: AnalysisSnapshotCandle): string | null {
  if (![c.open, c.high, c.low, c.close].every((v) => typeof v === "number" && Number.isFinite(v))) {
    return "non_finite_ohlc";
  }
  if (c.high < c.low) return "high_below_low";
  if (c.high < c.open || c.high < c.close) return "high_below_open_close";
  if (c.low > c.open || c.low > c.close) return "low_above_open_close";
  if (c.volume != null && (!Number.isFinite(c.volume) || c.volume < 0)) return "invalid_volume";
  if (!Number.isFinite(c.time) || c.time <= 0) return "invalid_time";
  return null;
}

export function detectDataGaps(
  candles: AnalysisSnapshotCandle[],
  timeframe: CanonicalTimeframeId,
  range: AnalysisTimeRange,
): AnalysisDataGap[] {
  const intervalSec = timeframeIntervalMs(timeframe) / 1000;
  const closed = candles.filter((c) => c.isClosed).sort((a, b) => a.time - b.time);
  if (closed.length === 0) return [];

  const gaps: AnalysisDataGap[] = [];
  for (let i = 1; i < closed.length; i += 1) {
    const prev = closed[i - 1]!;
    const cur = closed[i]!;
    const delta = cur.time - prev.time;
    if (delta > intervalSec * 1.5) {
      const missing = Math.max(0, Math.round(delta / intervalSec) - 1);
      gaps.push({
        startUtc: new Date((prev.time + intervalSec) * 1000).toISOString(),
        endUtc: new Date(cur.time * 1000).toISOString(),
        missingIntervals: missing,
      });
    }
  }

  // Leading/trailing coverage vs requested range (completed candles only).
  const first = closed[0]!;
  const last = closed[closed.length - 1]!;
  const rangeStartSec = Math.floor(range.startMs / 1000);
  const rangeEndSec = Math.floor(range.endMs / 1000);
  if (first.time - rangeStartSec > intervalSec * 1.5) {
    gaps.unshift({
      startUtc: range.startUtc,
      endUtc: new Date(first.time * 1000).toISOString(),
      missingIntervals: Math.max(0, Math.round((first.time - rangeStartSec) / intervalSec) - 1),
    });
  }
  if (rangeEndSec - last.time > intervalSec * 2.5) {
    gaps.push({
      startUtc: new Date((last.time + intervalSec) * 1000).toISOString(),
      endUtc: range.endUtc,
      missingIntervals: Math.max(0, Math.round((rangeEndSec - last.time) / intervalSec) - 1),
    });
  }
  return gaps;
}

export function computeCoverageRatio(
  candles: AnalysisSnapshotCandle[],
  estimate: number,
): number {
  if (estimate <= 0) return 0;
  const closed = candles.filter((c) => c.isClosed).length;
  return Math.max(0, Math.min(1, closed / estimate));
}

export function buildValidationReport(input: {
  candles: AnalysisSnapshotCandle[];
  quote: AnalysisSnapshotQuote | null;
  timeframe: CanonicalTimeframeId;
  requestedRange: AnalysisTimeRange;
  candlesRequestedEstimate: number;
  dataGaps: AnalysisDataGap[];
  requireLiveQuote: boolean;
  providerError: string | null;
}): AnalysisSnapshotValidation {
  const checks: AnalysisSnapshotValidation["checks"] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  if (input.providerError) {
    errors.push(input.providerError);
    checks.push({ id: "provider", ok: false, detail: input.providerError });
  } else {
    checks.push({ id: "provider", ok: true, detail: "Provider response received." });
  }

  const sorted = [...input.candles].sort((a, b) => a.time - b.time);
  let chronoOk = true;
  let dupOk = true;
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i]!.time < sorted[i - 1]!.time) chronoOk = false;
    if (sorted[i]!.time === sorted[i - 1]!.time) dupOk = false;
  }
  checks.push({ id: "chronology", ok: chronoOk, detail: chronoOk ? "Candles sorted ascending." : "Out-of-order candles." });
  checks.push({ id: "duplicates", ok: dupOk, detail: dupOk ? "No duplicate timestamps." : "Duplicate candle timestamps." });
  if (!chronoOk) errors.push("Candle chronology invalid.");
  if (!dupOk) errors.push("Duplicate candle timestamps.");

  let ohlcOk = true;
  for (const c of sorted) {
    const reason = validateOhlcCandle(c);
    if (reason) {
      ohlcOk = false;
      errors.push(`Invalid OHLC at ${c.time}: ${reason}`);
      break;
    }
  }
  checks.push({ id: "ohlc", ok: ohlcOk, detail: ohlcOk ? "OHLC relationships valid." : "OHLC validation failed." });

  const closedCount = sorted.filter((c) => c.isClosed).length;
  const formingCount = sorted.filter((c) => !c.isClosed).length;
  checks.push({
    id: "forming",
    ok: formingCount <= 1,
    detail: formingCount <= 1
      ? `Forming candles: ${formingCount}; completed: ${closedCount}.`
      : `Too many forming candles (${formingCount}).`,
  });
  if (formingCount > 1) errors.push("Multiple forming candles present.");

  const coverage = computeCoverageRatio(sorted, input.candlesRequestedEstimate);
  const coverageOk = closedCount >= Math.min(3, input.candlesRequestedEstimate);
  checks.push({
    id: "coverage",
    ok: coverageOk,
    detail: `Closed coverage ${(coverage * 100).toFixed(0)}% (${closedCount}/${input.candlesRequestedEstimate}).`,
  });
  if (!coverageOk) errors.push("Insufficient completed candles for the requested analysis period.");
  if (coverage < 0.85 && coverageOk) {
    warnings.push(`Partial historical coverage (${(coverage * 100).toFixed(0)}%).`);
  }
  if (input.dataGaps.length) {
    warnings.push(`${input.dataGaps.length} data gap region(s) detected.`);
    checks.push({
      id: "gaps",
      ok: true,
      detail: `${input.dataGaps.length} gap region(s); reported, not filled.`,
    });
  } else {
    checks.push({ id: "gaps", ok: true, detail: "No interior gaps detected among completed candles." });
  }

  const quote = input.quote;
  if (!quote || quote.freshness === "UNAVAILABLE" || quote.freshness === "HISTORICAL_ONLY") {
    checks.push({
      id: "quote",
      ok: !input.requireLiveQuote,
      detail: input.requireLiveQuote
        ? "Live quote required but unavailable."
        : "No live quote; historical-only snapshot allowed.",
    });
    if (input.requireLiveQuote) errors.push("Fresh live quote required but unavailable.");
    else warnings.push("Live quote unavailable for this instrument; snapshot is historical-only.");
  } else if (quote.freshness === "STALE") {
    checks.push({ id: "quote", ok: !input.requireLiveQuote, detail: "Instrument quote is STALE." });
    if (input.requireLiveQuote) errors.push("Live quote is stale.");
    else warnings.push("Instrument quote is stale.");
  } else if (quote.freshness === "MARKET_INACTIVE" || quote.freshness === "WAITING") {
    checks.push({
      id: "quote",
      ok: !input.requireLiveQuote,
      detail: `Instrument quote state: ${quote.freshness}.`,
    });
    if (input.requireLiveQuote) errors.push(`Live quote not ready (${quote.freshness}).`);
    else warnings.push(`Instrument quote state: ${quote.freshness}.`);
  } else {
    checks.push({ id: "quote", ok: true, detail: "Instrument-specific quote is LIVE." });
  }

  if (quote?.bid != null && quote.ask != null && quote.bid > quote.ask) {
    errors.push("Bid exceeds ask.");
    checks.push({ id: "bid_ask", ok: false, detail: "Bid > ask." });
  } else {
    checks.push({ id: "bid_ask", ok: true, detail: "Bid/ask relationship acceptable or quote absent." });
  }

  let status: AnalysisSnapshotValidationStatus;
  if (input.providerError && closedCount === 0) status = "PROVIDER_ERROR";
  else if (errors.some((e) => /required|Invalid request|Unsupported/i.test(e))) status = "INVALID_REQUEST";
  else if (!coverageOk || !ohlcOk || !chronoOk || !dupOk) status = "INSUFFICIENT_DATA";
  else if (input.requireLiveQuote && quote?.freshness === "STALE") status = "STALE_DATA";
  else if (
    input.requireLiveQuote
    && (quote?.freshness === "MARKET_INACTIVE" || quote?.freshness === "WAITING")
  ) status = "MARKET_INACTIVE";
  else if (warnings.length) status = "VALID_WITH_WARNINGS";
  else status = "VALID";

  return { status, checks, warnings, errors };
}

export function isEvidenceReady(validation: AnalysisSnapshotValidation): boolean {
  return validation.status === "VALID" || validation.status === "VALID_WITH_WARNINGS";
}
