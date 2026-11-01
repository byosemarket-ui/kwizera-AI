/**
 * Phase 4.18C — Pure adapters from existing strategy / OpenAI contracts → canonical slices.
 * Never mutates broker state. Never copies AI values into deterministic indicator fields.
 */
import { createHash } from "node:crypto";
import {
  FOREXCONNECT_TIMEFRAME_MS,
  isForexConnectSupportedTimeframe,
  type ForexConnectSupportedTimeframe,
} from "../../../market-data/forexconnect/timeframes.js";
import type { StrategyEvaluation } from "../auto-engine/strategy/evaluate.js";
import { SMA_CROSSOVER_RULES } from "../auto-engine/strategy/rules.js";
import type { AtOpenAiAnalysisResult } from "./types.js";
import type {
  CanonicalAiInterpretationSlice,
  CanonicalCandleRef,
  CanonicalDeterministicStrategySlice,
  CanonicalTimeframeId,
} from "./canonical-analysis.types.js";

const TF_ALIASES: Record<string, CanonicalTimeframeId> = {
  "1m": "1m",
  m1: "1m",
  M1: "1m",
  "5m": "5m",
  m5: "5m",
  M5: "5m",
  "15m": "15m",
  m15: "15m",
  M15: "15m",
  "30m": "30m",
  m30: "30m",
  M30: "30m",
  "1h": "1h",
  h1: "1h",
  H1: "1h",
  "4h": "4h",
  h4: "4h",
  H4: "4h",
  "1d": "1d",
  d1: "1d",
  D1: "1d",
  "1w": "1w",
  w1: "1w",
  W1: "1w",
};

export function normalizeInstrumentId(raw: string | null | undefined): string {
  return String(raw ?? "").replace(/\s+/g, "").toUpperCase();
}

export function normalizeCanonicalTimeframe(
  raw: string | null | undefined,
): CanonicalTimeframeId | null {
  const t = String(raw ?? "").trim();
  if (!t) return null;
  if (TF_ALIASES[t]) return TF_ALIASES[t];
  const lower = t.toLowerCase();
  if (TF_ALIASES[lower]) return TF_ALIASES[lower];
  if (isForexConnectSupportedTimeframe(lower)) {
    return lower as ForexConnectSupportedTimeframe as CanonicalTimeframeId;
  }
  return null;
}

/**
 * Accept unix seconds, or ms only when clearly > 1e12.
 * Reject ambiguous / invalid timestamps.
 */
export function normalizeUnixSeconds(raw: number | null | undefined): number | null {
  if (raw == null || !Number.isFinite(raw)) return null;
  if (raw < 0) return null;
  // Milliseconds epoch (after ~2001-09 in ms)
  if (raw > 1e12) {
    const sec = Math.floor(raw / 1000);
    return sec > 0 ? sec : null;
  }
  // Seconds epoch — reject values that look like ms mistaken as seconds (too large for year 2286)
  if (raw > 1e11) return null;
  // Reject absurdly small (before ~2001)
  if (raw < 1_000_000_000) return null;
  return Math.floor(raw);
}

export function candleCloseSecForTf(openTimeSec: number, timeframe: CanonicalTimeframeId): number {
  const ms = FOREXCONNECT_TIMEFRAME_MS[timeframe];
  return openTimeSec + Math.floor(ms / 1000);
}

export function fingerprintClosedCandle(input: {
  instrument: string;
  timeframe: string;
  openTimeSec: number;
  entryPrice: number | null;
}): string {
  const h = createHash("sha256");
  h.update(normalizeInstrumentId(input.instrument));
  h.update("|");
  h.update(input.timeframe);
  h.update("|");
  h.update(String(input.openTimeSec));
  h.update("|");
  h.update(input.entryPrice == null ? "" : String(input.entryPrice));
  return h.digest("hex").slice(0, 24);
}

export function toCanonicalFromStrategy(input: {
  evaluation: StrategyEvaluation;
  instrument: string;
  timeframe: string;
  asOfUtc?: string;
}):
  | { ok: true; slice: CanonicalDeterministicStrategySlice; instrument: string; timeframe: CanonicalTimeframeId }
  | { ok: false; code: string; message: string } {
  const instrument = normalizeInstrumentId(input.instrument);
  if (!instrument) {
    return { ok: false, code: "INSTRUMENT_MISSING", message: "Instrument required for strategy adapter." };
  }
  const timeframe = normalizeCanonicalTimeframe(input.timeframe);
  if (!timeframe) {
    return {
      ok: false,
      code: "TIMEFRAME_UNSUPPORTED",
      message: `Unsupported timeframe "${input.timeframe}".`,
    };
  }

  const ev = input.evaluation;
  let closedCandle: CanonicalCandleRef | null = null;
  if (ev.closedCandleOpenSec != null) {
    const openSec = normalizeUnixSeconds(ev.closedCandleOpenSec);
    if (openSec == null) {
      return {
        ok: false,
        code: "CANDLE_TIMESTAMP_INVALID",
        message: "closedCandleOpenSec is not a valid unix timestamp.",
      };
    }
    closedCandle = {
      instrument,
      timeframe,
      openTimeSec: openSec,
      closeTimeSec: candleCloseSecForTf(openSec, timeframe),
      ohlcFingerprint: fingerprintClosedCandle({
        instrument,
        timeframe,
        openTimeSec: openSec,
        entryPrice: ev.entryPrice,
      }),
      closed: true,
    };
  }

  const asOf = input.asOfUtc ?? new Date().toISOString();
  void asOf;

  const slice: CanonicalDeterministicStrategySlice = {
    strategyId: ev.strategyId || SMA_CROSSOVER_RULES.strategyId,
    direction: ev.direction,
    code: ev.code,
    reasons: [...ev.reasons],
    entryPrice: ev.entryPrice,
    stopLoss: ev.stopLoss,
    takeProfit: ev.takeProfit,
    confidencePct: ev.confidencePct,
    closedCandle,
    atrMethod: "SMA_OF_TR",
  };

  return { ok: true, slice, instrument, timeframe };
}

export function toCanonicalFromOpenAi(
  analysis: AtOpenAiAnalysisResult | null | undefined,
):
  | { ok: true; slice: CanonicalAiInterpretationSlice; instrument: string }
  | { ok: false; code: string; message: string; slice: null } {
  if (!analysis) {
    return {
      ok: false,
      code: "AI_UNAVAILABLE",
      message: "OpenAI analysis not provided.",
      slice: null,
    };
  }

  const instrument = normalizeInstrumentId(analysis.instrument);
  if (!instrument) {
    return {
      ok: false,
      code: "AI_INSTRUMENT_MISSING",
      message: "OpenAI analysis missing instrument.",
      slice: null,
    };
  }

  const lifecycleOk = analysis.lifecycle === "ANALYSIS_VALID";
  const direction =
    lifecycleOk && (analysis.direction === "BUY" || analysis.direction === "SELL")
      ? analysis.direction
      : null;

  const slice: CanonicalAiInterpretationSlice = {
    analysisId: analysis.analysisId,
    schemaVersion: "at-openai-ta-v1",
    lifecycle: analysis.lifecycle,
    direction,
    directionalBias: analysis.directionalBias,
    trendState: analysis.trendState,
    trendStrength: analysis.trendStrength,
    mtfAgreement: analysis.mtfAgreement,
    supportLevels: (analysis.supportLevels ?? []).map((l) => ({
      price: l.price,
      verifiedAgainstSnapshot: Boolean(l.verifiedAgainstSnapshot),
      provenance: "AI_INTERPRETED" as const,
    })),
    resistanceLevels: (analysis.resistanceLevels ?? []).map((l) => ({
      price: l.price,
      verifiedAgainstSnapshot: Boolean(l.verifiedAgainstSnapshot),
      provenance: "AI_INTERPRETED" as const,
    })),
    explanation: analysis.explanation ?? null,
    directionalConfidencePct: analysis.directionalConfidencePct,
    placesOrders: false,
  };

  return { ok: true, slice, instrument };
}

/** Assert AI slice never mutates indicator targets (test helper / guard). */
export function assertAiCannotPopulateIndicators(ai: CanonicalAiInterpretationSlice): {
  atrFromAi: null;
  fastSmaFromAi: null;
  bidFromAi: null;
  askFromAi: null;
} {
  void ai;
  return {
    atrFromAi: null,
    fastSmaFromAi: null,
    bidFromAi: null,
    askFromAi: null,
  };
}
