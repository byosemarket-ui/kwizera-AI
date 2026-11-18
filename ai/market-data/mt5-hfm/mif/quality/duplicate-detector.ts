/**
 * Phase 5B.2 Step 1 — duplicate open / interval / conflicting candle detection.
 * Preserves original input order; does not sort the input array.
 */
import type { MifCanonicalCandle } from "../canonical/candle.js";
import {
  MIF_QI_CONFLICTING_CANDLE,
  MIF_QI_DUPLICATE_INTERVAL,
  MIF_QI_DUPLICATE_OPEN,
} from "./codes.js";
import { effectiveCloseTimeSec } from "./candle-interval-validator.js";
import type { MifQualityFinding } from "./types.js";

function ohlcKey(c: MifCanonicalCandle): string {
  return `${c.open}|${c.high}|${c.low}|${c.close}|${c.candleState}`;
}

/**
 * Detect duplicate opens and conflicting records in original input order.
 */
export function detectDuplicateCandles(
  candles: readonly MifCanonicalCandle[],
  seriesTimeframe: string,
): MifQualityFinding[] {
  const findings: MifQualityFinding[] = [];
  const byOpen = new Map<number, number[]>();

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i]!;
    if (typeof c.openTimeSec !== "number" || !Number.isFinite(c.openTimeSec)) continue;
    const list = byOpen.get(c.openTimeSec) ?? [];
    list.push(i);
    byOpen.set(c.openTimeSec, list);
  }

  for (const [open, indexes] of byOpen) {
    if (indexes.length < 2) continue;
    const first = candles[indexes[0]!]!;
    const firstKey = ohlcKey(first);
    let conflicting = false;
    for (let k = 1; k < indexes.length; k++) {
      const other = candles[indexes[k]!]!;
      if (ohlcKey(other) !== firstKey) {
        conflicting = true;
        findings.push({
          code: MIF_QI_CONFLICTING_CANDLE,
          severity: "blocking",
          message: `conflicting candles at openTimeSec=${open} indexes=${indexes[0]},${indexes[k]}`,
          candleIndex: indexes[k],
          openTimeSec: open,
          closeTimeSec: other.closeTimeSec,
          candleState: other.candleState,
          evidence: { firstIndex: indexes[0]!, otherIndex: indexes[k]! },
        });
      }
    }
    if (!conflicting) {
      findings.push({
        code: MIF_QI_DUPLICATE_OPEN,
        severity: "blocking",
        message: `duplicate openTimeSec=${open} count=${indexes.length}`,
        candleIndex: indexes[1],
        openTimeSec: open,
        closeTimeSec: first.closeTimeSec,
        candleState: first.candleState,
        evidence: { indexes: indexes.join(",") },
      });
    }

    // Same open implies same interval identity when duration known.
    const close = effectiveCloseTimeSec(first, seriesTimeframe);
    if (close != null) {
      findings.push({
        code: MIF_QI_DUPLICATE_INTERVAL,
        severity: "blocking",
        message: `duplicate interval identity [${open}, ${close})`,
        candleIndex: indexes[1],
        openTimeSec: open,
        closeTimeSec: close,
        expectedDurationSec: close - open,
      });
    }
  }

  return findings;
}
