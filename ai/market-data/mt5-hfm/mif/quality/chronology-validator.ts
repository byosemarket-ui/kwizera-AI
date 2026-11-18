/**
 * Phase 5B.2 Step 1 — chronological order + overlap detection on original input.
 * Does not silently sort or mutate the input series.
 */
import type { MifCanonicalCandle } from "../canonical/candle.js";
import { MIF_QI_OUT_OF_ORDER, MIF_QI_OVERLAPPING_INTERVAL, MIF_QI_TIMEBASE_MIXED } from "./codes.js";
import { effectiveCloseTimeSec } from "./candle-interval-validator.js";
import type { MifQualityFinding } from "./types.js";
import type { MifTimebase } from "../canonical/types.js";

export interface ChronologyResult {
  orderingValid: boolean;
  findings: MifQualityFinding[];
  timebase: MifTimebase | "MIXED";
}

/**
 * Check non-decreasing open times in original order and half-open overlaps
 * among consecutive structurally timed candles.
 */
export function validateCandleChronology(
  candles: readonly MifCanonicalCandle[],
  seriesTimeframe: string,
): ChronologyResult {
  const findings: MifQualityFinding[] = [];
  let orderingValid = true;

  const timebases = new Set<string>();
  for (const c of candles) {
    if (c.timebase) timebases.add(c.timebase);
  }
  let timebase: MifTimebase | "MIXED" = "UNKNOWN";
  if (timebases.size === 1) {
    timebase = [...timebases][0] as MifTimebase;
  } else if (timebases.size > 1) {
    timebase = "MIXED";
    findings.push({
      code: MIF_QI_TIMEBASE_MIXED,
      severity: "blocking",
      message: `mixed timebases in series: ${[...timebases].sort().join(",")}`,
      evidence: { timebases: [...timebases].sort().join(",") },
    });
  }

  // Do not compare across clock domains as equivalent when MIXED — already blocked.
  let lastOpen = -Infinity;
  let lastClose: number | null = null;
  let lastIndex = -1;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i]!;
    const open = c.openTimeSec;
    if (typeof open !== "number" || !Number.isFinite(open)) continue;

    if (open < lastOpen) {
      orderingValid = false;
      findings.push({
        code: MIF_QI_OUT_OF_ORDER,
        severity: "blocking",
        message: `openTimeSec ${open} < previous ${lastOpen}`,
        candleIndex: i,
        openTimeSec: open,
        closeTimeSec: c.closeTimeSec,
        actualOpenTimeSec: open,
        expectedOpenTimeSec: lastOpen,
        candleState: c.candleState,
        evidence: { previousIndex: lastIndex },
      });
    }

    const close = effectiveCloseTimeSec(c, seriesTimeframe);
    if (
      timebase !== "MIXED" &&
      lastClose != null &&
      Number.isFinite(lastClose) &&
      open < lastClose &&
      open !== lastOpen
    ) {
      // Half-open [prevOpen, prevClose): next open must be >= prevClose to avoid overlap.
      findings.push({
        code: MIF_QI_OVERLAPPING_INTERVAL,
        severity: "blocking",
        message: `interval overlaps previous: open ${open} < previous close ${lastClose}`,
        candleIndex: i,
        openTimeSec: open,
        closeTimeSec: close,
        expectedOpenTimeSec: lastClose,
        actualOpenTimeSec: open,
        candleState: c.candleState,
        evidence: { previousIndex: lastIndex, previousClose: lastClose },
      });
    }

    lastOpen = open;
    lastClose = close;
    lastIndex = i;
  }

  return { orderingValid, findings, timebase };
}
