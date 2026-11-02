/**
 * Phase 4.18F.3 — Adapt forex-structure engine output for AT evidence.
 * Rules documented in ai/forex-structure (market-structure-v1).
 */

import { detectMarketStructure } from "../../../forex-structure/detect.js";
import { RULE_VERSION } from "../../../forex-structure/params.js";
import type { StrategyCandle } from "../auto-engine/strategy/rules.js";
import type { IndicatorQuality, StructureIntelSummary } from "./types.js";

function closedCandles(candles: readonly StrategyCandle[]) {
  let rows = candles.filter(
    (c) =>
      c
      && Number.isFinite(c.time)
      && Number.isFinite(c.open)
      && Number.isFinite(c.high)
      && Number.isFinite(c.low)
      && Number.isFinite(c.close),
  );
  if (rows.length && rows[rows.length - 1]!.closed === false) {
    rows = rows.slice(0, -1);
  }
  return rows.map((c) => ({
    time: c.time,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    closed: true as const,
  }));
}

export function buildStructureIntel(input: {
  instrument: string;
  timeframe: string;
  candles: readonly StrategyCandle[];
}): StructureIntelSummary {
  const closed = closedCandles(input.candles);
  if (closed.length < 20) {
    return {
      trendState: "UNKNOWN",
      confirmedSwings: 0,
      provisionalSwings: 0,
      classifications: [],
      events: [],
      zones: [],
      rangeHigh: null,
      rangeLow: null,
      method: RULE_VERSION,
      quality: "INSUFFICIENT_DATA",
      note: `Need more closed candles for ${RULE_VERSION}; have ${closed.length}.`,
    };
  }

  try {
    const result = detectMarketStructure({
      provider: "FOREXCONNECT",
      symbol: input.instrument,
      timeframe: input.timeframe,
      candles: closed,
      includeForming: false,
    });

    let quality: IndicatorQuality = "VALID";
    if (result.validation.insufficientHistory) quality = "INSUFFICIENT_DATA";

    const confirmed = result.swings.filter((s) => s.status === "CONFIRMED");
    const provisional = result.swings.filter((s) => s.status === "PROVISIONAL");
    const rangeHigh = confirmed.filter((s) => s.kind === "HIGH").reduce((m, s) => Math.max(m, s.price), Number.NEGATIVE_INFINITY);
    const rangeLow = confirmed.filter((s) => s.kind === "LOW").reduce((m, s) => Math.min(m, s.price), Number.POSITIVE_INFINITY);

    return {
      trendState: result.trendState,
      confirmedSwings: confirmed.length,
      provisionalSwings: provisional.length,
      classifications: result.classifications.slice(-12).map((c) => ({
        label: c.label,
        kind: c.kind,
        price: c.price,
        time: c.time,
      })),
      events: result.events.slice(-12).map((e) => ({
        type: e.type,
        direction: e.direction,
        status: e.status,
        level: e.level,
        breakCandleTime: e.breakCandleTime,
      })),
      zones: result.zones.slice(0, 12).map((z) => ({
        kind: z.kind,
        mid: z.mid,
        status: z.status,
      })),
      rangeHigh: Number.isFinite(rangeHigh) ? rangeHigh : null,
      rangeLow: Number.isFinite(rangeLow) ? rangeLow : null,
      method: RULE_VERSION,
      quality,
      note: result.note,
    };
  } catch (err) {
    return {
      trendState: "UNKNOWN",
      confirmedSwings: 0,
      provisionalSwings: 0,
      classifications: [],
      events: [],
      zones: [],
      rangeHigh: null,
      rangeLow: null,
      method: RULE_VERSION,
      quality: "UNAVAILABLE",
      note: err instanceof Error ? err.message.slice(0, 160) : "structure_failed",
    };
  }
}
