/**
 * Phase 5B.2 Step 2 — multi-timeframe tip synchronization / skew measurement.
 * No universal skew threshold. Do not compare incompatible clock domains.
 */
import {
  resolveTimeframeDurationSec,
  type MifCanonicalCandle,
} from "../../canonical/candle.js";
import type { MifTimebase } from "../../canonical/types.js";
import {
  MIF_QI_CLOCK_DOMAINS_INCOMPARABLE,
  MIF_QI_MTF_ALIGNMENT_UNKNOWN,
  MIF_QI_MTF_SKEW_EXCEEDED,
  MIF_QI_MTF_SKEW_MEASURED,
  MIF_QI_MTF_SKEW_THRESHOLD_UNSET,
  MIF_QI_TIMEBASE_MIXED,
  MIF_QI_TIMEBASE_UNCERTAIN,
} from "../codes.js";
import { effectiveCloseTimeSec } from "../candle-interval-validator.js";
import type { MifQualityFinding } from "../types.js";

export interface TipBoundary {
  timeframe: string;
  openTimeSec: number | null;
  closeTimeSec: number | null;
  candleState: string | null;
  timebase: MifTimebase | null;
  index: number | null;
}

export interface SyncAssessment {
  tips: Record<string, TipBoundary>;
  measuredSkewSec: number | null;
  alignment: "aligned" | "skewed" | "unknown" | "incomparable";
  timebase: MifTimebase | "MIXED" | null;
  findings: MifQualityFinding[];
}

function pickTip(series: readonly MifCanonicalCandle[]): { candle: MifCanonicalCandle; index: number } | null {
  if (!series.length) return null;
  // Prefer last element in original order (assumed newest if ordered); do not silently sort.
  const index = series.length - 1;
  return { candle: series[index]!, index };
}

export function assessMultiTimeframeSynchronization(input: {
  seriesByTimeframe: Readonly<Record<string, readonly MifCanonicalCandle[]>>;
  timeframes: readonly string[];
  skewBoundary: "open" | "close";
  maxTipSkewSec: number | null | undefined;
}): SyncAssessment {
  const findings: MifQualityFinding[] = [];
  const tips: Record<string, TipBoundary> = {};
  const timebases = new Set<MifTimebase>();

  for (const tf of input.timeframes) {
    const series = input.seriesByTimeframe[tf];
    if (!series || series.length === 0) {
      tips[tf] = {
        timeframe: tf,
        openTimeSec: null,
        closeTimeSec: null,
        candleState: null,
        timebase: null,
        index: null,
      };
      continue;
    }
    const tip = pickTip(series)!;
    const c = tip.candle;
    timebases.add(c.timebase);
    tips[tf] = {
      timeframe: tf,
      openTimeSec: Number.isFinite(c.openTimeSec) ? c.openTimeSec : null,
      closeTimeSec: effectiveCloseTimeSec(c, tf),
      candleState: c.candleState,
      timebase: c.timebase,
      index: tip.index,
    };
  }

  let timebase: MifTimebase | "MIXED" | null = null;
  if (timebases.size === 1) timebase = [...timebases][0]!;
  else if (timebases.size > 1) {
    timebase = "MIXED";
    findings.push({
      code: MIF_QI_TIMEBASE_MIXED,
      severity: "blocking",
      message: `mixed tip timebases: ${[...timebases].sort().join(",")}`,
    });
  }

  if (timebase === "UNKNOWN") {
    findings.push({
      code: MIF_QI_TIMEBASE_UNCERTAIN,
      severity: "warning",
      message: "tip timebase UNKNOWN; synchronization claims limited",
    });
  }

  if (timebase === "MIXED") {
    findings.push({
      code: MIF_QI_CLOCK_DOMAINS_INCOMPARABLE,
      severity: "blocking",
      message: "refusing to subtract tip timestamps across mixed clock domains",
    });
    findings.push({
      code: MIF_QI_MTF_ALIGNMENT_UNKNOWN,
      severity: "warning",
      message: "alignment unknown due to incomparable clock domains",
    });
    return {
      tips,
      measuredSkewSec: null,
      alignment: "incomparable",
      timebase,
      findings,
    };
  }

  const values: number[] = [];
  for (const tf of input.timeframes) {
    const tip = tips[tf];
    if (!tip) continue;
    const v = input.skewBoundary === "close" ? tip.closeTimeSec : tip.openTimeSec;
    if (v != null && Number.isFinite(v)) values.push(v);
  }

  if (values.length < 2) {
    findings.push({
      code: MIF_QI_MTF_ALIGNMENT_UNKNOWN,
      severity: "info",
      message: "insufficient tip boundaries to measure multi-timeframe skew",
    });
    return {
      tips,
      measuredSkewSec: null,
      alignment: "unknown",
      timebase,
      findings,
    };
  }

  const measuredSkewSec = Math.max(...values) - Math.min(...values);
  findings.push({
    code: MIF_QI_MTF_SKEW_MEASURED,
    severity: "info",
    message: `measured tip skew ${measuredSkewSec}s across ${values.length} timeframes`,
    evidence: { measuredSkewSec, boundary: input.skewBoundary },
  });

  const threshold = input.maxTipSkewSec;
  if (threshold == null) {
    findings.push({
      code: MIF_QI_MTF_SKEW_THRESHOLD_UNSET,
      severity: "info",
      message:
        "no consumer skew threshold configured; measured skew reported without pass/fail (Phase 2 6h heuristic is not universalized)",
      evidence: { measuredSkewSec },
    });
    return {
      tips,
      measuredSkewSec,
      alignment: "skewed",
      timebase,
      findings,
    };
  }

  if (measuredSkewSec > threshold) {
    findings.push({
      code: MIF_QI_MTF_SKEW_EXCEEDED,
      severity: "degraded",
      message: `measured skew ${measuredSkewSec}s exceeds consumer maxTipSkewSec ${threshold}`,
      evidence: { measuredSkewSec, maxTipSkewSec: threshold },
    });
    return {
      tips,
      measuredSkewSec,
      alignment: "skewed",
      timebase,
      findings,
    };
  }

  return {
    tips,
    measuredSkewSec,
    alignment: "aligned",
    timebase,
    findings,
  };
}

/** Expose duration helper for tests without inventing mappings. */
export function timeframeHasFixedDuration(tf: string): boolean {
  return resolveTimeframeDurationSec(tf) != null;
}
