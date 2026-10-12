/**
 * Analysis period → UTC window + candle-count limits (Phase 43B/43C).
 * Candle timeframe and analysis period remain independent.
 */
import {
  CANONICAL_TIMEFRAMES,
  type CanonicalTimeframeId,
  parseCanonicalTimeframe,
} from "../providers/contracts.js";
import {
  ANALYSIS_PERIOD_IDS,
  type AnalysisPeriodId,
  type AnalysisTimeRange,
} from "./types.js";

export const ANALYSIS_SNAPSHOT_MAX_CANDLES = 300;
export const ANALYSIS_SNAPSHOT_STALE_QUOTE_MS = 15_000;
/** Max custom lookback span (inclusive of 7d preset). */
export const ANALYSIS_SNAPSHOT_MAX_CUSTOM_SPAN_MS = 7 * 24 * 60 * 60_000;

const PERIOD_MS: Record<Exclude<AnalysisPeriodId, "custom">, number> = {
  "5m": 5 * 60_000,
  "30m": 30 * 60_000,
  "2h": 2 * 60 * 60_000,
  "3h": 3 * 60 * 60_000,
  "4h": 4 * 60 * 60_000,
  "5h": 5 * 60 * 60_000,
  "6h": 6 * 60 * 60_000,
  "12h": 12 * 60 * 60_000,
  "24h": 24 * 60 * 60_000,
  "2d": 2 * 24 * 60 * 60_000,
  "3d": 3 * 24 * 60 * 60_000,
  "4d": 4 * 24 * 60 * 60_000,
  "5d": 5 * 24 * 60 * 60_000,
  "6d": 6 * 24 * 60 * 60_000,
  "7d": 7 * 24 * 60 * 60_000,
};

const TIMEFRAME_MS: Record<CanonicalTimeframeId, number> = {
  "1m": 60_000,
  "5m": 5 * 60_000,
  "15m": 15 * 60_000,
  "30m": 30 * 60_000,
  "1h": 60 * 60_000,
  "4h": 4 * 60 * 60_000,
  "1d": 24 * 60 * 60_000,
  "1w": 7 * 24 * 60 * 60_000,
};

export function parseAnalysisPeriodId(raw: unknown): AnalysisPeriodId | null {
  const value = String(raw ?? "").trim().toLowerCase();
  return (ANALYSIS_PERIOD_IDS as readonly string[]).includes(value)
    ? value as AnalysisPeriodId
    : null;
}

export function timeframeIntervalMs(tf: CanonicalTimeframeId): number {
  return TIMEFRAME_MS[tf];
}

export function periodDurationMs(period: Exclude<AnalysisPeriodId, "custom">): number {
  return PERIOD_MS[period];
}

export function resolveAnalysisWindow(
  analysisPeriod: Exclude<AnalysisPeriodId, "custom">,
  nowMs: number = Date.now(),
): AnalysisTimeRange {
  const endMs = nowMs;
  const startMs = endMs - PERIOD_MS[analysisPeriod];
  return {
    startMs,
    endMs,
    startUtc: new Date(startMs).toISOString(),
    endUtc: new Date(endMs).toISOString(),
  };
}

export function resolveCustomAnalysisWindow(
  rangeStartUtc: unknown,
  rangeEndUtc: unknown,
): { ok: true; value: AnalysisTimeRange } | { ok: false; code: string; message: string } {
  const startMs = Date.parse(String(rangeStartUtc ?? ""));
  const endMs = Date.parse(String(rangeEndUtc ?? ""));
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return {
      ok: false,
      code: "INVALID_CUSTOM_RANGE",
      message: "Custom analysis period requires valid rangeStartUtc and rangeEndUtc (ISO-8601 UTC).",
    };
  }
  if (endMs <= startMs) {
    return {
      ok: false,
      code: "INVALID_CUSTOM_RANGE",
      message: "Custom analysis range end must be after start.",
    };
  }
  const span = endMs - startMs;
  if (span > ANALYSIS_SNAPSHOT_MAX_CUSTOM_SPAN_MS) {
    return {
      ok: false,
      code: "REQUEST_TOO_EXPENSIVE",
      message:
        `Custom analysis span exceeds ${ANALYSIS_SNAPSHOT_MAX_CUSTOM_SPAN_MS / (24 * 60 * 60_000)} days.`,
    };
  }
  return {
    ok: true,
    value: {
      startMs,
      endMs,
      startUtc: new Date(startMs).toISOString(),
      endUtc: new Date(endMs).toISOString(),
    },
  };
}

/**
 * Continuous mathematical estimate — does not assume every instrument trades
 * every interval (weekends/sessions may reduce actual returned candles).
 */
export function estimateCandleCount(
  candleTimeframe: CanonicalTimeframeId,
  spanMs: number,
): number {
  const interval = TIMEFRAME_MS[candleTimeframe];
  return Math.max(1, Math.ceil(spanMs / interval));
}

export function estimateCandleCountForPeriod(
  candleTimeframe: CanonicalTimeframeId,
  analysisPeriod: Exclude<AnalysisPeriodId, "custom">,
): number {
  return estimateCandleCount(candleTimeframe, PERIOD_MS[analysisPeriod]);
}

/** Combinations that stay within the snapshot candle budget. */
export function listAffordablePeriodTimeframePairs(): Array<{
  analysisPeriod: Exclude<AnalysisPeriodId, "custom">;
  candleTimeframe: CanonicalTimeframeId;
  estimate: number;
}> {
  const out: Array<{
    analysisPeriod: Exclude<AnalysisPeriodId, "custom">;
    candleTimeframe: CanonicalTimeframeId;
    estimate: number;
  }> = [];
  for (const period of ANALYSIS_PERIOD_IDS) {
    if (period === "custom") continue;
    for (const tf of CANONICAL_TIMEFRAMES) {
      const estimate = estimateCandleCountForPeriod(tf, period);
      if (estimate <= ANALYSIS_SNAPSHOT_MAX_CANDLES) {
        out.push({ analysisPeriod: period, candleTimeframe: tf, estimate });
      }
    }
  }
  return out;
}

export interface ResolvedAnalysisRequest {
  candleTimeframe: CanonicalTimeframeId;
  analysisPeriod: AnalysisPeriodId;
  higherTimeframes: CanonicalTimeframeId[];
  requestedRange: AnalysisTimeRange;
  candlesRequestedEstimate: number;
  fetchLimit: number;
}

export function resolveAndValidateRequestShape(input: {
  candleTimeframe: unknown;
  analysisPeriod: unknown;
  higherTimeframes?: unknown;
  rangeStartUtc?: unknown;
  rangeEndUtc?: unknown;
  nowMs?: number;
}): { ok: true; value: ResolvedAnalysisRequest } | { ok: false; code: string; message: string } {
  const candleTimeframe = parseCanonicalTimeframe(input.candleTimeframe);
  if (!candleTimeframe) {
    return {
      ok: false,
      code: "UNSUPPORTED_TIMEFRAME",
      message: `Unsupported candle timeframe. Allowed: ${CANONICAL_TIMEFRAMES.join(", ")}.`,
    };
  }
  const analysisPeriod = parseAnalysisPeriodId(input.analysisPeriod);
  if (!analysisPeriod) {
    return {
      ok: false,
      code: "INVALID_ANALYSIS_PERIOD",
      message: `Unsupported analysis period. Allowed: ${ANALYSIS_PERIOD_IDS.join(", ")}.`,
    };
  }

  const higherRaw = Array.isArray(input.higherTimeframes) ? input.higherTimeframes : [];
  const higherTimeframes: CanonicalTimeframeId[] = [];
  for (const raw of higherRaw) {
    const tf = parseCanonicalTimeframe(raw);
    if (!tf) {
      return {
        ok: false,
        code: "UNSUPPORTED_TIMEFRAME",
        message: `Unsupported higher timeframe: ${String(raw)}.`,
      };
    }
    if (tf !== candleTimeframe && !higherTimeframes.includes(tf)) higherTimeframes.push(tf);
  }

  let requestedRange: AnalysisTimeRange;
  if (analysisPeriod === "custom") {
    const custom = resolveCustomAnalysisWindow(input.rangeStartUtc, input.rangeEndUtc);
    if (!custom.ok) return custom;
    requestedRange = custom.value;
  } else {
    requestedRange = resolveAnalysisWindow(analysisPeriod, input.nowMs ?? Date.now());
  }

  const spanMs = requestedRange.endMs - requestedRange.startMs;
  const estimate = estimateCandleCount(candleTimeframe, spanMs);
  if (estimate > ANALYSIS_SNAPSHOT_MAX_CANDLES) {
    return {
      ok: false,
      code: "REQUEST_TOO_EXPENSIVE",
      message:
        `Requested window needs ~${estimate} ${candleTimeframe} candles `
        + `(max ${ANALYSIS_SNAPSHOT_MAX_CANDLES}). Use a coarser timeframe or shorter period.`,
    };
  }

  return {
    ok: true,
    value: {
      candleTimeframe,
      analysisPeriod,
      higherTimeframes,
      requestedRange,
      candlesRequestedEstimate: estimate,
      fetchLimit: Math.min(ANALYSIS_SNAPSHOT_MAX_CANDLES, estimate + 5),
    },
  };
}
