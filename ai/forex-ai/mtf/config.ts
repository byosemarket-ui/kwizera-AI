/**
 * Phase 21 — Multi-timeframe configuration (data-driven from Binance-supported TFs).
 * Supported project timeframes: 1m, 5m, 15m, 30m, 1h, 4h, 1d, 1w
 */
import type { NormalizedTimeframeId } from "../../market-data/binance/types.js";

export type ForexMtfRole =
  | "PRIMARY_TREND"
  | "INTERMEDIATE_TREND"
  | "INTERMEDIATE_CONFIRMATION"
  | "TACTICAL"
  | "LOWER_CONFIRMATION";

/** Default hierarchy — all are Binance-supported in this project. */
export const FOREX_MTF_DEFAULT_STACK: NormalizedTimeframeId[] = [
  "4h",
  "1h",
  "30m",
  "15m",
  "5m",
];

/** Required for a "complete" MTF analysis. */
export const FOREX_MTF_REQUIRED: NormalizedTimeframeId[] = ["4h", "1h", "15m"];

/** Optional enrichment timeframes. */
export const FOREX_MTF_OPTIONAL: NormalizedTimeframeId[] = ["30m", "5m"];

export const FOREX_MTF_ROLES: Record<string, ForexMtfRole> = {
  "4h": "PRIMARY_TREND",
  "1h": "INTERMEDIATE_TREND",
  "30m": "INTERMEDIATE_CONFIRMATION",
  "15m": "TACTICAL",
  "5m": "LOWER_CONFIRMATION",
  "1d": "PRIMARY_TREND",
  "1w": "PRIMARY_TREND",
  "1m": "LOWER_CONFIRMATION",
};

/** Higher → lower analytical authority order. */
export const FOREX_MTF_HIERARCHY_ORDER: NormalizedTimeframeId[] = [
  "1w", "1d", "4h", "1h", "30m", "15m", "5m", "1m",
];

export const FOREX_MTF_PROMPT_CHAR_BUDGET = 2800;
export const FOREX_MTF_SCHEMA_VERSION = "forex-mtf-ai-analysis-v1" as const;
export const FOREX_MTF_PROMPT_VERSION = "forex-mtf-prompt-v1";
export const FOREX_MTF_ENGINE_VERSION = "forex-mtf-engine-v1";

export function roleForTimeframe(tf: string): ForexMtfRole {
  return FOREX_MTF_ROLES[tf] ?? "TACTICAL";
}

export function sortTimeframesTopDown(timeframes: NormalizedTimeframeId[]): NormalizedTimeframeId[] {
  return [...timeframes].sort(
    (a, b) => FOREX_MTF_HIERARCHY_ORDER.indexOf(a) - FOREX_MTF_HIERARCHY_ORDER.indexOf(b),
  );
}
