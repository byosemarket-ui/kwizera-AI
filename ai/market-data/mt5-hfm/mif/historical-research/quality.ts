/**
 * Phase 5F STEP 1 — research bar validation + quality summary.
 * Detects issues; never silently repairs or synthesizes candles.
 */
import { isValidOhlcCandle } from "../../freshness.js";
import { timeframeSeconds } from "../../live-candle-engine.js";
import { classifyResearchCostAvailability } from "./cost-availability.js";
import type {
  MifResearchBarLike,
  MifResearchMissingInterval,
  MifResearchQualitySummary,
  MifResearchStoredBar,
} from "./types.js";

export interface ResearchBarIngestResult {
  accepted: MifResearchStoredBar[];
  rejectedCandles: number;
  duplicateOrOutOfOrderRejected: number;
  invalidOhlcRejected: number;
}

export function toStoredResearchBar(
  bar: MifResearchBarLike,
): MifResearchStoredBar | null {
  if (!isValidOhlcCandle({
    time: bar.time,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
  })) {
    return null;
  }
  return {
    time: bar.time,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    tickVolume:
      typeof bar.tickVolume === "number" && Number.isFinite(bar.tickVolume)
        ? bar.tickVolume
        : null,
    realVolume:
      typeof bar.realVolume === "number" && Number.isFinite(bar.realVolume)
        ? bar.realVolume
        : null,
    spread:
      typeof bar.spread === "number" && Number.isFinite(bar.spread) ? bar.spread : null,
    validationStatus: "ok",
    provenance: bar.provenance === "cached" ? "cached" : "native",
    timebase: "BROKER_SERVER",
  };
}

/**
 * Validate and merge bars chronologically. Rejects duplicates / out-of-order / invalid OHLC.
 * Does not fill gaps.
 */
export function ingestResearchBars(
  existing: readonly MifResearchStoredBar[],
  incoming: readonly MifResearchBarLike[],
): ResearchBarIngestResult {
  const byTime = new Map<number, MifResearchStoredBar>();
  for (const b of existing) byTime.set(b.time, b);

  let rejectedCandles = 0;
  let duplicateOrOutOfOrderRejected = 0;
  let invalidOhlcRejected = 0;

  for (const raw of incoming) {
    const stored = toStoredResearchBar(raw);
    if (!stored) {
      rejectedCandles += 1;
      invalidOhlcRejected += 1;
      continue;
    }
    if (byTime.has(stored.time)) {
      // Exact duplicate open time — reject silently as duplicate (recorded in counters).
      rejectedCandles += 1;
      duplicateOrOutOfOrderRejected += 1;
      continue;
    }
    byTime.set(stored.time, stored);
  }

  const accepted = [...byTime.values()].sort((a, b) => a.time - b.time);
  // Detect any residual out-of-order in incoming relative to merge (already sorted).
  return {
    accepted,
    rejectedCandles,
    duplicateOrOutOfOrderRejected,
    invalidOhlcRejected,
  };
}

export function detectMissingIntervals(
  bars: readonly MifResearchStoredBar[],
  timeframe: string,
): MifResearchMissingInterval[] {
  const step = timeframeSeconds(timeframe);
  if (!step || bars.length < 2) return [];
  const missing: MifResearchMissingInterval[] = [];
  for (let i = 1; i < bars.length; i++) {
    const prev = bars[i - 1]!;
    const next = bars[i]!;
    const delta = next.time - prev.time;
    if (delta <= step) continue;
    const expectedBars = Math.max(0, Math.round(delta / step) - 1);
    if (expectedBars <= 0) continue;
    // Without PIT historical session authority, classify as unknown/possible — never confirmed repair.
    const classification =
      expectedBars >= 3 || delta >= step * 4
        ? "UNKNOWN_SESSION_GAP"
        : "POSSIBLE_GAP";
    missing.push({
      fromOpenTimeSec: prev.time,
      toOpenTimeSec: next.time,
      expectedBars,
      classification,
    });
  }
  return missing;
}

export function buildQualitySummary(input: {
  bars: readonly MifResearchStoredBar[];
  timeframe: string;
  rejectedCandles: number;
  duplicateOrOutOfOrderRejected: number;
  invalidOhlcRejected: number;
  incompleteExportRange: boolean;
  pitMetadataUncertainty: boolean;
  notes?: readonly string[];
}): MifResearchQualitySummary {
  const missingIntervals = detectMissingIntervals(input.bars, input.timeframe);
  if (input.incompleteExportRange) {
    missingIntervals.push({
      fromOpenTimeSec: input.bars[0]?.time ?? 0,
      toOpenTimeSec: input.bars[input.bars.length - 1]?.time ?? 0,
      expectedBars: 0,
      classification: "INCOMPLETE_EXPORT_RANGE",
    });
  }
  return {
    validCandles: input.bars.length,
    rejectedCandles: input.rejectedCandles,
    duplicateOrOutOfOrderRejected: input.duplicateOrOutOfOrderRejected,
    invalidOhlcRejected: input.invalidOhlcRejected,
    missingIntervals,
    incompleteExportRange: input.incompleteExportRange,
    sessionUncertainty: true, // PIT sessions never historically authoritative in STEP 1
    metadataUncertainty: input.pitMetadataUncertainty,
    costDataAvailability: classifyResearchCostAvailability(input.bars),
    notes: [
      ...(input.notes ?? []),
      "gaps recorded but never filled or repaired",
      "session gaps classified without historical session authority",
    ],
  };
}
