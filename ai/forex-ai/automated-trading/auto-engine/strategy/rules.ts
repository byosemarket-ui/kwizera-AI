/**
 * Phase 4.1 — Documented DEMO auto-engine strategy rules.
 *
 * INTENTIONALLY NOT A PROFITABILITY CLAIM.
 * This is a deterministic, testable rule set for DEMO automation plumbing.
 * No backtest in this repository proves positive expectancy.
 *
 * Strategy id: kwizera.sma-crossover.v1
 * -------------------------------------
 * Instrument/timeframe: configured externally (default XAU/USD, 15m).
 * Indicators (closed candles only; never the forming bar):
 *   - Fast SMA length = 9
 *   - Slow SMA length = 21
 * Entry:
 *   - BUY when prior bar fast<=slow and current closed bar fast>slow (bullish cross)
 *   - SELL when prior bar fast>=slow and current closed bar fast<slow (bearish cross)
 *   - Otherwise NO_TRADE
 * Protective geometry (absolute prices from last closed close):
 *   - stopDistance = max(ATR(14) * 1.5, pointSize * minStopPoints)
 *   - takeProfitDistance = stopDistance * 2 (fixed 2R; not trailing / not break-even)
 * Reject when:
 *   - fewer than slow+2 closed candles
 *   - ATR unavailable / non-positive
 *   - spreadWiderThanMax (caller supplies spread check)
 *   - duplicate signal key already consumed for this closed candle
 *
 * No trailing stop. No break-even. No martingale. No grid.
 */
export const STRATEGY_ID = "kwizera.sma-crossover.v1" as const;
export const STRATEGY_PHASE = "4.1" as const;

export const SMA_CROSSOVER_RULES = {
  strategyId: STRATEGY_ID,
  fastSmaLength: 9,
  slowSmaLength: 21,
  atrLength: 14,
  stopAtrMultiple: 1.5,
  takeProfitRMultiple: 2,
  /** Minimum stop distance in points when ATR is tiny. */
  minStopPoints: 50,
  usesFormingCandle: false,
  trailingStop: false,
  breakEven: false,
  profitabilityClaimed: false,
  notes: [
    "Educational / plumbing strategy only — no profitability claim.",
    "Signals use fully closed candles only.",
    "SL/TP are static ATR-based distances at entry; no trail or BE.",
  ],
} as const;

export type SmaCrossoverRules = typeof SMA_CROSSOVER_RULES;

export type StrategyDirection = "BUY" | "SELL" | "NO_TRADE";

export interface StrategyCandle {
  /** Candle open time (unix seconds). */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  /** When false/undefined, candle is treated as closed if it is not the last row. */
  closed?: boolean;
}
