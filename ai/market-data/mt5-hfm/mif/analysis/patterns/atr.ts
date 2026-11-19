/**
 * Phase 5C Step 1B — ATR helper for pattern residuals.
 *
 * Policy ATR method: SMA_OF_TR (explicit). Reuses strategy atrAt — does NOT use Wilder RMA.
 * Mixing Wilder and SMA_OF_TR is forbidden for this engine.
 */
import {
  atrAt,
  ATR_METHOD_V1,
} from "../../../../../forex-ai/automated-trading/auto-engine/strategy/evaluate.js";
import type { StructureCandle } from "../../../../../forex-structure/types.js";
import { MIF_CHART_PATTERNS_ATR_METHOD_ID } from "./contracts.js";

export function resolvePatternAtr(input: {
  candles: readonly StructureCandle[];
  period: number;
  methodId: string;
}): { atr: number | null; methodId: typeof MIF_CHART_PATTERNS_ATR_METHOD_ID | null; error: string | null } {
  if (input.methodId !== MIF_CHART_PATTERNS_ATR_METHOD_ID && input.methodId !== ATR_METHOD_V1) {
    return {
      atr: null,
      methodId: null,
      error: `unsupported ATR method ${input.methodId}; expected ${MIF_CHART_PATTERNS_ATR_METHOD_ID}`,
    };
  }
  const closed = input.candles.filter((c) => c.isClosed !== false && c.closed !== false);
  if (closed.length < input.period + 1) {
    return { atr: null, methodId: MIF_CHART_PATTERNS_ATR_METHOD_ID, error: "insufficient closed candles for ATR" };
  }
  const highs = closed.map((c) => c.high);
  const lows = closed.map((c) => c.low);
  const closes = closed.map((c) => c.close);
  const endIndex = closed.length - 1;
  const atr = atrAt(highs, lows, closes, input.period, endIndex);
  if (atr == null) {
    return { atr: null, methodId: MIF_CHART_PATTERNS_ATR_METHOD_ID, error: "ATR computation returned null" };
  }
  return { atr, methodId: MIF_CHART_PATTERNS_ATR_METHOD_ID, error: null };
}
