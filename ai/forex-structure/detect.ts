/**
 * Deterministic market structure detection engine — Phase 38D.
 * Swings → classifications → trend → BOS/CHoCH → zones.
 */

import { classifyConfirmedSwings, resolveTrendState } from "./classify.js";
import { detectStructureEvents } from "./events.js";
import { mergeStructureParams, paramsRecord, RULE_VERSION } from "./params.js";
import { detectSwings } from "./swings.js";
import {
  STRUCTURE_SCHEMA_VERSION,
  type MarketStructureAnalysisResult,
  type StructureCandle,
  type StructureDetectionInput,
  type UnifiedCandleLike,
} from "./types.js";
import { isStructureCandleClosed, validateStructureCandles } from "./validate.js";
import { buildStructureZones } from "./zones.js";

const ANALYSIS_NOTE =
  "Educational rule-based market structure only (swings, BOS/CHoCH, S/R zones). "
  + "Not a trade signal and does not guarantee future direction.";

const INSUFFICIENT_NOTE =
  "Insufficient closed candle history for market structure analysis under rule version "
  + RULE_VERSION
  + ". Need enough bars for fractal swings (swingLeft + swingRight + 1) and "
  + "minConfirmedSwingsForTrend confirmed swings for trend state.";

function analyzedAtFrom(candles: StructureCandle[]): number {
  if (candles.length === 0) return 0;
  return candles[candles.length - 1]!.time * 1000;
}

function emptyResult(
  input: StructureDetectionInput,
  validation: MarketStructureAnalysisResult["validation"],
  analyzedClosedCount: number,
  formingExcluded: boolean,
  note: string,
  params: ReturnType<typeof mergeStructureParams>,
  warnings: string[],
  candles: StructureCandle[],
): MarketStructureAnalysisResult {
  return {
    schemaVersion: STRUCTURE_SCHEMA_VERSION,
    ruleVersion: RULE_VERSION,
    provider: input.provider,
    environment: input.environment ?? null,
    symbol: input.symbol,
    timeframe: input.timeframe,
    analyzedAt: analyzedAtFrom(candles),
    analyzedClosedCount,
    formingExcluded,
    swings: [],
    classifications: [],
    trendState: "UNKNOWN",
    events: [],
    zones: [],
    validation,
    warnings,
    note,
    parameters: paramsRecord(params),
    priceBasis: input.priceBasis ?? null,
  };
}

/**
 * Detect market structure on a candle series.
 * Same inputs → same structure outputs (pure / deterministic aside from analyzedAt).
 */
export function detectMarketStructure(input: StructureDetectionInput): MarketStructureAnalysisResult {
  const params = mergeStructureParams(input.params);
  const { candles, validation } = validateStructureCandles(input.candles ?? []);

  const closed: StructureCandle[] = [];
  const forming: StructureCandle[] = [];
  for (const candle of candles) {
    if (isStructureCandleClosed(candle)) closed.push(candle);
    else forming.push(candle);
  }

  const trailingForming =
    input.includeForming && forming.length > 0
      ? forming[forming.length - 1]!
      : null;
  const formingExcluded = Boolean(
    !input.includeForming && candles.some((c) => !isStructureCandleClosed(c)),
  );

  const series: StructureCandle[] = trailingForming
    ? [...closed, trailingForming]
    : [...closed];

  // Restrict analysis window to scanBars of closed history (+ optional forming).
  const closedScanStart = Math.max(0, closed.length - params.scanBars);
  const closedWindow = closed.slice(closedScanStart);
  const windowSeries: StructureCandle[] = trailingForming
    ? [...closedWindow, trailingForming]
    : [...closedWindow];
  const closedCountInWindow = closedWindow.length;

  const minBars = params.swingLeft + params.swingRight + 1;
  if (closedCountInWindow < minBars && !trailingForming) {
    return emptyResult(
      input,
      {
        ...validation,
        ok: false,
        insufficientHistory: true,
        warnings: [
          ...validation.warnings,
          `Need at least ${minBars} closed candles for fractal swings (have ${closed.length}).`,
        ],
      },
      closed.length,
      formingExcluded,
      INSUFFICIENT_NOTE,
      params,
      [
        ...validation.warnings,
        `Need at least ${minBars} closed candles for fractal swings (have ${closed.length}).`,
      ],
      candles,
    );
  }

  const warnings = [...validation.warnings];

  const swings = detectSwings(
    windowSeries,
    closedCountInWindow,
    params,
    Boolean(trailingForming),
  );

  // Remap swing indices to absolute positions in the full closed+forming series for evidence clarity.
  // Indices are relative to windowSeries; that is intentional and stable for the scanned window.

  const classifications = classifyConfirmedSwings(swings, params);
  const confirmedCount = swings.filter((s) => s.status === "CONFIRMED").length;
  const trendState = resolveTrendState(confirmedCount, classifications, params);

  if (confirmedCount < params.minConfirmedSwingsForTrend) {
    warnings.push(
      `Fewer than ${params.minConfirmedSwingsForTrend} confirmed swings — trendState UNKNOWN.`,
    );
  }

  const events = detectStructureEvents(
    windowSeries,
    closedCountInWindow,
    swings,
    trendState,
    params,
    Boolean(trailingForming),
  );

  const zones = buildStructureZones(
    windowSeries,
    closedCountInWindow,
    swings,
    params,
  );

  if (confirmedCount < 2) {
    warnings.push("Fewer than 2 confirmed swings — no S/R zones formed.");
  }

  const insufficientHistory = closed.length < minBars && !trailingForming;

  return {
    schemaVersion: STRUCTURE_SCHEMA_VERSION,
    ruleVersion: RULE_VERSION,
    provider: input.provider,
    environment: input.environment ?? null,
    symbol: input.symbol,
    timeframe: input.timeframe,
    analyzedAt: Date.now(),
    analyzedClosedCount: closed.length,
    formingExcluded,
    swings,
    classifications,
    trendState,
    events,
    zones,
    validation: {
      ...validation,
      ok: validation.skippedInvalid === 0 || series.length > 0,
      warnings,
      insufficientHistory,
    },
    warnings,
    note: ANALYSIS_NOTE,
    parameters: paramsRecord(params),
    priceBasis: input.priceBasis ?? null,
  };
}

/** Map UnifiedCandle-like series into StructureCandle[]. */
export function fromUnifiedCandles(series: UnifiedCandleLike[]): StructureCandle[] {
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
