/**
 * Deterministic candlestick pattern detection engine — Phase 38C.
 * Scans recent closed bars; forming candles yield CANDIDATE only when includeForming.
 */

import { isCandleClosed } from "./geometry.js";
import { mergePatternParams, paramsRecord, RULE_VERSION } from "./params.js";
import { matchPatternsAtEnd, type PatternMatch } from "./rules.js";
import {
  PATTERN_FAMILY,
  PATTERN_SCHEMA_VERSION,
  type CandlestickPatternDetection,
  type PatternAnalysisResult,
  type PatternCandle,
  type PatternDetectionInput,
  type PatternRuleParams,
  type PatternStatus,
  type UnifiedCandleLike,
} from "./types.js";
import { validatePatternCandles } from "./validate.js";

const ANALYSIS_NOTE =
  "Educational rule-based candlestick geometry only. Not a trade signal and does not guarantee future direction.";

const INSUFFICIENT_NOTE =
  "Insufficient closed candle history for candlestick pattern analysis under rule version "
  + RULE_VERSION
  + ". Need at least 1 closed candle for single-candle patterns, 2 for engulfing, 3 for stars.";

function candleCountForPattern(patternId: string): number {
  if (
    patternId === "bullish_engulfing"
    || patternId === "bearish_engulfing"
  ) {
    return 2;
  }
  if (patternId === "morning_star" || patternId === "evening_star") {
    return 3;
  }
  return 1;
}

function toDetection(
  match: PatternMatch,
  input: PatternDetectionInput,
  window: PatternCandle[],
  params: PatternRuleParams,
  status: PatternStatus,
): CandlestickPatternDetection {
  const need = candleCountForPattern(match.patternId);
  const slice = window.slice(window.length - need);
  const times = slice.map((c) => c.time);
  const record = paramsRecord(params);
  const filtered: Record<string, number> = {};
  for (const key of match.paramKeys) {
    if (key in record) filtered[key] = record[key]!;
  }
  return {
    patternId: match.patternId,
    patternName: match.patternName,
    patternFamily: PATTERN_FAMILY,
    direction: match.direction,
    status,
    provider: input.provider,
    environment: input.environment ?? null,
    symbol: input.symbol,
    timeframe: input.timeframe,
    candleStartTime: times[0]!,
    candleEndTime: times[times.length - 1]!,
    candleTimes: times,
    ruleVersion: RULE_VERSION,
    parameters: filtered,
    evidence: match.evidence,
    confirmationRequirement: match.confirmationRequirement,
    invalidationCondition: match.invalidationCondition,
    warnings: [...match.warnings],
    priceBasis: input.priceBasis ?? null,
  };
}

function emptyResult(
  input: PatternDetectionInput,
  validation: PatternAnalysisResult["validation"],
  analyzedClosedCount: number,
  formingExcluded: boolean,
  note: string,
): PatternAnalysisResult {
  return {
    schemaVersion: PATTERN_SCHEMA_VERSION,
    ruleVersion: RULE_VERSION,
    provider: input.provider,
    symbol: input.symbol,
    timeframe: input.timeframe,
    detections: [],
    validation,
    analyzedClosedCount,
    formingExcluded,
    note,
  };
}

/**
 * Detect candlestick patterns on the most recent windows of a candle series.
 * Same inputs → same detections (pure / deterministic).
 */
export function detectCandlestickPatterns(input: PatternDetectionInput): PatternAnalysisResult {
  const params = mergePatternParams(input.params);
  const { candles, validation } = validatePatternCandles(input.candles ?? []);

  const closed: PatternCandle[] = [];
  const forming: PatternCandle[] = [];
  for (const candle of candles) {
    if (isCandleClosed(candle)) closed.push(candle);
    else forming.push(candle);
  }

  // Prefer a single trailing forming candle when includeForming.
  const trailingForming =
    input.includeForming && forming.length > 0
      ? forming[forming.length - 1]!
      : null;
  const formingExcluded = Boolean(
    !input.includeForming && candles.some((c) => !isCandleClosed(c)),
  );

  if (closed.length < 1 && !trailingForming) {
    return emptyResult(
      input,
      {
        ...validation,
        ok: false,
        insufficientHistory: true,
        warnings: [
          ...validation.warnings,
          "No closed candles available for pattern detection.",
        ],
      },
      0,
      formingExcluded,
      INSUFFICIENT_NOTE,
    );
  }

  const warnings = [...validation.warnings];
  if (closed.length < 2) {
    warnings.push("Fewer than 2 closed candles — engulfing patterns cannot be evaluated on closed bars.");
  }
  if (closed.length < 3) {
    warnings.push("Fewer than 3 closed candles — morning/evening star patterns cannot be evaluated on closed bars.");
  }

  const detections: CandlestickPatternDetection[] = [];
  const scanStart = Math.max(0, closed.length - params.scanBars);

  // Scan closed candles only — newest endings last in loop, then reverse sort.
  for (let end = scanStart; end < closed.length; end += 1) {
    const matches = matchPatternsAtEnd(closed, end, params);
    for (const match of matches) {
      const need = candleCountForPattern(match.patternId);
      const window = closed.slice(0, end + 1);
      if (window.length < need) continue;
      detections.push(toDetection(match, input, window, params, "CONFIRMED"));
    }
  }

  // Optional forming candle: CANDIDATE only, never CONFIRMED.
  if (trailingForming) {
    const withForming = [...closed, trailingForming];
    const end = withForming.length - 1;
    const matches = matchPatternsAtEnd(withForming, end, params);
    for (const match of matches) {
      const need = candleCountForPattern(match.patternId);
      if (withForming.length < need) continue;
      detections.push(
        toDetection(match, input, withForming, params, "CANDIDATE"),
      );
    }
  }

  // Newest first; stable secondary by patternId for reproducibility.
  detections.sort((a, b) => {
    if (a.candleEndTime !== b.candleEndTime) return b.candleEndTime - a.candleEndTime;
    return a.patternId.localeCompare(b.patternId);
  });

  const capped = detections.slice(0, params.maxDetections);

  // insufficientHistory: cannot run the full 7-pattern suite when closed < 3
  // and no forming extension helps stars — flag when closed < 1 (hard), else soft warnings only.
  // Spec: set insufficientHistory when history too short for meaningful analysis.
  // With >= 1 closed we can evaluate singles; keep insufficientHistory false but note incompleteness.
  const insufficientHistory = closed.length < 1 && !trailingForming;

  return {
    schemaVersion: PATTERN_SCHEMA_VERSION,
    ruleVersion: RULE_VERSION,
    provider: input.provider,
    symbol: input.symbol,
    timeframe: input.timeframe,
    detections: capped,
    validation: {
      ...validation,
      ok: validation.skippedInvalid === 0 || candles.length > 0,
      warnings,
      insufficientHistory,
    },
    analyzedClosedCount: closed.length,
    formingExcluded,
    note: ANALYSIS_NOTE,
  };
}

/** Map UnifiedCandle-like series into PatternCandle[]. */
export function fromUnifiedCandles(series: UnifiedCandleLike[]): PatternCandle[] {
  return (series ?? []).map((c) => ({
    time: c.time,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    isClosed: typeof c.isClosed === "boolean" ? c.isClosed : undefined,
    closed: typeof c.closed === "boolean" ? c.closed : undefined,
  }));
}
