/**
 * Documented default thresholds for candlestick-patterns-v1.
 *
 * All ratios are relative (body/range, wick/body) — never absolute price levels.
 *
 * Rules (v1):
 * 1. Doji (1): body/range <= dojiBodyMaxRatio; range > 0; NEUTRAL.
 * 2. Hammer (1): body/range <= hammerBodyMaxRatio; lowerWick >= hammerLowerWickMinRatio * body;
 *    upperWick <= hammerUpperWickMaxRatio * body; small body near high; BULLISH.
 * 3. Shooting Star (1): mirror of hammer (small body near low); BEARISH.
 * 4. Bullish Engulfing (2): prior bearish, current bullish; current body engulfs prior body;
 *    both bodies >= engulfingMinBodyRatio of their range; BULLISH.
 * 5. Bearish Engulfing (2): mirror; BEARISH.
 * 6. Morning Star (3): [-3] bearish substantial body; [-2] small (starMiddleBodyMaxRatio);
 *    soft gap/penetration (starGapOrPenetrationFactor); [-1] bullish closing into/above
 *    midpoint of [-3] body; BULLISH. CONFIRMED only if all three closed.
 * 7. Evening Star (3): mirror; BEARISH.
 *
 * Zero-range candles (range <= minRangeEpsilon * scale) are skipped for all patterns
 * that require a positive range — never fabricate OHLC.
 */

import type { PatternRuleParams } from "./types.js";

export const RULE_VERSION = "candlestick-patterns-v1";

export const DEFAULT_PATTERN_PARAMS: PatternRuleParams = {
  /** Doji: max body size as fraction of full candle range. */
  dojiBodyMaxRatio: 0.1,
  /** Hammer: max body/range. */
  hammerBodyMaxRatio: 0.35,
  /** Hammer: lower wick must be at least this multiple of body. */
  hammerLowerWickMinRatio: 2.0,
  /** Hammer: upper wick at most this multiple of body. */
  hammerUpperWickMaxRatio: 0.5,
  /** Shooting star: mirror of hammer body/range. */
  shootingStarBodyMaxRatio: 0.35,
  /** Shooting star: upper wick min multiple of body. */
  shootingStarUpperWickMinRatio: 2.0,
  /** Shooting star: lower wick max multiple of body. */
  shootingStarLowerWickMaxRatio: 0.5,
  /** Engulfing + star first candle: min body/range for "substantial" bodies. */
  engulfingMinBodyRatio: 0.4,
  /** Star middle candle: max body/range (doji-like). */
  starMiddleBodyMaxRatio: 0.35,
  /**
   * Soft star gap/penetration factor (0–1).
   * Middle qualifies if body is small (starMiddleBodyMaxRatio) between opposite
   * first/third candles, OR middle close sits in the soft gap zone between first
   * close and third open scaled by this factor. v1 does not require a hard gap.
   */
  starGapOrPenetrationFactor: 0.5,
  /**
   * Relative zero-range epsilon. range <= minRangeEpsilon * max(|prices|, 1)
   * is treated as zero-range and skipped for ratio-based rules.
   */
  minRangeEpsilon: 1e-12,
  /** Scan this many most-recent closed bars for pattern endings. */
  scanBars: 50,
  /** Cap returned detections (newest first). */
  maxDetections: 20,
};

export function mergePatternParams(partial?: Partial<PatternRuleParams>): PatternRuleParams {
  if (!partial) return { ...DEFAULT_PATTERN_PARAMS };
  return {
    dojiBodyMaxRatio: partial.dojiBodyMaxRatio ?? DEFAULT_PATTERN_PARAMS.dojiBodyMaxRatio,
    hammerBodyMaxRatio: partial.hammerBodyMaxRatio ?? DEFAULT_PATTERN_PARAMS.hammerBodyMaxRatio,
    hammerLowerWickMinRatio: partial.hammerLowerWickMinRatio ?? DEFAULT_PATTERN_PARAMS.hammerLowerWickMinRatio,
    hammerUpperWickMaxRatio: partial.hammerUpperWickMaxRatio ?? DEFAULT_PATTERN_PARAMS.hammerUpperWickMaxRatio,
    shootingStarBodyMaxRatio: partial.shootingStarBodyMaxRatio ?? DEFAULT_PATTERN_PARAMS.shootingStarBodyMaxRatio,
    shootingStarUpperWickMinRatio:
      partial.shootingStarUpperWickMinRatio ?? DEFAULT_PATTERN_PARAMS.shootingStarUpperWickMinRatio,
    shootingStarLowerWickMaxRatio:
      partial.shootingStarLowerWickMaxRatio ?? DEFAULT_PATTERN_PARAMS.shootingStarLowerWickMaxRatio,
    engulfingMinBodyRatio: partial.engulfingMinBodyRatio ?? DEFAULT_PATTERN_PARAMS.engulfingMinBodyRatio,
    starMiddleBodyMaxRatio: partial.starMiddleBodyMaxRatio ?? DEFAULT_PATTERN_PARAMS.starMiddleBodyMaxRatio,
    starGapOrPenetrationFactor:
      partial.starGapOrPenetrationFactor ?? DEFAULT_PATTERN_PARAMS.starGapOrPenetrationFactor,
    minRangeEpsilon: partial.minRangeEpsilon ?? DEFAULT_PATTERN_PARAMS.minRangeEpsilon,
    scanBars: partial.scanBars ?? DEFAULT_PATTERN_PARAMS.scanBars,
    maxDetections: partial.maxDetections ?? DEFAULT_PATTERN_PARAMS.maxDetections,
  };
}

/** Numeric parameters attached to each detection for reproducibility. */
export function paramsRecord(params: PatternRuleParams): Record<string, number> {
  return {
    dojiBodyMaxRatio: params.dojiBodyMaxRatio,
    hammerBodyMaxRatio: params.hammerBodyMaxRatio,
    hammerLowerWickMinRatio: params.hammerLowerWickMinRatio,
    hammerUpperWickMaxRatio: params.hammerUpperWickMaxRatio,
    shootingStarBodyMaxRatio: params.shootingStarBodyMaxRatio,
    shootingStarUpperWickMinRatio: params.shootingStarUpperWickMinRatio,
    shootingStarLowerWickMaxRatio: params.shootingStarLowerWickMaxRatio,
    engulfingMinBodyRatio: params.engulfingMinBodyRatio,
    starMiddleBodyMaxRatio: params.starMiddleBodyMaxRatio,
    starGapOrPenetrationFactor: params.starGapOrPenetrationFactor,
    minRangeEpsilon: params.minRangeEpsilon,
  };
}
