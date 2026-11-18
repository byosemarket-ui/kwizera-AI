/**
 * Phase 5B.2 Step 1 — observed coverage (no universal minCandles=30).
 */
import type { MifCanonicalCandle } from "../canonical/candle.js";
import {
  MIF_QI_COVERAGE_BELOW_REQUIREMENT,
  MIF_QI_COVERAGE_MET,
  MIF_QI_COVERAGE_OBSERVED_RANGE_ONLY,
  MIF_QI_EMPTY_SERIES,
  MIF_QI_INSUFFICIENT_HISTORY,
} from "./codes.js";
import { effectiveCloseTimeSec } from "./candle-interval-validator.js";
import { isStructurallyUsableCandle } from "./ohlc-validator.js";
import type {
  MifCoverageReport,
  MifCoverageRequirement,
  MifQualityFinding,
} from "./types.js";

export interface CoverageAssessment {
  coverage: MifCoverageReport;
  findings: MifQualityFinding[];
  /** Increments insufficientHistoryCount when explicit requirement unmet. */
  insufficientHistoryCount: number;
}

export function assessCandleCoverage(input: {
  candles: readonly MifCanonicalCandle[];
  timeframe: string;
  requirement?: MifCoverageRequirement | null;
}): CoverageAssessment {
  const findings: MifQualityFinding[] = [];
  const observed = input.candles.length;
  let valid = 0;
  let invalid = 0;
  const opens = new Set<number>();
  let firstOpen: number | null = null;
  let lastOpen: number | null = null;
  let lastClose: number | null = null;

  for (const c of input.candles) {
    if (isStructurallyUsableCandle(c)) {
      valid += 1;
      if (Number.isFinite(c.openTimeSec)) {
        opens.add(c.openTimeSec);
        if (firstOpen == null || c.openTimeSec < firstOpen) firstOpen = c.openTimeSec;
        if (lastOpen == null || c.openTimeSec > lastOpen) lastOpen = c.openTimeSec;
        const close = effectiveCloseTimeSec(c, input.timeframe);
        if (close != null && (lastClose == null || close > lastClose)) lastClose = close;
      }
    } else {
      invalid += 1;
    }
  }

  findings.push({
    code: MIF_QI_COVERAGE_OBSERVED_RANGE_ONLY,
    severity: "info",
    message: "coverage describes the observed input window only; completeness of the full market history is not claimed",
  });

  let satisfies: boolean | null = null;
  let insufficientHistoryCount = 0;
  const req = input.requirement ?? null;

  if (observed === 0) {
    findings.push({
      code: MIF_QI_EMPTY_SERIES,
      severity: "degraded",
      message: "empty candle series",
    });
  }

  if (req) {
    satisfies = valid >= req.minValidCandles;
    if (satisfies) {
      findings.push({
        code: MIF_QI_COVERAGE_MET,
        severity: "info",
        message: `validCandleCount ${valid} meets ${req.consumerId} min ${req.minValidCandles}`,
        evidence: { consumerId: req.consumerId, minValidCandles: req.minValidCandles, valid },
      });
    } else {
      insufficientHistoryCount = 1;
      findings.push({
        code: MIF_QI_COVERAGE_BELOW_REQUIREMENT,
        severity: "degraded",
        message: `validCandleCount ${valid} < ${req.consumerId} min ${req.minValidCandles}`,
        evidence: { consumerId: req.consumerId, minValidCandles: req.minValidCandles, valid },
      });
      findings.push({
        code: MIF_QI_INSUFFICIENT_HISTORY,
        severity: "degraded",
        message: `insufficient history for consumer ${req.consumerId}`,
        evidence: { consumerId: req.consumerId, minValidCandles: req.minValidCandles, valid },
      });
    }
  }

  const coverage: MifCoverageReport = {
    observedCandleCount: observed,
    validCandleCount: valid,
    invalidCandleCount: invalid,
    distinctValidIntervalCount: opens.size,
    firstOpenTimeSec: firstOpen,
    lastCloseTimeSec: lastClose,
    lastOpenTimeSec: lastOpen,
    satisfiesExplicitRequirement: satisfies,
    consumerId: req?.consumerId ?? null,
    requiredMinValidCandles: req?.minValidCandles ?? null,
    observedRangeOnly: true,
  };

  return { coverage, findings, insufficientHistoryCount };
}
