/**
 * Analysis period → UTC window + candle-count limits (Phase 43B).
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

const PERIOD_MS: Record<AnalysisPeriodId, number> = {
  "30m": 30 * 60_000,
  "2h": 2 * 60 * 60_000,
  "6h": 6 * 60 * 60_000,
  "24h": 24 * 60 * 60_000,
  "3d": 3 * 24 * 60 * 60_000,
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

export function resolveAnalysisWindow(
  analysisPeriod: AnalysisPeriodId,
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

export function estimateCandleCount(
  candleTimeframe: CanonicalTimeframeId,
  analysisPeriod: AnalysisPeriodId,
): number {
  const interval = TIMEFRAME_MS[candleTimeframe];
  const span = PERIOD_MS[analysisPeriod];
  return Math.max(1, Math.ceil(span / interval));
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

  const estimate = estimateCandleCount(candleTimeframe, analysisPeriod);
  if (estimate > ANALYSIS_SNAPSHOT_MAX_CANDLES) {
    return {
      ok: false,
      code: "REQUEST_TOO_EXPENSIVE",
      message:
        `Requested window needs ~${estimate} ${candleTimeframe} candles `
        + `(max ${ANALYSIS_SNAPSHOT_MAX_CANDLES}). Use a coarser timeframe or shorter period.`,
    };
  }

  const requestedRange = resolveAnalysisWindow(analysisPeriod, input.nowMs ?? Date.now());
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
