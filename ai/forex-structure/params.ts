/**
 * Documented default thresholds for market-structure-v1.
 *
 * Swing fractal (L=swingLeft, R=swingRight):
 * - HIGH at i: high[i] > high[i-L..i-1] and high[i] >= high[i+1..i+R]
 *   (strict > on left, >= on right — prefer earliest index on ties)
 * - LOW at i: low[i] < low[i-L..i-1] and low[i] <= low[i+1..i+R]
 * - CONFIRMED only when all right-side candles are closed
 * - PROVISIONAL when right window incomplete or includes a forming candle
 * - Never use a forming candle as confirmation of historical swings
 *
 * Classifications compare each confirmed swing to the prior confirmed swing of the same kind.
 * Equal within equalHighLowEpsilonRel * priceScale → EQUAL_HIGH / EQUAL_LOW (not forced HH/HL).
 *
 * Trend (last up to 6 classifications, need >= minConfirmedSwingsForTrend confirmed swings):
 * - HH+HL count > LH+LL → BULLISH
 * - LH+LL count > HH+HL → BEARISH
 * - Mixed / equal / alternating without clear dominance → RANGE
 * - Fewer than minConfirmedSwingsForTrend confirmed swings → UNKNOWN
 *
 * BOS/CHoCH only when trend is BULLISH or BEARISH (not UNKNOWN/RANGE).
 */

import type { StructureRuleParams } from "./types.js";

export const RULE_VERSION = "market-structure-v1";

export const DEFAULT_STRUCTURE_PARAMS: StructureRuleParams = {
  swingLeft: 2,
  swingRight: 2,
  equalHighLowEpsilonRel: 1e-8,
  bosBufferRel: 0,
  requireCloseBeyond: true,
  zoneToleranceRel: 0.0015,
  maxSwings: 40,
  maxEvents: 20,
  maxZones: 12,
  scanBars: 200,
  staleZoneBars: 80,
  minConfirmedSwingsForTrend: 4,
};

export function mergeStructureParams(partial?: Partial<StructureRuleParams>): StructureRuleParams {
  if (!partial) return { ...DEFAULT_STRUCTURE_PARAMS };
  return {
    swingLeft: partial.swingLeft ?? DEFAULT_STRUCTURE_PARAMS.swingLeft,
    swingRight: partial.swingRight ?? DEFAULT_STRUCTURE_PARAMS.swingRight,
    equalHighLowEpsilonRel:
      partial.equalHighLowEpsilonRel ?? DEFAULT_STRUCTURE_PARAMS.equalHighLowEpsilonRel,
    bosBufferRel: partial.bosBufferRel ?? DEFAULT_STRUCTURE_PARAMS.bosBufferRel,
    requireCloseBeyond: partial.requireCloseBeyond ?? DEFAULT_STRUCTURE_PARAMS.requireCloseBeyond,
    zoneToleranceRel: partial.zoneToleranceRel ?? DEFAULT_STRUCTURE_PARAMS.zoneToleranceRel,
    maxSwings: partial.maxSwings ?? DEFAULT_STRUCTURE_PARAMS.maxSwings,
    maxEvents: partial.maxEvents ?? DEFAULT_STRUCTURE_PARAMS.maxEvents,
    maxZones: partial.maxZones ?? DEFAULT_STRUCTURE_PARAMS.maxZones,
    scanBars: partial.scanBars ?? DEFAULT_STRUCTURE_PARAMS.scanBars,
    staleZoneBars: partial.staleZoneBars ?? DEFAULT_STRUCTURE_PARAMS.staleZoneBars,
    minConfirmedSwingsForTrend:
      partial.minConfirmedSwingsForTrend ?? DEFAULT_STRUCTURE_PARAMS.minConfirmedSwingsForTrend,
  };
}

/** Numeric parameters attached to analysis for reproducibility. */
export function paramsRecord(params: StructureRuleParams): Record<string, number> {
  return {
    swingLeft: params.swingLeft,
    swingRight: params.swingRight,
    equalHighLowEpsilonRel: params.equalHighLowEpsilonRel,
    bosBufferRel: params.bosBufferRel,
    requireCloseBeyond: params.requireCloseBeyond ? 1 : 0,
    zoneToleranceRel: params.zoneToleranceRel,
    maxSwings: params.maxSwings,
    maxEvents: params.maxEvents,
    maxZones: params.maxZones,
    scanBars: params.scanBars,
    staleZoneBars: params.staleZoneBars,
    minConfirmedSwingsForTrend: params.minConfirmedSwingsForTrend,
  };
}
